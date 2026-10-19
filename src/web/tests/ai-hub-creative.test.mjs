import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { parseHubIntent, resolveIntentPlan, checkHubIntent } = await import('../src/app/features/editor/ai/hub-intent.ts');
const { compositionSchemaForInstruction, parseHubCreateSpec } = await import('../src/app/features/editor/ai/hub-create-spec.ts');
const { editSchemaForInstruction, parseHubEditSpec } = await import('../src/app/features/editor/ai/hub-edit-spec.ts');
const { validateStyleValue, savedPartStyles } = await import('../src/app/features/editor/ai/hub-part-style.ts');
const { gradientColorDelta, renderedLayoutIssues } = await import('../src/app/features/editor/ai/hub-quality.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const qwen = 'Qwen3-4B-q4f16_1-MLC', phi = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
const hub = () => { const layout = PREDEFINED_HUB_TEMPLATES.find(item => item.id === 'pulse-broadcast').createLayout(); return { _id: 'creative', hubName: 'Creative', layout, layers: layout.layers }; };
const rule = (part, property, value) => ({ part, declarations: [{ property, value }] });
const intent = changes => ({ summary: 'Create a coherent broadcast.', changes, preserve: [], unresolved: [] });
const change = (target, aspect, request, check = 'none') => ({ target, aspect, request, check });
const spec = () => ({ design: { colors: { background: '#15171c', text: '#ffffff', muted: '#aab9cc', line: '#333840', teamLeft: '#00cbe6', teamRight: '#ff9900' },
  typography: { bodyFont: 'Arial', headingFont: 'Impact', nameFont: 'Impact', uppercaseNames: true }, panels: { fill: 'gradient', corners: 'square', borderWidth: .5, accentWidth: 1, teamSections: true, rows: 'alternating', headerAccent: 'underline' },
  layout: { scoreboardWidth: 1100, scoreboardHeight: 100, rosterWidth: 600, rosterHeight: 260, showEventPanel: false }, title: 'LIVE' }, operations: [] });
const report = () => ({ viewport: [1280, 720], fonts: [], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });
const review = (approved, score) => ({ approved, score, summary: 'Cyan and orange sections have a clear score hierarchy.', issues: approved ? [] : [{ target: 'players', problem: 'Header competes with names.', action: 'Reduce header accent weight.' }] });

test('reported creation with check:none resolves supported requirements rather than silently skipping them', () => {
  const requests = [change('team-sections', 'fill', 'subtle gradient'), change('players', 'position', 'champion portraits should be slightly bigger than item icons'), change('players', 'size', 'compact player tables along the bottom, joined in the middle'), change('players', 'separators', 'subtle alternating rows and fine separators')];
  const source = requests.map(item => item.request).join('. ');
  const understood = parseHubIntent(JSON.stringify(intent(requests)), source, 'create');
  assert.deepEqual(understood.changes.map(item => [item.aspect, item.check]), [['gradient', 'team-gradient'], ['portraits', 'portraits-larger-than-items'], ['position', 'joined-bottom'], ['separators', 'fine-separators']]);
  const plan = resolveIntentPlan({ template: 'ai-composed', ...spec() }, understood, hub());
  assert(plan.operations.some(op => op.op === 'team-fill'));
  assert(plan.operations.some(op => op.portraitRatio === 1.2));
});

test('part styles coordinate surfaces, type and per-team tables while preserving native data and editability', () => {
  const original = hub(), snapshot = structuredClone(original);
  const compiled = compileHubPlan(original, { template: 'current', operations: [
    { op: 'style', target: 'scoreboards', rules: [rule('blue-team', 'background', 'linear-gradient(105deg, #126e82, #08232e)'), rule('center', 'box-shadow', 'inset 0 2px 0 #00cbe6'), rule('blue-code', 'letter-spacing', '1px')] },
    { op: 'style', target: 'red-players', rules: [rule('name', 'font-family', 'Arial Narrow'), rule('row', 'padding', '2px 6px')] },
  ] }).hub;
  assert.deepEqual(original, snapshot);
  const scoreboard = compiled.layers.find(layer => layer.type === 'LolScorebug');
  assert.equal(scoreboard.redTeamCode, original.layers.find(layer => layer.type === 'LolScorebug').redTeamCode);
  assert(scoreboard.style.customCss.includes('linear-gradient(105deg, #126e82, #08232e)'));
  assert.equal(savedPartStyles(compiled.layers.find(layer => layer.team === 'red' && layer.type === 'LolPlayerRoster')).length, 2);
  assert.equal(savedPartStyles(compiled.layers.find(layer => layer.team === 'blue' && layer.type === 'LolPlayerRoster')).length, 0);
});

test('native-unit styling recompiles after resize without changing the declared font size', () => {
  const initial = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'players', rules: [rule('name', 'font-size', '20px')] }] }).hub;
  const resized = compileHubPlan(initial, { template: 'current', operations: [{ op: 'resize', target: 'players', width: 600, height: 280 }] }).hub;
  for (const layer of resized.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert.equal(savedPartStyles(layer)[0].declarations[0].value, '20px');
    assert(layer.style.customCss.includes('font-size: 3.333cqw'));
    assert.equal(layer.style.customCss.match(/\/\* ai-part-style \*\//g).length, 1);
  }
});

