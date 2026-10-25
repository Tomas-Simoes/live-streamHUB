import assert from 'node:assert/strict';
import {register} from 'node:module';
import {test} from 'node:test';
import '@angular/compiler';
register('./typescript-loader.mjs',import.meta.url);
const {parseDesignResponse,designConstraintIssues,createBroadcastScaffold}=await import('../src/app/features/editor/ai/hub-design-spec.ts');
const {compileHubPlan}=await import('../src/app/features/editor/ai/hub-plan.ts');
const {authoredCss}=await import('../src/app/shared/helpers/authored-css.ts');
const hub=()=>{const layout=createBroadcastScaffold();return{_id:'edit-contract',hubName:'Edit',layout,layers:layout.layers};};
const brief=(target,aspect)=>({constraints:[{target,aspect,request:'Explicitly preserved by user'}]});
const plan=(target,css,operations=[])=>parseDesignResponse(JSON.stringify({summary:'A model-chosen style',styles:[{target,mode:'patch',css}],operations}),'edit');
test('the model owns condensed font, hierarchy, border thickness and gradient choices',()=>{const result=compileHubPlan(hub(),plan('players','[data-component-part="name"]{font-family:"Arial Narrow";font-size:25px}[data-component-part="cs"]{font-weight:650}[data-component-part="kda"]{font-weight:450}[data-component-part="portrait"]{border:1.7px double #287}')).hub;const source=authoredCss(result.layers.find(layer=>layer.team==='blue').style.customCss);assert(source.includes('25px'));assert(source.includes('1.7px'));assert(source.includes('650'));assert(!source.includes('Impact'));assert(!source.includes('22px'));});
test('the same CSS proposal is not modified by different natural-language styling phrases',()=>{const source=hub();const proposal=plan('scoreboards','[data-component-part="blue-team"]{background:linear-gradient(18deg,#176,#123)}');assert.deepEqual(compileHubPlan(source,proposal).hub,compileHubPlan(source,structuredClone(proposal)).hub);assert(authoredCss(compileHubPlan(source,proposal).hub.layers[0].style.customCss).includes('18deg'));});
test('a partial table redesign keeps the protected scoreboard byte-for-byte intact',()=>{const source=hub(),result=compileHubPlan(source,plan('players','[data-component-part="row"]{background:#112122}')).hub;assert.deepEqual(source.layers[0],result.layers[0]);assert.deepEqual(designConstraintIssues(brief('scoreboards','all'),source,result),[]);});
test('moving an explicitly protected component fails preservation validation',()=>{const source=hub(),result=compileHubPlan(source,plan('players','[data-component-part="name"]{color:#eee}',[{op:'move',target:'scoreboards',dx:0,dy:20}])).hub;assert.equal(designConstraintIssues(brief('scoreboards','geometry'),source,result).length,1);});
test('typography preservation catches a CSS font change without preventing other styles',()=>{const source=hub(),changed=compileHubPlan(source,plan('players','[data-component-part="name"]{font-family:Verdana}')).hub;assert(designConstraintIssues(brief('players','typography'),source,changed).length);const colour=compileHubPlan(source,plan('players','[data-component-part="name"]{color:#fefefe}')).hub;assert.deepEqual(designConstraintIssues(brief('players','typography'),source,colour),[]);});
test('authored geometry remains exactly what the model proposed, without silent reflow',()=>{const source=hub(),originalRed=structuredClone(source.layers.find(layer=>layer.team==='red'));const result=compileHubPlan(source,plan('blue-players','[data-component-part="name"]{font-weight:650}',[{op:'frame',target:'blue-players',x:250,y:550,width:450,height:500}])).hub;assert.deepEqual(result.layers.find(layer=>layer.team==='red'),originalRed);assert.equal(result.layers.find(layer=>layer.team==='blue').position.x,250);});
test('invalid geometry is rejected rather than clamped into an artistic fallback',()=>{const source=hub();assert.throws(()=>compileHubPlan(source,plan('players','[data-component-part="name"]{color:white}',[{op:'frame',target:'scoreboards',x:10,y:50,width:1000,height:100}])),/outside the canvas/);});

test('explicit only-CSS requests preserve unrelated CSS and geometry without restricting generator tools',()=>{
  const source=hub(),boundary={constraints:[{target:'all',aspect:'only-css',selector:'[data-component-part="name"]',properties:['font-family'],request:'Only change the player names font'}]};
  const allowed=compileHubPlan(source,plan('players','.roster-name{font-family:Verdana}')).hub;
  assert.deepEqual(designConstraintIssues(boundary,source,allowed),[]);
  const extra=compileHubPlan(source,plan('players','.roster-name{font-family:Verdana;padding:3px}')).hub;
  assert(designConstraintIssues(boundary,source,extra).some(issue=>issue.message.includes('padding')));
  const moved=compileHubPlan(source,plan('players','.roster-name{font-family:Verdana}',[{op:'move',target:'scoreboards',dx:0,dy:20}])).hub;
  assert(designConstraintIssues(boundary,source,moved).length);
});

test('preservation corrections remove forbidden operations against the original rather than stacking undo CSS',async()=>{
  const {LocalAiService}=await import('../src/app/features/editor/ai/local-ai.service.ts');
  const ai=new LocalAiService();ai.state.set('ready');const source=hub(),calls=[];
  const instruction='Redesign the tables; keep scoreboard unchanged';
  ai.request=async(kind)=>{calls.push(kind);if(kind==='interpret')return{raw:JSON.stringify({summary:instruction,goals:['Redesign tables'],targets:['players'],preserve:['keep scoreboard unchanged'],preferences:[],functionalRequirements:[],scope:'targeted',unresolved:[],constraints:[{target:'scoreboards',aspect:'all',request:'keep scoreboard unchanged'}]})};
    return{raw:JSON.stringify({summary:'Refined tables',styles:[{target:calls.length===2?'scoreboards':'players',mode:'patch',css:'.roster-name{font-family:Verdana} .scorebug{background:#121a20}'}],operations:[]})};};
  const result=await ai.generate(source,instruction,'edit',{review:false});
  assert(result,ai.error());assert.deepEqual(calls,['interpret','generate','generate']);assert.deepEqual(source.layers[0],result.hub.layers[0]);
});
