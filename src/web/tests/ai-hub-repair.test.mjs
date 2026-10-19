import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const { HUB_REPAIR_LIMITS, candidateFingerprint, repairStopReason } = await import('../src/app/features/editor/ai/hub-repair.ts');
const { parseHubReview, renderedLayoutIssues, renderedColorFamily } = await import('../src/app/features/editor/ai/hub-quality.ts');

function hub() {
  const layout = PREDEFINED_HUB_TEMPLATES[0].createLayout();
  return { _id: 'repair-test', hubName: 'Repair test', layout, layers: layout.layers };
}
function spec() {
  return { design: {
    colors: { background: '#081b38', text: '#ffffff', muted: '#b8cbe4', line: '#526f96', teamLeft: '#45b9ff', teamRight: '#ff755b' },
    typography: { bodyFont: 'Arial', headingFont: 'Impact', nameFont: 'Impact', uppercaseNames: true },
    panels: { fill: 'solid', corners: 'square', borderWidth: .5, accentWidth: 2, teamSections: false, rows: 'alternating', headerAccent: 'none' },
    layout: { scoreboardWidth: 1000, scoreboardHeight: 96, rosterWidth: 600, rosterHeight: 260, showEventPanel: false }, title: 'LIVE',
  }, operations: [] };
}
function scriptedService(outputs) {
  const service = new LocalAiService(); service.state.set('ready');
  // These lifecycle tests isolate proposal/review behavior. The default semantic
  // pipeline is covered separately in ai-hub-intent.test.mjs.
  const generate = service.generate.bind(service);
  service.generate = (hub, instruction, mode, options = {}) => generate(hub, instruction, mode, { ...options, interpret: false });
  const calls = [];
  service.request = async (_kind, payload, timeout) => {
    calls.push({ ...structuredClone(payload), timeout, notice: service.validationNotice(), status: service.status() });
    const output = outputs[calls.length - 1];
    assert.notEqual(output, undefined, 'must not request an extra inference');
    if (output instanceof Error) throw output;
    return { raw: typeof output === 'string' ? output : JSON.stringify(output) };
  };
  return { service, calls };
}

const measured = () => ({ viewport: [1280, 720], fonts: [{ role: 'names', minPx: 13.33, face: 'Impact' }], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });
const review = (approved = true, score = 4) => ({ approved, score, summary: 'Readable measured type and aligned tables.',
  issues: approved ? [] : [{ target: 'players', problem: 'Too much unused spacing.', action: 'Reduce roster height while retaining readable text.' }] });
const inspect = async () => ({ measurements: measured() });

test('render review uses the same loaded text model without rasterizing an image', async () => {
  const { service, calls } = scriptedService([spec(), review()]);
  let imageRequested;
  const proposal = await service.generate(hub(), 'Create my hub', 'create', { inspect: async (_hub, image) => { imageRequested = image; return inspect(); } });
  assert(proposal); assert.equal(imageRequested, false); assert.equal(calls.length, 2);
  assert.equal(proposal.metrics.designReview.kind, 'measurements');
  assert.match(calls[1].messages[1].content, /measurements only/);
  assert.equal(proposal.metrics.attempts[0].imageReview.supplied, false);
  assert.equal(proposal.metrics.qualityRefinements, 0);
});

test('one design refinement rerenders and reviews the result while preserving the original hub', async () => {
  const refined = spec(); refined.design.layout.rosterHeight = 250;
  const { service, calls } = scriptedService([spec(), review(false, 3), refined, review(true, 4)]);
  const original = hub(), before = structuredClone(original);
  let renders = 0;
  const proposal = await service.generate(original, 'Create a compact hub', 'create', { inspect: async () => { renders++; return inspect(); } });
  assert.deepEqual(original, before); assert.equal(renders, 2); assert.equal(calls.length, 4);
  assert.equal(proposal.metrics.qualityRefinements, 1); assert.equal(proposal.metrics.designReview.approved, true);
  assert.equal(proposal.metrics.composition.layout.rosterHeight, 250);
  assert.match(calls[2].messages[3].content, /Too much unused spacing/);
  assert.equal(calls[2].messages[1].content, calls[0].messages[1].content);
});

