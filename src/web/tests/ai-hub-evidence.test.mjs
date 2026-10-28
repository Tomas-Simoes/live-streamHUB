import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { evaluateRequirement, requestClauses, uncoveredClauses } = await import('../src/app/features/editor/ai/hub-request-checks.ts');
const { parseDesignBrief, createBroadcastScaffold } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { reviewShowsImprovement, validateVisualReview, HUB_REVIEW_DECODE_SCHEMA } = await import('../src/app/features/editor/ai/hub-quality.ts');
const { selectVisualReferences, visualReferenceContext, NATIVE_VISUAL_REFERENCES } = await import('../src/app/features/editor/ai/hub-visual-library.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const requirement = (measure, overrides = {}) => ({ quote: 'Add a gradient', target: 'scoreboards', selector: '[data-component-part="blue-team"]', measure, reference: '', value: '', ...overrides });
const sample = overrides => ({ width: 640, height: 40, top: 0, bottom: 40, fill: 'rgb(0, 191, 255)', color: 'rgb(255, 255, 255)', gradientDelta: 0, ...overrides });
const brief = requirements => ({ summary: 'Broadcast', goals: ['A coordinated broadcast'], targets: ['all'], preserve: [], preferences: [], functionalRequirements: [], scope: 'broad', constraints: [], unresolved: [], requirements });
const source = () => { const layout = createBroadcastScaffold(); return { _id: 'evidence', hubName: 'Evidence', layout, layers: layout.layers }; };
const measured = () => ({ viewport: [1280,720], fonts: [], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });

test('flat backgrounds fail a gradient requirement; visible gradient is only partially verified', () => {
  assert.equal(evaluateRequirement(requirement('gradient'), [sample()], 1280).status, 'failed');
  const result = evaluateRequirement(requirement('gradient'), [sample({ fill: 'linear-gradient(#123456,#111111)', gradientDelta: .3 })], 1280);
  assert.equal(result.status, 'limited'); assert.match(result.detail, /Direction/);
});
test('half-width and vertical grouping are checked against actual geometry', () => {
  assert.equal(evaluateRequirement(requirement('widthFraction', { value: '.5' }), [sample({ width: 800 })], 1280).status, 'failed');
  assert.equal(evaluateRequirement(requirement('widthFraction', { value: '.5' }), [sample()], 1280).status, 'verified');
  const horizontal = sample({ reference: { width: 20, height: 20, top: 5, bottom: 25 } });
  assert.equal(evaluateRequirement(requirement('above'), [horizontal], 1280).status, 'failed');
  assert.equal(evaluateRequirement(requirement('above'), [sample({ bottom: 10, reference: { width: 20, height: 20, top: 12, bottom: 32 } })], 1280).status, 'verified');
});
test('portrait relationship compares visible sides, not just the image width', () => {
  const undersized = sample({ width: 60, height: 24, reference: { width: 25, height: 25, top: 0, bottom: 25 } });
  assert.equal(evaluateRequirement(requirement('largerThan'), [undersized], 1280).status, 'failed');
  assert.equal(evaluateRequirement(requirement('largerThan'), [sample({ ...undersized, height: 30 })], 1280).status, 'verified');
});
test('unavailable measurements and artistic goals never become fabricated passes', () => {
  assert.equal(evaluateRequirement(requirement('above'), [], 1280).status, 'unverified');
  assert.equal(evaluateRequirement(requirement('visual'), [sample()], 1280).status, 'unverified');
  assert.equal(evaluateRequirement(requirement('largerThan'), [sample()], 1280).status, 'unverified');
  assert.equal(evaluateRequirement(requirement('widthFraction', { value: 'invented' }), [sample()], 1280).status, 'unverified');
});
test('hue measurement does not certify a gradient palette or exact artistic colour name', () => {
  const req = requirement('color', { value: '#008080', reference: 'fill' });
  assert.equal(evaluateRequirement(req, [sample({ fill: 'rgb(255,128,0)' })], 1280).status, 'failed');
  assert.equal(evaluateRequirement(req, [sample({ fill: 'rgb(0,128,128)' })], 1280).status, 'limited');
  assert.equal(evaluateRequirement(req, [sample({ fill: 'linear-gradient(#008080,#111111)' })], 1280).status, 'unverified');
});
test('quoted requirements cannot invent user requests and uncovered clauses remain visible', () => {
  const text = 'Add a gradient. Make it elegant.';
  const parsed = parseDesignBrief(JSON.stringify(brief([requirement('gradient')])), text);
  assert.deepEqual(uncoveredClauses(text, parsed.requirements), ['Make it elegant.']);
  assert.deepEqual(requestClauses('Use 0.5 spacing.\nKeep the score.'), ['Use 0.5 spacing.', 'Keep the score.']);
  assert.throws(() => parseDesignBrief(JSON.stringify(brief([requirement('visual', { quote: 'Make it pink' })])), text), /actual words/);
});
test('reference retrieval selects at most two annotated examples without embedding images in text context', () => {
  const entry = { id: 'user-example', source: 'user', title: 'Copper editorial', description: 'Ivory copper editorial composition', principles: ['Strong dark typography on ivory'], tags: [], image: 'data:image/png;base64,PRIVATE_IMAGE' };
  const selected = selectVisualReferences('Ivory copper editorial composition', [...NATIVE_VISUAL_REFERENCES, entry]);
  assert.equal(selected.length, 2); assert.equal(selected[0].id, entry.id);
  assert(!JSON.stringify(visualReferenceContext(selected)).includes('PRIVATE_IMAGE'));
  assert(JSON.stringify(visualReferenceContext(selected)).includes('Strong dark typography'));
});
test('numerical scores cannot choose a revised hub; resolved evidence without regressions can', () => {
  const before = { issues: [{ problem: 'Header competes with names' }] };
  assert.equal(reviewShowsImprovement(before, { score: 5, approved: true }), false);
  assert.equal(reviewShowsImprovement(before, { comparison: 'improved', resolved: [], regressions: [] }), false);
  assert.equal(reviewShowsImprovement(before, { comparison: 'improved', resolved: ['Header competes with names'], regressions: ['Names became too small'] }), false);
  assert.equal(reviewShowsImprovement(before, { comparison: 'uncertain', resolved: ['Header competes with names'], regressions: [] }), false);
  assert.equal(reviewShowsImprovement(before, { comparison: 'improved', resolved: ['Header competes with names'], regressions: [] }), true);
});
test('visual correction must have evidence and a criterion; new decoder has no score', () => {
  const review = { approved: false, summary: 'The header dominates.', issues: [{ target: 'players', problem: 'Large header', action: 'Reduce padding' }] };
  assert.throws(() => validateVisualReview(review), /evidence/);
  validateVisualReview({ ...review, issues: [{ ...review.issues[0], evidence: 'Header taller than rows', criterion: 'Compact tables' }] });
  assert.equal(HUB_REVIEW_DECODE_SCHEMA.properties.score, undefined);
});
test('a measured request failure reaches CSS repair even with all optional reviews off', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const calls = [], req = requirement('gradient'); let renders = 0;
  ai.request = async (kind, payload) => {
    calls.push({ kind, payload });
    return { raw: JSON.stringify(kind === 'interpret' ? brief([req]) : { summary: kind, styles: [{ target: 'scoreboards', mode: 'patch', css: kind === 'repair' ? '[data-component-part="blue-team"]{background:linear-gradient(#123456,#111111)}' : '&{color:white}' }], operations: [] }) };
  };
  const result = await ai.generate(source(), 'Add a gradient', 'create', { review: false, inspect: async (_hub, _image, requirements) => {
    assert.deepEqual(requirements, [req]);
    const samples = [sample(++renders === 1 ? {} : { fill: 'linear-gradient(#123456,#111111)', gradientDelta: .3 })];
    return { measurements: measured(), requirementEvidence: [{ requirement: req, samples, check: evaluateRequirement(req, samples, 1280) }] };
  } });
  assert(result, ai.error()); assert.deepEqual(calls.map(call => call.kind), ['interpret', 'generate', 'repair']);
  assert.match(calls[2].payload.messages[1].content, /no measurable gradient/);
  assert.equal(result.metrics.requestChecks[0].status, 'limited');
  assert.equal(result.metrics.referenceCssEnabled, false);
  assert(!calls[1].payload.messages[1].content.includes('Optional CSS examples'));
});

