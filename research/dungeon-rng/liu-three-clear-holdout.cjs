'use strict';
// Research validation. Uses user-supplied saves LOCALLY; never writes or uploads them.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const POOLS={'윤무':[5609,5409,5009],'고리':[4809,5209,5609,5409],'이뢰운':[4609,4409,4209,4009]};
const COLORS={'백색':1,'녹색':2,'청색':3,'자색':4};
const NPC={'윤무':35260,'고리':35264,'이뢰운':35268};
function validate(before,after,forecast){
 const rows=forecast.runs.filter(r=>r.dungeon==='유씨별원');
 assert.deepEqual(rows.map(r=>r.run),[1,2,3]);
 assert.equal(after.globalVariable.win_lsby-before.globalVariable.win_lsby,3);
 const prediction=[];
 for(const row of rows)for(const boss of Object.keys(POOLS)){
  const event=row.bosses[boss];
  if(event.slot!==null&&event.slot!==undefined){
   const id=POOLS[boss][event.slot-1];
   if(!id || !COLORS[event.grade])throw Error('Invalid source pool/index/grade');
   prediction.push({run:row.run,boss,id,color:COLORS[event.grade]});
  }
 }
 const old=new Set(before.Equips.map(e=>e.OnlyID));
 const new90=after.Equips.filter(e=>!old.has(e.OnlyID)&&Number.isInteger(e.ID)&&
   e.ID>=4000&&e.ID<6000&&e.ID%100===9).sort((a,b)=>a.OnlyID-b.OnlyID);
 const target=prediction.map(r=>r.id+':'+r.color);
 const actual=new90.map(e=>e.ID+':'+e.Color);
 const matches=[];
 for(let i=0;i+target.length<=actual.length;i++){
  if(target.every((v,j)=>v===actual[i+j])){
   const slice=new90.slice(i,i+target.length),start=slice[0].OnlyID;
   matches.push({startIndex:i,consecutiveIdentifiers:slice.every((e,j)=>e.OnlyID===start+j)});
  }
 }
 const last=rows[2];
 const slotCodes={},qualityCodes={};
 for(const boss of Object.keys(POOLS)){
  const ev=last.bosses[boss],n=NPC[boss];
  slotCodes[boss]=(after.globalVariable['drop_'+n+'_equip']??null)===(ev.slot??null);
  qualityCodes[boss]=after.globalVariable['drop_'+n+'_color']===COLORS[ev.grade_roll_only];
 }
 const endSeedMatched=last.seed_after===after.Rnds.Sds.seed_lsby;
 return {clears:3,new90InPair:new90.length,compared:target.length,
  identicalContiguousMatches:matches.length,matches,
  lastBossSlotCodes:slotCodes,lastBossQualityCodes:qualityCodes,endSeedMatched,
  predictedEquipment:prediction,
  caution:'Inventory-only contiguous evidence; does not separately prove which boss created every item.'};
}
if(require.main===module){
 const args=process.argv.slice(2);
 if(args.length!==3){console.error('Usage: node liu-three-clear-holdout.cjs BEFORE.json AFTER.json PREEXISTING_FORECAST.json');process.exit(2)}
 const [a,b,forecast]=args.map(file=>JSON.parse(fs.readFileSync(file,'utf8')));
 const result=validate(a,b,forecast);
 assert.equal(result.identicalContiguousMatches,1);
 assert.equal(result.matches[0].consecutiveIdentifiers,true);
 assert.equal(result.endSeedMatched,true);
 assert.ok(Object.values(result.lastBossSlotCodes).every(Boolean));
 assert.ok(Object.values(result.lastBossQualityCodes).every(Boolean));
 console.log(JSON.stringify(result,null,2));
}
module.exports={validate};
