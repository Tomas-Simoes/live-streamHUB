import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const css = await import('../src/app/shared/helpers/authored-css.ts');
const design = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { proposalEntryIssues } = await import('../src/app/features/editor/ai/hub-proposal-repair.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { evaluateRequirement, measureRequirements } = await import('../src/app/features/editor/ai/hub-request-checks.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-mixed-css-response.json', import.meta.url), 'utf8'));
const source = () => { const layout = design.createBroadcastScaffold(); return { _id: 'css-recovery', hubName: 'CSS recovery', layout, layers: layout.layers }; };
const response = styles => JSON.stringify({ summary: 'Retained design', styles, operations: [] });
const style = (target, value) => ({ target, mode: 'patch', css: value });
const report = () => ({ viewport: [1280, 720], fonts: [], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });
function scripted(outputs) {
  const service = new LocalAiService(); service.state.set('ready'); service.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const calls = [];
  service.request = async (kind, payload) => { calls.push({ kind, payload }); const raw = outputs.shift(); assert.notEqual(raw, undefined, `Unexpected ${kind}`); return { raw }; };
  return { service, calls };
}

test('mixed root declarations are scoped in their original cascade order', () => {
  const tree = css.validateAuthoredCss('color:red;.row{color:green}color:blue;@media(min-width:1px){.row{color:yellow}}');
  assert.deepEqual(tree.nodes.map(node => node.selector ?? node.name), ['&', '[data-component-part=row]', '&', 'media']);
  assert.equal(tree.nodes[0].nodes[0].value, 'red'); assert.equal(tree.nodes[2].nodes[0].value, 'blue');
  const rendered = css.compileAuthoredCss(tree.toString(), 'isolated', 600);
  assert(rendered.includes('[data-layer-id="isolated"]')); assert(rendered.includes('@media'));
  for (const value of ['color:white; .row{background:url(https://invalid.test/x)}', 'width:1000px;.row{color:white}', 'color:red;& + body{color:white}']) assert.throws(() => css.validateAuthoredCss(value));
});

test('root display retains a real frame box while unsafe geometry and resource checks remain active', () => {
  for (const display of ['block', 'inline-block', 'grid', 'flex']) assert.doesNotThrow(() => css.validateAuthoredCss(`&{display:${display}}`));
  for (const display of ['none', 'contents', 'var(--unknown)']) assert.throws(() => css.validateAuthoredCss(`&{display:${display}}`), /frame box/);
  assert.throws(() => css.validateAuthoredCss('&{position:fixed}'), /layout operation/);
});

test('all four exact reported formats now reach only the real missing-layer error', () => {
  for (const attempt of fixture.reportedAttempts) {
    const plan = design.parseDesignResponse(attempt.raw, 'create');
    const issues = proposalEntryIssues(source(), plan);
    assert.equal(issues.length, 1); assert.equal(issues[0].code, 'target'); assert.match(issues[0].message, /ai-decoration-portal/);
    assert.equal(plan.operations.filter(operation => operation.op === 'css').length, 4);
  }
});

test('CSS failures preserve the schema-valid candidate and identify its exact entries', () => {
  const raw = response([style('scoreboards', '&{width:999px}'), style('players', '&{background:url(https://invalid.test/x)}'), style('red-players', '&{color:white}')]);
  assert.throws(() => design.parseDesignResponse(raw, 'create'), error => {
    assert.deepEqual(error.issues.map(issue => issue.path), ['/operations/0/css', '/operations/1/css']);
    assert.equal(error.candidatePlan.operations[2].css, '&{color:white}'); return true;
  });
});

test('all invalid CSS/target entries are repaired together without rewriting valid styles', async () => {
  const raw = response([style('scoreboards', '&{width:999px}'), style('players', '&{background:url(https://invalid.test/x)}'), style('red-players', '&{--identity:retained}'), style('ai-decoration-missing', 'color:white')]);
  const repair = JSON.stringify({ summary: 'Correct three entries', revisions: [{ index: 0, action: 'replace', css: '&{color:white}' }, { index: 1, action: 'replace', css: '&{background:#1e1e1e}' }, { index: 3, action: 'remove' }], styles: [], operations: [] });
  const { service, calls } = scripted([raw, repair]);
  const result = await service.generate(source(), 'Create a readable hub.', 'create', { interpret: false, review: false });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['generate', 'repair']);
  const feedback = JSON.parse(calls[1].payload.messages[1].content);
  assert.deepEqual(feedback.issues.map(issue => issue.path), ['/operations/0/css', '/operations/1/css', '/operations/3/target']);
  assert.equal(feedback.proposal[2].css, undefined);
  assert.equal(result.plan.operations[2].css, '&{--identity:retained}');
  assert.equal(result.metrics.attempts[1].kind, 'proposal-repair');
});

