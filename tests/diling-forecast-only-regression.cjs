'use strict';
// Synthetic samples: 10th white 4009 is an observed outcome, not proof of a
// particular LuaJIT table traversal. The UI must show remaining ambiguity.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
for(const file of [
 'vendor/sanbujin/shared/equip_data.js',
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/tomb-core.js'
])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
const model=ctx.window.SBJTombDrop;
const save={Rnds:{Sds:{seed_35256:492075794,rollenemy_tomb:1456365169},
 Eds:{'4009':245317680,'4209':394652819}},
 globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const original=JSON.stringify(save),input=model.open(save);
assert(model.ready(input));
const noObservation=model.fitObservations(input,[],{count:30});
assert.equal(noObservation.tested,144);
assert.equal(noObservation.matches.length,144);
const itemObservation=[{serial:10,itemId:4009,color:1,spawn:true}];
// Corrected user observation: white Shura gauntlet on hunt NINE.
const corrected=model.fitObservations(input,[{serial:9,itemId:4009,color:1,spawn:true}],{count:50});
assert.equal(corrected.matches.length,0,'no weight ordering can make an absent special monster drop on hunt 9');
const ninthBaseline=model.predict(input,{count:9,order:'candidateD'})[8];
assert.equal(ninthBaseline.spawn,false,'9th encounter disagrees before reward selection');
assert.equal(ninthBaseline.encounterRoll,825);
const qualified=model.fitObservations(input,itemObservation,{count:30});
assert.equal(qualified.matches.length,24,'10th 4009 white leaves 24 order models in this synthetic example');
const firstGear=model.fitObservations(input,[{...itemObservation[0],noGearBefore:true}],{count:30});
assert.equal(firstGear.matches.length,12,'no earlier gear further constrains the candidate pool');
for(const variant of qualified.matches){
 const row=variant.rows[9];
 assert.equal(row.itemId,4009);assert.equal(row.color,1);
}
const a=model.predict(input,{count:30,order:'descending'});
const b=model.predict(input,{count:30,order:'ascending'});
assert.equal(a.length,30);assert.equal(b.length,30);
assert(!a[9].color||a[9].itemId!==4009||a[9].color!==1);
assert(!b[9].color||b[9].itemId!==4009||b[9].color!==1);
const baseTime=model.predict(input,{count:30,order:'candidateD',time:1795260046});
const futureTime=model.predict(input,{count:30,order:'candidateD',time:1795280046});
assert.deepEqual([...baseTime.map(x=>[x.itemId||null,x.color||null])],
 [...futureTime.map(x=>[x.itemId||null,x.color||null])],
 'Diling gear ID and color must not be keyed to battle-clock time');
assert.equal(baseTime[9].itemId,4009);
assert.equal(baseTime[9].color,1);
assert.equal(baseTime[9].sharedEdsTracked,true);
assert.notEqual(baseTime.final.eds['4009'],save.Rnds.Eds['4009']);
assert.equal(save.Rnds.Eds['4009'],245317680,'original Eds must remain unchanged');
assert.equal(JSON.stringify(save),original);
const html=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/index.html'),'utf8');
const ui=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/wild.js'),'utf8');
for(const id of ['tombForecastRun','tombForecastCount','tombForecastPad','tombForecastOutput','tombForecastCsv','tombEvidenceApply']){
 assert(html.includes('id="'+id+'"'),'missing forecast control '+id);
}
assert(ui.includes('tomb.fitObservations(current,constraints'));
assert(html.includes('aria-label="제릉 세이브 전후 비교" hidden'));
console.log('PASS: corrected ninth hunt has zero valid model candidates; 144 model orders all reject ninth spawn; no fabricated 50-hunt forecast');
