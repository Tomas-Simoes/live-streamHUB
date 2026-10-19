import { ComponentPartStyle, EditorLayer, LayerType } from '../../../shared/types/layer.types';

export const APPEARANCE_COLORS: Record<string, string> = {
  navy: '#081b38', midnight: '#030b1a', 'dark-blue': '#102d50', 'slate-blue': '#1b3858',
  'light-blue': '#45b9ff', purple: '#18112b', lavender: '#b98bea',
  burgundy: '#2b0b0c', cream: '#f1e8d8', emerald: '#10241c', teal: '#29e6d2',
  charcoal: '#15171c', silver: '#aab9cc', white: '#f4f6ff', gold: '#e8c882',
};
const color = { anyOf: [{ enum: Object.keys(APPEARANCE_COLORS) }, { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }] };
export const APPEARANCE_FIELDS = {
  backgroundColor: color,
  gradientTo: { anyOf: [...color.anyOf, { type: 'null' }] },
  gradientDirection: { enum: ['horizontal', 'vertical', 'diagonal'] },
  borderColor: color, borderWidth: { type: 'number', minimum: 0, maximum: 4 },
  paddingX: { type: 'number', minimum: 0, maximum: 32 },
};
export type AppearanceChange = {
  backgroundColor?: string; gradientTo?: string | null;
  gradientDirection?: 'horizontal' | 'vertical' | 'diagonal';
  borderColor?: string; borderWidth?: number; paddingX?: number;
};
const resolveColor = (value: string) => APPEARANCE_COLORS[value] ?? value;

