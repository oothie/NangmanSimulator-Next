// Integration regression: real-save WASM mapping, persistent drop frame, quest save browser.
// Run: node tests/module-integration-smoke.cjs
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'missing source sections '+start+' / '+end);return source.slice(a,b)}
const washFn=new Function('characterEntries',section('function yyWashStateFromSave(', 'function washSandbox(){')+
 ';return yyWashStateFromSave')(v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.values(v):[]);
const exampleSave={CenterID:22262731,Items:[{ID:2601,Num:7},{ID:100,Num:3}],
 globalVariable:{'zysy_1':5}};
const role={id:1,raw:{ID:1,BornTalent:{ID:285,S:447882174,RC:0},
 LuckTalent:{S:123456},TalLucky:37,Level:90,ZiZhi:153,Sex:2,
 Str:107,Con:90,Dex:0,Int:90,BornStr:42,BornCon:38,BornDex:21,BornInt:39,
 StrGift:5000,ConGift:1800,DexGift:5000,IntGift:5000,
 Talents:[{ID:401,Lock:true},{ID:260,Lock:true},{ID:278,Lock:false}]}};
const mapped=washFn(exampleSave,role,{vip:1,salt:278440});
assert.equal(mapped.mode,'seed');assert.equal(mapped.seed,447882174);
assert.equal(mapped.salt,262731);assert.equal(mapped.role_id,1);
assert.equal(mapped.luck_seed,123456);assert.equal(mapped.luck_seed_inited,true);
assert.equal(mapped.tal_lucky,37);assert.equal(mapped.bag_pills,7);
assert.equal(mapped.has_bag_pills,true);
assert.deepEqual(mapped.talents,[{id:401,locked:true},{id:260,locked:true},{id:278,locked:false}]);
assert.deepEqual(mapped.role_stats,{str_val:193,con:141,dex:27,int_val:167});
assert.equal(mapped.global_vars,exampleSave.globalVariable);
assert.equal(mapped.total_wash,0);assert.equal(mapped.total_talent_bars,0);
assert.throws(()=>washFn(exampleSave,{id:1,raw:{ID:1,BornTalent:{ID:285}}},{}),/BornTalent.S/);
const noLuck=washFn(exampleSave,{...role,raw:{...role.raw,LuckTalent:undefined}}, {});
assert.equal(noLuck.luck_seed_inited,false);
assert(source.includes('window.__nangmanBuildWashState=yyWashStateFromSave'),'module bridge source exposed');
assert(source.includes('const mapped=window.__nangmanBuildWashState('),'module uses bridge');
assert(source.includes("op==='washEngineUndo'"),'WASM undo command exists');
assert(source.includes('state.undoStates.push(snapshot)'),'WASM saved-state rollback');
assert(source.includes("id=\"washMainOnce\""),'main wash button bound');
assert(source.includes("id=\"washEngineImport\""),'save->WASM button bound');

assert(source.includes("op==='washEnginePreview'"),'WASM sequence preview command bound');
assert(source.includes('state.preview?.purples'),'purple preview table consumes original WASM results');
assert(source.includes('id="washPreview"'),'exchange tab preview control enabled');
const guardBody=section('function invalidateWashLink(', 'function yyWashStateFromSave(');
const runtime={active:true,origin:'save',linkedRoleId:1,preview:{purples:[{}]},undoStates:[{}],log:[1]};
const invalidate=new Function('window',guardBody+';return invalidateWashLink')({__washRuntime:runtime});
invalidate(1);assert.equal(runtime.active,true,'same selected role leaves state unchanged');
invalidate(10058);assert.equal(runtime.active,false,'other role invalidates engine');
assert.equal(runtime.preview,null);assert.equal(runtime.undoStates.length,0);
assert.equal(runtime.log.length,0);
const wasmHost=fs.readFileSync(path.join(__dirname,'..','vendor','yysim','engine-host.html'),'utf8');
assert(wasmHost.includes("op==='preview'"),'WASM host exposes read-only preview');
assert(wasmHost.includes('wasmPreviewSequence(count)'),'WASM host forwards exact original sequence operation');

const questAPI=new Function('wikiRows','wikiKoMap','wikiName','card','tabRow','moduleHero','escape','save','questTab','questSearch','questLocatedOnly',
 section('function questSaveModel(root){','function others(){')+
 ';return {questSaveModel,questView,questCatalogRows}')(
 ()=>[{cat:'quest',id:'9999999',key:'items:9999999',obj:{n:'원본 임무',desc:'원본 기록'}},{cat:'item',id:10}],
 ()=>new Map(),x=>x.obj.n,(title,html)=>'<section>'+title+html+'</section>',
 ()=>'<nav>임무 메뉴</nav>',(n,t)=>'<h2>'+n+'</h2>',x=>String(x),
 {Task:{id:9999999,trace:true,recv:1784781076},
  WeiTuoTask:{accept:[105,118],task:[105,107,118]},
  SoloNpc:{'32150':{m:'sfj',x:17,y:7},'32237':{r:-1}}},
 'current','','true'=== 'false'
 );
const questSave=questAPI.questSaveModel({
 Task:{id:9999999,trace:true},WeiTuoTask:{accept:[105],task:[105,118]},
 SoloNpc:{'32150':{m:'sfj',x:17,y:7},'32237':{r:-1}}});
assert.equal(questSave.current.id,9999999);
assert.equal(questSave.delegated.accepted.length,1);
assert.equal(questSave.npcRecords.length,2);assert.equal(questSave.located.length,1);
assert.equal(questSave.located[0].map,'sfj');
assert(questAPI.questView().includes('원본 임무'),'quest source matched by task ID');
assert.equal(questAPI.questCatalogRows().length,1,'only source quest rows indexed');
const dropSource=section('// Persistent drop engine:',"window.addEventListener('message',event=>{\n if(event.origin!==location.origin||event.data?.kind!=='nangman-native-equipment')");
const elements={},posts=[],events={};
const host={hidden:true,children:[],appendChild(x){this.children.push(x)}};
elements.dropWorkspace=host;elements.dropRuntimeStatus={textContent:''};
const doc={createElement(name){assert.equal(name,'iframe');return {
  addEventListener(key,fn){this[key]=fn},contentWindow:{postMessage(...args){posts.push(args)}}
}}};
const win={addEventListener(key,fn){events[key]=fn}};
const dropAPI=new Function('document','window','location','$','v','save',dropSource+
 ';return {updateDropVisibility,sendSaveToDrop,setView:val=>v=val,setSave:val=>{save=val;dropSaveVersion++}}')(
 doc,win,{origin:'https://sim.example'},k=>elements[k],'drop',null);
dropAPI.updateDropVisibility();
assert.equal(host.children.length,1,'creates drop iframe once');
host.children[0].load();
assert.equal(posts.length,1,'sends first payload on actual iframe load');
assert.equal(posts[0][0].kind,'nangman-save');
dropAPI.setView('character');dropAPI.updateDropVisibility();
assert.equal(host.hidden,true);
dropAPI.setView('drop');dropAPI.updateDropVisibility();
assert.equal(host.children.length,1,'keeps iframe and results across tab changes');
dropAPI.setSave({MainRole:{ID:1}});dropAPI.updateDropVisibility();
assert.equal(posts.at(-1)[0].save.MainRole.ID,1,'transfers newly imported save');
dropAPI.setSave(null);dropAPI.updateDropVisibility();
assert.equal(posts.at(-1)[0].save,null,'clearing save clears drop engine');
console.log('PASS: yy-sim save->WASM mapping, role invalidation, purple sequence, quest records and persistent drop');
