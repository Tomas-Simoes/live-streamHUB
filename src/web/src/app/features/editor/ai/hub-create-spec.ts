import Ajv from 'ajv';
import { HUB_PLAN_SCHEMA, HubOperation, HubPlan, HubPlanError, LayoutIssue, parseModelJson } from './hub-plan';
import { HUB_DESIGN_RULES } from './hub-design-references';
import { HUB_COMPOSITION_SCHEMA, HubComposition, compositionColors } from './hub-composition';
import { contrastRatio } from './hub-design-guard';
import { HUB_PART_STYLE_PROMPT } from './hub-part-style';
import type { HubIntent } from './hub-intent';

// The model describes independent design decisions, never selects a template.
// Geometry and typography have one source of truth: design. Additional native
// operations cannot resize every layer (including each five-player table) to the
// dimensions of a scorebug, or override the chosen font hierarchy.
const creationTargets: Record<string, string[]> = {
  appearance: ['all', 'scoreboards', 'players', 'texts'],
  move: ['scoreboards', 'players', 'blue-players', 'red-players'],
  resize: ['scoreboards', 'players', 'blue-players', 'red-players', 'branding', 'player-header'],
  scoreboard: ['scoreboards'], players: ['players', 'portraits'],
  'team-fill': ['scoreboards'], 'roster-design': ['players'],
  visibility: ['scoreboards', 'players', 'portraits', 'texts', 'branding', 'player-header'],
  remove: ['scoreboards', 'players', 'portraits', 'texts', 'branding', 'player-header'],
  style: ['all', 'scoreboards', 'players', 'blue-players', 'red-players', 'texts', 'branding', 'player-header'],
  decoration: [], text: ['texts', 'player-header'],
};
// Newly generated designs declare this choice; older saved compositions retain
// their accent-rail appearance when the field is absent.
const creationDesign = structuredClone(HUB_COMPOSITION_SCHEMA);
creationDesign.properties.panels.required.push('teamSections');
creationDesign.properties.panels.required.push('rows', 'headerAccent');
creationDesign.properties.typography.required.push('nameFont');
creationDesign.properties.layout.required.push('rosterWidth');
export const HUB_CREATE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['design', 'operations'],
  properties: {
    design: creationDesign,
    operations: { type: 'array', maxItems: 12, items: { oneOf: HUB_PLAN_SCHEMA.properties.operations.items.oneOf
      .filter(op => creationTargets[op.properties.op.const])
      .flatMap(op => op.properties.op.const === 'resize' ? [
        { ...op, properties: { ...op.properties, target: { enum: ['players', 'blue-players', 'red-players'] }, width: { type: 'number', minimum: 540, maximum: 1920 }, height: { type: 'number', minimum: 240, maximum: 1080 } } },
        { ...op, properties: { ...op.properties, target: { enum: ['scoreboards'] }, width: { type: 'number', minimum: 800, maximum: 1920 }, height: { type: 'number', minimum: 76, maximum: 1080 } } },
        { ...op, properties: { ...op.properties, target: { enum: ['branding', 'player-header'] } } },
      ] : [op.properties.op.const === 'decoration' ? op : ({ ...op, properties: { ...op.properties,
        target: op.properties.op.const === 'style' ? { type: 'string', minLength: 1, maxLength: 100 } : { enum: creationTargets[op.properties.op.const] } } })]) } },
  },
};
const validate = new Ajv({ allErrors: true, strict: false }).compile(HUB_CREATE_SCHEMA);
export function compositionSchemaForInstruction(instruction: string, intent?: HubIntent): Record<string, unknown> {
  const text = instruction.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const explicitDimensions = /\b\d{3,4}\s*(?:by|x|×)\s*\d{2,3}\b|\b(?:width|wide|largura)\D{0,8}\d{3,4}\b/.test(text);
  const schema = structuredClone(HUB_CREATE_SCHEMA);
  if (/\b(compact|compacto|compacta)\b/.test(text) && !explicitDimensions) {
    schema.properties.design.properties.layout.properties.scoreboardWidth.maximum = 1100;
    schema.properties.design.properties.layout.properties.scoreboardHeight.maximum = 100;
  }
  // Most creation instructions describe the design, rather than editing its
  // constituent layers. Do not offer imperative edits for these descriptions.
  if (!/\b(move|shift|reposition|padding|insets?|margins?|hide|without|remove|disable|rename|bigger|larger|spacing|gap|mover|desloc\w*|reposicion\w*|ocult\w*|escond\w*|sem|remov\w*|desativ\w*|aument\w*|espacamento)\b/.test(text)) {
    schema.properties.operations.items.oneOf = schema.properties.operations.items.oneOf.filter(op => ['style', 'decoration', 'text'].includes(op.properties.op.const));
  }
  for (const op of schema.properties.operations.items.oneOf) if (op.properties.op.const === 'scoreboard'
    && !intent?.changes.some(change => change.aspect === 'team-codes')) {
    delete (op.properties as any).blueTeamCode; delete (op.properties as any).redTeamCode;
  }
  return schema;
}
export function parseHubCreateSpec(raw: string, schema: Record<string, unknown> = HUB_CREATE_SCHEMA): HubPlan {
  const value = parseModelJson(raw);
  const validator = schema === HUB_CREATE_SCHEMA ? validate : new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validator(value)) throw new HubPlanError((validator.errors ?? []).slice(0, 8).map(e => ({ code: 'schema', layerIds: [], message: `${e.instancePath} ${e.message}` })));
  const spec = value as { design: HubComposition; operations: HubOperation[] };
  validateCompositionContrast(spec.design);
  return { template: 'ai-composed', design: spec.design, operations: spec.operations };
}
export function validateCompositionContrast(design: HubComposition) {
  const colors = design.colors;
  const surfaces = compositionColors(colors);
  const issues = [];
  for (const [role, minimum] of [['text', 4.5], ['muted', 3], ['teamLeft', 3], ['teamRight', 3]] as const) {
    const foreground = role === 'teamLeft' ? surfaces.blue : role === 'teamRight' ? surfaces.red : surfaces[role];
    if ([surfaces.surface, surfaces.surfaceDeep, surfaces.ink].some(surface => contrastRatio(foreground, surface)! < minimum)) {
      issues.push({ code: 'contrast', layerIds: [], path: `design.colors.${role}`, message: `${role} (${colors[role]}) needs ${minimum}:1 contrast against the derived backgrounds. Adjust this foreground color, keeping its requested hue. Keep the chosen background, typography and layout.` });
    }
  }
  if (issues.length) throw new HubPlanError(issues);
}

