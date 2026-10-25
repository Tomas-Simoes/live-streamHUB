import type { Hub } from '../../../shared/types/hub.types';
import { Injectable, signal } from '@angular/core';

/** Keep layout evidence, never the Hub's account/user record. */
export function diagnosticHub(hub: Hub): Hub {
  return structuredClone({ _id: hub._id, hubName: hub.hubName, layout: hub.layout, layers: hub.layers });
}

// The optional planning draft is internal. Export its structured design plan,
// status and usage instead; do not leak it through the next CSS request either.
export function diagnosticValue(value: unknown): any {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (key === 'notes') return '[Internal planning draft omitted]';
    if (typeof item === 'string') return item.replace(
      /Preliminary implementation notes \(may be incomplete; verify them against the actual DOM and original request\):\n[\s\S]*?\nThese notes do not override/,
      '[Internal planning draft omitted]\nThese notes do not override');
    return item;
  }));
}

export class HubDiagnosticRun {
  readonly id = crypto.randomUUID();
  readonly startedAt = new Date().toISOString();
  readonly calls: any[] = [];
  readonly stages: any[] = [];
  outcome: { status: string; error?: string; at: string } | undefined;
  appliedAt: string | undefined;
  metrics: Record<string, unknown> = {};
  raw = '';
  error = '';
  proposed?: Hub;
  lastCandidate?: Hub;
  readonly baseline: Hub;
  constructor(readonly instruction: string, readonly mode: 'create' | 'edit', readonly model: string,
    readonly settings: Record<string, unknown>, baseline: Hub, readonly scaffold: Hub) {
    this.baseline = diagnosticHub(baseline);
    this.scaffold = diagnosticHub(scaffold);
  }
  call(id: string, kind: string, request: unknown) {
    const call = { id, kind, startedAt: new Date().toISOString(), request: diagnosticValue(request), status: 'pending', partial: undefined as string | undefined };
    this.calls.push(call); return call;
  }
  partial(id: string, text: string) { const call = this.calls.find(call => call.id === id); if (call) call.partial = text; }
  stage(kind: string, hub: Hub, details?: unknown) {
    const snapshot = diagnosticHub(hub);
    this.stages.push({ kind, at: new Date().toISOString(), hub: snapshot, details: details === undefined ? undefined : diagnosticValue(details) });
    if (!['current-preview', 'reference-image'].includes(kind)) this.lastCandidate = snapshot;
  }
  finish(status: string, error?: string) { this.outcome = { status, error, at: new Date().toISOString() }; }
}

/** Most recent run survives closing the dialog, for this tab's lifetime only. */
@Injectable({ providedIn: 'root' })
export class HubDiagnosticArchive { readonly latest = signal<HubDiagnosticRun | null>(null); }

const properties = ['display', 'visibility', 'opacity', 'color', 'background-color', 'background-image',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
  'width', 'height', 'min-width', 'min-height', 'padding', 'gap', 'grid-template-columns', 'grid-template-rows',
  'grid-column', 'grid-row', 'flex', 'overflow', 'border', 'border-radius', 'box-shadow', 'clip-path', 'transform'];

/** Browser-resolved evidence: source CSS alone cannot explain cascade or clipping. */
export function computedHubEvidence(root: HTMLElement, sourceIds?: ReadonlyMap<string, string>) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-layer-id], [data-component-part]'));
  const origin = root.getBoundingClientRect();
  const ids = nodes.map(node => node.dataset['layerId']).filter((id): id is string => !!id);
  return { coordinateSpace: 'rendered CSS pixels relative to preview', width: origin.width, height: origin.height,
    scopedStylesheets: Array.from(root.ownerDocument.querySelectorAll('style')).map(style => style.textContent ?? '')
      .filter(css => ids.some(id => css.includes(id))),
    omittedNodes: Math.max(0, nodes.length - 1000), nodes: nodes.slice(0, 1000).map(node => {
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
      const previewId = node.closest<HTMLElement>('[data-layer-id]')?.dataset['layerId'];
      return { layer: previewId ? sourceIds?.get(previewId) ?? previewId : undefined,
        part: node.dataset['componentPart'], classes: node.className,
        inlineStyle: node.getAttribute('style'),
        text: node.children.length ? undefined : node.textContent?.trim(),
        box: { x: bounds.x - origin.x, y: bounds.y - origin.y, width: bounds.width, height: bounds.height },
        scroll: { width: node.scrollWidth, height: node.scrollHeight },
        styles: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])) };
    }) };
}
