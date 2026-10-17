/**
 * Reference implementation of the slate's SMPTE timecode maths.
 *
 * The iPhone/iPad slate (`mobile/ScreenplayStudio/Features/Slate/Timecode.swift`)
 * is a line-for-line port of this file. It lives in TypeScript so the maths can
 * be tested in CI (`tests/slate-timecode.test.ts`) — there's no Swift toolchain
 * there — and any change to one should be made to both.
 */

export interface FrameRate {
  id: string;
  label: string;
  /** Frames counted per timecode second (24, 25, 30, 50, 60…). */
  nominal: number;
  /** Real frames per second (24000/1001 for 23.976…). */
  actual: number;
  /** Drop-frame counting (29.97 DF, 59.94 DF). */
  dropFrame: boolean;
}

export const FRAME_RATES: FrameRate[] = [
  { id: '23.976', label: '23.976', nominal: 24, actual: 24000 / 1001, dropFrame: false },
  { id: '24', label: '24', nominal: 24, actual: 24, dropFrame: false },
  { id: '25', label: '25', nominal: 25, actual: 25, dropFrame: false },
  { id: '29.97df', label: '29.97 DF', nominal: 30, actual: 30000 / 1001, dropFrame: true },
  { id: '29.97', label: '29.97 ND', nominal: 30, actual: 30000 / 1001, dropFrame: false },
  { id: '30', label: '30', nominal: 30, actual: 30, dropFrame: false },
  { id: '48', label: '48', nominal: 48, actual: 48, dropFrame: false },
  { id: '50', label: '50', nominal: 50, actual: 50, dropFrame: false },
  { id: '59.94df', label: '59.94 DF', nominal: 60, actual: 60000 / 1001, dropFrame: true },
  { id: '59.94', label: '59.94 ND', nominal: 60, actual: 60000 / 1001, dropFrame: false },
  { id: '60', label: '60', nominal: 60, actual: 60, dropFrame: false },
];

export function frameRate(id: string): FrameRate {
  const rate = FRAME_RATES.find((r) => r.id === id);
  if (!rate) throw new Error(`Unknown frame rate ${id}`);
  return rate;
}

export interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
}

/** Frames dropped at the start of each minute (except every tenth). */
function droppedPerMinute(rate: FrameRate): number {
  return rate.dropFrame ? Math.round(rate.nominal / 15) : 0; // 2 at 29.97, 4 at 59.94
}

/** Frame labels in one 24-hour day. */
export function framesPerDay(rate: FrameRate): number {
  const all = rate.nominal * 86400;
  if (!rate.dropFrame) return all;
  // 1440 minutes, of which 144 (every tenth) keep their frames.
  return all - droppedPerMinute(rate) * (1440 - 144);
}

function wrap(frames: number, rate: FrameRate): number {
  const day = framesPerDay(rate);
  return ((frames % day) + day) % day;
}

/** A running frame count → the label on the slate. */
export function timecodeFromFrames(count: number, rate: FrameRate): Timecode {
  let frames = wrap(Math.floor(count), rate);
  const n = rate.nominal;
  if (rate.dropFrame) {
    const drop = droppedPerMinute(rate);
    const per10Min = n * 600 - drop * 9;
    const perMin = n * 60 - drop;
    const tens = Math.floor(frames / per10Min);
    const rest = frames % per10Min;
    frames += drop * 9 * tens;
    if (rest > drop) frames += drop * Math.floor((rest - drop) / perMin);
  }
  return {
    hours: Math.floor(frames / (n * 3600)) % 24,
    minutes: Math.floor(frames / (n * 60)) % 60,
    seconds: Math.floor(frames / n) % 60,
    frames: frames % n,
  };
}

/** The label on the slate → a running frame count. */
export function framesFromTimecode(tc: Timecode, rate: FrameRate): number {
  const n = rate.nominal;
  const labelled = ((tc.hours * 60 + tc.minutes) * 60 + tc.seconds) * n + tc.frames;
  if (!rate.dropFrame) return labelled;
  const totalMinutes = tc.hours * 60 + tc.minutes;
  return labelled - droppedPerMinute(rate) * (totalMinutes - Math.floor(totalMinutes / 10));
}

export function formatTimecode(tc: Timecode, rate: FrameRate): string {
  const two = (v: number) => String(v).padStart(2, '0');
  // Drop-frame is written with a semicolon before the frames.
  return `${two(tc.hours)}:${two(tc.minutes)}:${two(tc.seconds)}${rate.dropFrame ? ';' : ':'}${two(tc.frames)}`;
}

export function parseTimecode(text: string, rate: FrameRate): Timecode | null {
  const match = text.trim().match(/^(\d{1,2})[:.;](\d{1,2})[:.;](\d{1,2})[:.;](\d{1,2})$/);
  if (!match) return null;
  const [h, m, s, f] = match.slice(1).map(Number);
  if (h > 23 || m > 59 || s > 59 || f >= rate.nominal) return null;
  // In drop-frame, frames 00 and 01 don't exist at most minute starts.
  if (rate.dropFrame && s === 0 && f < droppedPerMinute(rate) && m % 10 !== 0) return null;
  return { hours: h, minutes: m, seconds: s, frames: f };
}

/**
 * The slate's clock: a frame count anchored at a moment, advancing at the real
 * frame rate. Jamming (from time of day, a typed value or incoming LTC) moves
 * the anchor; everything else is arithmetic on a monotonic clock.
 */
export interface Jam {
  /** Frame count at `anchorSeconds`. */
  anchorFrames: number;
  /** Monotonic clock reading the anchor refers to. */
  anchorSeconds: number;
}

export function framesAt(jam: Jam, nowSeconds: number, rate: FrameRate): number {
  // A hair of tolerance so a time exactly on a frame boundary lands on it
  // rather than the frame before, whatever the floating-point rounding.
  return wrap(jam.anchorFrames + Math.floor((nowSeconds - jam.anchorSeconds) * rate.actual + 1e-6), rate);
}

/**
 * Jam to the time of day. `secondsSinceMidnight` is wall-clock time at
 * `nowSeconds` on the monotonic clock.
 *
 * Integer and drop-frame rates track the clock exactly, so the anchor is
 * midnight. Fractional non-drop rates (23.976, 29.97 ND) can't — their
 * timecode runs 0.1% slow — so, like a hardware generator, they're set to the
 * time of day now and free-run from here.
 */
export function jamToTimeOfDay(secondsSinceMidnight: number, nowSeconds: number, rate: FrameRate): Jam {
  const exact = Number.isInteger(rate.actual) || rate.dropFrame;
  if (exact) {
    return { anchorFrames: 0, anchorSeconds: nowSeconds - secondsSinceMidnight };
  }
  const whole = Math.floor(secondsSinceMidnight);
  const frames = whole * rate.nominal + Math.floor((secondsSinceMidnight - whole) * rate.nominal);
  return { anchorFrames: frames, anchorSeconds: nowSeconds };
}
