import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, voice_id, project_id } = await request.json();

    if (!text || !voice_id || !project_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user is owner or admin of the project
    const { data: member } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', project_id)
      .eq('user_id', user.id)
      .single();

    const { data: project } = await supabase
      .from('projects')
      .select('created_by')
      .eq('id', project_id)
      .single();

    const isOwner = project?.created_by === user.id;
    const isMemberAdmin = member?.role === 'admin' || member?.role === 'owner';

    if (!isOwner && !isMemberAdmin) {
      return NextResponse.json({ error: 'Only admins can use the voice generation feature.' }, { status: 403 });
    }

    const apiKey = process.env.FISH_AUDIO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS API Key not configured' }, { status: 500 });
    }

    // Call Fish Audio API
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': 's2.1-pro', // We will use their recommended pro model
      },
      body: JSON.stringify({
        text: text,
        reference_id: voice_id,
        format: 'mp3'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fish Audio API Error:', errorText);
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating audio:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
