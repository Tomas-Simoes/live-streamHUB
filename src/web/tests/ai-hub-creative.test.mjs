// Legacy native-plan compatibility checks retained; intent permissions and automatic
// artistic treatments are superseded by ai-hub-css/intent/edit-contract tests.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { parseHubIntent, resolveIntentPlan, checkHubIntent } = await import('../src/app/features/editor/ai/hub-intent.ts');
const { compositionSchemaForInstruction, parseHubCreateSpec } = await import('../src/app/features/editor/ai/hub-create-spec.ts');
const { editSchemaForInstruction, parseHubEditSpec } = await import('../src/app/features/editor/ai/hub-edit-spec.ts');
const { validateStyleValue, savedPartStyles } = await import('../src/app/features/editor/ai/hub-part-style.ts');
const { gradientColorDelta, renderedLayoutIssues, matchesRenderedHue } = await import('../src/app/features/editor/ai/hub-quality.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { HUB_REPAIR_LIMITS } = await import('../src/app/features/editor/ai/hub-repair.ts');
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
const review = (approved, score) => ({ approved, score, comparison: 'initial', resolved: [], regressions: [], summary: 'Cyan and orange sections have a clear score hierarchy.', issues: approved ? [] : [{ target: 'players', problem: 'Header competes with names.', evidence: 'The header is brighter than player names in the lower strip.', criterion: 'Keep data prominent.', action: 'Reduce header accent weight.' }] });

test('the recorded real Qwen composition compiles with its CSS aliases and native relationship requirements', async () => {
  const recorded = JSON.parse(await readFile(new URL('./fixtures/ai-creative-recorded.json', import.meta.url), 'utf8'));
  const understood = parseHubIntent(recorded.interpretation, recorded.instruction, 'create');
  const plan = resolveIntentPlan(parseHubCreateSpec(recorded.proposal, compositionSchemaForInstruction(recorded.instruction, understood)), understood, hub());
  const result = compileHubPlan(hub(), plan).hub;
  assert.equal(result.layers.find(layer => layer.type === 'LolScorebug').redTeamCode, 'MKOI');
  assert(result.layers.filter(layer => layer.type === 'LolPlayerRoster').every(layer => !layer.style.customCss.includes('var(--line)')));
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

test('local colour variables permit coordinated team styling while rejecting resource-like values', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [rule('root', '--hub-blue', '#45b9ff'), rule('root', '--hub-team-left', '#114866')] }] }).hub;
  assert(result.layers.find(layer => layer.type === 'LolScorebug').style.customCss.includes('--hub-team-left: #114866'));
  assert.throws(() => validateStyleValue('root', '--hub-blue', 'url(https://example.test)'));
  assert.throws(() => validateStyleValue('root', '--made-up-resource', '#ffffff'));
});

test('compact CSS compiles to checked declarations and scales native lengths', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [{ part: 'center', css: 'border-top: 2px solid var(--hub-blue); background: #101820;' }] }] }).hub;
  const layer = result.layers.find(layer => layer.type === 'LolScorebug');
  assert.equal(savedPartStyles(layer)[0].declarations.length, 2);
  assert(!layer.style.customCss.includes('border-top: 2px'));
  for (const css of ['color: red; content: "hidden"', 'color: red; } body {color: red', 'background: url(https://example.test)', 'display: none']) {
    assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [{ part: 'center', css }] }] }));
  }
});

test('known local colour aliases and role-sized type normalize without accepting invented variables', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'players', rules: [{ part: 'cs', css: 'color: var(--muted); font-size: 12px;' }] }] }).hub;
  const saved = savedPartStyles(result.layers.find(layer => layer.type === 'LolPlayerRoster'))[0].declarations;
  assert.deepEqual(saved, [{ property: 'color', value: 'var(--hub-muted)' }, { property: 'font-size', value: '20px' }]);
  assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'players', rules: [{ part: 'cs', css: 'color: var(--invented-colour);' }] }] }));
});

test('a named cyan accent alias resolves locally while arbitrary colour roles remain invalid', () => {
  const result = compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [{ part: 'center', css: 'border-radius: 8px; border-top: 1px solid var(--hub-cyan);' }] }] }).hub;
  const css = result.layers.find(layer => layer.type === 'LolScorebug').style.customCss;
  assert(css.includes('solid #00cbe6')); assert(!css.includes('var(--hub-cyan)'));
  assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [{ op: 'style', target: 'scoreboards', rules: [{ part: 'center', css: 'color: var(--hub-invented-secret);' }] }] }));
});

test('supported branding removal does not become an unsupported request', () => {
  const request = 'Skip the large tournament branding panel';
  const source = { ...intent([change('all', 'fill', 'dark charcoal background')]), unresolved: [request] };
  const understood = parseHubIntent(JSON.stringify(source), `dark charcoal background. ${request}`, 'create');
  assert.deepEqual(understood.unresolved, []);
  assert(understood.changes.some(change => change.target === 'branding' && change.aspect === 'visibility'));
});

test('a request to remove gradients is not normalized into a request to add them', () => {
  const source = intent([change('team-sections', 'gradient', 'remove the gradient')]);
  assert.equal(parseHubIntent(JSON.stringify(source), 'remove the gradient').changes[0].check, 'none');
});

