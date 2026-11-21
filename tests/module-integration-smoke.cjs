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
assert.equal(runtime.generation,1,'invalidated role increments WASM generation');
assert(source.includes('const generation=state.generation||0;'),'WASM command captures session generation');
assert(source.includes('ensureSession();'),'WASM results rejected after role switch');
assert(source.includes('JSON.stringify(result.state)!==JSON.stringify(snapshot)'),
 'until-purple result remains undoable even if array is empty after state change');
const wasmHost=fs.readFileSync(path.join(__dirname,'..','vendor','yysim','engine-host.html'),'utf8');
assert(wasmHost.includes("op==='preview'"),'WASM host exposes read-only preview');
assert(wasmHost.includes('wasmPreviewSequence(count)'),'WASM host forwards exact original sequence operation');
const dropHost=fs.readFileSync(path.join(__dirname,'..','vendor','sanbujin','drops','index.html'),'utf8');
assert(dropHost.includes("event.data?.kind!=='nangman-drop-mode'"),'same-origin Sanbujin drop mode bridge');
assert(dropHost.includes("dungeon:'dropDungeonLink'"),'dungeon navigation mapped to original controls');
assert(wasmHost.includes("op==='until-gold'"),'yy-sim original next purple wasm operation available');
assert(wasmHost.includes('wasmWashUntilGold(limit)'),'host calls the original native until-gold API');
assert(wasmHost.includes('limit>5000'),'until-gold hard execution cap');
assert(source.includes('id="washMainGold"'),'next-purple button enabled for imported save');
assert(source.includes("op==='washEngineUntilGold'"),'next-purple button connected to native bridge');
assert(source.includes("washEngine.call('until-gold',{count:1000})"),'bounded native next purple call');
assert(source.includes('state.undoStates.push(snapshot);state.log.push(result);state.preview=null;'),
 'next-purple run has reversible state snapshot');


const questSource=section('function questSaveModel(root){','function others(){');
assert(questSource.includes('function questRecordDetails('),'saved quest detail rendering is available');
assert(questSource.includes('function questDelegatedDetails('),'commission history is expandable');
assert(questSource.includes("['current','주요 임무']"),'main quest tab present');
assert(questSource.includes("['branch','임무 진행도']"),'quest progress tab present');
assert(!questSource.includes("['npc','NPC 위치']"),'NPC location tab removed');
assert(!questSource.includes('SoloNpc'),'quest UI does not read position records');
assert(!questSource.includes('questLocatedOnly'),'obsolete NPC state removed');
assert(questSource.includes("다음 이야기 준비 중"),'main story sentinel preserved');
const dropSource=section('// Persistent drop engine:',"window.addEventListener('message',event=>{\n if(event.origin!==location.origin||event.data?.kind!=='nangman-native-equipment')");
const elements={},posts=[],events={};
const host={hidden:true,children:[],appendChild(x){this.children.push(x)}};
elements.dropWorkspace=host;elements.dropRuntimeStatus={textContent:''};
const doc={createElement(name){assert.equal(name,'iframe');return {
  addEventListener(key,fn){this[key]=fn},contentWindow:{postMessage(...args){posts.push(args)}}
}}};
const win={addEventListener(key,fn){events[key]=fn}};
const dropAPI=new Function('document','window','location','$','v','save',dropSource+
 ';return {updateDropVisibility,sendSaveToDrop,sendDropMode,setMode:val=>dropSelectedMode=val,setView:val=>v=val,setSave:val=>{save=val;dropSaveVersion++}}')(
 doc,win,{origin:'https://sim.example'},k=>elements[k],'drop',null);
dropAPI.updateDropVisibility();
assert.equal(host.children.length,1,'creates drop iframe once');
host.children[0].load();
assert.equal(posts.length,0,'load event alone cannot confirm engine ready');
const dropWindow=host.children[0].contentWindow;
events.message({origin:'https://sim.example',source:dropWindow,data:{
 kind:'nangman-embedded-status',module:'drops',status:'ready'}});
assert.equal(posts.length,2,'send save and selected mode only after ready confirmation');
assert.equal(posts[0][0].kind,'nangman-save');
assert.equal(posts[0][0].version,0,'initial drop save revision');
assert.equal(posts[1][0].kind,'nangman-drop-mode','selected drop mode forwarded');
assert.equal(posts[1][0].mode,'wild','initial drop mode remains field');
events.message({origin:'https://sim.example',source:dropWindow,data:{
 kind:'nangman-embedded-status',module:'drops',status:'save-loaded',version:0}});
assert.match(elements.dropRuntimeStatus.textContent,/세이브 미연결/,'versioned empty save ack');
dropAPI.setView('character');dropAPI.updateDropVisibility();
assert.equal(host.hidden,true);
dropAPI.setView('drop');dropAPI.updateDropVisibility();
assert.equal(host.children.length,1,'keeps iframe and results across tab changes');
dropAPI.setMode('dungeon');dropAPI.sendDropMode();
assert.equal(posts.at(-1)[0].kind,'nangman-drop-mode','switches existing iframe mode without recreation');
assert.equal(posts.at(-1)[0].mode,'dungeon','dungeon tab bridged');
assert.equal(host.children.length,1,'switching drop mode keeps iframe');
dropAPI.setSave({MainRole:{ID:1}});dropAPI.updateDropVisibility();
assert.equal(posts.at(-1)[0].save.MainRole.ID,1,'transfers newly imported save');
assert.equal(posts.at(-1)[0].version,1,'save revision increments on import');
events.message({origin:'https://sim.example',source:dropWindow,data:{
 kind:'nangman-embedded-status',module:'drops',status:'save-loaded',version:0}});
assert(!elements.dropRuntimeStatus.textContent.includes('적용 확인됨'),'stale acknowledgement ignored');
events.message({origin:'https://sim.example',source:dropWindow,data:{
 kind:'nangman-embedded-status',module:'drops',status:'save-loaded',version:1}});
assert(elements.dropRuntimeStatus.textContent.includes('적용 확인됨'),'matching revision confirms save');
dropAPI.setSave(null);dropAPI.updateDropVisibility();
assert.equal(posts.at(-1)[0].save,null,'clearing save clears drop engine');
console.log('PASS: yy-sim save->WASM mapping, role invalidation, purple sequence, detailed quest records without NPC locations and persistent drop');
