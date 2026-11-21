// Real end-to-end: same-origin host commands through embedded yy-sim WASM.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'..','vendor','yysim'),sent=[],events={};
const parent={postMessage(payload){sent.push(payload)}};
const sandbox={console,TextEncoder,TextDecoder,WebAssembly,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),Math,Date,setTimeout,location:{origin:'https://nangman.test',protocol:'https:'},parent,
 window:{addEventListener(name,handler){events[name]=handler}}};
vm.createContext(sandbox);
for(const file of ['wasm_data.js','core_glue.js','data.js']){
 vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
}
const host=fs.readFileSync(path.join(dir,'engine-host.html'),'utf8');
const body=host.match(/<script>([\s\S]*?)<\/script>/);assert(body);
vm.runInContext(body[1],sandbox,{filename:'engine-host:inline'});
let id=0;
async function call(op,payload){
 await events.message({origin:'https://nangman.test',source:parent,data:{
  kind:'nangman-engine-command',requestId:++id,op,payload
 }});
 const answer=sent.at(-1);
 assert.equal(answer.requestId,id);
 return answer;
}
(async()=>{
 assert((await call('init')).ok,'real embedded WASM engine init');
 const base=(await call('state')).data;
 const initial={...base,mode:'seed',seed:447882174,role_id:10044,zizhi:153,salt:262731,
  talents:[{id:248,locked:false},{id:249,locked:false},{id:250,locked:false},{id:271,locked:false}],
  tal_lucky:37,bag_pills:400,has_bag_pills:true};
 const applied=await call('set-state',initial);
 assert(applied.ok&&Number(applied.data.seed)===447882174);
 const preview=await call('preview',{count:80});
 assert(preview.ok&&Array.isArray(preview.data.preview.purples));
 assert.equal(preview.data.nameIds['九阴鬼脉'],'248');
 const conflicts=await call('talent-constraints');
 assert(conflicts.ok&&Array.isArray(conflicts.data.available)&&Array.isArray(conflicts.data.conflicts));
 const candidate=await call('exchange-pads',{targets:[{purpleId:248,conflictId:249}],maxPad:30});
 assert(candidate.ok&&Array.isArray(candidate.data.results));
 assert.equal(candidate.data.results.length,31);
 assert(candidate.data.results[0].nodes[0].purple_name,'九阴鬼脉');
 assert.equal(Number((await call('state')).data.seed),447882174,
  'read-only preview/conflict/path API did not advance native seed');
 const lock=await call('toggle-lock',{index:0});
 assert(lock.ok&&lock.data.state.talents[0].locked===true);
 const undo=await call('set-state',initial);
 assert(undo.ok&&undo.data.talents[0].locked===false);
 const exchange=await call('exchange-talent',{index:0});
 assert(exchange.ok&&exchange.data.result.success===true&&Array.isArray(exchange.data.state.talents));
 assert((await call('set-state',initial)).ok);
 const washed=await call('wash',{count:5});
 assert(washed.ok&&washed.data.performed===5&&washed.data.partial===false,'native 5 wash result count');
 assert.equal(washed.data.requested,5);
 assert((await call('set-state',initial)).ok);
 const collision=await call('until-exchange',{count:30});
 console.log('ACTUAL_COLLISION_RESPONSE',JSON.stringify(collision).slice(0,2000));
 assert(collision.ok,'real WASM native until-exchange command succeeds: '+JSON.stringify(collision.data));
 assert(collision.data.performed>=0&&collision.data.performed<=30,
  'native search must stop within configured wash bound');
 if(collision.data.found)assert(collision.data.conflict?.can_exchange===true,
   'reported collision uses original can_exchange flag');
 assert((await call('set-state',initial)).ok,'native collision simulation can be undone');
 const target=await call('until-talent',{talentId:248,count:10});
 assert(target.ok&&Array.isArray(target.data.results));
 assert.equal(Number((await call('state')).data.seed),447882174,'existing goal no untracked mutation');
 console.log('PASS: same-origin host + real WASM: save state, preview, conflicts, route, lock, exchange, 5 washes, next conflict, rollback');
})().catch(error=>{console.error(error);process.exitCode=1});
