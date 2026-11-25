'use strict';
/* Research-only four-gate timeline. Source-model execution, NOT native validation.
 * No saved account data or fixed RNG values are embedded.
 * The source-derived award consumer runs after EACH gate clear, so receipt
 * counters propagate to subsequent clears; reset-once scenarios are not
 * accidentally reapplied for every gate.
 */
const GATES=Object.freeze(['연왕부','창옥','벽유교','유씨별원']);
function createMixedRunner(producers,forecastInterleavedSpecials){
 if(!producers||typeof forecastInterleavedSpecials!=='function')
  throw new TypeError('Missing source-model dependency');
 for(const gate of GATES)
  if(typeof producers[gate]!=='function')
   throw new TypeError('Missing source producer: '+gate);
 return function runMixedFourGates(save,schedule,options={}){
  if(!save||typeof save!=='object'||Array.isArray(save))
   throw new TypeError('Local game save object is required');
  if(!Array.isArray(schedule)||schedule.length<1||schedule.length>40||
     schedule.some(g=>!GATES.includes(g)))
   throw new RangeError('Only 1–40 clears of the four released gates are allowed');
  const claimMode=options.claimMode??'current';
  if(!['current','never_claimed'].includes(claimMode))
   throw new RangeError('Unknown special-ownership scenario');
  const keyTimeline=options.liuKeyTimeline;
  const liuClears=schedule.filter(g=>g==='유씨별원').length;
  if(keyTimeline!=null&&(!Array.isArray(keyTimeline)||
     keyTimeline.length!==liuClears||
     keyTimeline.some(x=>typeof x!=='boolean')))
   throw new RangeError('Key timeline must include one explicit boolean per Liu manor clear');
  const keyMode=options.keyMode??'auto';
  if(!['auto','retain','owned','absent'].includes(keyMode))
   throw new RangeError('Unknown Liu key mode');
  const tempLifetime=options.tempLifetime??'unknown';
  if(!['unknown','persist','reset'].includes(tempLifetime))
   throw new RangeError('Unknown original temporary-variable lifecycle');
  const starting=JSON.stringify(save);
  let state=JSON.parse(starting),temp=options.tempState??null,
      numeric=options.numericState??null;
  let unresolved=0,liuIndex=0;
  const runs=[],counts=Object.fromEntries(GATES.map(g=>[g,0]));
  for(const gate of schedule){
   counts[gate]++;
   let perClearKey=keyMode;
   if(gate==='유씨별원'&&keyTimeline!=null)
    perClearKey=keyTimeline[liuIndex++]?'owned':'absent';
   const result=forecastInterleavedSpecials(state,gate,producers[gate],1,{
    // Never-claimed clears existing receipts just ONCE, at the first clear.
    mode:runs.length===0?claimMode:'current',
    keyMode:perClearKey,
    tempState:temp,numericState:numeric,
    numericAfterGrant:'unknown',tempLifetime,
    applyUnverifiedWhaleForwardReceipts:false
   });
   if(result.incomplete||result.rows.length!==1)
    throw new Error('Source-model timeline incomplete at '+gate+' clear '+counts[gate]);
   const played=result.rows[0];
   if(played.producer.results.length!==(
      gate==='연왕부'?4:3))
    throw new Error('Incomplete source boss outcomes at '+gate);
   const equipment=played.producer.results.map(row=>({
    boss:row.boss,itemId:row.itemId??null,
    name:row.name,grade:row.itemId==null?'':row.grade??'',
    gradeCode:row.itemId==null?0:row.gradeCode,
    // Raw grade draw is retained even for a miss (BYJ/LSBY consume it).
    rolledGradeCode:row.gradeCode??null
   }));
   const grants=played.grants.map(x=>({
    npc:x.npc,itemId:x.itemId,name:x.name,
    predicted:x.predicted===true,unresolved:x.unresolved===true,
    sourceArchive:x.sourceArchive
   }));
   unresolved+=played.unresolved;
   runs.push({gate,clear:counts[gate],drawCount:played.producer.drawCount,
    equipment,grants,unresolved:played.unresolved,
    keyState:played.producer.keyState??null,
    ...(options.includePrivateTrace===true?{privateRngTrace:played.producer.rngTrace}: {})});
   state=result.nextState;temp=result.tempState;numeric=result.numericState;
  }
  if(JSON.stringify(save)!==starting)
   throw new Error('Source-model input save unexpectedly mutated');
  // Account-dependent seeds/identifiers are returned in-memory only when
  // explicitly requested for private local after-save comparison.
  const summary={runs,counts,unresolved,conditional:true,
   status:unresolved?'original consumer constraints unresolved':
    'source-model replay; future native game accuracy not independently proved'};
  if(options.includePrivateState===true)
   summary.privateNextState=state;
  return summary;
 };
}
module.exports={GATES,createMixedRunner};
