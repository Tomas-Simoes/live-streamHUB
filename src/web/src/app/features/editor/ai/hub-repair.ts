import Ajv from 'ajv';
import { HubPlan, HubPlanError, LayoutIssue, parseModelJson } from './hub-plan';
import { normalizePartRules } from './hub-part-style';

export const HUB_REPAIR_LIMITS = Object.freeze({ maxAttempts: 4, maxDurationMs: 600_000, repeatedIssueLimit: 3 });
export const HUB_PHASE_LIMITS = Object.freeze({ previewMs: 12_000, textReviewMs: 45_000, imageReviewMs: 90_000, modelSwitchMs: 60_000 });
export type RepairStopReason = 'attempt-limit' | 'time-limit' | 'preview-error' | 'repeated-proposal' | 'no-progress' | 'runtime-error';
export type ValidationFailure = { fingerprint: string; issues: LayoutIssue[] };

export function repairHintOperations(hints: { target: string; part: string; css: string }[]) {
  const groups = new Map<string, { part: string; css: string }[]>();
  for (const { target, part, css } of hints) groups.set(target, [...(groups.get(target) ?? []), { part, css }]);
  return [...groups].map(([target, rules]) => ({ op: 'style', target, rules }));
}

/** Repair only eligible styling, never regenerate a correct composition or
 * widen an edit's original property/target permissions. */
export function styleRepairSchema(instructionSchema: Record<string, any>): Record<string, any> | undefined {
  const styles = instructionSchema.properties?.operations?.items?.oneOf?.filter((operation: any) => operation.properties?.op?.const === 'style');
  if (!styles?.length) return undefined;
  return { type: 'object', additionalProperties: false, required: ['operations'], properties: {
    operations: { type: 'array', minItems: 1, maxItems: 4, items: { oneOf: structuredClone(styles) } },
  } };
}
export function applyStyleRepair(raw: string, schema: Record<string, any>, base: HubPlan): HubPlan {
  const value = parseModelJson(raw);
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(value)) throw new HubPlanError([{ code: 'schema', layerIds: [], message: 'Return only permitted style operations for the failed component.' }]);
  const operations = (value as { operations: HubPlan['operations'] }).operations;
  const definition = schema.properties.operations.items.oneOf[0];
  const allowed = definition.properties.rules.items.properties.declarations.items.properties.property.enum;
  try { for (const operation of operations) operation.rules = normalizePartRules(operation.rules!, allowed); }
  catch (error) { throw new HubPlanError([{ code: 'edit-scope', layerIds: [], message: error instanceof Error ? error.message : String(error) }]); }
  if (base.operations.length + operations.length > 32) throw new HubPlanError([{ code: 'schema', layerIds: [], message: 'The correction contains too many operations.' }]);
  return { ...structuredClone(base), operations: [...structuredClone(base.operations), ...operations] };
}
export function styleRepairMessages(plan: HubPlan, issues: LayoutIssue[], instruction: string, measurements: unknown) {
  const playerIssue = issues.every(issue => /roster|portrait|item|player|names|\bcs\b|\bkda\b/i.test(issue.message));
  const styles = plan.operations.filter(operation => operation.op === 'style' && (!playerIssue || /players|portraits/.test(operation.target ?? '')));
  const hints = (measurements as { repairHints?: { target: string; part: string; css: string; reason: string }[] } | undefined)?.repairHints;
  const recommendedPatch = hints?.length ? { operations: repairHintOperations(hints) } : undefined;
  return [
    { role: 'system' as const, content: 'Repair this League broadcast component using ONLY the permitted style-operation JSON. The application retains the composition, data and all other settings. Output a small patch, not a full design. When recommendedPatch is provided, return that fix: it identifies the rendered cause. Never repeat the invalid declaration or copy unrelated styles. items is the complete SIX-ICON STRIP; item is ONE icon. Portrait sizes need matching grid tracks. Use width:auto to release an old strip width. All px values are native 1920x1080 units; measurements are displayed 1280x720. Keep every binding readable and the requested identity. No markup, selectors, URLs or new data.' },
    { role: 'user' as const, content: JSON.stringify({ recommendedPatch, causes: hints, instruction: instruction.slice(0, 1500), issues, currentStyles: recommendedPatch ? undefined : styles,
      nativeLayout: plan.design?.layout, measurements }) },
  ];
}

/** Ignore formatting/key order when detecting a model cycling through old answers. */
export function candidateFingerprint(raw: string): string {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  try { return JSON.stringify(canonical(parseModelJson(raw))); } catch { return raw.trim(); }
}

