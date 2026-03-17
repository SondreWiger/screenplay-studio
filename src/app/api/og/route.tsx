import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// ─── Design tokens (matching site aesthetic) ───────────────────────────────
const ORANGE  = '#FF5F1F';
const BG      = '#05050a';
const WHITE   = '#ffffff';
const MUTED   = 'rgba(255,255,255,0.45)';
const BORDER  = 'rgba(255,255,255,0.08)';
const DIM     = 'rgba(255,255,255,0.22)';

const TYPE_LABELS: Record<string, string> = {
  post:         'COMMUNITY POST',
  blog:         'BLOG POST',
  feedback:     'FEEDBACK',
  bug:          'BUG REPORT',
  feature:      'FEATURE REQUEST',
  testimonial:  'REVIEW',
  testimonials: 'REVIEWS',
  showcase:     'SHOWCASE',
  company:      'PRODUCTION CO.',
  user:         'MEMBER PROFILE',
  changelog:    'CHANGELOG',
  roadmap:      'ROADMAP',
};

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const type      = searchParams.get('type')     || '';
  const title     = searchParams.get('title')    || 'Screenplay Studio';
  const subtitle  = searchParams.get('subtitle') || '';
  const author    = searchParams.get('author')   || '';
  const meta1     = searchParams.get('meta1')    || '';
  const meta2     = searchParams.get('meta2')    || '';
  const ratingStr = searchParams.get('rating')   || '';
  const badge     = searchParams.get('badge')    || '';
  const rating    = ratingStr ? Math.max(1, Math.min(5, parseInt(ratingStr, 10))) : 0;

  const typeLabel    = TYPE_LABELS[type] ?? (type ? type.replace(/_/g, ' ').toUpperCase() : '');
  const titleSize    = title.length > 65 ? 40 : title.length > 45 ? 50 : title.length > 28 ? 58 : 66;
  const hasStats     = !!(meta1 || meta2);
  const hasBottomRow = !!(author || hasStats || rating > 0);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
          position: 'relative',
        }}
      >
        {/* ── Orange top accent bar ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: ORANGE, display: 'flex' }} />

        {/* ── Vertical left gradient bar ── */}
        <div style={{ position: 'absolute', top: '18%', bottom: '18%', left: 0, width: '3px', background: `linear-gradient(to bottom, transparent, ${ORANGE}88, transparent)`, display: 'flex' }} />

        {/* ── Corner crosshairs ── */}
        <div style={{ position: 'absolute', top: 28, left: 28, width: 16, height: 16, borderTop: `1.5px solid ${ORANGE}`, borderLeft: `1.5px solid ${ORANGE}`, display: 'flex' }} />
        <div style={{ position: 'absolute', top: 28, right: 28, width: 16, height: 16, borderTop: `1.5px solid ${ORANGE}`, borderRight: `1.5px solid ${ORANGE}`, display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 28, left: 28, width: 16, height: 16, borderBottom: `1.5px solid ${ORANGE}`, borderLeft: `1.5px solid ${ORANGE}`, display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 28, right: 28, width: 16, height: 16, borderBottom: `1.5px solid ${ORANGE}`, borderRight: `1.5px solid ${ORANGE}`, display: 'flex' }} />

        {/* ── Main content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 72px 50px' }}>

          {/* Header row: branding left, type badge right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '22px', height: '22px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                🎬
              </div>
              <span style={{ color: DIM, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', display: 'flex' }}>
                Screenplay Studio
              </span>
            </div>
            {typeLabel ? (
              <div style={{ background: ORANGE, color: WHITE, fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em', padding: '7px 18px', textTransform: 'uppercase', display: 'flex' }}>
                {typeLabel}
              </div>
            ) : null}
          </div>

          {/* Optional badge (genre / status tag) */}
          {badge ? (
            <div style={{ display: 'flex', marginBottom: '14px' }}>
              <span style={{ border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.32)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', padding: '4px 12px', display: 'flex', textTransform: 'uppercase' }}>
                {badge}
              </span>
            </div>
          ) : null}

          {/* Star rating (testimonials) */}
          {rating > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '14px' }}>
              {([1, 2, 3, 4, 5] as const).map((i) => (
                <span key={i} style={{ color: i <= rating ? ORANGE : 'rgba(255,255,255,0.10)', fontSize: '26px', lineHeight: '1', display: 'flex' }}>★</span>
              ))}
            </div>
          ) : null}

          {/* Title */}
          <div style={{ display: 'flex', flex: 1, alignItems: subtitle || hasBottomRow ? 'flex-start' : 'center' }}>
            <span style={{
              color: WHITE,
              fontSize: `${titleSize}px`,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              maxWidth: '1060px',
            }}>
              {truncate(title, 100)}
            </span>
          </div>

          {/* Subtitle / excerpt */}
          {subtitle ? (
            <div style={{ display: 'flex', marginTop: '14px', marginBottom: hasBottomRow ? '18px' : '0' }}>
              <span style={{ color: MUTED, fontSize: '20px', fontWeight: 400, lineHeight: 1.45, maxWidth: '960px' }}>
                {truncate(subtitle, 130)}
              </span>
            </div>
          ) : null}

          {/* Bottom meta row: author left, stats right */}
          {hasBottomRow ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: `1px solid ${BORDER}`,
              marginTop: subtitle ? '4px' : '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {author ? (
                  <>
                    <div style={{ width: '28px', height: '28px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                      {author[0].toUpperCase()}
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.48)', fontSize: '17px', fontWeight: 500, display: 'flex' }}>
                      {truncate(author, 40)}
                    </span>
                  </>
                ) : <div style={{ display: 'flex' }} />}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                {meta1 ? (
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '18px', fontWeight: 600, display: 'flex' }}>{meta1}</span>
                ) : null}
                {meta2 ? (
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '18px', fontWeight: 600, display: 'flex' }}>{meta2}</span>
                ) : null}
              </div>
            </div>
          ) : null}

        </div>

        {/* ── Bottom branding ── */}
        <div style={{ position: 'absolute', bottom: '18px', left: '72px', color: 'rgba(255,255,255,0.16)', fontSize: '12px', letterSpacing: '0.1em', display: 'flex' }}>
          screenplaystudio.fun
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