test('requested accent colours are checked on signals when filled team blocks were not requested', () => {
  const understood = intent([change('team-sections', 'fill', 'cyan and orange accents')]);
  understood.style = { leftAccent: 'cyan', rightAccent: 'orange', heading: null, corners: null, teamSections: false };
  const measured = report(); measured.teamFills = [1, 2].map(() => ({ css: 'rgb(20, 20, 20)', gradient: false }));
  measured.teamAccents = [{ css: 'rgb(0, 203, 230)' }, { css: 'rgb(255, 153, 0)' }];
  const checks = checkHubIntent(understood, hub(), hub(), measured);
  assert(checks.filter(check => /team colour/.test(check.request)).every(check => check.status === 'verified'));
  assert(!matchesRenderedHue('rgb(255, 255, 255)', '#101010'));
});

test('an edit cannot silently replace preserved team hues or font families through custom CSS', () => {
  const understood = intent([change('all', 'other', 'give this a stronger identity')]); understood.preserve = ['keep colours and fonts'];
  const baseline = report(); baseline.fonts = [{ role: 'names', face: 'Impact', minPx: 12 }]; baseline.teamAccents = [{ css: 'rgb(0, 203, 230)' }, { css: 'rgb(255, 153, 0)' }];
  const current = structuredClone(baseline); current.fonts[0].face = 'Georgia'; current.teamAccents[0].css = 'rgb(220, 40, 160)';
  const checks = checkHubIntent(understood, hub(), hub(), current, baseline);
  assert.equal(checks.filter(check => check.status === 'failed').length, 2);
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
    return kind === 'switch' ? { model: payload.model, initializationMs: 10 } : { raw: JSON.stringify(['generate', 'repair'].includes(kind) && result.design ? cssFixture(result) : result) };
  };
  return { service, calls };
}
const inspect = async (_hub, image) => ({ measurements: report(), ...(image ? { image: 'data:image/png;base64,LOCAL_IMAGE' } : {}) });

test('optional Phi review receives the Qwen preview and restores Qwen with sequential switches', async () => {
  const { service, calls } = scripted([spec(), {}, review(true, 4), {}]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.deepEqual(calls.map(call => [call.kind, call.model]), [['generate', undefined], ['switch', phi], ['review', undefined], ['switch', qwen]]);
  assert.equal(calls[2].messages.at(-1).content.find(part => part.type === 'image_url').image_url.url, 'data:image/png;base64,LOCAL_IMAGE');
  assert.equal(result.metrics.assessment.visual, 'reviewed-advisory');
  assert(!JSON.stringify(result.metrics).includes('LOCAL_IMAGE'));
  assert.equal(service.state(), 'ready');
});

test('a worse Phi-guided refinement retains the better previously reviewed valid design', async () => {
  const refined = spec(); refined.design.layout.rosterHeight = 280;
  const { service, calls } = scripted([spec(), {}, review(false, 3.5), {}, refined, {}, review(false, 2), {}]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert.equal(result.hub.layers.find(layer => layer.team === 'blue').height, 260);
  assert.equal(result.metrics.qualityRefinements, 1); assert.equal(calls.filter(call => call.kind === 'generate').length, 1);
  assert.match(calls.findLast(call => call.kind === 'repair').messages.at(-1).content, /Header competes/);
});

test('Phi loading failure preserves the valid Qwen candidate and does not claim visual approval', async () => {
  const { service } = scripted([spec(), new Error('Phi failed to load')]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.equal(result.metrics.assessment.visual, 'not-assessed'); assert.equal(service.state(), 'idle');
  assert(result.warnings.some(item => item.code === 'review-unavailable'));
});

test('ungrounded visual feedback retains the valid hub without extra review or design calls', async () => {
  const ungrounded = { approved: false, score: 0, issues: [], summary: 'Team accents not visible in image.' };
  const { service, calls } = scripted([spec(), {}, ungrounded, review(true, 4), {}]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert.equal(result.metrics.assessment.visual, 'not-assessed');
  assert.equal(calls.filter(call => call.kind === 'review').length, 1);
  assert.equal(result.metrics.qualityRefinements, 0);
});

test('repeated ungrounded critique is marked unavailable and retains a valid proposal without a fabricated score', async () => {
  const ungrounded = { approved: false, score: 0, issues: [], summary: 'Team accents not visible in image.' };
  const { service, calls } = scripted([spec(), {}, ungrounded, ungrounded]);
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.equal(result.metrics.assessment.visual, 'not-assessed'); assert.equal(result.metrics.designReview, undefined);
  assert.equal(calls.filter(call => call.kind === 'generate').length, 1);
  assert(result.warnings.some(warning => warning.code === 'review-unavailable'));
});

test('focused visual retry cannot start after the shared deadline', async () => {
  let elapsed = 0;
  const { service, calls } = scripted([spec(), {}, () => { elapsed = HUB_REPAIR_LIMITS.maxDurationMs + 1; return { raw: JSON.stringify({ approved: false, score: 0, issues: [], summary: 'Image not visible.' }) }; }]);
  service.now = () => elapsed;
  const result = await service.generate(hub(), 'Create my hub', 'create', { interpret: false, inspect, visionReview: true });
  assert(result); assert.equal(calls.length, 3); assert.equal(result.metrics.assessment.visual, 'not-assessed');
  assert.equal(result.metrics.refinementStopReason, 'time-limit');
});

test('model switching consumes the shared deadline and never starts an over-budget critique', async () => {
  const { service, calls } = scripted([spec(), () => { elapsed = HUB_REPAIR_LIMITS.maxDurationMs + 1; return { initializationMs: elapsed }; }]);
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

function cssFixture(value) {
 const height=value.design.layout.rosterHeight;
 return {summary:'Mocked visual-review fixture', styles:[{target:'all',mode:'patch',css:'&{background:#15171c;color:white}'}],operations:[
 {op:'frame',target:'blue-players',x:660,y:1080-height/2,width:600,height},
 {op:'frame',target:'red-players',x:1260,y:1080-height/2,width:600,height}]};
}
