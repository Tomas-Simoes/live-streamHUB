import Ajv from 'ajv';
import { parse as parseCss } from 'postcss';
import { Hub } from '../../../shared/types/hub.types';
import { EditorLayer, LayerType } from '../../../shared/types/layer.types';
export { createBroadcastScaffold } from './hub-scaffold';
import { authoredCss, validateAuthoredCss, cssChangesOutside } from '../../../shared/helpers/authored-css';
import { rosterFields, nativeRosterTracks } from '../../../shared/helpers/roster-fields';
import { HUB_PLAN_SCHEMA, HubPlan, HubPlanError, LayoutIssue, parseModelJson } from './hub-plan';
import { hubTargetInventory, matchesHubTarget as matches } from './hub-targets';
import { HubRequirement, REQUIREMENTS_SCHEMA, normalizedQuote } from './hub-request-checks';

const text = { type: 'string', minLength: 1 };
const strings = { type: 'array', maxItems: 6, items: text };
export type DesignBrief = {
  summary: string; goals: string[]; targets: string[]; preserve: string[]; preferences: string[];
  functionalRequirements: string[]; scope: 'broad' | 'targeted'; unresolved: string[];
  designPlan?: { identity: string; composition: string; typography: string; playerRows: string };
  requirements?: HubRequirement[];
  constraints: { target: string; aspect: 'all' | 'geometry' | 'typography' | 'content' | 'visibility' | 'only-css'; request: string; selector?: string; properties?: string[] }[];
};
export const DESIGN_BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'goals', 'targets', 'preserve', 'preferences', 'functionalRequirements', 'scope', 'constraints', 'unresolved'],
  properties: {
    requirements: REQUIREMENTS_SCHEMA,
    designPlan: { type: 'object', additionalProperties: false, required: ['identity', 'composition', 'typography', 'playerRows'],
      properties: { identity: text, composition: text, typography: text, playerRows: text } },
    summary: text, goals: strings, targets: strings, preserve: strings, preferences: strings, functionalRequirements: strings,
    scope: { enum: ['broad', 'targeted'] }, unresolved: strings,
    constraints: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false, required: ['target', 'aspect', 'request'],
      properties: { target: text, aspect: { enum: ['all', 'geometry', 'typography', 'content', 'visibility', 'only-css'] }, request: text, selector: { type: 'string' }, properties: strings } } },
  },
};
const validateBrief = new Ajv({ allErrors: true, strict: false }).compile(DESIGN_BRIEF_SCHEMA);
export function parseDesignBrief(raw: string, instruction: string): DesignBrief {
  const value = parseModelJson(raw);
  if (!validateBrief(value)) throw new Error('Return a complete design brief with goals, targets, preservation constraints and preferences.');
  const result = value as DesignBrief;
  for (const requirement of result.requirements ?? []) {
    if (!normalizedQuote(instruction).includes(normalizedQuote(requirement.quote))) throw new Error(`Requirement must quote the user's actual words: ${requirement.quote}`);
  }
  // Constraints are evidence-backed user decisions, never inferred style permissions.
  const normalize = (value: string) => value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  for (const constraint of result.constraints) {
    if (!normalize(instruction).includes(normalize(constraint.request))) throw new Error(`Preservation constraint must quote the user: ${constraint.request}`);
    if (constraint.aspect === 'only-css' && (!constraint.selector || !constraint.properties?.length)) throw new Error('An explicit only-css boundary needs a semantic selector and the requested CSS properties.');
  }
  return result;
}

