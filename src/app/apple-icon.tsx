import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#0a0a14',
          borderRadius: '40px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Clapperboard sticks */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 58,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div style={{ width: 54, height: 100, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: -14 }} />
          <div style={{ width: 50, height: 100, background: '#fff',     transform: 'skewX(-22deg)', marginLeft: 5  }} />
          <div style={{ width: 50, height: 100, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: 5  }} />
          <div style={{ width: 50, height: 100, background: '#fff',     transform: 'skewX(-22deg)', marginLeft: 5  }} />
          <div style={{ width: 50, height: 100, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: 5  }} />
        </div>
        {/* Divider */}
        <div
          style={{
            position: 'absolute',
            top: 58,
            left: 0,
            right: 0,
            height: 10,
            background: '#FF5F1F',
          }}
        />
        {/* Body */}
        <div
          style={{
            position: 'absolute',
            top: 68,
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
              fontSize: 82,
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
    ),
    { ...size },
  );
}
