import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { runHubReasoning, HUB_REASONING_LIMITS } = await import('../src/app/features/editor/ai/hub-reasoning.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { createBroadcastScaffold, designBriefSchema, parseDesignBrief } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const hub = () => { const layout = createBroadcastScaffold(); return { _id: 'reason-test', hubName: 'Test', layout, layers: layout.layers }; };
const designPlan = { identity: 'Dark teal and warm orange fade toward charcoal.', composition: 'Centered half-width scoreboard; joined bottom tables.',
  typography: 'Large scores, bold names, quieter KDA.', playerRows: 'Six visible fields; items outward, names/stats inward, level beside portrait.' };
const brief = () => ({ designPlan, summary: 'Create a teal and orange broadcast', goals: ['Teal/orange identity'], targets: ['all'], preserve: [], preferences: [], functionalRequirements: [], scope: 'broad', constraints: [], unresolved: [] });
const response = JSON.stringify({ summary: 'A broadcast', styles: [{ target: 'all', mode: 'patch', css: '&{color:white}' }], operations: [] });
const chunk = (content, finish_reason = null) => ({ choices: [{ delta: { content }, finish_reason }] });
function scriptedEngine(generator) {
  const calls = []; let interrupts = 0, resets = 0;
  const engine = { resetChat: async () => { resets++; }, interruptGenerate: async () => { interrupts++; },
    chat: { completions: { create: async request => { calls.push(request); return generator(); } } } };
  return { engine, calls, interrupts: () => interrupts, resets: () => resets };
}
function serviceWith(handler, model = 'Qwen3-4B-q4f16_1-MLC') {
  const service = new LocalAiService(); service.state.set('ready'); service.metrics.set({ model });
  const calls = []; service.request = async (kind, payload, timeout) => { calls.push({ kind, payload, timeout }); return handler(kind, payload); };
  return { service, calls };
}

test('thinking gets a bounded unconstrained pass, without exposing its draft in progress events', async () => {
  const { engine, calls, resets } = scriptedEngine(async function* () { yield chunk('<think>Allocate all six fields.'); yield chunk('</think>discard after stop', 'stop'); });
  const progress = []; const result = await runHubReasoning(engine, { instruction: 'Make a broadcast' }, (...args) => progress.push(args));
  assert.equal(resets(), 1); assert.equal(calls[0].extra_body.enable_thinking, true);
  assert.equal(calls[0].response_format, undefined); assert.equal(calls[0].max_tokens, 384); assert.deepEqual(calls[0].stop, ['</think>']);
  assert.equal(result.notes, 'Allocate all six fields.'); assert.equal(result.truncated, false);
  assert(progress.every(args => args.length === 0));
});

test('token-limited notes are provisional, usable input rather than a failed JSON proposal', async () => {
  const { engine } = scriptedEngine(async function* () { yield chunk('<think>Use explicit field', 'length'); yield { choices: [], usage: { completion_tokens: 384 } }; });
  const result = await runHubReasoning(engine, {});
  assert.equal(result.stopReason, 'token-budget'); assert.equal(result.truncated, true); assert.equal(result.notes, 'Use explicit field');
  assert.equal(result.usage.completion_tokens, 384);
});

test('wall-clock thinking limit interrupts once and drains before CSS can start', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const script = scriptedEngine(async function* () { entered(); await new Promise(resolve => { release = resolve; }); yield chunk('<think>Retain the palette.', 'stop'); });
  const pending = runHubReasoning(script.engine, {}); await ready;
  t.mock.timers.tick(HUB_REASONING_LIMITS.maxMs); assert.equal(script.interrupts(), 1);
  release(); const result = await pending; assert.equal(result.stopReason, 'time-budget'); assert.equal(result.truncated, true);
});

test('reasoning stream failure propagates and clears its timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const script = scriptedEngine(async function* () { throw new Error('GPU lost'); });
  await assert.rejects(runHubReasoning(script.engine, {}), /GPU lost/);
  t.mock.timers.tick(HUB_REASONING_LIMITS.maxMs + 1); assert.equal(script.interrupts(), 0);
});

