// Only lock goals currently present in native WASM, never more than three slots.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const host=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const body=host.match(/<script>([\s\S]*?)<\/script>/);assert(body);
let listener,state={role_id:1,seed:152,talents:[
 {id:271,locked:false},{id:272,locked:false},
 {id:250,locked:false},{id:268,locked:false}
]},sets=0;
const messages=[],parent={postMessage(m){messages.push(m)}};
const ctx={window:{addEventListener(name,callback){if(name==='message')listener=callback}},
 parent,location:{origin:'https://test.local'},
 TALENT_DATA:Object.fromEntries([271,272,250,268,249].map(id=>[id,{name:'native-'+id,pinzhi:4}])),
 ZZ_DATA:{},initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){return JSON.parse(JSON.stringify(state))},
 wasmSetState(value){sets++;state=JSON.parse(JSON.stringify(value));return true}};
vm.createContext(ctx);vm.runInContext(body[1],ctx);
async function send(op,payload){
 await listener({origin:'https://test.local',source:parent,
  data:{kind:'nangman-engine-command',requestId:messages.length+1,op,payload}});
 return messages.at(-1);
}
(async()=>{
 assert((await send('init')).ok);
 const first=await send('lock-present-goals',{targetIds:[271,272,250,268]});
 assert(first.ok);
 assert.deepEqual(Array.from(first.data.applied,x=>x.id),[271,272,250]);
 assert.deepEqual(Array.from(first.data.maxed),[268]);
 assert.equal(first.data.locked,3);
 assert.equal(sets,1);
 assert(state.talents[3].locked===false,'fourth goal remains free');
 const second=await send('lock-present-goals',{targetIds:[271,249]});
 assert(second.ok);
 assert.deepEqual(Array.from(second.data.alreadyLocked),[271]);
 assert.deepEqual(Array.from(second.data.missing),[249]);
 assert.equal(second.data.changed,false);
 assert.equal(sets,1,'idempotent no-op must not write the WASM state');
 assert.equal((await send('lock-present-goals',{targetIds:[271,271]})).ok,false);
 assert.equal((await send('lock-present-goals',{targetIds:[999]})).ok,false);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('id="washPathLockGoals"'));
 assert(html.includes("washEngine.call('lock-present-goals',{targetIds})"));
 assert(html.includes('state.undoStates.push(snapshot)'));
 assert(!html.includes('washVerifyRun'));
 console.log('PASS: native goal-only three-lock ceiling, missing goals, idempotence and undo UI');
})().catch(e=>{console.error(e);process.exitCode=1});
