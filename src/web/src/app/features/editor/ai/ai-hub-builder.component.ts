import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HubStore } from '../../../core/store/hub.store';
import { EditorStore } from '../components/editor.store';
import { HubPreviewComponent } from '../../hubs/components/hub-preview/hub-preview.component';
import { AiProposal, LOCAL_MODELS, LocalAiService, hubFingerprint } from './local-ai.service';
import { describeHubPlan, previewHub } from './hub-plan';
import { Hub } from '../../../shared/types/hub.types';
import { HubDesignReview } from './hub-quality';
import { inspectHubPreview, captureDiagnosticPreview } from './hub-render-review';
import { diagnosticHub, diagnosticValue, HubDiagnosticArchive } from './hub-diagnostics';
import { waitForPreviewPaint } from './hub-preview-readiness';
import { IntentCheck } from './hub-intent';
import type { DesignBrief } from './hub-design-spec';
import { measureRequirements } from './hub-request-checks';
import { HubVisualLibrary } from './hub-visual-library';
import { APPROVED_HUB_REFERENCE_RECORDS } from './hub-design-knowledge';
import { getPredefinedHubTemplate } from '../../../shared/templates/predefined-hub-templates';

@Component({
  selector: 'app-ai-hub-builder', standalone: true,
  imports: [CommonModule, HubPreviewComponent], providers: [LocalAiService],
  templateUrl: './ai-hub-builder.component.html', styleUrls: ['./ai-hub-builder.component.css'],
})
export class AiHubBuilderComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();
  readonly models = LOCAL_MODELS;
  model = LOCAL_MODELS[0].id;
  instruction = '';
  mode: 'create' | 'edit' = 'create';
  compatibility = signal('Checking WebGPU…');
  proposal = signal<AiProposal | null>(null);
  preview = signal<Hub | null>(null);
  reviewHub = signal<Hub | null>(null);
  diagnosticPreview = signal<Hub | null>(null);
  exporting = signal(false);
  exportNotice = signal('');
  reviewEnabled = true;
  visionReviewEnabled = false;
  reasoningEnabled = false;
  referenceCssEnabled = false;
  referenceNotes = '';
  addingReferences = signal(false);
  referenceExample = signal<Hub | null>(null);
  describePlan = describeHubPlan;
  notice = signal('');
  private previousFocus = document.activeElement as HTMLElement | null;
  readonly examples = [
    'Create a minimalist dark blue hub with a clean scoreboard at the top and player panels at the bottom.',
    'Create a CBLOL-inspired hub using reddish and off-white colors, with visible champion portraits, item slots, and team statistics.',
    'Make the champion portraits bigger, increase the spacing between player statistics, and move the scoreboard slightly higher.',
    'Create a futuristic esports overlay with a compact top scoreboard, ten player panels, individual CS and KDA statistics, and six item slots per player.',
  ];
  readonly exampleLabels = [
    { title: 'Minimal & clean', description: 'Dark blue, room to breathe' },
    { title: 'CBLOL inspired', description: 'Warm tones, bold presence' },
    { title: 'Refine the details', description: 'Portraits, spacing, alignment' },
    { title: 'Future of esports', description: 'Compact, sharp, stats ready' },
  ];
  constructor(public ai: LocalAiService, public hubs: HubStore, private editor: EditorStore, private element: ElementRef<HTMLElement>, private archive: HubDiagnosticArchive, public library: HubVisualLibrary) {}
  async ngOnInit() { this.compatibility.set(await this.ai.compatibility()); }
  ngAfterViewInit() { this.element.nativeElement.querySelector<HTMLElement>('button')?.focus(); }
  ngOnDestroy() { this.previousFocus?.focus(); }
  dialogKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Escape') { this.closed.emit(); return; }
    if (event.key !== 'Tab') return;
    const items = Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary'))
      .filter(el => el.checkVisibility());
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  get busy() { return this.exporting() || this.addingReferences() || ['loading', 'generating', 'unloading'].includes(this.ai.state()); }
  get diagnosticRun() { return this.ai.diagnostics() ?? this.archive.latest(); }
  get selectedModel() { return this.models.find(m => m.id === this.model)!; }
  get designReview() { return this.proposal()?.metrics['designReview'] as (HubDesignReview & { kind: string }) | undefined; }
  get understoodRequest() { return this.proposal()?.metrics['understoodRequest'] as DesignBrief | undefined; }
  get requestChecks() { return (this.proposal()?.metrics['requestChecks'] as IntentCheck[] | undefined) ?? []; }
  get stale() {
    const current = this.hubs.selectedHub();
    return !!this.proposal() && (!current || this.proposal()!.base !== hubFingerprint(current));
  }
  useExample(index: number) {
    this.instruction = this.examples[index];
    this.mode = index === 2 ? 'edit' : 'create';
    this.element.nativeElement.querySelector<HTMLTextAreaElement>('#ai-instruction')?.focus();
  }
  async generate() {
    const hub = this.hubs.selectedHub();
    if (!hub || this.busy) return;
    this.notice.set(''); this.proposal.set(null); this.preview.set(null);
    try {
      const pending = this.ai.generate(hub, this.instruction, this.mode, { review: this.reviewEnabled, visionReview: this.visionReviewEnabled,
        reasoning: this.reasoningEnabled && this.model.startsWith('Qwen3-'), references: this.library.entries(), referenceCss: this.referenceCssEnabled,
        inspect: async (candidate, image, requirements) => {
        const preview = previewHub(candidate, 'ai-render-review-');
        const sourceIds = new Map(preview.layers.map((layer, index) => [layer.id, candidate.layers[index].id]));
        this.reviewHub.set(preview);
        await waitForPreviewPaint();
        const root = this.element.nativeElement.querySelector<HTMLElement>('.review-stage .broadcast-preview');
        if (!root) throw new Error('The render review was cancelled.');
        const rendered = await inspectHubPreview(root, image, sourceIds);
        rendered.requirementEvidence = measureRequirements(root, candidate, requirements ?? [], sourceIds);
        return rendered;
      } });
      if (this.ai.diagnostics()) this.archive.latest.set(this.ai.diagnostics());
      const result = await pending;
      if (result) { this.proposal.set(result); this.preview.set(previewHub(result.hub)); }
    } finally {
      this.reviewHub.set(null);
      const run = this.ai.diagnostics();
      if (run) {
        run.metrics = diagnosticValue(this.ai.metrics()); run.raw = this.ai.raw(); run.error = this.ai.error();
        if (!run.outcome) run.finish('stopped', run.error || this.ai.status());
      }
    }
  }
  async addReferences(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (this.busy || !files.length) return;
    this.addingReferences.set(true);
    try { for (const file of files) await this.library.add(file, this.referenceNotes); }
    catch (error) { this.library.message.set(error instanceof Error ? error.message : String(error)); }
    finally { input.value = ''; this.addingReferences.set(false); }
  }
  showReferenceExample(templateId: string) {
    const template = getPredefinedHubTemplate(templateId);
    if (!template) return;
    const layout = template.createLayout();
    this.referenceExample.set(previewHub({ _id: templateId, hubName: templateId, layout, layers: layout.layers! }, 'ai-library-'));
  }
  exportReferences() {
    const data = { format: 'ai-hub-reference-library', version: 1, references: this.library.entries(), nativeSources: APPROVED_HUB_REFERENCE_RECORDS,
      note: 'Reference context and source examples only; no model training or automatic approval of generated designs.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ai-hub-reference-library.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  apply() {
    const proposal = this.proposal();
    if (!proposal || this.stale || this.busy) return;
    if (this.hubs.applyAiLayout(proposal.hub._id, proposal.hub.layout!, proposal.base)) {
      if (this.diagnosticRun) this.diagnosticRun.appliedAt = new Date().toISOString();
      this.editor.selectLayer(null);
      this.proposal.set(null); this.preview.set(null); this.instruction = '';
      this.mode = 'edit';
      this.notice.set('Applied. Continue editing, use Undo to revert, or Save to persist.');
    }
  }
  async exportEvaluation() {
    const run = this.diagnosticRun;
    if (!run || this.busy) return;
    this.exporting.set(true); this.exportNotice.set('Preparing diagnostic images…');
    const captures: Record<string, unknown> = {};
    const current = this.hubs.selectedHub();
    const data = { format: 'ai-hub-diagnostic', version: 1, capturedAt: new Date().toISOString(),
      run: diagnosticValue(run), editorAtExport: current ? diagnosticHub(current) : undefined,
      environment: { userAgent: navigator.userAgent, language: navigator.language, devicePixelRatio,
        viewport: { width: innerWidth, height: innerHeight }, secureContext: isSecureContext,
        webgpuAvailable: 'gpu' in navigator, hardwareConcurrency: navigator.hardwareConcurrency },
      captures,
      limitations: ['Internal thinking drafts are omitted; structured plans, prompts with draft text redacted, and thinking timings are included.',
        'Screenshots are re-rendered from the recorded layouts at export time. Per-stage measurements were captured during generation.',
        'Only the latest run is retained in memory in this tab. Export before reloading or starting another run.'] };
    let missingImages = 0;
    try {
      const targets = { baseline: run.baseline, result: run.proposed ?? run.lastCandidate,
        ...(run.appliedAt && current && current._id === run.baseline._id ? { editor: current } : {}) };
      for (const [name, candidate] of Object.entries(targets)) {
        if (!candidate) { captures[name] = { unavailable: 'No proposal compiled before the run stopped.' }; continue; }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const preview = previewHub(candidate, 'ai-diagnostic-');
          const ids = new Map(preview.layers.map((layer, index) => [layer.id, candidate.layers[index].id]));
          this.diagnosticPreview.set(preview);
          await waitForPreviewPaint();
          const root = this.element.nativeElement.querySelector<HTMLElement>('.diagnostic-stage .broadcast-preview');
          if (!root) throw new Error('The diagnostic preview was closed.');
          captures[name] = await Promise.race([captureDiagnosticPreview(root, ids), new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Image capture exceeded 12 seconds; text evidence is retained.')), 12000);
          })]);
        } catch (error) { captures[name] = { error: String(error) }; missingImages++; }
        finally { if (timer) clearTimeout(timer); this.diagnosticPreview.set(null); }
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `ai-hub-diagnostic-${run.startedAt.replace(/[:.]/g, '-')}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportNotice.set(missingImages ? 'Diagnostic downloaded. Some images could not be captured; their errors are included.' : 'Diagnostic downloaded. Send this JSON file with your feedback.');
    } catch (error) { this.exportNotice.set(`Could not export the diagnostic: ${String(error)}`); }
    finally { this.diagnosticPreview.set(null); this.exporting.set(false); }
  }
}
