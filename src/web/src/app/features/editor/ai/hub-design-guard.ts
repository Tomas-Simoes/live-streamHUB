import { Hub } from '../../../shared/types/hub.types';
import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
import { currentAppearance } from './hub-appearance';
import type { HubPlan, LayoutIssue } from './hub-plan';
import { isBroadcastBranding, isPlayerHeader } from './hub-layout';

const matches = (layer: EditorLayer, target?: string) => !target || target === 'all' || target === layer.id
  || (target === 'scoreboards' && layer.type === LayerType.LolScorebug)
  || (target === 'players' && layer.type === LayerType.LolPlayerRoster)
  || (target === 'blue-players' && layer.type === LayerType.LolPlayerRoster && layer.team === 'blue')
  || (target === 'red-players' && layer.type === LayerType.LolPlayerRoster && layer.team === 'red')
  || (target === 'texts' && layer.type === LayerType.Text)
  || (target === 'portraits' && [LayerType.LolPlayerRoster, LayerType.ChampionPortrait].includes(layer.type))
  || (target === 'branding' && isBroadcastBranding(layer)) || (target === 'player-header' && isPlayerHeader(layer));
const typography = (layer: EditorLayer) => ({
  font: layer.type === LayerType.Text ? [layer.fontFamily, layer.fontSize] : [],
  parts: layer.type === LayerType.LolScorebug || layer.type === LayerType.LolPlayerRoster
    ? Object.fromEntries(Object.entries(layer.partStyles ?? {}).map(([key, value]) => [key,
      [value.fontFamily, value.fontSize, value.fontWeight, value.letterSpacing, value.textAlign]])) : {},
  css: layer.style?.customCss?.match(/(?:font(?:-family|-size|-weight)?|letter-spacing|text-transform)\s*:[^;}]+/g) ?? [],
});

/** Detect compiler side effects against declared operations, independently of the model. */
export function auditDesignEdits(before: Hub, after: EditorLayer[], plan: HubPlan): LayoutIssue[] {
  if (plan.template !== 'current') return [];
  const issues: LayoutIssue[] = [];
  const add = (layer: EditorLayer, message: string) => issues.push({ code: 'design-preservation', layerIds: [layer.id], message });
  for (const layer of after) {
    const old = before.layers.find(l => l.id === layer.id);
    if (!old) continue;
    for (const key of ['text', 'playerOverrides', 'src'] as const) {
      if (key === 'text' && plan.operations.some(op => op.op === 'text' && matches(layer, op.target))) continue;
      if (JSON.stringify((old as any)[key]) !== JSON.stringify((layer as any)[key])) add(layer, `${layer.name}: an operation changed unrelated content (${key}).`);
    }
    const explicitType = plan.operations.some(op => (op.op === 'typography' || (op.op === 'style' && op.rules?.some(rule => rule.declarations.some(item => /^(font|letter-spacing|text-)/.test(item.property)))) || (op.op === 'roster-design'
      && [op.nameSize, op.statSize, op.kdaSize].some(value => value !== undefined))) && matches(layer, op.target));
    if (!explicitType && JSON.stringify(typography(old)) !== JSON.stringify(typography(layer))) add(layer, `${layer.name}: typography changed without a typography operation.`);
    const geometryChanged = JSON.stringify([old.position, old.width, old.height]) !== JSON.stringify([layer.position, layer.width, layer.height]);
    if (!geometryChanged) continue;
    const direct = plan.operations.some(op => ['move', 'resize', 'players'].includes(op.op) && matches(layer, op.target));
    const linkedRoster = /-(event-name|roster-plate|roster-divider|left-(info|broadcast-label|round|series|partner)|broadcast-crest)-/.test(layer.id)
      && plan.operations.some(op => ['players', 'move', 'resize'].includes(op.op) && before.layers.some(l => l.type === LayerType.LolPlayerRoster && matches(l, op.target)));
    const linkedLogo = /-(blue|red)-team-logo-/.test(layer.id)
      && plan.operations.some(op => (['move', 'resize'].includes(op.op) || (op.op === 'appearance' && op.paddingX !== undefined))
        && before.layers.some(l => l.type === LayerType.LolScorebug && matches(l, op.target)));
    if (!direct && !linkedRoster && !linkedLogo) add(layer, `${layer.name}: geometry changed without a layout operation.`);
  }
  return issues;
}

export function contrastRatio(foreground: string, background: string): number | undefined {
  const luminance = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
    const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return a === undefined || b === undefined ? undefined : (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

/** Mechanical checks are warnings; they do not claim to judge aesthetics. */
export function designQualityWarnings(layers: EditorLayer[]): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const layer of layers.filter(l => l.visible && [LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(l.type))) {
    const appearance = currentAppearance(layer);
    const foreground = layer.style?.color;
    const stops = [appearance.backgroundColor, appearance.gradientTo].filter((color): color is string => !!color);
    if (foreground && stops.some(stop => (contrastRatio(foreground, stop) ?? Infinity) < 4.5)) {
      issues.push({ code: 'contrast', layerIds: [layer.id], message: `${layer.name}: main text has less than 4.5:1 contrast against a panel color. Review readability.` });
    }
    // Reference composition reserves the main action and minimap. Custom placements remain possible.
    const left = layer.position.x - layer.width / 2, right = layer.position.x + layer.width / 2;
    const top = layer.position.y - layer.height / 2, bottom = layer.position.y + layer.height / 2;
    if ((left < 1560 && right > 360 && top < 740 && bottom > 140) || (right > 1600 && bottom > 820)) {
      issues.push({ code: 'game-area', layerIds: [layer.id], message: `${layer.name}: covers part of the reserved gameplay or minimap area. Review placement.` });
    }
  }
  return issues;
}
