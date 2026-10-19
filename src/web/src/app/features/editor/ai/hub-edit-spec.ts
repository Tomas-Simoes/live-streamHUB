import Ajv from 'ajv';
import { APPEARANCE_FIELDS, AppearanceChange } from './hub-appearance';
import { AI_PALETTES, HUB_PLAN_SCHEMA, HubOperation, HubPlan, HubPlanError, parseModelJson } from './hub-plan';
import { HUB_DESIGN_RULES } from './hub-design-references';
import { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import type { HubIntent } from './hub-intent';
import { HUB_PART_STYLE_PROMPT, HUB_ALLOWED_STYLE_PROPERTIES } from './hub-part-style';

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

/** Request vocabulary limits capabilities, never supplies model answers or values.
 * Unrecognized instructions retain the full schema; explicit preservation clauses
 * are excluded. Both decoder and runtime enforce the same contract.
 */
export function editSchemaForInstruction(instruction: string, hub?: Hub, intent?: HubIntent) {
  if (intent) return semanticEditSchema(intent, hub);
  const text = instruction.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(/[.!?;\n]+|\bbut\b/).filter(clause => !/^\s*(keep|preserve|retain|leave|maintain|manter|mantem|mantenha|preserva|deixa)\b/.test(clause)).join(' ');
  const has = (pattern: RegExp) => pattern.test(text);
  const restyle = has(/\b(restyle|redesign|overhaul|makeover|redesenh\w*|remodel\w*|novo visual|new look)\b/);
  const gradient = restyle || has(/\b(gradients?|degrade|blend|fade|transicao)\b/);
  const outline = restyle || has(/\b(outlines?|borders?|edges?|lines?|contornos?|bordas?|linhas?|moldura)\b/);
  const fill = restyle || gradient || has(/\b(colou?rs|palette|theme|background|fill|surfaces?|colou?r scheme|cores|paleta|tema|fundo)\b/)
    || (!outline && has(/\b(navy|blue|purple|red|green|emerald|neon|coral|monochrome|steel|black|white|cream|charcoal|burgundy|azul|roxo|vermelho|verde|preto|branco|cinzento)\b|#[0-9a-f]{6}\b/));
  const padding = has(/\b(padding|insets?|margins?|margens|recuo)\b/);
  const objectives = has(/\b(objectives?|drakes?|dragons?|voidgrubs?|grubs?|herald|baron|objetivos?|dragoes|dragao|arauto)\b/);
  const gold = has(/\b(gold|ouro|economy|economia|currency|money)\b/);
  const clock = has(/\b(clock|game time|match time|timer|relogio|tempo de jogo|tempo da partida)\b/);
  const portraits = has(/\b(portraits?|champions?|retratos?|campeoes|campeao)\b/);
  const spacing = has(/\b(spacing|gaps?|espacamento|espacos?)\b/);
  const kda = has(/\b(kda|kills? deaths? assists?)\b/);
  const cs = has(/\b(cs|creep score|farm|minions)\b/);
  const items = has(/\b(items?|slots?|itens|inventario|inventory)\b/);
  const teamStats = has(/\b(all (team )?(stats|statistics|information)|team (stats|statistics)|estatisticas (das )?equipas|todas as estatisticas)\b/);
  const playerStats = has(/\b(all player (stats|statistics)|player (stats|statistics)|estatisticas (dos )?jogadores)\b/);
  const move = has(/\b(move|shift|reposition|higher|lower|above|below|mover|move\w*|desloc\w*|reposicion\w*|mais acima|mais abaixo|mais para cima|mais para baixo)\b/);
  const resize = has(/\b(resize|width|height|dimensions?|compact|wider|narrower|redimension\w*|largura|altura|dimensoes|compacto)\b/);
  const type = restyle || has(/\b(fonts?|typography|typeface|lettering|text size|uppercase|lowercase|tipografia|letras?|maiusculas?|minusculas?)\b/);
  const visibility = has(/\b(hide|show|visible|visibility|oculta\w*|escond\w*|mostra\w*|visibilidade)\b/);
  const add = has(/\b(add|insert|adicion\w*|inser\w*)\b.{0,24}\b(scoreboard|scorebug|rosters?|player panels?|placar|paineis)\b/);
  const remove = has(/\b(remove|delete|remov\w*|apag\w*)\b.{0,16}\b(scoreboard|scorebug|rosters?|player panels?|placar|paineis|layers?|camadas?)\b/);
  const teamCodes = has(/\b(team (codes?|names?)|codigos? (das )?equipas|nomes? (das )?equipas)\b/);
  if (![fill, gradient, outline, padding, objectives, gold, clock, portraits, spacing, kda, cs, items, teamStats, playerStats, move, resize, type, visibility, add, remove, teamCodes].some(Boolean)) return nativeResizeBounds(HUB_EDIT_SCHEMA, hub);
  const locked = { type: 'null' };
  const fields = (properties: Record<string, unknown>, allowed: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(properties).map(([key, schema]) => [key, allowed[key] ? schema : locked]));
  const operations = HUB_EDIT_SCHEMA.properties.operations;
  const allowedOps: Record<string, boolean> = { move, resize, typography: type, visibility, add, remove, scoreboard: teamCodes, style: true, decoration: restyle, text: teamCodes };
  const playerOnly = has(/\b(players?|tables?|rosters?|jogadores|tabelas|paineis de jogadores)\b/)
    && !has(/\b(scoreboards?|scorebug|placar|entire|whole|all layers|todo o hub)\b/);
  const choices = operations.items.oneOf.filter(op => allowedOps[op.properties.op.const]).map(op => {
    if (!playerOnly || !['move', 'resize', 'typography'].includes(op.properties.op.const)) return op;
    return { ...op, properties: { ...op.properties, target: { enum: ['players', 'portraits',
      ...(hub?.layers.filter(layer => layer.type === LayerType.LolPlayerRoster).map(layer => layer.id) ?? [])] } } };
  });
  return nativeResizeBounds(object({
    ...HUB_EDIT_SCHEMA.properties,
    palette: fill ? HUB_EDIT_SCHEMA.properties.palette : locked,
    appearance: object({ target: HUB_EDIT_SCHEMA.properties.appearance.properties.target,
      ...fields(Object.fromEntries(Object.entries(HUB_EDIT_SCHEMA.properties.appearance.properties).filter(([key]) => key !== 'target')),
        { backgroundColor: fill, gradientTo: gradient, gradientDirection: gradient, borderColor: outline, borderWidth: outline }) }),
    scoreboard: object(fields(HUB_EDIT_SCHEMA.properties.scoreboard.properties,
      { paddingX: padding, showObjectives: objectives || teamStats, showGold: gold || teamStats, showGameTime: clock || teamStats })),
    players: object(fields(HUB_EDIT_SCHEMA.properties.players.properties,
      { portraitSize: portraits, gap: spacing, showChampion: portraits || playerStats, showKda: kda || playerStats,
        showCs: cs || playerStats, showGold: gold || playerStats, showItems: items || playerStats })),
    operations: choices.length ? { ...operations, items: { oneOf: choices } } : { ...operations, maxItems: 0 },
  }), hub);
}

/** Scope permissions from the interpreted brief, independent of user vocabulary. */
function semanticEditSchema(intent: HubIntent, hub?: Hub) {
  if (intent.changes.some(change => change.aspect === 'other')) return nativeResizeBounds(HUB_EDIT_SCHEMA, hub);
  const schema: any = structuredClone(HUB_EDIT_SCHEMA);
  const has = (...aspects: string[]) => intent.changes.some(change => aspects.includes(change.aspect));
  const playerHas = (...aspects: string[]) => intent.changes.some(change => ['players', 'all'].includes(change.target) && aspects.includes(change.aspect));
  const lock = (group: string, fields: Record<string, boolean>) => {
    for (const [key, allowed] of Object.entries(fields)) if (!allowed) schema.properties[group].properties[key] = { type: 'null' };
  };
  if (!intent.changes.some(change => change.aspect === 'fill' && change.target === 'all')) schema.properties.palette = { type: 'null' };
  const appearanceTargets = [...new Set(intent.changes.filter(change => ['fill', 'gradient', 'outline'].includes(change.aspect))
    .map(change => change.target === 'team-sections' ? 'scoreboards' : change.target).filter(target => ['all', 'scoreboards', 'players'].includes(target)))];
  if (appearanceTargets.length) schema.properties.appearance.properties.target = { enum: appearanceTargets };
  lock('appearance', { backgroundColor: has('fill'), gradientTo: has('gradient'), gradientDirection: has('gradient'), borderColor: has('outline'), borderWidth: has('outline') });
  lock('scoreboard', { paddingX: has('padding'), showObjectives: has('objectives'), showGold: has('gold'), showGameTime: has('clock') });
  lock('players', { portraitSize: has('portraits'), gap: has('spacing'), showChampion: has('player-data', 'portraits'), showItems: has('player-data', 'items'), showCs: has('player-data'), showKda: has('player-data'), showGold: has('player-data', 'gold') });
  const permitted: Record<string, boolean> = { move: has('position'), resize: has('size'), visibility: has('visibility'), typography: has('typography'),
    add: has('components'), remove: has('components'), scoreboard: has('team-codes'), 'team-fill': has('gradient'), 'roster-design': playerHas('items', 'portraits', 'separators', 'typography'),
    style: has('fill', 'gradient', 'outline', 'padding', 'typography', 'portraits', 'items', 'separators', 'spacing', 'position', 'size'), decoration: has('components'), text: has('components') };
  if (intent.changes.filter(change => change.aspect === 'typography').every(change => ['smaller-text', 'larger-text'].includes(change.check))) permitted['typography'] = false;
  schema.properties.operations.items.oneOf = schema.properties.operations.items.oneOf.filter((op: any) => permitted[op.properties.op.const]).map((op: any) => {
    const operationAspects: Record<string, string> = { move: 'position', resize: 'size', typography: 'typography', visibility: 'visibility' };
    const relevant = intent.changes.filter(change => operationAspects[op.properties.op.const] === change.aspect);
    if (relevant.length && op.properties.target) {
      const targets = [...new Set(relevant.map(change => change.target === 'team-sections' ? 'scoreboards' : change.target))];
      op.properties.target = { enum: targets };
    }
    if (op.properties.op.const === 'team-fill') op.properties.target = { enum: ['scoreboards'] };
    if (op.properties.op.const === 'roster-design') {
      op.properties.target = { enum: ['players'] };
      for (const key of Object.keys(op.properties)) {
        const allowed = ['op', 'target'].includes(key) || (key === 'separatorWidth' ? playerHas('separators') : ['nameSize', 'statSize', 'kdaSize'].includes(key) ? playerHas('typography') : playerHas('portraits', 'items'));
        if (!allowed) delete op.properties[key];
      }
    }
    if (op.properties.op.const === 'style') {
      const categories = (property: string) => {
        if (property.startsWith('--hub-')) return ['fill'];
        if (/^font|letter-spacing|line-height|text-/.test(property)) return ['typography'];
        if (/^background/.test(property)) return ['fill', 'gradient'];
        if (/border|shadow|clip-path/.test(property)) return ['outline', 'separators'];
        if (/padding|margin/.test(property)) return ['padding', 'spacing'];
        if (/gap/.test(property)) return ['spacing'];
        if (property === 'color') return ['fill', 'typography'];
        if (/width|height/.test(property)) return ['size', 'portraits', 'items'];
        return ['position', 'size'];
      };
      const styleChanges = intent.changes.filter(change => categories('background').concat(categories('font-family'), ['outline', 'padding', 'spacing', 'position', 'size', 'portraits', 'items', 'separators']).includes(change.aspect));
      const targets = [...new Set(styleChanges.map(change => change.target === 'team-sections' ? 'scoreboards' : change.target))];
      op.properties.target = { enum: [...targets, ...(hub?.layers.filter(layer => targets.some(target => target === 'all' || target === 'scoreboards' && layer.type === LayerType.LolScorebug || target === 'players' && layer.type === LayerType.LolPlayerRoster)).map(layer => layer.id) ?? [])] };
      const keepFamily = intent.preserve.some(note => /font|typeface|lettering/i.test(note));
      op.properties.rules.items.properties.declarations.items.properties.property.enum = HUB_ALLOWED_STYLE_PROPERTIES.filter(property => categories(property).some(aspect => has(aspect)) && !(keepFamily && property === 'font-family'));
    }
    return op;
  });
  if (!schema.properties.operations.items.oneOf.length) schema.properties.operations = { type: 'array', maxItems: 0, items: {} };
  return nativeResizeBounds(schema, hub);
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
