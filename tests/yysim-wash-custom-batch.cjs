// Exact yy-sim custom wash 1–1000 uses 100-per-call native chunks and one undo.
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../engine/yysim-wash-batch.js'),'utf8'),ctx);
const api=ctx.window.YYWashBatch;
const initial={seed:413,role_id:10044,zizhi:154,total_wash:0,total_pills:0,
 talents:[{id:251,locked:true},{id:271,locked:false}],has_bag_pills:true,bag_pills:5000};
const clone=x=>JSON.parse(JSON.stringify(x));
let current=clone(initial),limit=Infinity,throwOn=0,calls=0;
const call=async(op,arg)=>{
 if(op==='state')return clone(current);
 if(op==='set-state'){current=clone(arg);return clone(current)}
 if(op==='wash'){
  calls++;
  if(throwOn&&calls===throwOn)throw Error('native error');
  assert(arg.count<=100&&arg.count>=1);
  const actual=Math.max(0,Math.min(arg.count,limit));
  current.seed+=actual;current.total_wash+=actual;
  current.total_pills+=actual*5;current.bag_pills-=actual*5;
  const results=Array.from({length:actual},(_,i)=>({
   washNo:current.total_wash-actual+i+1,pillsUsed:5,
   talents:clone(current.talents),totalPills:current.total_pills-(actual-i-1)*5
  }));
  return {state:clone(current),performed:actual,
   results:actual===1?results[0]||null:results};
 }
 throw Error('unexpected '+op);
};
(async()=>{
 const first=await api.run({call,count:1000});
 assert.equal(first.performed,1000);assert.equal(first.results.length,1000);
 assert.equal(first.chunks,10);assert.equal(first.partial,false);
 assert.equal(current.total_wash,1000);assert.equal(current.bag_pills,0);
 current=clone(initial);calls=0;limit=23;
 const partial=await api.run({call,count:700});
 assert.equal(partial.performed,23);assert.equal(partial.partial,true);
 assert.equal(partial.chunks,1);assert.equal(current.total_wash,23);
 current=clone(initial);calls=0;limit=Infinity;throwOn=2;
 await assert.rejects(()=>api.run({call,count:250}),/native error/);
 assert.deepEqual(current,initial,'second-chunk failure restores all original native fields');
 current=clone(initial);calls=0;throwOn=0;
 const once=await api.run({call,count:1});
 assert.equal(once.results.length,1,'single native WASM result is an object');
 assert.equal(once.chunks,1);
 await assert.rejects(()=>api.run({call,count:1001}),/1~1000/);
 await assert.rejects(()=>api.run({call,count:0}),/1~1000/);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert(html.includes('max="1000"'));
 assert(html.includes('window.YYWashBatch.run('));
 assert(html.includes('./engine/yysim-wash-batch.js'));
 console.log('PASS: original yy-sim 1/700/1000 custom washes, native batch count, partial and atomic rollback');
})().catch(e=>{console.error(e);process.exitCode=1});
