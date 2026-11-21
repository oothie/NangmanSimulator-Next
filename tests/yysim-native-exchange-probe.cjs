'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../vendor/yysim');
const ctx={console,WebAssembly,TextEncoder,TextDecoder,Uint8Array,DataView,ArrayBuffer,
 atob:s=>Buffer.from(s,'base64').toString('binary'),location:{protocol:'https:'},window:{},Math,Date,Promise};
vm.createContext(ctx);
for(const file of ['wasm_data.js','core_glue.js','data.js'])
 vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx,{filename:file});
const invoke=s=>vm.runInContext(s,ctx);
(async()=>{
 assert.equal(await invoke('initWasm()'),true);
 assert.equal(invoke('wasmInitEngine(TALENT_DATA,ZZ_DATA)'),true);
 const initial=invoke('wasmGetState()');
 ctx.setup={...initial,seed:'447882174',role_id:10044,zizhi:154,sex:1,vip:1,
  talents:[{id:171,locked:false},{id:172,locked:false}],
  total_pills:0,total_wash:0,bag_pills:50000,has_bag_pills:true,
  global_vars:{nlliandu_tf:0,talent_LingYue:1,mh_tianfu_401:1}};
 assert(invoke('wasmSetState(setup)'));
 let seen=0;
 for(let n=1;n<=1200;n++){
  invoke('wasmDoWash()');
  const s=invoke('wasmGetState()');
  if(n===664){
   const candidates=['seed','save','save_seed','saveSeed','save-seed','archive',
    'saved','save_seed_mode','seed_save','record','file','file_seed','save-seed-mode','saved_seed'];
   for(const mode of candidates){
    ctx.modeCase={...s,mode};
    const set=invoke('wasmSetState(modeCase)');
    const prepared=invoke('wasmGetState()');
    const index=1;
    const trial=invoke('wasmExchangeTalent('+index+')');
    console.log('MODE_TRIAL',JSON.stringify({mode,set,readMode:prepared?.mode,
     error:trial?.error,success:trial?.success,result:trial?.exchanged_to}).slice(0,1200));
   }
   for(const i of [0,1,2,3]){
    ctx.modeCase={...s,mode:'seed'};
    invoke('wasmSetState(modeCase)');
    const trial=invoke('wasmExchangeTalent('+i+')');
    console.log('SLOT_TRIAL',JSON.stringify({wash:n,slot:i,success:trial?.success,error:trial?.error,
      before:s.talents,after:invoke('wasmGetState()').talents,to:trial?.exchanged_to}).slice(0,1800));
   }
   ctx.previous=s;invoke('wasmSetState(previous)');
  }
  const purple=s.talents.filter(t=>+[248,249,250,251,261,262,263,264,266,267,268,269,270,271,272,276].includes(+t.id));
  if(purple.length&&seen<12){
   seen++;
   const conf=invoke('wasmGetConflicts()');
   console.log('PURPLE_EVENT',JSON.stringify({wash:n,seed:s.seed,luck:s.luck_seed_inited,pills:s.total_pills,
    talents:s.talents,conflicts:conf}).slice(0,4500));
   const candidate=s.talents.findIndex(t=>t.id===purple[0].id);
   const copy=JSON.parse(JSON.stringify(s));
   if(candidate>=0&&!s.talents[candidate].locked){
    const ex=invoke('wasmExchangeTalent('+candidate+')');
    console.log('EXCHANGE_TRIAL',JSON.stringify({wash:n,index:candidate,result:ex,after:invoke('wasmGetState()').talents}).slice(0,3500));
    ctx.previous=copy;invoke('wasmSetState(previous)');
   }
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});