/** A contrast repair may change failing foregrounds, not redesign a valid brief. */
export function compositionRepairSchema(raw: string, issues: LayoutIssue[], base: Record<string, unknown> = HUB_CREATE_SCHEMA): Record<string, unknown> {
  if (!issues.length || issues.some(issue => issue.code !== 'contrast' || !issue.path?.startsWith('design.colors.'))) return base;
  const value = parseModelJson(raw) as { design: HubComposition; operations: HubOperation[] };
  const editable = new Set(issues.map(issue => issue.path));
  const lock = (schema: any, current: any, path: string): any => {
    if (editable.has(path)) return schema;
    if (schema.type === 'object') return { ...schema, properties: Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, lock(child, current[key], path ? `${path}.${key}` : key)])) };
    if (schema.type === 'array') return current.length ? schema : { ...schema, maxItems: 0 };
    return { const: current };
  };
  return lock(base, value, '');
}

export const HUB_CREATE_PROMPT = `You design League of Legends broadcast hubs. Return ONLY JSON with design and operations. You are composing native editor components, not choosing a template.
${HUB_PART_STYLE_PROMPT}
${HUB_DESIGN_RULES}
Internal examples teach hierarchy and spacing; their appearance is not mandatory. Invent combinations appropriate to the instruction, including light palettes and mixed typography. Never output a template ID or force the user into an existing hub's identity.
design.colors: six freely chosen #RRGGBB roles: background=main panel color, text=primary text, muted=secondary text, line=quiet dividers, teamLeft=first-team accent, teamRight=second-team accent. The app derives coherent raised/deep shades and readable secondary/accent shades, retaining the chosen hues. Honor the requested accent hues. Cream is warm (#fff4dc); emerald can be #34b987; orange can be #e09040. These color examples are not presets: choose suitable colors for the actual request. Primary text needs 4.5:1 contrast. Light backgrounds require DARK text; dark backgrounds require LIGHT text.
design.typography: bodyFont=Arial|Segoe UI|Georgia|Arial Narrow (player names and secondary labels); headingFont=Arial Black|Impact|Georgia|Segoe UI (team names, scores and titles); uppercaseNames=true/false. Honor an explicitly requested heading font in headingFont, not just bodyFont. Tall/condensed lettering means Impact headings with Arial Narrow body. Serif headings mean Georgia. Body font can differ; keep player names readable.
design.panels: fill=solid|gradient|glass, corners=square|rounded|cut, borderWidth=0..2, accentWidth=0..4, teamSections=true/false. Sharp/straight edges mean square corners. Separate coloured team sections/blocks mean teamSections=true: each scoreboard team gets its own accent-coloured background, while the center stays dark/neutral. For subtle accent lines only use false. Combine independently; serif plus rounded light panels is valid. Fine outlines .5, normal1; accentWidth0 removes decorative team rails.
design.layout: scoreboardWidth=800..1920, scoreboardHeight=76..240, rosterHeight=240..540, showEventPanel=true/false. Choose geometry for the request and density: normal scoreboard1200x100, compact1000x86; rosters260 standard,290 spacious. Larger supported dimensions enable new compositions but must leave gameplay/minimap clear and pass rendered checks. Portraits, six items, CS/KDA, gold, clock and objectives already exist. Never add duplicates.
design.title: short event heading; use LIVE / MATCH unless a title is requested. Do not borrow existing event branding.
Additional independent choices: typography.nameFont sets the PLAYER NAME face, separately from headings/body. panels.rows=alternating|team-gradient|flat; panels.headerAccent=none|split|underline. layout.rosterWidth=540..900 for EACH table. Default joined mirrored tables can be repositioned individually with native operations when requested. Keep scores prominent, names legible, CS stronger than secondary KDA. showEventPanel=false for a generic match; true only for requested branding. Combine controls freely.
Use style operations to develop the base design, including purposeful custom component treatments. Do not fill operations with repeated default scoreboard flags. Layout dimensions belong in design. A move can target scoreboards or players; scoreboard options change only explicitly requested flags, never rename teams for colour instructions. Existing components already contain ten players, portraits, CS/KDA and six items; do not duplicate them. Compact means smaller rosterHeight, never one-row geometry for five players. Decoration example: {"op":"decoration","key":"event-label","kind":"text","x":960,"y":770,"width":400,"height":30,"text":"FINALS"}; its target is ai-decoration-event-label. Static labels never replace live stats. Keep decorative layers away from gameplay/minimap. Never output markup, scripts or URLs.`;
