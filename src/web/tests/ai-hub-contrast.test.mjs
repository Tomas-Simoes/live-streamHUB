import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
register('./typescript-loader.mjs', import.meta.url);
const { rgbContrast, compositeRgba } = await import('../src/app/features/editor/ai/hub-quality.ts');

test('RGBA luminance ignores alpha after compositing, detecting the reported invisible cyan team name', () => {
  const background = [0, 191, 255, 1];
  const foreground = compositeRgba([0, 191, 255, 1], background);
  assert.equal(rgbContrast(foreground, background), 1);
  assert.equal(rgbContrast([255, 255, 255, 1], [0, 0, 0, 1]), 21);
});

test('RGB and composited RGBA contrast agree for saturated surfaces', () => {
  for (const background of [[0, 191, 255], [255, 140, 0], [30, 30, 30]]) {
    const rgb = rgbContrast([255, 255, 255], background);
    const rgba = rgbContrast(compositeRgba([255, 255, 255, 1], [...background, 1]), [...background, 1]);
    assert(Number.isFinite(rgba)); assert.equal(rgb, rgba);
  }
  assert(rgbContrast([255, 255, 255, 1], [0, 191, 255, 1]) < 3);
});

test('translucent foreground is composited before measuring contrast', () => {
  const background = [0, 0, 0, 1];
  const faded = compositeRgba([255, 255, 255, .2], background);
  assert(rgbContrast(faded, background) < 2);
  assert(rgbContrast([255, 255, 255, 1], background) > 20);
});
