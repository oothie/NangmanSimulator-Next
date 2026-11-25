#!/usr/bin/env node
'use strict';
/* 60014 source-model ONLY. The original client's exact execution conditions
 * and per-battle calls have NOT been verified. Never emit private seed values.
 */
const fs=require('node:fs');
const MASK=(1n<<64n)-1n;
const NPC=Object.freeze({mask:30681,bandit:32950,wolf:34461});
const SOURCE=Object.freeze({item:7209,name:'수라가면',npc:NPC.mask,
 sourceNpcLevel:70,sourceDrop:[7209,1],candidateKey:'aidrop70',
 modelStatus:'conditional; original branch and native 60014 holdout unverified'});
const WEIGHTS=Object.freeze({30681:[1,99],32950:[1,99],34461:[30,50,20]});
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
module.exports={SOURCE,NPC,draw,analyze};
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
