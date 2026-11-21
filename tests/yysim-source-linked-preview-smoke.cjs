// yy-sim source wash-event selection: real target names, first conflict cycle,
// divine-meridian lock-only and original WASM unchanged.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/);assert(source);
let receiver,padCalled=null;const messages=[],parent={postMessage(v){messages.push(v)}};
let state={role_id:10044,seed:123,talents:[{id:171,locked:false}]};
const rows=[
 {wash_no:12,wash_times:4,talent_id:261,talent_name:'拳脚无双',
  earlier_conflict_name:'拳脚精通',earlier_conflict_wash_times:3,can_exchange:true},
 {wash_no:51,wash_times:17,talent_id:248,talent_name:'九阴鬼脉',
  earlier_conflict_name:'',earlier_conflict_wash_times:0,can_exchange:false},
 {wash_no:61,wash_times:20,talent_id:262,talent_name:'剑术无双',
  earlier_conflict_name:'剑术精通',earlier_conflict_wash_times:12,can_exchange:true}
];
const ctx={window:{addEventListener(type,fn){if(type==='message')receiver=fn}},
 location:{origin:'https://same.test'},parent,
 TALENT_DATA:{261:{name:'拳脚无双',pinzhi:4},248:{name:'九阴鬼脉',pinzhi:4},
   262:{name:'剑术无双',pinzhi:4},414:{name:'备用天赋',pinzhi:4}},ZZ_DATA:{},
 initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){return JSON.parse(JSON.stringify(state))},
 wasmSetState(next){state=JSON.parse(JSON.stringify(next));return true},
 wasmPreviewSequence(n){assert(n>=1);return {purples:rows}},
 wasmPreviewExchangePads(targets,maxPad){padCalled={targets,maxPad};
  return Array.from({length:maxPad+1},(_,pad)=>({pad,nodes:targets.map(t=>({
   purple_name:t.purple_name,conflict_name:t.conflict_name,chain:[t.purple_name],
   final_name:t.purple_name}))}));
 }};
vm.createContext(ctx);vm.runInContext(source[1],ctx);
async function call(op,payload){
 await receiver({origin:'https://same.test',source:parent,
  data:{kind:'nangman-engine-command',requestId:messages.length+1,op,payload}});
 return messages.at(-1);
}
(async()=>{
 assert((await call('init')).ok);
 const before=JSON.stringify(state);
 const result=await call('sequence-pads',{washNos:[61,12,51],previewLimit:500,maxPad:20});
 assert(result.ok,'source selection succeeds');
 assert.deepEqual(Array.from(result.data.selectedWashNos),[12,51,61]);
 assert.equal(result.data.maxAvailable,38,'original source limit second wash_no gap minus one');
 assert.equal(result.data.results.length,21);
 assert.equal(padCalled.targets.length,3);
 assert.deepEqual(Array.from(padCalled.targets,x=>x.purple_name),
  ['拳脚无双','九阴鬼脉','剑术无双']);
 assert.equal(padCalled.targets[0].conflict_wash_no,3,
  'first selected talent attaches actual conflict wash TIMES, not item sequence number');
 assert.equal(padCalled.targets[1].lock_only,true,
  'divine meridian without prior conflict uses yy-sim lock_only');
 assert.equal(padCalled.targets[1].conflict_name,'');
 assert.equal(padCalled.targets[2].conflict_wash_no,0,
  'only first selected talent retains source conflict wash time');
 assert.equal(JSON.stringify(state),before,'read-only source preview cannot mutate native state');
 const bounded=await call('sequence-pads',{washNos:[12,51],previewLimit:500,maxPad:99});
 assert(bounded.ok&&bounded.data.maxPad===38,'source pad bounded by purple event spacing');
 assert.equal((await call('sequence-pads',{washNos:[999],previewLimit:500,maxPad:2})).ok,false);
 assert.equal((await call('sequence-pads',{washNos:[12,12],previewLimit:500,maxPad:2})).ok,false);
 assert.equal((await call('sequence-pads',{washNos:[12],previewLimit:6000,maxPad:2})).ok,false);
 const main=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(main.includes('data-yy-preview-washno'));
 assert(main.includes('id="yyPreviewLinkedRun"'));
 assert(main.includes("washEngine.call('sequence-pads',"));
 assert(main.includes('state.yyLinkedResult=null;'));
 console.log('PASS: source yy-sim event selection, lock-only divine, first conflict wash cycles, pad gap and no mutation');
})().catch(err=>{console.error(err);process.exitCode=1});