test('group styling reaches compatible parts without inventing a text part on images or widgets', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'all', rules: [rule('text', 'color', '#eeeeee'), rule('blue-code', 'letter-spacing', '1px')] }] }).hub;
  assert(result.layers.filter(layer => layer.type === 'Text').every(layer => savedPartStyles(layer).some(rule => rule.part === 'text')));
  assert(result.layers.filter(layer => layer.type === 'Image').every(layer => !savedPartStyles(layer).length));
});

test('later native requirements override conflicting CSS while retaining unrelated authored details', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [
    { op: 'style', target: 'players', rules: [rule('portrait', 'width', '64px'), rule('portrait', 'border-radius', '3px'), rule('item', 'width', '32px'), rule('row', 'border-bottom', '4px solid #333333')] },
    { op: 'roster-design', target: 'players', portraitRatio: 1.2, separatorWidth: .5 },
  ] }).hub;
  for (const layer of result.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    const declarations = savedPartStyles(layer).flatMap(rule => rule.declarations);
    assert(declarations.some(item => item.property === 'border-radius'));
    assert(!declarations.some(item => item.property === 'width' || item.property === 'border-bottom'));
  }
});

test('unknown parts, script/resource injection and CSS escaping fail before a proposal exists', () => {
  for (const value of ['url(https://example.test/track)', 'red; display:none', 'red} body{color:red', 'var(--outside-secret)', 'expression(alert(1))', '\\75rl(test)', '@import "x"', 'red!important']) assert.throws(() => validateStyleValue('blue-team', 'background', value));
  assert.throws(() => validateStyleValue('root', 'position', 'fixed'));
  assert.throws(() => validateStyleValue('name', 'display', 'none'));
  assert.throws(() => validateStyleValue('name', 'opacity', '0'));
  assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'players', rules: [rule('blue-team', 'color', '#ffffff')] }] }), /Unknown part/);
  assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [rule('made-up-widget', 'color', '#ffffff')] }] }));
});

test('native decorations can be added and styled without inventing a live data component', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [
    { op: 'decoration', key: 'accent', kind: 'shape', x: 300, y: 100, width: 80, height: 8 },
    { op: 'style', target: 'ai-decoration-accent', rules: [rule('root', 'background', 'linear-gradient(90deg, #00cbe6, #15171c)')] },
  ] }).hub;
  const accent = result.layers.find(layer => layer.id === 'ai-decoration-accent'); assert.equal(accent.type, 'Shape');
  assert.equal(savedPartStyles(accent)[0].part, 'root');
  assert.throws(() => compileHubPlan(result, { template: 'current', operations: [{ op: 'decoration', key: 'accent', kind: 'shape', x: 300, y: 100, width: 80, height: 8 }] }), /already exists/);
});

test('visual instructions cannot rename a team even when a generator emits a valid-looking operation', () => {
  const understood = intent([change('team-sections', 'fill', 'cyan and orange')]);
  const malicious = spec(); malicious.operations = [{ op: 'scoreboard', target: 'scoreboards', redTeamCode: 'cyan' }];
  assert.throws(() => parseHubCreateSpec(JSON.stringify(malicious), compositionSchemaForInstruction('make portraits bigger, cyan and orange', understood)));
  assert.throws(() => resolveIntentPlan({ template: 'ai-composed', ...malicious }, understood, hub()), /cannot rename/);
});

test('semantic editing scopes CSS properties and protects explicitly preserved font families', () => {
  const understood = intent([change('team-sections', 'gradient', 'blend darker', 'team-gradient')]);
  const schema = editSchemaForInstruction('keep font, blend darker', hub(), understood);
  const style = schema.properties.operations.items.oneOf.find(op => op.properties.op.const === 'style');
  const properties = style.properties.rules.items.properties.declarations.items.properties.property.enum;
  assert(properties.includes('background')); assert(!properties.includes('font-family')); assert(!properties.includes('position'));
  assert.deepEqual(style.properties.target.enum.filter(target => !target.includes('-')), ['scoreboards']);
});

