// Real native yy-sim auto-search contract UI/result regression (not fake algorithm).
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base,'engine/yysim-auto-search.js'),'utf8'),ctx);
const api=ctx.window.YYWashAutoSearch,allowed=[248,249,250,261,268,271,272];
assert.deepEqual(Array.from(api.selectedIds([271,250,268],allowed)),[271,250,268]);
assert.throws(()=>api.selectedIds([271,271],allowed),/서로 다른/);
assert.throws(()=>api.selectedIds([271,999],allowed),/녹맥·파맥·자맥/);
assert.throws(()=>api.selectedIds([271,250,268,272,249],allowed),/1~4개/);
assert.equal(api.options({desiredIds:[271,268],maxPad:0,horizon:300,topN:8},allowed).horizon,300);
assert.equal(api.options({desiredIds:[271,268]},allowed).maxPad,0,'Automatic wash defaults must use original unpadded search');
const catalog=[{quality:4,items:[271,272,250,268].map(id=>({id}))},
 {quality:3,items:[204].map(id=>({id}))}];
const fourPurples=[271,272,250,268];
assert.equal(api.recommendedHorizon(fourPurples,catalog),2500,
 '1121 four-purple route ending at wash 1770 must not be rejected by horizon 900');
assert.equal(api.recommendedHorizon([271,272,250,204],catalog),900,
 'mixed-grade native probing retains its existing independent horizon');
assert.equal(api.recommendedHorizon([271,272,250],catalog),900,
 'three-purple searches retain original bounded behavior');
assert.equal(api.options({desiredIds:fourPurples,horizon:api.recommendedHorizon(fourPurples,catalog)},[...allowed,272,250]).horizon,2500);

assert.throws(()=>api.options({desiredIds:[271],maxPad:201,horizon:300,topN:5},allowed),/제한/);
assert.throws(()=>api.options({desiredIds:[271],maxPad:5,horizon:5001,topN:5},allowed),/제한/);
const sample={routes:[{
 order:['天生神力'],order_ids:[268],pad:3,pills:24,washes:3,exchanges:1,
 final_slots:[{id:248,name:'九阴鬼脉',locked:true},{id:173,name:'根骨略优',locked:false},
  {id:265,name:'精通医理',locked:false},{id:268,name:'天生神力',locked:true}],
 strategy:'前K条先天紫',optimal:false,
 actions:[{kind:'lock',talent:'九阴鬼脉',roll_idx:0,pills_after:0,wash_no:0},
  {kind:'open_slot',roll_idx:0,pills_after:0,wash_no:0,note:'开槽至 154（4 格）'},
  {kind:'wash_to',roll_idx:12,pills_after:24,wash_no:3},
  {kind:'exchange',from:'玄阳神脉',to:'天生神力',roll_idx:12,pills_after:24,wash_no:3},
  {kind:'keep',talent:'天生神力',roll_idx:12,pills_after:24,wash_no:3}]
 }],missing:[],scanned:300};
