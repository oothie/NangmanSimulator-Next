'use strict';
const assert=require('node:assert/strict');
const {checkRegister,loadDefault,tableOrder,staticWeights,selectVerifiedEffect,evaluateBossWithRolls,lookupAward}=require('./source-gated-drop.cjs');
const db=loadDefault();
assert.deepEqual(checkRegister(db),{consumers:30,totalTables:60,sourceTyped:34,awaitingOriginalBytecode:26});
let effects=0,eligible=0,blocked=0,slotLimited=0,seedExceptions=0;
for(const c of db.consumers){
 const [eq,color]=['equip','color'].map(x=>c.tables.find(t=>t.kind===x));
 if(!eq.keyTypesVerified){
  blocked++;
  assert.equal(tableOrder(eq).status,'blocked');
  assert.equal(tableOrder(color).status,'blocked');
  assert.equal(evaluateBossWithRolls(db,c.gate,c.mode,c.grantNpc,{equipRoll:1,slotRoll:1,colorRoll:1}).status,'blocked');
  continue;
 }
 eligible++;
 assert.equal(tableOrder(eq).status,'conditional-model');
 assert.equal(tableOrder(color).status,'conditional-model');
 for(const t of c.tables){
  assert.equal(staticWeights(t).status,'known-static-weights');
  for(const [key,eff] of Object.entries(t.originalBytecodeBranchEffects)){
   effects++;
   assert.ok(t.modelPairsOrder.includes(key));
   assert.equal(eff.stateNpc,c.rngNpc);
   if(eff.effect==='color')assert.ok([1,2,3,4].includes(eff.grade));
   if(eff.effect==='equip-slot'){
    if(eff.slotSeed!==eq.seed){
      assert.equal(c.gate,'문향교');assert.equal(c.grantNpc,50111);
      assert.equal(eq.seed,'seed_dcy_50111');assert.equal(eff.slotSeed,'seed_wxj_50111');seedExceptions++;
    }
    assert.ok(eff.maxSlot<=c.equipmentIds.length);
    if(eff.maxSlot<c.equipmentIds.length)slotLimited++;
   }
  }
 }
 const eweights=staticWeights(eq).weights;
 const max=Object.values(eweights).reduce((a,b)=>a+b,0);
 let draw=null,effect=null;
 for(let i=1;i<=max;i++){
  const result=selectVerifiedEffect(eq,eweights,i);
  if(result.effect.effect==='equip-slot'){draw=i;effect=result.effect;break}
 }
 assert.ok(draw!==null);
 const colored=evaluateBossWithRolls(db,c.gate,c.mode,c.grantNpc,{equipRoll:draw,slotRoll:1,colorRoll:1});
 assert.equal(colored.status,'conditional-original-branch-model');
 assert.equal(colored.itemId,c.equipmentIds[0]);
 assert.equal(colored.originalSlotUpperBound,effect.maxSlot);
 assert.ok(colored.grade>=1&&colored.grade<=4);
 assert.equal(colored.rngNpc,c.rngNpc);
 const missing=selectVerifiedEffect(eq,eweights,max);
 assert.equal(missing.effect.effect,'no-drop');
 assert.equal(evaluateBossWithRolls(db,c.gate,c.mode,c.grantNpc,{equipRoll:max,slotRoll:1,colorRoll:1}).status,'conditional-no-drop');
}
assert.equal(eligible,17);assert.equal(blocked,13);assert.equal(effects,102);assert.equal(slotLimited,1);assert.equal(seedExceptions,1);
const exception=db.consumers.find(c=>c.grantNpc===35221);
assert.equal(exception.equipmentIds.length,9);
assert.equal(exception.tables[0].originalBytecodeBranchEffects['s:50 '].maxSlot,4);
assert.equal(lookupAward(db,'무신전','절세',35600,2,3).rngNpc,35603);
assert.equal(lookupAward(db,'문향교','일반',50101,1,1).rngNpc,50100);
console.log(JSON.stringify({originalConsumerPools:30,typedBranchTables:34,verifiedActions:effects,modelExecutableBosses:eligible,blockedUnverifiedBosses:blocked,provenSlotRangeLimitExceptions:slotLimited,originalSeedMismatchExceptions:seedExceptions,tests:'PASS'},null,2));