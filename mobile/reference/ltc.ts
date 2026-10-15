/**
 * Reference implementation of SMPTE 12M linear timecode (LTC) — the audio
 * signal timecode travels as between recorders, cameras and slates.
 *
 * `mobile/ScreenplayStudio/Features/Slate/LTC.swift` is a line-for-line port.
 * Tests: `tests/slate-ltc.test.ts`.
 *
 * An LTC frame is 80 bits, sent least-significant first, once per video frame,
 * biphase-mark coded: the level flips at the start of every bit, and a 1 bit
 * flips again half-way through. So the decoder only has to measure the time
 * between level changes — about one bit period means 0, two half periods mean 1
 * — which makes it independent of polarity and of the signal's level.
 */

import type { FrameRate, Timecode } from './timecode';

export const LTC_BITS = 80;
/** Bits 64–79 as sent: 0011 1111 1111 1101. */
export const SYNC_WORD = 0x3ffd;

export interface LTCFrame {
  tc: Timecode;
  dropFrame: boolean;
}

/** Bit position of the biphase-mark polarity correction bit. */
function polarityBit(rate: FrameRate): number {
  return rate.nominal === 25 || rate.nominal === 50 ? 59 : 27;
}

function setBits(bits: number[], start: number, count: number, value: number) {
  for (let i = 0; i < count; i++) bits[start + i] = (value >> i) & 1;
}

function readBits(bits: number[], start: number, count: number): number {
  let value = 0;
  for (let i = 0; i < count; i++) value |= bits[start + i] << i;
  return value;
}

/** The 80 bits of one frame, in transmission order. */
export function encodeFrameBits(frame: LTCFrame, rate: FrameRate): number[] {
  const bits = new Array<number>(LTC_BITS).fill(0);
  const { hours, minutes, seconds, frames } = frame.tc;
  // LTC carries 30 frame labels at most; at 48/50/60 fps every frame label is
  // sent as its pair (frame ÷ 2), the convention for high-frame-rate LTC.
  const ltcFrames = rate.nominal > 30 ? Math.floor(frames / 2) : frames;
  setBits(bits, 0, 4, ltcFrames % 10);
  setBits(bits, 8, 2, Math.floor(ltcFrames / 10));
  bits[10] = frame.dropFrame ? 1 : 0;
  setBits(bits, 16, 4, seconds % 10);
  setBits(bits, 24, 3, Math.floor(seconds / 10));
  setBits(bits, 32, 4, minutes % 10);
  setBits(bits, 40, 3, Math.floor(minutes / 10));
  setBits(bits, 48, 4, hours % 10);
  setBits(bits, 56, 2, Math.floor(hours / 10));
  // Sync word, bits 64–79.
  for (let i = 0; i < 16; i++) bits[64 + i] = (SYNC_WORD >> (15 - i)) & 1;
  // An even number of ones per frame, so every frame starts on the same edge.
  const parity = bits.reduce((sum, b) => sum + b, 0) % 2;
  bits[polarityBit(rate)] = parity;
  return bits;
}

export function decodeFrameBits(bits: number[]): LTCFrame | null {
  for (let i = 0; i < 16; i++) {
    if (bits[64 + i] !== ((SYNC_WORD >> (15 - i)) & 1)) return null;
  }
  const frames = readBits(bits, 0, 4) + 10 * readBits(bits, 8, 2);
  const seconds = readBits(bits, 16, 4) + 10 * readBits(bits, 24, 3);
  const minutes = readBits(bits, 32, 4) + 10 * readBits(bits, 40, 3);
  const hours = readBits(bits, 48, 4) + 10 * readBits(bits, 56, 2);
  if (frames > 29 || seconds > 59 || minutes > 59 || hours > 23) return null;
  return { tc: { hours, minutes, seconds, frames }, dropFrame: bits[10] === 1 };
}

/**
 * Generates LTC sample by sample. The caller supplies each frame's timecode
 * (so it can follow the slate's clock) through `nextFrame`.
 */
export class LTCEncoder {
  readonly samplesPerBit: number;
  private bits: number[] = [];
  private bitIndex = LTC_BITS; // forces a new frame on the first sample
  private phase = 0;
  private midFlipped = false;
  private level = 1;
  private output = 0;
  private readonly slew: number;

  constructor(
    readonly sampleRate: number,
    readonly rate: FrameRate,
    private readonly nextFrame: () => LTCFrame,
    readonly amplitude = 0.5,
  ) {
    // LTC frames run at the real rate; at 48/50/60 fps one LTC frame spans two
    // video frames.
    const ltcFrameRate = rate.nominal > 30 ? rate.actual / 2 : rate.actual;
    this.samplesPerBit = sampleRate / (ltcFrameRate * LTC_BITS);
    // SMPTE asks for a 25–50 µs rise time; a hard square wave is harsh on
    // camera inputs, so edges ramp over roughly 40 µs.
    this.slew = (2 * amplitude) / Math.max(1, 40e-6 * sampleRate);
    this.phase = this.samplesPerBit; // start exactly on a bit boundary
  }

