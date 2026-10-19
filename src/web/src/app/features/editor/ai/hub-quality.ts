import Ajv from 'ajv';
import { LayoutIssue, parseModelJson } from './hub-plan';

export type RenderedHubReport = {
  viewport: [number, number]; fonts: { role: string; minPx: number; face: string }[];
  clipped: { role: string; text: string }[]; frames: { role: string; x: number; y: number; width: number; height: number }[];
  tableGapPx: number | null; missingImages: number;
  teamAccents?: { css: string; family: string }[];
  rosterDetails?: { portraitMin: number; itemMax: number; separator: number }[];
  teamFills?: { gradient: boolean; css: string; delta?: number }[];
  integrity?: { hidden: string[]; outside: string[]; lowContrast: { role: string; ratio: number }[]; overlapping?: string[] };
};
export type HubDesignReview = { approved: boolean; score: number; summary: string;
  issues: { target: 'scoreboard' | 'players' | 'branding' | 'overall'; problem: string; action: string }[] };
export type RenderedHub = { measurements: RenderedHubReport; image?: string };
export const HUB_REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['approved', 'score', 'summary', 'issues'], properties: {
    approved: { type: 'boolean' }, score: { type: 'number', minimum: 0, maximum: 5 }, summary: { type: 'string', maxLength: 220 },
    issues: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['target', 'problem', 'action'], properties: {
      target: { enum: ['scoreboard', 'players', 'branding', 'overall'] }, problem: { type: 'string', maxLength: 100 }, action: { type: 'string', maxLength: 140 },
    } } },
  },
};
const validate = new Ajv({ strict: false, allErrors: true }).compile(HUB_REVIEW_SCHEMA);
// Length bounds remain enforced at runtime. Omitting string-length automata from
// the decoder avoids an expensive first grammar compilation on small devices.
export const HUB_REVIEW_DECODE_SCHEMA = JSON.parse(JSON.stringify(HUB_REVIEW_SCHEMA, (key, value) => key === 'maxLength' ? undefined : value));
export function parseHubReview(raw: string): HubDesignReview {
  const result = parseModelJson(raw);
  if (!validate(result)) throw new Error('The design reviewer returned unsupported feedback.');
  return result as HubDesignReview;
}

const textRoles = [
  ['team-code', '.team-code', 12], ['team-gold', '.team-gold', 12], ['score', '.team-kills', 20], ['clock', '.game-clock', 10],
  ['names', '.roster-name', 11], ['cs', '.roster-stat', 11], ['kda', '.roster-kda', 9],
] as const;