export const DESIGN_BRIEF_PROMPT = `Interpret a user's League of Legends broadcast design request and propose a concrete implementation plan. Return JSON, not CSS. Aim for 700-1100 tokens: requirements first, four short designPlan decisions, one summary, 1-4 goals and empty unspecified arrays.
requirements preserves EACH explicit requested relationship, colour and layout detail. quote is an exact phrase from the user's text, never your paraphrase. Split different checks into separate records. Never replace specific instructions with "professional" or "balanced". target is an existing alias/ID; selector is scoped CSS using actual data-component-part attributes. measure is a measurement capability, NOT a styling permission: visual for anything not objectively checkable, gradient for visible gradient presence, widthFraction for width/canvas (value="0.5" for half), largerThan for image dimensions compared to reference selector, above/below for element placement relative to reference selector, color for a hue-family check (value=interpreted #RRGGBB, reference="text" or "fill"). Unused selector/reference/value are empty strings. For gradient direction, subtlety or aesthetic quality, retain an additional visual requirement. For portraits vs items, select [data-component-part="portrait"] and reference [data-component-part="item"]. For CS above KDA use selector [data-component-part="cs"], reference [data-component-part="kda"], measure=above. For team fills use [data-component-part="blue-team"] or red-team. Keep the chosen colour faithful: teal is not cyan and burnt orange is not vivid orange. Do not invent numeric ratios the user never specified, except 5% as the minimum test for "slightly larger". Keep all goals, including novel requests with measure=visual.
designPlan comes first: identity chooses concrete colour/surface relationships consistent with the user's palette; composition chooses component proportions and alignment; typography chooses a legible hierarchy; playerRows explains field grouping, six equipment icons and placement of EVERY actual rowField including level. Use the supplied component structure. For targeted edits, leave unrelated decisions as "retain current". These are proposed design decisions, not additional user constraints or proof of visual quality. They do not restrict available CSS properties. Do not invent missing widgets or claim a plan has already been rendered.
Describe goals, explicit targets, explicit visual preferences, functional requirements, preservation notes and scope. Understand ordinary/imperfect language. A broad request permits coordinated artistic decisions. A precise request should retain unrelated details. Do not invent a preferred aesthetic or require users to name CSS properties.
All CSS and structural capabilities remain available regardless of this brief. targets are context, never an operation whitelist. Use aliases from the supplied availableTargets, never invent aliases or enumerate every layer ID. Creation/overall redesign uses targets=["all"]. Use an ID only when a specific additional layer is explicitly targeted.
constraints contain ONLY explicit things to preserve. Quote the original phrase in request. aspect=all protects the entire target; geometry protects position/dimensions; typography protects its type; content protects data/media/text; visibility protects existing visibility. For "only change player tables; keep scoreboard unchanged", protect scoreboards/all. For an explicit narrow CSS-only edit, only-css protects EVERYTHING except its selector/properties on the stated target: e.g. target=all, aspect=only-css, selector=[data-component-part="name"], properties=["font-family"] for "only change the player names' font". Properties/selectors are free CSS, not style categories. Use only-css only for explicit ONLY requests, never for a broad request that needs coordinated changes. Do not add a preservation rule that conflicts with a requested modification. preserve may express finer constraints not covered by those aspects; they stay instructions to the designer.
scope=broad for overall redesign/creation, targeted for specific edits. goals/preferences are free natural-language descriptions, not categories. unresolved lists genuinely missing functionality such as a new data feed or webcam; CSS styles and novel themes are supported. If the user did not ask to preserve anything, preserve=[] and constraints=[]. A NEW design has no existing geometry or visibility to preserve. Keep the brief concise.`;

const structural = HUB_PLAN_SCHEMA.properties.operations.items.oneOf.filter(operation =>
  ['frame', 'move', 'resize', 'decoration', 'text', 'scoreboard', 'players', 'visibility', 'add', 'remove'].includes(operation.properties.op.const)).map(operation => {
    if (!['scoreboard', 'players'].includes(operation.properties.op.const)) return operation;
    const result = structuredClone(operation);
    for (const key of ['blueTeamCode', 'redTeamCode', 'portraitSize', 'gap']) delete (result.properties as any)[key];
    return result;
  });
export const HUB_DESIGN_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'styles', 'operations'],
  properties: {
    summary: { type: 'string', maxLength: 360 },
    styles: { type: 'array', maxItems: 16, items: { type: 'object', additionalProperties: false, required: ['target', 'mode', 'css'], properties: {
      target: text, mode: { enum: ['patch', 'replace'] }, css: { type: 'string', maxLength: 24000 },
    } } },
    operations: { type: 'array', maxItems: 16, items: { oneOf: structural } },
  },
};
const validateResponse = new Ajv({ allErrors: true, strict: false }).compile(HUB_DESIGN_RESPONSE_SCHEMA);

