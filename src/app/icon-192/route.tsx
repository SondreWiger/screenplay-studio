import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

function clapperboard(size: number) {
  const stickH = Math.round(size * 0.28);
  const divH   = Math.round(size * 0.06);
  const fontSize = Math.round(size * 0.42);
  const stripeW  = Math.round(size / 5);

  return (
    <div
      style={{
        width: size,
        height: size,
        background: '#0a0a14',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        borderRadius: Math.round(size * 0.14),
      }}
    >
      {/* Clapperboard sticks */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: stickH,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {['#FF5F1F', '#fff', '#FF5F1F', '#fff', '#FF5F1F', '#fff'].map((bg, i) => (
          <div
            key={i}
            style={{
              width: stripeW,
              height: stickH * 2,
              background: bg,
              transform: 'skewX(-22deg)',
              marginLeft: i === 0 ? -Math.round(size * 0.08) : Math.round(size * 0.02),
            }}
          />
        ))}
      </div>
      {/* Divider */}
      <div
        style={{
          position: 'absolute',
          top: stickH,
          left: 0,
          right: 0,
          height: divH,
          background: '#FF5F1F',
        }}
      />
      {/* Body — "S" */}
      <div
        style={{
          position: 'absolute',
          top: stickH + divH,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#FF5F1F',
            fontSize,
            fontWeight: 900,
            fontFamily: 'sans-serif',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          S
        </span>
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = parseInt(searchParams.get('size') || '192', 10);

  try {
    return new ImageResponse(clapperboard(size), {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate icon' }, { status: 500 });
  }
}
