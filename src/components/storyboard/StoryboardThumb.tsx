'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { hasDrawing, makeCanvas, renderDrawing } from './engine';

// ── Render cache & scheduler ──────────────────────────────────────────
// Thumbnails are rendered once per (drawing, size) and re-used, and the work is
// spread over animation frames so a board with hundreds of shots never blocks input.

const cache = new WeakMap<object, Map<number, HTMLCanvasElement>>();
const queue: (() => void)[] = [];
let scheduled = false;

function pump() {
  scheduled = false;
  const start = performance.now();
  while (queue.length && performance.now() - start < 8) queue.shift()!();
  if (queue.length) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(pump);
}

function getRendered(drawing: object, width: number): HTMLCanvasElement {
  let bySize = cache.get(drawing);
  if (!bySize) {
    bySize = new Map();
    cache.set(drawing, bySize);
  }
  let c = bySize.get(width);
  if (!c) {
    const h = Math.round((width * 9) / 16);
    c = makeCanvas(width, h);
    renderDrawing(c.getContext('2d')!, drawing, width, h);
    bySize.set(width, c);
  }
  return c;
}

interface StoryboardThumbProps {
  drawing: any;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  /** Show an icon + label when the shot has nothing drawn. */
  emptyLabel?: string | null;
}

/** Lazily rendered storyboard frame (16:9) — image underlay plus drawn layers. */
export function StoryboardThumb({ drawing, imageUrl, alt = '', className, emptyLabel = 'No storyboard' }: StoryboardThumbProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const drawn = hasDrawing(drawing);

  useEffect(() => setImgFailed(false), [imageUrl]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !drawn) return;
    let cancelled = false;
    const job = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (cancelled || !canvas || !wrap) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Bucket sizes so neighbouring cards share cache entries.
      const target = Math.min(960, Math.max(160, Math.ceil((wrap.clientWidth * dpr) / 80) * 80));
      const src = getRendered(drawing, target);
      canvas.width = src.width;
      canvas.height = src.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0);
    };
    queue.push(job);
    schedule();
    return () => {
      cancelled = true;
    };
  }, [visible, drawn, drawing]);

  const showImage = !!imageUrl && !imgFailed;

  return (
    <div
      ref={wrapRef}
      className={cn('relative aspect-video overflow-hidden', 'bg-white', className)}
    >
      {showImage && (
        <img
          src={imageUrl!}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {drawn && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-label={alt} />}
      {!drawn && !showImage && emptyLabel !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-surface-700">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {emptyLabel && <p className="text-[11px] mt-1">{emptyLabel}</p>}
        </div>
      )}
    </div>
  );
}