/** Limits resource references to real/creatable layers, never presentation properties. */
export function designTargetSchema(hub: Hub) {
  const inventory = hubTargetInventory(hub.layers);
  return { anyOf: [
    { enum: [...new Set([...Object.keys(inventory.aliases), ...inventory.ids, 'all', 'scoreboards', 'players', 'blue-players', 'red-players'])] },
    { type: 'string', pattern: '^ai-decoration-[a-z][a-z0-9-]{0,30}$' },
  ] };
}
export function designResponseSchema(hub: Hub): Record<string, any> {
  const schema: Record<string, any> = structuredClone(HUB_DESIGN_RESPONSE_SCHEMA);
  schema['properties'].styles.items.properties.target = designTargetSchema(hub);
  for (const operation of schema['properties'].operations.items.oneOf) if (operation.properties.target) operation.properties.target = designTargetSchema(hub);
  return schema;
}
export function designBriefSchema(hub: Hub): Record<string, any> {
  const schema: Record<string, any> = structuredClone(DESIGN_BRIEF_SCHEMA);
  // Older diagnostics remain readable, while new decoder output must contain
  // concrete design decisions before the CSS generation request.
  schema.required = ['requirements', 'designPlan', ...schema.required];
  const inventory = hubTargetInventory(hub.layers);
  const target = { enum: [...new Set(['all', ...Object.keys(inventory.aliases), ...inventory.ids])] };
  schema['properties'].targets = { ...schema['properties'].targets, items: target };
  schema['properties'].constraints.items.properties.target = target;
  schema['properties'].requirements.items.properties.target = target;
  return schema;
}
export function parseDesignResponse(raw: string, mode: 'create' | 'edit'): HubPlan {
  const value = parseModelJson(raw) as { summary: string; styles: { target: string; mode: 'patch' | 'replace'; css: string }[]; operations: HubPlan['operations'] };
  if (!validateResponse(value)) throw new HubPlanError([{ code: 'schema', layerIds: [], message: (validateResponse.errors ?? []).slice(0, 4).map(error => `${error.instancePath} ${error.message}`).join('; ') }]);
  if (!value.styles.length && !value.operations.length) throw new HubPlanError([{ code: 'no-change', layerIds: [], message: 'Return CSS or structural changes implementing the instruction.' }]);
  try { for (const style of value.styles) validateAuthoredCss(style.css); }
  catch (error) { throw new HubPlanError([{ code: 'style', layerIds: [], message: error instanceof Error ? error.message : String(error) }]); }
  return { template: mode === 'create' ? 'ai-authored' : 'current', authored: true, summary: value.summary,
    operations: [...value.operations, ...value.styles.map(style => ({ op: 'css' as const, ...style }))] };
}

export const HUB_STYLING_CONTRACT = `This is a 1920x1080 broadcast overlay over gameplay, not a website. Functional native widgets retain all live bindings. Layer coordinates are CENTER coordinates. Reusable components: a two-team scoreboard and two five-player tables, each player containing a champion portrait and a strip of SIX individual equipment icons. Optional flags control data visibility; static decorations must never replace live numbers.
CSS targets: use availableTargets in the supplied context or an actual layer ID. Optional headers/branding exist ONLY when listed. A shared header is not an implicit widget: create a text decoration if wanted, then style its ai-decoration-KEY ID and [data-component-part="text"]. A plain text decoration has no h2 element. Each stylesheet is scoped to its target layer(s). & is the layer root; descendants use stable [data-component-part="..."] selectors. Selectors may use classes, attributes, combinators inside the layer, :is(), :nth-child(), and ::before/::after. No surrounding editor DOM is exposed.
Scoreboard semantic tree: .scorebug (surface) > blue-team, center, red-team, blue-objectives, red-objectives. Team section > blue/red-logo, .team-lockup > blue/red-code and blue/red-seed, blue/red-gold, blue/red-towers. center > blue-kills, .score-divider, red-kills, clock. These unprefixed names are data-component-part VALUES, NEVER class names: use [data-component-part="blue-gold"], [data-component-part="clock"], [data-component-part="blue-code"]. .blue-gold, .clock, .blue-code and .roster-cs do not exist. Use [data-component-part="cs"] for CS. Objectives contain dragons, voidgrubs and herald. Names and values remain native bindings.
Table tree: .player-roster[data-team="blue|red"] > [data-component-part="row"][data-player-role="top|jungle|mid|adc|support"] x5. Each row contains items > item x6 > img; portrait > img; level; name; cs; kda; gold if enabled. Context rowFields is the ACTUAL visible order; account for every field when authoring tracks. Red ordering is mirrored initially. There is no .roster-row.red class: target red-players or .player-roster[data-team="red"]. item=ONE icon; items=the ENTIRE six-icon strip. CSS grid/flex/order can change internal organization freely. .text-layer is decorative text, img is existing media.
Any browser-supported CSS property/value is available for presentation, including custom variables, gradients, layout, typography, masks without resources, clipping, shadows, pseudo elements and local keyframes. Variables are authored by you; define them before use. Fonts use available system faces or existing installed fonts; no remote imports. No URLs, scripts, markup, external resources or selectors escaping a layer. @media/@supports/@container/@layer and local @keyframes are supported; flatten nested selectors. Root frame width/height/position/transform use frame/move/resize operations so editor handles match exports. Internal dimensions/position/transform are CSS.
CSS px mean native canvas units, scaled with each layer. Percentage grid tracks plus gaps must fit available space. Retain legible match data at 720p. A compact component still contains all its data, not one row. Keep the request's explicit constraints; do not apply unrelated artistic changes. There is no compulsory palette, font, geometry or prepared visual reference.`;

