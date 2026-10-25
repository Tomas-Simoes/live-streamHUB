// Legacy native-plan compatibility checks retained; intent permissions and automatic
// artistic treatments are superseded by ai-hub-css/intent/edit-contract tests.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { parseHubCreateSpec, compositionSchemaForInstruction } = await import('../src/app/features/editor/ai/hub-create-spec.ts');
const { parseHubIntent, resolveIntentPlan, checkHubIntent } = await import('../src/app/features/editor/ai/hub-intent.ts');
const { portraitSettings, rosterDetail } = await import('../src/app/features/editor/ai/hub-detail.ts');
const { fitRosterStyleSizes } = await import('../src/app/features/editor/ai/hub-roster-style.ts');
const { savedPartStyles } = await import('../src/app/features/editor/ai/hub-part-style.ts');
const { styleRepairSchema, applyStyleRepair, styleRepairMessages } = await import('../src/app/features/editor/ai/hub-repair.ts');
const { editSchemaForInstruction } = await import('../src/app/features/editor/ai/hub-edit-spec.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-reported-roster-overlap.json', import.meta.url), 'utf8'));
const hub = () => { const layout = PREDEFINED_HUB_TEMPLATES.find(item => item.id === 'pulse-broadcast').createLayout(); return { _id: 'flow', hubName: 'Flow', layout, layers: layout.layers }; };
const rule = (part, property, value) => ({ part, declarations: [{ property, value }] });
const measured = () => ({ viewport: [1280, 720], fonts: [{ role: 'names', minPx: 12, face: 'Impact' }], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });

test('the exact timeout interpretation retains omitted icon requirements and cannot turn burnt orange into burgundy', () => {
  const intent = parseHubIntent(fixture.interpretation, fixture.instruction, 'create');
  assert.equal(intent.style.rightAccent, null);
  assert(intent.changes.some(change => change.check === 'portraits-larger-than-items'));
  assert(intent.changes.some(change => change.check === 'minimap-clear'));
  assert.equal(intent.changes.find(change => change.check === 'minimap-clear').request, 'minimap clear');
  assert.match(intent.changes.find(change => change.check === 'team-gradient').request, /gradient/);
  const plan = resolveIntentPlan(parseHubCreateSpec(fixture.proposal), intent, hub());
  assert.equal(plan.design.colors.teamLeft, '#008080'); assert.equal(plan.design.colors.teamRight, '#b85734');
});

test('the reported unmodified proposal fits portraits and six readable item slots without another inference', () => {
  const compiled = compileHubPlan(hub(), parseHubCreateSpec(fixture.proposal));
  assert(compiled.warnings.some(issue => issue.code === 'layout-fit'));
  for (const layer of compiled.hub.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert(portraitSettings(layer).portraitSize <= 51);
    assert.equal(rosterDetail(layer).itemSize, 32);
    assert(savedPartStyles(layer).some(rule => rule.part === 'portrait' && rule.declarations.some(item => item.property === 'border-radius' && item.value === '50%')));
    assert(!savedPartStyles(layer).some(rule => rule.part === 'items' && rule.declarations.some(item => item.property === 'width')));
    assert(layer.style.customCss.includes('grid-template-columns:'));
  }
});

test('native icon constraints retain style and a later compact resize reflows the portrait track', () => {
  const compiled = compileHubPlan(hub(), parseHubCreateSpec(fixture.proposal)).hub;
  const resized = compileHubPlan(compiled, { template: 'current', operations: [{ op: 'resize', target: 'players', width: 600, height: 240 }] }).hub;
  for (const layer of resized.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert(portraitSettings(layer).portraitSize <= 39);
    assert(savedPartStyles(layer).some(rule => rule.part === 'portrait' && rule.declarations.some(item => item.property === 'border-radius' && item.value === '50%')));
  }
});

test('explicit custom grids and legitimate whole-strip dimensions retain creative control', () => {
  const layer = compileHubPlan(hub(), parseHubCreateSpec(fixture.proposal)).hub.layers.find(layer => layer.type === 'LolPlayerRoster');
  const custom = [rule('row', 'grid-template-columns', '200px 64px 1fr 42px 0px 70px'), rule('portrait', 'width', '64px')];
  assert.deepEqual(fitRosterStyleSizes(layer, custom).rules, custom);
  const strip = [rule('items', 'width', '200px')];
  assert.deepEqual(fitRosterStyleSizes(layer, strip).rules, strip);
});

test('causal render feedback provides the fix without priming the model to copy the invalid transform', () => {
  const plan = parseHubCreateSpec(fixture.proposal);
  plan.operations.push({ op: 'style', target: 'players', rules: [{ part: 'row', css: 'transform:translateX(-32px)' }] });
  const messages = styleRepairMessages(plan, [{ code: 'readability', layerIds: [], message: 'Live content exceeds its component frame.' }], fixture.instruction,
    { repairHints: [{ target: 'players', part: 'row', css: 'transform:none;', reason: 'The transform moves live data out of frame.' }] });
  const payload = JSON.parse(messages[1].content);
  assert.equal(payload.recommendedPatch.operations[0].rules[0].css, 'transform:none;');
  assert.equal(payload.currentStyles, undefined);
  assert(!messages[1].content.includes('translateX(-32px)'));
});

test('semantic team repair targets remain valid when composition UUIDs change', () => {
  const original = hub(), plan = parseHubCreateSpec(fixture.proposal);
  const first = compileHubPlan(original, plan).hub.layers.find(layer => layer.type === 'LolPlayerRoster');
  const second = compileHubPlan(original, plan).hub.layers.find(layer => layer.type === 'LolPlayerRoster');
  assert.notEqual(first.id, second.id);
  const fixed = applyStyleRepair(JSON.stringify({ operations: ['blue-players', 'red-players'].map(target => ({ op: 'style', target, rules: [{ part: 'row', css: 'transform:none' }] })) }), styleRepairSchema(compositionSchemaForInstruction(fixture.instruction)), plan);
  for (const layer of compileHubPlan(original, fixed).hub.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert(savedPartStyles(layer).some(rule => rule.part === 'row' && rule.declarations.some(item => item.property === 'transform' && item.value === 'none')));
  }
});

test('unchanged rendered failures stop after one patch even when model JSON changes', async () => {
  const service = new LocalAiService(); service.state.set('ready'); let calls = 0;
  service.request = async kind => {
    calls++;
    return { raw: kind === 'generate' ? fixture.proposal : JSON.stringify({ operations: [{ op: 'style', target: 'players', rules: [{ part: 'name', css: `font-size:${20 + calls}px` }] }] }) };
  };
  const proposal = await service.generate(hub(), fixture.instruction, 'create', { interpret: false, review: false, inspect: async () => {
    const report = measured(); report.fonts[0].minPx = 8; return { measurements: report };
  } });
  assert.equal(proposal, null); assert.equal(calls, 2);
  assert.equal(service.metrics().stopReason, 'repeated-proposal');
});
