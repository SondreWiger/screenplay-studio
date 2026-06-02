# Table Read — Real-Time Speech Tracking

## Concept
A live table read mode where the page listens to actors reading the script and auto-advances line-by-line as each line is spoken. Each line gets a `fragment` record with start/end timestamps, enabling pacing analysis per line, per character, and per scene.

## Architecture

### Core Insight
Don't need full transcription — just need to detect when spoken words match each known script line. The script text is a strong prior. Partial word detection (~50% accuracy) is sufficient for greedy alignment.

### Data Model — Fragments

```
line_fragment {
  line_id        — FK to script element (line)
  actor_id       — who spoke it
  start_ms       — epoch ms when line began
  end_ms         — epoch ms when last word detected
  duration_ms    — end_ms - start_ms
  confidence     — alignment confidence (0-1)
  flub_flag      — boolean, if line was re-read or skipped
}
```

This enables:
- Per-line pacing heatmap (green = fast, red = slow)
- Per-character average delivery speed
- Scene-level pace profiles
- "This scene reads 30% slower than your average" diagnostics

## Implementation Path

### MVP — Manual Tap Tracking (no speech)
- Actors click each line as they start reading
- Auto-advance highlights + records timing
- Zero speech infrastructure, totally reliable pacing data

### V2 — Record + Post-Process
- Full audio capture during read
- Async Whisper transcription on server
- Fuzzy text alignment to match transcript → script lines
- Retroactively attach fragments

### V3 — Real-Time (streaming)
- WebSocket → server running Whisper `distil-small.en`
- Streaming word hypotheses with timestamps
- Greedy aligner matches expected words against incoming hypotheses
- Emit `line_advance { from: N, to: N+1, elapsed_ms }` when threshold met
- Live pace heatmap during the read

## Hard Edges
- Skipped lines: accept non-sequential advances, close skipped lines with near-zero duration
- Flubs/repeats: greedy match skips/repeats, mark with low confidence flag
- Ad-libs: ignore unrecognized words, keep looking for expected ones
- Browser vs server: Whisper via transformers.js had onnxruntime-node bundling issues; server-side WebSocket is the robust path

## Alignment Engine (the real work)
A pure-text problem first — match noisy transcript to known script before involving audio. ~200 lines of TypeScript/Python for a greedy prefix matcher with tolerance for insertions, deletions, and substitutions.
