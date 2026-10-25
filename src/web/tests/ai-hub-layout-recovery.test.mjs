import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { createBroadcastScaffold, parseDesignResponse } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { authoredCss, patchAuthoredCss } = await import('../src/app/shared/helpers/authored-css.ts');
const { rosterFlowRecovery } = await import('../src/app/features/editor/ai/hub-layout-recovery.ts');
const { renderedLayoutIssues } = await import('../src/app/features/editor/ai/hub-quality.ts');
const { referenceCssContext } = await import('../src/app/features/editor/ai/hub-reference-records.ts');
const { APPROVED_HUB_REFERENCE_RECORDS } = await import('../src/app/features/editor/ai/hub-design-knowledge.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-item-grid-response.json', import.meta.url)));
const hub = () => { const layout = createBroadcastScaffold(); return { _id: 'grid-test', hubName: 'Grid test', layout, layers: layout.layers }; };
const valid = () => ({ viewport: [1280,720], fonts: [], clipped: [], frames: [], missingImages: 0, tableGapPx: 0 });
// Service orchestration tests use explicit diagnostic fixtures. Actual DOM
// detection and corrected pixels are separately exercised in the Chrome replay.
const broken = () => {
  const report = structuredClone(fixture.recordedMeasurements);
  report.rowLayouts.forEach(row => Object.assign(row, { target: `hub-${row.team}-roster`, implicitWrap: true, trackCount: 5,
    rows: '21.6px 22.5px', items: { slotWidth: 20, slotHeight: 10, imageWidth: 20, imageHeight: 10, visibleMin: 10 } }));
  return report;
};
const request = (css, summary = 'Repair') => JSON.stringify({ summary, styles: [{ target: 'players', mode: 'patch', css }], operations: [] });
const ai = responses => {
  const service = new LocalAiService(), calls = []; service.state.set('ready');
  service.request = async (kind, payload) => { calls.push({ kind, payload }); assert(responses.length, 'Unexpected model call'); return { raw: responses.shift() }; };
  return { service, calls };
};

test('reported implicit-grid collapse can be recovered without another model generation', async () => {
  const { service, calls } = ai([fixture.proposal]); const source = hub(), before = structuredClone(source); let count = 0;
  const result = await service.generate(source, 'Create a tournament broadcast', 'create', { interpret: false, review: false,
    inspect: async () => ({ measurements: ++count === 1 ? broken() : valid() }) });
  assert(result, service.error()); assert.equal(calls.length, 1); assert.equal(count, 2);
  assert.equal(result.metrics.localCorrections, 1); assert.equal(result.metrics.attempts[0].localRepair.applied, true);
  assert.deepEqual(source, before);
  const original = compileHubPlan(source, parseDesignResponse(fixture.proposal, 'create')).hub;
  for (const layer of result.hub.layers) {
    const old = original.layers.find(item => item.id === layer.id);
    assert.deepEqual([layer.position, layer.width, layer.height], [old.position, old.width, old.height]);
    if (layer.type === 'LolScorebug') assert.equal(layer.style.customCss, old.style.customCss);
    else assert(authoredCss(layer.style.customCss).includes('color-mix(in srgb,'));
  }
});

test('recovery requires measured unintended wrapping and retains deliberately positioned badge layouts', () => {
  const source = hub(), report = broken(); assert.equal(rosterFlowRecovery(source, report).length, 2);
  for (const row of report.rowLayouts) row.implicitWrap = false;
  assert.deepEqual(rosterFlowRecovery(source, report), []);
  for (const row of report.rowLayouts) { row.implicitWrap = true; row.fields[0].position = 'absolute'; }
  assert.deepEqual(rosterFlowRecovery(source, report), []);
});

test('failed local trial is discarded and bounded; the model receives original causal measurements', async () => {
  const { service, calls } = ai([fixture.proposal, request('.item-slot{min-width:24px;min-height:24px}')]); let inspections = 0;
  const result = await service.generate(hub(), 'Create a broadcast', 'create', { interpret: false, review: false,
    inspect: async () => ({ measurements: ++inspections < 3 ? broken() : valid() }) });
  assert(result, service.error()); assert.equal(inspections, 3); assert.equal(calls.length, 2);
  assert.equal(result.metrics.localCorrections, 0);
  const feedback = JSON.parse(calls[1].payload.messages[1].content);
  assert(feedback.issues.some(issue => issue.message.includes('six') || issue.message.includes('6 visible fields')));
  assert(feedback.measurements.rowLayouts[0].items); assert(!feedback.measurements.editFacts);
  assert(!result.plan.operations.some(op => op.css?.includes('grid-area: auto')));
});

