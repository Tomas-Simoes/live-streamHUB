import Ajv from 'ajv';
import { APPEARANCE_FIELDS, AppearanceChange } from './hub-appearance';
import { AI_PALETTES, HUB_PLAN_SCHEMA, HubOperation, HubPlan, HubPlanError, parseModelJson } from './hub-plan';
import { HUB_DESIGN_RULES } from './hub-design-references';
import { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import type { HubIntent } from './hub-intent';
import { HUB_PART_STYLE_PROMPT, HUB_ALLOWED_STYLE_PROPERTIES, normalizePartRules } from './hub-part-style';

const nullable = (schema: unknown) => ({ anyOf: [schema, { type: 'null' }] });
const object = <T extends Record<string, unknown>>(properties: T) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const flags = (names: string[]) => Object.fromEntries(names.map(name => [name, nullable({ type: 'boolean' })]));
const number = (minimum: number, maximum: number) => nullable({ type: 'number', minimum, maximum });
// Fixed slots make multi-part editing more reliable than asking a tiny model to
// decide which operations to emit. Null ALWAYS means preserve the current value.
export const HUB_EDIT_SCHEMA = object({
  template: { const: 'current' },
  palette: nullable({ enum: Object.keys(AI_PALETTES) }),
  appearance: object({
    target: { enum: ['all', 'scoreboards', 'players'] },
    backgroundColor: nullable(APPEARANCE_FIELDS.backgroundColor),
    gradientTo: nullable({ anyOf: [APPEARANCE_FIELDS.backgroundColor, { const: 'none' }] }),
    gradientDirection: nullable(APPEARANCE_FIELDS.gradientDirection),
    borderColor: nullable(APPEARANCE_FIELDS.borderColor), borderWidth: number(0, 4),
  }),
  scoreboard: object({ paddingX: number(0, 32), ...flags(['showObjectives', 'showGold', 'showGameTime']) }),
  players: object({ portraitSize: number(36, 64), gap: number(2, 12), ...flags(['showChampion', 'showKda', 'showCs', 'showGold', 'showItems']) }),
  operations: { type: 'array', maxItems: 12, items: { oneOf: HUB_PLAN_SCHEMA.properties.operations.items.oneOf
    .filter(op => ['move', 'resize', 'visibility', 'typography', 'add', 'remove', 'scoreboard', 'team-fill', 'roster-design', 'style', 'decoration', 'text'].includes(op.properties.op.const)) } },
});
type Nullable<T> = { [K in keyof T]: T[K] | null };
export type HubEditSpec = {
  template: 'current'; palette: keyof typeof AI_PALETTES | null;
  appearance: { target: 'all' | 'scoreboards' | 'players' } & Nullable<Pick<AppearanceChange,
    'backgroundColor' | 'gradientTo' | 'gradientDirection' | 'borderColor' | 'borderWidth'>>;
  scoreboard: { paddingX: number | null; showObjectives: boolean | null; showGold: boolean | null; showGameTime: boolean | null };
  players: { portraitSize: number | null; gap: number | null; showChampion: boolean | null; showKda: boolean | null; showCs: boolean | null; showGold: boolean | null; showItems: boolean | null };
  operations: HubOperation[];
};
const validate = new Ajv({ allErrors: true, strict: false }).compile(HUB_EDIT_SCHEMA);

/** Legacy response compatibility. Intent never removes design capabilities. */
export function editSchemaForInstruction(_instruction: string, hub?: Hub, _intent?: HubIntent) {
  return nativeResizeBounds(HUB_EDIT_SCHEMA, hub);
}

/** Decoder and runtime both know that a five-player table is not one portrait. */
function nativeResizeBounds(schema: any, hub?: Hub) {
  const result = structuredClone(schema);
  const items = result.properties.operations.items;
  if (!items.oneOf) return result;
  items.oneOf = items.oneOf.flatMap((operation: any) => {
    if (operation.properties.op.const !== 'resize') return [operation];
    const rosterTargets = ['players', 'portraits', 'all', ...(hub?.layers.filter(layer => layer.type === LayerType.LolPlayerRoster).map(layer => layer.id) ?? [])];
    const otherTargets = ['scoreboards', 'texts', 'branding', 'player-header', ...(hub?.layers.filter(layer => layer.type !== LayerType.LolPlayerRoster).map(layer => layer.id) ?? [])];
    const branches = [
      { ...operation, properties: { ...operation.properties, target: { enum: rosterTargets }, width: { type: 'number', minimum: 540, maximum: 1920 }, height: { type: 'number', minimum: 240, maximum: 1080 } } },
      { ...operation, properties: { ...operation.properties, target: { enum: otherTargets } } },
    ];
    const allowed = operation.properties.target.enum;
    if (allowed) for (const branch of branches) branch.properties.target.enum = branch.properties.target.enum.filter((target: string) => allowed.includes(target));
    return branches.filter(branch => branch.properties.target.enum.length);
  });
  return result;
}

export function parseHubEditSpec(raw: string, schema: Record<string, unknown> = HUB_EDIT_SCHEMA, allowResolvedChanges = false): HubPlan {
  const value = parseModelJson(raw);
  const validator = schema === HUB_EDIT_SCHEMA ? validate : new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validator(value)) throw new HubPlanError((validator.errors ?? []).slice(0, 8).map(e => ({ code: 'edit-scope', layerIds: [], message: `${e.instancePath} ${e.message}. Keep unrequested fields null.` })));
  const spec = value as HubEditSpec;
  const styleSchema = (schema as any).properties.operations.items.oneOf?.find((op: any) => op.properties.op.const === 'style');
  try {
    spec.operations = spec.operations.map(op => op.op === 'style' ? { ...op, rules: normalizePartRules(op.rules!, styleSchema?.properties.rules.items.properties.declarations.items.properties.property.enum) } : op);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HubPlanError([{ code: /does not permit/.test(message) ? 'edit-scope' : 'style', layerIds: [], message }]);
  }
  const operations: HubOperation[] = [];
  if (spec.palette !== null) operations.push({ op: 'theme', palette: spec.palette });
  const appearance = Object.fromEntries(Object.entries(spec.appearance).filter(([key, v]) => key !== 'target' && v !== null));
  if (Object.keys(appearance).length) operations.push({ op: 'appearance', target: spec.appearance.target,
    ...appearance, ...(spec.appearance.gradientTo === 'none' ? { gradientTo: null } : {}) });
  const { paddingX, ...scoreboard } = spec.scoreboard;
  if (paddingX !== null) operations.push({ op: 'appearance', target: 'scoreboards', paddingX });
  const scoreboardChanges = Object.fromEntries(Object.entries(scoreboard).filter(([, v]) => v !== null));
  if (Object.keys(scoreboardChanges).length) operations.push({ op: 'scoreboard', target: 'scoreboards', ...scoreboardChanges });
  const players = Object.fromEntries(Object.entries(spec.players).filter(([, v]) => v !== null));
  if (Object.keys(players).length) operations.push({ op: 'players', target: 'players', ...players });
  operations.push(...spec.operations);
  if (!operations.length && !allowResolvedChanges) throw new HubPlanError([{ code: 'no-change', layerIds: [], message: 'All edit fields were null. Set the fields for the requested changes; preserve only properties not requested.' }]);
  return { template: 'current', operations };
}

