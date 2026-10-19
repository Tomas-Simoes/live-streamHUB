import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { parseHubIntent, resolveIntentPlan, checkHubIntent } = await import('../src/app/features/editor/ai/hub-intent.ts');
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { editSchemaForInstruction, parseHubEditSpec } = await import('../src/app/features/editor/ai/hub-edit-spec.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const { rosterDetail, portraitSettings } = await import('../src/app/features/editor/ai/hub-detail.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { measureRenderedHub } = await import('../src/app/features/editor/ai/hub-quality.ts');

const change = (target, aspect, check, request = check) => ({ target, aspect, check, request });
const brief = (...changes) => ({ summary: 'Compact broadcast with readable team and player detail.', changes, preserve: ['Team hues and font families'], unresolved: [] });
function hub() {
  const layout = PREDEFINED_HUB_TEMPLATES[0].createLayout();
  const base = { _id: 'intent-test', hubName: 'Intent test', layout, layers: layout.layers };
  return compileHubPlan(base, { template: 'ai-composed', design: {
    colors: { background: '#081b38', text: '#ffffff', muted: '#b8cbe4', line: '#526f96', teamLeft: '#35d3bf', teamRight: '#ffad55' },
    typography: { bodyFont: 'Arial', headingFont: 'Impact', nameFont: 'Impact', uppercaseNames: true },
    panels: { fill: 'solid', corners: 'square', borderWidth: 1, accentWidth: 1, teamSections: true, rows: 'alternating', headerAccent: 'none' },
    layout: { scoreboardWidth: 1200, scoreboardHeight: 100, rosterWidth: 600, rosterHeight: 280, showEventPanel: false }, title: 'LIVE',
  }, operations: [] }).hub;
}
const edit = () => ({ template: 'current', palette: null, appearance: { target: 'scoreboards', backgroundColor: null, gradientTo: null, gradientDirection: null, borderColor: null, borderWidth: null },
  scoreboard: { paddingX: null, showObjectives: null, showGold: null, showGameTime: null }, players: { portraitSize: null, gap: null, showChampion: null, showKda: null, showCs: null, showGold: null, showItems: null }, operations: [] });
const measured = () => ({ viewport: [1280, 720], fonts: [{ role: 'names', minPx: 13.33, face: 'Impact' }, { role: 'cs', minPx: 14, face: 'Impact' }, { role: 'kda', minPx: 12, face: 'Arial' }],
  clipped: [], frames: [{ role: 'players', x: 240, y: 560, width: 400, height: 160 }, { role: 'players', x: 640, y: 560, width: 400, height: 160 }],
  tableGapPx: 0, missingImages: 0, rosterDetails: [{ portraitMin: 30, itemMax: 32, separator: 1 }, { portraitMin: 30, itemMax: 32, separator: 1 }], teamFills: [] });

test('typed interpretation rejects arbitrary properties and incompatible relative targets', () => {
  assert.deepEqual(parseHubIntent(JSON.stringify(brief(change('players', 'portraits', 'portraits-larger-than-items')))).preserve, ['Team hues and font families']);
  assert.throws(() => parseHubIntent(JSON.stringify({ ...brief(), css: 'bad' })));
  assert.throws(() => parseHubIntent(JSON.stringify(brief(change('players', 'gradient', 'team-gradient')))));
});
test('one ordinary phrase can carry multiple measurable requirements', () => {
  const source = 'make hero pics smaller but a bit bigger then equipment';
  const raw = brief({ target: 'players', aspect: 'portraits', request: source, check: ['smaller-portraits', 'portraits-larger-than-items'] });
  const intent = parseHubIntent(JSON.stringify(raw), source);
  assert.deepEqual(intent.changes.map(change => change.check), ['smaller-portraits', 'portraits-larger-than-items']);
  assert(intent.changes.every(change => change.request === source));
});
test('grounding rejects invented instructions and incompatible action checks', () => {
  assert.throws(() => parseHubIntent(JSON.stringify(brief(change('scoreboards', 'size', 'half-screen-width', 'make it half width'))), 'make it pretty'), /quote/);
  assert.throws(() => parseHubIntent(JSON.stringify(brief(change('scoreboards', 'typography', 'team-gradient', 'bold lettering')))), /aspect/);
});
test('creation ignores a copied example request while retaining the actual user brief', () => {
  const source = 'a teal section for the left team and bold lettering';
  const value = brief(change('scoreboards', 'fill', 'none', 'teal section for the left team'), change('scoreboards', 'size', 'none', 'small top scoreboard'));
  const intent = parseHubIntent(JSON.stringify(value), source, 'create');
  assert.equal(intent.changes.length, 1); assert.equal(intent.changes[0].aspect, 'fill');
});
test('grounding tolerates spelling/spacing corrections while preserving numeric evidence', () => {
  const value = brief(change('players', 'portraits', 'larger-portraits', 'hero pics a bit bigger now'));
  assert(parseHubIntent(JSON.stringify(value), 'hero pics abit biger now'));
  assert.throws(() => parseHubIntent(JSON.stringify(brief(change('scoreboards', 'size', 'none', 'scoreboard width 100'))), 'scoreboard width 1000'));
});
test('explicit semantic colours and font choices survive composition without selecting a preset', () => {
  const original = hub().layout.aiDesign;
  const intent = brief(change('all', 'fill', 'none', 'teal and orange'));
  intent.style = { leftAccent: 'teal', rightAccent: 'orange', heading: 'condensed', corners: 'square', teamSections: true };
  const plan = resolveIntentPlan({ template: 'ai-composed', design: original, operations: [] }, intent, hub());
  assert.equal(plan.design.colors.teamLeft, '#29e6d2'); assert.equal(plan.design.colors.teamRight, '#ff9900');
  assert.equal(plan.design.typography.headingFont, 'Impact'); assert.equal(plan.design.colors.background, original.colors.background);
  assert.equal(plan.template, 'ai-composed');
});
test('semantic scope handles keep-but without opening palette, geometry or font changes', () => {
  const intent = brief(change('team-sections', 'gradient', 'team-gradient', 'Blend each team hue into darker shades'));
  const schema = editSchemaForInstruction('keep them colours tho make em fade darker', hub(), intent);
  assert.equal(schema.properties.palette.type, 'null');
  assert.equal(schema.properties.players.properties.portraitSize.type, 'null');
  assert(!schema.properties.operations.items.oneOf.some(op => ['resize', 'typography'].includes(op.properties.op.const)));
  const invalid = edit(); invalid.palette = 'navy';
  assert.throws(() => parseHubEditSpec(JSON.stringify(invalid), schema));
  const plan = resolveIntentPlan(parseHubEditSpec(JSON.stringify(edit()), schema, true), intent, hub());
  const result = compileHubPlan(hub(), plan).hub;
  assert(result.layers.find(l => l.type === 'LolScorebug').style.customCss.includes('ai-team-fill-settings gradient 0.55'));
});
test('relative edits compile sizing, icon hierarchy, row separators and text without changing identities', () => {
  const before = hub(), snapshot = structuredClone(before);
  const intent = brief(change('scoreboards', 'size', 'half-screen-width'), change('scoreboards', 'size', 'shorter'),
    change('players', 'size', 'shorter'), change('players', 'portraits', 'smaller-portraits'), change('players', 'portraits', 'portraits-larger-than-items'),
    change('players', 'typography', 'smaller-text'), change('players', 'separators', 'fine-separators'), change('players', 'position', 'joined-bottom'));
  const plan = resolveIntentPlan({ template: 'current', operations: [] }, intent, before, measured());
  const result = compileHubPlan(before, plan).hub;
  assert.deepEqual(before, snapshot);
  assert.deepEqual(result.layers.map(l => l.id), before.layers.map(l => l.id));
  const score = result.layers.find(l => l.type === 'LolScorebug'); assert.equal(score.width, 960); assert.equal(score.height, 88);
  for (const layer of result.layers.filter(l => l.type === 'LolPlayerRoster')) {
    const old = before.layers.find(l => l.id === layer.id);
    assert(layer.height < old.height); assert.equal(layer.position.y + layer.height / 2, 1080);
    assert.equal(rosterDetail(layer).portraitRatio, 1.2); assert.equal(rosterDetail(layer).separatorWidth, .5);
    assert.equal(layer.partStyles.name.fontFamily, old.partStyles?.name?.fontFamily);
    assert.equal(layer.partStyles.name.fontSize, 18);
    assert.equal(layer.style.customCss.match(/\/\* ai-roster-detail \*\//g).length, 1);
  }
});
test('roster detail constraints survive subsequent native resizing and portrait edits', () => {
  const first = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'roster-design', target: 'players', portraitRatio: 1.2, separatorWidth: .5 }] }).hub;
  const result = compileHubPlan(first, { template: 'current', operations: [{ op: 'resize', target: 'players', width: 560, height: 250 }, { op: 'players', target: 'players', portraitSize: 36 }] }).hub;
  for (const layer of result.layers.filter(l => l.type === 'LolPlayerRoster')) {
    assert.equal(rosterDetail(layer).portraitRatio, 1.2);
    assert(layer.style.customCss.lastIndexOf('/* ai-roster-detail */') > layer.style.customCss.lastIndexOf('/* ai-roster */'));
  }
});
test('rendered fulfillment rejects equal-sized icons and hidden team gradients', () => {
  const intent = brief(change('players', 'portraits', 'portraits-larger-than-items'), change('team-sections', 'gradient', 'team-gradient'));
  assert(checkHubIntent(intent, hub(), hub(), measured()).every(check => check.status === 'failed'));
  const rendered = measured(); rendered.rosterDetails.forEach(row => { row.itemMax = 24; }); rendered.teamFills = [{ gradient: true }, { gradient: true }];
  const after = compileHubPlan(hub(), resolveIntentPlan({ template: 'current', operations: [] }, intent, hub())).hub;
  assert(checkHubIntent(intent, hub(), after, rendered).every(check => check.status === 'verified'));
});
test('minimum size limitations are explicit instead of a repeated failed shrink', () => {
  const before = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'resize', target: 'players', width: 540, height: 240 }] }).hub;
  const intent = brief(change('players', 'size', 'shorter'));
  assert.equal(checkHubIntent(intent, before, before, measured())[0].status, 'limited');
});
test('unsupported and nonmeasurable requests are never labelled mechanically verified', () => {
  const intent = brief(change('all', 'other', 'none', 'Make it elegant')); intent.unresolved = ['Add live webcams'];
  assert.deepEqual(checkHubIntent(intent, hub(), hub(), measured()).map(check => check.status), ['unverified', 'limited']);
});
test('default service interprets plain English and checks requested outcomes with aesthetic review disabled', async () => {
  const service = new LocalAiService(); service.state.set('ready');
  const intent = brief(change('team-sections', 'gradient', 'team-gradient', 'fade darker'), change('players', 'portraits', 'portraits-larger-than-items', 'chars bigger then equipment'));
  const kinds = [], inputs = [];
  service.request = async (kind, payload) => { kinds.push(kind); inputs.push(payload); return { raw: JSON.stringify(kind === 'interpret' ? intent : edit()) }; };
  let renders = 0;
  const proposal = await service.generate(hub(), 'keep them colours but fade darker, chars bigger then equipment', 'edit', { review: false, inspect: async () => {
    const measurements = measured();
    if (renders++) { measurements.rosterDetails.forEach(row => { row.itemMax = 24; }); measurements.teamFills = [{ gradient: true }, { gradient: true }]; }
    return { measurements };
  } });
  assert(proposal); assert.deepEqual(kinds, ['interpret', 'generate']); assert.equal(renders, 2);
  assert(proposal.metrics.requestChecks.every(check => check.status === 'verified'));
  assert(inputs[1].messages.at(-1).content.includes('keep them colours but fade darker'));
  assert(inputs[1].messages.at(-1).content.includes('Interpreted brief'));
});
test('failed fulfillment triggers focused repair before publishing a candidate', async () => {
  const service = new LocalAiService(); service.state.set('ready'); const kinds = [];
  const intent = brief(change('players', 'portraits', 'portraits-larger-than-items', 'characters bigger than equipment'));
  service.request = async (kind, payload) => { kinds.push(kind); return { raw: JSON.stringify(kind === 'interpret' ? intent : edit()) }; };
  let renders = 0;
  const proposal = await service.generate(hub(), 'characters bigger than equipment', 'edit', { review: false, inspect: async () => {
    const measurements = measured(); if (renders++ > 1) measurements.rosterDetails.forEach(row => { row.itemMax = 24; }); return { measurements };
  } });
  assert(proposal); assert.deepEqual(kinds, ['interpret', 'generate', 'generate']);
  assert.equal(proposal.metrics.attempts[0].validation.issues[0].code, 'intent');
});
test('interpreter retries malformed output once and never mutates the editor on failure', async () => {
  const service = new LocalAiService(); service.state.set('ready'); const before = hub(), saved = structuredClone(before); let calls = 0;
  service.request = async () => { calls++; return { raw: '{}' }; };
  assert.equal(await service.generate(before, 'make it nicer', 'edit'), null);
  assert.equal(calls, 2); assert.deepEqual(before, saved); assert.equal(service.metrics().stopReason, 'interpretation-error');
});
test('cancellation while interpreting ignores a late response', async () => {
  const service = new LocalAiService(); service.state.set('ready'); let finish;
  service.request = () => new Promise(resolve => { finish = resolve; });
  const pending = service.generate(hub(), 'make it nicer', 'edit'); service.cancel(); finish({ raw: JSON.stringify(brief()) });
  assert.equal(await pending, null); assert.equal(service.state(), 'idle'); assert.match(service.status(), /Cancelled/);
});
test('late interpreter output consumes the shared deadline and cannot start generation', async () => {
  const service = new LocalAiService(); service.state.set('ready'); let elapsed = 0, calls = 0;
  service.now = () => elapsed;
  service.request = async () => { calls++; elapsed = 300001; return { raw: JSON.stringify(brief(change('players', 'size', 'shorter'))) }; };
  assert.equal(await service.generate(hub(), 'make tables shorter', 'edit'), null);
  assert.equal(calls, 1); assert.equal(service.metrics().stopReason, 'time-limit'); assert.equal(service.state(), 'idle');
});
test('unsupported-only requests stop before attempting an impossible design edit', async () => {
  const service = new LocalAiService(); service.state.set('ready'); let calls = 0;
  service.request = async () => { calls++; return { raw: JSON.stringify({ ...brief(), unresolved: ['add live webcams'] }) }; };
  assert.equal(await service.generate(hub(), 'put live webcams in it', 'edit'), null);
  assert.equal(calls, 1); assert.match(service.error(), /webcams/); assert.equal(service.state(), 'ready');
});
test('a corrected interpretation retains original wording and consumes only the remaining time', async () => {
  const service = new LocalAiService(); service.state.set('ready'); let elapsed = 0;
  service.now = () => elapsed; const calls = [];
  const intent = brief(change('players', 'portraits', 'portraits-larger-than-items', 'hero pic bigger then gear pls'));
  service.request = async (kind, payload, timeout) => {
    calls.push({ kind, payload, timeout }); elapsed += 10000;
    return { raw: JSON.stringify(calls.length === 1 ? {} : kind === 'interpret' ? intent : edit()) };
  };
  const proposal = await service.generate(hub(), 'hero pic bigger then gear pls', 'edit', { review: false, inspect: async () => {
    const measurements = measured(); measurements.rosterDetails.forEach(row => { row.itemMax = 24; }); return { measurements };
  } });
  assert(proposal); assert.deepEqual(calls.map(call => call.kind), ['interpret', 'interpret', 'generate']);
  assert.deepEqual(calls.map(call => call.timeout), [300000, 290000, 280000]);
  assert(calls[1].payload.messages.some(message => message.content.includes('hero pic bigger then gear pls')));
  assert.equal(proposal.metrics.interpretation.length, 2);
});
test('semantic player type edits cannot change font family or unrelated scoreboard styling', () => {
  const schema = editSchemaForInstruction('letters abit smaller', hub(), brief(change('players', 'typography', 'smaller-text')));
  assert(!schema.properties.operations.items.oneOf.some(op => op.properties.op.const === 'typography'));
  assert.equal(schema.properties.palette.type, 'null');
  assert.equal(schema.properties.appearance.properties.backgroundColor.type, 'null');
});
test('later portrait edits use the saved current size rather than the original composition marker', () => {
  const first = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'players', target: 'players', portraitSize: 38 }] }).hub;
  assert(first.layers.filter(layer => layer.type === 'LolPlayerRoster').every(layer => portraitSettings(layer).portraitSize === 38));
  const plan = resolveIntentPlan({ template: 'current', operations: [] }, brief(change('players', 'portraits', 'larger-portraits')), first);
  assert(plan.operations.every(op => op.portraitSize === 44));
});
test('an explicit later typography edit replaces saved relative text sizes while retaining icon constraints', () => {
  const first = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'roster-design', target: 'players', nameSize: 18, statSize: 20, kdaSize: 16, portraitRatio: 1.2 }] }).hub;
  const result = compileHubPlan(first, { template: 'current', operations: [{ op: 'typography', target: 'players', font: 'Arial', size: 24 }] }).hub;
  for (const layer of result.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert.equal(layer.partStyles.name.fontSize, 24); assert.equal(layer.partStyles.name.fontFamily, 'Arial');
    assert.equal(rosterDetail(layer).nameSize, 24); assert.equal(rosterDetail(layer).portraitRatio, 1.2);
  }
});
test('intermediate model resizing cannot distort the final portrait/item relationship', () => {
  const before = hub(), intent = brief(change('players', 'size', 'shorter'), change('players', 'portraits', 'smaller-portraits'), change('players', 'portraits', 'portraits-larger-than-items'));
  const direct = compileHubPlan(before, resolveIntentPlan({ template: 'current', operations: [] }, intent, before)).hub;
  const intermediate = compileHubPlan(before, resolveIntentPlan({ template: 'current', operations: [{ op: 'resize', target: 'players', width: 960, height: 1000 }] }, intent, before)).hub;
  assert.deepEqual(intermediate.layers.filter(layer => layer.type === 'LolPlayerRoster'), direct.layers.filter(layer => layer.type === 'LolPlayerRoster'));
});
test('render measurements account for a native canvas scaled into the preview shell', () => {
  const code = { clientWidth: 100, clientHeight: 30, scrollWidth: 100, scrollHeight: 30, getBoundingClientRect: () => ({ width: 66 }) };
  const row = {};
  const roster = { querySelector: () => row, querySelectorAll: selector => [{ getBoundingClientRect: () => ({ width: selector === '.roster-portrait' ? 32 : 24 }) }] };
  const root = { offsetWidth: 1920, getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    querySelectorAll: selector => selector === '.team-code' ? [code] : selector === '.player-roster' ? [roster] : [] };
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = node => node === row ? { borderBottomWidth: '0px', boxShadow: 'rgb(255,255,255) 0px -0.5px 0px 0px inset' }
    : { fontSize: '30px', fontFamily: 'Impact', overflowX: 'visible', overflowY: 'visible' };
  try {
    const report = measureRenderedHub(root);
    assert.equal(report.fonts[0].minPx, 20);
    assert.equal(report.rosterDetails[0].portraitMin, 32);
    assert(Math.abs(report.rosterDetails[0].separator - 1/3) < .001);
  } finally { if (previous) globalThis.getComputedStyle = previous; else delete globalThis.getComputedStyle; }
});
