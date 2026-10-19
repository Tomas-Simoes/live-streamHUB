import { RenderedHub, measureRenderedHub } from './hub-quality';

/** One small, local raster only when a vision model is selected. */
export async function inspectHubPreview(root: HTMLElement, withImage: boolean): Promise<RenderedHub> {
  const shell = root.closest<HTMLElement>('.hub-preview-shell');
  if (shell) {
    Object.assign(shell.style, { width: '1280px', height: '720px', border: '0', borderRadius: '0' });
    Object.assign(root.style, { width: '1920px', height: '1080px', transform: 'scale(0.6666666667)', border: '0', borderRadius: '0' });
  } else Object.assign(root.style, { width: '1280px', height: '720px', border: '0', borderRadius: '0' });
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await document.fonts.ready;
  await Promise.allSettled(Array.from(root.querySelectorAll<HTMLImageElement>('img')).map(image => image.decode()));
  const measurements = measureRenderedHub(root, withImage);
  if (!withImage) return { measurements };
  const { toPng } = await import('html-to-image');
  const snapshot = await toPng(shell ?? root, { pixelRatio: 1, canvasWidth: 1280, canvasHeight: 720, skipFonts: true,
    style: { border: '0', borderRadius: '0' } });
  const bitmap = new Image(); bitmap.src = snapshot; await bitmap.decode();
  // A full gameplay screenshot makes the small overlay hard for a local VLM to
  // inspect. One contact sheet preserves context and adds actual-pixel close-ups.
  const sheet = document.createElement('canvas'); sheet.width = 672; sheet.height = 512;
  const context = sheet.getContext('2d');
  if (!context) throw new Error('Image review needs a canvas context.');
  context.fillStyle = '#0b1017'; context.fillRect(0, 0, 672, 512);
  context.font = '11px Arial'; context.fillStyle = '#ffffff';
  context.fillText('Full layout', 8, 12);
  context.drawImage(bitmap, 136, 16, 400, 225);
  const drawDetail = (selector: string, label: string, top: number, maxHeight: number) => {
    const bounds = root.getBoundingClientRect();
    const boxes = Array.from(root.querySelectorAll<HTMLElement>(selector)).map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
    if (!boxes.length) return;
    const left = Math.max(0, Math.min(...boxes.map(box => box.left)) - bounds.left);
    const upper = Math.max(0, Math.min(...boxes.map(box => box.top)) - bounds.top);
    const width = Math.min(bounds.width - left, Math.max(...boxes.map(box => box.right)) - bounds.left - left);
    const height = Math.min(bounds.height - upper, Math.max(...boxes.map(box => box.bottom)) - bounds.top - upper);
    if (width <= 0 || height <= 0) return;
    const scale = Math.min(672 / width, maxHeight / height);
    context.fillText(label, 8, top - 5);
    context.drawImage(bitmap, left, upper, width, height, (672 - width * scale) / 2, top, width * scale, height * scale);
  };
  drawDetail('.scorebug', 'Scoreboard detail', 266, 64);
  drawDetail('.player-roster,[data-layer-id*="-event-name-"]', 'Player table detail', 352, 152);
  return { measurements, image: sheet.toDataURL('image/png') };
}

/** One local image keeps Phi's single-image input contract. The candidate is
 * dominant; the smaller companion teaches craftsmanship or shows a baseline. */
export async function composeReviewComparison(candidate: string, companion: string, label: string): Promise<string> {
  if (typeof Image === 'undefined') return candidate;
  const load = async (src: string) => { const bitmap = new Image(); bitmap.src = src; await bitmap.decode(); return bitmap; };
  const [current, reference] = await Promise.all([load(candidate), load(companion)]);
  const sheet = document.createElement('canvas'); sheet.width = 1120; sheet.height = 544;
  const context = sheet.getContext('2d');
  if (!context) return candidate;
  context.fillStyle = '#0b1017'; context.fillRect(0, 0, sheet.width, sheet.height);
  context.font = '14px Arial'; context.fillStyle = '#ffffff';
  context.fillText('CANDIDATE — evaluate this hub', 8, 18);
  context.drawImage(current, 0, 28, 672, 512);
  context.fillText(label, 684, 18);
  context.drawImage(reference, 680, 28, 440, 335);
  context.font = '12px Arial';
  context.fillText('Compare hierarchy, spacing and finish.', 690, 390);
  context.fillText('Keep the user’s requested identity.', 690, 412);
  return sheet.toDataURL('image/png');
}
