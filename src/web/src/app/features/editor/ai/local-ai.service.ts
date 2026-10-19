import { Injectable, OnDestroy, signal } from '@angular/core';
import { Hub } from '../../../shared/types/hub.types';
import { HubPlan, HubPlanError, LayoutIssue, compileHubPlan, hubContext } from './hub-plan';
import { HUB_EDIT_PROMPT, editSchemaForInstruction, parseHubEditSpec } from './hub-edit-spec';
import { HUB_CREATE_PROMPT, compositionSchemaForInstruction, compositionRepairSchema, parseHubCreateSpec, validateCompositionContrast } from './hub-create-spec';
import { hubDesignKnowledge } from './hub-design-references';
import { HUB_REPAIR_LIMITS, RepairStopReason, ValidationFailure, candidateFingerprint, repairFeedback, repairStopReason, stoppedRepairMessage, validationSummary } from './hub-repair';
import { HUB_REVIEW_PROMPT, HUB_IMAGE_REVIEW_PROMPT, HUB_REVIEW_SCHEMA, HUB_REVIEW_DECODE_SCHEMA, HubDesignReview, RenderedHub, parseHubReview, qualityFeedback, renderedLayoutIssues } from './hub-quality';
import { HUB_IMAGE_REVIEW_GRAMMAR } from './hub-review-grammar';
import { HUB_INTENT_PROMPT, HUB_INTENT_EXAMPLE, HUB_INTENT_CREATE_EXAMPLE, HUB_INTENT_GROW_EXAMPLE, HUB_INTENT_DECODE_SCHEMA, HubIntent, IntentCheck, parseHubIntent, resolveIntentPlan, checkHubIntent } from './hub-intent';
import type { RenderedHubReport } from './hub-quality';
import { composeReviewComparison } from './hub-render-review';
import { getPredefinedHubTemplate } from '../../../shared/templates/predefined-hub-templates';

export const LOCAL_MODELS = [
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen 3 · 4B (detailed editing)', download: '~2.5 GB', memory: '~3.4 GB GPU memory', vision: false },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen 3 · 1.7B (basic customization)', download: '~1 GB', memory: '~2 GB GPU memory', vision: false },
  { id: 'Phi-3.5-vision-instruct-q4f16_1-MLC', label: 'Phi 3.5 Vision (image-based design review)', download: '~3 GB', memory: '~4.5 GB GPU memory', vision: true },
];
export type AiProposal = { hub: Hub; plan: HubPlan; warnings: LayoutIssue[]; base: string; metrics: Record<string, unknown>; raw: string };
export type GenerateOptions = { inspect?: (hub: Hub, image: boolean) => Promise<RenderedHub>; review?: boolean; interpret?: boolean; visionReview?: boolean };
const VISION_REVIEWER = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
type ReviewedCandidate = { compiled: ReturnType<typeof compileHubPlan>; plan: HubPlan; raw: string; checks?: IntentCheck[]; review?: HubDesignReview; reviewKind?: string };
type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
class LocalAiTimeoutError extends Error {}

