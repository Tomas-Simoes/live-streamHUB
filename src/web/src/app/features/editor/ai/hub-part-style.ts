import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import { APPEARANCE_COLORS } from './hub-appearance';

// The model chooses CSS values, never selectors, markup, bindings or resources.
const scoreboardParts = ['blue-team', 'red-team', 'center', 'blue-code', 'red-code', 'blue-gold', 'red-gold', 'blue-kills', 'red-kills', 'clock', 'blue-seed', 'red-seed', 'blue-towers', 'red-towers', 'blue-objectives', 'red-objectives', 'blue-logo', 'red-logo'] as const;
const rosterParts = ['row', 'even-row', 'portrait', 'items', 'item', 'name', 'cs', 'kda', 'gold', 'level'] as const;
export const HUB_STYLE_PARTS = ['root', 'surface', 'before', 'after', 'text', 'image', ...scoreboardParts, ...rosterParts] as const;
export const HUB_CSS_PROPERTIES = ['background', 'background-color', 'background-image', 'color', 'border', 'border-color', 'border-width', 'border-style', 'border-radius', 'border-top', 'border-bottom', 'border-left', 'border-right', 'box-shadow', 'text-shadow', 'padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'gap', 'row-gap', 'column-gap', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variation-settings', 'letter-spacing', 'line-height', 'text-transform', 'text-align', 'display', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'align-items', 'align-self', 'justify-items', 'justify-self', 'justify-content', 'place-items', 'flex-direction', 'flex-wrap', 'flex', 'flex-basis', 'order', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'position', 'top', 'right', 'bottom', 'left', 'inset', 'transform', 'transform-origin', 'opacity', 'z-index', 'clip-path', 'object-fit', 'object-position'] as const;
export type PartStyleRule = { part: typeof HUB_STYLE_PARTS[number]; declarations: { property: typeof HUB_CSS_PROPERTIES[number] | typeof colorVariables[number]; value: string }[] };
const colorVariables = ['--hub-surface', '--hub-surface-deep', '--hub-ink', '--hub-text', '--hub-muted', '--hub-line', '--hub-blue', '--hub-red', '--hub-team-left', '--hub-team-right'] as const;
export const HUB_ALLOWED_STYLE_PROPERTIES = [...HUB_CSS_PROPERTIES, ...colorVariables];
export const HUB_STYLE_RULES_SCHEMA = { type: 'array', minItems: 1, maxItems: 12, items: {
  type: 'object', additionalProperties: false, required: ['part'], oneOf: [
    { required: ['declarations'], not: { required: ['css'] } }, { required: ['css'], not: { required: ['declarations'] } },
  ], properties: {
    css: { type: 'string', minLength: 1, maxLength: 1800 },
    part: { enum: HUB_STYLE_PARTS }, declarations: { type: 'array', minItems: 1, maxItems: 18, items: {
      type: 'object', additionalProperties: false, required: ['property', 'value'], properties: {
        property: { enum: [...HUB_CSS_PROPERTIES, ...colorVariables] }, value: { type: 'string', minLength: 1, maxLength: 240 },
      },
    } },
  },
} };

/** Compact model output is decoded into exactly the same checked declarations
 * used by native rules. Semicolons are separators, never executable CSS input. */
export function normalizePartRules(rules: (PartStyleRule | { part: PartStyleRule['part']; css: string })[], allowed?: readonly string[]): PartStyleRule[] {
  return rules.map(rule => {
    const declarations = 'css' in rule ? rule.css.split(';').map(text => text.trim()).filter(Boolean).map(text => {
      const colon = text.indexOf(':');
      if (colon < 1) throw new Error('Return CSS declarations as property: value; pairs.');
      return { property: text.slice(0, colon).trim() as PartStyleRule['declarations'][number]['property'], value: text.slice(colon + 1).trim() };
    }) : rule.declarations;
    if (!declarations.length || declarations.length > 18) throw new Error('Use between one and eighteen declarations for each part.');
    for (const item of declarations) {
      item.value = canonicalStyleValue(rule.part, item.property, item.value);
      validateStyleValue(rule.part, item.property, item.value);
      if (allowed && !allowed.includes(item.property)) throw new Error(`The current request does not permit ${item.property}. Preserve unrelated styles.`);
    }
    return { part: rule.part, declarations };
  });
}

