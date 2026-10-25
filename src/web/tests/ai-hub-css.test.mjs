import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const css = await import('../src/app/shared/helpers/authored-css.ts');
const { createLayerCss } = await import('../src/app/shared/helpers/layer-style.helpers.ts');
const { compileHubPlan, previewHub } = await import('../src/app/features/editor/ai/hub-plan.ts');
const design = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const { APPROVED_HUB_REFERENCE_RECORDS } = await import('../src/app/features/editor/ai/hub-design-knowledge.ts');
const references = await import('../src/app/features/editor/ai/hub-reference-records.ts');
const { PREDEFINED_HUB_TEMPLATES } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const hub = () => { const layout = PREDEFINED_HUB_TEMPLATES.find(item => item.id === 'pulse-broadcast').createLayout(); return { _id: 'css-hub', hubName: 'CSS hub', layout, layers: layout.layers }; };
const response = (styles, operations = []) => JSON.stringify({ summary: 'A coherent broadcast identity.', styles, operations });
const style = (target, value, mode = 'patch') => ({ target, mode, css: value });
const brief = instruction => ({ summary: instruction, goals: [instruction], targets: ['all'], preserve: [], preferences: [], functionalRequirements: [], scope: 'broad', constraints: [], unresolved: [] });
const report = () => ({ viewport: [1280, 720], fonts: [], clipped: [], frames: [], tableGapPx: 0, missingImages: 0 });

test('general CSS accepts novel values, variables, selectors and conditional rules without aesthetic presets', () => {
  const source = `& { --signal: oklch(70% .12 210); color: var(--signal); }
    @supports (display:grid) { [data-component-part="row"]:nth-child(2n) { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:clamp(2px,1%,8px); filter:saturate(.8); } }
    :is([data-component-part="name"],[data-component-part="cs"]) { font-family:Verdana,sans-serif; font-stretch:condensed; }`;
  assert.doesNotThrow(() => css.validateAuthoredCss(source));
  const rendered = css.compileAuthoredCss(source, 'qa', 600);
  assert(rendered.includes('@supports')); assert(rendered.includes(':is(')); assert(rendered.includes('Verdana'));
  assert(!rendered.includes('Impact')); assert(rendered.includes('cqw')); assert(rendered.includes('[data-layer-id="qa"]'));
});

test('malformed CSS and external resources including escaped function names are rejected', () => {
  for (const source of ['.row { color red; }', '.row { color: red', '.row {background:url(https://example.test/x)}', '.row {background:u\\72l(https://example.test/x)}', '@import "https://example.test/x";', '@font-face {font-family:x;src:url(x)}', '.row{--leak:image-set("https://example.test/x" 1x)}', '.row{color:expression(alert(1))}']) assert.throws(() => css.validateAuthoredCss(source), undefined, source);
});

test('root sibling escape and global pseudo selectors cannot affect the surrounding application', () => {
  for (const selector of ['& + body', '& ~ *', '&:is(.x,.y) + .editor-shell', '+ body', ':global(body)', ':host-context(body)', '.foo &']) assert.throws(() => css.validateAuthoredCss(`${selector}{color:red}`), undefined, selector);
  const result = css.compileAuthoredCss('body,.editor-shell,:is(.x,.y){color:red}', 'isolated', 600);
  assert.equal((result.match(/data-layer-id="isolated"/g) ?? []).length, 6);
});

test('root geometry uses structural tools while internal CSS dimensions remain free', () => {
  assert.throws(() => css.validateAuthoredCss('& { width: 600px; }'), /layout operation/);
  assert.doesNotThrow(() => css.validateAuthoredCss('[data-component-part="portrait"]{width:37px;aspect-ratio:1;transform:skew(-4deg)}'));
  assert.doesNotThrow(() => css.validateAuthoredCss('&::before{position:absolute;width:30px;height:2px;content:""}'));
});

test('document-root aliases become isolated component roots without changing their design values',()=>{
  const source=css.patchAuthoredCss('',':root{--signal:#176}body .row{background:var(--signal)}');
  assert(css.authoredCss(source).includes('&{--signal:#176}'));
  assert(!css.authoredCss(source).includes('body'));
});

test('escaped and uppercase at-rules cannot introduce global animations or cascade layers',()=>{
  const rendered=css.compileAuthoredCss('@KEYFRAMES signal{from{opacity:.7}to{opacity:1}}@LAYER art{.row{animation:signal 1s}}','isolated',600);
  assert(rendered.includes('@keyframes hub-isolated-signal'));
  assert(rendered.includes('@layer hub-isolated-art'));
  assert.throws(()=>css.compileAuthoredCss('@l\\61yer art{.row{color:red}}','isolated',600));
});