function issueFingerprint(issues: LayoutIssue[]) {
  // New compositions receive fresh UUIDs on every compilation. Those IDs are not progress.
  return issues.map(issue => [issue.code, issue.path ?? '',
    issue.layerIds.map(id => id.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')).sort(),
    issue.message].join(':')).sort().join('\n');
}

export function repairStopReason(failures: ValidationFailure[], elapsedMs: number): RepairStopReason | null {
  if (elapsedMs >= HUB_REPAIR_LIMITS.maxDurationMs) return 'time-limit';
  const latest = failures.at(-1);
  if (latest && failures.slice(0, -1).some(failure => failure.fingerprint === latest.fingerprint)) return 'repeated-proposal';
  const recent = failures.slice(-HUB_REPAIR_LIMITS.repeatedIssueLimit);
  if (recent.length === HUB_REPAIR_LIMITS.repeatedIssueLimit
    && recent.every(failure => issueFingerprint(failure.issues) === issueFingerprint(recent[0].issues))) return 'no-progress';
  return failures.length >= HUB_REPAIR_LIMITS.maxAttempts ? 'attempt-limit' : null;
}

export function validationSummary(issues: LayoutIssue[]): string {
  const descriptions: Record<string, string> = {
    json: 'The model returned an incomplete design.', schema: 'Some design settings are missing or unsupported.',
    style: 'The model returned an unsupported component style.',
    target: 'The proposal refers to a layer that does not exist.',
    contrast: 'Some text is difficult to read against its background.', collision: 'Some panels overlap.',
    readability: 'Some text became too small or clipped in the rendered hub.',
    intent: 'Some requested changes are not visible in the rendered hub yet.',
    'edit-scope': 'The proposal tried to change settings outside your request.',
    bounds: 'Some panels fall outside the canvas.', dimensions: 'Some panel sizes are invalid.',
    roster: 'The player tables are too small for five players.', scoreboard: 'The scoreboard is too small or missing team information.',
    portrait: 'Some champion portraits are too small.', items: 'Some item slots are too small.',
    'no-change': 'The proposal did not make the requested changes.',
    'design-preservation': 'The proposal changed parts that should be preserved.',
  };
  return [...new Set(issues.map(issue => issue.code === 'target' ? issue.message.split('. Available aliases:')[0] + '.'
    : issue.code === 'readability' && /parts overlap/.test(issue.message) ? 'Some portraits, items or statistics overlap.'
    : issue.code === 'readability' && /lacks contrast/.test(issue.message) ? 'Some text has insufficient contrast against its background.'
    : issue.code === 'readability' && /Item icons/.test(issue.message) ? 'Some item icons are too small to read.'
    : issue.code === 'readability' && /exceeds its component frame/.test(issue.message) ? 'Some player data falls outside its panel.'
    : descriptions[issue.code] ?? 'Some components are not configured correctly.'))].slice(0, 2).join(' ');
}

export function repairFeedback(issues: LayoutIssue[], attempt: number, mode: 'create' | 'edit'): string {
  const details = issues.slice(0, 3).map(issue => ({ code: issue.code, ...(issue.path ? { path: issue.path } : {}),
    layers: issue.layerIds.slice(0, 2), problem: issue.message }));
  const scope = mode === 'edit' ? 'Use the ORIGINAL hub and its existing IDs, not the rejected proposal as the new base.'
    : 'Keep the requested design and native live bindings. Use styles for CSS and frame/move/resize operations for layer geometry.';
  return `Validation failed. Automatic correction ${attempt}/${HUB_REPAIR_LIMITS.maxAttempts - 1}. ${scope}
Fix the listed problems only; preserve valid settings and the original instruction. Return a complete JSON object matching the decoder schema.
${JSON.stringify(details)}`;
}

export function stoppedRepairMessage(reason: RepairStopReason, attempts: number, issues: LayoutIssue[]): string {
  const explanation: Record<RepairStopReason, string> = {
    'attempt-limit': `Stopped after ${attempts} attempts.`,
    'time-limit': 'Stopped at the ten-minute time limit.',
    'preview-error': 'The preview could not finish preparing for validation.',
    'repeated-proposal': 'Stopped because the model repeated an invalid proposal.',
    'no-progress': 'Stopped because the same validation problems kept recurring.',
    'runtime-error': 'The local model stopped responding correctly.',
  };
  return `${explanation[reason]} ${validationSummary(issues)} Your current hub is unchanged.`.replace(/\s+/g, ' ').trim();
}
