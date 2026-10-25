import { Injectable, OnDestroy, signal } from '@angular/core';
import { Hub } from '../../../shared/types/hub.types';
import { HubPlan, HubPlanError, LayoutIssue, compileHubPlan, hubContext } from './hub-plan';
import { DESIGN_BRIEF_PROMPT, HUB_DESIGN_PROMPT, HUB_REPAIR_PROMPT, DesignBrief, parseDesignBrief, parseDesignResponse, designBriefSchema, designResponseSchema, designContext, designConstraintIssues, functionalDesignIssues, createBroadcastScaffold } from './hub-design-spec';
import { applyProposalRepair, proposalRepairMessages, proposalRepairSchema } from './hub-proposal-repair';
import { hubTargetInventory } from './hub-targets';
import { hubDesignKnowledge } from './hub-design-references';
import { HUB_REPAIR_LIMITS, HUB_PHASE_LIMITS, RepairStopReason, ValidationFailure, candidateFingerprint, repairFeedback, repairStopReason, stoppedRepairMessage, validationSummary } from './hub-repair';
import { HUB_REVIEW_PROMPT, HUB_IMAGE_REVIEW_PROMPT, HUB_REVIEW_DECODE_SCHEMA, HubDesignReview, RenderedHub, parseHubReview, validateVisualReview, reviewShowsImprovement, qualityFeedback, renderedLayoutIssues, renderedFailureCount } from './hub-quality';
import { HUB_IMAGE_REVIEW_GRAMMAR } from './hub-review-grammar';
import type { IntentCheck } from './hub-intent';
import type { RenderedHubReport } from './hub-quality';
import { composeReviewComparison } from './hub-render-review';
import { getPredefinedHubTemplate } from '../../../shared/templates/predefined-hub-templates';
import { PreviewResourceError } from './hub-preview-readiness';
import { APPROVED_HUB_REFERENCE_RECORDS } from './hub-design-knowledge';
import { referenceCssContext } from './hub-reference-records';
import { rosterFlowRecovery, compactRepairEvidence } from './hub-layout-recovery';
import { HUB_REASONING_LIMITS } from './hub-reasoning';
import { rosterFields } from '../../../shared/helpers/roster-fields';
import { LayerType } from '../../../shared/types/layer.types';
import { HubDiagnosticRun, diagnosticHub, diagnosticValue } from './hub-diagnostics';
import { HubRequirement, requestClauses, uncoveredClauses } from './hub-request-checks';
import { VisualReference, NATIVE_VISUAL_REFERENCES, selectVisualReferences, visualReferenceContext } from './hub-visual-library';

export const LOCAL_MODELS = [
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen 3 · 4B (detailed editing)', download: '~2.5 GB', memory: '~3.4 GB GPU memory', vision: false },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen 3 · 1.7B (basic customization)', download: '~1 GB', memory: '~2 GB GPU memory', vision: false },
  { id: 'Phi-3.5-vision-instruct-q4f16_1-MLC', label: 'Phi 3.5 Vision (image-based design review)', download: '~3 GB', memory: '~4.5 GB GPU memory', vision: true },
];
export type AiProposal = { hub: Hub; plan: HubPlan; warnings: LayoutIssue[]; base: string; metrics: Record<string, unknown>; raw: string };
export type GenerateOptions = { inspect?: (hub: Hub, image: boolean, requirements?: HubRequirement[]) => Promise<RenderedHub>; review?: boolean; interpret?: boolean; visionReview?: boolean; reasoning?: boolean;
  references?: VisualReference[]; referenceCss?: boolean };
const VISION_REVIEWER = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
type ReviewedCandidate = { compiled: ReturnType<typeof compileHubPlan>; plan: HubPlan; raw: string; checks?: IntentCheck[]; review?: HubDesignReview; reviewKind?: string };
type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
class LocalAiTimeoutError extends Error {}
class LocalAiPhaseTimeoutError extends Error {}

@Injectable()
export class LocalAiService implements OnDestroy {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'generating' | 'unloading'>('idle');
  readonly progress = signal(0);
  readonly status = signal('Model not loaded');
  readonly error = signal('');
  readonly raw = signal('');
  readonly metrics = signal<Record<string, unknown>>({});
  readonly validationNotice = signal('');
  readonly diagnostics = signal<HubDiagnosticRun | null>(null);
  private worker?: Worker;
  private pending = new Map<string, Pending>();
  private epoch = 0;
  private activeAttempt = 0;
  private sessionModel = '';
  private now = () => performance.now();

