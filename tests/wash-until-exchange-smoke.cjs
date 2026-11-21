// Original yy-sim host step-until-native-conflict, no guessed chain or item RNG.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const host=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const match=host.match(/<script>([\s\S]*?)<\/script>/);
assert(match,'original native WASM host script is available');
let callback,seed=100,steps=0,conflictAfter=3,throwAt=-1,freeze=false;const sent=[];
const parent={postMessage(payload){sent.push(payload)}};
const talents=[{id:248,locked:false},{id:249,locked:false},{id:250,locked:false}];
const context={window:{addEventListener(type,fn){if(type==='message')callback=fn}},
 location:{origin:'https://local.test'},parent,
 TALENT_DATA:{248:{name:'九阴鬼脉',pinzhi:4}},ZZ_DATA:{},
 initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){return {seed,role_id:10044,talents:talents.map(x=>({...x})),total_wash:steps}},
 wasmSetState(x){seed=x.seed;steps=x.total_wash;return true},
 wasmExchangeTalent(index){return {success:true,changed:index}},
 wasmDoWash(){steps++;if(steps===throwAt)throw Error('mock WASM failure');
  if(!freeze)seed++;return {wash_no:steps,pills_used:3}},
 wasmGetConflicts(){return steps>=conflictAfter?[{index:2,earlier_index:0,can_exchange:true}]:[null,null,null]}
};
vm.createContext(context);vm.runInContext(match[1],context);
async function command(op,payload){
 await callback({origin:'https://local.test',source:parent,
  data:{kind:'nangman-engine-command',requestId:sent.length+1,op,payload}});
 return sent.at(-1);
}
(async()=>{
 assert((await command('init')).ok);
 const result=await command('until-exchange',{count:10});
 assert(result.ok&&result.data.found===true&&result.data.performed===3,'stops at third wash native collision');
 assert.equal(result.data.conflict.index,2);
 assert.equal(result.data.stopReason,'conflict');
 assert.equal(seed,103,'native WASM copy advances only three times');
 const strict=await command('exchange-matched',{index:2});
 assert(strict.ok&&strict.data.result.success===true,'strict native exchange with current collision');
 const rejected=await command('exchange-matched',{index:0});
 assert(rejected.ok===false,'strict native exchange rejects non-conflict slot');
 assert.equal((await command('until-exchange',{count:0})).ok,false,'no zero limit');
 assert.equal((await command('until-exchange',{count:1001})).ok,false,'bounded at 1000');
 assert.equal((await command('until-exchange',{count:3,talentId:999})).ok,false,'rejects fabricated goals');
 // Retain actual result data and never mutate the caller save JSON.
 seed=100;steps=0;conflictAfter=9;throwAt=2;
 const bad=await command('until-exchange',{count:6});
 assert.equal(bad.ok,false,'native exception forwarded');
 assert.equal(seed,100,'exception rolls back source seed');
 assert.equal(steps,0,'exception rolls back wash number');
 throwAt=-1;freeze=true;
 const stationary=await command('until-exchange',{count:6});
 assert(stationary.ok&&!stationary.data.found&&stationary.data.stopReason==='limit');
 assert(html.includes('id="washMainNextConflict"'));
 assert(html.includes('id="washApplyConflict"'));
 assert(html.includes('id="washPathApplyCollision"'));
 assert(html.includes('requireConflict:true'),'source matching guard applies in both wash panels');
 assert(html.includes("e.detail.requireConflict===true?'exchange-matched'"));
 assert(html.includes("washEngine.call('until-exchange',{count,talentId})"));
 assert(html.includes('state.undoStates.push(snapshot);state.log.push(result)'));
 assert(!html.includes('washVerifyRun'),'removed A/B comparison does not return');
 console.log('PASS: native wash-until-exchange conflict stopping, input bounds, rollback and UI connection');
})().catch(err=>{console.error(err);process.exitCode=1});
