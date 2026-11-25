#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {draw,NPC}=require('../dungeon-lab/mask-7209-conditional.cjs');
const {calibrate,inferEvent}=require('./calibrate-level70.cjs');
const f=(x,other=10)=>({Rnds:{Sds:{aidrop70:x,unrelated:other}}});
const a=173827,b=draw(a,100).seed,c=draw(b,100).seed;
const events=[
 {npc:NPC.mask,before:f(a),after:f(b),outcome:'none'},
 {npc:NPC.bandit,before:f(b),after:f(c),outcome:'other'},
 {npc:NPC.mask,before:f(c),after:f(c),outcome:'none'}
];
const result=calibrate(events);
assert.equal(result.events,3);
assert.deepEqual(result.sequenceContinuity,{contiguousPairs:2,brokenPairs:0,unusablePairs:0});
assert.equal(result.continuousScheduleProven,true);
assert.equal(result.perNPC[0].laneChanged,1);
assert.equal(result.perNPC[0].laneUnchanged,1);
assert.equal(result.perNPC[1].laneChanged,1);
assert.match(result.sharedLaneEvidence,/두 NPC 모두/);
assert.equal(result.exactFirstDropPredictionAllowed,false);
assert.equal(result.nativeWeightTableVerified,false);
assert.equal(result.privateInputsReported,false);
assert(!JSON.stringify(result).includes(String(a)));
assert(!JSON.stringify(result).includes(String(b)));
const broken=calibrate([
 {npc:NPC.mask,before:f(a),after:f(b)},
 {npc:NPC.bandit,before:f(a),after:f(c)}
]);
assert.equal(broken.sequenceContinuity.brokenPairs,1);
assert.equal(broken.continuousScheduleProven,false);
const missing=calibrate([
 {npc:NPC.mask,before:f(a),after:{Rnds:{Sds:{}}}},
 {npc:NPC.bandit,before:f(b),after:f(c)}
]);
assert.equal(missing.sequenceContinuity.unusablePairs,1);
assert.equal(missing.continuousScheduleProven,false);
const gap=inferEvent({npc:NPC.mask,before:f(a),after:f(c)},{bounds:[100],maxCalls:3});
assert(gap.matchingModels.some(x=>x.calls===2&&x.bound===100));
const altered=calibrate([{npc:NPC.bandit,before:f(a),after:f(a,11)}]);
assert.equal(altered.perNPC[1].laneUnchanged,1);
assert.equal(altered.perNPC[1].laneChanged,0);
assert.throws(()=>calibrate([{npc:35125,before:f(a),after:f(b)}]),/NPC/);
assert.throws(()=>calibrate(events,{bounds:[0]}),/window/);
assert.throws(()=>calibrate([]),/observations/);
console.log('PASS controlled multi-encounter level70 mask lane calibration — synthetic fixtures only');