export const HUB_DESIGN_PROMPT = `You author a League broadcast hub's visual design. Return ONLY JSON: {summary,styles:[{target,mode,css}],operations:[]}.
${HUB_STYLING_CONTRACT}
Choose a coherent identity from the actual request and carry its relationships across the relevant components. A vague request permits design judgment; a specific edit preserves unrelated content and styling. Your CSS owns the artistic decisions; the application supplies no keyword-based treatments. Reference CSS demonstrates structure and craftsmanship: do NOT copy its colours or identity when the user requests different ones. The final user instruction takes priority over all reference values.
Implement EVERY explicit requirement in the brief and original request. Do not merely recolour the scaffold: use frame operations and internal CSS grid/flex when proportions/grouping are requested. Check all quoted requirements against the CSS you are returning. Visual requirements remain obligations even when no automatic measurement exists. Small examples illustrate techniques, never a default answer. Do not invent selectors; prefer the documented data-component-part attributes.
Creation: style the supplied neutral scaffold using original CSS; arrange its components if appropriate. Editing: use mode=patch to change only relevant declarations; unrelated rules remain. mode=replace clears a target's entire old custom CSS, including earlier styles in the same proposal, so use it only for an explicitly complete target redesign. After styling all, specialize individual components with patch rather than clearing the shared foundation again. Empty replace CSS clears custom CSS intentionally. Declare all variables you reference. A CSS patch is a normal complete selector block, not a diff format. Keep output concise by grouping selectors; do not repeat defaults.
Structural operations: frame {target,x,y,width,height} sets absolute native geometry; move {target,dx,dy}; resize {target,width,height}; visibility {target,visible}; text {target,text}; decoration {key,kind:shape|text,x,y,width,height,text?}; scoreboard {target,showGold?,showObjectives?,showGameTime?}; players {target,showChampion?,showItems?,showCs?,showKda?,showGold?}; add {component:scoreboard|players}; remove {target}. New decorations have ID ai-decoration-KEY. Geometry and text use operations; all visual decisions use styles. Never rename a team because of a colour instruction. Preserve data sources/roles/teams. Keep a short summary describing actual design choices, not an explanation of every CSS line.`;