export const HUB_EDIT_PROMPT = `You edit an existing League of Legends broadcast hub. Return one JSON object using the schema's fixed fields.
${HUB_PART_STYLE_PROMPT}
${HUB_DESIGN_RULES}
template is always current. ALL fields are required; null means KEEP the current value. Do not copy current colors into fields the user wants changed.
palette: null unless the user asks to switch the overall named palette (navy, purple, cblol, neon, emerald, monochrome, steel, coral).
appearance.target: all for the overall hub's panels/outlines; scoreboards for only the upper team scoreboard; players for the two player rosters.
Scope EACH clause independently. A general background/outline change uses all even when later clauses request scoreboard padding/objectives. The scoreboard fields already limit padding/objectives to that component. Choose scoreboards only when the background/outline itself is explicitly limited to the scoreboard.
appearance.backgroundColor: first fill color or null. appearance.gradientTo: second gradient color, or null to preserve, or none to remove a gradient.
appearance.gradientDirection: horizontal, vertical, diagonal, or null. A gradient request needs gradientTo, not just palette.
Colors may be #RRGGBB or named: navy=#081b38, midnight=#030b1a, dark-blue=#102d50, slate-blue=#1b3858, light-blue=#45b9ff, purple, lavender, burgundy, cream, emerald, teal, charcoal, silver, white, gold.
midnight is DARKER than navy. For navy plus a darker blue, choose backgroundColor=navy and gradientTo=midnight.
appearance.borderColor: the NEW outline color, or null if not requested. Replacing a light-blue outline with dark blue needs dark-blue or slate-blue, never the old light-blue color.
appearance.borderWidth: new thickness in canvas pixels, or null. Thinner than 1 requires 0.5 or 0. A dark fine outline can use 0.5 and slate-blue.
scoreboard.paddingX: NEW left/right inner padding in pixels (0..32), or null. Add padding means increase it; 16 is a moderate inset.
scoreboard.showObjectives: true when the user asks for drakes/dragons, voidgrubs, herald or objective information, false to hide them, otherwise null. These objective fields are independent of showGold and showGameTime.
scoreboard.showGold: null unless TEAM GOLD was requested. scoreboard.showGameTime: null unless the MATCH CLOCK was requested. Adding objective information never hides gold or the clock. Individual player gold is a different setting.
players: portraitSize=36..64, gap=2..12, showChampion/showKda/showCs/showGold/showItems=true/false; null leaves that property unchanged. Larger portraits must exceed the current size. Player rosters contain five players each and six item slots per player.
operations: [] unless a change to position, size, visibility, typography, team codes, adding or removing components was EXPLICITLY requested. Do not move or resize anything for a styling request. Never copy unrelated current player settings: leave those fields null. Reference typography and composition are already designed.
Joined tables, their common header and backdrop reflow together when you resize players. Do not add redundant individual moves to repair their seam. Smaller lettering keeps role-specific readability floors. To remove the big left information group, use visibility target branding=false (including its backdrop and crest). To hide only the table title strip use target player-header. You can still move components explicitly; their existing relationships are defaults, not fixed positions required for every hub.
Each five-player table requires width>=540 and height>=240 native pixels. Compact tables can be 550x250; do not use portrait/scoreboard dimensions. Resize target players changes BOTH tables; no extra movement is needed to keep them joined.
An extra operation can be {"op":"move","target":"scoreboards","dx":0,"dy":12} or {"op":"resize","target":"scoreboards","width":1000,"height":86}. Moves are relative pixels on a 1920x1080 canvas. Targets: scoreboards, players, portraits, texts, all, or a current layer ID.
Read EVERY clause of the instruction. Use native fixed fields for simple edits and style operations for richer component CSS. These can change together. Keep unrelated fields null. Never output markup, scripts, external URLs or unscoped CSS.
Field examples (partial decisions, the output must still contain ALL required fields):
"Only adjust the scoreboard padding" -> appearance colors/gradient/outline=null; all player settings=null; scoreboard statistics=null.
"Give the entire overlay a warm gradient and show the match clock" -> appearance.target=all; choose two warm gradient stops; scoreboard.showGameTime=true; other statistics=null.`;
