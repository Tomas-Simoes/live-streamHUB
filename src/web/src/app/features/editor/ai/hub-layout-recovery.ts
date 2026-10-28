import type { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { rosterFields } from '../../../shared/helpers/roster-fields';
import type { HubPlan } from './hub-plan';
import type { RenderedHub, RenderedHubReport } from './hub-quality';
import { matchesHubTarget } from './hub-targets';
import { renderedFailureCount } from './hub-quality';

export function measuredFitImproved(before: RenderedHub, after: RenderedHub): boolean {
  const old = before.measurements, next = after.measurements;
  const introduces = <T>(previous: T[], current: T[], key: (item: T) => string) => {
    const keys = new Set(previous.map(key)); return current.some(item => !keys.has(key(item)));
  };
  for (const role of ['hidden', 'outside', 'overlapping'] as const) {
    if (introduces(old.integrity?.[role] ?? [], next.integrity?.[role] ?? [], value => value)) return false;
  }
  if (introduces(old.integrity?.lowContrast ?? [], next.integrity?.lowContrast ?? [], value => value.role)
    || introduces(old.clipped, next.clipped, value => `${value.role}:${value.text}`) || next.missingImages > old.missingImages) return false;
  const key = (evidence: NonNullable<RenderedHub['requirementEvidence']>[number]) => JSON.stringify(evidence.requirement);
  const oldChecks = before.requirementEvidence ?? [], nextChecks = after.requirementEvidence ?? [];
  const failed = (items: typeof oldChecks) => items.filter(item => item.check.status === 'failed');
  if (introduces(failed(oldChecks), failed(nextChecks), key)) return false;
  // A passing measurement cannot become unavailable as a way of removing a failure.
  if (oldChecks.some(item => ['verified', 'limited'].includes(item.check.status)
    && !nextChecks.some(next => key(next) === key(item) && ['verified', 'limited'].includes(next.check.status)))) return false;
  return renderedFailureCount(next) + failed(nextChecks).length < renderedFailureCount(old) + failed(oldChecks).length;
}

/** Bounded mechanical fit repairs. Every trial is measured again, checked against
 * preservation boundaries, and kept only when it reduces the measured failures.
 * No palette, font family, decoration, binding or artistic template is supplied. */
export function measuredFitRecovery(hub: Hub, rendered: RenderedHub): HubPlan['operations'] {
  const report = rendered.measurements, operations: HubPlan['operations'] = [];
  const squeezed = new Set<string>();
  for (const component of report.componentLayouts ?? []) {
    if (component.rootColumns > 1 && component.loaderWidth < component.contentWidth * .85) {
      // The outer layer contains ONE native loader, not the row's six fields.
      operations.push({ op: 'css', target: component.target, mode: 'patch', css: '& { grid-template-columns: minmax(0, 1fr); }' });
      squeezed.add(component.target);
    }
    if (component.role === 'scoreboard' && component.rootPadding > 0 && report.integrity?.outside.length) {
      operations.push({ op: 'css', target: component.target, mode: 'patch', css: '& { padding: 0; }' });
    }
    const textFixes = (component.text ?? []).flatMap(text => {
      const minimum = text.part === 'clock' ? 15 : text.part.endsWith('-kills') ? 30 : 18;
      return text.fontPx < minimum - .3 ? [`[data-component-part="${text.part}"] { font-size: ${minimum}px; }`] : [];
    });
    if (textFixes.length) operations.push({ op: 'css', target: component.target, mode: 'patch', css: textFixes.join('\n') });
  }
  for (const row of report.rowLayouts ?? []) {
    if (!row.target || squeezed.has(row.target) || !row.width || !row.height || row.implicitWrap) continue;
    const width = row.width, height = row.height;
    // Deliberate overlays/positioned badges need model judgement, not auto-layout.
    if (row.fields.some(field => ['absolute', 'fixed'].includes(field.position ?? ''))) continue;
    const portrait = row.fields.find(field => field.part === 'portrait');
    const maxPortrait = Math.floor(Math.min(row.height - 4, portrait?.width ?? row.height));
    const rules: string[] = [];
    if (portrait && maxPortrait >= 26 && (portrait.height > row.height || portrait.width > row.width / 3)) {
      rules.push(`[data-component-part="portrait"] { width: ${maxPortrait}px; height: ${maxPortrait}px; max-width: 100%; max-height: 100%; }`);
    }
    for (const [part, minimum] of [['name', 17], ['cs', 17], ['kda', 14]] as const) {
      const field = row.fields.find(field => field.part === part);
      if (field?.fontPx && field.fontPx < minimum - .4) rules.push(`[data-component-part="${part}"] { font-size: ${minimum}px; }`);
    }
    if (row.items && row.items.visibleMin < 23.55) {
      // Keep existing relative track allocation; add minima from measured text
      // and the actual six-item strip. Skip impossible fits instead of shrinking
      // content or growing panels over gameplay/minimap.
      const minima = row.fields.map(field => field.part === 'items' ? 6 * 28 + 5 * 3
        : field.part === 'portrait' ? Math.max(30, Math.min(field.width, height - 4))
        : Math.ceil(Math.max(field.textWidth ?? 0, 8) * Math.max(1, (field.part === 'kda' ? 14 : 17) / (field.fontPx || 17)) + 4));
      if (minima.reduce((a,b) => a+b, 0) + (row.fields.length - 1) * 4 + 8 <= row.width) {
        rules.push(`[data-component-part="row"] { grid-template-columns: ${minima.map((min,i) => `minmax(${min}px,${Math.max(.1, row.fields[i].width / width).toFixed(3)}fr)`).join(' ')}; column-gap: 4px; }`);
        rules.push('[data-component-part="items"] { width: auto; min-width: 0; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 3px; }');
        rules.push('[data-component-part="item"] { width: 28px; height: 28px; max-width: 100%; max-height: 100%; margin: 0; }');
        rules.push('[data-component-part="item"] img { width: 100%; height: 100%; }');
      }
    }
    if (rules.length) operations.push({ op: 'css', target: row.target, mode: 'patch', css: rules.join('\n') });
  }
  operations.push(...rosterFlowRecovery(hub, report));
  // Use the interpreted, quoted numeric request, not a hardcoded broadcast size.
  for (const evidence of rendered.requirementEvidence ?? []) {
    const req = evidence.requirement;
    if (evidence.check.status !== 'failed' || req.measure !== 'widthFraction') continue;
    const fraction = Number(req.value);
    if (!(fraction > 0 && fraction <= 1)) continue;
    for (const layer of hub.layers.filter(layer => matchesHubTarget(layer, req.target))) {
      if (req.selector !== '&' && req.selector !== '#' + layer.id) continue;
      operations.push({ op: 'resize', target: layer.id, width: Math.round(1920 * fraction), height: layer.height });
    }
  }
  return operations;
}

/** A trial repair of a measured auto-placement failure, not an artistic fallback.
 * The caller must check preservation and re-render the complete candidate before
 * accepting it. No colours, typography, decorations or frames are replaced. */
export function rosterFlowRecovery(hub: Hub, report: RenderedHubReport): HubPlan['operations'] {
  const operations: HubPlan['operations'] = [];
  for (const row of report.rowLayouts ?? []) {
    if (!row.implicitWrap || !row.items || row.items.visibleMin >= 23.55 || !row.target) continue;
    const layer = hub.layers.find(layer => layer.id === row.target);
    if (!layer || layer.type !== LayerType.LolPlayerRoster) continue;
    const expected = rosterFields(layer);
    if (row.fields.length !== expected.length || row.fields.some((field, index) => field.part !== expected[index]
      || ['absolute', 'fixed'].includes(field.position ?? ''))) continue;
    // The functional tracks are derived from actual visible bindings by the
    // renderer. Clear stale placement on every direct field as well: changing
    // only five tracks to six leaves e.g. name in the level's reserved column.
    operations.push({ op: 'css', target: layer.id, mode: 'patch', css:
      '.roster-row { grid-template-columns: var(--roster-tracks); grid-template-rows: minmax(0, 1fr); }\n'
      + '.roster-row > :where([data-component-part]) { grid-area: auto; grid-row: 1; }' });
  }
  return operations;
}

/** Repairs do not need all successful colour facts, fonts and reference CSS.
 * Keep causal dimensions and the failed component's current rules instead. */
export function compactRepairEvidence(report: RenderedHubReport | undefined) {
  if (!report) return undefined;
  return { units: 'native 1920x1080 px in rowLayouts and componentLayouts; fonts.minPx and frames are displayed px', viewport: report.viewport,
    componentLayouts: report.componentLayouts, rowLayouts: report.rowLayouts, fonts: report.fonts, clipped: report.clipped, integrity: report.integrity,
    missingImages: report.missingImages, frames: report.frames };
}
