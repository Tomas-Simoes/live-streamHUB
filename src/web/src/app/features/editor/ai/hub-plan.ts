import Ajv from 'ajv';
import { Hub, HubLayout } from '../../../shared/types/hub.types';
import { EditorLayer, LayerType, LolPlayerRosterLayer } from '../../../shared/types/layer.types';
import { PREDEFINED_HUB_TEMPLATES, getPredefinedHubTemplate } from '../../../shared/templates/predefined-hub-templates';
import { APPEARANCE_FIELDS, AppearanceChange, applyAppearance, currentAppearance } from './hub-appearance';
import { AI_PALETTES, applyDesignPalette } from './hub-design-references';
import { reflowRosterPair, readablePartSize } from './hub-layout';
import { auditDesignEdits, designQualityWarnings } from './hub-design-guard';
import { HUB_COMPOSITION_SCHEMA, HubComposition, composeHubLayout } from './hub-composition';
import { applyRosterDetail, applyTeamFill, rosterDetail, RosterDetail } from './hub-detail';
import { applyPartStyles, clearPartDeclarations, savedPartStyles, stylePartsFor, normalizePartRules, HUB_STYLE_RULES_SCHEMA, PartStyleRule } from './hub-part-style';
import { fitRosterStyleSizes } from './hub-roster-style';
import { patchAuthoredCss } from '../../../shared/helpers/authored-css';
import { matchesHubTarget as matches, hubTargetInventory } from './hub-targets';
import { createBroadcastScaffold } from './hub-scaffold';
export { AI_PALETTES } from './hub-design-references';

const templateIds = PREDEFINED_HUB_TEMPLATES.map(t => t.id);
const number = (minimum: number, maximum: number) => ({ type: 'number', minimum, maximum });
const boolean = { type: 'boolean' };
const target = { type: 'string', minLength: 1, maxLength: 100 };
const operation = (op: string, fields: Record<string, unknown>, required: string[]) => ({
  type: 'object', additionalProperties: false, required: ['op', ...required],
  properties: { op: { const: op }, ...fields },
});

// This schema is used by BOTH the decoder grammar and the runtime validator.
export const HUB_PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['template', 'operations'],
  properties: {
    template: { enum: ['current', 'ai-composed', 'ai-authored', ...templateIds] },
    authored: { const: true }, summary: { type: 'string', maxLength: 360 },
    design: HUB_COMPOSITION_SCHEMA,
    operations: { type: 'array', minItems: 0, maxItems: 32, items: { oneOf: [
      operation('theme', { palette: { enum: Object.keys(AI_PALETTES) } }, ['palette']),
      { ...operation('appearance', { target, ...APPEARANCE_FIELDS }, ['target']), minProperties: 3 },
      operation('move', { target, dx: number(-1920, 1920), dy: number(-1080, 1080) }, ['target', 'dx', 'dy']),
      operation('resize', { target, width: number(24, 1920), height: number(24, 1080) }, ['target', 'width', 'height']),
      operation('frame', { target, x: number(0, 1920), y: number(0, 1080), width: number(24, 1920), height: number(24, 1080) }, ['target', 'x', 'y', 'width', 'height']),
      operation('css', { target, mode: { enum: ['patch', 'replace'] }, css: { type: 'string', maxLength: 24000 } }, ['target', 'mode', 'css']),
      operation('style', { target, rules: HUB_STYLE_RULES_SCHEMA }, ['target', 'rules']),
      operation('decoration', { key: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,30}$' }, kind: { enum: ['shape', 'text'] },
        x: number(0, 1920), y: number(0, 1080), width: number(8, 1920), height: number(8, 1080), text: { type: 'string', maxLength: 80 } }, ['key', 'kind', 'x', 'y', 'width', 'height']),
      operation('text', { target, text: { type: 'string', minLength: 1, maxLength: 80 } }, ['target', 'text']),
      operation('scoreboard', { target, showGold: boolean, showObjectives: boolean, showGameTime: boolean,
        blueTeamCode: { type: 'string', minLength: 1, maxLength: 8 }, redTeamCode: { type: 'string', minLength: 1, maxLength: 8 } }, ['target']),
      operation('players', { target, portraitSize: number(36, 64), gap: number(2, 12), showChampion: boolean, showLevel: boolean,
        showKda: boolean, showCs: boolean, showGold: boolean, showItems: boolean }, ['target']),
      operation('team-fill', { target, mode: { enum: ['solid', 'gradient'] }, strength: number(.2, .65) }, ['target', 'mode']),
      { ...operation('roster-design', { target, itemSize: number(20, 42), portraitRatio: number(1.05, 1.5), separatorWidth: number(0, 2),
        nameSize: number(18, 32), statSize: number(20, 32), kdaSize: number(16, 28) }, ['target']), minProperties: 3 },
      operation('visibility', { target, visible: boolean }, ['target', 'visible']),
      operation('typography', { target, font: { enum: ['Arial', 'Segoe UI', 'Georgia', 'Impact'] }, size: number(12, 48) }, ['target', 'font', 'size']),
      operation('add', { component: { enum: ['scoreboard', 'players'] } }, ['component']),
      operation('remove', { target }, ['target']),
    ] } },
  },
};

