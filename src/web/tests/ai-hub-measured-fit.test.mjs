import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { test } from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs', import.meta.url);
const css = await import('../src/app/shared/helpers/authored-css.ts');
const { createBroadcastScaffold, parseDesignResponse } = await import('../src/app/features/editor/ai/hub-design-spec.ts');
const { compileHubPlan } = await import('../src/app/features/editor/ai/hub-plan.ts');
const { measuredFitRecovery, measuredFitImproved } = await import('../src/app/features/editor/ai/hub-layout-recovery.ts');
const { LocalAiService } = await import('../src/app/features/editor/ai/local-ai.service.ts');
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-container-collapse-response.json', import.meta.url)));
const hub = () => { const layout = createBroadcastScaffold(); return {_id:'fit-regression',hubName:'Fit regression',layout,layers:layout.layers}; };
const valid = () => ({measurements:{viewport:[1280,720],fonts:[],clipped:[],frames:[],tableGapPx:0,missingImages:0,integrity:{hidden:[],outside:[],lowContrast:[],overlapping:[]}}});
const scripted = outputs => {
  const service = new LocalAiService(); service.state.set('ready'); const calls = [];
  service.request = async (kind,payload) => { calls.push({kind,payload}); assert(outputs.length,'Unexpected model correction'); return {raw:outputs.shift()}; };
  return {service,calls};
};

