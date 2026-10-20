/**
 * Browser side of the scanner: decodes photos and PDF scans into RGBA buffers
 * for scan.ts, and turns buffers back into previewable images.
 */

import type { RGBAImage } from './scan';

/** Big enough for a phone photo of a page to keep pencil detail, small enough for memory. */
const MAX_SIDE = 3200;
const PDF_DPI = 200;

export interface ScanSource {
  /** e.g. "IMG_2041.jpg" or "scan.pdf · page 2" */
  name: string;
  image: RGBAImage;
}

function canvasToRGBA(canvas: HTMLCanvasElement): RGBAImage {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width: canvas.width, height: canvas.height };
}

async function decodeImage(file: File): Promise<RGBAImage> {
  // createImageBitmap applies EXIF rotation, so phone photos come in the way they were taken.
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't read ${file.name}`)); };
      img.src = url;
    });
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ('close' in source && typeof source.close === 'function') source.close();
  return canvasToRGBA(canvas);
}

async function decodePdf(file: File): Promise<ScanSource[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: ScanSource[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(PDF_DPI / 72, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    out.push({ name: pdf.numPages > 1 ? `${file.name} · page ${n}` : file.name, image: canvasToRGBA(canvas) });
  }
  return out;
}

export async function decodeScanFiles(files: File[]): Promise<ScanSource[]> {
  const out: ScanSource[] = [];
  for (const file of files) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) out.push(...(await decodePdf(file)));
    else out.push({ name: file.name, image: await decodeImage(file) });
  }
  return out;
}

export function rgbaToDataUrl(img: RGBAImage, type = 'image/jpeg', quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return canvas.toDataURL(type, quality);
}

/** Lets the browser paint between heavy steps so the dialog stays responsive. */
export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));