export type HubOperation = AppearanceChange & RosterDetail & {
  op: 'theme' | 'appearance' | 'move' | 'resize' | 'frame' | 'css' | 'scoreboard' | 'players' | 'visibility' | 'typography' | 'add' | 'remove' | 'team-fill' | 'roster-design' | 'style' | 'decoration' | 'text';
  rules?: PartStyleRule[]; key?: string; kind?: 'shape' | 'text'; x?: number; y?: number;
  mode?: 'solid' | 'gradient' | 'patch' | 'replace'; css?: string; strength?: number;
  target?: string; surface?: string; text?: string; blue?: string; red?: string;
  palette?: keyof typeof AI_PALETTES;
  dx?: number; dy?: number; width?: number; height?: number; visible?: boolean;
  showGold?: boolean; showObjectives?: boolean; showGameTime?: boolean; blueTeamCode?: string; redTeamCode?: string;
  portraitSize?: number; gap?: number; showChampion?: boolean; showLevel?: boolean; showKda?: boolean; showCs?: boolean; showItems?: boolean;
  font?: string; size?: number; component?: 'scoreboard' | 'players';
};
export type HubPlan = { template: string; authored?: true; summary?: string; design?: HubComposition; operations: HubOperation[] };
export type LayoutIssue = { code: string; layerIds: string[]; message: string; path?: string };
export class HubPlanError extends Error {
  constructor(public issues: LayoutIssue[]) { super(issues.map(i => i.message).join('\n')); }
}
const validatePlan = new Ajv({ allErrors: true, strict: false }).compile(HUB_PLAN_SCHEMA);
export function parseModelJson(raw: string): unknown {
  // WebLLM's Qwen3 template includes an empty think block in non-thinking mode.
  // Accept only that known, empty prefix; keep the original output in diagnostics.
  try { return JSON.parse(raw.trim().replace(/^<think>\s*<\/think>\s*/, '')); } catch { throw new HubPlanError([{ code: 'json', layerIds: [], message: 'Return one complete JSON object.' }]); }
}
export function parseHubPlan(raw: string): HubPlan {
  const value = parseModelJson(raw);
  if (!validatePlan(value)) throw new HubPlanError((validatePlan.errors ?? []).map(e => ({
    code: 'schema', layerIds: [], message: `${e.instancePath} ${e.message}`,
  })).slice(0, 8));
  const plan = value as HubPlan;
  try { plan.operations = plan.operations.map(op => op.op === 'style' ? { ...op, rules: normalizePartRules(op.rules!) } : op); }
  catch (error) { throw new HubPlanError([{ code: 'style', layerIds: [], message: error instanceof Error ? error.message : String(error) }]); }
  if ((plan.template === 'ai-composed') !== !!plan.design) throw new HubPlanError([{ code: 'composition', layerIds: [], message: 'A generated composition requires design settings; edits cannot replace them.' }]);
  return value as HubPlan;
}

