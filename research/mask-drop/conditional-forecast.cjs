#!/usr/bin/env node
/* PRIVATE, RESEARCH-ONLY conditional model — NOT a confirmed drop predictor.
 * Run locally: node research/mask-drop/conditional-forecast.cjs /path/to/save.json
 * No account save is uploaded, stored in source, or printed.
 * Source hypothesis (not verified!): lvl70 uses aidrop70, NPC drop [7209,1]
 * is a single favorable 1/100 weighted roll; no additional RNG consumers.
 */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const BOUND=100,MOD48=2n**64n-1n;
function draw(seed,bound){
 if(!Number.isSafeInteger(seed)||seed<=0||!Number.isSafeInteger(bound)||bound<=0)
  throw new Error('Valid positive 32-bit game RNG state and weight required');
 const raw=((BigInt(seed)+BigInt(bound))*245109059551232n+
    48083817484545n)&MOD48;
 const next=Number(((raw>>17n)&2147483647n)%2047483645n)+1;
 return {seed:next,roll:next%bound+1};
}
function conditionalRolls(seed,{bound=BOUND,hit=1,count=2000}={}){
 const wins=[];
 for(let i=1;i<=count;i++){
  const result=draw(seed,bound);seed=result.seed;
  if(result.roll===hit)wins.push(i);
 }
 return {first:wins[0]??null,next:wins.slice(0,10),tested:count,
  source:'HYPOTHESIS_ONLY: original getDropByID branch/weight order unverified'};
}
function reportFile(filename){
 const source=JSON.parse(fs.readFileSync(filename,'utf8'));
 const save=Array.isArray(source)?source[0]:source;
 const seeds=save?.Rnds?.Sds||{};
 const lvl70=seeds.aidrop70;
 const hasSeed=Number.isSafeInteger(lvl70)&&lvl70>0;
 const result=hasSeed?conditionalRolls(lvl70):null;
 return {
  item:'수라가면',npc:'만호강',npcLevel:70,
  prospectiveConfirmed:false,sourceLootPair:'[7209,1]',
  lane:'aidrop70',laneVerifiedAtNPC:false,
  usableLane:hasSeed,scenario:'1 in 100 / one draw per kill (UNVERIFIED)',
  ...(result?{conditionalFirstRoll:result.first,conditionalNextRolls:result.next}:
  {warning:'이 세이브에는 aidrop70 난수가 없어 계산하지 않음'})
 };
}
if(require.main===module){
 const file=process.argv[2];
 if(!file){console.error('Usage: node conditional-forecast.cjs /path/to/local-save.json');
  process.exitCode=2;
 }else console.log(JSON.stringify(reportFile(file),null,2));
}
module.exports={draw,conditionalRolls,reportFile};
