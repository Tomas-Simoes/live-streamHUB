import Ajv from 'ajv';
import valueParser from 'postcss-value-parser';
import { LayoutIssue, parseModelJson } from './hub-plan';
import type { PreviewReadiness } from './hub-preview-readiness';

export type RenderedHubReport = {
  componentLayouts?: { target: string; role: string; width: number; height: number; contentWidth: number; loaderWidth: number;
    rootColumns: number; rootPadding: number; surfaceWidth: number; surfaceHeight: number;
    text?: { part: string; fontPx: number }[] }[];
  rowLayouts?: { team: string; target?: string; grid: string; rows?: string; width?: number; height?: number;
    trackCount?: number; implicitWrap?: boolean; defaultTracks?: string;
    items?: { slotWidth: number; slotHeight: number; imageWidth: number; imageHeight: number; visibleMin: number };
    fields: { part: string; width: number; height: number; column: string; row?: string; x?: number; y?: number; position?: string;
      fontPx?: number; textWidth?: number; border?: number; margin?: number }[] }[];
  editFacts?: { rosters: { dark: boolean; tinted: boolean; alternating: boolean; csColor: string; csWeight: number; kdaWeight: number; namesFace: string; portraitBorder: number }[]; header?: { fontPx: number; heightPx: number } };
  readiness?: PreviewReadiness;
  repairHints?: { target: string; part: string; css: string; reason: string }[];
  viewport: [number, number]; fonts: { role: string; minPx: number; face: string }[];
  clipped: { role: string; text: string }[]; frames: { role: string; x: number; y: number; width: number; height: number }[];
  tableGapPx: number | null; missingImages: number;
  teamAccents?: { css: string; family: string }[];
  rosterDetails?: { portraitMin: number; itemMax: number; itemMin?: number; separator: number }[];
  teamFills?: { gradient: boolean; css: string; delta?: number }[];
  integrity?: { hidden: string[]; outside: string[]; lowContrast: { role: string; ratio: number }[]; overlapping?: string[] };
};
export type HubDesignReview = { approved: boolean; score?: number; summary: string;
  comparison?: 'initial' | 'improved' | 'unchanged' | 'worse' | 'uncertain'; resolved?: string[]; regressions?: string[];
  issues: { target: 'scoreboard' | 'players' | 'branding' | 'overall'; problem: string; action: string; evidence?: string; criterion?: string }[] };
export type RenderedHub = { measurements: RenderedHubReport; image?: string; computedStyles?: unknown;
  requirementEvidence?: ReturnType<typeof import('./hub-request-checks').measureRequirements> };