export const HUB_REPAIR_PROMPT = `Repair the supplied broadcast candidate. Return ONLY complete JSON: {"summary":"Short repair summary","styles":[{"target":"players","mode":"patch","css":"selector{property:value}"}],"operations":[]}.
The application RETAINS the entire candidate. Return ONLY the few declarations needed to fix the reported failures, not a repeated design or stylesheet. Aim below 600 output tokens. Keep its visual identity, explicit user constraints and all live bindings. No reference copying or unrelated restyling. previousPatch already failed: do not repeat it. When implicitWrap=true, fix the containing row grid AND stale field placements. An image width cannot enlarge a clipped .item-slot or its .roster-items strip. rowLayouts.items gives slot, image and actually visible sizes. --roster-tracks is the renderer's valid grid for CURRENT fields; it is available as a starting point, not a mandatory layout.
Targets: layer ID, scoreboards, players, blue-players, red-players, all. CSS is scoped to each layer; & is its root. [data-component-part="row|items|item|portrait|level|name|cs|kda|gold"] are table parts. items is a SIX-icon strip; item is one icon. A row has every visible field in context.rowFields, including level when enabled. Account for EVERY field in grid tracks or explicit placements; five columns do not automatically fit six fields. Mirrored tables may need different tracks. Target red-players, not .roster-row.red. Use normal selector blocks; arbitrary valid presentation CSS is available. Define any custom variables you use. No URLs, imports or global selectors. CSS px are native 1920x1080 units. measurements.rowLayouts field widths/heights are native units; grid is computed CSS track sizes. Root geometry uses operations: frame {target,x,y,width,height} (center coordinates), move {target,dx,dy}, resize {target,width,height}. Do not hide or replace live information to pass a check. Empty operations is appropriate for CSS-only repairs.`;

export function designContext(hub: Hub, brief?: DesignBrief, cssBudget = 10500) {
  const cssById = new Map<string, { css: string; omittedCssCharacters?: number }>();
  const selected = (layer: EditorLayer) => !brief || brief.scope === 'broad' || !brief.targets.length || brief.targets.some(target => matches(layer, target));
  const compact = (source: string) => {
    try { const tree = parseCss(source); tree.walkComments(comment => { comment.remove(); });
      tree.walk(node => { node.raws.before = ''; if (node.type === 'decl') node.raws.between = ':'; if (node.type === 'rule' || node.type === 'atrule') node.raws.between = ''; });
      return tree.toString();
    } catch { return source; }
  };
  const relevant = hub.layers.filter(selected);
  for (let index = 0; index < relevant.length; index++) {
    const layer = relevant[index], source = compact(layer.style?.customCss ?? '');
    const allowance = Math.max(0, Math.floor(cssBudget / (relevant.length - index)));
    if (source.length <= allowance) { cssById.set(layer.id, { css: source }); cssBudget -= source.length; }
    else {
      // Complete rules only. Unseen declarations stay untouched by normal patches.
      const included: string[] = []; let used = 0;
      try { for (const node of parseCss(source).nodes) { const rule = node.toString(); if (used + rule.length <= allowance) { included.push(rule); used += rule.length; } } } catch { /* Invalid manual drafts are omitted, never silently repaired. */ }
      cssById.set(layer.id, { css: included.join(''), omittedCssCharacters: source.length - used }); cssBudget -= used;
    }
  }
  return { canvas: [1920, 1080], availableTargets: hubTargetInventory(hub.layers).aliases, coordinates: 'centers; px are native units', cssContext: 'Relevant complete rules within local context budget. Omitted rules are preserved by patches; never claim they were reviewed.', layers: hub.layers.slice(0, 48).map(layer => ({
    id: layer.id, type: layer.type, name: layer.name, visible: layer.visible, x: layer.position.x, y: layer.position.y, width: layer.width, height: layer.height,
    style: layer.style ? { ...layer.style, customCss: undefined } : undefined,
    ...(cssById.get(layer.id) ?? { css: undefined, cssNotRequested: !!layer.style?.customCss }),
    ...(layer.type === LayerType.Text ? { text: layer.text, font: layer.fontFamily, size: layer.fontSize } : {}),
    ...(layer.type === LayerType.LolScorebug ? { teams: [layer.blueTeamCode, layer.redTeamCode], showGold: layer.showGold, showObjectives: layer.showObjectives, showGameTime: layer.showGameTime, partStyles: layer.partStyles } : {}),
    ...(layer.type === LayerType.LolPlayerRoster ? { team: layer.team, orientation: layer.orientation, rowFields: rosterFields(layer), defaultTracks: nativeRosterTracks(layer), showChampion: layer.showChampion, showLevel: layer.showLevel, showItems: layer.showItems, showCs: layer.showCs, showKda: layer.showKda, showGold: layer.showGold, partStyles: layer.partStyles } : {}),
  })) };
}