test('identical measurements after a different ineffective patch allow a focused further correction', async () => {
  const { service, calls } = ai([fixture.proposal, fixture.repairs[0], request('.roster-row{grid-template-columns:var(--roster-tracks)}')]); let inspections = 0;
  const failed = structuredClone(fixture.recordedMeasurements); // Legacy measurement, no local recovery evidence.
  const result = await service.generate(hub(), 'Create a broadcast', 'create', { interpret: false, review: false,
    inspect: async () => ({ measurements: ++inspections < 3 ? failed : valid() }) });
  assert(result, service.error()); assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[2].payload.messages[1].content).previousPatch, fixture.repairs[0]);
});

test('repeating the same ineffective patch still stops promptly and never changes the editor', async () => {
  const { service, calls } = ai([fixture.proposal, fixture.repairs[0], fixture.repairs[0]]);
  const source = hub(), before = structuredClone(source);
  const result = await service.generate(source, 'Create a broadcast', 'create', { interpret: false, review: false,
    inspect: async () => ({ measurements: structuredClone(fixture.recordedMeasurements) }) });
  assert.equal(result, null); assert.equal(calls.length, 3); assert.equal(service.metrics().stopReason, 'repeated-proposal');
  assert.deepEqual(source, before);
});

test('local geometry recovery cannot bypass an explicit only-colour edit constraint', async () => {
  const instruction = 'Only change player row backgrounds to teal';
  const interpretation = JSON.stringify({ summary: instruction, goals: [instruction], targets: ['players'], preserve: [], preferences: [],
    functionalRequirements: [], scope: 'targeted', constraints: [{ target: 'players', aspect: 'only-css', selector: '.roster-row', properties: ['background'], request: instruction }], unresolved: [] });
  const response = request('.roster-row{background:teal}');
  const { service } = ai([interpretation, response, response]);
  const result = await service.generate(hub(), instruction, 'edit', { review: false, inspect: async () => ({ measurements: broken() }) });
  assert.equal(result, null); assert.equal(service.metrics().localCorrections, 0);
  assert(service.metrics().attempts[0].localRepair.blocked.some(issue => issue.code === 'design-preservation'));
});

test('reference budgets never publish row tracks without their dependent field placements', () => {
  for (const record of APPROVED_HUB_REFERENCE_RECORDS) for (const budget of [900,1600,3000,18000]) {
    const context = referenceCssContext(record, budget);
    for (const example of context.examples) {
      if (!example.layoutIncluded) assert(!/[{;](?:grid-(?:column|row|template)[^:]*|position|transform):/.test(example.css), example.css);
      else if (example.component.endsWith('players')) {
        assert(example.css.includes('.roster-level')); assert(example.css.includes('grid-column'));
        assert(example.rowFields.includes('level'));
      }
    }
    assert(context.examples.reduce((sum, example) => sum + example.css.length, 0) <= budget);
  }
});

test('equivalent scoped selectors patch without accumulating stale size rules', () => {
  const source = patchAuthoredCss('', '& .item-slot img{width:100%;height:100%;object-fit:cover}');
  const next = authoredCss(patchAuthoredCss(source, '.item-slot img{width:24px;height:24px}'));
  assert(!next.includes('100%')); assert(next.includes('object-fit:cover')); assert(next.includes('24px'));
});

test('a collapsed image is rejected while intentionally absent equipment is allowed', () => {
  const report = valid(); report.rosterDetails = [{ portraitMin: 30, itemMax: 0, separator: 1 }];
  assert.deepEqual(renderedLayoutIssues(report), []);
  report.rosterDetails[0].itemMin = 0;
  assert(renderedLayoutIssues(report).some(issue => issue.message.includes('Item icons')));
});

test('cancelling during local remeasurement cannot publish its late result', async () => {
  const { service, calls } = ai([fixture.proposal]); let inspected = 0;
  const result = await service.generate(hub(), 'Create a broadcast', 'create', { interpret: false, review: false,
    inspect: async () => { if (++inspected === 2) service.cancel(); return { measurements: inspected === 1 ? broken() : valid() }; } });
  assert.equal(result, null); assert.equal(calls.length, 1); assert.equal(inspected, 2);
});

test('local recovery shares the original deadline and cannot publish after ten minutes', async () => {
  const { service } = ai([fixture.proposal]); let elapsed = 0, inspected = 0; service.now = () => elapsed;
  const result = await service.generate(hub(), 'Create a broadcast', 'create', { interpret: false, review: false,
    inspect: async () => { if (++inspected === 2) elapsed = 600001; return { measurements: inspected === 1 ? broken() : valid() }; } });
  assert.equal(result, null); assert.equal(service.metrics().stopReason, 'time-limit');
});