test('local keyframes are namespaced separately for preview and editor', () => {
  const source = '@keyframes glow { from { opacity:.6 } to { opacity:1 } } .row{animation:glow 2s infinite}';
  const first = css.compileAuthoredCss(source, 'editor', 600), second = css.compileAuthoredCss(source, 'preview', 600);
  assert(first.includes('@keyframes hub-editor-glow')); assert(first.includes('animation:hub-editor-glow'));
  assert(second.includes('@keyframes hub-preview-glow')); assert(!first.includes('from [data-layer'));
});

test('patching preserves unrelated declarations, selectors and conditional contexts', () => {
  let source = css.patchAuthoredCss('', '.name{color:white;font-size:21px}.kda{color:#aaa}@media(min-width:1px){.name{font-size:22px}}');
  source = css.patchAuthoredCss(source, '.name{font-size:23px}');
  const saved = css.authoredCss(source);
  assert(saved.includes('color:white')); assert(saved.includes('.kda')); assert(saved.includes('22px')); assert(saved.includes('23px')); assert(!saved.includes('21px'));
  const replaced = css.patchAuthoredCss(source, '.name{color:black}', 'replace');
  assert(!replaced.includes('.kda'));
});

test('stored native CSS survives serialization, preview ID remapping and frame resizing', () => {
  const source = hub();
  const plan = design.parseDesignResponse(response([style('players', '[data-component-part="name"]{font-size:23px;letter-spacing:.7px}')]), 'edit');
  const result = compileHubPlan(source, plan).hub;
  const saved = JSON.parse(JSON.stringify(result));
  const player = saved.layers.find(layer => layer.type === 'LolPlayerRoster');
  assert(css.authoredCss(player.style.customCss).includes('23px'));
  const preview = previewHub(saved).layers.find(layer => layer.id === 'ai-preview-' + player.id);
  assert(createLayerCss(preview.id, preview.style.customCss, preview.width).includes('ai-preview-'));
  const resized = compileHubPlan(saved, { template:'current', authored:true, operations:[{op:'resize',target:player.id,width:700,height:player.height}] }).hub.layers.find(layer => layer.id === player.id);
  assert.equal(css.authoredCss(player.style.customCss), css.authoredCss(resized.style.customCss));
  assert.notEqual(createLayerCss(player.id, player.style.customCss, player.width), createLayerCss(resized.id, resized.style.customCss, resized.width));
});

test('manual part editing supersedes only conflicting authored declarations', () => {
  const layer = hub().layers.find(layer => layer.type === 'LolPlayerRoster');
  layer.style.customCss = css.patchAuthoredCss(layer.style.customCss, '[data-component-part="name"],[data-component-part="kda"]{font-size:22px;color:white}');
  const changes = css.reconcileManualCss(layer, { partStyles:{name:{fontSize:26}} });
  const source = css.authoredCss(changes.style.customCss);
  assert(source.includes('color:white')); assert(source.includes('font-size:22px'));
  assert.equal((source.match(/font-size:22px/g) ?? []).length, 1);
});

test('styles preserve native scoreboard and player data, source IDs, roles and item bindings', () => {
  const source = hub();
  const player = source.layers.find(layer => layer.type === 'LolPlayerRoster');
  player.playerOverrides = { top:{name:'Bound Player',creepScore:230,items:[{id:'1001'}]} };
  const scoreboard = source.layers.find(layer => layer.type === 'LolScorebug');
  scoreboard.teamStats = {blue:{kills:10,gold:42000},red:{kills:8,gold:41000}};
  const result = compileHubPlan(source, design.parseDesignResponse(response([style('players','[data-component-part="row"]{border-image:linear-gradient(90deg,#254,#456) 1}'), style('scoreboards','[data-component-part="center"]{background:#12151a}')]), 'edit')).hub;
  assert.deepEqual(result.layers.find(layer => layer.id === player.id).playerOverrides, player.playerOverrides);
  assert.deepEqual(result.layers.find(layer => layer.id === scoreboard.id).teamStats, scoreboard.teamStats);
  assert.deepEqual(design.functionalDesignIssues(source,result,'edit'),[]);
});

test('creation uses reusable native data components and accepts unconventional readable geometry', () => {
  const plan = design.parseDesignResponse(response([style('all','& {color:#ffffff;background:#13151a}','replace')],[{op:'frame',target:'scoreboards',x:960,y:70,width:700,height:140}]),'create');
  const result = compileHubPlan(hub(),plan).hub;
  assert.equal(result.layers.length,3); assert.equal(result.layers.find(layer => layer.type==='LolScorebug').width,700);
  assert.deepEqual(design.functionalDesignIssues(hub(),result,'create'),[]);
});