test('an invalid measured patch retains the entire valid candidate during indexed repair', async () => {
  const baseline = response([style('all', '&{background:#12151a;color:white}')]);
  const invalid = response([style('players', '&{background:url(https://invalid.test/x)}')]);
  const correction = JSON.stringify({ summary: 'Repair one invalid CSS patch', revisions: [{ index: 1, action: 'replace', css: '[data-component-part="name"]{font-size:18px}' }], styles: [], operations: [] });
  const { service, calls } = scripted([baseline, invalid, correction]); let renders = 0;
  const result = await service.generate(source(), 'Keep readable names.', 'create', { interpret: false, review: false, inspect: async () => {
    const measurements = report(); if (++renders === 1) measurements.clipped = [{ role: 'name', text: 'Example' }]; return { measurements };
  } });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['generate', 'repair', 'repair']);
  assert.equal(result.plan.operations[0].css, '&{background:#12151a;color:white}');
  assert.equal(result.plan.operations[1].css, '[data-component-part="name"]{font-size:18px}');
});

test('creation positions are not incorrectly protected as geometry of the previous hub', async () => {
  const adjusted = JSON.parse(response([style('all', '&{background:#12151a;color:white}')]));
  adjusted.operations = [{ op: 'frame', target: 'scoreboards', x: 960, y: 50, width: 960, height: 100 }];
  const { service, calls } = scripted([fixture.interpretation, JSON.stringify(adjusted)]);
  const result = await service.generate(source(), fixture.instruction, 'create', { review: false });
  assert(result, service.error()); assert.equal(calls.length, 2);
  assert.equal(result.hub.layers.find(layer => layer.type === 'LolScorebug').width, 960);
  assert.deepEqual(result.metrics.understoodRequest.constraints, []);
  assert.equal(result.metrics.interpretation[0].ignoredCreationConstraints.length, 1);
});

test('a malformed interpreted border-colour check cannot become a false background failure', () => {
  const req = { quote: 'Carry team colours into the portrait frames.', target: 'players', selector: '[data-component-part="portrait"]', measure: 'color', reference: '#006699', value: '#006699' };
  const check = evaluateRequirement(req, [{ width: 40, height: 40, top: 0, bottom: 40, fill: 'transparent', color: 'white', gradientDelta: 0 }], 1280);
  assert.equal(check.status, 'unverified'); assert.match(check.detail, /frame\/border/);
});

test('portrait checks in the offscreen review stage ignore clipping outside their own canvas', () => {
  const box = (left, width, height = 40) => ({ left, right: left + width, top: 0, bottom: height, width, height });
  const node = (bounds, parentElement) => ({ parentElement, getBoundingClientRect: () => bounds, matches: () => false });
  const page = node(box(0, 1600)), root = node(box(-10000, 1280), page), frame = node(box(-10000, 400), root), row = node(box(-10000, 400), frame);
  const portrait = node(box(-9900, 24, 24), row), item = node(box(-9950, 18, 18), row);
  for (const slot of [portrait, item]) { const image = node(slot.getBoundingClientRect(), slot); image.matches = () => true; slot.querySelector = () => image; slot.closest = () => row; }
  row.querySelectorAll = () => [item]; frame.dataset = { layerId: 'preview-blue' }; frame.querySelectorAll = () => [portrait]; root.querySelectorAll = () => [frame];
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ backgroundImage: 'none', backgroundColor: 'transparent', color: 'white', overflowX: 'hidden', overflowY: 'hidden' });
  try {
    const req = { quote: 'Portraits larger than items', target: 'blue-players', selector: '[data-component-part="portrait"]', measure: 'largerThan', reference: '[data-component-part="item"]', value: '' };
    const result = measureRequirements(root, source(), [req], new Map([['preview-blue', 'hub-blue-roster']]))[0];
    assert.equal(result.samples[0].width, 24); assert.equal(result.samples[0].reference.width, 18);
    assert.equal(result.check.status, 'verified');
  } finally { if (previous) globalThis.getComputedStyle = previous; else delete globalThis.getComputedStyle; }
});

test('readability and measured request failures are sent together in the same patch request', async () => {
  const { service, calls } = scripted([fixture.interpretation, response([style('all', '&{color:white}')]), response([style('all', '&{color:white;background:#1e1e1e}')])]);
  let renders = 0;
  const result = await service.generate(source(), fixture.instruction, 'create', { review: false, inspect: async (_hub, _image, requirements) => {
    const measurements = report(), failed = ++renders === 1;
    if (failed) measurements.clipped = [{ role: 'name', text: 'Example' }];
    return { measurements, requirementEvidence: [{ requirement: requirements[1], samples: [], check: { request: requirements[1].quote, status: failed ? 'failed' : 'verified', detail: 'Measured gradient' } }] };
  } });
  assert(result, service.error());
  assert.deepEqual(JSON.parse(calls[2].payload.messages[1].content).issues.map(issue => issue.code), ['readability', 'intent']);
});
