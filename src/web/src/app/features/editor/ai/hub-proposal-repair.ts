import Ajv from 'ajv';
import type { Hub } from '../../../shared/types/hub.types';
import { HubPlan, HubPlanError, LayoutIssue, parseHubPlan, parseModelJson } from './hub-plan';
import { designResponseSchema, designTargetSchema, parseDesignResponse } from './hub-design-spec';
import { hubTargetInventory } from './hub-targets';

export const HUB_PROPOSAL_REPAIR_PROMPT = `Correct the invalid entries in a RETAINED League broadcast proposal. Return ONLY JSON: {"summary":"Short correction","revisions":[{"index":0,"action":"remove"}],"styles":[],"operations":[]}.
Indices refer to the supplied proposal, not CSS selectors. Each revision either removes an invalid proposal entry or retargets it with {index,action:"retarget",target:"existing target"}. All untouched entries and their exact CSS are retained. Never copy the entire design. A nonexistent layer cannot be fixed by appending another stylesheet for it: remove or retarget that entry first. If it is wanted, create a decoration using operations and retarget its style to ai-decoration-KEY. Match the actual DOM: text decorations use [data-component-part="text"], not invented h2 markup. Choose the correction from the user's request. Do not discard valid work or add unrelated artistic changes.
Use supplied availableTargets and actual layer IDs. styles and operations use the normal full design tools for any additional corrections; CSS is still general-purpose, isolated, and in native 1920x1080 units. Return empty arrays when no additions are needed. Aim under 400 tokens; revisions alone often suffice.`;

export function proposalRepairSchema(hub: Hub, plan: HubPlan): Record<string, any> {
  const schema = designResponseSchema(hub);
  const index = { type: 'integer', minimum: 0, maximum: Math.max(0, plan.operations.length - 1) };
  schema['required'] = [...schema['required'], 'revisions'];
  schema['properties'].revisions = { type: 'array', maxItems: 16, items: { oneOf: [
    { type: 'object', additionalProperties: false, required: ['index', 'action'], properties: { index, action: { const: 'remove' } } },
    { type: 'object', additionalProperties: false, required: ['index', 'action', 'target'], properties: { index, action: { const: 'retarget' }, target: designTargetSchema(hub) } },
  ] } };
  return schema;
}

export function applyProposalRepair(raw: string, hub: Hub, base: HubPlan): HubPlan {
  const value = parseModelJson(raw) as { summary: string; revisions: { index: number; action: 'remove' | 'retarget'; target?: string }[]; styles: unknown[]; operations: unknown[] };
  const validate = new Ajv({ allErrors: true, strict: false }).compile(proposalRepairSchema(hub, base));
  if (!validate(value)) throw new HubPlanError([{ code: 'schema', layerIds: [], message: `Return a complete proposal correction with revisions, styles and operations: ${validate.errors?.slice(0, 3).map(error => `${error.instancePath} ${error.message}`).join('; ')}` }]);
  if (!value.revisions.length && !value.styles.length && !value.operations.length) throw new HubPlanError([{ code: 'no-change', layerIds: [], message: 'Correct an invalid proposal entry using its index.' }]);
  const revised = structuredClone(base);
  const removals = new Set<number>(), edited = new Set<number>();
  for (const change of value.revisions) {
    if (edited.has(change.index) || !revised.operations[change.index]) throw new HubPlanError([{ code: 'schema', layerIds: [], message: 'Each revision index must identify one distinct existing proposal entry.' }]);
    edited.add(change.index);
    if (change.action === 'remove') removals.add(change.index);
    else {
      const entry = revised.operations[change.index];
      if (!entry.target) throw new HubPlanError([{ code: 'schema', layerIds: [], message: 'Only entries that already have a target can be retargeted.' }]);
      entry.target = change.target;
    }
  }
  revised.operations = revised.operations.filter((_, index) => !removals.has(index));
  if (value.styles.length || value.operations.length) {
    const addition = parseDesignResponse(JSON.stringify({ summary: value.summary, styles: value.styles, operations: value.operations }), 'edit');
    // Creations must precede both retargeted styles and added styles.
    const creations = addition.operations.filter(operation => ['add', 'decoration'].includes(operation.op));
    revised.operations = [...creations, ...revised.operations, ...addition.operations.filter(operation => !creations.includes(operation))];
  }
  revised.summary = value.summary;
  if (!revised.operations.length) throw new HubPlanError([{ code: 'no-change', layerIds: [], message: 'The correction discarded the entire proposal. Retain the requested valid changes.' }]);
  return parseHubPlan(JSON.stringify(revised));
}

export function proposalRepairMessages(plan: HubPlan, issues: LayoutIssue[], hub: Hub, instruction: string) {
  const failedIndices = new Set(issues.map(issue => Number(issue.path?.match(/^\/operations\/(\d+)/)?.[1])).filter(Number.isInteger));
  return [{ role: 'system' as const, content: HUB_PROPOSAL_REPAIR_PROMPT }, { role: 'user' as const, content: JSON.stringify({
    instruction, issues, availableTargets: hubTargetInventory(hub.layers),
    proposal: plan.operations.map((operation, index) => ({ ...operation, index, css: failedIndices.has(index) ? operation.css : undefined })),
  }) }];
}