test('an incomplete brief cannot replace original instructions in generation, repair or the checklist', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const instruction = 'Make a dark teal hub. CS must stand above KDA. Keep the names as written, nao uppercase pls.';
  const calls = [];
  ai.request = async (kind, payload) => {
    calls.push({ kind, payload });
    const response = kind === 'interpret' ? brief([]) : { summary: kind, styles: [{ target: 'scoreboards', mode: 'patch', css: kind === 'generate' ? '&{color:#111111}' : '&{color:#ffffff}' }], operations: [] };
    return { raw: JSON.stringify(response) };
  };
  let renders = 0;
  const result = await ai.generate(source(), instruction, 'create', { review: false, inspect: async () => {
    const measurements = measured();
    if (++renders === 1) measurements.integrity = { hidden: [], outside: [], lowContrast: [{ role: 'team-code', ratio: 1 }] };
    return { measurements };
  } });
  assert(result, ai.error());
  assert.deepEqual(calls.map(call => call.kind), ['interpret', 'generate', 'repair']);
  assert(calls[1].payload.messages.at(-1).content.endsWith(instruction));
  assert.equal(JSON.parse(calls[2].payload.messages.at(-1).content).instruction, instruction);
  assert.deepEqual(result.metrics.requestChecks.map(check => check.request), requestClauses(instruction));
  assert(result.metrics.requestChecks.every(check => check.status === 'unverified'));
});

test('over-budget instructions are explicitly refused without sending a truncated request', async () => {
  const ai = new LocalAiService(); ai.state.set('ready');
  ai.request = async () => { assert.fail('No model call may receive a silently shortened instruction'); };
  assert.equal(await ai.generate(source(), 'x'.repeat(6001), 'create'), null);
  assert.match(ai.error(), /6000 characters/);
});