test('reasoning is opt-in; interpreter and CSS remain the normal two calls', async () => {
  const { service, calls } = serviceWith(async kind => ({ raw: kind === 'interpret' ? JSON.stringify(brief()) : response }));
  const result = await service.generate(hub(), 'Create a teal and orange broadcast', 'create', { review: false });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['interpret', 'generate']);
  assert.equal(result.metrics.reasoning.requested, false);
  assert(calls[0].payload.schema.required.includes('designPlan'));
  assert(JSON.parse(calls[0].payload.messages[1].content).components.some(layer => layer.rowFields?.includes('level')));
  assert(calls[1].payload.messages[1].content.includes(designPlan.playerRows));
});

test('one thinking pass informs CSS, never replays on correction and is not logged as validated design', async () => {
  let generated = 0;
  const { service, calls } = serviceWith(async kind => kind === 'reason'
    ? { notes: 'PRIVATE_DRAFT reserve every field', durationMs: 20, stopReason: 'token-budget', truncated: true }
    : { raw: kind === 'interpret' ? JSON.stringify(brief()) : ++generated === 1 ? '{' : response });
  const result = await service.generate(hub(), 'Create a teal and orange broadcast', 'create', { reasoning: true, review: false });
  assert(result, service.error()); assert.deepEqual(calls.map(call => call.kind), ['interpret', 'reason', 'generate', 'generate']);
  assert(calls[2].payload.messages[1].content.includes('PRIVATE_DRAFT'));
  assert.equal(calls[2].payload.messages.length, 2); assert(calls[2].payload.schema.properties.styles);
  assert.equal(result.metrics.reasoning.applied, true); assert.equal(result.metrics.reasoning.truncated, true);
  assert(!JSON.stringify(result.metrics).includes('PRIVATE_DRAFT')); assert(!result.raw.includes('PRIVATE_DRAFT'));
});

test('reasoning is skipped when it would leave too little shared time for generation', async () => {
  let elapsed = 0;
  const { service, calls } = serviceWith(async kind => { if (kind === 'interpret') elapsed = 400000; return { raw: kind === 'interpret' ? JSON.stringify(brief()) : response }; });
  service.now = () => elapsed;
  const result = await service.generate(hub(), 'Create a broadcast', 'create', { reasoning: true, review: false });
  assert(result); assert.deepEqual(calls.map(call => call.kind), ['interpret', 'generate']);
  assert(result.metrics.reasoning.skipped); assert.equal(calls[1].timeout, 200000);
});

test('unsupported Phi generation ignores Qwen-only thinking', async () => {
  const { service, calls } = serviceWith(async () => ({ raw: response }), 'Phi-3.5-vision-instruct-q4f16_1-MLC');
  assert(await service.generate(hub(), 'Create a broadcast', 'create', { reasoning: true, interpret: false, review: false }));
  assert.deepEqual(calls.map(call => call.kind), ['generate']);
});

test('hard reasoning watchdog stops a hung worker before queuing CSS', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let entered; const ready = new Promise(resolve => { entered = resolve; });
  const { service, calls } = serviceWith(async () => { entered(); return new Promise(() => {}); });
  const result = service.generate(hub(), 'Create a broadcast', 'create', { reasoning: true, interpret: false, review: false });
  await ready; t.mock.timers.tick(HUB_REASONING_LIMITS.hardLimitMs); assert.equal(await result, null);
  assert.deepEqual(calls.map(call => call.kind), ['reason']); assert.equal(service.state(), 'idle');
  assert.match(service.error(), /Design reasoning stopped/); assert(!service.error().includes('ten-minute'));
});

test('cancellation during thinking cannot start a late generation', async () => {
  const { service, calls } = serviceWith(async () => { service.cancel(); return { notes: 'late' }; });
  assert.equal(await service.generate(hub(), 'Create a broadcast', 'create', { reasoning: true, interpret: false, review: false }), null);
  assert.equal(calls.length, 1);
});

test('legacy briefs parse, but new decoder requires four free-form concrete decisions', () => {
  const legacy = brief(); delete legacy.designPlan; assert(parseDesignBrief(JSON.stringify(legacy), 'Create a broadcast'));
  const schema = designBriefSchema(hub()); assert(schema.required.includes('designPlan'));
  assert.equal(schema.properties.designPlan.properties.identity.enum, undefined);
  assert.equal(Object.keys(schema.properties)[0], 'designPlan');
});
