import { LayoutIssue, parseModelJson } from './hub-plan';

export const HUB_REPAIR_LIMITS = Object.freeze({ maxAttempts: 4, maxDurationMs: 300_000, repeatedIssueLimit: 3 });
export type RepairStopReason = 'attempt-limit' | 'time-limit' | 'repeated-proposal' | 'no-progress' | 'runtime-error';
export type ValidationFailure = { fingerprint: string; issues: LayoutIssue[] };

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
  return [...new Set(issues.map(issue => descriptions[issue.code] ?? 'Some components are not configured correctly.'))].slice(0, 2).join(' ');
}

export function repairFeedback(issues: LayoutIssue[], attempt: number, mode: 'create' | 'edit'): string {
  const details = issues.slice(0, 3).map(issue => ({ code: issue.code, ...(issue.path ? { path: issue.path } : {}),
    layers: issue.layerIds.slice(0, 2), problem: issue.message.slice(0, 120) }));
  const scope = mode === 'edit' ? 'Use the ORIGINAL hub and its existing IDs, not the rejected proposal as the new base.'
    : 'Keep the requested design. Dimensions and fonts belong in design; do not shrink five-player tables to portrait dimensions.';
  return `Validation failed. Automatic correction ${attempt}/${HUB_REPAIR_LIMITS.maxAttempts - 1}. ${scope}
Fix the listed problems only; preserve valid settings and the original instruction. Return a complete JSON object matching the decoder schema.
${JSON.stringify(details)}`;
}

export function stoppedRepairMessage(reason: RepairStopReason, attempts: number, issues: LayoutIssue[]): string {
  const explanation: Record<RepairStopReason, string> = {
    'attempt-limit': `Stopped after ${attempts} attempts.`,
    'time-limit': 'Stopped at the five-minute time limit.',
    'repeated-proposal': 'Stopped because the model repeated an invalid proposal.',
    'no-progress': 'Stopped because the same validation problems kept recurring.',
    'runtime-error': 'The local model stopped responding correctly.',
  };
  return `${explanation[reason]} ${validationSummary(issues)} Your current hub is unchanged.`.replace(/\s+/g, ' ').trim();
}
