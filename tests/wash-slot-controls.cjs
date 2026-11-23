// Native yy-sim lock and exchange session guard regression.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const hostSrc=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=hostSrc.match(/<script>([\s\S]*?)<\/script>/);
assert(main);
const native={get:0,set:0,exchange:0,shouldReject:false};
let state={role_id:10,seed:111,talents:[
 {id:261,locked:true},{id:262,locked:true},{id:263,locked:true},{id:264,locked:false}
]};
const original=JSON.stringify(state),posted=[];let listener;
const parent={postMessage(m){posted.push(m)}};
const ctx={window:{addEventListener(key,cb){if(key==='message')listener=cb}},parent,location:{origin:'https://example.test'},
 TALENT_DATA:{},ZZ_DATA:{},EMBEDDED_WASM_B64:'fixture-mock-nonempty',initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){native.get++;return JSON.parse(JSON.stringify(state))},
 wasmSetState(next){native.set++;state=JSON.parse(JSON.stringify(next));return true},
 wasmExchangeTalent(index){native.exchange++;state.talents[index].id=270;state.seed+=1;return index===3?null:native.shouldReject?{success:false,error:'native rejected'}:{success:true,changed:index}}
};
vm.createContext(ctx);vm.runInContext(main[1],ctx);
async function request(op,payload){
 await listener({source:parent,origin:'https://example.test',
  data:{kind:'nangman-engine-command',requestId:posted.length+1,op,payload}});
 return posted.at(-1);
}
(async()=>{
 assert((await request('init')).ok);
 assert.equal((await request('toggle-lock',{index:3})).ok,false,'lock limit three');
 assert.equal(JSON.stringify(state),original,'rejected fourth lock does not mutate native state');
 const unlock=await request('toggle-lock',{index:0});
 assert(unlock.ok&&unlock.data.state.talents[0].locked===false,'unlock is applied');
 assert.equal((await request('exchange-talent',{index:1})).ok,false,'locked slot exchange refused');
 assert.equal(native.exchange,0,'blocked operation never reaches wasm');
 const swap=await request('exchange-talent',{index:0});
 assert(swap.ok&&swap.data.state.talents[0].id===270,'unlocked slot exchange');
 assert.equal(native.exchange,1);
 assert.equal(swap.data.state.seed,112);
 const preFailure=JSON.stringify(state);
 const failed=await request('exchange-talent',{index:3});
 assert.equal(failed.ok,false,'native null result must not be displayed as successful exchange');
 assert.equal(JSON.stringify(state),preFailure,'native error rollback restores saved WASM copy');
 native.shouldReject=true;
 const blocked=await request('exchange-talent',{index:0});
 assert.equal(blocked.ok,false,'native explicit success:false is a failed exchange');
 assert.equal(JSON.stringify(state),preFailure,'failed exchange restores original slot state');
 assert.equal((await request('toggle-lock',{index:9})).ok,false,'index capped');
 assert(index.includes("data-wash-lock=\"")&&index.includes("data-wash-exchange=\""),
 'rendered simulated talent slots expose native actions');
 assert(index.includes("op==='washEngineToggleLock'||op==='washEngineExchangeTalent'"));
 assert(index.includes("state.undoStates.push(snapshot)"));
 assert(index.includes('id="washMainFive"')&&index.includes('id="washMainTen"'));
 assert(index.includes("btn.id==='washMainFive'?'5':btn.id==='washMainTen'?'10'"));
 assert(index.includes('state.liveTalents=applied.talents||[]'),'initial slots from wasm set-state');
 assert(index.includes('state.liveTalents=restored?.talents||[]'),'undo refreshes simulated slots');
 console.log('PASS: native WASM lock max three and unlocked exchange, save-only controls/undo');
})().catch(err=>{console.error(err);process.exitCode=1});
