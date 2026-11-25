/* Pure synthetic 4-gate original producer + consumer integration regression.
 * Test counters and seeds are invented fixtures, never real player values.
 */
import assert from 'node:assert/strict';
import {replayYanwangfu} from './replay_original_yan.mjs';
import {replayChangok} from './replay_original_dcy.mjs';
import {replayByeokyu} from './replay_original_byj.mjs';
import {replayLiuManor} from './replay_original_liu.mjs';
import {forecastSpecialsFromProducer} from './special_reward_source_engine.mjs';

const fake={Rnds:{Sds:{
 seed_lsby:12345678,seed_byj:2222222,
 seed_33654:3333333,seed_33653:4444444,seed_33652:5555555,seed_33650:6666666,
 seed_dcy_40372:7777777,seed_dcy_40373:8888888,seed_dcy_40374:9999999
}},globalVariable:{
 win_lsby:30,win_byj:30,win_dcy:30,win_ywf:30,roll_35268:0,
 roll_2924_40372:0,roll_2925_40374:0,roll_2926_40373:0
},Branch:{byj_bz:{step:-1}},Items:[]};
const models={'연왕부':replayYanwangfu,'창옥':replayChangok,
 '벽유교':replayByeokyu,'유씨별원':replayLiuManor};
const original=JSON.stringify(fake);
let passed=0;
for(const [gate,producer] of Object.entries(models)){
 const current=forecastSpecialsFromProducer(fake,gate,producer,3,{mode:'current'});
 const unclaimed=forecastSpecialsFromProducer(fake,gate,producer,3,{mode:'unclaimed'});
 assert.equal(current.output.length,3);
 assert.equal(unclaimed.output.length,3);
 assert.equal(current.grants.length,3);
 assert.equal(unclaimed.grants.length,3);
 assert.ok(current.grants.flat().every(row=>row.name&&row.name!=='특수 보상'));
 assert.ok(unclaimed.firstPredicted.every(x=>x.clear>=1&&x.clear<=3));
 assert.equal(JSON.stringify(fake),original);
 passed++;
 console.log('PASS',gate,'RNG producer + original 40-rule consumer');
}
console.log('PASS',passed,'of 4 original gate paths, no visitor save mutation');