export const HUB_REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['approved', 'summary', 'issues'], properties: {
    comparison: { enum: ['initial', 'improved', 'unchanged', 'worse', 'uncertain'] },
    resolved: { type: 'array', maxItems: 3, items: { type: 'string' } }, regressions: { type: 'array', maxItems: 3, items: { type: 'string' } },
    approved: { type: 'boolean' }, score: { type: 'number', minimum: 0, maximum: 5 }, summary: { type: 'string', maxLength: 220 },
    issues: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['target', 'problem', 'action'], properties: {
      target: { enum: ['scoreboard', 'players', 'branding', 'overall'] }, problem: { type: 'string', maxLength: 100 }, action: { type: 'string', maxLength: 140 },
      evidence: { type: 'string', maxLength: 300 }, criterion: { type: 'string', maxLength: 300 },
    } } },
  },
};
const validate = new Ajv({ strict: false, allErrors: true }).compile(HUB_REVIEW_SCHEMA);
// Length bounds remain enforced at runtime. Omitting string-length automata from
// the decoder avoids an expensive first grammar compilation on small devices.
export const HUB_REVIEW_DECODE_SCHEMA = JSON.parse(JSON.stringify(HUB_REVIEW_SCHEMA, (key, value) => key === 'maxLength' ? undefined : value));
HUB_REVIEW_DECODE_SCHEMA.required.push('comparison', 'resolved', 'regressions');
delete HUB_REVIEW_DECODE_SCHEMA.properties.score;
HUB_REVIEW_DECODE_SCHEMA.properties.issues.items.required.push('evidence', 'criterion');
export function parseHubReview(raw: string): HubDesignReview {
  const result = parseModelJson(raw);
  if (!validate(result)) throw new Error('The design reviewer returned unsupported feedback.');
  return result as HubDesignReview;
}
export function validateVisualReview(review: HubDesignReview) {
  if (!review.approved && !review.issues.length) throw new Error('The image reviewer rejected the preview without actionable visual evidence.');
  if (/not visible|cannot see|can't see|no image|image is blank|not provided|unable to assess/i.test(review.summary)) throw new Error('The image reviewer could not ground its feedback in the captured preview.');
  if (review.issues.some(issue => !issue.evidence?.trim() || !issue.criterion?.trim())) throw new Error('Every visual correction needs visible evidence and a user requirement or design principle.');
}

/** An advisory score cannot establish improvement. Uncertain comparisons retain the baseline. */
export function reviewShowsImprovement(previous: HubDesignReview | undefined, next: HubDesignReview): boolean {
  return next.comparison === 'improved' && Array.isArray(next.regressions) && !next.regressions.length
    && !!previous?.issues.length && previous.issues.some(issue => next.resolved?.includes(issue.problem));
}

const textRoles = [
  ['team-code', '.team-code', 12], ['team-gold', '.team-gold', 12], ['score', '.team-kills', 20], ['clock', '.game-clock', 10],
  ['names', '.roster-name', 11], ['cs', '.roster-stat', 11], ['kda', '.roster-kda', 9],
] as const;

/** An enlarged img inside a clipped slot is not a larger readable icon. */
function visibleImageSide(slot: HTMLElement, root: HTMLElement): number {
  const image = slot.querySelector<HTMLElement>('img') ?? slot;
  const box = image.getBoundingClientRect();
  let left = box.left, right = box.right, top = box.top, bottom = box.bottom;
  for (let node: HTMLElement | null = image.parentElement; node && node !== root; node = node.parentElement) {
    const style = getComputedStyle(node), frame = node.getBoundingClientRect();
    if (/hidden|clip|auto|scroll/.test(style.overflowX)) { left = Math.max(left, frame.left); right = Math.min(right, frame.right); }
    if (/hidden|clip|auto|scroll/.test(style.overflowY)) { top = Math.max(top, frame.top); bottom = Math.min(bottom, frame.bottom); }
  }
  return Math.max(0, Math.min(right - left, bottom - top));
}

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
      || (/hidden|clip/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1 && verticalTextClipped(node, style)));
  }).map(node => ({ role, text: node.textContent?.trim().slice(0, 28) ?? '' }))).slice(0, 6);
  const frames = Array.from(root.querySelectorAll<HTMLElement>('.scorebug,.player-roster')).map(node => {
    const box = node.getBoundingClientRect();
    return { role: node.classList.contains('scorebug') ? 'scoreboard' : 'players', x: Math.round(box.x - bounds.x), y: Math.round(box.y - bounds.y),
      width: Math.round(box.width), height: Math.round(box.height) };
  });
  const tables = frames.filter(frame => frame.role === 'players').sort((a, b) => a.x - b.x);
  const rosterDetails = Array.from(root.querySelectorAll<HTMLElement>('.player-roster')).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map(node => {
    const sizes = (selector: string) => Array.from(node.querySelectorAll<HTMLElement>(selector)).map(item => visibleImageSide(item, root));
    const portraits = sizes('.roster-portrait');
    const rowStyle = getComputedStyle(node.querySelector('.roster-row') ?? node);
    const shadowOffsets = rowStyle.boxShadow.match(/-?[\d.]+px/g)?.map(parseFloat);
    const items = sizes('.item-slot');
    return { portraitMin: portraits.length ? Math.min(...portraits) : 0, itemMax: Math.max(...items, 0), itemMin: items.length ? Math.min(...items) : undefined,
      separator: (parseFloat(rowStyle.borderBottomWidth) || (rowStyle.boxShadow.includes('inset') ? Math.abs(shadowOffsets?.[1] ?? 0) : 0)) * renderedScale };
  });
  const teamFills = Array.from(root.querySelectorAll<HTMLElement>('.scorebug-team-blue,.scorebug-team-red')).map(node => {
    const computed = getComputedStyle(node);
    const css = computed.backgroundImage === 'none' ? computed.backgroundColor : computed.backgroundImage;
    return { css, gradient: css.includes('linear-gradient'), delta: gradientColorDelta(css) };
  });
  const fills = (node: HTMLElement) => { const style = getComputedStyle(node); return style.backgroundImage === 'none' ? style.backgroundColor : style.backgroundImage; };
  const editRosters = Array.from(root.querySelectorAll<HTMLElement>('.player-roster')).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
  const nativeScale = 1920 / (bounds.width || 1920);
  const componentLayouts = editRosters.concat(Array.from(root.querySelectorAll<HTMLElement>('.scorebug'))).flatMap(surface => {
    const frame = surface.closest<HTMLElement>('[data-layer-id]'), loader = surface.parentElement;
    if (!frame || !loader) return [];
    const box = frame.getBoundingClientRect(), computed = getComputedStyle(frame), inner = surface.getBoundingClientRect();
    const horizontal = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight) + parseFloat(computed.borderLeftWidth) + parseFloat(computed.borderRightWidth);
    return [{ target: frame.dataset['layerId']!, role: surface.classList.contains('scorebug') ? 'scoreboard' : 'players',
      width: box.width * nativeScale, height: box.height * nativeScale, contentWidth: box.width * nativeScale - horizontal,
      loaderWidth: loader.getBoundingClientRect().width * nativeScale, rootColumns: (computed.gridTemplateColumns.match(/[\d.]+px/g) ?? []).length,
      rootPadding: Math.max(...['paddingLeft','paddingRight','paddingTop','paddingBottom'].map(key => parseFloat((computed as any)[key]) || 0)),
      surfaceWidth: inner.width * nativeScale, surfaceHeight: inner.height * nativeScale,
      text: Array.from(surface.querySelectorAll<HTMLElement>('[data-component-part]')).filter(item => /^(clock|(?:blue|red)-(?:code|gold|kills))$/.test(item.dataset['componentPart'] ?? ''))
        .map(item => ({ part: item.dataset['componentPart']!, fontPx: parseFloat(getComputedStyle(item).fontSize) })) }];
  });
  const rowLayouts = editRosters.flatMap(node => {
    const row = node.querySelector<HTMLElement>('.roster-row');
    if (!row) return [];
    const native = (value: number) => Math.round(value * nativeScale * 10) / 10;
    const rowStyle = getComputedStyle(row), box = row.getBoundingClientRect();
    const fields = Array.from(row.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
        .filter(child => getComputedStyle(child).display !== 'none').map(child => {
          const cell = child.getBoundingClientRect(), style = getComputedStyle(child);
          const part = child.dataset['componentPart'] ?? child.className;
          const siblings = Array.from(node.querySelectorAll<HTMLElement>('[data-component-part]')).filter(item => item.dataset['componentPart'] === part);
          const textWidth = Math.max(0, ...siblings.map(item => { const range = document.createRange(); range.selectNodeContents(item); return range.getBoundingClientRect().width * nativeScale; }));
          return { part, width: native(cell.width), height: native(cell.height), fontPx: parseFloat(style.fontSize), textWidth,
            border: parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth), margin: parseFloat(style.marginLeft) + parseFloat(style.marginRight),
            column: style.gridColumn, row: style.gridRow, x: native(cell.left - box.left), y: native(cell.top - box.top), position: style.position };
        });
    const trackCount = (rowStyle.gridTemplateColumns.match(/[\d.]+px/g) ?? []).length;
    const slot = row.querySelector<HTMLElement>('.item-slot'), image = slot?.querySelector('img');
    const slotBox = slot?.getBoundingClientRect(), imageBox = image?.getBoundingClientRect();
    // Explicit overlays (e.g. level badges sharing the portrait track) are valid.
    // Only diagnose an extra auto-placed row with more in-flow cells than tracks.
    const flow = fields.filter(field => !['absolute', 'fixed'].includes(field.position));
    const implicitWrap = rowStyle.display === 'grid' && trackCount > 0 && flow.length > trackCount
      && (rowStyle.gridTemplateRows.match(/[\d.]+px/g) ?? []).length > 1
      && flow.some(field => field.row === 'auto' && field.y > Math.min(...flow.map(other => other.y + other.height)) - 1);
    return [{ team: node.dataset['team'] ?? '', target: node.closest<HTMLElement>('[data-layer-id]')?.dataset['layerId'],
      grid: rowStyle.gridTemplateColumns, rows: rowStyle.gridTemplateRows, width: native(box.width), height: native(box.height), trackCount, implicitWrap,
      defaultTracks: rowStyle.getPropertyValue('--roster-tracks').trim(), fields,
      ...(slotBox ? { items: { slotWidth: native(slotBox.width), slotHeight: native(slotBox.height),
        imageWidth: native(imageBox?.width ?? 0), imageHeight: native(imageBox?.height ?? 0), visibleMin: native(visibleImageSide(slot!, root)) } } : {}) }];
  });
  const editFacts: NonNullable<RenderedHubReport['editFacts']> = { rosters: editRosters.map(node => {
    const row = node.querySelector<HTMLElement>('.roster-row') ?? node, even = node.querySelector<HTMLElement>('.roster-row:nth-child(even)') ?? row;
    const cs = getComputedStyle(node.querySelector('.roster-stat') ?? node), kda = getComputedStyle(node.querySelector('.roster-kda') ?? node);
    const colors = cssColors(fills(node));
    return { dark: colors.length > 0 && colors.every(color => Math.max(...color) < 65),
      tinted: gradientColorDelta(fills(row)) >= .01 && editRosters.some(other => other !== node && fills(other.querySelector<HTMLElement>('.roster-row') ?? other) !== fills(row)),
      alternating: fills(row) !== fills(even), csColor: cs.color, csWeight: parseInt(cs.fontWeight), kdaWeight: parseInt(kda.fontWeight),
      namesFace: getComputedStyle(node.querySelector('.roster-name') ?? node).fontFamily,
      portraitBorder: parseFloat(getComputedStyle(node.querySelector('.roster-portrait') ?? node).borderTopWidth) * renderedScale };
  }) };
  const heading = root.querySelector<HTMLElement>('[data-layer-id*="-event-name-"] .text-layer');
  if (heading) editFacts.header = { fontPx: parseFloat(getComputedStyle(heading).fontSize) * renderedScale, heightPx: heading.getBoundingClientRect().height };
  const integrity: NonNullable<RenderedHubReport['integrity']> = { hidden: [], outside: [], lowContrast: [], overlapping: [] };
  const repairHints: NonNullable<RenderedHubReport['repairHints']> = [];
  const functional = '.team-code,.team-gold,.team-kills,.game-clock,.roster-name,.roster-stat,.roster-kda,.roster-portrait,.item-slot';
  for (const node of Array.from(root.querySelectorAll<HTMLElement>(functional))) {
    const box = node.getBoundingClientRect(), style = getComputedStyle(node), role = node.className.toString();
    let opacity = 1;
    for (let ancestor: HTMLElement | null = node; ancestor && ancestor !== root; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
    if (opacity < .4) integrity.hidden.push(role);
    if (box.width < 1 || box.height < 1 || style.visibility !== 'visible' || +style.opacity < .4
      || /^rgba\([^)]*,\s*0(?:\.\d+)?\s*\)/.test(style.color) && +(style.color.match(/[\d.]+/g)?.[3] ?? 1) < .4) integrity.hidden.push(role);
    const parent = node.closest<HTMLElement>('.scorebug,.player-roster');
    const frame = parent?.getBoundingClientRect();
    if (frame && (box.left < frame.left - 2 || box.right > frame.right + 2 || box.top < frame.top - 2 || box.bottom > frame.bottom + 2)) integrity.outside.push(role);
    if (!/roster-portrait|item-slot/.test(role)) {
      const foreground = rgbaColors(style.color)[0];
      const backgrounds = backgroundSamples(node, root);
      if (foreground && backgrounds.length) {
        const ratio = Math.min(...backgrounds.map(background => rgbContrast(compositeRgba(foreground, background), background)));
        if (ratio < 3) integrity.lowContrast.push({ role, ratio: Math.round(ratio * 100) / 100 });
      }
    }
  }
  integrity.hidden = [...new Set(integrity.hidden)]; integrity.outside = [...new Set(integrity.outside)];
  integrity.lowContrast = integrity.lowContrast.filter((item, i, all) => all.findIndex(other => other.role === item.role) === i);
  const live = Array.from(root.querySelectorAll<HTMLElement>(functional));
  for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
    const first = live[a], second = live[b], firstWidget = first.closest('.scorebug,.player-roster'), secondWidget = second.closest('.scorebug,.player-roster');
    if (!firstWidget || !secondWidget || firstWidget === secondWidget) continue;
    const x = first.getBoundingClientRect(), y = second.getBoundingClientRect();
    const width = Math.min(x.right, y.right) - Math.max(x.left, y.left), height = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
    if (width > 2 && height > 2 && width * height > Math.min(x.width * x.height, y.width * y.height) * .15) integrity.overlapping!.push(`Across components: ${first.className}/${second.className}`);
  }
  for (const row of Array.from(root.querySelectorAll<HTMLElement>('.roster-row,.scorebug-team,.scorebug-center'))) {
    const parts = Array.from(row.querySelectorAll<HTMLElement>('.roster-name,.roster-stat,.roster-kda,.roster-portrait,.roster-items,.team-code,.team-gold,.team-kills,.game-clock'));
    const frame = row.closest<HTMLElement>('.player-roster')?.getBoundingClientRect();
    const transform = getComputedStyle(row).transform;
    if (frame && transform && transform !== 'none' && parts.some(part => {
      const box = part.getBoundingClientRect(); return box.left < frame.left - 2 || box.right > frame.right + 2 || box.top < frame.top - 2 || box.bottom > frame.bottom + 2;
    })) {
      // New compositions receive fresh UUIDs on every compile. Semantic team
      // targets remain stable across the original proposal and its patch.
      const team = row.closest<HTMLElement>('.player-roster')?.dataset.team;
      const target = team === 'blue' || team === 'red' ? `${team}-players` : undefined;
      if (target && !repairHints.some(hint => hint.target === target)) repairHints.push({ target, part: 'row', css: 'transform:none;',
        reason: 'The row transform moves live data outside its component. Remove that transform; do not repeat it.' });
    }
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
      const x = parts[a].getBoundingClientRect(), y = parts[b].getBoundingClientRect();
      const overlap = Math.max(0, Math.min(x.right, y.right) - Math.max(x.left, y.left)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top));
      if (overlap > 4 && overlap > .12 * Math.min(x.width * x.height, y.width * y.height)) integrity.overlapping!.push(`${parts[a].className}/${parts[b].className}`);
    }
  }
  integrity.overlapping = [...new Set(integrity.overlapping)];
  const teamAccents = Array.from(root.querySelectorAll<HTMLElement>('.player-roster'))
    .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map((node, i) => {
      const sample = node.querySelector<HTMLElement>('.roster-stat');
      const fill = teamFills[i]?.css ?? '';
      const color = cssColors(fill)[0];
      const opaque = color && !/^rgba\([^)]*,\s*0\s*\)/.test(fill);
      // Muted CS text is not the team's identity when the scoreboard has filled
      // team sections. Ground the critic in the most prominent actual treatment.
      const css = opaque ? `rgb(${color.map(value => Math.round(value)).join(', ')})` : sample ? getComputedStyle(sample).color : 'unknown';
      return { css, family: renderedColorFamily(css) };
    });
  return { viewport: [Math.round(bounds.width), Math.round(bounds.height)], fonts, clipped, frames,
    rosterDetails, teamFills, integrity, editFacts, rowLayouts, componentLayouts, ...(repairHints.length ? { repairHints } : {}),
    tableGapPx: tables.length === 2 ? tables[1].x - tables[0].x - tables[0].width : null,
    ...(teamAccents ? { teamAccents } : {}),
    missingImages: Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(image => !image.complete || !image.naturalWidth).length };
}