/** Measures the actual 720p DOM; does not claim a text model has seen an image. */
export function measureRenderedHub(root: HTMLElement, includeColourFacts = false): RenderedHubReport {
  const bounds = root.getBoundingClientRect();
  const renderedScale = bounds.width / (root.offsetWidth || bounds.width || 1);
  const fonts = textRoles.flatMap(([role, selector]) => {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(node => node.getBoundingClientRect().width > 0);
    return nodes.length ? [{ role, minPx: Math.round(Math.min(...nodes.map(node => parseFloat(getComputedStyle(node).fontSize))) * renderedScale * 100) / 100,
      face: getComputedStyle(nodes[0]).fontFamily }] : [];
  });
  const clipped = textRoles.flatMap(([role, selector]) => Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(node => {
    const style = getComputedStyle(node);
    return node.clientWidth > 0 && ((/hidden|clip/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1)
      || (/hidden|clip/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1));
  }).map(node => ({ role, text: node.textContent?.trim().slice(0, 28) ?? '' }))).slice(0, 6);
  const frames = Array.from(root.querySelectorAll<HTMLElement>('.scorebug,.player-roster')).map(node => {
    const box = node.getBoundingClientRect();
    return { role: node.classList.contains('scorebug') ? 'scoreboard' : 'players', x: Math.round(box.x - bounds.x), y: Math.round(box.y - bounds.y),
      width: Math.round(box.width), height: Math.round(box.height) };
  });
  const tables = frames.filter(frame => frame.role === 'players').sort((a, b) => a.x - b.x);
  const rosterDetails = Array.from(root.querySelectorAll<HTMLElement>('.player-roster')).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map(node => {
    const widths = (selector: string) => Array.from(node.querySelectorAll<HTMLElement>(selector)).map(item => item.getBoundingClientRect().width).filter(width => width > 0);
    const portraits = widths('.roster-portrait');
    const rowStyle = getComputedStyle(node.querySelector('.roster-row') ?? node);
    const shadowOffsets = rowStyle.boxShadow.match(/-?[\d.]+px/g)?.map(parseFloat);
    return { portraitMin: portraits.length ? Math.min(...portraits) : 0, itemMax: Math.max(...widths('.item-slot'), 0),
      separator: (parseFloat(rowStyle.borderBottomWidth) || (rowStyle.boxShadow.includes('inset') ? Math.abs(shadowOffsets?.[1] ?? 0) : 0)) * renderedScale };
  });
  const teamFills = Array.from(root.querySelectorAll<HTMLElement>('.scorebug-team-blue,.scorebug-team-red')).map(node => {
    const computed = getComputedStyle(node);
    const css = computed.backgroundImage === 'none' ? computed.backgroundColor : computed.backgroundImage;
    return { css, gradient: css.includes('linear-gradient'), delta: gradientColorDelta(css) };
  });
  const integrity: NonNullable<RenderedHubReport['integrity']> = { hidden: [], outside: [], lowContrast: [], overlapping: [] };
  const functional = '.team-code,.team-gold,.team-kills,.game-clock,.roster-name,.roster-stat,.roster-kda,.roster-portrait,.item-slot';
  for (const node of Array.from(root.querySelectorAll<HTMLElement>(functional))) {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node), role = node.className.toString();
    if (box.width < 1 || box.height < 1 || style.visibility !== 'visible' || +style.opacity < .4
      || /^rgba\([^)]*,\s*0(?:\.\d+)?\s*\)/.test(style.color) && +(style.color.match(/[\d.]+/g)?.[3] ?? 1) < .4) integrity.hidden.push(role);
    const parent = node.closest<HTMLElement>('.scorebug,.player-roster');
    const frame = parent?.getBoundingClientRect();
    if (frame && (box.left < frame.left - 2 || box.right > frame.right + 2 || box.top < frame.top - 2 || box.bottom > frame.bottom + 2)) integrity.outside.push(role);
    if (!/roster-portrait|item-slot/.test(role)) {
      const foreground = cssColors(style.color)[0];
      let surface: HTMLElement | null = node;
      while (surface && surface !== root) {
        const surfaceStyle = getComputedStyle(surface);
        const backgrounds = cssColors(surfaceStyle.backgroundImage).length ? cssColors(surfaceStyle.backgroundImage) : /rgba\([^)]*,\s*0\s*\)|\/\s*0\s*\)/.test(surfaceStyle.backgroundColor) ? [] : cssColors(surfaceStyle.backgroundColor);
        if (backgrounds.length && foreground) {
          const ratio = Math.min(...backgrounds.map(background => rgbContrast(foreground, background)));
          if (ratio < 3) integrity.lowContrast.push({ role, ratio: Math.round(ratio * 100) / 100 });
          break;
        }
        surface = surface.parentElement;
      }
    }
  }
  integrity.hidden = [...new Set(integrity.hidden)]; integrity.outside = [...new Set(integrity.outside)];
  integrity.lowContrast = integrity.lowContrast.filter((item, i, all) => all.findIndex(other => other.role === item.role) === i);
  for (const row of Array.from(root.querySelectorAll<HTMLElement>('.roster-row,.scorebug-team,.scorebug-center'))) {
    const parts = Array.from(row.querySelectorAll<HTMLElement>('.roster-name,.roster-stat,.roster-kda,.roster-portrait,.roster-items,.team-code,.team-gold,.team-kills,.game-clock'));
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
      const x = parts[a].getBoundingClientRect(), y = parts[b].getBoundingClientRect();
      const overlap = Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top));
      if (overlap > 4 && overlap > .12 * Math.min(x.width * x.height, y.width * y.height)) integrity.overlapping!.push(`${parts[a].className}/${parts[b].className}`);
    }
  }
  integrity.overlapping = [...new Set(integrity.overlapping)];
  const teamAccents = includeColourFacts ? Array.from(root.querySelectorAll<HTMLElement>('.player-roster'))
    .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map(node => {
      const sample = node.querySelector<HTMLElement>('.roster-stat');
      const css = sample ? getComputedStyle(sample).color : 'unknown';
      return { css, family: renderedColorFamily(css) };
    }) : undefined;
  return { viewport: [Math.round(bounds.width), Math.round(bounds.height)], fonts, clipped, frames,
    rosterDetails, teamFills, integrity,
    tableGapPx: tables.length === 2 ? tables[1].x - tables[0].x - tables[0].width : null,
    ...(teamAccents ? { teamAccents } : {}),
    missingImages: Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(image => !image.complete || !image.naturalWidth).length };
}

