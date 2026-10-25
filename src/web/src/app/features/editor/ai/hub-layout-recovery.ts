import type { Hub } from '../../../shared/types/hub.types';
import { LayerType } from '../../../shared/types/layer.types';
import { rosterFields } from '../../../shared/helpers/roster-fields';
import type { HubPlan } from './hub-plan';
import type { RenderedHubReport } from './hub-quality';

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
  return { units: 'native 1920x1080 px in rowLayouts; other measures are displayed px', viewport: report.viewport,
    rowLayouts: report.rowLayouts, fonts: report.fonts, clipped: report.clipped, integrity: report.integrity,
    missingImages: report.missingImages, frames: report.frames };
}