function canonicalStyleValue(part: string, property: string, value: string) {
  // These names are exact aliases of existing local roles, not invented CSS or
  // external variables. Small models often abbreviate a supplied colour role.
  // The composition uses teamLeft/teamRight; CSS uses hub-team-left/right.
  // Canonicalize only existing roles, including nested var() fallbacks. This
  // selects the contrast-adjusted team surface, not the bright signal colour.
  value = value.replace(/var\(\s*--(?:hub-)?([a-z][a-zA-Z-]*)(?=\s*[,\)])/g, (original, role: string) => {
    const key = role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    return colorVariables.includes(`--hub-${key}` as any) ? `var(--hub-${key}` : original;
  });
  const namedColors: Record<string, string> = { ...APPEARANCE_COLORS, cyan: '#00cbe6', orange: '#ff9900', pink: '#ed82b8', yellow: '#e7db47', black: '#101010' };
  value = value.replace(/var\(\s*--(?:hub-)?([a-z][a-z-]*)\s*\)/gi, (original, name: string) => {
    const key = name.toLowerCase();
    if (colorVariables.includes(`--hub-${key}` as any)) return `var(--hub-${key})`;
    return Object.hasOwn(namedColors, key) ? namedColors[key] : original;
  });
  // Derived-tone aliases retain a visible transition, just as native gradients
  // retain readable text. Explicit literal CSS colour stops are not rewritten.
  value = value.replace(/var\(\s*--hub-team-(left|right)-(\d{2})\s*\)/g, (_all, side, percent) =>
    +percent >= 10 && +percent <= 90 ? `color-mix(in srgb, var(--hub-team-${side}) ${Math.min(65, +percent)}%, var(--hub-surface-deep))` : _all);
  // Apply the same native role floors as the editor's typography controls.
  // Expressions and relative units still go through rendered verification.
  if (property === 'font-size' && /^\d+(?:\.\d+)?px$/.test(value)) {
    const floor = ({ name: 18, cs: 20, gold: 20, kda: 16, clock: 15, 'blue-code': 18, 'red-code': 18,
      'blue-gold': 18, 'red-gold': 18, 'blue-kills': 30, 'red-kills': 30 } as Record<string, number>)[part];
    if (floor) value = `${Math.max(floor, parseFloat(value))}px`;
  }
  return value;
}

