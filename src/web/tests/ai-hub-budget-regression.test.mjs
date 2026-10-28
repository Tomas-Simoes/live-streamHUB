import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { test } from 'node:test';
import Ajv from 'ajv';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { parseDesignResponse, parseDesignBrief, designBriefSchema, createBroadcastScaffold } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { requestClauses, uncoveredClauses } = await import('../src/app/features/editor/ai/hub-request-checks.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-long-summary-response.json', import.meta.url), 'utf8'));
const source = () => { const layout = createBroadcastScaffold(); return { _id: 'budget-regression', hubName: 'Budget regression', layout, layers: layout.layers }; };
const measurements = () => ({ viewport: [1280, 720], fonts: [], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });
const compact = (requirements = []) => ({ version: 2, requirements, designPlan: { identity: 'Teal and orange over charcoal', composition: 'Centered compact scoreboard and mirrored tables', typography: 'Condensed names with stronger CS', playerRows: 'All visible fields in mirrored rows' }, constraints: [], unresolved: [] });
const validCss = JSON.stringify({ summary: 'Retain readable data', styles: [{ target: 'all', mode: 'patch', css: '&{background:#12151a;color:#fff}' }], operations: [] });

test('the exact 27 October response compiles without rejecting its 571-character description', () => {
  const plan = parseDesignResponse(fixture.proposal, 'create');
  assert.equal(plan.summary.length, 571);
  assert.equal(plan.operations.length, 6);
  assert.equal(plan.operations[0].css, JSON.parse(fixture.proposal.replace(/^<think>\s*<\/think>\s*/, '')).styles[0].css);
  const result = compileHubPlan(source(), plan);
  assert.equal(result.hub.layers.length, 3);
  assert.throws(() => parseDesignResponse(JSON.stringify({ summary: 12, styles: [], operations: [] }), 'create'), /summary/);
});

test('a long description never requests a full regeneration; actual rendered problems still request a small repair', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const calls = []; let renders = 0;
  ai.request = async (kind, payload) => { calls.push({ kind, payload }); return { raw: kind === 'interpret' ? fixture.interpretation : kind === 'generate' ? fixture.proposal : validCss }; };
  const result = await ai.generate(source(), fixture.instruction, 'create', { review: false, inspect: async () => {
    const report = measurements(); if (++renders === 1) report.clipped = [{ role: 'name', text: 'Example' }]; return { measurements: report };
  } });
  assert(result, ai.error());
  assert.deepEqual(calls.map(call => call.kind), ['interpret', 'generate', 'repair']);
  const correction = JSON.parse(calls[2].payload.messages[1].content);
  assert.equal(correction.instruction, fixture.instruction);
  assert(correction.issues.every(issue => issue.code === 'readability'));
  assert.equal(calls[2].payload.maxTokens, 1400);
});

test('compact interpretation references original clauses without paraphrasing or losing unchecked goals', () => {
  const text = 'Use teal gradients. Keep CS above KDA. Make it feel elegant.';
  const value = compact([{ clause: 0, target: 'scoreboards', selector: '[data-component-part="blue-team"]', measure: 'gradient', reference: '', value: '' }]);
  const schema = designBriefSchema(source(), text), validate = new Ajv({ strict: false }).compile(schema);
  assert(validate(value), JSON.stringify(validate.errors));
  assert.equal(schema.properties.summary, undefined);
  assert.equal(schema.properties.goals, undefined);
  const brief = parseDesignBrief(JSON.stringify(value), text);
  assert.equal(brief.requirements[0].quote, requestClauses(text)[0]);
  assert.deepEqual(uncoveredClauses(text, brief.requirements), ['Keep CS above KDA.', 'Make it feel elegant.']);
  value.requirements[0].clause = 3;
  assert(!validate(value));
  assert.throws(() => parseDesignBrief(JSON.stringify(value), text), /clause indices/);
});

test('compact generation receives the full original request and the smaller interpretation budget', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const calls = [];
  ai.request = async (kind, payload) => { calls.push({ kind, payload }); return { raw: kind === 'interpret' ? JSON.stringify(compact()) : validCss }; };
  const result = await ai.generate(source(), fixture.instruction, 'create', { review: false });
  assert(result, ai.error());
  assert.equal(calls[0].payload.maxTokens, 900);
  assert.deepEqual(JSON.parse(calls[0].payload.messages[1].content).originalClauses, requestClauses(fixture.instruction));
  assert(calls[1].payload.messages[1].content.endsWith(fixture.instruction));
  assert.equal(calls[1].payload.messages[1].content.split(fixture.instruction).length - 1, 1);
  assert.deepEqual(result.metrics.requestChecks.map(check => check.request), requestClauses(fixture.instruction));
});

test('the recorded speed cannot start another full generation with only 84 seconds left', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  let elapsed = 0; const calls = []; ai.now = () => elapsed;
  ai.request = async kind => { calls.push(kind); elapsed += kind === 'interpret' ? 182768 : 333922; return { raw: kind === 'interpret' ? JSON.stringify(compact()) : '{' }; };
  assert.equal(await ai.generate(source(), fixture.instruction, 'create', { review: false }), null);
  assert.deepEqual(calls, ['interpret', 'generate']);
  assert.equal(ai.metrics().stopReason, 'insufficient-budget');
  assert(ai.metrics().retryBudget.estimatedMs > ai.metrics().retryBudget.remainingMs);
  assert(!ai.error().includes('ten-minute time limit'));
});

test('an empty correction stays a small repair against the retained candidate', async () => {
  const ai = new LocalAiService(); ai.state.set('ready'); ai.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  const calls = []; let renders = 0;
  ai.request = async (kind, payload) => {
    calls.push({ kind, payload });
    return { raw: calls.length === 2 ? JSON.stringify({ summary: 'Empty correction', styles: [], operations: [] }) : validCss };
  };
  const result = await ai.generate(source(), 'Keep the charcoal identity and readable data.', 'create', { interpret: false, review: false, inspect: async () => {
    const report = measurements(); if (++renders === 1) report.clipped = [{ role: 'name', text: 'Example' }]; return { measurements: report };
  } });
  assert(result, ai.error());
  assert.deepEqual(calls.map(call => call.kind), ['generate', 'repair', 'repair']);
  assert.equal(calls[2].payload.maxTokens, 1400);
  assert(JSON.parse(calls[2].payload.messages[1].content).current.layers.some(layer => layer.css?.includes('#12151a')));
});
