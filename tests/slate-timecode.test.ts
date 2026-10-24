import { describe, it, expect } from 'vitest';
import {
  FRAME_RATES, frameRate, formatTimecode, framesAt, framesFromTimecode, framesPerDay,
  jamToTimeOfDay, parseTimecode, timecodeFromFrames,
} from '../mobile/reference/timecode';
import { LTCDecoder, LTCEncoder, decodeFrameBits, encodeFrameBits, SYNC_WORD, type DecodedLTC } from '../mobile/reference/ltc';

// The slate's timecode and LTC code (Swift, in the iOS app) is ported line for
// line from mobile/reference. These tests are what keeps it honest.

const tcString = (frames: number, id: string) => {
  const rate = frameRate(id);
  return formatTimecode(timecodeFromFrames(frames, rate), rate);
};

describe('timecode labels', () => {
  it('counts plain frame rates', () => {
    expect(tcString(0, '25')).toBe('00:00:00:00');
    expect(tcString(24, '25')).toBe('00:00:00:24');
    expect(tcString(25, '25')).toBe('00:00:01:00');
    expect(tcString(24 * 3600, '24')).toBe('01:00:00:00');
    expect(tcString(23, '23.976')).toBe('00:00:00:23');
  });

  it('skips the dropped labels in 29.97 drop-frame', () => {
    expect(tcString(1799, '29.97df')).toBe('00:00:59;29');
    expect(tcString(1800, '29.97df')).toBe('00:01:00;02'); // ;00 and ;01 don't exist
    expect(tcString(17982, '29.97df')).toBe('00:10:00;00'); // except every tenth minute
    expect(tcString(17981, '29.97df')).toBe('00:09:59;29');
    expect(tcString(107892, '29.97df')).toBe('01:00:00;00');
  });

  it('drops four labels a minute at 59.94', () => {
    expect(tcString(3600, '59.94df')).toBe('00:01:00;04');
    expect(tcString(35964, '59.94df')).toBe('00:10:00;00');
  });

  it('round-trips every frame of the first hour, at every rate', () => {
    // Compared by hand and asserted once: an expect() per frame is hundreds
    // of thousands of calls, which is slow enough to time out.
    const mismatches: string[] = [];
    for (const rate of FRAME_RATES) {
      const hour = Math.round(rate.actual * 3600);
      for (let f = 0; f < hour; f++) {
        const back = framesFromTimecode(timecodeFromFrames(f, rate), rate);
        if (back !== f && mismatches.length < 5) mismatches.push(`${rate.id} frame ${f} -> ${back}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('wraps at midnight', () => {
    for (const rate of FRAME_RATES) {
      expect(formatTimecode(timecodeFromFrames(framesPerDay(rate), rate), rate)).toMatch(/^00:00:00[:;]00$/);
      expect(timecodeFromFrames(framesPerDay(rate) - 1, rate).hours).toBe(23);
    }
    expect(framesPerDay(frameRate('29.97df'))).toBe(2589408);
  });

  it('parses what people type, and refuses labels that do not exist', () => {
    const df = frameRate('29.97df');
    expect(parseTimecode('14:02:11:05', frameRate('25'))).toEqual({ hours: 14, minutes: 2, seconds: 11, frames: 5 });
    expect(parseTimecode('14.02.11.05', frameRate('25'))).not.toBeNull();
    expect(parseTimecode('00:01:00;00', df)).toBeNull();
    expect(parseTimecode('00:10:00;00', df)).not.toBeNull();
    expect(parseTimecode('10:00:00:25', frameRate('25'))).toBeNull();
    expect(parseTimecode('nonsense', df)).toBeNull();
  });
});

describe('the slate clock', () => {
  it('reads the time of day at whole rates', () => {
    const rate = frameRate('25');
    // 12:34:56.48 on the wall clock, 1000 s on the monotonic clock.
    const tod = 12 * 3600 + 34 * 60 + 56.48;
    const jam = jamToTimeOfDay(tod, 1000, rate);
    expect(formatTimecode(timecodeFromFrames(framesAt(jam, 1000, rate), rate), rate)).toBe('12:34:56:12');
    expect(formatTimecode(timecodeFromFrames(framesAt(jam, 1001, rate), rate), rate)).toBe('12:34:57:12');
  });

  it('keeps drop-frame on the wall clock over an hour', () => {
    const rate = frameRate('29.97df');
    const jam = jamToTimeOfDay(0, 500, rate); // midnight
    expect(formatTimecode(timecodeFromFrames(framesAt(jam, 500 + 3600, rate), rate), rate)).toBe('01:00:00;00');
  });

  it('free-runs 23.976 from the time it was jammed', () => {
    const rate = frameRate('23.976');
    const tod = 9 * 3600 + 15 * 60 + 30.5;
    const jam = jamToTimeOfDay(tod, 10, rate);
    expect(formatTimecode(timecodeFromFrames(framesAt(jam, 10, rate), rate), rate)).toBe('09:15:30:12');
    // An hour later it has counted 86 313 frames, not 86 400 — 3.6 s behind the wall.
    const later = framesAt(jam, 10 + 3600, rate) - framesAt(jam, 10, rate);
    expect(later).toBe(Math.floor(3600 * rate.actual));
  });
});

describe('LTC frames', () => {
  it('lays out the sync word and keeps an even number of ones', () => {
    for (const id of ['24', '25', '29.97df', '30']) {
      const rate = frameRate(id);
      for (let f = 0; f < 2000; f += 37) {
        const bits = encodeFrameBits({ tc: timecodeFromFrames(f, rate), dropFrame: rate.dropFrame }, rate);
        expect(bits).toHaveLength(80);
        expect(bits.reduce((a, b) => a + b, 0) % 2).toBe(0);
        const sync = bits.slice(64).reduce((acc, b) => (acc << 1) | b, 0);
        expect(sync).toBe(SYNC_WORD);
        expect(decodeFrameBits(bits)).toEqual({ tc: timecodeFromFrames(f, rate), dropFrame: rate.dropFrame });
      }
    }
  });

  it('puts the polarity bit where 25 fps expects it', () => {
    const rate = frameRate('25');
    // The sync word carries 13 ones; 00:00:00:03 adds two more, so the
    // polarity bit must make up the sixteenth.
    const bits = encodeFrameBits({ tc: { hours: 0, minutes: 0, seconds: 0, frames: 3 }, dropFrame: false }, rate);
    expect(bits[59]).toBe(1);
    expect(bits[27]).toBe(0);
  });
});

/** Encode `seconds` of LTC from `startFrame`, optionally mangling the audio. */
function render(id: string, sampleRate: number, startFrame: number, seconds: number, mangle?: (x: number, i: number) => number) {
  const rate = frameRate(id);
  let next = startFrame;
  const starts: number[] = [];
  let sample = 0;
  const encoder = new LTCEncoder(sampleRate, rate, () => {
    starts.push(sample);
    const frame = { tc: timecodeFromFrames(next, rate), dropFrame: rate.dropFrame };
    next += 1;
    return frame;
  });
  const out = new Float32Array(Math.round(sampleRate * seconds));
  for (let i = 0; i < out.length; i++) {
    sample = i;
    const x = encoder.nextSample();
    out[i] = mangle ? mangle(x, i) : x;
  }
  return { out, starts, rate };
}

function decode(samples: Float32Array, sampleRate: number) {
  const frames: DecodedLTC[] = [];
  const decoder = new LTCDecoder(sampleRate, (f) => frames.push(f));
  // Feed in uneven chunks, the way audio arrives.
  for (let i = 0; i < samples.length; i += 937) decoder.process(samples.subarray(i, i + 937));
  return frames;
}

// A cheap deterministic noise source.
function noise(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

describe('LTC encode → decode', () => {
  for (const id of ['23.976', '24', '25', '29.97df', '30']) {
    for (const sampleRate of [44100, 48000]) {
      it(`reads back ${id} fps at ${sampleRate / 1000} kHz`, () => {
        const start = 14 * 3600 * 25; // somewhere mid-afternoon
        const { out, starts, rate } = render(id, sampleRate, start, 3);
        const frames = decode(out, sampleRate);
        expect(frames.length).toBeGreaterThan(Math.floor(rate.actual * 3) - 4);

        // Every decoded frame is the next one in order.
        const first = framesFromTimecode(frames[0].tc, rate);
        frames.forEach((f, i) => {
          expect(framesFromTimecode(f.tc, rate)).toBe(first + i);
          expect(f.dropFrame).toBe(rate.dropFrame);
        });

        // And says, within two samples, where the next frame starts.
        for (const f of frames.slice(0, 20)) {
          const index = framesFromTimecode(f.tc, rate) - start + 1;
          expect(Math.abs(f.nextFrameStartSample - starts[index])).toBeLessThanOrEqual(2);
        }

        // The measured bit period gives the real frame rate.
        const measured = sampleRate / (frames[frames.length - 1].samplesPerBit * 80);
        expect(measured).toBeGreaterThan(rate.actual * 0.97);
        expect(measured).toBeLessThan(rate.actual * 1.03);
      });
    }
  }

  it('does not care about polarity, level or a little noise', () => {
    const n = noise(7);
    const { out, rate } = render('25', 48000, 1000, 2, (x) => -0.04 * x + 0.004 * n());
    const frames = decode(out, 48000);
    expect(frames.length).toBeGreaterThan(45);
    const first = framesFromTimecode(frames[0].tc, rate);
    frames.forEach((f, i) => expect(framesFromTimecode(f.tc, rate)).toBe(first + i));
  });

  it('recovers after a dropout', () => {
    const { out, rate } = render('24', 48000, 0, 3, (x, i) => (i > 40000 && i < 52000 ? 0 : x));
    const frames = decode(out, 48000);
    const after = frames.filter((f) => f.nextFrameStartSample > 52000);
    expect(after.length).toBeGreaterThan(20);
    const first = framesFromTimecode(after[0].tc, rate);
    after.forEach((f, i) => expect(framesFromTimecode(f.tc, rate)).toBe(first + i));
  });

  it('picks up a re-jam part-way through a frame', () => {
    // What the slate does when it is re-jammed with timecode out running:
    // silence until the new frame grid, then a fresh frame from the new label.
    const sampleRate = 48000;
    const rate = frameRate('25');
    let next = 1000;
    const encoder = new LTCEncoder(sampleRate, rate, () => {
      const frame = { tc: timecodeFromFrames(next, rate), dropFrame: false };
      next += 1;
      return frame;
    });
    const out = new Float32Array(sampleRate * 3);
    const jamAt = Math.round(sampleRate * 1.3) + 517; // not on a frame boundary
    const gap = 700;
    for (let i = 0; i < out.length; i++) {
      if (i === jamAt) {
        next = 50000;
        encoder.reset();
      }
      out[i] = i >= jamAt && i < jamAt + gap ? 0 : encoder.nextSample();
    }
    const frames = decode(out, sampleRate);
    const before = frames.filter((f) => f.nextFrameStartSample <= jamAt);
    const after = frames.filter((f) => f.nextFrameStartSample > jamAt + gap);
    expect(before.length).toBeGreaterThan(25);
    expect(after.length).toBeGreaterThan(35);
    const first = framesFromTimecode(after[0].tc, rate);
    expect(first).toBeGreaterThanOrEqual(50000);
    expect(first).toBeLessThanOrEqual(50002);
    after.forEach((f, i) => expect(framesFromTimecode(f.tc, rate)).toBe(first + i));
  });

  it('finds nothing in silence or noise', () => {
    const n = noise(3);
    const silence = new Float32Array(48000);
    const hiss = Float32Array.from({ length: 48000 }, () => 0.3 * n());
    expect(decode(silence, 48000)).toHaveLength(0);
    expect(decode(hiss, 48000)).toHaveLength(0);
  });
});