test('a less successful aesthetic refinement returns the better valid candidate and stops', async () => {
  const refined = spec(); refined.design.layout.rosterHeight = 280;
  const { service, calls } = scriptedService([spec(), review(false, 3), refined, review(false, 2)]);
  const proposal = await service.generate(hub(), 'Create a compact hub', 'create', { inspect });
  assert.equal(calls.length, 4); assert.equal(proposal.metrics.designReview.score, 3);
  assert.equal(proposal.metrics.composition.layout.rosterHeight, 260);
  assert.equal(proposal.metrics.stopReason, 'reviewed-with-suggestions');
});

test('invalid repeated refinements stop without discarding the earlier readable proposal', async () => {
  const invalid = spec(); invalid.design.title = '';
  const { service, calls } = scriptedService([spec(), review(false, 3), invalid, invalid]);
  const proposal = await service.generate(hub(), 'Create a compact hub', 'create', { inspect });
  assert(proposal); assert.equal(calls.length, 4);
  assert.equal(proposal.metrics.stopReason, 'quality-limit');
  assert.equal(proposal.metrics.qualityRefinements, 1);
  assert.deepEqual(JSON.parse(proposal.raw), spec());
  assert(proposal.warnings.some(issue => issue.code === 'design-suggestions'));
  assert.equal(proposal.metrics.attempts.at(-1).validation.valid, false);
});

test('an optional reviewer runtime failure keeps a validated readable proposal', async () => {
  const { service } = scriptedService([spec(), new Error('GPU review failed')]);
  const proposal = await service.generate(hub(), 'Create a hub', 'create', { inspect });
  assert(proposal); assert.equal(service.state(), 'idle');
  assert(proposal.warnings.some(issue => issue.code === 'review-unavailable'));
  assert.equal(proposal.metrics.attempts[0].reviewError, 'GPU review failed');
});

test('a failed critique of a refinement retains the previously reviewed candidate', async () => {
  const refined = spec(); refined.design.layout.rosterHeight = 250;
  const { service } = scriptedService([spec(), review(false, 3), refined, new Error('GPU review failed')]);
  const proposal = await service.generate(hub(), 'Create a hub', 'create', { inspect });
  assert.equal(proposal.metrics.composition.layout.rosterHeight, 260);
  assert.equal(proposal.metrics.designReview.score, 3);
  assert.equal(proposal.metrics.stopReason, 'reviewed-with-suggestions');
  assert(proposal.warnings.some(issue => issue.code === 'review-unavailable'));
});

test('the shared deadline during critique retains a readable proposal without starting a refinement', async () => {
  const { service, calls } = scriptedService([spec(), review(false)]);
  let elapsed = 0; service.now = () => elapsed;
  const scripted = service.request;
  service.request = async (...args) => { const result = await scripted(...args); if (args[0] === 'review') elapsed = 300001; return result; };
  const proposal = await service.generate(hub(), 'Create a hub', 'create', { inspect });
  assert(proposal); assert.equal(calls.length, 2); assert.equal(service.state(), 'idle');
  assert.equal(proposal.metrics.stopReason, 'quality-limit'); assert.equal(proposal.metrics.refinementStopReason, 'time-limit');
});

test('cancelling during render inspection returns no proposal or review request', async () => {
  const { service, calls } = scriptedService([spec()]);
  const proposal = await service.generate(hub(), 'Create a hub', 'create', { inspect: async () => { service.cancel(); return inspect(); } });
  assert.equal(proposal, null); assert.equal(calls.length, 1); assert.equal(service.state(), 'idle');
});

