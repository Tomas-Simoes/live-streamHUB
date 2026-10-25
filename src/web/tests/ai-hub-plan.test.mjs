// Legacy native-plan compatibility checks retained; intent permissions and automatic
// artistic treatments are superseded by ai-hub-css/intent/edit-contract tests.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import '@angular/compiler';
import { of } from 'rxjs';
register('./typescript-loader.mjs', import.meta.url);
const { compileHubPlan, parseHubPlan, validateHubLayers, previewHub } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const { HubStore } = await import('../src/app/core/store/hub.store.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { currentAppearance } = await import('../src/app/features/editor/ai/hub-appearance.ts');
const { parseHubEditSpec, editSchemaForInstruction, HUB_EDIT_SCHEMA } = await import('../src/app/features/editor/ai/hub-edit-spec.ts');
const { parseHubCreateSpec, compositionRepairSchema, compositionSchemaForInstruction } = await import('../src/app/features/editor/ai/hub-create-spec.ts');
const { AI_PALETTES, HUB_DESIGN_REFERENCES, hubDesignKnowledge } = await import('../src/app/features/editor/ai/hub-design-references.ts');
const { auditDesignEdits, contrastRatio, designQualityWarnings } = await import('../src/app/features/editor/ai/hub-design-guard.ts');
const { compositionColors } = await import('../src/app/features/editor/ai/hub-composition.ts');
function hub(index = 0) {
  const layout = PREDEFINED_HUB_TEMPLATES[index].createLayout();
  return { _id: 'test', hubName: 'Test', layout, layers: layout.layers };
}
function composition() {
  return { colors: { background: '#081b38', text: '#f4f6ff', muted: '#b8cbe4', line: '#526f96', teamLeft: '#45b9ff', teamRight: '#ff755b' }, typography: { bodyFont: 'Arial', headingFont: 'Impact', nameFont: 'Impact', uppercaseNames: true },
    panels: { fill: 'gradient', corners: 'square', borderWidth: 1, accentWidth: 2, teamSections: false, rows: 'alternating', headerAccent: 'split' },
    layout: { scoreboardWidth: 1200, scoreboardHeight: 100, rosterWidth: 600, rosterHeight: 260, showEventPanel: true }, title: 'LIVE / MATCH' };
}
test('all real templates pass AI layout validation', () => {
  for (let i = 0; i < PREDEFINED_HUB_TEMPLATES.length; i++) assert.deepEqual(validateHubLayers(hub(i).layers), []);
});
test('schema rejects unknown operations, CSS, nonfinite dimensions, and invalid colors', () => {
  for (const operations of [[{ op: 'execute', code: 'alert(1)' }], [{ op: 'theme', surface: 'url(x)', text: '#ffffff', blue: '#000000', red: '#ff0000' }],
    [{ op: 'move', target: 'all', dx: null, dy: 0 }], [{ op: 'visibility', target: 'all', visible: true, customCss: 'x' }]])
    assert.throws(() => parseHubPlan(JSON.stringify({ template: 'current', operations })));
});
test('Qwen3 empty thinking prefix is normalized without accepting extra prose', () => {
  const plan = { template: 'current', operations: [{ op: 'theme', palette: 'navy' }] };
  assert.deepEqual(parseHubPlan('<think>\n\n</think>\n\n' + JSON.stringify(plan)), plan);
  assert.throws(() => parseHubPlan('Here is a plan: ' + JSON.stringify(plan)));
});
test('follow-up changes keep IDs, media, unrelated text, overrides and theme', () => {
  const original = hub();
  const roster = original.layers.find(l => l.type === 'LolPlayerRoster');
  roster.playerOverrides = { top: { name: 'Custom player', items: [1001, null, null, null, null, null] } };
  const result = compileHubPlan(original, { template: 'current', operations: [
    { op: 'players', target: 'players', portraitSize: 56, gap: 8 }, { op: 'move', target: 'scoreboards', dx: 0, dy: -12 },
  ] });
  assert.deepEqual(result.hub.layers.map(l => l.id), original.layers.map(l => l.id));
  assert.deepEqual(result.hub.layers.find(l => l.id === roster.id).playerOverrides, roster.playerOverrides);
  assert.deepEqual(result.hub.layers.find(l => l.type === 'Image'), original.layers.find(l => l.type === 'Image'));
  assert.deepEqual(validateHubLayers(result.hub.layers), []);
  assert.equal(original.layers.find(l => l.id === roster.id).height, 260, 'original is not mutated');
});
test('collision, component minimums and unknown targets reject before applying', () => {
  for (const operations of [[{ op: 'move', target: 'players', dx: 0, dy: -890 }],
    [{ op: 'resize', target: 'scoreboards', width: 100, height: 24 }], [{ op: 'move', target: 'missing', dx: 0, dy: 1 }],
    [{ op: 'players', target: 'scoreboards', portraitSize: 56 }]]) {
    assert.throws(() => compileHubPlan(hub(), { template: 'current', operations }));
  }
});
test('compact scoreboards keep the existing editable logo images attached', () => {
  const original = hub();
  const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'resize', target: 'scoreboards', width: 1000, height: 86 }] }).hub;
  const scoreboard = result.layers.find(l => l.type === 'LolScorebug');
  const logo = result.layers.find(l => l.id.includes('-blue-team-logo-'));
  assert(logo.position.x > scoreboard.position.x - scoreboard.width / 2);
  assert.equal(logo.src, original.layers.find(l => l.id === logo.id).src);
  assert.deepEqual(validateHubLayers(result.layers), []);
});
test('preview IDs isolate CSS and atomic apply supports undo, redo, stale detection and save', () => {
  let saved;
  const original = hub();
  const store = new HubStore({ getMyHubs: () => of([structuredClone(original)]), updateHub: (id, changes) => { saved = changes; return of({ _id: id, ...changes }); } });
  store.loadMyHubs();
  const before = structuredClone(store.selectedHub());
  const fingerprint = JSON.stringify([before._id, before.layout, before.layers]);
  const compiled = compileHubPlan(before, { template: 'voltage-broadcast', operations: [{ op: 'resize', target: 'scoreboards', width: 1000, height: 86 }] }).hub;
  assert(previewHub(compiled).layers.every(l => l.id.startsWith('ai-preview-')));
  assert(!compiled.layers.some(l => l.id.startsWith('ai-preview-')));
  assert.equal(store.applyAiLayout('other-hub', compiled.layout, fingerprint), false);
  assert.equal(store.applyAiLayout('test', compiled.layout, fingerprint), true);
  assert.equal(store.applyAiLayout('test', compiled.layout, fingerprint), false);
  assert.equal(store.hasUnsavedChanges(), true);
  store.undoSelectedHub();
  assert.deepEqual(store.selectedHub().layers.map(l => [l.id, l.position, l.width, l.height]), before.layers.map(l => [l.id, l.position, l.width, l.height]));
  assert.equal(store.hasUnsavedChanges(), false);
  store.redoSelectedHub(); assert.deepEqual(store.selectedHub().layers, compiled.layers);
  store.saveSelectedHub(); assert.deepEqual(saved.layout.layers, compiled.layers);
  assert.equal(store.hasUnsavedChanges(), false);
});

