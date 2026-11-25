#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {safeReport}=require('./run_lower_gate_save_pair.cjs');
const x={Rnds:{Sds:{seed_jxz:100,seed_zjb:200,seed_33888:300,seed_xyl:400,seed_trm:500,seed_tyj:600,seed_kgm:700}},
 globalVariable:{win_jxz:0,win_zjb:0,win_xyl:0,win_trm:0,win_tyj:0,win_kgm:0},
 Equips:[{OnlyID:12345,ID:4402,Color:1}],privateName:'DO_NOT_PRINT'};
const y=structuredClone(x);
y.globalVariable.win_zjb++;y.Rnds.Sds.seed_zjb++;
y.Equips.push({OnlyID:67890,ID:4003,Color:4});
const out=safeReport(x,y);
assert.equal(out.gates.find(r=>r.gate==='추가성').winDelta,1);
assert.equal(out.newCandidateEquipment.length,1);
assert.equal(out.newCandidateEquipment[0].color,'자색');
assert.equal(out.newCandidateEquipment[0].progressedGateCandidates[0].gate,'추가성');
assert.equal(out.futureGameDropsVerified,false);
assert.equal(out.directBossAttributionProven,false);
assert.equal(out.sourcePoolsAreOnlyCandidates,true);
assert.equal(out.privacy,true);
for(const secret of ['12345','67890','DO_NOT_PRINT','seed_zjb:200'])
 assert(!JSON.stringify(out).includes(secret));
assert.deepEqual(x.Equips,[{OnlyID:12345,ID:4402,Color:1}]);
console.log('PASS local 20–80 gate before/after CLI privacy and original source equipment candidate audit');