test('vision review sends one actual image to the same model and excludes pixels from exported metrics', async () => {
  const { service, calls } = scriptedService([spec(), review()]);
  service.metrics.set({ model: 'Phi-3.5-vision-instruct-q4f16_1-MLC' });
  const image = 'data:image/png;base64,ACTUAL_CAPTURE';
  const proposal = await service.generate(hub(), 'Create a hub', 'create', { inspect: async (_hub, withImage) => {
    assert.equal(withImage, true); return { measurements: measured(), image };
  } });
  assert.equal(proposal.metrics.designReview.kind, 'image');
  assert.deepEqual(calls[1].messages.at(-1).content[1], { type: 'image_url', image_url: { url: image } });
  assert(!JSON.stringify(proposal.metrics).includes('ACTUAL_CAPTURE'));
});

test('hard readability checks reject small or clipped text while allowing intentional table spacing', () => {
  const report = measured(); report.tableGapPx = 40;
  assert.deepEqual(renderedLayoutIssues(report), []);
  report.fonts[0].minPx = 8; report.clipped.push({ role: 'names', text: 'Long player name' });
  assert.equal(renderedLayoutIssues(report).length, 2);
  assert.throws(() => parseHubReview(JSON.stringify({ ...review(), script: 'run code' })));
});

test('visual grounding labels actual rendered lime/coral accents without assuming native blue/red teams', () => {
  assert.equal(renderedColorFamily('rgb(216, 241, 76)'), 'lime');
  assert.equal(renderedColorFamily('rgb(255, 119, 93)'), 'coral/red');
  assert.equal(renderedColorFamily('rgb(22, 22, 22)'), 'neutral');
  assert.equal(renderedColorFamily('unknown'), 'unknown');
});

test('a valid initial layout does not trigger a repair', async () => {
  const { service, calls } = scriptedService([spec()]);
  const proposal = await service.generate(hub(), 'Create a broadcast');
  assert(proposal); assert.equal(calls.length, 1);
  assert.equal(service.metrics().repairAttempts, 0);
  assert.equal(service.metrics().stopReason, 'validated');
  assert.equal(service.metrics().attempts[0].validation.valid, true);
});

test('different validation failures can be repaired through the fourth attempt without growing conversation history', async () => {
  const missingTitle = spec(); missingTitle.design.title = '';
  const wrongColor = spec(); wrongColor.design.colors.background = 'navy';
  const wrongFont = spec(); wrongFont.design.typography.bodyFont = 'Comic Sans';
  const { service, calls } = scriptedService([missingTitle, wrongColor, wrongFont, spec()]);
  const original = hub(), before = structuredClone(original);
  const proposal = await service.generate(original, 'Create my teal broadcast');
  assert(proposal); assert.deepEqual(original, before);
  assert.equal(calls.length, 4); assert.equal(service.metrics().repairAttempts, 3);
  assert.deepEqual(service.metrics().attempts.map(attempt => attempt.validation.valid), [false, false, false, true]);
  assert.match(service.validationNotice(), /validated after 3 automatic corrections/);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.messages.length, index ? 4 : 2);
    assert.equal(call.messages[1].content, calls[0].messages[1].content);
    assert.deepEqual(call.schema.properties.operations.items.oneOf.map(op => op.properties.op.const), ['style', 'decoration', 'text'], 'creation offers creative styling without unrelated imperative changes');
    if (index) {
      assert.match(call.notice, /Correcting automatically/);
      assert.match(call.status, new RegExp(`Correcting layout \\(${index}/3\\)`));
      assert.deepEqual(JSON.parse(call.messages[2].content), [missingTitle, wrongColor, wrongFont][index - 1]);
    }
  }
});

