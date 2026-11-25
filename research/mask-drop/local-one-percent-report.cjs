#!/usr/bin/env node
'use strict';
/**
 * Local-only CLI wrapper for the 60014 first-stage 1% hypothesis.
 * Do not commit a game save or a manifest. Returns ONLY positions of
 * hypothetical first-stage 7209 rolls, not any raw game/account state.
 */
const fs=require('node:fs');
const {replay,compareScenarios,TYPES}=require('./replay-one-percent-prior.cjs');
function parseLocalSave(filename){
 const data=JSON.parse(fs.readFileSync(filename,'utf8'));
 return Array.isArray(data)?data[0]:data;
}
function reportLocal(save,{maskKills=2000,events=null}={}){
 if(!Number.isSafeInteger(maskKills)||maskKills<1||maskKills>100000)
  throw RangeError('Expected 1..100000 mask kills');
 const schedule=events===null?Array(maskKills).fill(TYPES.MASK):events;
 const models=compareScenarios(save,schedule);
 return {
  resultType:'HYPOTHETICAL_FIRST_STAGE_CANDIDATES_NOT_CONFIRMED_DROP',
  item:'수라가면',npc:'만호강',
  modelPrior:'PC74 1/100 favored, PC96 branch unresolved',
  scenarios:models.map(x=>({
   branch:x.secondStageHypothesis,
   firstFive:x.firstStageMaskCandidates.slice(0,5).map(z=>({
    maskKill:z.maskKillNumber,combinedEncounter:z.sequencePosition
   })),
   extraCalls:x.secondStageCalls,maskKills:x.maskBattles,
   otherLevel70Encounters:x.banditBattles
  })),
  exactDropPredictionAllowed:false,privateInputsReported:false,
  notice:'Only assumes explicit encounters. No invisible level-70 battles or story drops can be reconstructed from one saved state.'
 };
}
if(require.main===module){
 const file=process.argv[2];
 if(!file){console.error('Usage: node local-one-percent-report.cjs LOCAL_SAVE.json [MASK_KILLS]');process.exitCode=2}
 else {
  try {
   const max=process.argv[3]===undefined?2000:Number(process.argv[3]);
   console.log(JSON.stringify(reportLocal(parseLocalSave(file),{maskKills:max}),null,2));
  } catch(err) {console.error('Local model failed: invalid or inaccessible input; no paths or save data displayed');process.exitCode=1}
 }
}
module.exports={reportLocal,parseLocalSave};