test('original generation and both ineffective repairs resolve exact semantic shorthand to real bindings', () => {
  for (const raw of [fixture.proposal,...fixture.reportedRepairs]) {
    const plan = parseDesignResponse(raw,'create');
    const compiled = compileHubPlan(hub(),plan).hub;
    for (const layer of compiled.layers) {
      const saved = css.authoredCss(layer.style.customCss);
      if (layer.id.includes('roster') && saved.includes('font-size:')) assert(!/\.(?:portrait|item|name|cs|kda)\s*\{/.test(saved));
    }
  }
  const tree = css.validateAuthoredCss('.name,.kda,.custom-brand{color:#ffa71c}');
  assert(tree.toString().includes('data-component-part=name'));
  assert(tree.toString().includes('.custom-brand'));
  assert(tree.toString().includes('#ffa71c'));
  // Every shorthand advertised here is actually present in the native renderer.
  const renderer = readFile(new URL('../src/app/features/editor/components/layer-loaders/stat-loader.component.ts',import.meta.url),'utf8');
  return renderer.then(source => { for(const part of ['name','cs','kda','portrait','item','items','blue-team','red-team','clock']) assert(source.includes(`data-component-part="${part}"`),part); });
});

test('native pixels use the canvas for frame rules and component width for descendants, including mixed selectors', () => {
  const rendered = css.validateAuthoredCss(css.compileAuthoredCss('&,.name{font-size:16px;padding:10px}', 'fit',600));
  const rules = rendered.nodes.filter(node=>node.type==='rule');
  assert.equal(rules.length,2);
  const declaration = (rule,property) => parseFloat(rule.nodes.find(node=>node.prop===property).value);
  assert(Math.abs(declaration(rules[0],'font-size') * 19.2 - 16) < .01);
  assert(Math.abs(declaration(rules[1],'font-size') * 6 - 16) < .01);
  assert(Math.abs(declaration(rules[0],'padding') * 19.2 - 10) < .01);
});

test('outer grid collapse is repaired at its measured cause while original artistic values remain', () => {
  const source = hub(), plan = parseDesignResponse(fixture.proposal,'create'), candidate = compileHubPlan(source,plan).hub;
  const report = structuredClone(fixture.recordedMeasurements);
  report.componentLayouts = ['blue','red'].map(team=>({target:`hub-${team}-roster`,role:'players',width:600,height:280,contentWidth:600,loaderWidth:128,rootColumns:6,rootPadding:0,surfaceWidth:128,surfaceHeight:280}));
  const operations = measuredFitRecovery(candidate,{measurements:report});
  assert.equal(operations.length,2);
  const repaired = compileHubPlan(source,{...plan,operations:[...plan.operations,...operations]}).hub;
  for(const layer of repaired.layers){
    const before = candidate.layers.find(item=>item.id===layer.id);
    assert.deepEqual([layer.position,layer.width,layer.height],[before.position,before.width,before.height]);
    for(const color of ['#006699','#cc6600','#1e1e1e'].filter(color=>before.style.customCss.includes(color))) assert(layer.style.customCss.includes(color));
  }
});

test('local fitting uses measured text minima, and leaves impossible or deliberately positioned rows to the model', () => {
  const rendered = valid();
  rendered.measurements.rowLayouts = [{target:'hub-blue-roster',team:'blue',width:580,height:48,items:{visibleMin:8},fields:[
    {part:'items',width:80,height:40},{part:'portrait',width:40,height:40},{part:'level',width:20,height:25,fontPx:18,textWidth:20},
    {part:'name',width:250,height:30,fontPx:17,textWidth:100},{part:'cs',width:50,height:28,fontPx:18,textWidth:36},{part:'kda',width:60,height:25,fontPx:15,textWidth:45}]}];
  assert(measuredFitRecovery(hub(),rendered).some(op=>op.css.includes('grid-template-columns:')));
  rendered.measurements.rowLayouts[0].width=200;
  assert.deepEqual(measuredFitRecovery(hub(),rendered),[]);
  rendered.measurements.rowLayouts[0].width=580; rendered.measurements.rowLayouts[0].fields[0].position='absolute';
  assert.deepEqual(measuredFitRecovery(hub(),rendered),[]);
});

test('partial progress cannot trade a fixed failure for a newly hidden binding, clipped text or failed user check', () => {
  const before = valid(); before.measurements.clipped=[{role:'name',text:'Example'}]; before.measurements.integrity.outside=['team-kills'];
  const after = valid(); after.measurements.integrity.outside=['team-kills']; assert(measuredFitImproved(before,after));
  after.measurements.integrity.outside=['roster-stat']; assert(!measuredFitImproved(before,after));
  after.measurements.integrity.outside=[]; after.measurements.integrity.hidden=['gold']; assert(!measuredFitImproved(before,after));
  after.measurements.integrity.hidden=[]; after.measurements.clipped=[{role:'clock',text:'11:28'}]; assert(!measuredFitImproved(before,after));
  after.measurements.clipped=[];
  const requirement={target:'scoreboards',selector:'&',measure:'widthFraction',value:'0.5',reference:'',quote:'Half the screen width'};
  before.requirementEvidence=[{requirement,samples:[],check:{status:'verified'}}];
  after.requirementEvidence=[{requirement,samples:[],check:{status:'unverified'}}]; assert(!measuredFitImproved(before,after));
  after.requirementEvidence[0].check.status='failed'; assert(!measuredFitImproved(before,after));
});

test('one generation can retain progress through multiple bounded local checks without asking Qwen again', async () => {
  const {service,calls}=scripted([fixture.proposal]); let inspections=0;
  const result=await service.generate(hub(),'Create a readable broadcast','create',{interpret:false,review:false,inspect:async()=>{
    const rendered=valid(); inspections++;
    if(inspections===1){
      rendered.measurements.fonts=[{role:'names',minPx:3,face:'Arial'},{role:'clock',minPx:9.6,face:'Arial'}];
      rendered.measurements.componentLayouts=[{target:'hub-blue-roster',role:'players',contentWidth:600,loaderWidth:128,rootColumns:6}];
    } else if(inspections===2){
      rendered.measurements.fonts=[{role:'clock',minPx:9.6,face:'Arial'}];
      rendered.measurements.componentLayouts=[{target:'hub-scoreboard',role:'scoreboard',text:[{part:'clock',fontPx:14.4}]}];
    }
    return rendered;
  }});
  assert(result,service.error()); assert.equal(calls.length,1); assert.equal(inspections,3);
  assert.equal(result.metrics.attempts[0].localRepairTrials.length,2);
  assert(result.metrics.attempts[0].localRepairTrials.every(trial=>trial.applied));
});