@Injectable()
export class LocalAiService implements OnDestroy {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'generating' | 'unloading'>('idle');
  readonly progress = signal(0);
  readonly status = signal('Model not loaded');
  readonly error = signal('');
  readonly raw = signal('');
  readonly metrics = signal<Record<string, unknown>>({});
  readonly validationNotice = signal('');
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
        if (data.type === 'progress') { this.progress.set(data.payload.progress); this.status.set(data.payload.text); return; }
        if (data.type === 'tokens') { this.raw.set(data.payload); this.status.set(`${this.attemptStatus()} · ${data.payload.length} characters`); return; }
        if (data.type === 'review-tokens') { this.status.set(`Reviewing design · ${data.payload.length} characters`); return; }
        if (data.type === 'interpret-tokens') { this.status.set(`Understanding your request · ${data.payload.length} characters`); return; }
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
    const epoch = this.epoch;
    const base = hubFingerprint(hub);
    const snapshot = structuredClone(hub);
    this.state.set('generating'); this.error.set(''); this.raw.set('');
    this.validationNotice.set(''); this.activeAttempt = 0;
    const start = this.now();
    const initialization = Object.fromEntries(Object.entries(this.metrics()).filter(([key]) => ['model', 'initializationMs', 'estimatedVramMB'].includes(key)));
    const knowledge = hubDesignKnowledge(instruction);
    const vision = LOCAL_MODELS.find(model => model.id === initialization['model'])?.vision ?? false;
    const generatorModel = String(initialization['model'] ?? LOCAL_MODELS[0].id);
    const separateReviewer = !!options.visionReview && !vision && options.review !== false;
    const imageReview = vision || separateReviewer;
    this.sessionModel ||= generatorModel;
    const modelSwitches: Record<string, unknown>[] = [];
    let intent: HubIntent | undefined;
    let baseline: RenderedHubReport | undefined;
    const interpretation: Record<string, unknown>[] = [];
    if (options.interpret !== false) {
      try {
        this.status.set('Understanding your request…');
        const input = { mode, instruction: instruction.slice(0, 1500) };
        const example = mode === 'create' ? HUB_INTENT_CREATE_EXAMPLE : HUB_INTENT_EXAMPLE;
        const examples = mode === 'create' ? [example] : [example, HUB_INTENT_GROW_EXAMPLE];
        const messages: { role: string; content: string }[] = [{ role: 'system', content: HUB_INTENT_PROMPT },
          ...examples.flatMap(item => [{ role: 'user', content: JSON.stringify(item.input) }, { role: 'assistant', content: JSON.stringify({ ...item.output,
            changes: item.output.changes.map(change => ({ ...change, check: Array.isArray(change.check) ? change.check : [change.check] })) }) }]),
          { role: 'user', content: JSON.stringify(input) }];
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await this.request('interpret', { messages, schema: HUB_INTENT_DECODE_SCHEMA }, Math.max(1, HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start)));
          if (epoch !== this.epoch) return null;
          interpretation.push(result);
          if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw new LocalAiTimeoutError('Instruction interpretation reached the shared deadline.');
          try { intent = parseHubIntent(result.raw, instruction.slice(0, 1500), mode); break; }
          catch (error) {
            if (attempt) throw error;
            messages.push({ role: 'assistant', content: candidateFingerprint(result.raw) },
              { role: 'user', content: `${message(error)} Return the complete interpretation JSON, retaining every requested change.` });
          }
        }
        if (!intent?.changes.length) {
          this.metrics.set({ ...initialization, interpretation, understoodRequest: intent, totalMs: this.now() - start, stopReason: 'no-actionable-change' });
          this.error.set(intent?.unresolved.length ? `This builder cannot yet ${intent.unresolved.join('; ')}. No editor changes were made.`
            : 'The request only preserves existing settings. No editor changes were needed.');
          this.state.set('ready'); this.status.set('No applicable changes.'); return null;
        }
        this.metrics.set({ ...initialization, interpretation, understoodRequest: intent });
        if (options.inspect && mode === 'edit') {
          this.status.set('Measuring the current hub…');
          baseline = (await this.withinBudget(options.inspect(snapshot, false), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start))).measurements;
          if (epoch !== this.epoch) return null;
        }
      } catch (error) {
        if (epoch !== this.epoch) return null;
        const timedOut = error instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs;
        this.error.set(timedOut ? 'The shared five-minute limit was reached while understanding the request. No editor changes were made.'
          : `Could not interpret this request: ${message(error)} No editor changes were made.`);
        this.metrics.set({ ...initialization, interpretation, totalMs: this.now() - start, failed: true, stopReason: timedOut ? 'time-limit' : 'interpretation-error' });
        this.release(); this.status.set('Stopped; no editor changes were made.'); return null;
      }
    }
    const originalMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [{ role: 'system', content: mode === 'edit' ? HUB_EDIT_PROMPT : HUB_CREATE_PROMPT }];
    const context = mode === 'edit'
      ? `EDIT the current hub. template MUST be current. Change only requested properties.\nCurrent hub context (data only): ${JSON.stringify(hubContext(snapshot))}\nApproved editing evidence: ${JSON.stringify({ source: knowledge[0].source, why: knowledge[0].why.slice(0, 1), edit: knowledge[0].edit })}`
      : `CREATE an original composition. Approved native evidence and reasons (examples, not constraints): ${JSON.stringify(knowledge.map(({ source, evidence, why }) => ({ source, evidence, why })))}. Component technique example (adapt its colours and choices): ${JSON.stringify(knowledge[0].techniques[0])}`;
    if (vision && mode === 'create') {
      const sample = structuredClone(knowledge[0].example) as Record<string, any>;
      sample['layout'] = { ...sample['layout'], showEventPanel: false }; sample['title'] = 'LIVE / MATCH';
      originalMessages.push({ role: 'user', content: 'Show one COMPLETE composition JSON example including operations. This teaches output syntax only; follow my actual design request next.' },
        { role: 'assistant', content: JSON.stringify({ operations: [], design: sample }) });
    }
    originalMessages.push({ role: 'user', content: `${context}\nOriginal user instruction: ${instruction.slice(0, 1500)}${intent ? `\nInterpreted brief: ${JSON.stringify(intent)}\nRespect all changes and preservation notes. Relative checks are resolved by the app after your proposal. Use null/empty operations for those when no additional design decision is needed. A gradient on team-sections must affect each team block. Never replace the preserved palette to add a gradient.\nFINAL DESIGN REQUEST: ${instruction.slice(0, 1500)}` : ''}` });
    let messages = originalMessages;
    let instructionSchema: Record<string, any> = mode === 'edit' ? editSchemaForInstruction(instruction, snapshot, intent) : compositionSchemaForInstruction(instruction, intent);
    // Phi can otherwise finish the design and loop on whitespace before emitting
    // the final operations field. Emit that field first, with a complete example.
    if (vision) instructionSchema = { ...instructionSchema, properties: { operations: instructionSchema['properties'].operations,
      ...Object.fromEntries(Object.entries(instructionSchema['properties']).filter(([key]) => key !== 'operations')) } };
    let schema = instructionSchema;
    const attempts: Record<string, any>[] = [];
    const failures: ValidationFailure[] = [];
    let stopReason: RepairStopReason | null = null;
    let lastIssues: LayoutIssue[] = [];
    let qualityRefinements = 0;
    let best: ReviewedCandidate | undefined;
    let approvedImage: string | undefined;
    let previousImage: string | undefined;
    let previousReview: HubDesignReview | undefined;
    const runMetrics = () => ({ ...initialization, totalMs: this.now() - start,
      repairAttempts: Math.max(0, attempts.length - 1), attempts,
      limits: HUB_REPAIR_LIMITS, interpretation, understoodRequest: intent, qualityRefinements, modelSwitches, visionReviewRequested: separateReviewer, refinementStopReason: stopReason ?? undefined, knowledgeSources: knowledge.map(example => example.source) });
    const publish = (candidate: ReviewedCandidate, reason = 'validated'): AiProposal => {
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
        : attempts.length > 1 ? `Layout validated after ${attempts.length - 1} automatic correction${attempts.length === 2 ? '' : 's'}.` : '');
      return { ...candidate.compiled, plan: candidate.plan, raw: candidate.raw, base, metrics };
    };
    try {
      for (let attempt = 0; attempt < HUB_REPAIR_LIMITS.maxAttempts; attempt++) {
        const remainingMs = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
        if (remainingMs <= 0) { stopReason = 'time-limit'; break; }
        this.activeAttempt = attempt + 1;
        this.status.set(`${this.attemptStatus()}…`);
        const record: Record<string, any> = { attempt: attempt + 1 };
        attempts.push(record);
        const result = await this.request('generate', { messages, schema }, remainingMs);
        if (epoch !== this.epoch) return null;
        Object.assign(record, result);
        this.raw.set(result.raw);
        if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
        this.status.set(`Checking layout (attempt ${attempt + 1}/${HUB_REPAIR_LIMITS.maxAttempts})…`);
        try {
          const parsed = mode === 'edit' ? parseHubEditSpec(result.raw, schema, !!intent?.changes.some(change => change.check !== 'none')) : parseHubCreateSpec(result.raw, schema);
          const plan = intent ? resolveIntentPlan(parsed, intent, snapshot, baseline) : parsed;
          if (plan.design) validateCompositionContrast(plan.design);
          const compiled = compileHubPlan(snapshot, plan);
          if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
          record.validation = { valid: true, issues: [] };
          const candidate: ReviewedCandidate = { compiled, plan, raw: result.raw };
          if (options.inspect) {
            this.status.set('Rendering and measuring the proposed hub…');
            const rendered = await this.withinBudget(options.inspect(compiled.hub, imageReview && options.review !== false), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start));
            if (epoch !== this.epoch) return null;
            if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
            record.rendered = rendered.measurements;
            const readability = renderedLayoutIssues(rendered.measurements);
            if (readability.length) throw new HubPlanError(readability);
            candidate.checks = intent ? checkHubIntent(intent, snapshot, compiled.hub, rendered.measurements, baseline, mode) : undefined;
            record.requestChecks = candidate.checks;
            this.metrics.set(runMetrics());
            const missed = candidate.checks?.filter(check => check.status === 'failed') ?? [];
            if (missed.length) throw new HubPlanError(missed.map(check => ({ code: 'intent', layerIds: [], message: `${check.request}: ${check.detail}` })));
            for (const check of candidate.checks ?? []) if (check.status === 'limited') compiled.warnings.push({ code: 'intent-limit', layerIds: [], message: `${check.request}: ${check.detail}` });
            if (options.review === false) return publish(candidate);
            // Retain a readable native proposal even if its optional critique times out.
            if (!best) best = candidate;
            record.imageReview = { requested: imageReview, supplied: !!rendered.image, characters: rendered.image?.length ?? 0, model: imageReview ? VISION_REVIEWER : generatorModel };
            const evidence = { instruction: instruction.slice(0, 1500), mode, measurements: rendered.measurements,
              design: plan.design ?? hubContext(compiled.hub).design,
              cases: knowledge.map(example => ({ source: example.source, evidence: example.evidence, why: example.why })) };
            this.status.set(vision ? 'Inspecting the rendered hub image…' : 'Reviewing the measured layout…');
            const imageEvidence = { instruction: instruction.slice(0, 1500), measurements: rendered.measurements,
              principles: knowledge[0].why, companion: previousImage ? 'Previous proposal before refinement; retain improvements and identify regressions.' : `Approved ${knowledge[0].source} craftsmanship example; its colours/layout are not requirements.`,
              previousReview };
            const text = `Review mode: ${imageReview && rendered.image ? 'image and measurements' : 'measurements only'}. ${JSON.stringify(imageReview && rendered.image ? imageEvidence : evidence)}${imageReview && rendered.image
              ? '\nAssess THIS image independently of the syntax example. In your summary name the actual team accent colours and one visible layout/type feature. Use fresh observations, not the example summary.' : ''}`;
            try {
              if (imageReview && !rendered.image) throw new Error('No preview image was available; visual quality was not assessed.');
              let reviewImage = rendered.image;
              if (imageReview && options.inspect && rendered.image) {
                try {
                  if (!approvedImage && !previousImage) {
                    const layout = getPredefinedHubTemplate(`${knowledge[0].source.toLowerCase()}-broadcast`)!.createLayout();
                    const reference = await this.withinBudget(options.inspect({ ...snapshot, layout, layers: layout.layers! }, true), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start));
                    if (epoch !== this.epoch) return null;
                    approvedImage = reference.image;
                  }
                  const companion = previousImage ?? approvedImage;
                  if (companion) reviewImage = await this.withinBudget(composeReviewComparison(rendered.image, companion, previousImage ? 'PREVIOUS PROPOSAL' : `${knowledge[0].source.toUpperCase()} — craftsmanship example`), HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start));
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
              const reviewSchema = imageReview ? { ...HUB_REVIEW_SCHEMA, properties: { issues: HUB_REVIEW_SCHEMA.properties.issues,
                ...Object.fromEntries(Object.entries(HUB_REVIEW_SCHEMA.properties).filter(([key]) => key !== 'issues')) } } : HUB_REVIEW_DECODE_SCHEMA;
              const reviewMessages: Record<string, unknown>[] = [
                { role: 'system', content: imageReview && rendered.image ? HUB_IMAGE_REVIEW_PROMPT : HUB_REVIEW_PROMPT },
              ];
              reviewMessages.push({ role: 'user', content: imageReview && reviewImage ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: reviewImage } }] : text });
              const reviewResult = await this.request('review', { schema: reviewSchema, messages: reviewMessages,
                ...(imageReview ? { grammar: HUB_IMAGE_REVIEW_GRAMMAR } : {}) }, HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start));
              if (epoch !== this.epoch) return null;
              if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) { stopReason = 'time-limit'; break; }
              record.review = { kind: imageReview && rendered.image ? 'image' : 'measurements', model: imageReview ? VISION_REVIEWER : generatorModel, ...reviewResult };
              candidate.review = parseHubReview(reviewResult.raw);
              candidate.reviewKind = imageReview && rendered.image ? 'image' : 'measurements';
              record.review.result = candidate.review;
              previousImage = rendered.image; previousReview = candidate.review;
              if (candidate.reviewKind === 'measurements') candidate.review.summary = `Readability/layout review only; visual appeal was not assessed. ${candidate.review.summary}`;
              if (separateReviewer) {
                await this.switchModel(generatorModel, start, modelSwitches);
                if (epoch !== this.epoch) return null;
              }
            } catch (reviewError) {
              if (epoch !== this.epoch) return null;
              if (reviewError instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw reviewError;
              record.reviewError = message(reviewError);
              if (separateReviewer) this.release();
              const retained = best ?? candidate;
              retained.compiled.warnings.push({ code: 'review-unavailable', layerIds: [], message: 'The layout passed validation, but design review could not complete.' });
              this.release();
              return publish(retained, retained.review && !retained.review.approved ? 'reviewed-with-suggestions' : 'validated');
            }
            if (!best || candidate.review?.approved && !best.review?.approved
              || candidate.review?.approved === best.review?.approved && (candidate.review?.score ?? 0) >= (best.review?.score ?? 0)) best = candidate;
            if (candidate.review && !candidate.review.approved && candidate.review.issues.length && !qualityRefinements && attempt < HUB_REPAIR_LIMITS.maxAttempts - 1) {
              qualityRefinements++;
              this.validationNotice.set('The layout is valid. Refining its design from the rendered review (1/1).');
              messages = [...originalMessages, { role: 'assistant', content: candidateFingerprint(result.raw) },
                { role: 'user', content: qualityFeedback(candidate.review, rendered.measurements) }];
              continue;
            }
          }
          if (!options.inspect && intent) {
            candidate.checks = checkHubIntent(intent, snapshot, compiled.hub, undefined, baseline, mode);
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
          failures.push({ fingerprint: candidateFingerprint(result.raw), issues: error.issues });
          stopReason = repairStopReason(failures, this.now() - start);
          if (stopReason) break;
          if (mode === 'create') schema = compositionRepairSchema(result.raw, error.issues, instructionSchema);
          this.validationNotice.set(`${validationSummary(error.issues)} Correcting automatically (${attempt + 1}/${HUB_REPAIR_LIMITS.maxAttempts - 1}).`);
          // Keep the original instruction/snapshot and only the latest failed
          // candidate. Replaying all prior attempts would overflow local context.
          messages = [...originalMessages, { role: 'assistant', content: candidateFingerprint(result.raw) },
            { role: 'user', content: repairFeedback(error.issues, attempt + 1, mode) }];
        }
      }
    } catch (error) {
      if (epoch !== this.epoch) return null;
      stopReason = error instanceof LocalAiTimeoutError || this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs ? 'time-limit' : 'runtime-error';
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
    this.error.set(stoppedRepairMessage(stopReason, attempts.length, lastIssues));
    this.validationNotice.set('Automatic corrections stopped. No editor changes were made.');
    this.status.set('Generation stopped; no editor changes were made.');
    if (stopReason !== 'time-limit' && stopReason !== 'runtime-error') this.state.set('ready');
    return null;
  }

  cancel() { this.release(); this.validationNotice.set(''); this.status.set('Cancelled. Load the cached model to continue.'); }
  private attemptStatus() {
    return this.activeAttempt > 1 ? `Correcting layout (${this.activeAttempt - 1}/${HUB_REPAIR_LIMITS.maxAttempts - 1})`
      : `Generating locally (attempt 1/${HUB_REPAIR_LIMITS.maxAttempts})`;
  }
  private async switchModel(model: string, start: number, switches: Record<string, unknown>[]) {
    if (this.sessionModel === model) return;
    const remaining = HUB_REPAIR_LIMITS.maxDurationMs - (this.now() - start);
    if (remaining <= 0) throw new LocalAiTimeoutError('The shared deadline was reached during model switching.');
    this.status.set(model === VISION_REVIEWER ? 'Loading optional Phi visual reviewer…' : 'Restoring Qwen generator…');
    const result = await this.request('switch', { model }, remaining);
    this.sessionModel = model;
    switches.push({ model, ...result });
    if (this.now() - start >= HUB_REPAIR_LIMITS.maxDurationMs) throw new LocalAiTimeoutError('Model switching reached the shared deadline.');
  }
  private async withinBudget<T>(operation: Promise<T>, timeout: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([operation, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new LocalAiTimeoutError('Design review reached the shared deadline.')), Math.max(0, timeout));
    })]); } finally { if (timer) clearTimeout(timer); }
  }
  async unload() {
    if (this.state() !== 'ready') { this.cancel(); return; }
    this.state.set('unloading');
    try { await this.request('unload', {}, 5_000); } catch { /* Termination below also releases the worker. */ }
    this.release(); this.status.set('Model unloaded. Downloaded assets remain cached.');
  }
  ngOnDestroy() { this.release(); }
  private request(kind: string, data: Record<string, unknown>, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('Local model is not loaded.')); return; }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new LocalAiTimeoutError('Local AI timed out.')); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, kind, ...data });
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
