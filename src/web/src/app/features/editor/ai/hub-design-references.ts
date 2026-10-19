import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import { AppearanceChange, applyAppearance, savedAppearance } from './hub-appearance';
import { compositionVariables } from './hub-composition';
import { HUB_DESIGN_PRINCIPLES } from './hub-design-knowledge';
export { hubDesignKnowledge } from './hub-design-knowledge';

/** Color roles are deliberately independent of typography and composition. */
export type DesignColors = {
  ink: string; surface: string; surfaceDeep: string; text: string; muted: string;
  line: string; blue: string; red: string;
};
export const AI_PALETTES = {
  navy: { ink: '#030b1a', surface: '#12386b', surfaceDeep: '#081b38', text: '#f4f6ff', muted: '#b8cbe4', line: '#526f96', blue: '#45b9ff', red: '#ff755b' },
  purple: { ink: '#100b1d', surface: '#302343', surfaceDeep: '#18112b', text: '#f4ebff', muted: '#c9b8da', line: '#736184', blue: '#b98bea', red: '#e8c882' },
  cblol: { ink: '#17090a', surface: '#571813', surfaceDeep: '#2b0b0c', text: '#f1e8d8', muted: '#d7bcac', line: '#926452', blue: '#ef9583', red: '#e8bf96' },
  neon: { ink: '#030811', surface: '#0a2531', surfaceDeep: '#060d18', text: '#f0fff9', muted: '#a6c9d0', line: '#3b777e', blue: '#29e6d2', red: '#ff75bd' },
  emerald: { ink: '#07130f', surface: '#1b3c30', surfaceDeep: '#10241c', text: '#effff6', muted: '#b3d3c2', line: '#4b806b', blue: '#45cc96', red: '#f4b57c' },
  monochrome: { ink: '#090b0e', surface: '#292d34', surfaceDeep: '#15171c', text: '#f5f5f2', muted: '#bdc4ce', line: '#69717e', blue: '#c0cfdf', red: '#ead6c1' },
  steel: { ink: '#11181b', surface: '#202a2f', surfaceDeep: '#131c20', text: '#f3f2e9', muted: '#aebcba', line: '#6f8082', blue: '#edc24b', red: '#d98259' },
  coral: { ink: '#170c10', surface: '#48252d', surfaceDeep: '#281318', text: '#fff4ee', muted: '#dfbab6', line: '#946b70', blue: '#ff8f86', red: '#e8c882' },
} satisfies Record<string, DesignColors>;

/** Legacy native template identities for saved plans; never supplied as design lessons. */
export const HUB_DESIGN_REFERENCES = [
  { id: 'pulse-broadcast', approved: true }, { id: 'offset-broadcast', approved: true },
  { id: 'foundry-broadcast', approved: true }, { id: 'atelier-broadcast', approved: false },
  { id: 'voltage-broadcast', approved: false }, { id: 'crown-broadcast', approved: false },
  { id: 'cblol-broadcast', approved: false },
] as const;

export const HUB_DESIGN_RULES = `${HUB_DESIGN_PRINCIPLES} Two mirrored five-player tables include portraits and six items each. Use light or dark colours with readable contrast at 720p. For EDITS preserve unrelated typography, geometry, content and media. Canvas1920x1080; coordinates are centers.`;

type CssWriter = (layer: EditorLayer, key: string, css: string) => void;

