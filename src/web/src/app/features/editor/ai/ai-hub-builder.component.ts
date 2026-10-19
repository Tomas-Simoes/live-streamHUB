import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HubStore } from '../../../core/store/hub.store';
import { EditorStore } from '../components/editor.store';
import { HubPreviewComponent } from '../../hubs/components/hub-preview/hub-preview.component';
import { AiProposal, LOCAL_MODELS, LocalAiService, hubFingerprint } from './local-ai.service';
import { describeHubPlan, previewHub } from './hub-plan';
import { Hub } from '../../../shared/types/hub.types';
import { HubDesignReview } from './hub-quality';
import { inspectHubPreview } from './hub-render-review';
import { HubIntent, IntentCheck } from './hub-intent';

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
  reviewEnabled = true;
  visionReviewEnabled = false;
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
  constructor(public ai: LocalAiService, public hubs: HubStore, private editor: EditorStore, private element: ElementRef<HTMLElement>) {}
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
  get busy() { return ['loading', 'generating', 'unloading'].includes(this.ai.state()); }
  get selectedModel() { return this.models.find(m => m.id === this.model)!; }
  get designReview() { return this.proposal()?.metrics['designReview'] as (HubDesignReview & { kind: string }) | undefined; }
  get understoodRequest() { return this.proposal()?.metrics['understoodRequest'] as HubIntent | undefined; }
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
    if (!hub) return;
    this.notice.set(''); this.proposal.set(null); this.preview.set(null);
    try {
      const result = await this.ai.generate(hub, this.instruction, this.mode, { review: this.reviewEnabled, visionReview: this.visionReviewEnabled, inspect: async (candidate, image) => {
        this.reviewHub.set(previewHub(candidate, 'ai-render-review-'));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const root = this.element.nativeElement.querySelector<HTMLElement>('.review-stage .broadcast-preview');
        if (!root) throw new Error('The render review was cancelled.');
        return inspectHubPreview(root, image);
      } });
      if (result) { this.proposal.set(result); this.preview.set(previewHub(result.hub)); }
    } finally { this.reviewHub.set(null); }
  }
  apply() {
    const proposal = this.proposal();
    if (!proposal || this.stale || this.busy) return;
    if (this.hubs.applyAiLayout(proposal.hub._id, proposal.hub.layout!, proposal.base)) {
      this.editor.selectLayer(null);
      this.proposal.set(null); this.preview.set(null); this.instruction = '';
      this.mode = 'edit';
      this.notice.set('Applied. Continue editing, use Undo to revert, or Save to persist.');
    }
  }
  exportEvaluation() {
    const proposal = this.proposal();
    const data = { instruction: this.instruction, mode: this.mode, ...this.ai.metrics(), raw: this.ai.raw(),
      plan: proposal?.plan, warnings: proposal?.warnings, error: this.ai.error(),
      userAgent: navigator.userAgent, capturedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'local-ai-hub-evaluation.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