test('four distinct invalid answers stop at the attempt limit and retain exact diagnostics', async () => {
  const invalid = [spec(), spec(), spec(), spec()];
  invalid[0].design.title = ''; invalid[1].design.colors.background = 'navy';
  invalid[2].design.typography.bodyFont = 'Comic Sans'; invalid[3].design.layout.scoreboardWidth = 100;
  const { service, calls } = scriptedService(invalid);
  const original = hub(), before = structuredClone(original);
  assert.equal(await service.generate(original, 'Create a broadcast', 'create', { interpret: false }), null);
  assert.equal(calls.length, HUB_REPAIR_LIMITS.maxAttempts);
  assert.equal(service.metrics().stopReason, 'attempt-limit');
  assert(service.metrics().attempts.every(attempt => attempt.validation.issues.length > 0));
  assert.match(service.error(), /Stopped after 4 attempts/);
  assert.equal(service.state(), 'ready'); assert.deepEqual(original, before);
});

test('the same invalid answer with different formatting stops after one correction', async () => {
  const invalid = spec(); invalid.design.title = '';
  const reordered = { operations: [], design: Object.fromEntries(Object.entries(invalid.design).reverse()) };
  const { service, calls } = scriptedService([invalid, '<think>\n</think>\n' + JSON.stringify(reordered, null, 2)]);
  assert.equal(await service.generate(hub(), 'Create a broadcast'), null);
  assert.equal(calls.length, 2); assert.equal(service.metrics().stopReason, 'repeated-proposal');
  assert.equal(candidateFingerprint(JSON.stringify(invalid)), candidateFingerprint(JSON.stringify(reordered)));
});

test('three different answers failing the same checks stop for lack of progress', async () => {
  const invalid = [100, 200, 300].map(width => { const value = spec(); value.design.layout.scoreboardWidth = width; return value; });
  const { service, calls } = scriptedService(invalid);
  assert.equal(await service.generate(hub(), 'Create a broadcast'), null);
  assert.equal(calls.length, 3); assert.equal(service.metrics().stopReason, 'no-progress');
  assert.match(service.error(), /same validation problems/);
});

test('fresh generated layer UUIDs are not considered progress on the same collisions', () => {
  const failures = [1, 2, 3].map(index => ({ fingerprint: String(index), issues: [{ code: 'collision',
    layerIds: [`generated-blue-roster-00000000-0000-4000-8000-00000000000${index}`], message: 'Player tables overlap.' }] }));
  assert.equal(repairStopReason(failures, 10), 'no-progress');
});

test('all attempts share five minutes and a valid response arriving after the deadline is discarded', async () => {
  const service = new LocalAiService(); service.state.set('ready');
  let elapsed = 0; service.now = () => elapsed;
  const timeouts = [];
  service.request = async (_kind, _payload, timeout) => {
    timeouts.push(timeout);
    if (timeouts.length === 1) { elapsed = 250_000; const invalid = spec(); invalid.design.title = ''; return { raw: JSON.stringify(invalid) }; }
    elapsed = HUB_REPAIR_LIMITS.maxDurationMs + 1; return { raw: JSON.stringify(spec()) };
  };
  const original = hub(), before = structuredClone(original);
  assert.equal(await service.generate(original, 'Create a broadcast', 'create', { interpret: false }), null);
  assert.deepEqual(timeouts, [300_000, 50_000]);
  assert.equal(service.metrics().stopReason, 'time-limit'); assert.equal(service.state(), 'idle');
  assert.match(service.error(), /five-minute time limit/); assert.deepEqual(original, before);
});

test('an unresponsive worker is terminated when the shared deadline expires', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const service = new LocalAiService(); service.state.set('ready'); service.now = () => Date.now();
  let terminated = 0;
  service.worker = { postMessage() {}, terminate() { terminated++; } };
  const generation = service.generate(hub(), 'Create a broadcast', 'create', { interpret: false });
  t.mock.timers.tick(HUB_REPAIR_LIMITS.maxDurationMs);
  assert.equal(await generation, null);
  assert.equal(terminated, 1); assert.equal(service.pending.size, 0);
  assert.equal(service.state(), 'idle'); assert.equal(service.metrics().stopReason, 'time-limit');
});

