import Ajv from 'ajv';
import { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { HubPlan, HubPlanError, parseModelJson } from './hub-plan';
import { portraitSettings } from './hub-detail';
import type { RenderedHubReport } from './hub-quality';
import { matchesRenderedHue } from './hub-quality';
import { APPEARANCE_COLORS } from './hub-appearance';

const aspects = ['size', 'position', 'fill', 'gradient', 'outline', 'padding', 'typography', 'portraits', 'items', 'separators', 'spacing', 'objectives', 'gold', 'clock', 'player-data', 'visibility', 'team-codes', 'components', 'other'] as const;
const checks = ['none', 'half-screen-width', 'narrower', 'wider', 'shorter', 'taller', 'smaller-portraits', 'larger-portraits', 'portraits-larger-than-items', 'smaller-text', 'larger-text', 'team-gradient', 'fine-separators', 'joined-bottom', 'minimap-clear'] as const;
export type HubIntent = { summary: string; style?: { leftAccent: string | null; rightAccent: string | null; heading: 'condensed' | 'serif' | 'sans' | null; teamSections: boolean | null; corners: 'square' | 'rounded' | 'cut' | null }; changes: { target: 'all' | 'scoreboards' | 'team-sections' | 'players' | 'branding' | 'player-header';
  aspect: typeof aspects[number]; request: string; check: typeof checks[number] }[]; preserve: string[]; unresolved: string[] };
export type IntentCheck = { request: string; status: 'verified' | 'limited' | 'unverified' | 'failed'; detail: string };
const string = (maxLength?: number) => ({ type: 'string', minLength: 1, ...(maxLength === undefined ? {} : { maxLength }) });
const intentColors: Record<string, string> = { ...APPEARANCE_COLORS, orange: '#ff9900', 'burnt-orange': '#b85734', cyan: '#00cbe6', blue: '#408cff', red: '#ff635b', green: '#35bc7a', pink: '#ed82b8', yellow: '#e7db47', black: '#101010' };
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: 'null' }] });
const accent = nullable({ anyOf: [{ enum: Object.keys(intentColors) }, { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }] });
export const HUB_INTENT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['summary', 'changes', 'preserve', 'unresolved'], properties: {
    style: { type: 'object', additionalProperties: false, required: ['leftAccent', 'rightAccent', 'heading', 'teamSections', 'corners'], properties: {
      leftAccent: accent, rightAccent: accent, heading: nullable({ enum: ['condensed', 'serif', 'sans'] }), teamSections: nullable({ type: 'boolean' }), corners: nullable({ enum: ['square', 'rounded', 'cut'] }),
    } },
    summary: string(180), changes: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false,
      required: ['target', 'aspect', 'request', 'check'], properties: {
        target: { enum: ['all', 'scoreboards', 'team-sections', 'players', 'branding', 'player-header'] }, aspect: { enum: aspects }, request: string(),
        check: { anyOf: [{ enum: checks }, { type: 'array', minItems: 1, maxItems: 3, items: { enum: checks } }] },
      } } }, preserve: { type: 'array', maxItems: 4, items: string() }, unresolved: { type: 'array', maxItems: 3, items: string() },
  },
};
const checkAspects: Partial<Record<typeof checks[number], string[]>> = {
  'half-screen-width': ['size'], narrower: ['size'], wider: ['size'], shorter: ['size'], taller: ['size'],
  'team-gradient': ['gradient'], 'smaller-portraits': ['portraits'], 'larger-portraits': ['portraits'],
  'portraits-larger-than-items': ['portraits', 'items'], 'smaller-text': ['typography'], 'larger-text': ['typography'],
  'fine-separators': ['separators'], 'joined-bottom': ['position'], 'minimap-clear': ['position'],
};
export const HUB_INTENT_DECODE_SCHEMA = JSON.parse(JSON.stringify(HUB_INTENT_SCHEMA, (key, value) => key === 'maxLength' ? undefined : value));
HUB_INTENT_DECODE_SCHEMA.required.push('style');
const changeSchema = HUB_INTENT_DECODE_SCHEMA.properties.changes.items;
HUB_INTENT_DECODE_SCHEMA.properties.changes.items = { oneOf: aspects.map(aspect => ({ ...changeSchema,
  properties: { ...changeSchema.properties, aspect: { const: aspect }, check: { type: 'array', minItems: 1, maxItems: 3,
    items: { enum: checks.filter(check => check === 'none' || checkAspects[check]?.includes(aspect)) } } },
})) };
const validate = new Ajv({ strict: false, allErrors: true }).compile(HUB_INTENT_SCHEMA);
export function parseHubIntent(raw: string, instruction?: string, mode: 'create' | 'edit' = 'edit'): HubIntent {
  const value = parseModelJson(raw);
  // Request/preservation evidence has no per-string character cap. The worker's
  // output-token limit bounds interpretation; never retry just to shorten a quote
  // or silently cut off a qualifier. A display-only summary may be shortened.
  if (value && typeof value === 'object' && typeof (value as any).summary === 'string') {
    const summary = (value as any).summary;
    (value as any).summary = summary.length > 180 ? summary.slice(0, 176).replace(/\s+\S*$/, '') + '…' : summary;
  }
  if (!validate(value)) throw new Error(`The instruction interpreter returned an incomplete plan: ${(validate.errors ?? []).slice(0, 3).map(error => `${error.instancePath} ${error.message}`).join('; ')}`);
  const intent = { ...(value as HubIntent), changes: (value as any).changes.flatMap((change: any) =>
    (Array.isArray(change.check) ? [...new Set(change.check)].filter(check => check !== 'none' || change.check.length === 1) : [change.check]).map(check => ({ ...change, check }))) } as HubIntent;
  if (instruction) {
    // A decoder enum is not evidence that the user requested its colour. In the
    // reported run 'burnt orange' became the example's burgundy and overwrote
    // the generator's correct orange. Unquoted hints cannot override the design.
    for (const side of ['leftAccent', 'rightAccent'] as const) {
      const color = intent.style?.[side];
      if (color && !instruction.toLowerCase().includes(color.replace(/-/g, ' ').toLowerCase()) && !instruction.toLowerCase().includes(color.toLowerCase())) intent.style![side] = null;
    }
    // Ignore articles and an inferred "team" noun while retaining content words,
    // numbers and their order. "the right team" may quote "the right" safely.
    const normalize = (text: string) => text.toLowerCase().replace(/\b(the|a|an|team)\b/g, '').replace(/\s+/g, ' ').trim();
    const compact = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\bteam\b/g, '').replace(/[^a-z0-9]/g, '').replace(/([a-z])\1+/g, '$1');
    const grounded = (request: string) => {
      const numbers: string[] = instruction.match(/\d+/g) ?? [];
      if ((request.match(/\d+/g) ?? []).some(number => !numbers.includes(number))) return false;
      // Tolerate joined words and repeated-letter corrections (abit/a bit,
      // biger/bigger), without making invented numbers pass as spelling fixes.
      return normalize(instruction).includes(normalize(request)) || compact(instruction).includes(compact(request));
    };
    const hadChanges = intent.changes.length > 0;
    // Creation retains the original full brief and permits independent design
    // choices. Drop copied example requests instead of failing a usable design.
    // Edits must preserve the existing hub, so repair ungrounded instructions.
    if (mode === 'create') intent.changes = intent.changes.filter(change => grounded(change.request));
    const unmatched = intent.changes.filter(change => !grounded(change.request));
    if (unmatched.length || hadChanges && !intent.changes.length) throw new Error(`Each request must quote actual user phrases; remove invented changes. Unmatched: ${unmatched.map(change => change.request).join('; ').slice(0, 220)}`);
  }

  // The interpreter may describe a supported requirement correctly but escape
  // its executable contract with check:none (as in the reported creation log).
  // Resolve only high-confidence, quoted relationships; subjective style stays
  // explicitly unverified. Do not infer extra requests from example vocabulary.
  intent.changes = intent.changes.flatMap(change => {
    if (change.check !== 'none') return [change];
    const phrase = change.request.toLowerCase();
    const found: HubIntent['changes'] = [];
    const add = (aspect: typeof aspects[number], check: typeof checks[number]) => found.push({ ...change, aspect, check });
    if (['team-sections', 'scoreboards'].includes(change.target) && /\b(gradient|degrade|blend|fade)\b/.test(phrase)
      && !/\b(no|without|remove)\b[^.!?]*\b(gradient|degrade|blend|fade)\b/.test(phrase)) add('gradient', 'team-gradient');
    if (change.target === 'players') {
      if (/\b(portraits?|champion|hero|character|pics?|pictures?)\b/.test(phrase) && /\b(bigger|biger|larger)\b[^.!?]*\b(than|then)\b[^.!?]*\b(items?|equipment|gear)\b/.test(phrase)) add('portraits', 'portraits-larger-than-items');
      if (/\b(bottom|flush)\b/.test(phrase) && /\b(joined|together|meet|seam)\b/.test(phrase)) add('position', 'joined-bottom');
      if (/\b(fine|thin|subtle)\b[^.!?]*\b(separators?|dividers?)\b/.test(phrase)) add('separators', 'fine-separators');
    }
    const retainFill = mode === 'edit' && change.aspect === 'fill' && /background|surface|tinted/.test(phrase);
    return found.length ? [...(retainFill ? [change] : []), ...found] : [change];
  });
  // Preserve clear requirements even when the interpreter omitted the clause.
  // These are quoted relationships from the actual request, not example defaults.
  if (instruction) {
    const clauses = instruction.split(/[.!?\n]+/).map(text => text.trim()).filter(Boolean);
    const addMissing = (check: HubIntent['changes'][number]['check'], target: HubIntent['changes'][number]['target'], aspect: typeof aspects[number], pattern: RegExp) => {
      const request = clauses.find(clause => pattern.test(clause) && !/\b(?:not|no)\s+(?:bigger|larger)|\b(?:don't|dont|never)\s+(?:make|enlarge)\b/i.test(clause));
      const quote = check === 'minimap-clear' ? request?.match(/\bminimap\s+(?:clear|uncovered|unobstructed|visible)\b|\b(?:clear|uncovered|unobstructed)\s+(?:the\s+)?minimap\b/i)?.[0] ?? request : request;
      const existing = intent.changes.find(change => change.check === check);
      if (existing) {
        if (quote && (check === 'minimap-clear' || !pattern.test(existing.request))) Object.assign(existing, { target, aspect, request: quote });
      } else if (quote) intent.changes.push({ target, aspect, check, request: quote });
    };
    addMissing('portraits-larger-than-items', 'players', 'portraits', /\b(portraits?|champions?|characters?|hero|pics?|pictures?)\b[^.!?]*\b(bigger|biger|larger)\b[^.!?]*\b(than|then)\b[^.!?]*\b(items?|equipment|gear)\b/i);
    addMissing('team-gradient', 'team-sections', 'gradient', /^(?!.*\b(no|without|remove)\b[^.!?]*\b(gradient|degrade)\b)(?=.*\bteam\b)(?=.*\b(gradient|degrade)\b)/i);
    addMissing('fine-separators', 'players', 'separators', /\b(fine|thin|subtle)\b[^.!?]*\b(row )?(separators?|dividers?)\b/i);
    addMissing('joined-bottom', 'players', 'position', /^(?=.*\b(bottom|flush)\b)(?=.*\b(joined|together|meet)\b)(?=.*\b(tables?|panels?|rosters?)\b)/i);
    addMissing('minimap-clear', 'all', 'position', /\bminimap\b[^.!?]*\b(clear|uncovered|unobstructed|visible)\b|\b(clear|uncovered|unobstructed)\b[^.!?]*\bminimap\b/i);
  }
  intent.unresolved = intent.unresolved.filter(request => {
    if (/\b(skip|hide|remove|without|leave out)\b/i.test(request) && /\b(branding|tournament|event|information)\b/i.test(request) && /\b(panel|card|branding)\b/i.test(request)
      && instruction?.toLowerCase().includes(request.toLowerCase())) {
      intent.changes.push({ target: 'branding', aspect: 'visibility', request, check: 'none' });
      return false;
    }
    return true;
  });
  if (intent.changes.some(change => change.check === 'none' && checks.filter(check => check !== 'none').some(check => change.request === check || change.request.endsWith('/' + check)))) {
    throw new Error('Put each measurable rule in its check field, not only in request. Use the matching aspect and target.');
  }
  const validTargets: Partial<Record<typeof checks[number], string[]>> = {
    'half-screen-width': ['scoreboards'], 'team-gradient': ['scoreboards', 'team-sections'],
    'smaller-portraits': ['players'], 'larger-portraits': ['players'], 'portraits-larger-than-items': ['players'],
    'smaller-text': ['players'], 'larger-text': ['players'], 'fine-separators': ['players'], 'joined-bottom': ['players'],
    narrower: ['scoreboards', 'players'], wider: ['scoreboards', 'players'], shorter: ['scoreboards', 'players'], taller: ['scoreboards', 'players'],
  };
  if (intent.changes.some(change => validTargets[change.check] && !validTargets[change.check]!.includes(change.target))) throw new Error('An interpreted change targets an incompatible component.');
  if (intent.changes.some(change => change.check !== 'none' && !checkAspects[change.check]?.includes(change.aspect))) throw new Error('Use an aspect matching the check: gradient, portraits, typography, size, separators or position.');
  return intent;
}
export const HUB_INTENT_PROMPT = `You translate the FINAL user's request into a concise structured brief. Output only JSON. Include ONLY requests made by that user. Do not add suggestions from these instructions or the example. Do not design the hub or ask for pixels.
changes contain new requests. preserve contains things the user explicitly wants unchanged. A sentence can contain BOTH. Correct ordinary spelling mistakes. Character/hero pictures mean champion portraits; equipment squares mean item icons; degrade means gradient.
aspect meanings: fill=colours/backgrounds/team-coloured sections; gradient=colour blends; typography=fonts/lettering; size=component dimensions; portraits=champion pictures and portrait/item relationship; separators=row dividers; position=placement; team-codes=RENAME team abbreviations only; other=general styling. Keep exact requested colour/font words in request. Never classify team colours as team-codes.
check is an ARRAY of all matching rules for that phrase. Use ["none"] only when no rule matches. Include BOTH half-screen-width and shorter for a half-width, thinner scoreboard, and BOTH smaller-portraits and portraits-larger-than-items for smaller portraits still larger than equipment. Relative dimension checks target scoreboards or players. Portrait and text size checks target players. team-gradient targets team-sections; fine-separators and joined-bottom target players. In create mode use none only for changes requiring a previous size. Gradients, portrait-versus-item proportions, fine separators and joined-bottom ARE measurable during creation and MUST carry checks. Never put portraits under position or gradients under fill.
Cover EVERY requested change, including all sentences. Different aspects need separate entries even in the same sentence: smaller lettering=typography/smaller-text; larger lettering=typography/larger-text; fine row dividers=separators/fine-separators. Shorter player tables=size/shorter with target players, independently of a thinner scoreboard. Joined tables flush at bottom=position/joined-bottom. Do not merge typography and separators or silently drop the table height request.
Enlarging portraits while keeping them bigger than items requires BOTH larger-portraits and portraits-larger-than-items. "biger now, still bigger than equipment" contains two requests. Preserve original spelling in quoted request strings.
style records EXPLICIT visual requests: leftAccent/rightAccent are named colours or hex; heading is condensed (narrow sports lettering), serif, sans or null; teamSections=true means coloured team blocks; corners=square means sharp edges. Set unspecified fields null. Never infer extra colours, gradients or dimensions. Preserve requests in edit mode do not create new style settings.
Supported components are scoreboard, player tables, champions, items, stats, objectives, clock and branding. Put unsupported webcams, media or custom widgets in unresolved. Every request string MUST quote a short exact phrase from the final instruction, retaining its original words. This evidence prevents invented changes. Do not copy instructions or examples. Short summary; at most ten changes.`;
export const HUB_INTENT_EXAMPLE = {
  input: { mode: 'edit', instruction: 'keep purple and yellow but blend darker. bar half width and slimmer. shorten player panels. make hero pics smaller but a bit bigger then equipment. letters smaller with fine dividers. keep tables together at bottom. dont change font' },
  output: { style: { leftAccent: null, rightAccent: null, heading: null, teamSections: null, corners: null }, summary: 'Compact the scoreboard and tables, blend team fills, and refine player detail.', changes: [
    { target: 'team-sections', aspect: 'gradient', request: 'blend darker', check: 'team-gradient' },
    { target: 'scoreboards', aspect: 'size', request: 'bar half width and slimmer', check: ['half-screen-width', 'shorter'] },
    { target: 'players', aspect: 'size', request: 'shorten player panels', check: ['shorter'] },
    { target: 'players', aspect: 'portraits', request: 'make hero pics smaller but a bit bigger then equipment', check: ['smaller-portraits', 'portraits-larger-than-items'] },
    { target: 'players', aspect: 'typography', request: 'letters smaller', check: ['smaller-text'] },
    { target: 'players', aspect: 'separators', request: 'fine dividers', check: ['fine-separators'] },
    { target: 'players', aspect: 'position', request: 'keep tables together at bottom', check: ['joined-bottom'] },
  ], preserve: ['purple and yellow', 'dont change font'], unresolved: [] },
};
export const HUB_INTENT_CREATE_EXAMPLE = {
  input: { mode: 'create', instruction: 'make a cream hub, burgundy team sections with a gradient, serif titles and a small top scoreboard. champion portraits bigger than items. player tables joined at the bottom with fine separators' },
  output: { style: { leftAccent: 'burgundy', rightAccent: 'burgundy', heading: 'serif', teamSections: true, corners: null }, summary: 'Create a simple cream broadcast with burgundy accents and serif titles.', changes: [
    { target: 'all', aspect: 'fill', request: 'cream hub', check: 'none' },
    { target: 'team-sections', aspect: 'fill', request: 'burgundy team sections', check: 'none' },
    { target: 'team-sections', aspect: 'gradient', request: 'gradient', check: 'team-gradient' },
    { target: 'all', aspect: 'typography', request: 'serif titles', check: 'none' },
    { target: 'scoreboards', aspect: 'size', request: 'small top scoreboard', check: 'none' },
    { target: 'players', aspect: 'portraits', request: 'champion portraits bigger than items', check: 'portraits-larger-than-items' },
    { target: 'players', aspect: 'position', request: 'player tables joined at the bottom', check: 'joined-bottom' },
    { target: 'players', aspect: 'separators', request: 'fine separators', check: 'fine-separators' },
  ], preserve: [], unresolved: [] },
};
export const HUB_INTENT_GROW_EXAMPLE = {
  input: { mode: 'edit', instruction: 'pics abit biger now but still bigger then gear. words abit larger. same font' },
  output: { style: { leftAccent: null, rightAccent: null, heading: null, teamSections: null, corners: null }, summary: 'Enlarge portraits and text while retaining the font and icon hierarchy.', changes: [
    { target: 'players', aspect: 'portraits', request: 'pics abit biger now but still bigger then gear', check: ['larger-portraits', 'portraits-larger-than-items'] },
    { target: 'players', aspect: 'typography', request: 'words abit larger', check: ['larger-text'] },
  ], preserve: ['same font'], unresolved: [] },
};

/** Compatibility for recorded plans. Interpretation never authors visual values. */
export function resolveIntentPlan(plan: HubPlan, _intent: HubIntent, _before: Hub, _baseline?: RenderedHubReport): HubPlan {
  return structuredClone(plan);
}

export function checkHubIntent(intent: HubIntent, before: Hub, after: Hub, rendered?: RenderedHubReport, baseline?: RenderedHubReport, mode: 'create' | 'edit' = 'edit'): IntentCheck[] {
  const result = intent.changes.map(change => {
    const { target, check, request } = change;
    const entry = (status: IntentCheck['status'], detail: string): IntentCheck => ({ request, status, detail });
    if (check === 'none') return entry('unverified', 'Included in the design brief; review the preview.');
    if (check === 'minimap-clear') {
      const blockers = after.layers.filter(layer => layer.visible && layer.type !== LayerType.Group
        && layer.position.x + layer.width / 2 > 1620 && layer.position.x - layer.width / 2 < 1920
        && layer.position.y + layer.height / 2 > 780 && layer.position.y - layer.height / 2 < 1080);
      return blockers.length ? entry('failed', 'Keep overlay components outside the lower-right minimap area.')
        : entry('verified', 'The lower-right minimap area is clear of overlay components.');
    }
    const selected = after.layers.filter(layer => layer.visible && (target === 'scoreboards' || target === 'team-sections' ? layer.type === LayerType.LolScorebug : layer.type === LayerType.LolPlayerRoster));
    if (!selected.length) return entry('failed', 'The requested component is missing.');
    if (check === 'half-screen-width') return selected.every(layer => Math.abs(layer.width - 960) < 48) ? entry('verified', 'Scoreboard occupies about half the canvas width.') : entry('failed', 'Set the scoreboard to about half the canvas width.');
    if (['shorter', 'taller', 'narrower', 'wider'].includes(check)) {
      const dimension = check === 'shorter' || check === 'taller' ? 'height' : 'width';
      const smaller = check === 'shorter' || check === 'narrower';
      const changes = selected.map(layer => { const old = before.layers.find(old => old.id === layer.id); return old ? layer[dimension] - old[dimension] : NaN; });
      if (mode === 'create') return entry('unverified', 'A relative change needs an existing layout.');
      if (changes.every(diff => smaller ? diff < -.5 : diff > .5)) return entry('verified', 'Measured component dimensions changed in the requested direction.');
      const atMinimum = selected.every(layer => layer[dimension] <= (dimension === 'width' ? layer.type === LayerType.LolScorebug ? 800 : 540 : layer.type === LayerType.LolScorebug ? 76 : 240) + .5);
      return smaller && atMinimum ? entry('limited', 'Already at the minimum readable size; further shrinking was limited.') : entry('failed', 'Component size did not change in the requested direction.');
    }
    if (!rendered) return entry('unverified', 'Rendered measurements are unavailable.');
    const details = rendered.rosterDetails ?? [];
    if (check === 'portraits-larger-than-items') return details.length && details.every(row => row.itemMax > 0 && row.portraitMin >= row.itemMax * 1.12) ? entry('verified', 'Champion portraits are visibly larger than item icons.') : entry('failed', 'Make champion portraits at least 12% larger than item icons.');
    if (check === 'team-gradient') return rendered.teamFills?.length === selected.length * 2 && rendered.teamFills.every(fill => fill.gradient && (fill.delta === undefined || fill.delta >= .10))
      ? entry('verified', 'Both team sections have gradients with a measurable colour transition.') : entry('failed', 'Apply a visible gradient to each team section; nearly identical stops are insufficient.');
    if (check === 'fine-separators') return details.length && details.every(row => row.separator > 0 && row.separator <= .8) ? entry('verified', 'Rendered rows have fine separators.') : entry('failed', 'Add fine row separators without thickening other outlines.');
    if (check === 'joined-bottom') {
      const frames = rendered.frames.filter(frame => frame.role === 'players');
      return frames.length === 2 && Math.abs(rendered.tableGapPx ?? Infinity) <= 2 && frames.every(frame => Math.abs(frame.y + frame.height - rendered.viewport[1]) <= 2) ? entry('verified', 'Both tables meet at the seam and sit flush with the bottom.') : entry('failed', 'Join the tables at the center and align their bottom edges with the canvas.');
    }
    if (check === 'smaller-portraits' || check === 'larger-portraits') {
      const old = baseline?.rosterDetails;
      if (!old?.length || !details.length) return entry('unverified', 'No baseline portrait measurements.');
      const smaller = check === 'smaller-portraits';
      if (details.every((row, i) => old[i] && (smaller ? row.portraitMin < old[i].portraitMin - .3 : row.portraitMin > old[i].portraitMin + .3))) return entry('verified', 'Rendered champion portrait size changed as requested.');
      return smaller && playersAtMinimum(after) ? entry('limited', 'Champion portraits are at their minimum readable size.') : entry('failed', 'Champion portrait size did not change as requested.');
    }
    if (check === 'smaller-text' || check === 'larger-text') {
      const roles = ['names', 'cs', 'kda'], smaller = check === 'smaller-text';
      const fonts = rendered.fonts.filter(font => roles.includes(font.role));
      if (!fonts.length || !baseline) return entry('unverified', 'No baseline text measurements.');
      const diffs = fonts.map(font => font.minPx - (baseline.fonts.find(old => old.role === font.role)?.minPx ?? font.minPx));
      if (diffs.every(diff => smaller ? diff <= .1 : diff >= -.1) && diffs.some(diff => smaller ? diff < -.3 : diff > .3)) return entry('verified', 'Rendered player text changed while preserving the font family.');
      return smaller && fonts.every(font => font.minPx <= ({ names: 12, cs: 13.34, kda: 10.67 }[font.role] ?? 0) + .2) ? entry('limited', 'Player text is already at the readable size floor.') : entry('failed', 'Player lettering did not change in the requested direction.');
    }
    return entry('unverified', 'Review this detail in the preview.');
  });
  const teamColours: IntentCheck[] = rendered ? (['leftAccent', 'rightAccent'] as const).flatMap((key, i): IntentCheck[] => {
    const accent = intent.style?.[key];
    if (!accent) return [];
    const css = intent.style?.teamSections === true ? rendered.teamFills?.[i]?.css : rendered.teamAccents?.[i]?.css;
    if (!css) return [{ request: `${i ? 'Right' : 'Left'} team colour: ${accent}`, status: 'unverified' as const, detail: 'Rendered team colour measurements are unavailable.' }];
    const matches = matchesRenderedHue(css, intentColors[accent] ?? accent, accent === 'burnt-orange' ? 10 : 30);
    return [{ request: `${i ? 'Right' : 'Left'} team colour: ${accent}`, status: matches ? 'verified' as const : 'failed' as const,
      detail: matches ? 'The actual rendered team treatment retains the requested colour family.' : 'The rendered team treatment does not match the requested colour. Adjust its colours without renaming the team.' }];
  }) : [];
  const preservation: IntentCheck[] = [];
  if (rendered && baseline && mode === 'edit') {
    if (intent.preserve.some(note => /font|typeface/i.test(note)) && baseline.fonts.length) {
      const face = (value: string) => value.toLowerCase().replace(/["']/g, '').replace(/\s+/g, '');
      const retained = baseline.fonts.every(old => rendered.fonts.some(current => current.role === old.role && face(current.face) === face(old.face)));
      preservation.push({ request: 'Preserve font families', status: retained ? 'verified' : 'failed', detail: retained ? 'Rendered font families match the existing hub.' : 'Restore the existing font families; the user requested preserving them.' });
    }
    if (intent.preserve.some(note => /colou?r|hue|palette/i.test(note))) {
      const filled = (before.layout?.['aiDesign'] as { panels?: { teamSections?: boolean } } | undefined)?.panels?.teamSections;
      const old = filled ? baseline.teamFills : baseline.teamAccents;
      const current = filled ? rendered.teamFills : rendered.teamAccents;
      if (old?.length === 2 && current?.length === 2) {
        const retained = current.every((color, i) => matchesRenderedHue(color.css, old[i].css));
        preservation.push({ request: 'Preserve team colours', status: retained ? 'verified' : 'failed', detail: retained ? 'Rendered team colour families match the existing hub.' : 'Restore the existing team hues; gradient or spacing changes must retain the palette.' });
      }
    }
  }
  return [...result, ...teamColours, ...preservation, ...intent.unresolved.map(request => ({ request, status: 'limited' as const, detail: 'This request is outside the current builder capabilities.' }))];
}
function playersAtMinimum(hub: Hub) {
  return hub.layers.filter(layer => layer.type === LayerType.LolPlayerRoster).every(layer => layer.type === LayerType.LolPlayerRoster && portraitSettings(layer).portraitSize <= 36);
}