export function hubContext(hub: Hub) {
  const composition = hub.layout?.['aiDesign'] as HubComposition | undefined;
  return {
    canvas: [1920, 1080], template: hub.layout?.['templateId'],
    design: composition ? { colors: composition.colors, typography: composition.typography, panels: composition.panels } : undefined,
    relationships: { tables: 'Existing joined pairs reflow together on resize; headers/backdrops follow. Explicit individual moves remain possible.',
      scoreboard: 'Editable team logos follow the scoreboard.', branding: 'Use target branding to hide/show the entire left information group.',
      playerHeader: 'Use target player-header for the strip above the tables.' },
    layerCount: hub.layers.length,
    // Bound context to leave space for the instruction, response and latest failed candidate.
    layers: hub.layers.filter(l => l.visible || [LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(l.type)).slice(0, 32).map(l => ({ id: l.id, type: l.type, visible: l.visible,
      label: (l.type === LayerType.Text ? l.text : l.name).slice(0, 32),
      x: l.position.x, y: l.position.y, width: l.width, height: l.height,
      parts: stylePartsFor(l), ...(savedPartStyles(l).length ? { customParts: savedPartStyles(l) } : {}),
      ...([LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(l.type) ? { appearance: currentAppearance(l) } : {}),
      ...(l.type === LayerType.LolScorebug ? { existingTeamStatistics: { teamGold: l.showGold, objectives: l.showObjectives, matchClock: l.showGameTime } } : {}),
      ...(l.type === LayerType.LolPlayerRoster ? { team: l.team, existingPlayerStatistics: { championPortraits: l.showChampion, kda: l.showKda,
        cs: l.showCs, individualGold: l.showGold, items: l.showItems }, ...rosterSettings(l), detail: rosterDetail(l) } : {}),
    })),
  };
}

function cssBlock(layer: EditorLayer, key: string, css: string) {
  const old = layer.style?.customCss ?? '';
  const marker = `/* ai-${key} */`;
  const end = `/* /ai-${key} */`;
  const startIndex = old.indexOf(marker);
  const endIndex = old.indexOf(end, startIndex);
  const replacement = `${marker}\n${css}\n${end}`;
  const next = startIndex >= 0 && endIndex >= 0
    ? old.slice(0, startIndex) + replacement + old.slice(endIndex + end.length)
    : `${old.trimEnd()}\n${replacement}`;
  layer.style = { ...layer.style, customCss: next };
}

function rosterSettings(layer: LolPlayerRosterLayer) {
  const match = Array.from((layer.style?.customCss ?? '').matchAll(/\/\* ai-roster-settings (\d+) (\d+) \*\//g)).at(-1);
  return { portraitSize: match ? Number(match[1]) : Math.min(64, Math.round(layer.height / 5 - 4)), gap: match ? Number(match[2]) : 4 };
}
function configureRoster(layer: LolPlayerRosterLayer, op: HubOperation, reflowOnly = false) {
  const flags = ['showChampion', 'showKda', 'showCs', 'showGold', 'showItems'] as const;
  const settings = rosterSettings(layer);
  // Copied current values are not permission to rebuild the native roster grid.
  if (!reflowOnly && (op.portraitSize === undefined || op.portraitSize === settings.portraitSize)
    && (op.gap === undefined || op.gap === settings.gap) && flags.every(key => op[key] === undefined || op[key] === layer[key])) return;
  const requestedSize = op.portraitSize ?? settings.portraitSize;
  const size = reflowOnly ? Math.min(requestedSize, Math.max(36, Math.floor((layer.height - 24) / 5 - 4))) : requestedSize;
  const gap = op.gap ?? settings.gap;
  for (const key of ['showChampion', 'showKda', 'showCs', 'showGold', 'showItems'] as const) {
    if (op[key] !== undefined) layer[key] = op[key]!;
  }
  const columns = [layer.showItems ? 'minmax(144px, 1.5fr)' : '0px', layer.showChampion ? `${size}px` : '0px',
    'minmax(72px, 1fr)', layer.showCs ? '38px' : '0px', layer.showGold ? '52px' : '0px', layer.showKda ? '84px' : '0px'];
  const keys = ['items', 'portrait', 'name', 'cs', 'gold', 'kda'];
  if (layer.orientation === 'right') { columns.reverse(); keys.reverse(); }
  const minWidth = (layer.showItems ? 144 : 0) + (layer.showChampion ? size : 0) + 72
    + (layer.showCs ? 38 : 0) + (layer.showGold ? 52 : 0) + (layer.showKda ? 84 : 0) + 5 * gap + 20;
  if (!reflowOnly) layer.width = Math.max(layer.width, minWidth);
  const height = reflowOnly ? layer.height : Math.max(layer.height, 5 * (size + 8) + 8);
  // Keep the bottom edge fixed when expanding, keeping the broadcast canvas clear.
  layer.position.y -= (height - layer.height) / 2;
  layer.height = height;
  // Percentages scale with the editor's existing container, including miniature previews.
  const scaled = (n: number) => `${100 * n / layer.width}cqw`;
  const scaledColumns = columns.map(v => v.replace(/(\d+)px/g, (_, n) => scaled(Number(n))));
  cssBlock(layer, 'roster', `/* ai-roster-settings ${size} ${gap} */
& .player-roster { gap: ${scaled(4)}; padding: ${scaled(4)}; }
& .roster-row { grid-template-columns: ${scaledColumns.join(' ')}; gap: ${scaled(gap)}; padding: ${scaled(2)}; }
${keys.map((k, i) => `& [data-component-part="${k}"] { grid-column: ${i + 1}; grid-row: 1; }`).join('\n')}
& .roster-portrait { width: ${scaled(size)}; height: ${scaled(size)}; }
& .roster-level { grid-column: ${keys.indexOf('portrait') + 1}; }
& .roster-items { grid-template-columns: repeat(6, minmax(0, 1fr)); }`);
}

function applyFlowingPartStyles(layer: EditorLayer, rules: PartStyleRule[], warnings: LayoutIssue[]) {
  if (layer.type === LayerType.LolPlayerRoster) {
    const fit = fitRosterStyleSizes(layer, normalizePartRules(rules), savedPartStyles(layer));
    if (fit.notes.some(note => note.startsWith('Item dimensions'))) clearPartDeclarations(layer, (part, property) => part === 'items' && ['width', 'height'].includes(property));
    if (fit.portraitSize !== undefined) {
      configureRoster(layer, { op: 'players', portraitSize: fit.portraitSize }, true);
      applyRosterDetail(layer, { itemSize: fit.itemSize ?? rosterDetail(layer).itemSize ?? Math.min(42, Math.floor(fit.portraitSize / 1.2)) });
    }
    for (const message of fit.notes) if (!warnings.some(issue => issue.message === message && issue.layerIds.includes(layer.id))) warnings.push({ code: 'layout-fit', layerIds: [layer.id], message });
    rules = fit.rules;
  }
  if (rules.length || savedPartStyles(layer).length) applyPartStyles(layer, rules);
}

function fitRosterFrame(layers: EditorLayer[], touched: Set<string>) {
  const rosters = layers.filter((l): l is LolPlayerRosterLayer => l.type === LayerType.LolPlayerRoster && l.visible);
  if (!rosters.some(l => touched.has(l.id)) || !rosters.length) return;
  const top = Math.min(...rosters.map(l => l.position.y - l.height / 2));
  const left = Math.min(...rosters.map(l => l.position.x - l.width / 2)), right = Math.max(...rosters.map(l => l.position.x + l.width / 2));
  const center = (left + right) / 2, width = right - left;
  const info = layers.find(l => l.id.includes('-left-info-') && l.type === LayerType.Shape);
  if (info) {
    const previousTop = info.position.y - info.height / 2, previousHeight = info.height;
    const nextTop = top - 30, nextHeight = 1080 - nextTop;
    for (const child of layers.filter(l => /-(left-(broadcast-label|round|series|partner)|broadcast-crest)-/.test(l.id))) {
      child.position.y = nextTop + (child.position.y - previousTop) / previousHeight * nextHeight;
      touched.add(child.id);
    }
    const stack = layers.filter(l => l.visible && /-(left-(broadcast-label|round|series|partner)|broadcast-crest)-/.test(l.id)).sort((a, b) => a.position.y - b.position.y);
    for (let index = 1; index < stack.length; index++) {
      const previous = stack[index - 1], child = stack[index];
      child.position.y = Math.max(child.position.y, previous.position.y + previous.height / 2 + 4 + child.height / 2);
    }
    const overflow = stack.length ? Math.max(0, stack.at(-1)!.position.y + stack.at(-1)!.height / 2 - (nextTop + nextHeight - 8)) : 0;
    for (const child of stack) child.position.y -= overflow;
    info.height = nextHeight; info.position.y = nextTop + nextHeight / 2; touched.add(info.id);
  }
  // Known template furniture follows its roster; arbitrary user content stays intact.
  for (const l of layers) {
    if (l.id.includes('-event-name-')) {
      l.position.y = top - l.height / 2; l.position.x = center; l.width = width; touched.add(l.id);
    }
    if (l.id.includes('-roster-plate-')) { l.width = width; l.position.x = center; l.height = 1080 - top + 30; l.position.y = 1080 - l.height / 2; touched.add(l.id); }
    if (l.id.includes('-roster-divider-')) { l.position.x = center; l.height = 1080 - top; l.position.y = 1080 - l.height / 2; touched.add(l.id); }
  }
}

export function compileHubPlan(hub: Hub, plan: HubPlan): { hub: Hub; warnings: LayoutIssue[] } {
  // Also validate callers that did not use parseHubPlan.
  plan = parseHubPlan(JSON.stringify(plan));
  const layout: HubLayout = structuredClone(plan.template === 'current' ? { ...hub.layout, layers: hub.layers }
    : plan.template === 'ai-authored' ? createBroadcastScaffold() : plan.template === 'ai-composed' ? composeHubLayout(plan.design!) : getPredefinedHubTemplate(plan.template)!.createLayout());
  let layers = layout.layers ?? [];
  const initialGeometry = new Map(layers.map(l => [l.id, { position: { ...l.position }, width: l.width, height: l.height }]));
  const initialPadding = new Map(layers.map(l => [l.id, currentAppearance(l).paddingX ?? 0]));
  const beforeIssues = validateHubLayers(hub.layers);
  const touched = new Set<string>();
  const rosterGeometry = new Set<string>();
  const warnings: LayoutIssue[] = [];
  // New compositions and saved templates both use native editable layers.
  for (const [operationIndex, op] of plan.operations.entries()) {
    if (op.op === 'decoration') {
      const id = `ai-decoration-${op.key}`;
      if (layers.some(layer => layer.id === id)) throw new HubPlanError([{ code: 'id', layerIds: [id], message: 'Decoration key already exists. Style/move the existing layer instead.' }]);
      if (layers.filter(layer => layer.id.startsWith('ai-decoration-')).length >= 16) throw new HubPlanError([{ code: 'decoration', layerIds: [], message: 'Use at most sixteen decorative layers.' }]);
      const base = { id, name: op.text || op.key!, visible: true, position: { x: op.x!, y: op.y! }, width: op.width!, height: op.height!, style: { backgroundColor: 'transparent', color: '#ffffff' } };
      layers.push(op.kind === 'text' ? { ...base, type: LayerType.Text, text: op.text || '', fontSize: 24, fontFamily: 'Arial', bold: true, color: '#ffffff' }
        : { ...base, type: LayerType.Shape });
      touched.add(id); continue;
    }
    if (op.op === 'add') {
      const source = (plan.authored ? createBroadcastScaffold() : getPredefinedHubTemplate('cblol-broadcast')!.createLayout()).layers ?? [];
      const type = op.component === 'scoreboard' ? LayerType.LolScorebug : LayerType.LolPlayerRoster;
      const additions = source.filter(l => l.type === type && !layers.some(existing => existing.type === type
        && (type !== LayerType.LolPlayerRoster || (existing as LolPlayerRosterLayer).team === (l as LolPlayerRosterLayer).team)));
      for (const l of additions) { l.id = crypto.randomUUID(); touched.add(l.id); }
      layers = [...additions, ...layers];
      continue;
    }
    const selected = layers.filter(l => matches(l, op.target ?? 'all'));
    if (!selected.length) {
      const inventory = hubTargetInventory(layers);
      throw new HubPlanError([{ code: 'target', path: `/operations/${operationIndex}/target`, layerIds: [],
        message: `No layers match ${op.target}. Available aliases: ${Object.keys(inventory.aliases).join(', ')}. Use an existing layer ID or create a decoration before styling its ai-decoration-KEY ID.` }]);
    }
    if (op.op === 'style') for (const rule of op.rules!) if (!selected.some(layer => stylePartsFor(layer).includes(rule.part))) {
      throw new HubPlanError([{ code: 'style', layerIds: selected.map(layer => layer.id), message: `Unknown part ${rule.part} on target ${op.target}. Use the supplied component inventory.` }]);
    }
    if (op.op === 'remove') {
      const ids = new Set(selected.map(l => l.id));
      layers = layers.filter(l => !ids.has(l.id));
      for (const l of layers) if (l.groupId && ids.has(l.groupId)) l.groupId = null;
      continue;
    }
    for (const layer of selected) {
      if (op.op === 'style' && !op.rules!.some(rule => stylePartsFor(layer).includes(rule.part))) continue;
      if (['theme', 'appearance'].includes(op.op) && [LayerType.Image, LayerType.Video, LayerType.Group].includes(layer.type)) continue;
      if (op.op === 'typography' && ![LayerType.Text, LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(layer.type)) continue;
      touched.add(layer.id);
      if (layer.type === LayerType.LolPlayerRoster && ['move', 'resize'].includes(op.op)) rosterGeometry.add(layer.id);
      switch (op.op) {
        case 'css':
          try { layer.style = { ...layer.style, customCss: patchAuthoredCss(layer.style?.customCss, op.css!, op.mode as 'patch' | 'replace') }; }
          catch (error) { throw new HubPlanError([{ code: 'style', layerIds: [layer.id], message: error instanceof Error ? error.message : String(error) }]); }
          break;
        case 'frame': layer.position = { x: op.x!, y: op.y! }; layer.width = op.width!; layer.height = op.height!; break;
        case 'appearance': applyAppearance(layer, op, op.target === 'all', cssBlock); break;
        case 'style':
          try { applyFlowingPartStyles(layer, op.rules!.filter(rule => stylePartsFor(layer).includes(rule.part)), warnings); }
          catch (error) { throw new HubPlanError([{ code: 'style', layerIds: [layer.id], message: error instanceof Error ? error.message : String(error) }]); }
          break;
        case 'text':
          if (layer.type !== LayerType.Text) throw wrongType(op, layer);
          layer.text = op.text!; break;
        case 'theme': applyDesignPalette(layer, op.palette!, layout['templateId'] as string | undefined, cssBlock); break;
        case 'move': layer.position.x += op.dx!; layer.position.y += op.dy!; break;
        case 'resize': layer.width = op.width!; layer.height = op.height!; break;
        case 'visibility': layer.visible = op.visible!; break;
        case 'scoreboard':
          if (layer.type !== LayerType.LolScorebug) throw wrongType(op, layer);
          for (const k of ['showGold', 'showObjectives', 'showGameTime', 'blueTeamCode', 'redTeamCode'] as const)
            if (op[k] !== undefined) Object.assign(layer, { [k]: op[k] });
          break;
        case 'players':
          if (layer.type !== LayerType.LolPlayerRoster) throw wrongType(op, layer);
          { const before = JSON.stringify(layer);
            if (plan.authored) {
              for (const key of ['showChampion', 'showLevel', 'showKda', 'showCs', 'showGold', 'showItems'] as const) if (op[key] !== undefined) layer[key] = op[key]!;
            } else configureRoster(layer, op);
            if (JSON.stringify(layer) !== before) rosterGeometry.add(layer.id); }
          break;
        case 'team-fill':
          if (layer.type !== LayerType.LolScorebug) throw wrongType(op, layer);
          clearPartDeclarations(layer, (part, property) => ['blue-team', 'red-team'].includes(part) && property.startsWith('background'));
          applyTeamFill(layer, op.mode as 'solid' | 'gradient', op.strength); break;
        case 'roster-design':
          if (layer.type !== LayerType.LolPlayerRoster) throw wrongType(op, layer);
          clearPartDeclarations(layer, (part, property) => (op.portraitRatio !== undefined || op.itemSize !== undefined) && ['portrait', 'item', 'items', 'row'].includes(part) && /width|height|grid-template-columns/.test(property)
            || op.separatorWidth !== undefined && ['row', 'even-row'].includes(part) && /border|box-shadow/.test(property)
            || [op.nameSize, op.statSize, op.kdaSize].some(value => value !== undefined) && ['name', 'cs', 'gold', 'kda'].includes(part) && property === 'font-size');
          applyRosterDetail(layer, Object.fromEntries(Object.entries(op).filter(([key]) => !['op', 'target'].includes(key)))); break;
        case 'typography':
          clearPartDeclarations(layer, (_part, property) => /font-family|font-size/.test(property));
          if (layer.type === LayerType.Text) { layer.fontFamily = op.font!; layer.fontSize = op.size!; }
          else if (layer.type === LayerType.LolScorebug || layer.type === LayerType.LolPlayerRoster) {
            const parts = layer.type === LayerType.LolScorebug ? ['blue-code', 'red-code', 'clock', 'blue-gold', 'red-gold'] : ['name', 'cs', 'kda', 'gold'];
            for (const k of parts) layer.partStyles = { ...layer.partStyles, [k]: { ...layer.partStyles?.[k], fontFamily: op.font,
              fontSize: readablePartSize(k, op.size!, layer.type === LayerType.LolScorebug) } };
            if (layer.type === LayerType.LolPlayerRoster && ['nameSize', 'statSize', 'kdaSize'].some(key => (rosterDetail(layer) as any)[key] !== undefined)) {
              applyRosterDetail(layer, { nameSize: readablePartSize('name', op.size!, false), statSize: readablePartSize('cs', op.size!, false), kdaSize: readablePartSize('kda', op.size!, false) });
            }
          }
          break;
      }
    }
  }
  if (!plan.authored) {
    reflowRosterPair(layers, initialGeometry, plan.operations, rosterGeometry);
    fitRosterFrame(layers, rosterGeometry);
  }
  for (const layer of layers) if (!plan.authored && touched.has(layer.id) && layer.type === LayerType.LolPlayerRoster) {
    // Percentage/container units must use the FINAL frame, never an intermediate
    // model resize that was subsequently resolved to native layout constraints.
    if (layer.style?.customCss?.includes('/* ai-roster */')) configureRoster(layer, { op: 'players' }, true);
    applyRosterDetail(layer);
  }
  for (const id of rosterGeometry) touched.add(id);
  // Deterministic boundary repair, never trusting the model's coordinates.
  for (const l of layers) {
    if (plan.authored || !touched.has(l.id) || l.type === LayerType.Group) continue;
    const x = Math.max(l.width / 2, Math.min(1920 - l.width / 2, l.position.x));
    const y = Math.max(l.height / 2, Math.min(1080 - l.height / 2, l.position.y));
    if (x !== l.position.x || y !== l.position.y) warnings.push({ code: 'clamped', layerIds: [l.id], message: `${l.name}: position kept inside the canvas.` });
    l.position = { x, y };
  }
  // These templates place their editable team-logo images above the compound
  // scorebug. Keep those linked images attached when its frame moves or scales.
  for (const scoreboard of layers) {
    if (scoreboard.type !== LayerType.LolScorebug || !touched.has(scoreboard.id)) continue;
    const old = initialGeometry.get(scoreboard.id);
    if (!old || (old.position.x === scoreboard.position.x && old.position.y === scoreboard.position.y
      && old.width === scoreboard.width && old.height === scoreboard.height)) continue;
    const prefix = scoreboard.id.split('-scorebug-')[0];
    for (const logo of layers.filter(l => l.type === LayerType.Image
      && (l.id.startsWith(`${prefix}-blue-team-logo-`) || l.id.startsWith(`${prefix}-red-team-logo-`)))) {
      const source = initialGeometry.get(logo.id)!;
      logo.position = {
        x: scoreboard.position.x + (source.position.x - old.position.x) * scoreboard.width / old.width,
        y: scoreboard.position.y + (source.position.y - old.position.y) * scoreboard.height / old.height,
      };
      logo.width = source.width * scoreboard.width / old.width;
      logo.height = source.height * scoreboard.height / old.height;
    }
  }
  for (const scoreboard of layers) {
    if (scoreboard.type !== LayerType.LolScorebug) continue;
    const delta = (currentAppearance(scoreboard).paddingX ?? 0) - (initialPadding.get(scoreboard.id) ?? 0);
    if (!delta) continue;
    const prefix = scoreboard.id.split('-scorebug-')[0];
    for (const logo of layers) {
      if (logo.type !== LayerType.Image) continue;
      if (logo.id.startsWith(`${prefix}-blue-team-logo-`)) logo.position.x += delta;
      if (logo.id.startsWith(`${prefix}-red-team-logo-`)) logo.position.x -= delta;
    }
  }
  // Recompile native-unit styles after final roster reflow/resize. This also
  // keeps custom design rules after the native component's generated defaults.
  for (const layer of layers) if (!plan.authored && savedPartStyles(layer).length) applyFlowingPartStyles(layer, savedPartStyles(layer), warnings);
  const issues = validateHubLayers(layers, !!plan.authored);
  const errors = issues.filter(i => plan.template !== 'current' || !beforeIssues.some(b => issueKey(b) === issueKey(i)));
  if (errors.length) throw new HubPlanError(errors);
  const preservationIssues = auditDesignEdits(hub, layers, plan);
  if (preservationIssues.length) throw new HubPlanError(preservationIssues);
  if (plan.template === 'current' && JSON.stringify(layers) === JSON.stringify(hub.layers)) {
    throw new HubPlanError([{ code: 'no-change', layerIds: [], message: 'This plan changes nothing. Check the current appearance and produce operations for the requested differences, including gradients, border color/width and padding when requested.' }]);
  }
  warnings.push(...issues.filter(i => !errors.includes(i)));
  warnings.push(...designQualityWarnings(layers));
  layout.layers = layers;
  // Separate preview IDs prevent scoped template CSS from affecting the live editor.
  return { hub: { ...hub, layout, layers }, warnings };
}
const issueKey = (i: LayoutIssue) => `${i.code}:${i.layerIds.join(',')}`;
const wrongType = (op: HubOperation, l: EditorLayer) => new HubPlanError([{ code: 'type', layerIds: [l.id], message: `${op.op} cannot modify ${l.type}. Choose a compatible target.` }]);

export function validateHubLayers(layers: EditorLayer[], flexible = false): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const add = (code: string, ls: EditorLayer[], message: string) => issues.push({ code, layerIds: ls.map(l => l.id), message });
  const ids = new Set<string>();
  for (const l of layers) {
    if (ids.has(l.id)) add('id', [l], 'Duplicate layer ID.');
    ids.add(l.id);
    if (!Object.values(LayerType).includes(l.type)) add('type', [l], 'Unsupported layer type.');
    if (l.type === LayerType.Group || !l.visible) continue;
    if (![l.width, l.height, l.position.x, l.position.y].every(Number.isFinite) || l.width <= 0 || l.height <= 0) { add('dimensions', [l], `${l.name}: invalid dimensions.`); continue; }
    if (l.position.x - l.width / 2 < -0.1 || l.position.x + l.width / 2 > 1920.1 || l.position.y - l.height / 2 < -0.1 || l.position.y + l.height / 2 > 1080.1)
      add('bounds', [l], `${l.name}: outside the canvas.`);
    if (l.type === LayerType.LolScorebug && ((!flexible && (l.width < 800 || l.height < 76)) || !l.blueTeamCode || !l.redTeamCode)) add('scoreboard', [l], 'Scoreboard requires valid team codes and a readable frame.');
    if (l.type === LayerType.LolPlayerRoster && ((!flexible && (l.width < 540 || l.height < 240)) || !['blue', 'red'].includes(l.team))) add('roster', [l], 'Each five-player roster requires a valid team and a readable frame.');
    if (l.type === LayerType.ChampionPortrait && (l.width < 36 || l.height < 36)) add('portrait', [l], 'Champion portraits must be at least 36 x 36 pixels.');
    if (l.type === LayerType.PlayerItems && (l.width < 144 || l.height < 24)) add('items', [l], 'Six item slots need at least 144 x 24 pixels.');
  }
  for (const l of layers) if (l.groupId && !layers.some(g => g.id === l.groupId && g.type === LayerType.Group)) add('group', [l], 'Missing parent group.');
  // Shapes and images may intentionally sit behind functional components. Only reject
  // newly introduced intersections between content layers; existing ones are warnings.
  const content = layers.filter(l => l.visible && ![LayerType.Shape, LayerType.Image, LayerType.Video, LayerType.Group].includes(l.type));
  for (let a = 0; !flexible && a < content.length; a++) for (let b = a + 1; b < content.length; b++) {
    const x = content[a], y = content[b];
    if (Math.abs(x.position.x - y.position.x) < (x.width + y.width) / 2 - 1
      && Math.abs(x.position.y - y.position.y) < (x.height + y.height) / 2 - 1)
      add('collision', [x, y], `${x.name} overlaps ${y.name}. Move or resize the components.`);
  }
  return issues;
}

export function previewHub(hub: Hub, prefix = 'ai-preview-'): Hub {
  const layers = structuredClone(hub.layers);
  const ids = new Map(layers.map(l => [l.id, `${prefix}${l.id}`]));
  for (const l of layers) { l.id = ids.get(l.id)!; if (l.groupId) l.groupId = ids.get(l.groupId) ?? null; }
  return { ...hub, layers, layout: { ...hub.layout, layers } };
}

export function describeHubPlan(plan: HubPlan): string[] {
  if (plan.authored) return [plan.summary || 'Updated the broadcast design.', ...plan.operations.filter(op => op.op !== 'css').map(op => `${op.op}: ${op.target ?? op.key ?? op.component ?? ''}`)];
  const changes = plan.design ? [`New composition: ${plan.design.panels.fill} panels, ${plan.design.panels.corners} corners; ${plan.design.typography.headingFont} / ${plan.design.typography.bodyFont}`, `Scoreboard ${plan.design.layout.scoreboardWidth} × ${plan.design.layout.scoreboardHeight}; player panels ${plan.design.layout.rosterHeight}px high`]
    : plan.template === 'current' ? [] : [`Start from ${getPredefinedHubTemplate(plan.template)?.name ?? plan.template}`];
  for (const op of plan.operations) {
    const selector = op.target ?? 'all';
    const target = ({ all: 'All panels', scoreboards: 'Team scoreboard', players: 'Player panels', texts: 'Text', portraits: 'Portraits' } as Record<string, string>)[selector] ?? 'Selected layer';
    if (op.op === 'style') changes.push(`${target}: custom layout and styling for ${op.rules!.map(rule => rule.part).join(', ')}`);
    else if (op.op === 'decoration') changes.push(`Add ${op.kind}: ${op.text || op.key}`);
    else if (op.op === 'text') changes.push(`${target}: text “${op.text}”`);
    else if (op.op === 'appearance') {
      const details = [];
      if (op.backgroundColor !== undefined) details.push(`background ${op.backgroundColor}`);
      if (op.gradientTo !== undefined) details.push(op.gradientTo === null ? 'solid fill' : `gradient to ${op.gradientTo}`);
      if (op.borderColor !== undefined) details.push(`outline ${op.borderColor}`);
      if (op.borderWidth !== undefined) details.push(`outline width ${op.borderWidth}px`);
      if (op.paddingX !== undefined) details.push(`left/right padding ${op.paddingX}px`);
      changes.push(`${target}: ${details.join(', ')}`);
    } else if (op.op === 'team-fill') changes.push(`${target}: ${op.mode === 'gradient' ? 'gradient' : 'solid'} fills for each team section`);
    else if (op.op === 'roster-design') {
      const details = [];
      if (op.itemSize !== undefined) details.push('adjust item icon size');
      if (op.portraitRatio !== undefined) details.push('champion portraits larger than item icons');
      if (op.separatorWidth !== undefined) details.push(op.separatorWidth ? 'fine row separators' : 'remove row separators');
      if ([op.nameSize, op.statSize, op.kdaSize].some(value => value !== undefined)) details.push('adjust player text sizes while retaining font families');
      changes.push(`${target}: ${details.join(', ')}`);
    } else if (op.op === 'theme') changes.push(`Theme: ${op.palette}`);
    else if (op.op === 'scoreboard') {
      const labels: Record<string, string> = { showObjectives: 'objective stats (drakes, voidgrubs, herald)', showGold: 'team gold', showGameTime: 'match clock', blueTeamCode: 'blue team code', redTeamCode: 'red team code' };
      changes.push(`${target}: ${Object.entries(op).filter(([key]) => !['op', 'target'].includes(key)).map(([key, value]) => typeof value === 'boolean' ? `${value ? 'show' : 'hide'} ${labels[key] ?? key}` : `${labels[key] ?? key}: ${value}`).join(', ')}`);
    } else changes.push(`${op.op} ${target}: ${Object.entries(op).filter(([key]) => !['op', 'target'].includes(key)).map(([key, value]) => `${key} = ${value}`).join(', ')}`);
  }
  return changes;
}
