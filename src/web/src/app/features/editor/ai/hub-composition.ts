import { HubLayout } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { createCblolBroadcastHubLayout } from '../../../shared/templates/league-broadcast-hub.template';
import type { DesignColors } from './hub-design-references';
import { contrastRatio } from './hub-design-guard';
import { broadcastRowSurface, broadcastHeaderAccent } from '../../../shared/templates/broadcast-design.styles';

const object = <T extends Record<string, unknown>>(properties: T, optional: string[] = []) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties).filter(key => !optional.includes(key)), properties });
const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const number = (minimum: number, maximum: number) => ({ type: 'number', minimum, maximum });
export const HUB_COMPOSITION_SCHEMA = object({
  colors: object({ background: color, text: color, muted: color, line: color, teamLeft: color, teamRight: color }),
  typography: object({ bodyFont: { enum: ['Arial', 'Segoe UI', 'Georgia', 'Arial Narrow'] },
    headingFont: { enum: ['Arial Black', 'Impact', 'Georgia', 'Segoe UI'] }, uppercaseNames: { type: 'boolean' },
    nameFont: { enum: ['Arial', 'Segoe UI', 'Georgia', 'Arial Narrow', 'Impact'] } }, ['nameFont']),
  panels: object({ fill: { enum: ['solid', 'gradient', 'glass'] }, corners: { enum: ['square', 'rounded', 'cut'] },
    borderWidth: number(0, 2), accentWidth: number(0, 4), teamSections: { type: 'boolean' },
    rows: { enum: ['alternating', 'team-gradient', 'flat'] }, headerAccent: { enum: ['none', 'split', 'underline'] } }, ['teamSections', 'rows', 'headerAccent']),
  layout: object({ scoreboardWidth: number(800, 1920), scoreboardHeight: number(76, 240), rosterHeight: number(240, 540), showEventPanel: { type: 'boolean' },
    rosterWidth: number(540, 900) }, ['rosterWidth']),
  title: { type: 'string', minLength: 1, maxLength: 32 },
});
export type HubComposition = {
  colors: { background: string; text: string; muted: string; line: string; teamLeft: string; teamRight: string };
  typography: { bodyFont: 'Arial' | 'Segoe UI' | 'Georgia' | 'Arial Narrow'; headingFont: 'Arial Black' | 'Impact' | 'Georgia' | 'Segoe UI'; uppercaseNames: boolean; nameFont?: 'Arial' | 'Segoe UI' | 'Georgia' | 'Arial Narrow' | 'Impact' };
  panels: { fill: 'solid' | 'gradient' | 'glass'; corners: 'square' | 'rounded' | 'cut'; borderWidth: number; accentWidth: number; teamSections?: boolean;
    rows?: 'alternating' | 'team-gradient' | 'flat'; headerAccent?: 'none' | 'split' | 'underline' };
  layout: { scoreboardWidth: number; scoreboardHeight: number; rosterHeight: number; showEventPanel: boolean; rosterWidth?: number };
  title: string;
};

