/* Exact inversion of the Sanbujin/Whale RNG state update.
 * Forensics only: returns ALL possible prior seeds for a known next seed
 * and draw bound. Does not assume that every recorded after-save change
 * resulted solely from the modeled dungeon. No personal save data. */
(function(root){
'use strict';
const MASK32=(1n<<32n)-1n, MASK64=(1n<<64n)-1n;
const MAX_SEED=2047483645n;
const A=245109059551232n,B=48083817484545n,K=A>>16n,C=B>>16n;
let inverse=K;
for(let i=0;i<6;i++)inverse=(inverse*(2n-K*inverse))&MASK32;
function draw(seed,bound){
 const s=BigInt(seed),n=BigInt(bound);
 if(s<=0n||s>MAX_SEED||n<=0n)throw Error('시드 또는 RNG 범위가 잘못되었습니다');
 const raw=((s+n)*A+B)&MASK64;
 const next=(((raw>>17n)&2147483647n)%MAX_SEED)+1n;
 return {seed:Number(next),value:Number(next%n)+1};
}
function previous(nextSeed,bound){
 const target=BigInt(nextSeed),n=BigInt(bound);
 if(target<=0n||target>MAX_SEED||n<=0n)return [];
 const result=new Set();
 for(const offset of [0n,MAX_SEED]){
  const output=target-1n+offset;
  if(output>2147483647n)continue;
  for(const parity of [0n,1n]){
   const shifted=((output*2n+parity-C)*inverse)&MASK32;
   const candidate=(shifted-n)&MASK32;
   if(candidate<=0n||candidate>MAX_SEED)continue;
   const before=Number(candidate);
   if(draw(before,bound).seed===Number(target))result.add(before);
  }
 }
 return [...result].sort((a,b)=>a-b);
}
function reverseSteps(finalSeed,steps,maxStates=20000){
 let states=[{seed:Number(finalSeed),trace:[]}],truncated=false;
 for(let i=steps.length-1;i>=0;i--){
  const step=steps[i],next=[];
  for(const state of states){
   for(const before of previous(state.seed,step.bound)){
    const hit=draw(before,step.bound);
    if(step.value!=null&&Number(step.value)!==hit.value)continue;
    if(step.minValue!=null&&hit.value<Number(step.minValue))continue;
    if(step.maxValue!=null&&hit.value>Number(step.maxValue))continue;
    next.push({seed:before,trace:[{label:step.label||'RNG',bound:step.bound,
     before,after:state.seed,value:hit.value},...state.trace]});
    if(next.length>=maxStates){truncated=true;break}
   }
   if(truncated)break;
  }
  states=next;
  if(!states.length||truncated)break;
 }
 return {candidates:states,truncated};
}
root.SBJDungeonV3ReverseExact={draw,previous,reverseSteps};
})(window);