function cssColors(css: string): number[][] {
  return [...css.matchAll(/#[\da-f]{6}\b|rgba?\([^)]*\)|color\(srgb[^)]*\)/gi)].map(([value]) => {
    if (value[0] === '#') return [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
    const values = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    return value.startsWith('color(') ? values.map(number => number * 255) : values;
  }).filter(value => value.length === 3 && value.every(Number.isFinite));
}
/** Computed colour distance, not just the presence of gradient syntax. */
export function gradientColorDelta(css: string): number {
  const colors = cssColors(css);
  return Math.max(0, ...colors.flatMap(a => colors.map(b => Math.hypot(...a.map((value, i) => value - b[i])) / (255 * Math.sqrt(3)))));
}
export function matchesRenderedHue(css: string, hex: string): boolean {
  const actual = cssColors(css)[0], expected = cssColors(hex)[0];
  if (!actual || !expected) return false;
  const hue = (rgb: number[]) => {
    const [r, g, b] = rgb, high = Math.max(...rgb), low = Math.min(...rgb), delta = high - low;
    if (delta < 15) return null;
    return ((60 * (high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4)) + 360) % 360;
  };
  const a = hue(actual), b = hue(expected);
  return a === null || b === null ? a === b : Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= 30;
}
function rgbContrast(a: number[], b: number[]) {
  const luma = (rgb: number[]) => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  return (Math.max(luma(a), luma(b)) + .05) / (Math.min(luma(a), luma(b)) + .05);
}

/** Approximate hue family from actual computed CSS, not the requested palette. */
export function renderedColorFamily(css: string): string {
  if (!/^rgba?\(/.test(css)) return 'unknown';
  const values = css.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!values || values.length !== 3) return 'unknown';
  const [r, g, b] = values, maximum = Math.max(r, g, b), minimum = Math.min(r, g, b), delta = maximum - minimum;
  if (delta < 18) return 'neutral';
  let hue = 60 * (maximum === r ? ((g - b) / delta) % 6 : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return hue < 20 ? 'coral/red' : hue < 45 ? 'orange' : hue < 65 ? 'yellow' : hue < 90 ? 'lime' : hue < 165 ? 'green'
    : hue < 195 ? 'teal' : hue < 220 ? 'cyan/blue' : hue < 260 ? 'blue' : hue < 295 ? 'purple' : hue < 345 ? 'pink' : 'red';
}

export function renderedLayoutIssues(report: RenderedHubReport): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const [role, , minimum] of textRoles) {
    const font = report.fonts.find(font => font.role === role);
    if (font && font.minPx < minimum - .3) issues.push({ code: 'readability', layerIds: [],
      message: `${role} text is ${font.minPx}px at 720p; retain at least ${minimum}px through role-aware typography/reflow, not a global shrink.` });
  }
  if (report.clipped.length) issues.push({ code: 'readability', layerIds: [], message: `Rendered text is clipped: ${report.clipped.map(item => item.role + ' ' + item.text).join(', ')}. Reflow columns while preserving content.` });
  if (report.integrity?.hidden.length) issues.push({ code: 'readability', layerIds: [], message: `CSS made live content invisible: ${report.integrity.hidden.join(', ')}. Keep bindings visible; use visibility options for requested removal.` });
  if (report.integrity?.outside.length) issues.push({ code: 'readability', layerIds: [], message: `Live content exceeds its component frame: ${report.integrity.outside.join(', ')}. Reflow the internal layout.` });
  if (report.integrity?.lowContrast.length) issues.push({ code: 'readability', layerIds: [], message: `Rendered text lacks contrast: ${report.integrity.lowContrast.map(item => `${item.role} ${item.ratio}:1`).join(', ')}. Improve foreground/surface contrast.` });
  if (report.missingImages) issues.push({ code: 'readability', layerIds: [], message: `${report.missingImages} preview images failed to load; retain working native image sources.` });
  if (report.integrity?.overlapping?.length) issues.push({ code: 'readability', layerIds: [], message: `Live data parts overlap: ${report.integrity.overlapping.join(', ')}. Allocate separate grid/flex space for each binding.` });
  return issues;
}