  async compatibility(): Promise<string> {
    if (!globalThis.isSecureContext) return 'Local AI needs HTTPS or localhost.';
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } }).gpu;
    if (!gpu) return 'WebGPU is unavailable. Try a recent Chrome or Edge with hardware acceleration enabled. The manual editor remains available.';
    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter) return 'No compatible WebGPU adapter was found. Enable hardware acceleration or use another device.';
      if (!adapter.features.has('shader-f16')) return 'This model needs WebGPU shader-f16 support. Try an updated browser and GPU driver.';
    } catch { return 'The browser could not access a WebGPU adapter.'; }
    return '';
  }

  async initialize(model: string) {
    if (this.state() !== 'idle') return;
    const epoch = ++this.epoch;
    this.state.set('loading'); this.error.set(''); this.progress.set(0); this.validationNotice.set('');
    try {
      const reason = await this.compatibility();
      if (epoch !== this.epoch) return;
      if (reason) throw new Error(reason);
      this.status.set('Downloading / initializing model…');
      this.worker = new Worker(new URL('./local-ai.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        if (!this.pending.has(data.id)) return;
        if (data.type === 'configuration') {
          const call = this.diagnostics()?.calls.find(call => call.id === data.id);
          if (call) call.configuration = data.payload;
          return;
        }
        if (['tokens', 'review-tokens', 'interpret-tokens'].includes(data.type)) this.diagnostics()?.partial(data.id, data.payload);
        if (data.type === 'progress') { this.progress.set(data.payload.progress); this.status.set(data.payload.text); return; }
        if (data.type === 'tokens') { this.raw.set(data.payload); this.status.set(`${this.attemptStatus()} · ${data.payload.length} characters`); return; }
        if (data.type === 'review-tokens') { this.status.set(`Reviewing design · ${data.payload.length} characters`); return; }
        if (data.type === 'interpret-tokens') { this.status.set(`Understanding your request · ${data.payload.length} characters`); return; }
        if (data.type === 'reasoning-progress') { this.status.set('Planning the design before writing CSS…'); return; }
        const pending = this.pending.get(data.id)!;
        clearTimeout(pending.timer); this.pending.delete(data.id);
        if (data.type === 'error') pending.reject(new Error(data.payload)); else pending.resolve(data.payload);
      };
      this.worker.onerror = event => { this.error.set(event.message || 'The AI worker stopped.'); this.release(); };
      const result = await this.request('init', { model }, 600_000);
      if (epoch !== this.epoch) return;
      this.metrics.set({ model, ...result });
      this.sessionModel = model;
      this.state.set('ready'); this.status.set('Local model ready');
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.error.set(message(error)); this.release();
    }
  }

  async generate(hub: Hub, instruction: string, mode: 'create' | 'edit' = 'create', options: GenerateOptions = {}): Promise<AiProposal | null> {
    if (this.state() !== 'ready' || !instruction.trim()) return null;
    if (instruction.length > 6000) { this.error.set('The instruction exceeds the local model input budget of 6000 characters. Split it into successive edits.'); return null; }
    const epoch = this.epoch;
    const base = hubFingerprint(hub);
    const snapshot = structuredClone(hub);
    const scaffold = createBroadcastScaffold();
    const currentDesign = mode === 'edit' ? snapshot : { ...snapshot, layout: scaffold, layers: scaffold.layers! };
    this.state.set('generating'); this.error.set(''); this.raw.set('');
    this.validationNotice.set(''); this.activeAttempt = 0;
    const start = this.now();
    const initialization = Object.fromEntries(Object.entries(this.metrics()).filter(([key]) => ['model', 'initializationMs', 'estimatedVramMB'].includes(key)));
    const knowledge = hubDesignKnowledge(instruction);
    const references = selectVisualReferences(instruction, options.references ?? NATIVE_VISUAL_REFERENCES);
    const vision = LOCAL_MODELS.find(model => model.id === initialization['model'])?.vision ?? false;
    const generatorModel = String(initialization['model'] ?? LOCAL_MODELS[0].id);
    const diagnostic = new HubDiagnosticRun(instruction, mode, generatorModel, {
      interpret: options.interpret !== false, review: options.review !== false,
      visionReview: !!options.visionReview, reasoning: !!options.reasoning,
      referenceCss: !!options.referenceCss, referenceIds: references.map(reference => reference.id),
    }, snapshot, currentDesign);
    this.diagnostics.set(diagnostic);
    this.metrics.set(initialization);
    const separateReviewer = !!options.visionReview && !vision && options.review !== false;
    const imageReview = vision || separateReviewer;
    this.sessionModel ||= generatorModel;
    const modelSwitches: Record<string, unknown>[] = [];
    const phases: { phase: string; durationMs: number; error?: string; readiness?: unknown }[] = [];
    let failedPhase: string | undefined;
    const inspectPreview = async (candidate: Hub, image: boolean, phase: string): Promise<RenderedHub> => {
      const phaseStart = this.now();
      const timing: (typeof phases)[number] = { phase, durationMs: 0 }; phases.push(timing);
      try {
        const rendered = await this.withinBudget(options.inspect!(candidate, image, intent?.requirements), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start), phase);
        diagnostic.stage(phase, candidate, rendered);
        return rendered;
      } catch (error) {
        if (phase === 'current-preview' || phase === 'proposal-preview' || phase === 'local-layout-correction') failedPhase = phase;
        timing.error = message(error);
        if (error instanceof PreviewResourceError) timing.readiness = error.readiness;
        throw error;
      } finally { timing.durationMs = this.now() - phaseStart; }
    };
    let intent: DesignBrief | undefined;
    let baseline: RenderedHubReport | undefined;
    const interpretation: Record<string, unknown>[] = [];
    if (options.interpret !== false) {
      try {
        this.status.set('Understanding your request…');
        const input = { mode, instruction, availableTargets: Object.keys(hubTargetInventory(currentDesign.layers).aliases),
          components: currentDesign.layers.filter(layer => [LayerType.LolScorebug, LayerType.LolPlayerRoster].includes(layer.type)).map(layer => ({
            id: layer.id, width: layer.width, height: layer.height, x: layer.position.x, y: layer.position.y,
            ...(layer.type === LayerType.LolPlayerRoster ? { team: layer.team, rowFields: rosterFields(layer) } : {}) })),
          ...(mode === 'edit' ? { additionalLayers: hub.layers.filter(layer => !['LolScorebug', 'LolPlayerRoster'].includes(layer.type)).slice(0, 16).map(layer => ({ id: layer.id, name: layer.name })) } : {}) };
        const messages: { role: string; content: string }[] = [{ role: 'system', content: DESIGN_BRIEF_PROMPT },
          { role: 'user', content: JSON.stringify(input) }];
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await this.request('interpret', { messages, schema: designBriefSchema(currentDesign) }, Math.max(1, HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start)));
          if (epoch !== this.epoch) return null;
          interpretation.push(result);
          if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw new LocalAiTimeoutError('Instruction interpretation reached the shared deadline.');
          try { intent = parseDesignBrief(result.raw, instruction); break; }
          catch (error) {
            if (attempt) throw error;
            messages.push({ role: 'assistant', content: candidateFingerprint(result.raw) },
              { role: 'user', content: `${message(error)} Return a SHORT complete brief: one-sentence summary, group goals into 1-4 phrases, prefer alias targets, empty preservation arrays unless explicitly requested. Avoid enumerating layers or duplicating the instruction.` });
          }
        }
        if (!intent?.goals.length) {
          this.metrics.set({ ...initialization, interpretation, understoodRequest: intent, totalMs: this.now() - start, stopReason: 'no-actionable-change' });
          this.error.set(intent?.unresolved.length ? `This builder cannot yet ${intent.unresolved.join('; ')}. No editor changes were made.`
            : 'The request only preserves existing settings. No editor changes were needed.');
          diagnostic.finish('no-actionable-change', this.error());
          this.state.set('ready'); this.status.set('No applicable changes.'); return null;
        }
        this.metrics.set({ ...initialization, interpretation, understoodRequest: intent });
        if (options.inspect && mode === 'edit') {
          this.status.set('Measuring the current hub…');
          baseline = (await inspectPreview(snapshot, false, 'current-preview')).measurements;
          if (epoch !== this.epoch) return null;
        }
      } catch (error) {
        if (epoch !== this.epoch) return null;
        const timedOut = error instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs;
        this.error.set(failedPhase ? `${message(error)} No editor changes were made.` : timedOut ? 'The shared ten-minute limit was reached while understanding the request. No editor changes were made.'
          : `Could not interpret this request: ${message(error)} No editor changes were made.`);
        this.metrics.set({ ...initialization, interpretation, phases, failedPhase, totalMs: this.now() - start, failed: true, stopReason: failedPhase ? 'preview-error' : timedOut ? 'time-limit' : 'interpretation-error' });
        diagnostic.finish('failed', this.error());
        this.release(); this.status.set('Stopped; no editor changes were made.'); return null;
      }
    }
    const originalMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [{ role: 'system', content: HUB_DESIGN_PROMPT }];
    const reference = APPROVED_HUB_REFERENCE_RECORDS.find(record => record.id === knowledge[0].source.toLowerCase())!;
    const context = `${mode.toUpperCase()} the supplied native hub. Current structure and CSS: ${JSON.stringify(designContext(currentDesign, intent, options.reasoning ? 5500 : 8500))}\nHuman-annotated craftsmanship evidence (not mandatory looks): ${JSON.stringify(visualReferenceContext(references))}${options.referenceCss ? `\nOptional CSS examples: ${JSON.stringify(referenceCssContext(reference, mode === 'edit' ? 900 : 1600))}` : ''}`;
    originalMessages.push({ role: 'user', content: `${context}${intent ? `\nDesign brief (descriptive, not permissions): ${JSON.stringify(intent)}` : ''}\nOriginal user instruction: ${instruction}` });
    let messages = originalMessages;
    let instructionSchema: Record<string, any> = designResponseSchema(currentDesign);
    // Phi can otherwise finish the design and loop on whitespace before emitting
    // the final operations field. Emit that field first, with a complete example.
    if (vision) instructionSchema = { ...instructionSchema, properties: { operations: instructionSchema['properties'].operations,
      ...Object.fromEntries(Object.entries(instructionSchema['properties']).filter(([key]) => key !== 'operations')) } };
    let schema = instructionSchema;
    let repairBase: HubPlan | undefined;
    let proposalRepairBase: HubPlan | undefined;
    let repairIssues: LayoutIssue[] = [];
    let repairHub: Hub | undefined;
    let repairMeasurements: RenderedHubReport | undefined;
    let localRecoveryTried = false;
    const attempts: Record<string, any>[] = [];
    const failures: ValidationFailure[] = [];
    let stopReason: RepairStopReason | null = null;
    let lastIssues: LayoutIssue[] = [];
    let qualityRefinements = 0;
    let refinementBudget: { remainingMs: number; estimatedMs: number; skipped: boolean } | undefined;
    let best: ReviewedCandidate | undefined;
    let approvedImage: string | undefined;
    let previousImage: string | undefined;
    let previousReview: HubDesignReview | undefined;
    const reasoning: Record<string, unknown> = { requested: !!options.reasoning, supported: generatorModel.startsWith('Qwen3-'), applied: false, limits: HUB_REASONING_LIMITS };
    const runMetrics = () => ({ ...initialization, pipelineVersion: '2026-10-23-css-authoring-evidence-v6', totalMs: this.now() - start, reasoning,
      referenceContext: visualReferenceContext(references), referenceCssEnabled: !!options.referenceCss,
      requestClauses: requestClauses(instruction), uncoveredClauses: uncoveredClauses(instruction, intent?.requirements ?? []),
      localCorrections: attempts.filter(attempt => attempt.localRepair?.applied).length,
      repairAttempts: Math.max(0, attempts.length - 1), attempts,
      limits: HUB_REPAIR_LIMITS, phaseLimits: HUB_PHASE_LIMITS, phases, failedPhase, interpretation, understoodRequest: intent, qualityRefinements, refinementBudget, modelSwitches, visionReviewRequested: separateReviewer, refinementStopReason: stopReason ?? undefined, knowledgeSources: knowledge.map(example => example.source) });
    const publish = (candidate: ReviewedCandidate, reason = 'validated'): AiProposal => {
      diagnostic.proposed = diagnosticHub(candidate.compiled.hub);
      diagnostic.stage('published', candidate.compiled.hub, { plan: candidate.plan, warnings: candidate.compiled.warnings });
      diagnostic.finish(reason);
      const metrics = { ...runMetrics(), stopReason: reason,
        requestChecks: candidate.checks,
        designReview: candidate.review ? { kind: candidate.reviewKind, ...candidate.review } : undefined,
        assessment: { validity: 'passed', instruction: { verified: candidate.checks?.filter(check => check.status === 'verified').length ?? 0,
          limited: candidate.checks?.filter(check => check.status === 'limited').length ?? 0, unverified: candidate.checks?.filter(check => check.status === 'unverified').length ?? 0 },
          visual: candidate.reviewKind === 'image' ? 'reviewed-advisory' : 'not-assessed', reviewModel: candidate.reviewKind === 'image' ? VISION_REVIEWER : generatorModel },
        composition: mode === 'create' ? candidate.plan.design : snapshot.layout?.['aiDesign'] };
      this.metrics.set(metrics); this.raw.set(candidate.raw);
      if (this.state() !== 'idle') this.state.set('ready');
      this.status.set('Validated proposal ready to preview');
      this.validationNotice.set(reason === 'quality-limit' || reason === 'reviewed-with-suggestions' ? 'Showing a valid proposal with remaining design suggestions.'
        : attempts.some(attempt => attempt.localRepair?.applied) ? 'Corrected the player-grid allocation and verified the rendered result.'
        : attempts.length > 1 ? `Layout validated after ${attempts.length - 1} automatic correction${attempts.length === 2 ? '' : 's'}.` : '');
      return { ...candidate.compiled, plan: candidate.plan, raw: candidate.raw, base, metrics };
    };
    try {
      if (options.reasoning && generatorModel.startsWith('Qwen3-')) {
        const remaining = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
        if (remaining < HUB_REASONING_LIMITS.reserveMs + HUB_REASONING_LIMITS.hardLimitMs) reasoning['skipped'] = 'Preserved time for CSS generation and validation.';
        else {
          this.status.set('Planning the design before writing CSS…');
          const reasonStart = this.now();
          const phase: (typeof phases)[number] = { phase: 'design-reasoning', durationMs: 0 }; phases.push(phase);
          try {
            const draft = await this.withinBudget(this.request('reason', { input: { instruction, mode, designPlan: intent?.designPlan,
              constraints: intent?.constraints, current: designContext(currentDesign, intent, 1800) } }, remaining), remaining,
              'Design reasoning', HUB_REASONING_LIMITS.hardLimitMs);
            if (epoch !== this.epoch) return null;
            const { notes, ...diagnostics } = draft;
            Object.assign(reasoning, diagnostics, { applied: typeof notes === 'string' && notes.trim().length > 0 });
            if (reasoning['applied']) originalMessages[1].content =
              `Preliminary implementation notes (may be incomplete; verify them against the actual DOM and original request):\n${notes.slice(0, HUB_REASONING_LIMITS.maxNotesCharacters)}\nThese notes do not override the user's instruction or preservation constraints. Return the complete schema-constrained CSS proposal.\n${originalMessages[1].content}`;
          } catch (error) { phase.error = message(error); reasoning['error'] = message(error); throw error; }
          finally { phase.durationMs = this.now() - reasonStart; }
        }
      }
      for (let attempt = 0; attempt < HUB_REPAIR_LIMITS.maxAttempts; attempt++) {
        const remainingMs = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
        if (remainingMs <= 0) { stopReason = 'time-limit'; break; }
        this.activeAttempt = attempt + 1;
        this.status.set(`${this.attemptStatus()}…`);
        const record: Record<string, any> = { attempt: attempt + 1, kind: proposalRepairBase ? 'proposal-repair' : repairBase ? 'style-repair' : 'generation' };
        attempts.push(record);
        this.metrics.set(runMetrics());
        const requestStart = this.now();
        const result = await this.request(repairBase || proposalRepairBase ? 'repair' : 'generate', { messages, schema, maxTokens: proposalRepairBase ? 900 : repairBase ? 1400 : mode === 'create' ? 2800 : 2200 }, remainingMs);
        record.durationMs = this.now() - requestStart;
        if (epoch !== this.epoch) return null;
        Object.assign(record, result);
        this.raw.set(result.raw);
        if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
        this.status.set(`Checking layout (attempt ${attempt + 1}/${HUB_REPAIR_LIMITS.maxAttempts})…`);
        let candidatePlan: HubPlan | undefined;
        try {
          if (result.finishReason === 'length') throw new HubPlanError([{ code: 'json', layerIds: [], message: 'The response reached its output-token budget. Return a smaller COMPLETE JSON response: group CSS selectors, omit repeated defaults and keep the summary short.' }]);
          let plan: HubPlan;
          if (proposalRepairBase) {
            record.patchRaw = result.raw;
            plan = applyProposalRepair(result.raw, currentDesign, proposalRepairBase);
            result.raw = JSON.stringify(plan);
            record.raw = result.raw; this.raw.set(result.raw);
          } else if (repairBase) {
            record.patchRaw = result.raw;
            const patch = parseDesignResponse(result.raw, 'edit');
            plan = { ...structuredClone(repairBase), summary: patch.summary || repairBase.summary, operations: [...repairBase.operations, ...patch.operations] };
            result.raw = JSON.stringify(plan);
            record.raw = result.raw; this.raw.set(result.raw);
          } else {
            plan = parseDesignResponse(result.raw, mode);
          }
          candidatePlan = plan;
          let compiled = compileHubPlan(snapshot, plan);
          diagnostic.stage('compiled', compiled.hub, { attempt: attempt + 1, plan, warnings: compiled.warnings });
          repairHub = compiled.hub;
          const preservation = [...designConstraintIssues(intent, snapshot, compiled.hub), ...functionalDesignIssues(snapshot, compiled.hub, mode)];
          if (preservation.length) throw new HubPlanError(preservation);
          if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
          record.validation = { valid: true, issues: [] };
          let candidate: ReviewedCandidate = { compiled, plan, raw: result.raw };
          if (options.inspect) {
            this.status.set('Rendering and measuring the proposed hub…');
            let rendered = await inspectPreview(compiled.hub, false, 'proposal-preview');
            if (epoch !== this.epoch) return null;
            if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
            record.rendered = rendered.measurements;
            let readability = renderedLayoutIssues(rendered.measurements);
            const recovery = !localRecoveryTried && readability.length ? rosterFlowRecovery(compiled.hub, rendered.measurements) : [];
            if (recovery.length) {
              const recoveryStart = this.now();
              localRecoveryTried = true;
              const repairedPlan = { ...plan, operations: [...plan.operations, ...recovery] };
              const repaired = compileHubPlan(snapshot, repairedPlan);
              diagnostic.stage('local-recovery-trial', repaired.hub, { operations: recovery });
              const blocked = [...designConstraintIssues(intent, snapshot, repaired.hub), ...functionalDesignIssues(snapshot, repaired.hub, mode)];
              record.localRepair = { applied: false, kind: 'implicit-row-allocation', operations: recovery, before: rendered.measurements, blocked };
              if (!blocked.length) {
                this.status.set('Checking a correction to the player-grid allocation…');
                const checked = await inspectPreview(repaired.hub, false, 'layout-recovery-preview');
                if (epoch !== this.epoch) return null;
                if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
                const remaining = renderedLayoutIssues(checked.measurements);
                record.localRepair.after = checked.measurements;
                record.localRepair.issues = remaining;
                // A failed trial never changes the retained candidate. No local
                // loop and no relaxation of validity or preservation checks.
                if (!remaining.length) {
                  record.localRepair.applied = true;
                  plan = repairedPlan; candidatePlan = plan; compiled = repaired; repairHub = repaired.hub;
                  record.modelRaw = record.patchRaw ?? record.raw;
                  result.raw = JSON.stringify(plan); record.raw = result.raw; this.raw.set(result.raw);
                  rendered = checked; record.rendered = checked.measurements; readability = [];
                  compiled.warnings.push({ code: 'layout-recovery', layerIds: recovery.map(op => op.target!),
                    message: 'Corrected an unintended extra grid row that was shrinking item icons. Retained the authored colours, typography and frames; verified the result in preview.' });
                  candidate = { compiled, plan, raw: result.raw };
                }
              }
              record.localRepair.durationMs = this.now() - recoveryStart;
            }
            if (readability.length) throw new HubPlanError(readability);
            candidate.checks = intent ? intentChecks(intent, instruction, rendered) : undefined;
            record.requirementEvidence = rendered.requirementEvidence;
            record.requestChecks = candidate.checks;
            this.metrics.set(runMetrics());
            const missed = candidate.checks?.filter(check => check.status === 'failed') ?? [];
            if (missed.length) throw new HubPlanError(missed.map(check => ({ code: 'intent', layerIds: [], message: `${check.request}: ${check.detail}` })));
            for (const check of candidate.checks ?? []) if (check.status === 'limited') compiled.warnings.push({ code: 'intent-limit', layerIds: [], message: `${check.request}: ${check.detail}` });
            if (options.review === false) return publish(candidate);
            // Retain a readable native proposal even if its optional critique times out.
            if (!best) best = candidate;
            if (imageReview) {
              try {
                const captured = await inspectPreview(compiled.hub, true, 'preview-image');
                rendered.image = captured.image;
                rendered.measurements.teamAccents = captured.measurements.teamAccents;
              }
              catch (captureError) {
                if (epoch !== this.epoch) return null;
                if (captureError instanceof LocalAiTimeoutError) throw captureError;
                record.captureError = message(captureError);
              }
            }
            record.imageReview = { requested: imageReview, supplied: !!rendered.image, characters: rendered.image?.length ?? 0, model: imageReview ? VISION_REVIEWER : generatorModel };
            const evidence = { instruction, mode, measurements: rendered.measurements,
              requirements: intent?.requirements, checks: candidate.checks, remainingClauses: uncoveredClauses(instruction, intent?.requirements ?? []),
              design: plan.design ?? hubContext(compiled.hub).design,
              cases: knowledge.map(example => ({ source: example.source, evidence: example.evidence, why: example.why })) };
            this.status.set(imageReview ? 'Inspecting the rendered hub image…' : 'Reviewing the measured layout…');
            const imageEvidence = { instruction, measurements: rendered.measurements,
              requirements: intent?.requirements, checks: candidate.checks, remainingClauses: uncoveredClauses(instruction, intent?.requirements ?? []),
              principles: references[0]?.principles, companion: previousImage ? 'Previous proposal before refinement; retain improvements and identify regressions.' : `${references[0]?.title} craftsmanship example; its colours/layout are not requirements.`,
              previousReview };
            const text = `Review mode: ${imageReview && rendered.image ? 'image and measurements' : 'measurements only'}. ${JSON.stringify(imageReview && rendered.image ? imageEvidence : evidence)}${imageReview && rendered.image
              ? '\nAssess THIS image independently of the syntax example. In your summary name the actual team accent colours and one visible layout/type feature. Use fresh observations, not the example summary.' : ''}`;
            try {
              if (imageReview && !rendered.image) throw new Error('No preview image was available; visual quality was not assessed.');
              let reviewImage = rendered.image;
              if (imageReview && rendered.image) {
                try {
                  if (!approvedImage && !previousImage) {
                    const chosen = references[0];
                    if (chosen?.image) approvedImage = chosen.image;
                    else if (chosen?.templateId) {
                      const layout = getPredefinedHubTemplate(chosen.templateId)!.createLayout();
                      const reference = await inspectPreview({ ...snapshot, layout, layers: layout.layers! }, true, 'reference-image');
                      if (epoch !== this.epoch) return null;
                      approvedImage = reference.image;
                    }
                  }
                  const companion = previousImage ?? approvedImage;
                  if (companion) reviewImage = await this.withinBudget(composeReviewComparison(rendered.image, companion, previousImage ? 'PREVIOUS PROPOSAL' : `${references[0]?.title} — craftsmanship example`), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start), 'image-comparison');
                  record.imageReview.comparisonSupplied = reviewImage !== rendered.image;
                } catch (captureError) {
                  if (epoch !== this.epoch) return null;
                  if (captureError instanceof LocalAiTimeoutError) throw captureError;
                  record.imageReview.comparisonError = message(captureError);
                }
              }
              if (separateReviewer) {
                await this.switchModel(VISION_REVIEWER, start, modelSwitches);
                if (epoch !== this.epoch) return null;
                this.status.set('Phi is inspecting the rendered Qwen proposal…');
              }
              const reviewSchema = HUB_REVIEW_DECODE_SCHEMA;
              const reviewMessages: Record<string, unknown>[] = [
                { role: 'system', content: imageReview && rendered.image ? HUB_IMAGE_REVIEW_PROMPT : HUB_REVIEW_PROMPT },
              ];
              reviewMessages.push({ role: 'user', content: imageReview && reviewImage ? [{ type: 'image_url', image_url: { url: reviewImage } }, { type: 'text', text }] : text });
              const reviewStart = this.now();
              const reviewTiming: (typeof phases)[number] = { phase: imageReview ? 'image-review' : 'measurement-review', durationMs: 0 }; phases.push(reviewTiming);
              const reviewCall = async (payload: Record<string, unknown>) => {
                const remaining = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
                try { return await this.withinBudget(this.request('review', payload, remaining), remaining, reviewTiming.phase,
                  Math.max(1, (imageReview ? HUB_PHASE_LIMITS.imageReviewMs : HUB_PHASE_LIMITS.textReviewMs) - (this.now() - reviewStart))); }
                catch (error) { reviewTiming.error = message(error); throw error; }
                finally { reviewTiming.durationMs = this.now() - reviewStart; }
              };
              const reviewResult = await reviewCall({ schema: reviewSchema, messages: reviewMessages,
                ...(imageReview ? { grammar: HUB_IMAGE_REVIEW_GRAMMAR } : {}) });
              const parsedReview = parseHubReview(reviewResult.raw);
              if (imageReview) validateVisualReview(parsedReview);
              if (epoch !== this.epoch) return null;
              if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
              record.review = { kind: imageReview && rendered.image ? 'image' : 'measurements', model: imageReview ? VISION_REVIEWER : generatorModel, ...reviewResult };
              candidate.review = parsedReview;
              candidate.reviewKind = imageReview && rendered.image ? 'image' : 'measurements';
              record.review.result = candidate.review;
              previousImage = rendered.image; previousReview = candidate.review;
              if (candidate.reviewKind === 'measurements') candidate.review.summary = 'This review uses layout measurements. Visual quality was not assessed from an image.';
              if (separateReviewer) {
                await this.switchModel(generatorModel, start, modelSwitches);
                if (epoch !== this.epoch) return null;
              }
            } catch (reviewError) {
              if (epoch !== this.epoch) return null;
              if (reviewError instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw reviewError;
              record.reviewError = message(reviewError);
              const retained = best ?? candidate;
              retained.compiled.warnings.push({ code: 'review-unavailable', layerIds: [], message: 'The layout passed validation, but design review could not complete.' });
              this.release();
              return publish(retained, retained.review && !retained.review.approved ? 'reviewed-with-suggestions' : 'validated');
            }
            if (!qualityRefinements) best = candidate;
            else if (candidate.review && candidate.reviewKind === 'image' && reviewShowsImprovement(best?.review, candidate.review)) {
              best = candidate; record.comparisonDecision = 'Accepted evidenced improvement without reported regressions.';
            } else {
              record.comparisonDecision = 'Retained previous validated candidate: improvement not established or a regression was reported.';
              best?.compiled.warnings.push({ code: 'design-comparison', layerIds: [], message: record.comparisonDecision });
            }
            if (candidate.reviewKind === 'image' && candidate.review && !candidate.review.approved && candidate.review.issues.length && !qualityRefinements && attempt < HUB_REPAIR_LIMITS.maxAttempts - 1) {
              // Spend optional design time only when another generation, rendered
              // checks and critique are likely to fit. Use this device's observed
              // generation speed rather than starting a costly pass near the cap.
              const generationMs = Math.max(30_000, ...attempts.filter(item => item.kind === 'generation').map(item => item.durationMs ?? 0));
              const estimatedMs = Math.ceil(generationMs * 1.25) + HUB_PHASE_LIMITS.previewMs * 2
                + (imageReview ? HUB_PHASE_LIMITS.imageReviewMs : HUB_PHASE_LIMITS.textReviewMs)
                + (separateReviewer ? HUB_PHASE_LIMITS.modelSwitchMs * 2 : 0);
              const remainingMs = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
              refinementBudget = { remainingMs, estimatedMs, skipped: remainingMs < estimatedMs };
              if (!refinementBudget.skipped) {
                qualityRefinements++;
                repairBase = candidate.plan; repairHub = candidate.compiled.hub; proposalRepairBase = undefined; schema = instructionSchema;
                this.validationNotice.set('The layout is valid. Refining its design from the rendered review (1/1).');
                messages = [{ role: 'system', content: HUB_REPAIR_PROMPT }, { role: 'user', content: JSON.stringify({ instruction,
                  requirements: intent?.requirements, constraints: intent?.constraints, feedback: qualityFeedback(candidate.review, rendered.measurements),
                  current: designContext(candidate.compiled.hub, intent, 6500) }) }];
                continue;
              }
              best!.compiled.warnings.push({ code: 'design-budget', layerIds: [], message: 'Kept the validated proposal because another design pass was unlikely to finish within the shared time budget.' });
            }
          }
          if (!options.inspect && intent) {
            candidate.checks = intentChecks(intent, instruction);
            const missed = candidate.checks.filter(check => check.status === 'failed');
            if (missed.length) throw new HubPlanError(missed.map(check => ({ code: 'intent', layerIds: [], message: `${check.request}: ${check.detail}` })));
          }
          const chosen = best ?? candidate;
          return publish(chosen, chosen.review && !chosen.review.approved ? 'reviewed-with-suggestions' : 'validated');
        } catch (error) {
          if (!(error instanceof HubPlanError)) throw error;
          lastIssues = error.issues;
          record.validation = { valid: false, issues: error.issues };
          this.metrics.set(runMetrics());
          // Equal measurements do not mean equal proposals. An img-only patch
          // can be different CSS with no effect on its clipping parent.
          failures.push({ fingerprint: candidateFingerprint(record.patchRaw ?? result.raw), issues: error.issues });
          stopReason = repairStopReason(failures, this.now() - start);
          if (stopReason) break;
          this.validationNotice.set(`${validationSummary(error.issues)} Correcting automatically (${attempt + 1}/${HUB_REPAIR_LIMITS.maxAttempts - 1}).`);
          if (error.issues.some(issue => issue.code === 'design-preservation')) {
            // Appending an undo rule cannot restore an untouched source stylesheet.
            // Regenerate against the original hub, omitting the forbidden changes.
            repairBase = undefined; proposalRepairBase = undefined; schema = instructionSchema;
            messages = [...originalMessages, { role: 'assistant', content: candidateFingerprint(result.raw) },
              { role: 'user', content: `The explicit preservation boundary was violated. Return a corrected complete response against the ORIGINAL hub. Omit unrelated changes rather than adding undo CSS. ${JSON.stringify(error.issues)}` }];
            continue;
          }
          if (candidatePlan && error.issues.every(issue => issue.code === 'target')) {
            proposalRepairBase = candidatePlan; repairBase = undefined; repairIssues = error.issues;
            schema = proposalRepairSchema(currentDesign, candidatePlan);
            messages = proposalRepairMessages(candidatePlan, error.issues, currentDesign, instruction);
            continue;
          }
          if (proposalRepairBase && !candidatePlan) {
            messages = proposalRepairMessages(proposalRepairBase, [...repairIssues, ...error.issues], currentDesign, instruction);
            continue;
          }
          if (repairBase && !candidatePlan && error.issues.every(issue => ['json', 'schema', 'style'].includes(issue.code))) {
            messages = [{ role: 'system', content: `${HUB_REPAIR_PROMPT}\nThe previous patch was incomplete or invalid. Fix the original failures with a SHORT complete response.` },
              { role: 'user', content: JSON.stringify({ instruction, issues: [...repairIssues, ...error.issues], measurements: compactRepairEvidence(repairMeasurements), current: designContext(repairHub ?? currentDesign, intent, 4500) }) }];
            continue;
          }
          if (candidatePlan && error.issues.every(issue => ['readability', 'intent', 'design-preservation', 'bounds', 'collision', 'style'].includes(issue.code))) {
            proposalRepairBase = undefined;
            repairBase = candidatePlan ?? repairBase;
            repairIssues = error.issues;
            repairMeasurements = record.rendered;
            schema = instructionSchema;
            messages = [{ role: 'system', content: HUB_REPAIR_PROMPT },
              { role: 'user', content: JSON.stringify({ instruction, constraints: intent?.constraints, issues: error.issues,
                previousPatch: record.patchRaw, previousTrial: record.localRepair ? { applied: false, issues: record.localRepair.issues, blocked: record.localRepair.blocked } : undefined,
                measurements: compactRepairEvidence(repairMeasurements), current: designContext(repairHub ?? currentDesign, intent, 4500) }) }];
            continue;
          }
          // Keep the original instruction/snapshot and only the latest failed
          // candidate. Replaying all prior attempts would overflow local context.
          repairBase = undefined; proposalRepairBase = undefined; schema = instructionSchema;
          messages = [...originalMessages, { role: 'assistant', content: candidateFingerprint(result.raw) },
            { role: 'user', content: repairFeedback(error.issues, attempt + 1, mode) }];
        }
      }
    } catch (error) {
      if (epoch !== this.epoch) return null;
      stopReason = error instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs ? 'time-limit'
        : failedPhase ? 'preview-error' : 'runtime-error';
      if (attempts.length) attempts.at(-1)!.error = message(error);
      // A runtime failure may mean a lost GPU device. Terminate it instead of
      // queuing retries behind a failed or still-running inference.
      this.release();
    }
    stopReason ??= 'attempt-limit';
    if (stopReason === 'time-limit' && this.state() !== 'idle') this.release();
    if (best) {
      best.compiled.warnings.push({ code: 'design-suggestions', layerIds: [], message: `Further design refinement stopped (${stopReason}); this proposal passed layout and readability checks.` });
      return publish(best, 'quality-limit');
    }
    this.metrics.set({ ...runMetrics(), failed: true, stopReason, validationIssues: lastIssues });
    this.error.set(reasoning['error'] ? `Design reasoning stopped: ${reasoning['error']} Your current hub is unchanged. Try again with Think before styling turned off.`
      : stopReason === 'preview-error' ? `${phases.slice().reverse().find(phase => phase.error)?.error ?? 'The preview could not be prepared.'} Your current hub is unchanged.`
      : stoppedRepairMessage(stopReason, attempts.length, lastIssues));
    this.validationNotice.set('Automatic corrections stopped. No editor changes were made.');
    this.status.set('Generation stopped; no editor changes were made.');
    diagnostic.finish('failed', this.error());
    if (stopReason !== 'time-limit' && stopReason !== 'runtime-error' && stopReason !== 'preview-error') this.state.set('ready');
    return null;
  }

  cancel() { if (this.state() === 'generating') this.diagnostics()?.finish('cancelled'); this.release(); this.validationNotice.set(''); this.status.set('Cancelled. Load the cached model to continue.'); }
  private attemptStatus() {
    return this.activeAttempt > 1 ? `Correcting layout (${this.activeAttempt - 1}/${HUB_REPAIR_LIMITS.maxAttempts - 1})`
      : `Generating locally (attempt 1/${HUB_REPAIR_LIMITS.maxAttempts})`;
  }
  private async switchModel(model: string, start: number, switches: Record<string, unknown>[]) {
    if (this.sessionModel === model) return;
    const remaining = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
    if (remaining <= 0) throw new LocalAiTimeoutError('The shared deadline was reached during model switching.');
    this.status.set(model === VISION_REVIEWER ? 'Loading optional Phi visual reviewer…' : 'Restoring Qwen generator…');
    const result = await this.withinBudget(this.request('switch', { model }, remaining), remaining, 'model-switch', HUB_PHASE_LIMITS.modelSwitchMs);
    this.sessionModel = model;
    switches.push({ model, ...result });
    if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw new LocalAiTimeoutError('Model switching reached the shared deadline.');
  }
  private async withinBudget<T>(operation: Promise<T>, timeout: number, phase = 'preview', phaseLimit: number = HUB_PHASE_LIMITS.previewMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const label = ({ 'current-preview': 'Preparing the current preview', 'proposal-preview': 'Preparing the proposed preview',
      'local-layout-correction': 'Checking the fitted component layout',
      'preview-image': 'Capturing the preview image', 'reference-image': 'Capturing the comparison image', 'image-comparison': 'Preparing the image comparison',
      'measurement-review': 'Reviewing the layout measurements', 'image-review': 'Reviewing the preview image', 'model-switch': 'Switching the local model' } as Record<string, string>)[phase] ?? phase;
    try { return await Promise.race([operation, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(timeout <= phaseLimit ? new LocalAiTimeoutError(`The shared deadline was reached during ${phase}.`)
        : new LocalAiPhaseTimeoutError(`${label} did not finish within ${Math.ceil(phaseLimit / 1000)} seconds.`)), Math.max(0, Math.min(timeout, phaseLimit)));
    })]); } finally { if (timer) clearTimeout(timer); }
  }
  async unload() {
    if (this.state() !== 'ready') { this.cancel(); return; }
    this.state.set('unloading');
    try { await this.request('unload', {}, 5_000); } catch { /* Termination below also releases the worker. */ }
    this.release(); this.status.set('Model unloaded. Downloaded assets remain cached.');
  }
  ngOnDestroy() { if (this.state() === 'generating') this.diagnostics()?.finish('closed'); this.release(); }
  private request(kind: string, data: Record<string, unknown>, timeout: number): Promise<any> {
    const id = crypto.randomUUID();
    const call = this.state() === 'generating' ? this.diagnostics()?.call(id, kind, data) : undefined;
    const started = this.now();
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('Local model is not loaded.')); return; }
      const timer = setTimeout(() => { this.pending.delete(id); reject(new LocalAiTimeoutError('Local AI timed out.')); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, kind, ...data });
    }).then(result => {
      if (call) Object.assign(call, { status: 'completed', durationMs: this.now() - started, response: diagnosticValue(result) });
      return result;
    }, error => {
      if (call) Object.assign(call, { status: 'failed', durationMs: this.now() - started, error: message(error) });
      throw error;
    });
  }
  private release() {
    this.epoch++;
    this.worker?.terminate(); this.worker = undefined;
    this.sessionModel = '';
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Local AI stopped.')); }
    this.pending.clear(); this.state.set('idle');
  }
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
export const hubFingerprint = (hub: Hub) => JSON.stringify([hub._id, hub.layout, hub.layers]);
const intentChecks = (brief: DesignBrief, instruction: string, rendered?: RenderedHub): IntentCheck[] => [
  ...(brief.requirements ?? []).map(requirement => rendered?.requirementEvidence?.find(item => JSON.stringify(item.requirement) === JSON.stringify(requirement))?.check
    ?? { request: requirement.quote, status: 'unverified' as const, detail: 'No rendered evidence was supplied for this requirement.' }),
  ...(brief.requirements?.length ? uncoveredClauses(instruction, brief.requirements) : brief.goals).map(request => ({ request, status: 'unverified' as const,
    detail: 'Retained from the request; not fully covered by a measured check. Review visually.' })),
  ...brief.constraints.map(constraint => ({ request: constraint.request, status: 'verified' as const, detail: `Preserved ${constraint.aspect} on ${constraint.target}.` })),
  ...brief.unresolved.map(request => ({ request, status: 'limited' as const, detail: 'Requires functionality outside the current component contract.' })),
];