test('explicit preservation is enforced independently of the full presentation capability schema', () => {
  const source=hub(), request='Redesign player tables; keep scoreboard unchanged';
  const understood={...brief(request),constraints:[{target:'scoreboards',aspect:'all',request:'keep scoreboard unchanged'}]};
  const accepted=compileHubPlan(source,design.parseDesignResponse(response([style('players','[data-component-part="name"]{font-weight:900}')]),'edit')).hub;
  assert.deepEqual(design.designConstraintIssues(understood,source,accepted),[]);
  const rejected=compileHubPlan(source,design.parseDesignResponse(response([style('scoreboards','[data-component-part="center"]{background:red}')]),'edit')).hub;
  assert(design.designConstraintIssues(understood,source,rejected).length);
  assert.throws(()=>design.parseDesignBrief(JSON.stringify({...understood,constraints:[{...understood.constraints[0],request:'do not change fonts'}]}),request),/quote/);
});

test('approved references carry actual CSS/structure, optional preview/edit records and honest export', () => {
  assert.equal(APPROVED_HUB_REFERENCE_RECORDS.length,3);
  for(const record of APPROVED_HUB_REFERENCE_RECORDS){ assert(record.styles.length); assert(record.structure.layers.length); assert.equal(record.edits.length,0); assert(references.referenceCssContext(record).examples.some(example=>example.css)); }
  assert.equal(references.exportReferenceRecords(APPROVED_HUB_REFERENCE_RECORDS).split('\n').length,3);
  assert.equal(references.exportApprovedEditExamples(APPROVED_HUB_REFERENCE_RECORDS),'');
});

test('context exposes actual current CSS and flags omissions without cutting a selector block',()=>{
  const source=hub(), context=design.designContext(source,undefined,500);
  assert(context.layers.some(layer=>layer.omittedCssCharacters));
  for(const layer of context.layers) if(layer.css) assert.doesNotThrow(()=>css.validateAuthoredCss(layer.css));
});

test('model context gives actual enabled row fields and handles oversized invalid manual CSS safely',()=>{
  const source=hub(), player=source.layers.find(layer=>layer.type==='LolPlayerRoster');
  player.showLevel=true; player.showGold=false;
  player.style.customCss='&{'+ 'color:red;'.repeat(100);
  const context=design.designContext(source,undefined,10), row=context.layers.find(layer=>layer.id===player.id);
  assert(row.rowFields.includes('level')); assert(!row.rowFields.includes('gold'));
  assert.equal(row.defaultTracks.split(' ').length,row.rowFields.length);
  assert(row.omittedCssCharacters); assert.equal(row.css,'');
});

for(const instruction of [
  'Make everything look better, professional esports please.',
  'Redesign player tables entirely; keep scoreboard unchanged.',
  'Only change the font of the player names.',
  'Make the scoreboard and tables cohesive, mixed type and asymmetric accents.',
  'White paper editorial style with purple signals, not the usual dark esports.',
  'biger hero pics but gear smaller and words need some space plz',
]) test(`mocked natural-language integration retains the same general CSS tools: ${instruction}`,async()=>{
  const ai=new LocalAiService(); ai.state.set('ready'); ai.metrics.set({model:'Qwen3-4B-q4f16_1-MLC'});
  const calls=[];
  ai.request=async(kind,payload)=>{calls.push({kind,payload}); if(kind==='interpret')return{raw:JSON.stringify(brief(instruction))}; return{raw:response([style('players','[data-component-part="name"]{font-family:Verdana;font-weight:650}')]),durationMs:1};};
  const result=await ai.generate(hub(),instruction,'edit',{review:false});
  assert(result,ai.error());
  assert.deepEqual(calls[1].payload.schema.properties.styles.items.properties.css,design.HUB_DESIGN_RESPONSE_SCHEMA.properties.styles.items.properties.css);
  assert.deepEqual(calls[1].payload.schema.properties.operations.items.oneOf.map(item=>item.properties.op.const),design.HUB_DESIGN_RESPONSE_SCHEMA.properties.operations.items.oneOf.map(item=>item.properties.op.const));
  assert.equal(calls[1].payload.maxTokens,2200); assert(calls[1].payload.messages.at(-1).content.includes(instruction));
});

