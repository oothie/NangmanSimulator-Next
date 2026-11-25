#!/usr/bin/env node
'use strict';
/* 60014 source-model ONLY. The original client's exact execution conditions
 * and per-battle calls have NOT been verified. Never emit private seed values.
 */
const fs=require('node:fs');
const MASK=(1n<<64n)-1n;
const NPC=Object.freeze({mask:30681,bandit:32950});
const SOURCE=Object.freeze({item:7209,name:'수라가면',npc:NPC.mask,
 sourceNpcLevel:70,sourceDrop:[7209,1],candidateKey:'aidrop70',
 modelStatus:'conditional; original branch and native 60014 holdout unverified'});
// Only these two of the 146 level-70 NPC rows have a direct char_data.drop
// field in Korean 60014. The trailing 99 and one-draw interpretation are
// solely a scenario, NOT a recovered LuaJIT source weight table.
const WEIGHTS=Object.freeze({30681:[1,99],32950:[1,99]});
const LEVEL70_SOURCE=Object.freeze({
 totalNpcRows:146,explicitDropRows:2,otherWithoutDirectDrop:144,
 sameNameAlternateNpc:Object.freeze({npc:35125,name:'만호강',level:70,directDrop:false}),
 rows:Object.freeze([
  Object.freeze({npc:30681,name:'만호강',level:70,drop:Object.freeze([7209,1])}),
  Object.freeze({npc:32950,name:'산적',level:70,drop:Object.freeze([3031,1])})
 ]),
 origin:'Korean 60014 char_data; static config, not confirmed battle RNG'
});
function draw(seed,bound=100){
 const current=BigInt(seed),total=BigInt(bound);
 if(current<=0n||total<=0n)throw RangeError('Explicit positive seed and bound required');
 const x=((current+total)*245109059551232n+48083817484545n)&MASK;
 const raw=(x>>17n)&2147483647n;
 const next=Number((raw%2047483645n)+1n);
 return {seed:next,value:next%bound+1};
}
function analyze(save,{limit=20000,schedule=null}={}){
 const raw=save?.Rnds?.Sds?.aidrop70;
 if(raw===undefined||raw===null||raw===''||
    !Number.isSafeInteger(Number(raw))||Number(raw)<=0)
  throw Error('Save lacks aidrop70; never fabricate a seed');
 if(!Number.isSafeInteger(limit)||limit<1||limit>200000)
  throw RangeError('Invalid scan horizon');
 if(schedule!==null&&(!Array.isArray(schedule)||schedule.length>limit||
    schedule.some(id=>!Object.hasOwn(WEIGHTS,String(id)))))
  throw RangeError('Only a supported explicit candidate NPC sequence is allowed');
 const events=schedule??Array(limit).fill(NPC.mask);
 let seed=Number(raw),draws=0;
 const hits=[],firstSuccesses=[];
 for(const npc of events){
  const next=draw(seed,100);seed=next.seed;draws++;
  if(next.value<=WEIGHTS[npc][0]){
   if(firstSuccesses.length<15)firstSuccesses.push({draw:draws,npc});
   if(npc===NPC.mask){hits.push(draws);if(hits.length>=5)break}
  }
 }
 return {source:SOURCE,mode:schedule?'explicit-interleaving':'30681-only',
  firstFiveMaskCandidateDraws:hits,otherOrMaskSuccesses:firstSuccesses,
  assumptions:[
   'Every eligible NPC battle consumes one aidrop70 draw, without extra draws before this check',
   'NPC 30681 weight 1 is interpreted against a 100-wide pool with no dynamic modifiers',
   'No other aidrop70 consumers have intervened since this save',
   'The native 60014 combat branch follows the source-model candidate'
  ]};
}
// Compare source-compatible alternative RNG branch counts without inventing
// a native branch choice. One masked target encounter can consume 0, 1 or 2
// conditional aidrop70 calls. Scenarios are NOT predictions of inventory loot.
function analyzeAlternativeBranches(save,{sequence,branches=[0,1,2],bound=100,hitValue=1}={}){
 if(!Array.isArray(sequence)||sequence.length<1||sequence.length>20000||
   sequence.some(id=>!Object.hasOwn(WEIGHTS,String(id))))
  throw new RangeError('Use an explicit sequence of source-confirmed level-70 direct-drop NPCs');
 if(!Array.isArray(branches)||!branches.length||branches.some(n=>
   !Number.isInteger(n)||n<0||n>2))
  throw new RangeError('Branch call counts must be 0, 1 or 2');
 if(!Number.isSafeInteger(bound)||bound<1||bound>100000||
    !Number.isSafeInteger(hitValue)||hitValue<1||hitValue>bound)
  throw new RangeError('Invalid hypothetical weighted pool');
 const raw=save?.Rnds?.Sds?.aidrop70;
 if(!Number.isSafeInteger(Number(raw))||Number(raw)<=0)
  throw new Error('Save lacks aidrop70; do not fabricate RNG state');
 const states=[];
 for(const callCount of [...new Set(branches)]){
  let seed=Number(raw),draws=0;
  const candidates=[];
  for(let i=0;i<sequence.length;i++){
   let hit=false;
   for(let j=0;j<callCount;j++){
    const roll=draw(seed,bound);seed=roll.seed;draws++;
    if(j===callCount-1&&roll.value===hitValue)hit=true;
   }
   if(hit&&sequence[i]===NPC.mask)candidates.push(i+1);
  }
  states.push({callsPerBattle:callCount,drawCount:draws,
   firstMaskCandidateBattle:candidates[0]??null,
   candidateBattles:candidates.slice(0,10)});
 }
 return {item:'수라가면',sourceNpc:NPC.mask,candidateLane:'aidrop70',
  sourceRows:LEVEL70_SOURCE.rows.map(({npc,name,drop})=>({npc,name,drop})),
  nativeProven:false,interpretation:'alternative unresolved branch execution models only',
  states};
}
module.exports={SOURCE,NPC,LEVEL70_SOURCE,draw,analyze,analyzeAlternativeBranches};
if(require.main===module){
 const name=process.argv[2];
 if(!name){console.error('usage: node mask-7209-conditional.cjs <LOCAL-save.json>');process.exitCode=2}
 else{
  const result=analyze(JSON.parse(fs.readFileSync(name,'utf8')),{limit:10000});
  console.log('수라가면 조건부 드랍 모델 · 실게임 확정 아님');
  console.log('100칸 가중치1 후보 호출:',result.firstFiveMaskCandidateDraws.join(', '));
  console.log('다른 70레벨 전투 및 실제 분기 차이에 따라 회차가 달라집니다.');
 }
}