export function compositionVariables(colors: DesignColors) {
  const roles = { ...colors, teamLeft: teamSectionColor(colors.blue, colors), teamRight: teamSectionColor(colors.red, colors) };
  return Object.entries(roles).map(([key, value]) => `--hub-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}: ${value};`).join(' ');
}
function mixColor(source: string, target: string, amount: number) {
  return '#' + [1, 3, 5].map(offset => Math.round(
    parseInt(source.slice(offset, offset + 2), 16) * (1 - amount) + parseInt(target.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0')).join('');
}
function teamSectionColor(accent: string, colors: DesignColors) {
  for (let step = 0; step <= 20; step++) {
    const surface = mixColor(accent, colors.surfaceDeep, step / 20);
    if (contrastRatio(colors.text, surface)! >= 4.5) return surface;
  }
  return colors.surfaceDeep;
}
export function compositionColors(colors: HubComposition['colors']): DesignColors {
  const light = contrastRatio('#000000', colors.background)! > contrastRatio('#ffffff', colors.background)!;
  const ink = mixColor(colors.background, light ? '#ffffff' : '#000000', .1);
  const surface = mixColor(colors.background, light ? '#000000' : '#ffffff', .05);
  // Derive readable signal shades from the chosen hue rather than asking a small
  // language model to calculate luminance or replace the requested palette.
  const readable = (color: string) => {
    for (let step = 0; step <= 20; step++) {
      const candidate = mixColor(color, light ? '#000000' : '#ffffff', step / 20);
      if ([ink, surface, colors.background].every(background => contrastRatio(candidate, background)! >= 3)) return candidate;
    }
    return light ? '#000000' : '#ffffff';
  };
  return { ink, surface, surfaceDeep: colors.background, text: colors.text, muted: readable(colors.muted),
    line: colors.line, blue: readable(colors.teamLeft), red: readable(colors.teamRight) };
}

/** Reuse native component/data factories, discard all preset artwork and branding. */
export function composeHubLayout(design: HubComposition): HubLayout {
  const layout = createCblolBroadcastHubLayout();
  const { typography: t, panels: p, layout: geometry } = design;
  const c = compositionColors(design.colors);
  const radius = p.corners === 'rounded' ? 12 : 0;
  const frame = `border-radius: ${radius}px; overflow: hidden; ${p.corners === 'cut' ? 'clip-path: polygon(1% 0, 99% 0, 100% 16%, 100% 100%, 0 100%, 0 16%);' : ''}`;
  const fill = p.fill === 'gradient' ? 'linear-gradient(150deg, var(--hub-surface), var(--hub-surface-deep) 68%, var(--hub-ink))'
    : p.fill === 'glass' ? 'color-mix(in srgb, var(--hub-surface-deep) 94%, transparent)' : 'var(--hub-surface-deep)';
  const common = `/* ai-composition */\n& { ${compositionVariables(c)} ${frame} ${p.fill === 'glass' ? 'backdrop-filter: blur(8px);' : ''} }`;
  const body = `"${t.bodyFont}", Arial, sans-serif`, display = `"${t.headingFont}", Arial, sans-serif`;
  const names = `"${t.nameFont ?? t.bodyFont}", Arial, sans-serif`;
  const rosterWidth = geometry.rosterWidth ?? 600;
  const h = geometry.rosterHeight, top = 1080 - h, infoTop = top - 30, infoHeight = h + 30;
  for (const layer of layout.layers ?? []) {
    layer.id = layer.id.replace(/^cblol-/, 'generated-');
    layer.style = { color: c.text, borderColor: c.line, borderWidth: p.borderWidth, borderRadius: radius, customCss: common };
    const scaled = (n: number) => `${100 * n / layer.width}cqw`;
    if (layer.type === LayerType.LolScorebug) {
      layer.name = 'Team scoreboard'; layer.width = geometry.scoreboardWidth; layer.height = geometry.scoreboardHeight;
      layer.position.y = layer.height / 2; layer.blueAccent = c.blue; layer.redAccent = c.red;
      layer.style.customCss += `
& .scorebug { background: ${fill}; font-family: ${body}; color: var(--hub-text); }
& .scorebug-team { gap: 2%; padding: 0 2.5%; background: transparent; }
& .scorebug-team-blue { border-left: ${scaled(p.accentWidth)} solid var(--hub-blue); ${p.teamSections ? 'background: linear-gradient(105deg, var(--hub-team-left), color-mix(in srgb, var(--hub-team-left) 75%, var(--hub-surface-deep)));' : ''} }
& .scorebug-team-red { border-right: ${scaled(p.accentWidth)} solid var(--hub-red); ${p.teamSections ? 'background: linear-gradient(255deg, var(--hub-team-right), color-mix(in srgb, var(--hub-team-right) 75%, var(--hub-surface-deep)));' : ''} }
& .team-logo { visibility: hidden; flex-basis: 14%; width: 14%; }
& .team-lockup { flex: 1 1 19%; min-width: 0; }
& .team-code { font: 900 clamp(20px, 2.45cqw, 30px) ${display}; color: var(--hub-text); }
& .team-seed { color: var(--hub-muted); font-size: clamp(7px, .85cqw, 10px); }
& .team-gold { color: var(--hub-text); font: 900 clamp(18px, 2.1cqw, 25px) ${display}; }
& .team-objective { color: var(--hub-blue); font-size: clamp(12px, 1.45cqw, 17px); }
& .scorebug-team-red .team-objective { color: var(--hub-red); }
${p.teamSections ? '& .scorebug-team .team-objective, & .team-seed { color: var(--hub-text); }' : ''}
& .scorebug-center { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: minmax(0, 1fr) 29%; gap: 0; padding: 0; place-items: center; background: var(--hub-surface); box-shadow: 1px 0 0 var(--hub-line) inset, -1px 0 0 var(--hub-line) inset; }
& .team-kills { min-width: 0; padding: 0 .1em; font: 900 ${scaled(geometry.scoreboardHeight * .45)}/1.5 ${display}; color: var(--hub-text); }
& .scorebug-center .team-kills:first-child { grid-column: 1; grid-row: 1; }
& .scorebug-center .team-kills:nth-child(3) { grid-column: 2; grid-row: 1; }
& .score-divider { display: none; }
& .game-clock { position: static; grid-column: 1 / -1; grid-row: 2; width: 100%; height: 100%; min-width: 0; display: grid; place-items: center; padding: 0; transform: none; border: 0; background: var(--hub-ink); color: var(--hub-text); font: 900 clamp(10px, 1.85cqw, 22px)/1 ${display}; }
& .objective-row { gap: 6%; padding: 0 5%; background: var(--hub-ink); color: var(--hub-muted); font-size: clamp(9px, 1cqw, 12px); opacity: 1; border-top: 1px solid var(--hub-line); }
& .objective-row-blue { color: var(--hub-blue); } & .objective-row-red { color: var(--hub-red); }`;
    } else if (layer.type === LayerType.LolPlayerRoster) {
      layer.width = rosterWidth; layer.height = h;
      layer.position = { x: 960 + (layer.team === 'blue' ? -1 : 1) * rosterWidth / 2, y: top + h / 2 };
      const accent = layer.team === 'blue' ? 'var(--hub-blue)' : 'var(--hub-red)';
      const portrait = Math.min(56, Math.floor((h - 20) / 5 - 4));
      const columns = ['minmax(180px, 2.4fr)', `${portrait}px`, 'minmax(128px, 1fr)', '42px', '0px', '70px'];
      const keys = ['items', 'portrait', 'name', 'cs', 'gold', 'kda'];
      if (layer.orientation === 'right') { columns.reverse(); keys.reverse(); }
      const rowColumns = columns.map(column => column.replace(/(\d+)px/g, (_, n) => scaled(Number(n)))).join(' ');
      const rowFill = (even: boolean) => broadcastRowSurface(p.rows ?? 'alternating', accent, 'var(--hub-surface)', 'var(--hub-surface-deep)', even);
      layer.style.customCss += `
/* ai-roster-settings ${portrait} 4 */
& .player-roster { background: ${p.fill === 'glass' ? 'transparent' : fill}; font-family: ${body}; padding: ${scaled(4)}; gap: ${scaled(3)}; }
& .roster-row { grid-template-columns: ${rowColumns}; grid-template-rows: minmax(0, 1fr); padding: ${scaled(2)}; gap: ${scaled(4)}; background: ${p.fill === 'glass' ? 'color-mix(in srgb, var(--hub-surface) 94%, transparent)' : rowFill(false)}; border-bottom: ${scaled(p.borderWidth)} solid var(--hub-line); }
& .roster-row:nth-child(even) { background: ${p.fill === 'glass' ? 'color-mix(in srgb, var(--hub-surface-deep) 94%, transparent)' : rowFill(true)}; }
${keys.map((key, i) => `& [data-component-part="${key}"] { grid-column: ${i + 1}; grid-row: 1; }`).join('\n')}
& .roster-portrait { width: ${scaled(portrait)}; height: ${scaled(portrait)}; border: ${scaled(1)} solid ${accent}; background: var(--hub-ink); border-radius: ${scaled(p.corners === 'rounded' ? 5 : 0)}; }
& .roster-level { grid-column: ${keys.indexOf('portrait') + 1}; grid-row: 1; align-self: end; justify-self: end; z-index: 2; background: transparent; border: 0; font: 900 ${scaled(10)} ${body}; color: #fff; text-shadow: 0 1px 2px #000; }
& .roster-name { font: 800 ${scaled(20)} ${names}; color: var(--hub-text); letter-spacing: 0; text-align: ${layer.orientation === 'right' ? 'right' : 'left'}; text-transform: ${t.uppercaseNames ? 'uppercase' : 'none'}; }
& .roster-stat { font: 900 ${scaled(21)} ${display}; color: ${accent}; }
& .roster-kda { font: 700 ${scaled(18)} ${body}; color: var(--hub-muted); }
& .roster-name, & .roster-stat, & .roster-kda { text-shadow: none; }
& .roster-stat, & .roster-kda { text-align: center; }
& .roster-items { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1%; }
& .item-slot { aspect-ratio: 1; width: 100%; background: var(--hub-ink); border: ${scaled(1)} solid var(--hub-line); box-shadow: none; }
& .item-slot img { width: 100%; height: 100%; object-fit: cover; }`;
    } else if (layer.type === LayerType.Text) {
      layer.fontFamily = layer.id.includes('-left-round-') ? t.bodyFont : t.headingFont;
      layer.color = layer.id.includes('-left-round-') ? c.muted : c.text;
      layer.bold = true; layer.style.textShadow = 'none';
      layer.style.customCss += '\n& .text-layer { font-weight: 800; }';
      if (layer.id.includes('-timer-')) layer.style.backgroundColor = fill;
      if (layer.id.includes('-event-name-')) { layer.text = design.title; layer.width = rosterWidth * 2; layer.position.y = top - 15; layer.style.backgroundColor = 'var(--hub-surface)';
        layer.style.customCss += '\n' + broadcastHeaderAccent(p.headerAccent ?? 'none', 'var(--hub-blue)', 'var(--hub-red)'); }
      if (layer.id.includes('-left-broadcast-label-')) { layer.text = 'LEAGUE'; layer.fontSize = 36; layer.position.y = infoTop + infoHeight * .25; }
      if (layer.id.includes('-left-round-')) { layer.text = 'LIVE MATCH'; layer.position.y = infoTop + infoHeight * .4; }
      if (layer.id.includes('-left-series-')) { layer.text = 'GAME 01 / BO5'; layer.position.y = infoTop + infoHeight * .56; }
      if (layer.id.includes('-left-partner-')) { layer.text = 'LEAGUE OF LEGENDS'; layer.fontSize = 20; layer.position.y = infoTop + infoHeight * .89; layer.style.backgroundColor = 'var(--hub-surface)'; }
      if (!layer.style.backgroundColor) { layer.style.borderWidth = 0; layer.style.borderRadius = 0; }
      layer.name = layer.text;
    } else if (layer.type === LayerType.Shape) {
      layer.style.backgroundColor = fill;
      if (layer.id.includes('-roster-divider-')) { layer.height = h; layer.position.y = top + h / 2; layer.style.backgroundColor = 'var(--hub-line)'; }
      if (layer.id.includes('-roster-plate-') || layer.id.includes('-left-info-')) { layer.height = infoHeight; layer.position.y = infoTop + infoHeight / 2; }
      if (layer.id.includes('-roster-plate-')) layer.width = rosterWidth * 2;
      if (p.fill === 'glass' && layer.id.includes('-roster-plate-')) layer.style.backgroundColor = 'transparent';
    } else if (layer.type === LayerType.Image) {
      layer.style.borderWidth = 0;
      const blue = layer.id.includes('-blue-team-logo-'), red = layer.id.includes('-red-team-logo-');
      if (blue || red) {
        layer.width = layer.height = geometry.scoreboardHeight * .44;
        layer.position = { x: 960 + (blue ? -1 : 1) * geometry.scoreboardWidth * .469, y: geometry.scoreboardHeight * .36 };
        layer.src = mark(blue ? 'KC' : 'MKOI', blue ? c.blue : c.red, c.ink, c.text, radius);
      } else { layer.src = mark('L', c.line, c.ink, c.text, radius); layer.position.y = infoTop + infoHeight * .72; }
    }
    if (!geometry.showEventPanel && (layer.id.includes('-left-') || layer.id.includes('-broadcast-crest-'))) layer.visible = false;
  }
  return { ...layout, id: 'ai-composed-hub', templateId: 'ai-composed', aiDesign: structuredClone(design) };
}

function mark(label: string, line: string, fill: string, text: string, radius: number) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="${radius}" fill="${fill}" stroke="${line}" stroke-width="3"/><text x="32" y="38" text-anchor="middle" font-family="Arial" font-weight="900" font-size="${label.length > 2 ? 13 : 22}" fill="${text}">${label}</text></svg>`)}`;
}