/** Small persisted metadata inside the existing scoped CSS, never supplied as CSS by the model. */
export function currentAppearance(layer: EditorLayer): AppearanceChange {
  const settings = savedAppearance(layer);
  const css = layer.style?.customCss ?? '';
  const themeSurface = css.match(/\/\* ai-theme \*\/[\s\S]*?background:\s*(#[0-9a-fA-F]{6})/)?.[1]
    ?? Array.from(css.matchAll(/--hub-surface-deep:\s*(#[0-9a-fA-F]{6})/g)).at(-1)?.[1]
    ?? Array.from(css.matchAll(/(?:& \.scorebug|& \.player-roster) \{ background:\s*(#[0-9a-fA-F]{6})/g)).at(-1)?.[1];
  const fill = themeSurface ?? layer.style?.backgroundColor;
  const stops = fill?.match(/#[0-9a-fA-F]{6}/g);
  return {
    backgroundColor: stops?.[0] ?? fill,
    ...(fill?.startsWith('linear-gradient') && stops?.[1] ? { gradientTo: stops[1] } : {}),
    borderColor: layer.style?.borderColor, borderWidth: layer.style?.borderWidth,
    ...settings,
  };
}

/** Only explicit overrides are persisted. Reading a native border is not an edit to it. */
export function savedAppearance(layer: EditorLayer): AppearanceChange {
  const match = layer.style?.customCss?.match(/\/\* ai-appearance-settings (\S+) \*\//);
  if (match) {
    try { return JSON.parse(decodeURIComponent(match[1])); } catch { /* Manual CSS may have removed the metadata. */ }
  }
  return {};
}

export function applyAppearance(
  layer: EditorLayer, change: AppearanceChange, all: boolean,
  writeCss: (layer: EditorLayer, key: string, css: string) => void,
) {
  const before = currentAppearance(layer);
  const settings: AppearanceChange = { ...savedAppearance(layer) };
  for (const key of Object.keys(APPEARANCE_FIELDS) as (keyof AppearanceChange)[]) {
    if (change[key] !== undefined) Object.assign(settings, { [key]: change[key] });
  }
  for (const key of ['backgroundColor', 'gradientTo', 'borderColor'] as const) {
    const value = settings[key];
    if (typeof value === 'string') settings[key] = resolveColor(value);
  }
  const rules: string[] = [];
  const scaled = (value: number) => `${100 * value / layer.width}cqw`;
  const compound = layer.type === LayerType.LolScorebug || layer.type === LayerType.LolPlayerRoster;
  const hasSurface = compound || layer.type === LayerType.Shape || !!layer.style?.backgroundColor || !all;
  const hasBorder = compound || (layer.style?.borderWidth ?? 0) > 0 || !all;
  const preserveTeamSections = layer.style?.customCss?.includes('var(--hub-team-left)');
  layer.style = { ...layer.style };
  if (hasSurface && (settings.backgroundColor !== undefined || settings.gradientTo !== undefined || settings.gradientDirection !== undefined)) {
    const start = settings.backgroundColor ?? before.backgroundColor ?? '#081b38';
    // Changing a gradient's first stop preserves its second stop; gradientTo:null explicitly returns to solid.
    const angle = settings.gradientDirection === 'horizontal' ? 90 : settings.gradientDirection === 'diagonal' ? 135 : 180;
    const fill = settings.gradientTo ? `linear-gradient(${angle}deg, ${start}, ${settings.gradientTo})` : start;
    layer.style.backgroundColor = fill;
    rules.push(`& .scorebug, & .player-roster { background: ${fill}; }
${preserveTeamSections ? '' : '& .scorebug-team-blue, & .scorebug-team-red { background: transparent; }'}
& .scorebug-center { background: rgb(0 0 0 / 16%); }
& .objective-row { background: rgb(0 0 0 / 24%); }
& .roster-row { background: linear-gradient(90deg, rgb(255 255 255 / 5%), transparent); }
& .roster-row:nth-child(even) { background: rgb(0 0 0 / 16%); }`);
    patchParts(layer, [...(preserveTeamSections ? [] : ['blue-team', 'red-team']), 'center', 'blue-objectives', 'red-objectives', 'row'], { backgroundColor: 'transparent' });
  }
  if (hasBorder && settings.borderColor !== undefined) {
    layer.style.borderColor = settings.borderColor;
    rules.push(`&, &::before, &::after, & .scorebug-team, & .scorebug-team-blue, & .scorebug-team-red,
& .scorebug-center, & .objective-row, & .roster-row, & .roster-row:nth-child(even), & .item-slot, & .roster-portrait { border-color: ${settings.borderColor}; }
& .scorebug-center { box-shadow: none; }`);
    patchParts(layer, ['blue-team', 'red-team', 'center', 'blue-objectives', 'red-objectives', 'row', 'item', 'portrait'], { borderColor: settings.borderColor });
  }
  if (hasBorder && settings.borderWidth !== undefined) {
    layer.style.borderWidth = settings.borderWidth;
    rules.push(`&, &::before, &::after { border-width: ${settings.borderWidth}px; border-style: solid; }
& .scorebug-team, & .scorebug-team-blue, & .scorebug-team-red,
& .scorebug-center, & .objective-row, & .roster-row, & .roster-row:nth-child(even), & .item-slot, & .roster-portrait { border-width: ${scaled(settings.borderWidth)}; border-style: solid; }`);
    patchParts(layer, ['blue-team', 'red-team', 'center', 'blue-objectives', 'red-objectives', 'row', 'item', 'portrait'], { borderWidth: settings.borderWidth });
  }
  if (settings.paddingX !== undefined) {
    const selector = layer.type === LayerType.LolScorebug ? '& .scorebug-team, & .objective-row'
      : layer.type === LayerType.LolPlayerRoster ? '& .player-roster' : '&';
    // Inline-size containment already exists in the compound renderer. Use canvas-relative
    // units there and percentages for plain editor layers to keep thumbnails proportional.
    const padding = compound ? scaled(settings.paddingX) : `${100 * settings.paddingX / layer.width}%`;
    rules.push(`${selector} { padding-left: ${padding}; padding-right: ${padding}; box-sizing: border-box; }`);
    // Existing per-part padding would otherwise override the scoped horizontal rule.
    if (layer.type === LayerType.LolScorebug) for (const key of ['blue-team', 'red-team', 'blue-objectives', 'red-objectives']) {
      const old = layer.partStyles?.[key];
      if (old?.padding !== undefined) {
        const { padding: _padding, ...rest } = old;
        layer.partStyles = { ...layer.partStyles, [key]: rest };
      }
    }
  }
  // Encode metadata because the existing scoped-CSS parser recognizes braces as rules.
  writeCss(layer, 'appearance', `/* ai-appearance-settings ${encodeURIComponent(JSON.stringify(settings))} */\n${rules.join('\n')}`);
}

function patchParts(layer: EditorLayer, keys: string[], change: ComponentPartStyle) {
  if (layer.type !== LayerType.LolScorebug && layer.type !== LayerType.LolPlayerRoster) return;
  // Only touch existing overrides; ordinary parts are covered by scoped CSS.
  for (const key of keys) if (layer.partStyles?.[key]) {
    layer.partStyles = { ...layer.partStyles, [key]: { ...layer.partStyles[key], ...change } };
  }
}