  /** Samples until the next frame starts, for aligning to a clock. */
  get samplesUntilFrame(): number {
    return (LTC_BITS - this.bitIndex - 1) * this.samplesPerBit + (this.samplesPerBit - this.phase);
  }

  nextSample(): number {
    if (this.phase >= this.samplesPerBit) {
      this.phase -= this.samplesPerBit;
      this.bitIndex += 1;
      if (this.bitIndex >= LTC_BITS) {
        this.bitIndex = 0;
        this.bits = encodeFrameBits(this.nextFrame(), this.rate);
      }
      this.level = -this.level; // every bit starts with a transition
      this.midFlipped = false;
    } else if (!this.midFlipped && this.bits[this.bitIndex] === 1 && this.phase >= this.samplesPerBit / 2) {
      this.level = -this.level; // and a 1 has another half-way through
      this.midFlipped = true;
    }
    this.phase += 1;
    const target = this.level * this.amplitude;
    const delta = Math.max(-this.slew, Math.min(this.slew, target - this.output));
    this.output += delta;
    return this.output;
  }
}

export interface DecodedLTC extends LTCFrame {
  /**
   * Sample index (in the decoder's running count) at which the frame *after*
   * the decoded one begins — the edge that completed the sync word.
   */
  nextFrameStartSample: number;
  /** Measured samples per bit, for detecting the frame rate. */
  samplesPerBit: number;
}

/**
 * Decodes LTC from audio. Feed it samples in order; it calls `onFrame` for
 * every complete frame. Copes with either polarity, any level above the noise,
 * and any rate from 23.976 to 30 frames per second.
 */
export class LTCDecoder {
  private sampleIndex = 0;
  private envelope = 0;
  private high = false;
  private lastEdge = -1;
  private bitPeriod: number;
  private readonly minBit: number;
  private readonly maxBit: number;
  private halfPending = false;
  /** The last 80 bits, as a ring; `head` is where the next one goes. */
  private ring = new Array<number>(LTC_BITS).fill(0);
  private head = 0;
  /** The last 16 bits, newest in bit 0 — compared against the sync word. */
  private recent16 = 0;
  private bitsSinceReset = 0;

  constructor(readonly sampleRate: number, private readonly onFrame: (frame: DecodedLTC) => void) {
    // 23.976–30 fps spans about 20–25 samples per bit at 48 kHz.
    this.minBit = sampleRate / (31 * LTC_BITS);
    this.maxBit = sampleRate / (23 * LTC_BITS);
    this.bitPeriod = (this.minBit + this.maxBit) / 2;
  }

  process(samples: ArrayLike<number>) {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const magnitude = Math.abs(x);
      // Peak follower: instant attack, slow release (~0.1 s), so the threshold
      // tracks the signal's level.
      this.envelope = magnitude > this.envelope ? magnitude : this.envelope * (1 - 10 / this.sampleRate);
      const threshold = this.envelope * 0.3;
      if (this.envelope > 0.002) {
        if (!this.high && x > threshold) {
          this.high = true;
          this.edge();
        } else if (this.high && x < -threshold) {
          this.high = false;
          this.edge();
        }
      }
      this.sampleIndex += 1;
    }
  }

  private edge() {
    const at = this.sampleIndex;
    if (this.lastEdge < 0) {
      this.lastEdge = at;
      return;
    }
    const interval = at - this.lastEdge;
    this.lastEdge = at;

    if (interval > this.maxBit * 1.4 || interval < this.minBit * 0.3) {
      // Silence, a dropout or a glitch: start over.
      this.reset();
      return;
    }

    if (interval < this.bitPeriod * 0.75) {
      // Half a bit. Two in a row are a 1.
      if (this.halfPending) {
        this.halfPending = false;
        this.pushBit(1, at);
      } else {
        this.halfPending = true;
      }
      this.adapt(interval * 2);
    } else {
      if (this.halfPending) {
        // A half without its partner: we were out of step. Drop the bit and
        // resynchronise on this edge.
        this.halfPending = false;
        this.bitsSinceReset = 0;
      }
      this.pushBit(0, at);
      this.adapt(interval);
    }
  }

  private adapt(period: number) {
    if (period >= this.minBit * 0.9 && period <= this.maxBit * 1.1) {
      this.bitPeriod += (period - this.bitPeriod) * 0.05;
    }
  }

  private reset() {
    this.halfPending = false;
    this.bitsSinceReset = 0;
  }

  private pushBit(bit: number, at: number) {
    this.ring[this.head] = bit;
    this.head = (this.head + 1) % LTC_BITS;
    this.recent16 = ((this.recent16 << 1) | bit) & 0xffff;
    this.bitsSinceReset += 1;
    if (this.bitsSinceReset < LTC_BITS) return;
    if (this.recent16 !== SYNC_WORD) return;

    // The 80 most recent bits, oldest (frame bit 0) first. After the write,
    // `head` points at the oldest.
    const bits = new Array<number>(LTC_BITS);
    for (let k = 0; k < LTC_BITS; k++) bits[k] = this.ring[(this.head + k) % LTC_BITS];
    const frame = decodeFrameBits(bits);
    if (!frame) return;
    this.onFrame({ ...frame, nextFrameStartSample: at, samplesPerBit: this.bitPeriod });
  }
}
