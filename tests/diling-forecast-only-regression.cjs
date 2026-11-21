'use strict';
// Final confirmed user observation: real eighth Diling field hunt versus
// Georyeong soldier dropped white Shura gauntlet (4009). A source-event
// eighth-call match is conditional until event-to-hunt mapping is proven.
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
const all=model.fitObservations(input,[],{count:50});
assert.equal(all.tested,144);
assert.equal(all.matches.length,144);
const eighth=model.fitObservations(input,[{serial:8,itemId:4009,color:1,spawn:true}],{count:50});
assert.equal(eighth.matches.length,12,'only 12 hypothetical Lua orders explain event #8 white 4009');
assert(eighth.matches.every(x=>x.rows[7].itemId===4009&&x.rows[7].color===1));
assert(eighth.matches.every(x=>x.rewardOrder.join(',')==='other,equipment,none'));
const gate=model.traceEncounterCalls(input,10);
assert.equal(gate.encounters[7].spawn,true);
assert.equal(gate.encounters[8].spawn,false);
assert.equal(gate.encounters[7].encounterRoll,538);
const a=model.predict(input,{count:30,pad:0,order:'descending'});
const b=model.predict(input,{count:30,pad:0,order:'ascending'});
assert.equal(a.length,30);assert.equal(b.length,30);
const timeA=model.predict(input,{count:30,order:'candidateD',time:1795260046});
const timeB=model.predict(input,{count:30,order:'candidateD',time:1795280046});
assert.deepEqual([...timeA.map(x=>[x.itemId||null,x.color||null])],
 [...timeB.map(x=>[x.itemId||null,x.color||null])],
 'Diling equipment ID and color do not use clock time');
assert.equal(JSON.stringify(save),original,'predictions must not mutate save');
const html=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/index.html'),'utf8');
const ui=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/wild.js'),'utf8');
for(const id of ['tombForecastRun','tombForecastCount','tombForecastPad','tombForecastOutput','tombForecastCsv','tombEvidenceEighth']){
 assert(html.includes('id="'+id+'"'),'missing forecast control '+id);
}
assert(ui.includes('serial:8,spawn:true,itemId:4009,color:1'));
assert(ui.includes('isOriginal1121(current)'),'evidence fit must be restricted to original 1121 pre-hunt state');
assert(!html.includes('id="tombEvidenceApply"'));
assert(html.includes('aria-label="제릉 세이브 전후 비교" hidden'));
console.log('PASS Diling eighth-hunt conditional 12 models, explicit source-match restriction, clock independence and immutable save');