test('cancellation during a repair ignores the late model response', async () => {
  const service = new LocalAiService(); service.state.set('ready');
  let calls = 0, finishRepair;
  service.request = async () => {
    if (++calls === 1) { const invalid = spec(); invalid.design.title = ''; return { raw: JSON.stringify(invalid) }; }
    return new Promise(resolve => { finishRepair = resolve; });
  };
  const generation = service.generate(hub(), 'Create a broadcast', 'create', { interpret: false });
  for (let tick = 0; tick < 10 && !finishRepair; tick++) await Promise.resolve();
  assert.equal(calls, 2); assert.match(service.validationNotice(), /Correcting automatically/);
  service.cancel(); finishRepair({ raw: JSON.stringify(spec()) });
  assert.equal(await generation, null);
  assert.equal(service.state(), 'idle'); assert.equal(service.validationNotice(), '');
  assert.match(service.status(), /Cancelled/); assert.equal(service.error(), '');
});

test('runtime/GPU failures do not start another correction', async () => {
  const { service, calls } = scriptedService([new Error('GPU device lost')]);
  assert.equal(await service.generate(hub(), 'Create a broadcast'), null);
  assert.equal(calls.length, 1); assert.equal(service.state(), 'idle');
  assert.equal(service.metrics().stopReason, 'runtime-error');
  assert.match(service.metrics().attempts[0].error, /GPU device lost/);
});

test('contrast repair keeps valid design decisions constrained while allowing the unreadable foreground to change', async () => {
  const invalid = spec(); invalid.design.colors.text = invalid.design.colors.background;
  const { service, calls } = scriptedService([invalid, spec()]);
  assert(await service.generate(hub(), 'Create a compact blue broadcast'));
  assert.equal(calls.length, 2);
  const locked = calls[1].schema.properties.design.properties;
  assert.equal(locked.colors.properties.background.const, invalid.design.colors.background);
  assert.equal(locked.typography.properties.headingFont.const, invalid.design.typography.headingFont);
  assert.equal(locked.layout.properties.scoreboardWidth.const, invalid.design.layout.scoreboardWidth);
  assert.equal(locked.colors.properties.text.const, undefined);
  assert.match(calls[1].notice, /difficult to read/);
});

test('automatic edit repairs use the original hub and retain its layers instead of creating a new design', async () => {
  const edited = { template: 'current', palette: null,
    appearance: { target: 'all', backgroundColor: null, gradientTo: null, gradientDirection: null, borderColor: null, borderWidth: null },
    scoreboard: { paddingX: 20, showObjectives: null, showGold: null, showGameTime: null },
    players: { portraitSize: null, gap: null, showChampion: null, showKda: null, showCs: null, showGold: null, showItems: null }, operations: [] };
  const { service, calls } = scriptedService(['{', edited]);
  const original = hub(), before = structuredClone(original);
  const proposal = await service.generate(original, 'Add padding to the scoreboard', 'edit');
  assert(proposal); assert.equal(calls.length, 2); assert.deepEqual(original, before);
  assert.deepEqual(proposal.hub.layers.map(layer => layer.id), original.layers.map(layer => layer.id));
  assert.deepEqual(calls[1].schema.properties.template, { const: 'current' });
  assert.equal(calls[1].messages[1].content, calls[0].messages[1].content);
  assert.match(calls[1].messages[3].content, /ORIGINAL hub and its existing IDs/);
});

test('review warnings on an intentional placement do not cause a retry loop', async () => {
  const value = spec(); value.operations = [{ op: 'move', target: 'scoreboards', dx: 0, dy: 200 }];
  const { service, calls } = scriptedService([value]);
  const proposal = await service.generate(hub(), 'Move the scoreboard down');
  assert(proposal); assert.equal(calls.length, 1);
  assert(proposal.warnings.some(warning => warning.code === 'game-area'));
});
