// Legacy native-plan compatibility checks retained; intent permissions and automatic
// artistic treatments are superseded by ai-hub-css/intent/edit-contract tests.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { parseHubCreateSpec, compositionSchemaForInstruction } = await import('../src/app/features/editor/ai/hub-create-spec.ts');
const { normalizePartRules, savedPartStyles } = await import('../src/app/features/editor/ai/hub-part-style.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { validationSummary } = await import('../src/app/features/editor/ai/hub-repair.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-reported-style-aliases.json', import.meta.url), 'utf8'));
const hub = () => { const layout = PREDEFINED_HUB_TEMPLATES.find(item => item.id === 'pulse-broadcast').createLayout(); return { _id: 'style-compat', hubName: 'Style compatibility', layout, layers: layout.layers }; };
const rules = css => normalizePartRules([{ part: 'blue-team', css }])[0].declarations;

test('both unchanged proposals from the reported failure compile without another model generation', () => {
  const original = hub(), before = structuredClone(original);
  for (const raw of [fixture.proposal, fixture.repeatedProposal]) {
    const result = compileHubPlan(original, parseHubCreateSpec(raw, compositionSchemaForInstruction(fixture.instruction)));
    const score = result.hub.layers.find(layer => layer.type === 'LolScorebug');
    assert(score.style.customCss.includes('background: var(--hub-team-left)'));
    assert(score.style.customCss.includes('background: var(--hub-team-right)'));
    const header = result.hub.layers.find(layer => layer.type === 'Text' && savedPartStyles(layer).some(rule => rule.part === 'text'));
    assert(header); assert(header.style.customCss.includes("font-variation-settings: 'wght' 700"));
    assert(result.hub.layers.filter(layer => layer.type === 'LolPlayerRoster').every(layer => layer.visible));
  }
  assert.deepEqual(original, before);
});

test('declared colour-role aliases resolve to local contrast-adjusted roles, including fallbacks', () => {
  for (const alias of ['--teamLeft', '--team-left', '--hub-teamLeft', '--hub-team-left']) {
    assert.equal(rules(`background:var(${alias});`)[0].value, 'var(--hub-team-left)');
  }
  assert.equal(rules('background:var(--teamRight, var(--surfaceDeep));')[0].value, 'var(--hub-team-right, var(--hub-surface-deep))');
  for (const css of ['background:var(--inventedTeamColour)', 'background:url(https://example.test)', 'font-variation-settings:expression(alert(1))']) assert.throws(() => rules(css));
  assert.throws(() => normalizePartRules([{ part: 'text', css: "font-variation-settings:'wght' 700" }], ['background']), /does not permit/);
});

test('unsupported styles have a specific user-facing diagnosis', () => {
  assert.match(validationSummary(fixture.reportedIssues), /style|CSS/);
});
