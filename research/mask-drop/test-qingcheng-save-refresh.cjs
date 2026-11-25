#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {draw}=require('../dungeon-lab/mask-7209-conditional.cjs');
const {localReport}=require('./qingcheng-save-refresh.cjs');
const save=seed=>({Rnds:{Sds:{aidrop70:seed}},Account:'PRIVATE_USER_CANARY'});
let s=173827;
for(let n=0;n<4;n++)s=draw(s,100).seed;
const result=localReport(save(173827),save(s),11);
assert.equal(result.fieldBattles,11);
assert.equal(result.inferredAidrop70Progress,4);
assert.equal(result.level70CallsToConsumeBeforeManhogang,result.nextFirstStageCandidate-1);
assert.equal(result.afterSaveIsBaseline,true);
assert.equal(result.actualMaskDropVerified,false);
assert.match(result.verification,/미검증/);
assert(!JSON.stringify(result).includes('173827'));
assert(!JSON.stringify(result).includes('PRIVATE_USER_CANARY'));
assert.throws(()=>localReport(save(173827),save(s),0),/fieldBattles/);
console.log('PASS privacy-safe CLI two-save workflow and provisional mask candidate refresh');