/** Native editable layers stay intact; this changes color roles only. */
export function applyDesignPalette(layer: EditorLayer, palette: keyof typeof AI_PALETTES, template: string | undefined, writeCss: CssWriter) {
  const p = AI_PALETTES[palette];
  const oldAppearance = savedAppearance(layer);
  // The new palette replaces old custom colors, keeping padding, fine borders and gradient structure.
  const appearance: AppearanceChange = { ...oldAppearance };
  if (appearance.backgroundColor !== undefined) appearance.backgroundColor = p.surfaceDeep;
  if (appearance.gradientTo) appearance.gradientTo = p.ink;
  if (appearance.borderColor !== undefined) appearance.borderColor = p.line;
  layer.style = { ...layer.style, color: p.text, borderColor: p.line };
  if (layer.style.customCss?.includes('/* ai-composition */')) {
    if (layer.type === LayerType.LolScorebug) { layer.blueAccent = p.blue; layer.redAccent = p.red; }
    if (layer.type === LayerType.Text) layer.color = layer.id.includes('-left-round-') ? p.muted : p.text;
    writeCss(layer, 'theme', `/* ai-palette ${palette} */\n& { ${compositionVariables(p)} }`);
    if (Object.keys(appearance).length) applyAppearance(layer, appearance, false, writeCss);
    return;
  }
  const id = template ?? '';
  const flat = id === 'offset-broadcast' || id === 'foundry-broadcast';
  const bright = id === 'pulse-broadcast' || id === 'voltage-broadcast';
  let css = `/* ai-palette ${palette} */`;
  if (layer.type === LayerType.LolScorebug) {
    layer.blueAccent = p.blue; layer.redAccent = p.red;
    css += `
& .scorebug { background: ${p.surfaceDeep}; color: ${p.text}; }
& .scorebug-team-blue { background: ${flat ? p.surface : `linear-gradient(90deg, color-mix(in srgb, ${bright ? p.blue : p.surface} ${bright ? 25 : 65}%, ${p.surfaceDeep}), ${p.surfaceDeep} 76%)`}; border-color: ${p.blue}; }
& .scorebug-team-red { background: ${flat ? p.surface : `linear-gradient(270deg, color-mix(in srgb, ${bright ? p.red : p.surface} ${bright ? 25 : 65}%, ${p.surfaceDeep}), ${p.surfaceDeep} 76%)`}; border-color: ${p.red}; }
& .scorebug-center { background: linear-gradient(180deg, ${p.surface} 0 70%, ${p.ink} 70%); box-shadow: 1px 0 0 ${p.line} inset, -1px 0 0 ${p.line} inset; border-color: ${p.line}; }
& .team-code, & .team-gold, & .team-kills, & .game-clock { color: ${p.text}; }
& .team-seed, & .objective-row { color: ${p.muted}; }
& .objective-row { background: ${p.ink}; border-color: ${p.line}; }
& .team-objective, & .objective-row-blue { color: ${p.blue}; }
& .scorebug-team-red .team-objective, & .objective-row-red { color: ${p.red}; }`;
    patchColorParts(layer, { 'blue-team': { backgroundColor: 'transparent', borderColor: p.blue }, 'red-team': { backgroundColor: 'transparent', borderColor: p.red },
      'center': { backgroundColor: p.surfaceDeep }, 'blue-objectives': { backgroundColor: p.ink, color: p.blue }, 'red-objectives': { backgroundColor: p.ink, color: p.red } }, p.text);
  } else if (layer.type === LayerType.LolPlayerRoster) {
    const accent = layer.team === 'red' ? p.red : p.blue;
    const frame = id === 'foundry-broadcast' || id === 'crown-broadcast' ? p.line : accent;
    layer.style.backgroundColor = p.surfaceDeep;
    css += `
& .player-roster { background: ${p.surfaceDeep}; color: ${p.text}; }
& .roster-row { background: ${flat ? p.surface : `linear-gradient(90deg, color-mix(in srgb, ${accent} ${bright ? 24 : 8}%, ${p.surfaceDeep}), ${p.surfaceDeep} 70%)`}; border-color: ${p.line}; }
& .roster-row:nth-child(even) { background: ${flat ? p.surfaceDeep : `linear-gradient(90deg, color-mix(in srgb, ${accent} 6%, ${p.ink}), ${p.ink} 80%)`}; }
& .roster-name, & .roster-level { color: ${p.text}; }
& .roster-stat { color: ${accent}; }
& .roster-kda { color: ${p.muted}; }
& .item-slot, & .roster-portrait { background: ${p.ink}; border-color: ${frame}; }`;
    patchColorParts(layer, { row: { backgroundColor: 'transparent' }, cs: { color: accent }, gold: { color: accent },
      kda: { color: p.muted }, item: { backgroundColor: p.ink, borderColor: frame }, portrait: { backgroundColor: p.ink, borderColor: frame } }, p.text);
  } else if (layer.type === LayerType.Text) {
    const secondary = layer.id.includes('-left-round-');
    layer.color = secondary ? p.muted : p.text;
    if (layer.style.backgroundColor) {
      if (layer.id.includes('-event-name-')) layer.style.backgroundColor = id === 'offset-broadcast'
        ? `linear-gradient(90deg, ${p.blue} 0 2%, ${p.surfaceDeep} 2% 98%, ${p.red} 98%)`
        : bright ? `linear-gradient(90deg, ${p.blue}, ${p.surfaceDeep} 28% 72%, ${p.red})` : p.surface;
      else if (id === 'offset-broadcast' && layer.id.includes('-left-partner-')) { layer.style.backgroundColor = p.blue; layer.color = p.ink; }
      else layer.style.backgroundColor = flat ? p.surface : `linear-gradient(90deg, ${p.surface}, ${p.ink})`;
    }
    css += `\n&::before, &::after { border-color: ${p.line}; }`;
  } else if (layer.type === LayerType.Shape) {
    layer.style.backgroundColor = layer.id.includes('-roster-divider-') ? p.line
      : flat ? p.surfaceDeep : `linear-gradient(165deg, ${p.surface}, ${p.surfaceDeep} 48%, ${p.ink})`;
    css += `\n&::before { border-color: ${p.line}; }\n&::after { background: ${p.line}; }`;
  }
  writeCss(layer, 'theme', css);
  if (Object.keys(appearance).length) applyAppearance(layer, appearance, false, writeCss);
}

function patchColorParts(layer: EditorLayer, roles: Record<string, Record<string, string>>, text: string) {
  if (layer.type !== LayerType.LolScorebug && layer.type !== LayerType.LolPlayerRoster) return;
  for (const [key, part] of Object.entries(layer.partStyles ?? {})) {
    const role = roles[key] ?? { color: text };
    const next = { ...part };
    for (const [property, value] of Object.entries(role)) if (property in part) Object.assign(next, { [property]: value });
    layer.partStyles = { ...layer.partStyles, [key]: next };
  }
}