export const HUB_REVIEW_PROMPT = `Review a League broadcast design using the supplied evidence and the user's instruction. Return only schema JSON.
Judge hierarchy, readability, paired-table alignment, disciplined spacing and restrained colour use. Approved examples explain WHY decisions work, not compulsory looks. New styles, light themes and different placements can be good.
With measurements only, review instruction fulfilment and readability. You cannot certify visual appeal or identity without seeing an image; state that limitation in the summary. With an image, inspect its actual composition as well. Do not invent missing data or request webcam/new components.
Measured frames are displayed 720p pixels; design/case dimensions are native 1920x1080 units. Never compare the two units directly. A frame fits when x+width<=viewport width and y+height<=viewport height. The space between upper scoreboard and lower tables is reserved gameplay, not wasted padding. Smaller KDA is intentional secondary hierarchy; CS need not equal name size.
Approve a coherent readable hub even if you personally prefer another style. Use issues=[] when no evidenced problem exists. Report only clear supported improvements. Creation supports heading/name font, rows, header accent, dimensions, padding or optional branding; edits must stay within the original requested categories. Do not undo an explicit user request. score0..5 is advisory, not certification. Set approved=false only for clear issues worth one refinement. Summary at most 20 words; problem at most 10 words; action at most 15 words. Do not fill character limits.`;

export const HUB_IMAGE_REVIEW_PROMPT = `Inspect the supplied League broadcast IMAGE. Return only complete schema JSON.
The left CANDIDATE contains an overview and enlarged actual scoreboard/player-table details. Evaluate that overlay; in-game blue/red HUD icons are unrelated. A smaller right companion may show an approved craftsmanship example or the previous proposal. Learn hierarchy, spacing and finish from an approved example without copying its colours or identity. When comparing a refinement, explicitly identify any regression relative to the previous proposal and do not approve a worse result.
Measured teamAccents are the actual rendered CSS colours, with approximate hue families; use these facts rather than guessing the game's native team colours.
Judge readable score hierarchy, balanced spacing, aligned player tables and team distinction. Gameplay space should stay open. Smaller secondary stats are intentional.
Summary: one short sentence naming actual team colours and one visible design feature. At most two evidenced issues. Functional validity is checked separately. Assess visual quality: intentional hierarchy, coherent type roles, purposeful gradients, consistent spacing and a distinctive restrained identity. A readable generic result can still need a specific improvement. Respect the user's style; do not reward decoration for its own sake. Score0..5 is advisory and uncalibrated.
An issue must name a visible problem and one feasible fix using fonts, dimensions, padding, rows or branding. Respect the user's requested style. Keep problem under ten words, action under fifteen words and summary under twenty words.`;

export function qualityFeedback(review: HubDesignReview, measurements: RenderedHubReport) {
  return `Design review of the rendered proposal: ${JSON.stringify({ summary: review.summary, issues: review.issues,
    fonts: measurements.fonts, tableGapPx: measurements.tableGapPx })}. Refine only these points in the supported design settings; retain the original intent and unrelated content. Return the complete proposal JSON.`;
}
