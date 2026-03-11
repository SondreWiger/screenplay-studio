import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0a0a14',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Clapperboard sticks — diagonal stripes across top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div style={{ width: 10, height: 18, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: -3 }} />
          <div style={{ width: 9,  height: 18, background: '#fff',     transform: 'skewX(-22deg)', marginLeft: 1  }} />
          <div style={{ width: 9,  height: 18, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: 1  }} />
          <div style={{ width: 9,  height: 18, background: '#fff',     transform: 'skewX(-22deg)', marginLeft: 1  }} />
          <div style={{ width: 9,  height: 18, background: '#FF5F1F', transform: 'skewX(-22deg)', marginLeft: 1  }} />
        </div>
        {/* Divider */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 0,
            right: 0,
            height: 2,
            background: '#FF5F1F',
          }}
        />
        {/* Body */}
        <div
          style={{
            position: 'absolute',
            top: 12,
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
              fontSize: 14,
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