test('rendered failure requests a focused model CSS patch without a native artistic correction',async()=>{
  const ai=new LocalAiService(); ai.state.set('ready'); ai.metrics.set({model:'Qwen3-4B-q4f16_1-MLC'});
  const calls=[];
  ai.request=async(kind,payload)=>{calls.push(kind); if(kind==='repair'){
    assert.equal(payload.messages[0].content,design.HUB_REPAIR_PROMPT);
    assert(payload.messages[0].content.length<design.HUB_DESIGN_PROMPT.length/2);
    assert.equal(JSON.parse(payload.messages[1].content).measurements.rowLayouts[0].fields[0].width,13);
  } return{raw:response([style('players',`[data-component-part="name"]{font-size:${kind==='repair'?22:2}px}`)]),durationMs:1};};
  const result=await ai.generate(hub(),'Refine player typography','edit',{interpret:false,review:false,inspect:async candidate=>{
    const measurements=report(); measurements.rowLayouts=[{team:'blue',grid:'13px',fields:[{part:'name',width:13,height:20,column:'auto'}]}];
    if(candidate.layers.some(layer=>css.authoredCss(layer.style?.customCss).includes('font-size:2px')))measurements.fonts=[{role:'names',minPx:1.3,face:'Arial'}]; return{measurements};
  }});
  assert(result,ai.error()); assert.deepEqual(calls,['generate','repair']); assert.equal(result.metrics.localCorrections,0);
});

test('invalid resource CSS stops safely without replacing the current hub or silently choosing a preset',async()=>{
  const source=hub(),before=structuredClone(source),ai=new LocalAiService(); ai.state.set('ready'); ai.metrics.set({model:'Qwen3-4B-q4f16_1-MLC'});
  ai.request=async()=>({raw:response([style('all','&{background:url(https://bad.test/x)}')])});
  assert.equal(await ai.generate(source,'Make it different','edit',{interpret:false,review:false}),null);
  assert.deepEqual(source,before); assert(ai.error().includes('unchanged'));
});

test('normal renderers and persistence keep the same CSS-bearing layer representation',async()=>{
  const store=await readFile(new URL('../src/app/core/store/hub.store.ts',import.meta.url),'utf8');
  assert(store.includes('reconcileManualCss(layer, changes)')); assert(store.includes('layers: hub.layers'));
  const source=await readFile(new URL('../src/app/features/editor/ai/local-ai.service.ts',import.meta.url),'utf8');
  assert(!source.includes('resolveIntentPlan(')); assert(!source.includes('repairHintOperations('));
});

test('native row tracks match actual bound fields and preserve mirrored order',async()=>{
  const {StatLoaderComponent}=await import('../src/app/features/editor/components/layer-loaders/stat-loader.component.ts');
  const loader=new StatLoaderComponent(), layout=design.createBroadcastScaffold();
  const blue=layout.layers.find(layer=>layer.team==='blue'),red=layout.layers.find(layer=>layer.team==='red');
  assert.equal(loader.rosterTracks(blue).split(' ').length,6);
  assert.equal(loader.rosterTracks(red),loader.rosterTracks(blue).split(' ').reverse().join(' '));
  blue.showLevel=false;blue.showItems=false;
  assert.equal(loader.rosterTracks(blue).split(' ').length,4);
});

test('training-reference excerpts use the approved design overrides rather than old baseline skins',()=>{
  const pulse=APPROVED_HUB_REFERENCE_RECORDS.find(record=>record.id==='pulse');
  const excerpt=references.referenceCssContext(pulse,3000);
  assert(!excerpt.examples.some(example=>example.css.includes('#1b0c0e')));
});

test('actual hub store retains authored CSS through apply, history, save, reopening and manual edits',async()=>{
  const {HubStore}=await import('../src/app/core/store/hub.store.ts');const {of}=await import('rxjs');
  const source=hub();let saved;
  const store=new HubStore({getMyHubs:()=>of([structuredClone(source)]),updateHub:(id,changes)=>{saved={_id:id,...changes};return of(saved);}});
  store.loadMyHubs();const before=store.selectedHub();
  const result=compileHubPlan(before,design.parseDesignResponse(response([style('players','[data-component-part="name"]{font-size:23px} [data-component-part="row"]{border-bottom:.7px solid #456}')]),'edit')).hub;
  assert(store.applyAiLayout(before._id,result.layout,JSON.stringify([before._id,before.layout,before.layers])));
  store.undoSelectedHub();assert.deepEqual(store.selectedHub().layers,before.layers);store.redoSelectedHub();store.saveSelectedHub();
  const reopened=new HubStore({getMyHubs:()=>of([structuredClone(saved)])});reopened.loadMyHubs();
  const player=reopened.selectedHub().layers.find(layer=>layer.type==='LolPlayerRoster');assert(css.authoredCss(player.style.customCss).includes('23px'));
  reopened.updateLayer(player.id,{partStyles:{...player.partStyles,name:{fontSize:27}}});
  const edited=reopened.selectedHub().layers.find(layer=>layer.id===player.id);
  assert(!css.authoredCss(edited.style.customCss).includes('23px'));assert(css.authoredCss(edited.style.customCss).includes('border-bottom'));
  assert.equal(edited.partStyles.name.fontSize,27);
});
