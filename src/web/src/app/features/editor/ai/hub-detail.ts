import { EditorLayer, LayerType, LolPlayerRosterLayer } from '../../../shared/types/layer.types';
import { contrastRatio } from './hub-design-guard';

export type RosterDetail = { itemSize?: number; portraitRatio?: number; separatorWidth?: number;
  nameSize?: number; statSize?: number; kdaSize?: number };

/** Keep generated controls scoped, persistent and last in the cascade after reflow. */
function block(layer: EditorLayer, key: string, css: string) {
  const old = layer.style?.customCss ?? '';
  const start = `/* ai-${key} */`, end = `/* /ai-${key} */`;
  const a = old.indexOf(start), b = old.indexOf(end, a);
  const clean = a >= 0 && b >= 0 ? old.slice(0, a) + old.slice(b + end.length) : old;
  layer.style = { ...layer.style, customCss: `${clean.trimEnd()}\n${start}\n${css}\n${end}` };
}
export function rosterDetail(layer: EditorLayer): RosterDetail {
  const saved = layer.style?.customCss?.match(/\/\* ai-roster-detail-settings (.+) \*\//);
  try { return saved ? JSON.parse(saved[1]) : {}; } catch { return {}; }
}
export function portraitSettings(layer: LolPlayerRosterLayer) {
  const saved = Array.from((layer.style?.customCss ?? '').matchAll(/\/\* ai-roster-settings (\d+) (\d+) \*\//g)).at(-1);
  return { portraitSize: saved ? +saved[1] : Math.min(64, Math.round(layer.height / 5 - 4)), gap: saved ? +saved[2] : 4 };
}
export function applyRosterDetail(layer: LolPlayerRosterLayer, change: RosterDetail = {}) {
  const settings = { ...rosterDetail(layer), ...change };
  // A new relative relationship replaces the model's earlier arbitrary icon
  // size. Keeping that stale size can make 'slightly larger' become twice as big.
  if (change.portraitRatio !== undefined && change.itemSize === undefined) delete settings.itemSize;
  if (!Object.keys(settings).length) return;
  const { portraitSize, gap } = portraitSettings(layer);
  const scaled = (n: number) => `${100 * n / layer.width}cqw`;
  const lines = [`/* ai-roster-detail-settings ${JSON.stringify(settings)} */`];
  if (settings.itemSize !== undefined || settings.portraitRatio !== undefined) {
    const otherColumns = (layer.showChampion ? portraitSize : 0) + 112 + (layer.showCs ? 42 : 0) + (layer.showGold ? 52 : 0) + (layer.showKda ? 70 : 0) + 5 * gap + 22;
    const size = Math.max(1, Math.min(settings.itemSize ?? 42, settings.portraitRatio ? portraitSize / settings.portraitRatio : 42, (layer.width - otherColumns) / 6));
    const itemWidth = 6 * size + 5 * 2;
    const columns = [layer.showItems ? scaled(itemWidth) : '0px', layer.showChampion ? scaled(portraitSize) : '0px',
      `minmax(${scaled(112)},1fr)`, layer.showCs ? scaled(42) : '0px', layer.showGold ? scaled(52) : '0px', layer.showKda ? scaled(70) : '0px'];
    const keys = ['items', 'portrait', 'name', 'cs', 'gold', 'kda'];
    if (layer.orientation === 'right') { columns.reverse(); keys.reverse(); }
    lines.push(`& .roster-row { grid-template-columns: ${columns.join(' ')}; gap: ${scaled(gap)}; }`,
      `& .roster-portrait { width: ${scaled(portraitSize)}; height: ${scaled(portraitSize)}; }`,
      ...keys.map((key, i) => `& [data-component-part="${key}"] { grid-column: ${i + 1}; grid-row: 1; }`),
      `& .roster-level { grid-column: ${keys.indexOf('portrait') + 1}; }`,
      `& .roster-items { grid-template-columns: repeat(6,${scaled(size)}); gap: ${scaled(2)}; justify-content: ${layer.orientation === 'right' ? 'end' : 'start'}; }`,
      `& .item-slot { width: ${scaled(size)}; height: ${scaled(size)}; min-width: 0; }`);
  }
  // Shadows retain fractional hairlines; CSS borders round thin rules to a pixel.
  if (settings.separatorWidth !== undefined) lines.push(`& .roster-row { border-bottom: 0; box-shadow: inset 0 -${scaled(settings.separatorWidth)} 0 var(--hub-line, rgba(255,255,255,.18)); }`);
  for (const [field, part] of [['nameSize', 'name'], ['statSize', 'cs'], ['statSize', 'gold'], ['kdaSize', 'kda']] as const) {
    const size = settings[field];
    if (size !== undefined) layer.partStyles = { ...layer.partStyles, [part]: { ...layer.partStyles?.[part], fontSize: size } };
  }
  block(layer, 'roster-detail', lines.join('\n'));
}

export function applyTeamFill(layer: EditorLayer, mode: 'gradient' | 'solid', strength = .5) {
  if (layer.type !== LayerType.LolScorebug) return;
  // Native team accents are a fallback for older/manual hubs. Compositions supply
  // contrast-adjusted section colours; mixing with their own surface retains hue.
  const readable = (accent: string) => {
    const foreground = layer.style?.color || '#ffffff';
    if (!/^#[0-9a-f]{6}$/i.test(accent) || contrastRatio(foreground, accent) === undefined) return accent;
    const target = (contrastRatio(foreground, '#000000') ?? 0) > (contrastRatio(foreground, '#ffffff') ?? 0) ? 0 : 255;
    for (let step = 0; step <= 20; step++) {
      const candidate = '#' + [1, 3, 5].map(offset => Math.round(parseInt(accent.slice(offset, offset + 2), 16) * (1 - step / 20) + target * step / 20).toString(16).padStart(2, '0')).join('');
      if ((contrastRatio(foreground, candidate) ?? 0) >= 4.5) return candidate;
    }
    return target ? '#ffffff' : '#000000';
  };
  const left = `var(--hub-team-left, ${readable(layer.blueAccent || '#146880')})`;
  const right = `var(--hub-team-right, ${readable(layer.redAccent || '#88501f')})`;
  const surface = `var(--hub-surface-deep, ${layer.style?.backgroundColor || '#101821'})`;
  const fill = (color: string, angle: number) => mode === 'solid' ? color
    : `linear-gradient(${angle}deg, ${color}, color-mix(in srgb, ${color} ${Math.round((1 - strength) * 100)}%, ${surface}))`;
  block(layer, 'team-fill', `/* ai-team-fill-settings ${mode} ${strength} */\n& .scorebug-team-blue { background: ${fill(left, 105)}; }\n& .scorebug-team-red { background: ${fill(right, 255)}; }`);
}
