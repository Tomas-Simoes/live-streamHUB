import type { Hub } from '../../../shared/types/hub.types';
import type { IntentCheck } from './hub-intent';
import { matchesHubTarget } from './hub-targets';
import { gradientColorDelta, matchesRenderedHue } from './hub-quality';

/** Measurement primitives, not a menu of permitted designs. Any other goal remains visual. */
export type HubRequirement = { quote: string; target: string; selector: string;
  measure: 'visual' | 'gradient' | 'widthFraction' | 'largerThan' | 'above' | 'below' | 'color';
  reference: string; value: string };
const text = { type: 'string' };
export const REQUIREMENTS_SCHEMA = { type: 'array', maxItems: 16, items: { type: 'object', additionalProperties: false,
  required: ['quote', 'target', 'selector', 'measure', 'reference', 'value'], properties: {
    quote: { ...text, minLength: 1 }, target: text, selector: text,
    measure: { enum: ['visual', 'gradient', 'widthFraction', 'largerThan', 'above', 'below', 'color'] }, reference: text, value: text } } };

export function requestClauses(instruction: string): string[] {
  return instruction.split(/\n+|(?<=[.!?])\s+/u).map(text => text.trim()).filter(Boolean);
}
export const normalizedQuote = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function uncoveredClauses(instruction: string, requirements: HubRequirement[]) {
  return requestClauses(instruction).filter(clause => !requirements.some(requirement => normalizedQuote(requirement.quote).includes(normalizedQuote(clause))));
}

export type RequirementSample = { width: number; height: number; top: number; bottom: number;
  fill: string; color: string; gradientDelta: number; reference?: { width: number; height: number; top: number; bottom: number } };
