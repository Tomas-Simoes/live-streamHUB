import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
register('./typescript-loader.mjs', import.meta.url);
const { HUB_PREVIEW_LIMITS, preparePreviewAssets, waitForPreviewPaint } = await import('../src/app/features/editor/ai/hub-preview-readiness.ts');

function globalValue(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
}
class PreviewImage extends EventTarget {
  constructor(complete = true) { super(); this.complete = complete; this.naturalWidth = complete ? 64 : 0; this.loading = 'lazy'; this.listeners = 0; }
  addEventListener(...args) { this.listeners++; return super.addEventListener(...args); }
  removeEventListener(...args) { this.listeners--; return super.removeEventListener(...args); }
  decode() { throw new Error('DOM measurement must not wait for image decoding.'); }
}
function preview(t, images = [], fontOverrides = {}) {
  globalValue(t, 'document', { fonts: { ready: new Promise(() => {}), check: () => true, load: () => { throw new Error('Available font must not be fetched again.'); }, ...fontOverrides } });
  globalValue(t, 'getComputedStyle', () => ({ fontStyle: 'normal', fontWeight: '400', fontSize: '18px', fontFamily: 'Arial' }));
  return { querySelectorAll: selector => selector === 'img' ? images : [{ childElementCount: 0, textContent: 'Player' }] };
}

test('preview ignores unrelated global font loads and does not decode already loaded images', async t => {
  const image = new PreviewImage();
  const readiness = await preparePreviewAssets(preview(t, [image]));
  assert.deepEqual(readiness, { fonts: 'ready', images: 'ready', pendingImages: 0, failedImages: 0 });
  assert.equal(image.loading, 'eager');
});

test('an unavailable preview font fails after two seconds with resource diagnostics', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = preview(t, [], { check: () => false, load: () => new Promise(() => {}) });
  const pending = assert.rejects(preparePreviewAssets(root), error => error.readiness.fonts === 'timeout' && /fonts/.test(error.message));
  t.mock.timers.tick(HUB_PREVIEW_LIMITS.fontsMs); await pending;
});

test('a stalled offscreen image fails after five seconds and releases its listeners', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const image = new PreviewImage(false);
  const pending = assert.rejects(preparePreviewAssets(preview(t, [image])), error => error.readiness.pendingImages === 1 && /images/.test(error.message));
  assert.equal(image.loading, 'eager');
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(HUB_PREVIEW_LIMITS.imagesMs); await pending;
  assert.equal(image.listeners, 0);
});

test('a loading image resumes preview validation as soon as its load event arrives', async t => {
  const image = new PreviewImage(false);
  const pending = preparePreviewAssets(preview(t, [image]));
  image.complete = true; image.naturalWidth = 64; image.dispatchEvent(new Event('load'));
  assert.equal((await pending).images, 'ready'); assert.equal(image.listeners, 0);
});

test('suspended animation frames use a short timer and cancel the pending frame', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled;
  globalValue(t, 'requestAnimationFrame', () => 7);
  globalValue(t, 'cancelAnimationFrame', frame => { cancelled = frame; });
  const pending = waitForPreviewPaint();
  t.mock.timers.tick(HUB_PREVIEW_LIMITS.paintMs); await pending;
  assert.equal(cancelled, 7);
});