test('gradient checks reject the reported barely visible stops and accept a visible transition', () => {
  const reported = 'linear-gradient(105deg, rgb(14, 125, 140), color(srgb 0.0705882 0.397059 0.441176))';
  assert(gradientColorDelta(reported) < .1);
  const visible = 'linear-gradient(105deg, rgb(14, 125, 140), rgb(8, 35, 46))';
  assert(gradientColorDelta(visible) > .1);
  const understood = intent([change('team-sections', 'gradient', 'subtle gradient', 'team-gradient')]);
  const measured = report(); measured.teamFills = [1, 2].map(() => ({ gradient: true, css: reported, delta: gradientColorDelta(reported) }));
  assert.equal(checkHubIntent(understood, hub(), hub(), measured)[0].status, 'failed');
});

test('render validation rejects hidden bindings, out-of-frame content, missing images and unreadable contrast', () => {
  const measured = report(); measured.missingImages = 1; measured.integrity = { hidden: ['team-code'], outside: ['roster-name'], lowContrast: [{ role: 'clock', ratio: 1.1 }] };
  assert.equal(renderedLayoutIssues(measured).length, 4);
});

function scripted(outputs) {
  const service = new LocalAiService(); service.state.set('ready'); service.metrics.set({ model: qwen });
  const calls = [];
  service.request = async (kind, payload, timeout) => {
    calls.push({ kind, ...payload, timeout });
    const result = outputs.shift(); assert.notEqual(result, undefined, `Unexpected ${kind} call`);
    if (typeof result === 'function') return result(service);
    if (result instanceof Error) throw result;
    return kind === 'switch' ? { model: payload.model, initializationMs: 10 } : { raw: JSON.stringify(result) };
  };
  return { service, calls };
}
const inspect = async (_hub, image) => ({ measurements: report(), ...(image ? { image: 'data:image/png;base64,LOCAL_IMAGE' } : {}) });

test('optional Phi review receives the Qwen preview and restores Qwen with sequential switches', async () => {
  const { service, calls } = scripted([spec(), {}, review(true, 4), {}]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.deepEqual(calls.map(call => [call.kind, call.model]), [['generate', undefined], ['switch', phi], ['review', undefined], ['switch', qwen]]);
  assert.equal(calls[2].messages.at(-1).content[1].image_url.url, 'data:image/png;base64,LOCAL_IMAGE');
  assert.equal(result.metrics.assessment.visual, 'reviewed-advisory');
  assert(!JSON.stringify(result.metrics).includes('LOCAL_IMAGE'));
  assert.equal(service.state(), 'ready');
});

test('a worse Phi-guided refinement retains the better previously reviewed valid design', async () => {
  const refined = spec(); refined.design.layout.rosterHeight = 280;
  const { service, calls } = scripted([spec(), {}, review(false, 3.5), {}, refined, {}, review(false, 2), {}]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert.equal(result.metrics.composition.layout.rosterHeight, 260);
  assert.equal(result.metrics.qualityRefinements, 1); assert.equal(calls.filter(call => call.kind === 'generate').length, 2);
  assert.match(calls.findLast(call => call.kind === 'generate').messages.at(-1).content, /Header competes/);
});

test('Phi loading failure preserves the valid Qwen candidate and does not claim visual approval', async () => {
  const { service } = scripted([spec(), new Error('Phi failed to load')]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.equal(result.metrics.assessment.visual, 'not-assessed'); assert.equal(service.state(), 'idle');
  assert(result.warnings.some(item => item.code === 'review-unavailable'));
});

test('model switching consumes the shared deadline and never starts an over-budget critique', async () => {
  const { service, calls } = scripted([spec(), () => { elapsed = 300001; return { initializationMs: 300001 }; }]);
  let elapsed = 0; service.now = () => elapsed;
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.equal(result.metrics.refinementStopReason, 'time-limit'); assert.equal(calls.length, 2);
  assert.equal(result.metrics.assessment.visual, 'not-assessed');
});

test('cancellation during the Phi handoff cannot publish a late valid proposal', async () => {
  const { service, calls } = scripted([spec(), service => { service.cancel(); return {}; }]);
  assert.equal(await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true }), null);
  assert.equal(calls.length, 2);
});

test('disabling review prevents the extra model download and clearly leaves visual quality unassessed', async () => {
  const { service, calls } = scripted([spec()]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true, review: false });
  assert.equal(calls.length, 1); assert.equal(result.metrics.assessment.visual, 'not-assessed');
});