export function evaluateRequirement(requirement: HubRequirement, samples: RequirementSample[], viewportWidth: number): IntentCheck {
  const result = (status: IntentCheck['status'], detail: string): IntentCheck => ({ request: requirement.quote, status, detail });
  if (requirement.measure === 'visual') return result('unverified', 'Requires visual review; the request remains part of the design contract.');
  if (!samples.length) return result('unverified', `Could not measure ${requirement.target} ${requirement.selector}. Do not infer success.`);
  let passed: boolean, detail: string;
  switch (requirement.measure) {
    case 'gradient':
      passed = samples.every(sample => /gradient\(/.test(sample.fill) && sample.gradientDelta >= .06);
      // Presence cannot certify the direction, palette or quality of a gradient.
      return result(passed ? 'limited' : 'failed', passed ? 'Visible gradient measured. Direction, palette and visual finish still need review.' : 'The requested surfaces have no measurable gradient.');
    case 'widthFraction': {
      const fraction = Number(requirement.value);
      if (!(fraction > 0 && fraction <= 1)) return result('unverified', 'Invalid width fraction in the interpreted check.');
      passed = samples.every(sample => Math.abs(sample.width / viewportWidth - fraction) <= .05);
      detail = `Width ${(samples[0].width / viewportWidth * 100).toFixed(1)}% of canvas; requested approximately ${(fraction * 100).toFixed(1)}%.`;
      break;
    }
    case 'largerThan':
      if (samples.some(sample => !sample.reference)) return result('unverified', 'Comparison element was not available in the same player row.');
      passed = samples.every(sample => Math.min(sample.width, sample.height) > Math.min(sample.reference!.width, sample.reference!.height) * 1.05);
      detail = `Visible sides: ${Math.min(...samples.map(sample => Math.min(sample.width, sample.height))).toFixed(1)}px minimum vs ${Math.max(...samples.map(sample => Math.min(sample.reference!.width, sample.reference!.height))).toFixed(1)}px maximum comparison. Each row must be at least 5% larger.`;
      break;
    case 'above': case 'below':
      if (samples.some(sample => !sample.reference)) return result('unverified', 'Comparison element was not available.');
      passed = samples.every(sample => requirement.measure === 'above' ? sample.bottom <= sample.reference!.top + 1 : sample.top >= sample.reference!.bottom - 1);
      detail = `Measured ${requirement.selector} ${requirement.measure} ${requirement.reference} within each component/row. First vertical bounds: ${samples[0].top.toFixed(1)}–${samples[0].bottom.toFixed(1)}px vs ${samples[0].reference!.top.toFixed(1)}–${samples[0].reference!.bottom.toFixed(1)}px.`;
      break;
    case 'color': {
      if (!['text', 'fill'].includes(requirement.reference)) return result('unverified', 'The interpreted colour check did not identify text or fill. A frame/border colour cannot be checked as a background.');
      if (!/^#[a-f\d]{6}$/i.test(requirement.value)) return result('unverified', 'Colour measurement needs an interpreted RGB reference; visual palette judgement remains advisory.');
      if (requirement.reference !== 'text' && samples.some(sample => /gradient\(/.test(sample.fill))) return result('unverified', 'Gradient palette needs visual review; a single colour stop cannot establish the whole treatment.');
      // This checks a hue family, not an exact artistic interpretation of a name.
      passed = samples.every(sample => matchesRenderedHue(requirement.reference === 'text' ? sample.color : sample.fill, requirement.value));
      return result(passed ? 'limited' : 'failed', passed ? 'Measured hue agrees with the interpreted colour. Brightness, saturation and overall identity still need review.' : `Rendered colour differs from the interpreted hue ${requirement.value}.`);
    }
  }
  return result(passed ? 'verified' : 'failed', detail!);
}

function visibleBox(node: HTMLElement, root: HTMLElement) {
  const image = node.matches('img') ? node : node.querySelector<HTMLElement>('img');
  const rect = (image ?? node).getBoundingClientRect();
  let left = rect.left, right = rect.right, top = rect.top, bottom = rect.bottom;
  // The review stage is deliberately offscreen. Clip inside this preview,
  // never against dialog/page ancestors that do not belong to its canvas.
  if (image) for (let parent = image.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
    if (/hidden|clip|auto|scroll/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
    if (/hidden|clip|auto|scroll/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
    if (parent === root) break;
  }
  return { width: Math.max(0, right - left), height: Math.max(0, bottom - top), top, bottom };
}

export function measureRequirements(root: HTMLElement, hub: Hub, requirements: HubRequirement[], sourceIds: ReadonlyMap<string, string>) {
  return requirements.map(requirement => {
    if (requirement.measure === 'visual') return { requirement, samples: [], check: evaluateRequirement(requirement, [], root.getBoundingClientRect().width) };
    const frames = Array.from(root.querySelectorAll<HTMLElement>('[data-layer-id]')).filter(frame => {
      const id = sourceIds.get(frame.dataset['layerId']!);
      const layer = hub.layers.find(layer => layer.id === id);
      return layer && matchesHubTarget(layer, requirement.target);
    });
    const samples: RequirementSample[] = [];
    try {
      for (const frame of frames) {
        const sourceId = sourceIds.get(frame.dataset['layerId']!);
        const nodes = requirement.selector === '&' || requirement.selector === `#${sourceId}` ? [frame] : Array.from(frame.querySelectorAll<HTMLElement>(requirement.selector));
        for (const node of nodes) {
          const style = getComputedStyle(node), fill = style.backgroundImage === 'none' ? style.backgroundColor : style.backgroundImage;
          const container = node.closest<HTMLElement>('[data-component-part="row"]') ?? frame;
          const comparisons = ['above', 'below', 'largerThan'].includes(requirement.measure)
            ? Array.from(container.querySelectorAll<HTMLElement>(requirement.reference)).map(node => visibleBox(node, root)) : [];
          const comparison = requirement.measure === 'largerThan'
            ? comparisons.sort((a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height))[0] : comparisons[0];
          samples.push({ ...visibleBox(node, root), fill, color: style.color, gradientDelta: gradientColorDelta(fill),
            ...(comparison ? { reference: comparison } : {}) });
        }
      }
    } catch { samples.length = 0; /* Never approve partial measurements after an invalid selector. */ }
    return { requirement, samples, check: evaluateRequirement(requirement, samples, root.getBoundingClientRect().width) };
  });
}
