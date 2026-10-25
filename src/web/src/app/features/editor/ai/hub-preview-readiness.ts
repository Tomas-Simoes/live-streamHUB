/** Preview preparation must not depend on unrelated page assets or foreground tabs. */
export const HUB_PREVIEW_LIMITS = Object.freeze({ paintMs: 100, fontsMs: 2_000, imagesMs: 5_000 });

export type PreviewReadiness = { fonts: 'ready' | 'timeout' | 'error'; images: 'ready' | 'timeout'; pendingImages: number; failedImages: number };
export class PreviewResourceError extends Error {
  constructor(message: string, readonly readiness: PreviewReadiness) { super(message); }
}

/** Hidden/background tabs can suspend animation frames. A timer still permits DOM layout. */
export function waitForPreviewPaint(): Promise<void> {
  return new Promise(resolve => {
    let frame: number | undefined;
    const done = () => {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      resolve();
    };
    const timer = setTimeout(done, HUB_PREVIEW_LIMITS.paintMs);
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(() => { frame = requestAnimationFrame(done); });
  });
}

async function settleWithin(operation: Promise<unknown>, timeout: number): Promise<'ready' | 'timeout' | 'error'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation.then(() => 'ready' as const, () => 'error' as const), new Promise<'timeout'>(resolve => {
      timer = setTimeout(() => resolve('timeout'), timeout);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function preparePreviewAssets(root: HTMLElement): Promise<PreviewReadiness> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  const cleanups: (() => void)[] = [];
  // Offscreen review images must load even if their source component uses lazy loading.
  const imageLoads = images.map(image => {
    image.loading = 'eager';
    if (image.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      const done = () => resolve();
      image.addEventListener('load', done); image.addEventListener('error', done);
      cleanups.push(() => { image.removeEventListener('load', done); image.removeEventListener('error', done); });
      if (image.complete) resolve();
    });
  });
  // document.fonts.ready includes unrelated downloads elsewhere in the editor.
  // Check/load only fonts actually used by text in this preview.
  const fonts = document.fonts;
  const usedFonts = new Set(Array.from(root.querySelectorAll<HTMLElement>('*'))
    .filter(node => !node.childElementCount && node.textContent?.trim())
    .map(node => { const style = getComputedStyle(node); return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`; }));
  const fontLoads = fonts ? Array.from(usedFonts).filter(font => !fonts.check(font)).map(font => fonts.load(font)) : [];
  try {
    const [fontStatus, imageStatus] = await Promise.all([
      settleWithin(Promise.all(fontLoads), HUB_PREVIEW_LIMITS.fontsMs),
      settleWithin(Promise.all(imageLoads), HUB_PREVIEW_LIMITS.imagesMs),
    ]);
    const readiness: PreviewReadiness = { fonts: fontStatus, images: imageStatus === 'timeout' ? 'timeout' : 'ready',
      pendingImages: images.filter(image => !image.complete).length,
      failedImages: images.filter(image => image.complete && !image.naturalWidth).length };
    if (fontStatus !== 'ready') throw new PreviewResourceError('The preview fonts could not finish loading. Try again once the fonts are available.', readiness);
    if (readiness.pendingImages || readiness.failedImages) throw new PreviewResourceError('The preview images could not finish loading. Check the connection and try again.', readiness);
    return readiness;
  } finally { cleanups.forEach(cleanup => cleanup()); }
}
