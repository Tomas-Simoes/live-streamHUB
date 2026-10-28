import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const design = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { hubTargetInventory, matchesHubTarget } = await import('../src/app/features/editor/ai/hub-targets.ts');
const repair = await import('../src/app/features/editor/ai/hub-proposal-repair.ts');
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { validationSummary, repairFeedback } = await import('../src/app/features/editor/ai/hub-repair.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-missing-target-response.json', import.meta.url)));
const hub = () => { const layout = design.createBroadcastScaffold(); return { _id: 'target-regression', hubName: 'Target regression', layout, layers: layout.layers }; };
const style = (target, css) => ({ target, css, mode: 'patch' });
const response = (styles, operations = []) => JSON.stringify({ summary: 'Original model design', styles, operations });
const correction = revisions => JSON.stringify({ summary: 'Corrected one proposal entry', revisions, styles: [], operations: [] });
const initial = () => design.parseDesignResponse(fixture.proposal, 'create');

test('the reported model response reproduces an indexed missing-target failure before rendering', () => {
  assert.throws(() => compileHubPlan(hub(), initial()), error => error.issues[0].code === 'target' && error.issues[0].path === '/operations/4/target' && /player-header/.test(error.message));
});

test('creation context and decoder expose real targets and preserve every presentation capability', () => {
  const source = hub(), context = design.designContext(source), schema = design.designResponseSchema(source);
  assert(!('player-header' in context.availableTargets)); assert(!('branding' in context.availableTargets));
  const validate = new Ajv({ strict: false }).compile(schema);
  assert(!validate(JSON.parse(response([style('player-header', '.text-layer{color:red}')]))));
  for (const target of ['all', 'scoreboards', 'players', 'blue-players', 'red-players', 'hub-scoreboard']) assert(validate(JSON.parse(response([style(target, '&{--brand:oklch(70% .1 190)}')]))));
  assert.deepEqual(schema.properties.styles.items.properties.css, design.HUB_DESIGN_RESPONSE_SCHEMA.properties.styles.items.properties.css);
  assert.deepEqual(schema.properties.operations.items.oneOf.map(item => item.properties.op.const), design.HUB_DESIGN_RESPONSE_SCHEMA.properties.operations.items.oneOf.map(item => item.properties.op.const));
  const brief = new Ajv({ strict: false }).compile(design.designBriefSchema(source));
  const interpreted = { ...JSON.parse(fixture.interpretation), requirements: [], designPlan: { identity: 'teal/orange', composition: 'compact scoreboard', typography: 'condensed headings', playerRows: 'mirrored rows with every visible field' } };
  assert(brief(interpreted));
  assert(!brief({ ...interpreted, targets: ["player-header', "] }));
});

test('every advertised alias uses the exact same matching rules as compilation for existing presets', () => {
  for (const template of PREDEFINED_HUB_TEMPLATES) {
    const layout = template.createLayout(), source = { _id: template.id, hubName: template.name, layout, layers: layout.layers };
    const context = design.designContext(source);
    assert.deepEqual(context.availableTargets, hubTargetInventory(source.layers).aliases);
    for (const [target, count] of Object.entries(context.availableTargets)) {
      assert.equal(source.layers.filter(layer => matchesHubTarget(layer, target)).length, count);
      assert.doesNotThrow(() => compileHubPlan(source, design.parseDesignResponse(response([style(target, '&{--qa:1}')]), 'edit')));
    }
  }
});

test('a model can explicitly remove the invalid entry without losing or rewriting its valid CSS', () => {
  const source = hub(), base = initial(), before = structuredClone(base);
  const fixed = repair.applyProposalRepair(fixture.repairs[0], source, base);
  assert.deepEqual(base, before); assert.deepEqual(fixed.operations, base.operations.slice(0, 4));
  assert.doesNotThrow(() => compileHubPlan(source, fixed));
  assert(!fixed.operations.some(entry => entry.target === 'player-header'));
});

test('target correction is general: model retargeting preserves arbitrary CSS exactly', () => {
  const source = hub(), base = design.parseDesignResponse(response([style('nonexistent-name', '[data-component-part="name"]{font-stretch:condensed;letter-spacing:.7px}')]), 'edit');
  const fixed = repair.applyProposalRepair(correction([{ index: 0, action: 'retarget', target: 'players' }]), source, base);
  assert.equal(fixed.operations[0].css, base.operations[0].css); assert.equal(fixed.operations[0].target, 'players');
  assert.doesNotThrow(() => compileHubPlan(source, fixed));
});