const before=JSON.stringify(sample);
const parsed=api.routeOutcome(sample,[268]);
assert.equal(parsed.routes.length,1);
const route=parsed.routes[0];
assert.equal(route.complete,true);
assert.equal(route.executable,true,'valid native actions make the route replay-eligible');
assert.equal(parsed.stats.actionable,1);
const noActions=api.routeOutcome({routes:[{pills:6,washes:3,exchanges:1,pad:0,final_slots:[{id:268}]}]},[268]);
assert.equal(noActions.routes[0].complete,true,'final goal ownership is independent of replay');
assert.equal(noActions.routes[0].executable,false,'missing actions must not be called replay-ready');
assert.match(noActions.routes[0].warnings.join(' / '),/실행 단계/);
const invalidCost=api.routeOutcome({routes:[{pills:-2,washes:3,exchanges:1,pad:0,actions:[{kind:'wash_to'}],final_slots:[{id:268}]}]},[268]);
assert.equal(invalidCost.routes[0].estimatedPills,null,'negative native cost cannot rank as best');
assert.equal(invalidCost.routes[0].executable,false);
const alreadyPresent=api.routeOutcome({routes:[{pills:0,washes:0,exchanges:0,pad:0,final_slots:[{id:268}]}]},[268]);
assert.equal(alreadyPresent.routes[0].executable,true,'zero-action already-held goal is safe');
const ranking=api.routeOutcome({routes:[
 {pills:5,washes:1,exchanges:1,pad:0,final_slots:[{id:268}]},
 {pills:25,washes:1,exchanges:1,pad:0,actions:[{kind:'exchange'}],final_slots:[{id:268}]}
]},[268]);
assert.equal(ranking.routes[0].estimatedPills,5,'original pill cost outranks our incomplete action replay support');
assert.equal(ranking.routes[0].executable,false);
assert.equal(ranking.routes[1].executable,true);
assert.equal(route.estimatedPills,24);
assert.equal(route.estimatedWashes,3);
assert.equal(route.exchanges,1);
assert.equal(route.pad,3);
assert.equal(route.lockedSlots,2);
assert.equal(route.globallyOptimal,false,'native false must not claim proven global optimum');
const names={'九阴鬼脉':248,'玄阳神脉':249,'天生神力':268};
const translate=id=>'한국재능'+id;
assert.equal(api.describeAction(sample.routes[0].actions[0],names,translate).detail,'한국재능248 (#248)');
assert.match(api.describeAction(sample.routes[0].actions[1],names,translate).detail,/자질 154/);
assert.match(api.describeAction(sample.routes[0].actions[2],names,translate).detail,/3회차/);
assert.match(api.describeAction(sample.routes[0].actions[3],names,translate).detail,/한국재능249/);
assert.match(api.describeAction(sample.routes[0].actions[3],names,translate).detail,/한국재능268/);
assert.equal(JSON.stringify(sample),before,'auto-search formatting never alters WASM result');
const fake={routes:[{pills:0,final_slots:[{id:271}],optimal:true}],scanned:30};
const incomplete=api.routeOutcome(fake,[271,268]);
assert.equal(incomplete.routes[0].complete,false,'even native optimal flag cannot fill absent goal');
assert.equal(incomplete.stats.complete,0);
const raw={purples:[
 {wash_no:21,wash_times:7,talent_id:268,talent_name:'天生神力',
  earlier_conflict_name:'力大无穷',earlier_conflict_wash_times:5,can_exchange:true},
 {wash_no:76,wash_times:25,talent_id:250,talent_name:'混元奇脉',earlier_conflict_name:null,
  earlier_conflict_wash_times:0,can_exchange:true},
 {wash_no:112,wash_times:38,talent_id:271,talent_name:'转世金仙',
  earlier_conflict_name:'天生神力',can_exchange:true}
]};
const t=Array.from(api.previewTarget(raw,[112,21,76]));
assert.equal(t[0].purple_name,'天生神力');
assert.equal(t[0].conflict_wash_no,5,'original uses conflict wash cycles, not purple wash event');
assert.equal(t[1].lock_only,true,'original yy-sim lock-only for divine meridian without prior conflict');
assert.equal(t[2].conflict_wash_no,0,'only first selected purple attaches conflict cycle');
assert.equal(api.previewPadLimit([21,76]),54);
assert.equal(api.previewPadLimit([21]),30);
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
for(const id of ['yyAutoRun','yyAutoClear']){
 assert(html.includes('id="'+id+'"'),id);
}
assert(html.includes("['auto','자동 탐색']"));
for(const id of ['yyAutoPad','yyAutoHorizon','yyAutoTopN','yyAutoConnect','yyAutoProgressive'])assert(!html.includes('id="'+id+'"'),'automatic search must not expose internal controls: '+id);
assert(html.includes('선택 재능 자동 계산'));
assert(html.includes("op:'washEngineAutoProgressive'"),'all grades use original WASM route search');
assert(html.includes('maxPad:0,horizon:900,topN:8'),'native automatic search defaults must match original unpadded behavior');
assert(html.includes("washEngine.call('auto-search',options)"));
assert(html.includes('state.autoResult=null;'));
assert(!html.includes("'auto-intermediate-search'"),'obsolete sequential search must stay removed');
assert(html.includes('yysim')&&html.includes('WASM'));
const host=fs.readFileSync(path.join(base,'vendor/yysim/engine-host.html'),'utf8');
assert(host.includes('search:wasmSearchWashRoutes'),'original native WASM function must be used');
assert(host.includes('desired_ids:ids,max_pad:maxPad,horizon,top_n:topN'));
console.log('PASS: actual yy-sim SearchReq adapter, 4-goal validation, native route step translation, never false optimal');