export function stylePartsFor(layer: EditorLayer): string[] {
  return ['root', 'before', 'after', ...(layer.type === LayerType.LolScorebug ? ['surface', ...scoreboardParts]
    : layer.type === LayerType.LolPlayerRoster ? ['surface', ...rosterParts]
    : layer.type === LayerType.Text ? ['text'] : layer.type === LayerType.Image ? ['image'] : [])];
}
export function savedPartStyles(layer: EditorLayer): PartStyleRule[] {
  const value = layer.style?.customCss?.match(/\/\* ai-part-style-settings (\S+) \*\//)?.[1];
  if (!value) return [];
  try { return JSON.parse(decodeURIComponent(value)); } catch { return []; }
}
/** A later native instruction supersedes earlier CSS for the same property.
 * Other authored details remain intact across edits and native reflow. */
export function clearPartDeclarations(layer: EditorLayer, remove: (part: string, property: string) => boolean) {
  const old = savedPartStyles(layer);
  if (!old.length) return;
  const rules = old.map(rule => ({ ...rule, declarations: rule.declarations.filter(item => !remove(rule.part, item.property)) })).filter(rule => rule.declarations.length);
  if (JSON.stringify(old) === JSON.stringify(rules)) return;
  layer.style = { ...layer.style, customCss: (layer.style?.customCss ?? '').replace(/\/\* ai-part-style \*\/[\s\S]*?\/\* \/ai-part-style \*\//g, '') };
  if (rules.length) applyPartStyles(layer, rules);
}
function selector(layer: EditorLayer, part: PartStyleRule['part']) {
  if (part === 'root') return '&';
  if (part === 'before' || part === 'after') return `&::${part}`;
  if (part === 'surface') return layer.type === LayerType.LolScorebug ? '& .scorebug' : '& .player-roster';
  if (part === 'even-row') return '& .roster-row:nth-child(even)';
  if (part === 'text') return '& .text-layer';
  if (part === 'image') return '& img';
  return `& [data-component-part="${part}"]`;
}
const functions = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'linear-gradient', 'radial-gradient', 'color-mix', 'var', 'minmax', 'repeat', 'calc', 'clamp', 'min', 'max', 'polygon', 'skew', 'skewX', 'skewY', 'rotate', 'translate', 'translateX', 'translateY', 'scale', 'scaleX', 'scaleY']);
export function validateStyleValue(part: string, property: string, value: string) {
  if (![...HUB_CSS_PROPERTIES, ...colorVariables].includes(property as any) || !value || value.length > 240
    || /[;{}<>@!\\\u0000-\u001f]/.test(value) || /(?:url|expression|image-set|attr|env)\s*\(/i.test(value)
    || /\/\*|\*\//.test(value)) throw new Error(`Unsupported CSS declaration ${property}. Use a plain local CSS value.`);
  for (const match of value.matchAll(/([a-zA-Z][\w-]*)\s*\(/g)) if (!functions.has(match[1])) throw new Error(`Unsupported CSS function ${match[1]}.`);
  for (const match of value.matchAll(/var\(\s*([^,)]+)/g)) if (!/^--hub-(?:surface|surface-deep|ink|text|muted|line|blue|red|team-left|team-right)$/.test(match[1].trim())) throw new Error(`Unknown hub colour variable ${match[1].trim()}. Use the supplied --hub- colour roles.`);
  if (part === 'root' && /^(?:(?:min-|max-)?(?:width|height)|position|inset|top|right|bottom|left|transform|display)$/.test(property)) throw new Error('Change layer geometry with move/resize; root CSS must keep editor geometry accurate.');
  if (property === 'position' && !['relative', 'absolute', 'static'].includes(value)) throw new Error('Parts must remain inside the hub; fixed/sticky positioning is unavailable.');
  if (property === 'display' && !['grid', 'flex', 'block', 'inline', 'inline-block', 'inline-flex', 'inline-grid'].includes(value)) throw new Error('Use visibility operations to hide components.');
  if (property === 'opacity' && (!Number.isFinite(Number(value)) || +value < .45 || +value > 1)) throw new Error('Keep functional parts visible (opacity .45..1).');
  if (property === 'z-index' && (!/^\d+$/.test(value) || +value > 10)) throw new Error('Part stacking must be within 0..10.');
  if (property === 'font-family' && !/^(?:Arial(?: Narrow| Black)?|Segoe UI|Georgia|Impact|sans-serif|serif)(?:\s*,\s*(?:Arial|sans-serif|serif))*$/.test(value.replace(/["']/g, ''))) throw new Error('Choose an installed hub font: Arial, Arial Narrow, Arial Black, Segoe UI, Georgia or Impact.');
  if (property.startsWith('--hub-') && !/^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/]+\)|var\(--hub-[a-z-]+\))$/i.test(value)) throw new Error('Hub variables accept local colour values only.');
  if ([...value.matchAll(/(-?[\d.]+)(px|cqw|%|deg|fr|em)\b/g)].some(match => !Number.isFinite(+match[1]) || Math.abs(+match[1]) > ({ px: 1920, cqw: 200, '%': 200, deg: 360, fr: 24, em: 20 }[match[2]] ?? 0))) throw new Error('CSS length exceeds the hub canvas limits.');
  if (typeof CSS !== 'undefined' && !CSS.supports(property.startsWith('--hub-') ? 'color' : property, value)) throw new Error(`Invalid CSS value for ${property}: ${value}`);
}

/** Compile checked declarations into the existing layer-scoped stylesheet. px
 * means native 1920x1080 units, so thumbnails and exports retain proportions. */
export function applyPartStyles(layer: EditorLayer, rules: PartStyleRule[]) {
  rules = normalizePartRules(rules);
  const merged = new Map(savedPartStyles(layer).map(rule => [rule.part, new Map(rule.declarations.map(item => [item.property, item.value]))]));
  for (const rule of rules) {
    if (!stylePartsFor(layer).includes(rule.part)) throw new Error(`Unknown part ${rule.part} on ${layer.type}. Use the supplied component inventory.`);
    const declarations = merged.get(rule.part) ?? new Map();
    for (const declaration of rule.declarations) {
      validateStyleValue(rule.part, declaration.property, declaration.value);
      declarations.set(declaration.property, declaration.value);
      // TextLoader binds these fields inline. Synchronize native values so a
      // legitimate part style is visible instead of being masked by the binding.
      if (layer.type === LayerType.Text && rule.part === 'text') {
        if (declaration.property === 'font-size' && /^\d+(?:\.\d+)?px$/.test(declaration.value)) layer.fontSize = parseFloat(declaration.value);
        if (declaration.property === 'letter-spacing' && /^\d+(?:\.\d+)?px$/.test(declaration.value)) layer.letterSpacing = parseFloat(declaration.value);
        if (declaration.property === 'font-weight' && /^\d+$/.test(declaration.value)) layer.fontWeight = +declaration.value;
        if (declaration.property === 'line-height' && /^\d+(?:\.\d+)?$/.test(declaration.value)) layer.lineHeight = +declaration.value;
        if (declaration.property === 'color') layer.color = declaration.value;
        if (declaration.property === 'font-family') layer.fontFamily = declaration.value.replace(/["']/g, '');
      }
      // Native per-part inline overrides must not mask a newer CSS decision.
      if ('partStyles' in layer && layer.partStyles?.[rule.part]) {
        const key = ({ background: 'backgroundColor', border: 'borderWidth', padding: 'padding' } as Record<string, string>)[declaration.property]
          ?? declaration.property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        const next: Record<string, unknown> = { ...layer.partStyles[rule.part] }; delete next[key];
        layer.partStyles = { ...layer.partStyles, [rule.part]: next };
      }
    }
    merged.set(rule.part, declarations);
  }
  const settings = [...merged].map(([part, declarations]) => ({ part, declarations: [...declarations].map(([property, value]) => ({ property, value })) }));
  const css = settings.map(rule => `${selector(layer, rule.part)} { ${rule.part === 'before' || rule.part === 'after' ? 'content: ""; pointer-events: none;' : ''} ${rule.declarations.map(item => `${item.property}: ${item.value.replace(/(-?[\d.]+)px\b/g, (_, n) => `${Math.round(+n / layer.width * 100000) / 1000}cqw`)};`).join(' ')} }`).join('\n');
  const old = layer.style?.customCss ?? '';
  layer.style = { ...layer.style, customCss: `${old.replace(/\/\* ai-part-style \*\/[\s\S]*?\/\* \/ai-part-style \*\//g, '').trimEnd()}\n/* ai-part-style */\n/* ai-part-style-settings ${encodeURIComponent(JSON.stringify(settings))} */\n${css}\n/* /ai-part-style */` };
}

export const HUB_PART_STYLE_PROMPT = `Creative control: {"op":"style","target":"scoreboards","rules":[{"part":"center","css":"border-top: 2px solid var(--hub-blue); background: var(--hub-surface-deep);"}]} supplies compact CSS declarations for native parts. Each rule has part and css; use normal property: value; syntax, never a selector or a brace. Invent a coherent identity through coordinated surfaces, hierarchy, spacing and accents. Use 2-5 purposeful rules; omit repetitive default options. Property values are CSS; px are NATIVE canvas units. Filled team colours should use contrast-adjusted var(--hub-team-left)/var(--hub-team-right), with dark var(--hub-surface-deep) gradient ends. Bright signal colours can make white text unreadable. Fonts: Arial, Arial Narrow, Arial Black, Segoe UI, Georgia, Impact. No selectors, URLs, markup, scripts or content replacement. Use move/resize for layer geometry. Internal parts support grid/flex, padding, borders, shadows, relative/absolute placement and decorative before/after. Scoreboard parts: surface, blue-team/red-team, center, blue-code/red-code, blue-gold/red-gold, blue-kills/red-kills, clock, blue-objectives/red-objectives, blue-seed/red-seed. Player parts: surface, row, even-row, portrait (one champion picture), items (the entire strip of SIX icons, never set its width to one icon), item (one equipment icon; put icon width/height here), name, cs, kda, gold, level. Numeric icon sizes are fitted to native row tracks; explicit custom grids remain supported and are validated. Generic: root, before, after, text (Text layers), image (Image layers). Group target all applies each rule only to compatible parts. Native mirrored reading order stays intact unless requested; blue-players/red-players style teams independently. Never rename teams for a colour. Static text/shapes use decoration; live widgets use existing components. Champion/item relationships, fine separators and team-gradient checks are already resolved by the app; do not duplicate those controls in CSS. Develop the remaining design details.`;