const colorCache = new Map<string, number[]>();
let colorContext: CanvasRenderingContext2D | null | undefined;
/** Scroll height includes font leading even when every painted glyph fits. */
function verticalTextClipped(node: HTMLElement, style: CSSStyleDeclaration): boolean {
  if (typeof document === 'undefined') return true;
  colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!colorContext) return true;
  colorContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = colorContext.measureText(node.textContent ?? '');
  const ascent = metrics.fontBoundingBoxAscent, descent = metrics.fontBoundingBoxDescent;
  if (![ascent, descent, metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent].every(Number.isFinite)) return true;
  const line = parseFloat(style.lineHeight) || ascent + descent;
  const paddingTop = parseFloat(style.paddingTop) || 0, paddingBottom = parseFloat(style.paddingBottom) || 0;
  const baseline = paddingTop + (line - ascent - descent) / 2 + ascent;
  return baseline - metrics.actualBoundingBoxAscent < -1 || baseline + metrics.actualBoundingBoxDescent > node.clientHeight - paddingBottom + 1;
}
function rgbaColors(css: string): number[][] {
  const values: string[] = [];
  valueParser(css).walk(node => {
    if (node.type === 'function' && /^(?:rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix)$/.test(node.value)) { values.push(valueParser.stringify(node)); return false; }
    if (node.type === 'word' && /^#[\da-f]{3,8}$/i.test(node.value)) values.push(node.value);
    return undefined;
  });
  return values.flatMap(value => {
    if (colorCache.has(value)) return [colorCache.get(value)!];
    let result: number[] | undefined;
    if (typeof document !== 'undefined') {
      colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      if (colorContext) { colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = value; colorContext.fillRect(0, 0, 1, 1);
        const rgba = colorContext.getImageData(0, 0, 1, 1).data; result = [rgba[0], rgba[1], rgba[2], rgba[3] / 255]; }
    } else if (/^#[\da-f]{6}$/i.test(value)) result = [...[1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16)), 1];
    else if (/^(?:rgba?\(|color\(srgb)/i.test(value)) {
      const channels = value.match(/-?[\d.]+/g)?.map(Number) ?? [];
      if (channels.length >= 3) result = [...channels.slice(0, 3).map(number => value.startsWith('color(') ? number * 255 : number), channels[3] ?? 1];
    }
    if (!result?.every(Number.isFinite)) return [];
    if (colorCache.size > 256) colorCache.clear(); colorCache.set(value, result);
    return [result];
  });
}
function cssColors(css: string): number[][] { return rgbaColors(css).map(color => color.slice(0, 3)); }
export function compositeRgba(front: number[], back: number[]): number[] {
  const alpha = (front[3] ?? 1) + (back[3] ?? 1) * (1 - (front[3] ?? 1));
  return [...front.slice(0, 3).map((value, i) => alpha ? (value * (front[3] ?? 1) + back[i] * (back[3] ?? 1) * (1 - (front[3] ?? 1))) / alpha : 0), alpha];
}
function backgroundSamples(node: HTMLElement, root: HTMLElement): number[][] {
  let samples = [[0, 0, 0, 0]];
  for (let surface: HTMLElement | null = node; surface && surface !== root; surface = surface.parentElement) {
    const style = getComputedStyle(surface), base = rgbaColors(style.backgroundColor)[0] ?? [0, 0, 0, 0];
    const stops = rgbaColors(style.backgroundImage);
    const backgrounds = stops.length ? stops.map(stop => compositeRgba(stop, base)) : [base];
    samples = samples.flatMap(front => backgrounds.map(back => compositeRgba(front, back))).slice(0, 8);
    if (samples.every(sample => sample[3] > .99)) return samples;
  }
  // Gameplay underneath fully translucent panels is not a known solid surface.
  return [];
}
/** Computed colour distance, not just the presence of gradient syntax. */
export function gradientColorDelta(css: string): number {
  const colors = cssColors(css);
  return Math.max(0, ...colors.flatMap(a => colors.map(b => Math.hypot(...a.map((value, i) => value - b[i])) / (255 * Math.sqrt(3)))));
}
export function matchesRenderedHue(css: string, hex: string, tolerance = 30): boolean {
  const actual = cssColors(css)[0], expected = cssColors(hex)[0];
  if (!actual || !expected) return false;
  const hue = (rgb: number[]) => {
    const [r, g, b] = rgb, high = Math.max(...rgb), low = Math.min(...rgb), delta = high - low;
    if (delta < 15) return null;
    return ((60 * (high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4)) + 360) % 360;
  };
  const a = hue(actual), b = hue(expected);
  return a === null || b === null ? a === b && Math.abs(actual.reduce((a, b) => a + b) - expected.reduce((a, b) => a + b)) / 3 <= 80
    : Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) <= tolerance;
}
export function rgbContrast(a: number[], b: number[]) {
  // Composited samples are RGBA. Alpha has already been applied; including it
  // in luminance reads a nonexistent fourth weight and silently produces NaN.
  const luma = (rgb: number[]) => rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
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
  if (report.rosterDetails?.some(row => row.itemMin !== undefined && row.itemMin < 15.7)) issues.push({ code: 'readability', layerIds: [],
    message: 'Item icons became too small at 720p. The VISIBLE image inside each slot needs at least 24 native pixels in BOTH dimensions. Enlarge the containing strip/row allocation; enlarging only img cannot escape a clipped slot.' });
  for (const row of report.rowLayouts ?? []) if (row.implicitWrap && row.items && row.items.visibleMin < 23.55) issues.push({
    code: 'readability', layerIds: row.target ? [row.target] : [],
    message: `${row.team} player row has ${row.fields.length} visible fields but ${row.trackCount} columns. Auto-placement created an extra row (${row.rows}), collapsing item slots to ${row.items.slotWidth}x${row.items.slotHeight} native px. Allocate every field, including level, and release conflicting grid-column/grid-row assignments. Changing .item-slot img alone cannot fix this grid.` });
  for (const [role, , minimum] of textRoles) {
    const font = report.fonts.find(font => font.role === role);
    if (font && font.minPx < minimum - .3) issues.push({ code: 'readability', layerIds: [],
      message: `${role} text is ${font.minPx}px at 720p; retain at least ${minimum}px displayed (${Math.ceil(minimum * 1080 / report.viewport[1])} native CSS px at this scale). Reflow this role without shrinking all text.` });
  }
  if (report.clipped.length) issues.push({ code: 'readability', layerIds: [], message: `Rendered text is clipped: ${report.clipped.map(item => item.role + ' ' + item.text).join(', ')}. Reflow columns while preserving content.` });
  if (report.integrity?.hidden.length) issues.push({ code: 'readability', layerIds: [], message: `CSS made live content invisible: ${report.integrity.hidden.join(', ')}. Keep bindings visible; use visibility options for requested removal.` });
  if (report.integrity?.outside.length) issues.push({ code: 'readability', layerIds: [], message: `Live content exceeds its component frame: ${report.integrity.outside.join(', ')}. Reflow the internal layout.` });
  if (report.integrity?.lowContrast.length) issues.push({ code: 'readability', layerIds: [], message: `Rendered text lacks contrast: ${report.integrity.lowContrast.map(item => `${item.role} ${item.ratio}:1`).join(', ')}. Improve foreground/surface contrast.` });
  if (report.missingImages) issues.push({ code: 'readability', layerIds: [], message: `${report.missingImages} preview images failed to load; retain working native image sources.` });
  if (report.integrity?.overlapping?.length) issues.push({ code: 'readability', layerIds: [], message: `Live data parts overlap: ${report.integrity.overlapping.join(', ')}. Allocate separate grid/flex space for each binding.` });
  return issues;
}

/** Aggregate issue messages can contain several failures. Fixing two contrast
 * failures down to one is progress even while one readability message remains. */
export function renderedFailureCount(report: RenderedHubReport): number {
  return renderedLayoutIssues(report).length + report.clipped.length + report.missingImages
    + (report.integrity?.hidden.length ?? 0) + (report.integrity?.outside.length ?? 0)
    + (report.integrity?.lowContrast.length ?? 0) + (report.integrity?.overlapping?.length ?? 0);
}

export const HUB_REVIEW_PROMPT = `Review a League broadcast design using the supplied evidence and the user's instruction. Return only schema JSON.
Judge hierarchy, readability, paired-table alignment, disciplined spacing and restrained colour use. Approved examples explain WHY decisions work, not compulsory looks. New styles, light themes and different placements can be good.
With measurements only, review instruction fulfilment and readability. You cannot certify visual appeal or identity without seeing an image; state that limitation in the summary. With an image, inspect its actual composition as well. Do not invent missing data or request webcam/new components.
Measured frames are displayed 720p pixels; design/case dimensions are native 1920x1080 units. Never compare the two units directly. A frame fits when x+width<=viewport width and y+height<=viewport height. The space between upper scoreboard and lower tables is reserved gameplay, not wasted padding. Smaller KDA is intentional secondary hierarchy; CS need not equal name size.
Check each quoted requirement against its evidence. A failed measurement cannot be approved. Unmeasured requirements remain uncertain, never assumed fulfilled. Every issue names a criterion (user requirement or design principle), observed evidence, the affected region and one feasible correction. All scoped presentation CSS and native geometry operations are available; there is no list of artistic categories. Preserve explicit user constraints. With measurements only, do not request aesthetic refinements or certify visual quality. comparison=initial, resolved=[], regressions=[] unless comparing actual before/after evidence. Return no numerical score. Keep at most two issues and a concise summary.`;

export const HUB_IMAGE_REVIEW_PROMPT = `Inspect the supplied League broadcast IMAGE. Return only complete schema JSON.
The left CANDIDATE contains an overview and enlarged actual scoreboard/player-table details. Evaluate that overlay; in-game blue/red HUD icons are unrelated. A smaller right companion may show an approved craftsmanship example or the previous proposal. Learn hierarchy, spacing and finish from an approved example without copying its colours or identity. When comparing a refinement, explicitly identify any regression relative to the previous proposal and do not approve a worse result.
Measured teamAccents are the actual rendered CSS colours, with approximate hue families; use these facts rather than guessing the game's native team colours.
Judge readable score hierarchy, balanced spacing, aligned player tables and team distinction. Gameplay space should stay open. Smaller secondary stats are intentional.
Check quoted requirements and remaining visual goals individually. Assess hierarchy, typography roles, composition, spacing, palette balance and finish, respecting the requested style rather than forcing the reference's colours or branding. A readable generic result can still need a concrete improvement.
Each issue MUST include target, problem, criterion (specific user requirement or design principle), evidence (what is visible and where), action (one feasible CSS/layout change). Any scoped CSS presentation and native geometry operation is available. Never invent widgets, selectors or live data. User references are examples, not instructions that override the actual request.
Return at most two issues and a short factual summary; no numeric score. First review: comparison=initial, resolved=[], regressions=[]. When the companion is PREVIOUS PROPOSAL, compare the same regions. comparison=improved only with a visible improvement; copy the exact previous problem strings into resolved when actually fixed, and describe any new problem in regressions. Use uncertain if the images do not support a conclusion, worse for regressions, unchanged for no clear benefit. A higher approval does not prove improvement.`;

export function qualityFeedback(review: HubDesignReview, measurements: RenderedHubReport) {
  return `Design review of the rendered proposal: ${JSON.stringify({ summary: review.summary, issues: review.issues,
    fonts: measurements.fonts, tableGapPx: measurements.tableGapPx })}. Return a small CSS PATCH against this retained candidate fixing only the evidenced problems. All scoped presentation CSS is available. Preserve every original requirement, unrelated styling and live bindings. Do not regenerate the whole design.`;
}