test('cancelling while probing WebGPU prevents a late initialization', async () => {
  const service = new LocalAiService();
  let finishProbe;
  service.compatibility = () => new Promise(resolve => { finishProbe = resolve; });
  const initializing = service.initialize('test-model');
  assert.equal(service.state(), 'loading');
  service.cancel(); finishProbe(''); await initializing;
  assert.equal(service.state(), 'idle');
  assert.equal(service.worker, undefined);
});

test('appearance edits add real gradients, thin dark borders, padding and objective information to an existing navy hub', () => {
  const base = compileHubPlan(hub(), { template: 'atelier-broadcast', operations: [{ op: 'theme', palette: 'navy' }] }).hub;
  const result = compileHubPlan(base, { template: 'current', operations: [
    { op: 'appearance', target: 'all', backgroundColor: 'navy', gradientTo: 'midnight', borderColor: 'slate-blue', borderWidth: 0.5 },
    { op: 'appearance', target: 'scoreboards', paddingX: 16 },
    { op: 'scoreboard', target: 'scoreboards', showObjectives: true },
  ] }).hub;
  const scoreboard = result.layers.find(l => l.type === 'LolScorebug');
  assert.match(scoreboard.style.backgroundColor, /^linear-gradient/);
  assert.match(scoreboard.style.backgroundColor, /#081b38.*#030b1a/);
  assert.equal(scoreboard.style.borderColor, '#1b3858');
  assert.equal(scoreboard.style.borderWidth, 0.5);
  assert.equal(currentAppearance(scoreboard).paddingX, 16);
  assert.equal(scoreboard.showObjectives, true);
  assert.deepEqual(result.layers.map(l => l.id), base.layers.map(l => l.id));
  assert.deepEqual(result.layers.filter(l => l.type === 'LolPlayerRoster').map(l => l.playerOverrides), base.layers.filter(l => l.type === 'LolPlayerRoster').map(l => l.playerOverrides));
  assert.deepEqual(validateHubLayers(result.layers), []);
});

test('a subsequent padding-only edit preserves the saved gradient, border and unrelated layers', () => {
  const base = compileHubPlan(hub(), { template: 'current', operations: [
    { op: 'appearance', target: 'scoreboards', backgroundColor: '#102d50', gradientTo: '#030b1a', borderColor: '#1b3858', borderWidth: 0.5, paddingX: 12 },
  ] }).hub;
  const result = compileHubPlan(JSON.parse(JSON.stringify(base)), { template: 'current', operations: [
    { op: 'appearance', target: 'scoreboards', paddingX: 24 },
  ] }).hub;
  const scoreboard = result.layers.find(l => l.type === 'LolScorebug');
  assert.equal(currentAppearance(scoreboard).paddingX, 24);
  assert.equal(scoreboard.style.backgroundColor, base.layers.find(l => l.id === scoreboard.id).style.backgroundColor);
  assert.equal(scoreboard.style.borderWidth, 0.5);
  assert.deepEqual(result.layers.filter(l => l.type === 'LolPlayerRoster'), base.layers.filter(l => l.type === 'LolPlayerRoster'));
  assert.throws(() => compileHubPlan(result, { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', paddingX: 24 }] }), /changes nothing/);
});

test('appearance cannot introduce arbitrary CSS, URLs or invalid dimensions', () => {
  for (const change of [{ backgroundColor: 'url(https://example.test)' }, { gradientTo: '#fff;display:none' }, { borderWidth: -1 }, { paddingX: 200 }, {}]) {
    assert.throws(() => parseHubPlan(JSON.stringify({ template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', ...change }] })));
  }
});

test('existing per-part fill/border overrides follow appearance changes without losing typography', () => {
  const base = hub();
  const scoreboard = base.layers.find(l => l.type === 'LolScorebug');
  scoreboard.partStyles = { 'blue-team': { backgroundColor: '#ff0000', borderColor: '#00ffff', borderWidth: 4, fontSize: 22 } };
  const result = compileHubPlan(base, { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', backgroundColor: 'navy', gradientTo: 'midnight', borderColor: 'slate-blue', borderWidth: 0.5 }] }).hub;
  const part = result.layers.find(l => l.id === scoreboard.id).partStyles['blue-team'];
  assert.equal(part.backgroundColor, 'transparent'); assert.equal(part.borderColor, '#1b3858');
  assert.equal(part.borderWidth, 0.5); assert.equal(part.fontSize, 22);
});

test('already-enabled scoreboard options and repeated palettes reject no-op edits', () => {
  const base = compileHubPlan(hub(), { template: 'atelier-broadcast', operations: [{ op: 'theme', palette: 'navy' }] }).hub;
  assert.throws(() => compileHubPlan(base, { template: 'current', operations: [{ op: 'scoreboard', target: 'scoreboards', showObjectives: true }] }), /changes nothing/);
  assert.throws(() => compileHubPlan(base, { template: 'current', operations: [{ op: 'theme', palette: 'navy' }] }), /changes nothing/);
});

function editSpec(changes = {}) {
  return { template: 'current', palette: null,
    appearance: { target: 'all', backgroundColor: null, gradientTo: null, gradientDirection: null, borderColor: null, borderWidth: null },
    scoreboard: { paddingX: null, showObjectives: null, showGold: null, showGameTime: null },
    players: { portraitSize: null, gap: null, showChampion: null, showKda: null, showCs: null, showGold: null, showItems: null },
    operations: [], ...changes };
}
test('fixed edit slots compile every visual/stat change while null fields preserve unrelated settings', () => {
  const spec = editSpec();
  spec.appearance = { ...spec.appearance, backgroundColor: 'navy', gradientTo: 'midnight', borderColor: 'slate-blue', borderWidth: 0.5 };
  spec.scoreboard.paddingX = 16; spec.scoreboard.showObjectives = true;
  const plan = parseHubEditSpec(JSON.stringify(spec));
  assert.deepEqual(plan.operations.map(o => o.op), ['appearance', 'appearance', 'scoreboard']);
  assert.equal(plan.operations[0].gradientTo, 'midnight');
  assert.equal(plan.operations[1].paddingX, 16);
  assert.equal(plan.operations[2].showObjectives, true);
  assert.equal(plan.operations[2].showGold, undefined);
  const base = hub(); base.layers.find(l => l.type === 'LolScorebug').showGold = false;
  const edited = compileHubPlan(base, plan).hub;
  assert.equal(edited.layers.find(l => l.type === 'LolScorebug').showGold, false);
  assert.deepEqual(edited.layers.map(l => [l.width, l.height]), base.layers.map(l => [l.width, l.height]));
});
test('edit slots require explicit consideration of each property and reject empty/invalid requests', () => {
  assert.throws(() => parseHubEditSpec(JSON.stringify(editSpec())), /All edit fields were null/);
  const missing = editSpec(); delete missing.appearance.borderColor;
  assert.throws(() => parseHubEditSpec(JSON.stringify(missing)), /borderColor/);
  const invalid = editSpec(); invalid.appearance.gradientTo = 'url(javascript:x)';
  assert.throws(() => parseHubEditSpec(JSON.stringify(invalid)));
  const solid = editSpec(); solid.appearance.gradientTo = 'none';
  assert.equal(parseHubEditSpec(JSON.stringify(solid)).operations[0].gradientTo, null);
});
test('new design specifications compose native components without choosing a template or a named palette', () => {
  const plan = parseHubCreateSpec(JSON.stringify({ design: composition(), operations: [] }));
  const created = compileHubPlan(hub(), plan).hub;
  assert.equal(plan.template, 'ai-composed');
  assert.equal(created.layers.find(l => l.type === 'LolScorebug').width, 1200);
  assert.equal(created.layout.templateId, 'ai-composed');
  assert.deepEqual(validateHubLayers(created.layers), []);
  assert.throws(() => parseHubCreateSpec('{"template":"atelier-broadcast","palette":"navy","operations":[]}'));
  const invalid = composition(); invalid.colors.background = 'url(x)';
  assert.throws(() => parseHubCreateSpec(JSON.stringify({ design: invalid, operations: [] })));
});

test('a reference without recoloring reproduces the complete editable native design', () => {
  for (const ref of HUB_DESIGN_REFERENCES) {
    const native = PREDEFINED_HUB_TEMPLATES.find(t => t.id === ref.id).createLayout();
    const result = compileHubPlan(hub(), { template: ref.id, operations: [] }).hub;
    const withoutIds = layers => layers.map(({ id, ...layer }) => layer);
    assert.deepEqual(withoutIds(result.layers), withoutIds(native.layers), ref.id);
    assert.equal(result.layout.templateId, ref.id);
  }
  assert.throws(() => compileHubPlan(hub(), { template: 'current', operations: [] }), /changes nothing/);
});

test('every approved reference supports all palettes without changing typography, composition or content', () => {
  for (const ref of HUB_DESIGN_REFERENCES.filter(ref => ref.approved)) {
    const original = PREDEFINED_HUB_TEMPLATES.find(t => t.id === ref.id).previewHub;
    for (const palette of Object.keys(AI_PALETTES)) {
      const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'theme', palette }] }).hub;
      assert.deepEqual(auditDesignEdits(original, result.layers, { template: 'current', operations: [{ op: 'theme', palette }] }), []);
      assert.deepEqual(result.layers.map(l => [l.id, l.position, l.width, l.height]), original.layers.map(l => [l.id, l.position, l.width, l.height]));
      assert.deepEqual(result.layers.filter(l => l.type === 'Image'), original.layers.filter(l => l.type === 'Image'));
      assert.deepEqual(validateHubLayers(result.layers), []);
      assert.deepEqual(designQualityWarnings(result.layers), []);
      assert.throws(() => compileHubPlan(result, { template: 'current', operations: [{ op: 'theme', palette }] }), /changes nothing/);
    }
  }
});

test('padding alone preserves native scorebug surfaces, borders and typography', () => {
  const original = PREDEFINED_HUB_TEMPLATES.find(t => t.id === 'pulse-broadcast').previewHub;
  const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', paddingX: 20 }] }).hub;
  const score = result.layers.find(l => l.type === 'LolScorebug');
  const old = original.layers.find(l => l.id === score.id);
  const addedCss = score.style.customCss.slice(old.style.customCss.length);
  assert(!/background:|border-color:|border-width:|font-size:/.test(addedCss));
  assert.deepEqual(result.layers.filter(l => l.type === 'LolPlayerRoster'), original.layers.filter(l => l.type === 'LolPlayerRoster'));
});

test('legacy generated hubs report the visible AI palette rather than the underlying template color', async () => {
  const layout = JSON.parse(await readFile(new URL('./fixtures/ai-plain-navy.generated.json', import.meta.url), 'utf8'));
  assert.equal(currentAppearance(layout.layers.find(l => l.type === 'LolScorebug')).backgroundColor, '#081b38');
  for (const roster of layout.layers.filter(l => l.type === 'LolPlayerRoster')) assert.equal(currentAppearance(roster).backgroundColor, '#081b38');
  const newer = compileHubPlan(hub(3), { template: 'current', operations: [{ op: 'theme', palette: 'purple' }] }).hub;
  assert.equal(currentAppearance(newer.layers.find(l => l.type === 'LolScorebug')).backgroundColor, AI_PALETTES.purple.surfaceDeep);
});

test('copied player flags cannot trigger an unrequested roster reflow', () => {
  const original = hub(3);
  assert.throws(() => compileHubPlan(original, { template: 'current', operations: [{ op: 'players', target: 'players', showItems: true, showChampion: true }] }), /changes nothing/);
  const result = compileHubPlan(original, { template: 'current', operations: [
    { op: 'appearance', target: 'scoreboards', paddingX: 18 }, { op: 'players', target: 'players', showItems: true, showChampion: true },
  ] }).hub;
  assert.deepEqual(result.layers.filter(l => l.type === 'LolPlayerRoster'), original.layers.filter(l => l.type === 'LolPlayerRoster'));
});

test('a palette switch retains explicit fine borders, padding and gradient structure', () => {
  const base = compileHubPlan(hub(3), { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', backgroundColor: 'navy', gradientTo: 'midnight', borderWidth: .5, paddingX: 22 }] }).hub;
  const result = compileHubPlan(base, { template: 'current', operations: [{ op: 'theme', palette: 'purple' }] }).hub;
  const appearance = currentAppearance(result.layers.find(l => l.type === 'LolScorebug'));
  assert.equal(appearance.backgroundColor, AI_PALETTES.purple.surfaceDeep);
  assert.equal(appearance.gradientTo, AI_PALETTES.purple.ink);
  assert.equal(appearance.paddingX, 22);
  assert.equal(appearance.borderWidth, .5);
});

test('internal context teaches principles without exposing a template selection contract', () => {
  const knowledge = hubDesignKnowledge();
  assert.equal(knowledge.length, 2);
  assert(knowledge.every(example => example.evidence.tables.length === 2 && example.why.every(reason => reason.choice && reason.effect) && !('id' in example)));
  assert.deepEqual(new Set(knowledge.map(example => example.source)), new Set(['Pulse', 'Offset']));
  assert(knowledge.every(example => example.edit.preserve.includes('readable names')));
  assert(!JSON.stringify(knowledge).includes('-broadcast'));
  assert(JSON.stringify(knowledge).length < 6500);
});

test('approved evidence follows real native hub dimensions and palette tokens', () => {
  for (const example of hubDesignKnowledge()) {
    const native = PREDEFINED_HUB_TEMPLATES.find(template => template.name.toLowerCase().includes(example.source.toLowerCase())).createLayout();
    const score = native.layers.find(layer => layer.type === 'LolScorebug');
    assert.deepEqual(example.evidence.score, [score.width, score.height]);
    assert.deepEqual(example.evidence.tables, native.layers.filter(layer => layer.type === 'LolPlayerRoster').map(layer => [layer.width, layer.height]));
    assert.equal(example.example.colors.teamLeft, score.blueAccent);
    assert.equal(example.example.colors.teamRight, score.redAccent);
  }
});

test('narrowing a joined native pair keeps its seam, bottom anchor and shared furniture aligned', () => {
  const original = hub(3);
  const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'resize', target: 'players', width: 550, height: 250 }] }).hub;
  const tables = result.layers.filter(layer => layer.type === 'LolPlayerRoster').sort((a,b) => a.position.x-b.position.x);
  assert.equal(tables[0].position.x + 275, tables[1].position.x - 275);
  for (const table of tables) assert.equal(table.position.y + table.height/2, 1080);
  const header = result.layers.find(layer => layer.id.includes('-event-name-'));
  assert.equal(header.width, 1100); assert.equal(header.position.x, 960);
  assert.deepEqual(validateHubLayers(result.layers), []);
});

test('custom table placements are not forced into the default composition', async () => {
  const { reflowRosterPair } = await import('../src/app/features/editor/ai/hub-layout.ts');
  const tables = structuredClone(hub().layers.filter(layer => layer.type === 'LolPlayerRoster'));
  tables[0].position.x -= 50; tables[1].position.x += 50;
  const before = new Map(tables.map(layer => [layer.id, structuredClone(layer)]));
  const x = tables.map(layer => layer.position.x);
  tables.forEach(layer => layer.width = 550);
  reflowRosterPair(tables, before, [{ op: 'resize', target: 'players', width: 550, height: 260 }], new Set(tables.map(layer => layer.id)));
  assert.deepEqual(tables.map(layer => layer.position.x), x);
});

test('compact typography protects role-specific readable sizes', () => {
  const result = compileHubPlan(hub(3), { template: 'current', operations: [{ op: 'typography', target: 'players', font: 'Arial', size: 12 }] }).hub;
  for (const table of result.layers.filter(layer => layer.type === 'LolPlayerRoster')) {
    assert.equal(table.partStyles.name.fontSize, 18); assert.equal(table.partStyles.cs.fontSize, 20);
    assert.equal(table.partStyles.kda.fontSize, 16);
  }
});

test('saved compositions from before the new design controls remain compatible', () => {
  const design = composition();
  delete design.typography.nameFont; delete design.panels.rows; delete design.panels.headerAccent; delete design.layout.rosterWidth;
  const result = compileHubPlan(hub(), parseHubPlan(JSON.stringify({ template: 'ai-composed', design, operations: [] })));
  assert.deepEqual(validateHubLayers(result.hub.layers), []);
  assert(result.hub.layers.filter(layer => layer.type === 'LolPlayerRoster').every(layer => layer.width === 600));
});

test('preservation guard detects unrelated content, geometry and font changes', () => {
  const original = hub(3);
  for (const change of [
    layers => { layers.find(l => l.type === 'Text').text = 'Changed'; },
    layers => { layers.find(l => l.type === 'LolPlayerRoster').width += 20; },
    layers => { layers.find(l => l.type === 'LolPlayerRoster').style.customCss += '\n& .roster-name { font-size: 10px; }'; },
  ]) {
    const layers = structuredClone(original.layers); change(layers);
    assert(auditDesignEdits(original, layers, { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', paddingX: 16 }] }).length > 0);
  }
});

test('design checks report measurable low contrast and gameplay obstruction', () => {
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('transparent', '#000000'), undefined);
  for (const p of Object.values(AI_PALETTES)) {
    assert(contrastRatio(p.text, p.surface) >= 4.5);
    assert(contrastRatio(p.muted, p.surfaceDeep) >= 4.5);
  }
  const layers = structuredClone(hub().layers);
  const score = layers.find(l => l.type === 'LolScorebug');
  score.position.y = 400; score.style.color = '#222222'; score.style.backgroundColor = '#222222';
  assert.deepEqual(new Set(designQualityWarnings(layers).map(i => i.code)), new Set(['contrast', 'game-area']));
});

test('a custom light serif/glass composition is independent of all saved hub identities', () => {
  const design = composition();
  design.colors = { background: '#fff6e8', text: '#231f29', muted: '#655c63', line: '#ad9480', teamLeft: '#2f6f58', teamRight: '#a4472d' };
  design.typography = { bodyFont: 'Segoe UI', headingFont: 'Georgia', nameFont: 'Segoe UI', uppercaseNames: false };
  design.panels = { fill: 'glass', corners: 'rounded', borderWidth: .5, accentWidth: 0, teamSections: false, rows: 'alternating', headerAccent: 'none' };
  design.layout = { scoreboardWidth: 1100, scoreboardHeight: 96, rosterWidth: 600, rosterHeight: 292, showEventPanel: false };
  const result = compileHubPlan(hub(), parseHubCreateSpec(JSON.stringify({ design, operations: [] }))).hub;
  assert.equal(result.layout.aiDesign.typography.headingFont, 'Georgia');
  assert.deepEqual(validateHubLayers(result.layers), []);
  const score = result.layers.find(l => l.type === 'LolScorebug');
  assert.equal(score.width, 1100); assert.equal(score.height, 96); assert.equal(score.style.borderRadius, 12);
  assert.equal(currentAppearance(score).backgroundColor, '#fff6e8');
  assert(result.layers.filter(l => l.type === 'LolPlayerRoster').every(l => l.height === 292));
  assert(result.layers.filter(l => l.id.includes('-left-')).every(l => !l.visible));
  assert(!result.layers.some(l => l.type === 'Text' && /CBLOL|PULSE|FOUNDRY|OFFSET/.test(l.text)));
  const recolored = compileHubPlan(result, { template: 'current', operations: [{ op: 'theme', palette: 'purple' }] }).hub;
  const next = recolored.layers.find(l => l.id === score.id);
  assert.equal(next.style.borderRadius, 12);
  assert(next.style.customCss.includes('backdrop-filter: blur(8px)'));
  assert.equal(currentAppearance(next).backgroundColor, AI_PALETTES.purple.surfaceDeep);
});

test('composition validates text contrast and rejects CSS or cross-mode design replacement', () => {
  for (const role of ['text']) {
    const design = composition(); design.colors[role] = design.colors.background;
    assert.throws(() => parseHubCreateSpec(JSON.stringify({ design, operations: [] })), /contrast/);
  }
  for (const background of ['#fff4dc', '#202020', '#8899aa']) {
    const design = composition(); design.colors.background = background;
    design.colors.muted = background; design.colors.teamLeft = background; design.colors.teamRight = background;
    const resolved = compositionColors(design.colors);
    for (const foreground of [resolved.muted, resolved.blue, resolved.red]) for (const surface of [resolved.ink, resolved.surface, resolved.surfaceDeep])
      assert(contrastRatio(foreground, surface) >= 3);
  }
  assert.throws(() => compileHubPlan(hub(), { template: 'current', design: composition(), operations: [] }), /edits cannot replace/);
  assert.throws(() => compileHubPlan(hub(), { template: 'ai-composed', operations: [] }), /requires design/);
});

test('contrast repair retains background, typography and layout instead of substituting a different design', () => {
  const design = composition(); design.colors.text = design.colors.background;
  const spec = { design, operations: [] };
  let issues;
  try { parseHubCreateSpec(JSON.stringify(spec)); } catch (error) { issues = error.issues; }
  const schema = compositionRepairSchema(JSON.stringify(spec), issues);
  const corrected = structuredClone(spec); corrected.design.colors.text = '#f4f6ff';
  assert.doesNotThrow(() => parseHubCreateSpec(JSON.stringify(corrected), schema));
  for (const mutate of [s => { s.design.colors.background = '#000000'; }, s => { s.design.typography.headingFont = 'Georgia'; },
    s => { s.design.layout.scoreboardWidth = 1100; }]) {
    const unrelated = structuredClone(corrected); mutate(unrelated);
    assert.throws(() => parseHubCreateSpec(JSON.stringify(unrelated), schema));
  }
});

test('enlarged native player rows keep their tournament panel and heading aligned', () => {
  const original = compileHubPlan(hub(), parseHubCreateSpec(JSON.stringify({ design: composition(), operations: [] }))).hub;
  const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'players', target: 'players', portraitSize: 64, gap: 12 }] }).hub;
  const info = result.layers.find(l => l.id.includes('-left-info-'));
  const plate = result.layers.find(l => l.id.includes('-roster-plate-'));
  assert.equal(info.height, plate.height);
  assert.equal(info.position.y - info.height / 2, plate.position.y - plate.height / 2);
  assert.deepEqual(validateHubLayers(result.layers), []);
  for (const child of result.layers.filter(l => /-(left-(broadcast-label|round|series|partner)|broadcast-crest)-/.test(l.id))) {
    assert(child.position.y - child.height / 2 >= info.position.y - info.height / 2);
    assert(child.position.y + child.height / 2 <= info.position.y + info.height / 2);
  }
});

test('new compact compositions keep the tournament labels separate throughout the supported density range', () => {
  for (const rosterHeight of [250, 251, 252, 260, 280, 320]) {
    const design = composition(); design.layout.rosterHeight = rosterHeight;
    const result = compileHubPlan(hub(), parseHubCreateSpec(JSON.stringify({ design, operations: [] }))).hub;
    assert.deepEqual(validateHubLayers(result.layers), [], `roster height ${rosterHeight}`);
  }
});

test('creation cannot override its design geometry with a second resize or target incompatible components', () => {
  for (const op of [
    { op: 'resize', target: 'players', width: 500, height: 180 },
    { op: 'resize', target: 'all', width: 1000, height: 100 },
    { op: 'resize', target: 'texts', width: 278, height: 100 },
    { op: 'typography', target: 'all', font: 'Impact', size: 48 },
    { op: 'move', target: 'all', dx: 0, dy: -30 },
    { op: 'scoreboard', target: 'players', showGold: true },
    { op: 'players', target: 'scoreboards', gap: 4 },
  ]) assert.throws(() => parseHubCreateSpec(JSON.stringify({ design: composition(), operations: [op] })));
  assert.doesNotThrow(() => parseHubCreateSpec(JSON.stringify({ design: composition(), operations: [
    { op: 'appearance', target: 'scoreboards', paddingX: 16 },
    { op: 'scoreboard', target: 'scoreboards', showObjectives: false },
    { op: 'players', target: 'players', portraitSize: 48, gap: 4 },
    { op: 'move', target: 'scoreboards', dx: 0, dy: 4 },
  ] })));
});

test('independent coloured scoreboard sections retain readable text and follow later palette edits', () => {
  for (const light of [false, true]) {
    const design = composition(); design.panels.teamSections = true;
    if (light) { design.colors.background = '#fff4dc'; design.colors.text = '#111111'; }
    const original = compileHubPlan(hub(), parseHubCreateSpec(JSON.stringify({ design, operations: [] }))).hub;
    const surfaceEdited = compileHubPlan(original, { template: 'current', operations: [
      { op: 'appearance', target: 'scoreboards', backgroundColor: light ? '#fff3d0' : '#0c1830', gradientTo: design.colors.background },
    ] }).hub;
    const changedScore = surfaceEdited.layers.find(l => l.type === 'LolScorebug');
    assert(!changedScore.style.customCss.includes('.scorebug-team-red { background: transparent; }'));
    assert.equal(changedScore.partStyles?.['blue-team']?.backgroundColor, undefined);
    const recolored = compileHubPlan(surfaceEdited, { template: 'current', operations: [{ op: 'theme', palette: 'purple' }] }).hub;
    for (const [result, text] of [[original, design.colors.text], [recolored, AI_PALETTES.purple.text]]) {
      const css = result.layers.find(l => l.type === 'LolScorebug').style.customCss;
      assert.match(css, /background: linear-gradient\(105deg, var\(--hub-team-left\)/);
      assert.match(css, /background: linear-gradient\(255deg, var\(--hub-team-right\)/);
      for (const side of ['left', 'right']) {
        const surface = [...css.matchAll(new RegExp(`--hub-team-${side}: (#[0-9a-f]{6})`, 'g'))].at(-1)[1];
        assert(contrastRatio(text, surface) >= 4.5);
      }
    }
  }
});

test('saved compositions made before coloured team sections remain editable', () => {
  const design = composition(); delete design.panels.teamSections;
  const original = compileHubPlan(hub(), { template: 'ai-composed', design, operations: [] }).hub;
  const result = compileHubPlan(original, { template: 'current', operations: [{ op: 'appearance', target: 'scoreboards', paddingX: 20 }] }).hub;
  assert.deepEqual(validateHubLayers(result.layers), []);
  assert(!result.layers.find(l => l.type === 'LolScorebug').style.customCss.includes('background: linear-gradient(105deg'));
});