export function designConstraintIssues(brief: DesignBrief | undefined, before: Hub, after: Hub): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  for (const constraint of brief?.constraints ?? []) {
    const selected = before.layers.filter(layer => matches(layer, constraint.target));
    if (!selected.length) { issues.push({ code: 'intent', layerIds: [], message: `Unknown protected target ${constraint.target}. Resolve its actual layer ID.` }); continue; }
    const extra = after.layers.filter(layer => matches(layer, constraint.target) && !before.layers.some(old => old.id === layer.id));
    if (['all', 'only-css'].includes(constraint.aspect) && extra.length) issues.push({ code: 'design-preservation', layerIds: extra.map(layer => layer.id), message: `Do not add layers to protected ${constraint.target}: ${constraint.request}` });
    const snapshot = (layer: EditorLayer) => {
      if (constraint.aspect === 'all') return layer;
      if (constraint.aspect === 'geometry') return [layer.position, layer.width, layer.height];
      if (constraint.aspect === 'visibility') return layer.visible;
      if (constraint.aspect === 'content') return Object.fromEntries(Object.entries(layer).filter(([key]) => !['style', 'position', 'width', 'height', 'partStyles', 'visible', 'name'].includes(key)));
      const declarations: string[] = [];
      const css = parseCss(layer.style?.customCss ?? '');
      css.walkDecls(declaration => { if (/^(?:font|letter-spacing|line-height|text-)/.test(declaration.prop)) declarations.push(`${(declaration.parent as any).selector}:${declaration.toString()}`); });
      return [(layer as any).fontFamily, (layer as any).fontSize, (layer as any).partStyles, declarations.sort()];
    };
    for (const old of selected) {
      const next = after.layers.find(layer => layer.id === old.id);
      if (constraint.aspect === 'only-css') {
        const withoutCss = (layer: EditorLayer) => ({ ...layer, style: { ...layer.style, customCss: undefined } });
        if (!next || JSON.stringify(withoutCss(old)) !== JSON.stringify(withoutCss(next))) issues.push({ code: 'design-preservation', layerIds: [old.id], message: `Only CSS ${constraint.selector} / ${constraint.properties?.join(', ')} may change; preserve other layer data and geometry.` });
        else {
          const outside = cssChangesOutside(old.style?.customCss ?? '', next.style?.customCss ?? '', constraint.selector!, constraint.properties!);
          if (outside.length) issues.push({ code: 'design-preservation', layerIds: [old.id], message: `Only change ${constraint.selector} / ${constraint.properties?.join(', ')}. Unrelated CSS changed: ${outside.slice(0, 4).join('; ')}` });
        }
        continue;
      }
      if (!next || JSON.stringify(snapshot(old)) !== JSON.stringify(snapshot(next))) issues.push({ code: 'design-preservation', layerIds: [old.id], message: `Preserve ${constraint.aspect} on ${constraint.target}: ${constraint.request}` });
    }
  }
  return issues;
}

export function functionalDesignIssues(before: Hub, after: Hub, mode: 'create' | 'edit'): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  if (!after.layers.some(layer => layer.visible && layer.type === LayerType.LolScorebug)) issues.push({ code: 'scoreboard', layerIds: [], message: 'Retain a functional visible scoreboard.' });
  for (const team of ['blue', 'red']) if (!after.layers.some(layer => layer.visible && layer.type === LayerType.LolPlayerRoster && layer.team === team)) issues.push({ code: 'roster', layerIds: [], message: `Retain a functional visible five-player ${team} table.` });
  if (mode === 'edit') for (const old of before.layers) {
    const next = after.layers.find(layer => layer.id === old.id);
    if (!next) continue;
    for (const key of ['team', 'role', 'playerOverrides', 'teamStats', 'src', 'blueTeamCode', 'redTeamCode'] as const) if (JSON.stringify((old as any)[key]) !== JSON.stringify((next as any)[key])) issues.push({ code: 'content', layerIds: [old.id], message: `Styling cannot change native data/media binding ${key}.` });
  }
  return issues;
}
