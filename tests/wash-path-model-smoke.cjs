// Native yy-sim path model: source structure, minimum cost, truthful target status.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'engine/wash-path-model.js'),'utf8'),ctx);
const model=ctx.window.NangmanWashPath;
const goals=[{purple_name:'九阴鬼脉',final_name:'九阴鬼脉',conflict_name:'玄阳神脉',chain:['九阴鬼脉→玄阳神脉']}];
const data=[
 {pad:8,nodes:goals,error:null,pills:60,washes:20,exchanges:2},
 {pad:3,nodes:goals,error:null,pills:45,washes:15,exchanges:1},
 {pad:1,nodes:[{...goals[0],final_name:'玄阳神脉'}],error:null,pills:5,washes:2,exchanges:0},
 {pad:5,nodes:goals,error:'no route',pills:1,washes:0,exchanges:0},
 {pad:12,nodes:goals,error:null,pills:48,washes:16,exchanges:0}
];
const snapshot=JSON.stringify(data),out=Array.from(model.inspect(data,1));
assert.equal(out.length,5);
assert.equal(out.filter(x=>x.success).length,3);
const missing=Array.from(model.inspect([{pad:2,pills:23603,washes:6201,exchanges:0,nodes:[],error:'未洗到紫脉「拳脚无双」'}],1));
assert.equal(missing[0].success,false);
assert.match(missing[0].reasonKo,/목표 자맥/);
assert.deepEqual(Array.from(model.order(out),x=>x.pad),[3,12,8]);
assert.deepEqual(Array.from(model.order(out,{sort:'exchanges'}),x=>x.pad),[12,3,8]);
assert.deepEqual(Array.from(model.order(out,{filter:'failed'}),x=>x.pad),[5,1]);
assert.equal(model.lookup('九阴鬼脉',{'九阴鬼脉':248},id=>'재능'+id),'재능248 (#248)');
const detail=model.describeNode(goals[0],{'九阴鬼脉':248,'玄阳神脉':249},id=>'한글'+id);
assert.equal(detail.completed,true);
assert(detail.chain[0].includes('한글248')&&detail.chain[0].includes('한글249'));
assert.equal(JSON.stringify(data),snapshot,'path model must never mutate original response');
assert.throws(()=>model.inspect(data,5),/목표 자맥/);
const malicious=Array.from(model.inspect([{pad:1,pills:10,washes:10,exchanges:0,nodes:goals}],1));
malicious[0].raw.nodes[0].purple_name='=CMD()';
assert(model.csv(malicious).startsWith('\uFEFF'),'Excel-compatible Korean file');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const id of ['washPathSort','washPathFilter','washPathExport'])assert(html.includes('id="'+id+'"'));
assert(html.includes('./engine/wash-path-model.js'));
assert(html.includes("const effectivePathFilter=runtime.pathFilter||(pathsOk?'success':'failed')"),'zero-success routes visible');
assert(!html.includes('277,414,415,416'),'dummy purple target IDs excluded from selection');
console.log('PASS: source wash path inspection, minimal-cost sort, real goal match, safe CSV and UI');