test('a genuinely wanted new heading can be created and styled in the same correction', () => {
  const source = hub(), base = design.parseDesignResponse(response([style('player-header', '[data-component-part="text"]{font-family:Verdana;letter-spacing:1px}')]), 'create');
  const raw = JSON.stringify({ summary: 'New custom heading', revisions: [{ index: 0, action: 'retarget', target: 'ai-decoration-finals-heading' }], styles: [],
    operations: [{ op: 'decoration', key: 'finals-heading', kind: 'text', text: 'FINALS', x: 960, y: 780, width: 600, height: 24 }] });
  const fixed = repair.applyProposalRepair(raw, source, base), result = compileHubPlan(source, fixed).hub;
  assert(result.layers.some(layer => layer.id === 'ai-decoration-finals-heading' && layer.text === 'FINALS'));
  assert(fixed.operations[0].op === 'decoration');
});

test('bad revision indices, duplicated indices and total proposal deletion fail atomically', () => {
  const source = hub(), base = initial(), before = structuredClone(base);
  for (const revisions of [[{ index: 80, action: 'remove' }], [{ index: 4, action: 'remove' }, { index: 4, action: 'retarget', target: 'players' }], base.operations.map((_, index) => ({ index, action: 'remove' }))]) assert.throws(() => repair.applyProposalRepair(correction(revisions), source, base));
  assert.deepEqual(base, before);
});

test('missing targets receive compact indexed repair instead of complete generation again', async () => {
  const source = hub(), before = structuredClone(source), service = new LocalAiService(), calls = [];
  service.state.set('ready');
  service.request = async (kind, payload) => {
    calls.push({ kind, payload });
    return { raw: calls.length === 1 ? fixture.proposal : fixture.repairs[0] };
  };
  const result = await service.generate(source, 'Create a polished tournament broadcast', 'create', { interpret: false, review: false });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['generate', 'repair']);
  assert.equal(calls[1].payload.maxTokens, 900); assert.equal(calls[1].payload.messages[0].content, repair.HUB_PROPOSAL_REPAIR_PROMPT);
  const feedback = JSON.parse(calls[1].payload.messages[1].content);
  assert.equal(feedback.issues[0].path, '/operations/4/target'); assert(feedback.proposal[4].css.includes('.player-header'));
  assert(!feedback.proposal[0].css); assert.equal(result.metrics.attempts[1].kind, 'proposal-repair');
  assert.deepEqual(source, before); assert.equal(result.metrics.localCorrections, 0);
});

test('indexed repair can proceed into a measured CSS repair while retaining earlier changes', async () => {
  const service = new LocalAiService(), calls = []; service.state.set('ready');
  service.request = async kind => { calls.push(kind); return { raw: [fixture.proposal, ...fixture.repairs][calls.length - 1] }; };
  let inspections = 0;
  const result = await service.generate(hub(), 'Create a readable broadcast', 'create', { interpret: false, review: false, inspect: async () => ({ measurements: {
    viewport: [1280, 720], fonts: [], clipped: [], frames: [], missingImages: 0, tableGapPx: 0,
    rosterDetails: [{ portraitMin: 25, itemMax: 20, itemMin: ++inspections === 1 ? 4 : 20, separator: 0 }],
  } }) });
  assert(result, service.error()); assert.deepEqual(calls, ['generate', 'repair', 'repair']);
  assert.deepEqual(result.metrics.attempts.map(item => item.kind), ['generation', 'proposal-repair', 'style-repair']);
  assert(result.hub.layers.some(layer => layer.style?.customCss.includes('var(--roster-tracks)')));
});

test('incomplete indexed corrections retry the retained proposal, rather than appending duplicates', async () => {
  const service = new LocalAiService(), calls = []; service.state.set('ready');
  const outputs = [fixture.proposal, '{', fixture.repairs[0]];
  service.request = async (kind, payload) => { calls.push({ kind, payload }); return { raw: outputs.shift() }; };
  const result = await service.generate(hub(), 'Create a polished broadcast', 'create', { interpret: false, review: false });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['generate', 'repair', 'repair']);
  assert.equal(JSON.parse(calls[2].payload.messages[1].content).proposal.length, 5);
});

test('missing-layer diagnostics tell the user the exact cause and retain full correction details', () => {
  const issue = { code: 'target', layerIds: [], path: '/operations/4/target', message: 'No layers match player-header. Available aliases: ' + 'scoreboards, players, '.repeat(10) };
  assert.equal(validationSummary([issue]), 'No layers match player-header.');
  assert(repairFeedback([issue], 1, 'create').includes(issue.message));
});
