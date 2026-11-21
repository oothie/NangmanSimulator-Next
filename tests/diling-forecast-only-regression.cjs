'use strict';
// Synthetic Diling field prediction fixture: this verifies forecast-only use
// with one save. The two orderings remain unverified hypotheses.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};
vm.createContext(ctx);
for(const file of [
 'vendor/sanbujin/shared/equip_data.js',
 'vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/tomb-core.js'
]){
 vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx,{filename:file});
}
const model=ctx.window.SBJTombDrop;
const save={Rnds:{Sds:{seed_35256:492075794,rollenemy_tomb:1456365169}},
 globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const snapshot=JSON.stringify(save),input=model.open(save);
assert(model.ready(input));
const a=model.predict(input,{count:30,pad:0,order:'descending'});
const b=model.predict(input,{count:30,pad:0,order:'ascending'});
assert.equal(a.length,30);assert.equal(b.length,30);
const expectedAppear=[7,8,10,11,12,20,21,22,27,28];
assert.deepEqual([...a.filter(x=>x.spawn).map(x=>x.serial)],expectedAppear);
assert.deepEqual([...b.filter(x=>x.spawn).map(x=>x.serial)],expectedAppear);
assert.deepEqual([...a.filter(x=>x.color).map(x=>[x.serial,x.itemId,x.color])],[
 [7,4009,2],[8,4809,2],[11,4409,1],[22,4809,1],[27,4409,1]
]);
assert.deepEqual([...b.filter(x=>x.color).map(x=>[x.serial,x.itemId,x.color])],[
 [10,4209,1],[12,4409,3],[20,5409,1],[21,5609,2]
]);
assert.equal(a.final.encounterSeed,b.final.encounterSeed);
assert.notEqual(a.final.equipmentSeed,b.final.equipmentSeed);
assert(a.filter(x=>x.color).every(x=>ctx.EQUIP_DATA.equipment[x.itemId].lv===90));
assert(b.filter(x=>x.color).every(x=>ctx.EQUIP_DATA.equipment[x.itemId].lv===90));
const skipped=model.predict(input,{count:5,pad:10,order:'descending'});
assert.equal(skipped.length,15);
assert(skipped.slice(0,10).every(x=>x.padding));
assert(skipped.slice(10).every(x=>!x.padding));
assert.equal(JSON.stringify(save),snapshot,'forecast must never mutate the one imported save');
const html=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/index.html'),'utf8');
const ui=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/wild.js'),'utf8');
for(const id of ['tombForecastRun','tombForecastCount','tombForecastPad','tombForecastOutput','tombForecastCsv']){
 assert(html.includes('id="'+id+'"'),'missing forecast control '+id);
}
assert(html.includes('id="tombSaveCompare"'));
assert(html.includes('aria-label="제릉 세이브 전후 비교" hidden'),
 'comparison should be hidden in forecast-only interface');
assert(ui.includes("tomb.predict(current,{count,pad,order})"));
console.log('PASS Diling forecast-only: 30 hunt rows; 10 special monsters; both order hypotheses; 90-grade names; padding; no save mutation');
