import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ────────────────────────────────────────────────────────────
// Broadcast Timing Engine API
// ────────────────────────────────────────────────────────────
// GET  /api/broadcast/timing?rundown_id=...
//      → Returns back-times, over/under, show state
//
// POST /api/broadcast/timing
//      → Actions: start_show, end_show, take_item, complete_item,
//                 kill_item, skip_item, update_duration
//
// This route calls server-side PostgreSQL functions for
// back-timing and over/under calculations — the database
// is the source of truth, not the client.
// ────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── GET: Timing state for a rundown ───────────────────────

export async function GET(request: NextRequest) {
  const rundownId = request.nextUrl.searchParams.get('rundown_id');
  if (!rundownId) {
    return NextResponse.json({ error: 'rundown_id required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Fetch rundown metadata
  const { data: rundown, error: rundownError } = await supabase
    .from('broadcast_rundowns')
    .select('*')
    .eq('id', rundownId)
    .single();

  if (rundownError || !rundown) {
    return NextResponse.json({ error: 'Rundown not found' }, { status: 404 });
  }

  // Call server-side back-timing function
  const { data: backTimes, error: btError } = await supabase
    .rpc('broadcast_calculate_back_times', { p_rundown_id: rundownId });

  // Call server-side over/under function
  const { data: overUnder, error: ouError } = await supabase
    .rpc('broadcast_rundown_over_under', { p_rundown_id: rundownId });

  // Get all items for current state
  const { data: items } = await supabase
    .from('broadcast_rundown_items')
    .select('id, title, sort_order, status, planned_duration, actual_duration, on_air_at, off_air_at, item_type, page_number')
    .eq('rundown_id', rundownId)
    .order('sort_order', { ascending: true });

  // Find current on-air item
  const onAirItem = (items || []).find(i => i.status === 'on_air');
  const nextPending = (items || []).find(i => i.status === 'pending' || i.status === 'standby');

  // Calculate real-time elapsed for on-air item
  let currentItemElapsed = 0;
  if (onAirItem?.on_air_at) {
    currentItemElapsed = Math.floor((Date.now() - new Date(onAirItem.on_air_at).getTime()) / 1000);
  }

  return NextResponse.json({
    rundown: {
      id: rundown.id,
      title: rundown.title,
      status: rundown.status,
      scheduled_start: rundown.scheduled_start,
      scheduled_end: rundown.scheduled_end,
      actual_start: rundown.actual_start,
      actual_end: rundown.actual_end,
    },
    timing: {
      back_times: backTimes || [],
      over_under: overUnder?.[0] || null,
    },
    live_state: {
      on_air_item_id: onAirItem?.id || null,
      on_air_item_title: onAirItem?.title || null,
      on_air_elapsed_seconds: currentItemElapsed,
      on_air_planned_duration: onAirItem?.planned_duration || 0,
      next_item_id: nextPending?.id || null,
      next_item_title: nextPending?.title || null,
      server_time: new Date().toISOString(),
    },
    items: items || [],
  });
}

// ─── POST: Timing actions ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, rundown_id, item_id, data } = body;

    if (!action || !rundown_id) {
      return NextResponse.json({ error: 'action and rundown_id required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    switch (action) {
      // ─── Show lifecycle ────────────────────────────────
      case 'start_show': {
        // Mark rundown as live, record actual start
        const { error } = await supabase
          .from('broadcast_rundowns')
          .update({ status: 'live', actual_start: now })
          .eq('id', rundown_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Log as-run entry
        await supabase.from('broadcast_as_run_log').insert({
          project_id: data?.project_id,
          rundown_id,
          event_type: 'show_start',
          title: 'Show Started',
          actual_time: now,
          is_automatic: false,
          operator: data?.operator,
        });

        // Create timing mark
        await supabase.from('broadcast_timing_marks').insert({
          project_id: data?.project_id,
          rundown_id,
          mark_type: 'show_start',
          wall_time: now,
          show_elapsed_seconds: 0,
          operator_id: data?.operator_id,
        });

        return NextResponse.json({ ok: true, action: 'show_started', time: now });
      }

      case 'end_show': {
        // Mark any on-air items as done
        await supabase
          .from('broadcast_rundown_items')
          .update({ status: 'done', off_air_at: now })
          .eq('rundown_id', rundown_id)
          .eq('status', 'on_air');

        // Mark rundown as completed
        const { error } = await supabase
          .from('broadcast_rundowns')
          .update({ status: 'completed', actual_end: now })
          .eq('id', rundown_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Log as-run
        await supabase.from('broadcast_as_run_log').insert({
          project_id: data?.project_id,
          rundown_id,
          event_type: 'show_end',
          title: 'Show Ended',
          actual_time: now,
          is_automatic: false,
          operator: data?.operator,
        });

        return NextResponse.json({ ok: true, action: 'show_ended', time: now });
      }

      // ─── Item lifecycle ────────────────────────────────
      case 'take_item': {
        if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

        // Complete current on-air item first
        const { data: currentOnAir } = await supabase
          .from('broadcast_rundown_items')
          .select('id, on_air_at, planned_duration, title')
          .eq('rundown_id', rundown_id)
          .eq('status', 'on_air')
          .maybeSingle();

        if (currentOnAir) {
          const actualDuration = Math.floor(
            (Date.now() - new Date(currentOnAir.on_air_at).getTime()) / 1000
          );
          await supabase
            .from('broadcast_rundown_items')
            .update({
              status: 'done',
              off_air_at: now,
              actual_duration: actualDuration,
            })
            .eq('id', currentOnAir.id);

          // Log the end of previous item
          await supabase.from('broadcast_as_run_log').insert({
            project_id: data?.project_id,
            rundown_id,
            rundown_item_id: currentOnAir.id,
            event_type: 'segment_end',
            title: currentOnAir.title,
            actual_time: now,
            planned_duration: currentOnAir.planned_duration,
            actual_duration: actualDuration,
            deviation_seconds: actualDuration - (currentOnAir.planned_duration || 0),
            is_automatic: true,
            operator: data?.operator,
          });
        }

        // Take new item on air
        const { data: takenItem, error: takeError } = await supabase
          .from('broadcast_rundown_items')
          .update({ status: 'on_air', on_air_at: now })
          .eq('id', item_id)
          .select('title, planned_duration')
          .single();

        if (takeError) return NextResponse.json({ error: takeError.message }, { status: 500 });

        // Log as-run start
        await supabase.from('broadcast_as_run_log').insert({
          project_id: data?.project_id,
          rundown_id,
          rundown_item_id: item_id,
          event_type: 'segment_start',
          title: takenItem?.title || 'Item',
          actual_time: now,
          planned_duration: takenItem?.planned_duration,
          is_automatic: false,
          operator: data?.operator,
        });

        // Timing mark
        const { data: rundown } = await supabase
          .from('broadcast_rundowns')
          .select('actual_start')
          .eq('id', rundown_id)
          .single();

        const showElapsed = rundown?.actual_start
          ? (Date.now() - new Date(rundown.actual_start).getTime()) / 1000
          : 0;

        await supabase.from('broadcast_timing_marks').insert({
          project_id: data?.project_id,
          rundown_id,
          rundown_item_id: item_id,
          mark_type: 'item_start',
          wall_time: now,
          show_elapsed_seconds: showElapsed,
          operator_id: data?.operator_id,
        });

        return NextResponse.json({ ok: true, action: 'item_taken', item_id, time: now });
      }

      case 'complete_item': {
        if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

        const { data: item } = await supabase
          .from('broadcast_rundown_items')
          .select('on_air_at, planned_duration, title')
          .eq('id', item_id)
          .single();

        const actualDuration = item?.on_air_at
          ? Math.floor((Date.now() - new Date(item.on_air_at).getTime()) / 1000)
          : data?.actual_duration || 0;

        const { error } = await supabase
          .from('broadcast_rundown_items')
          .update({
            status: 'done',
            off_air_at: now,
            actual_duration: actualDuration,
          })
          .eq('id', item_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await supabase.from('broadcast_as_run_log').insert({
          project_id: data?.project_id,
          rundown_id,
          rundown_item_id: item_id,
          event_type: 'segment_end',
          title: item?.title || 'Item',
          actual_time: now,
          planned_duration: item?.planned_duration,
          actual_duration: actualDuration,
          deviation_seconds: actualDuration - (item?.planned_duration || 0),
          is_automatic: false,
          operator: data?.operator,
        });

        return NextResponse.json({ ok: true, action: 'item_completed', item_id, actual_duration: actualDuration });
      }

      case 'kill_item': {
        if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

        const { error } = await supabase
          .from('broadcast_rundown_items')
          .update({ status: 'killed' })
          .eq('id', item_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, action: 'item_killed', item_id });
      }

      case 'skip_item': {
        if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

        const { error } = await supabase
          .from('broadcast_rundown_items')
          .update({ status: 'skipped' })
          .eq('id', item_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, action: 'item_skipped', item_id });
      }

      case 'update_duration': {
        if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

        const { error } = await supabase
          .from('broadcast_rundown_items')
          .update({ planned_duration: data?.planned_duration })
          .eq('id', item_id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, action: 'duration_updated', item_id });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error('Timing engine error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
