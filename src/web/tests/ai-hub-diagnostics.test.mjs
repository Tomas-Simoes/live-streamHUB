import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { HubDiagnosticRun, diagnosticValue, HubDiagnosticArchive } = await import('../src/app/features/editor/ai/hub-diagnostics.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { createBroadcastScaffold } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const makeHub = () => { const layout = createBroadcastScaffold(); return { _id: 'diagnostic-test', hubName: 'Broadcast', layout, layers: layout.layers, user: { email: 'private@example.test' } }; };
const response = JSON.stringify({ summary: 'Teal broadcast', styles: [{ target: 'scoreboards', mode: 'patch', css: '& {background:teal}' }], operations: [] });
function serviceWithWorker(handler) {
  const service = new LocalAiService(); service.state.set('ready'); service.metrics.set({ model: 'Qwen3-4B-q4f16_1-MLC' });
  service.worker = { terminate() {}, postMessage(data) {
    queueMicrotask(() => {
      const pending = service.pending.get(data.id);
      try {
        const result = handler(data, service);
        if (result === undefined) return;
        clearTimeout(pending.timer); service.pending.delete(data.id); pending.resolve(result);
      } catch (error) { clearTimeout(pending.timer); service.pending.delete(data.id); pending.reject(error); }
    });
  } };
  return service;
}

test('diagnostic freezes original layout and stages, excluding account records', () => {
  const hub = makeHub(); const run = new HubDiagnosticRun('Make teal', 'create', 'qwen', { reasoning: true }, hub, hub);
  run.stage('compiled', hub, { operations: [] });
  hub.layers[0].style.customCss = 'CHANGED'; hub.hubName = 'changed';
  assert.equal(run.baseline.hubName, 'Broadcast');
  assert.notEqual(run.stages[0].hub.layers[0].style.customCss, 'CHANGED');
  assert(!JSON.stringify(run).includes('private@example.test'));
  const archive = new HubDiagnosticArchive(); archive.latest.set(run);
  run.appliedAt = new Date().toISOString();
  assert.equal(archive.latest().instruction, 'Make teal');
  assert(archive.latest().appliedAt);
});

test('diagnostic excludes internal drafts both from results and subsequent prompts', () => {
  const data = { notes: 'PRIVATE_DRAFT', messages: [{ content: 'Preliminary implementation notes (may be incomplete; verify them against the actual DOM and original request):\nPRIVATE_DRAFT\nThese notes do not override the user.\nOriginal user instruction: Make teal' }] };
  const exported = JSON.stringify(diagnosticValue(data));
  assert(!exported.includes('PRIVATE_DRAFT')); assert(exported.includes('Make teal'));
});

test('captures exact worker response separately from compiled and published layouts', async () => {
  const service = serviceWithWorker(() => ({ raw: response, usage: { completion_tokens: 30 } }));
  const result = await service.generate(makeHub(), 'Make teal', 'create', { interpret: false, review: false });
  assert(result, service.error()); const run = service.diagnostics();
  assert.equal(run.instruction, 'Make teal'); assert.equal(run.settings.review, false);
  assert.equal(run.calls.length, 1); assert.equal(run.calls[0].response.raw, response);
  assert.equal(run.calls[0].status, 'completed');
  assert(run.calls[0].request.messages.some(m => m.content.includes('Make teal')));
  assert(run.stages.some(stage => stage.kind === 'compiled')); assert(run.proposed);
  result.hub.layers[0].style.customCss = 'changed after apply';
  assert.notEqual(run.proposed.layers[0].style.customCss, 'changed after apply');
  assert.equal(run.outcome.status, 'validated');
});

test('runtime failure retains exact request, partial stream and error', async () => {
  const service = serviceWithWorker((data, service) => {
    service.diagnostics().partial(data.id, '{"styles":['); throw new Error('GPU lost');
  });
  assert.equal(await service.generate(makeHub(), 'Make teal', 'create', { interpret: false, review: false }), null);
  const run = service.diagnostics(); assert.equal(run.outcome.status, 'failed');
  assert.equal(run.calls[0].partial, '{"styles":['); assert.equal(run.calls[0].error, 'GPU lost');
  assert(run.baseline); assert.equal(run.proposed, undefined);
});

test('cancelling retains partial output and records stopped request', async () => {
  let started; const ready = new Promise(resolve => { started = resolve; });
  const service = serviceWithWorker((data, service) => { service.diagnostics().partial(data.id, '{partial'); started(); });
  const pending = service.generate(makeHub(), 'Make teal', 'create', { interpret: false });
  await ready; service.cancel(); assert.equal(await pending, null);
  const run = service.diagnostics(); assert.equal(run.outcome.status, 'cancelled');
  assert.equal(run.calls[0].status, 'failed'); assert.equal(run.calls[0].partial, '{partial');
});

test('a new run does not inherit previous failures or overwrite previous archive objects', async () => {
  const service = serviceWithWorker(() => ({ raw: response }));
  await service.generate(makeHub(), 'First request', 'create', { interpret: false, review: false });
  const first = service.diagnostics();
  await service.generate(makeHub(), 'Second request', 'edit', { interpret: false, review: false });
  assert.notEqual(service.diagnostics().id, first.id);
  assert.equal(first.instruction, 'First request'); assert.equal(first.calls.length, 1);
  assert.equal(service.diagnostics().calls.length, 1); assert.equal(service.diagnostics().mode, 'edit');
});
