'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'vendor/sanbujin/drops/dungeon.js'),'utf8');
for(const name of ['dungeonAllRun','dungeonAllResults','dungeonAllRounds','dungeonAllStatus','dungeonAllExport']){
 assert(!html.includes(name),'removed whole-boss comparison HTML: '+name);
 assert(!js.includes(name),'removed whole-boss comparison JS: '+name);
}
assert(js.includes("let sequenceRows=[]"),'chronological manual dungeon sequence retained');
assert(js.includes("dungeonSequenceRun"),'original sequence forecast retained');
assert.doesNotThrow(()=>new vm.Script(js),'dungeon JS syntax after panel deletion');
console.log('PASS: removed whole-boss comparison without dangling listeners or damage to sequential dungeon route');
