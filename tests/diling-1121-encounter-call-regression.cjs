'use strict';
// Source-gate audit for the 2026-11-21 observed Diling field discrepancy.
// This contains ONLY the required RNG seeds/flags from 1121.json, not user
// account or character data. 9th real outdoor hunt gave white Shura(4009).
// A simulated 35255 conditional event call is NOT a real field-hunt counter.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),ctx={window:{}};vm.createContext(ctx);
for(const p of ['vendor/sanbujin/drops/wild-core.js',
 'vendor/sanbujin/drops/tomb-core.js'])
 vm.runInContext(fs.readFileSync(path.join(base,p),'utf8'),ctx,{filename:p});
const model=ctx.window.SBJTombDrop;
const before={Rnds:{Sds:{rollenemy_tomb:1456365169,seed_35256:492075794}},
 globalVariable:{eat_2659:9,rollenemy_tomb2:200}};
const copy=JSON.stringify(before),state=model.open(before);
assert(model.ready(state));
const trace=model.traceEncounterCalls(state,50);
assert.equal(trace.units,'35255_event_calls_not_field_battles');
assert.equal(trace.encounters.length,50);
assert.equal(trace.encounters[8].call,9);
assert.equal(trace.encounters[8].encounterRoll,825);
assert.equal(trace.encounters[8].effectiveRoll,735);
assert.equal(trace.encounters[8].thresholdBefore,400);
assert.equal(trace.encounters[8].spawn,false);
assert.equal(trace.encounters[9].call,10);
assert.equal(trace.encounters[9].encounterRoll,280);
assert.equal(trace.encounters[9].spawn,true);
assert.equal(trace.encounters.filter(x=>x.spawn).length,17);
const observed=model.fitObservations(state,[{serial:9,spawn:true,itemId:4009,color:1}],{count:50});
assert.equal(observed.tested,144);
assert.equal(observed.matches.length,0,'reward sorting cannot solve missing special encounter at call 9');
assert.equal(JSON.stringify(before),copy,'diagnostics must not mutate the save');
const ui=fs.readFileSync(path.join(base,'vendor/sanbujin/drops/index.html'),'utf8');
assert(ui.includes('id="tombGateRun"'));
assert(ui.includes('35255'));
console.log('PASS Diling: source event call 9 rejects spawn, call 10 spawns; real hunt 9 mismatches; no invented offset or false 50-hunt guarantee');
