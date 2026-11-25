// Deterministic conditional translator; DOES NOT generate game RNG or award native specials.
'use strict';
const evidence=require('./LOW_GATE_REFERENCE_EVIDENCE_20261125.json');
function requireRoll(value,total,name){
 if(!Number.isInteger(value)||value<1||value>total)throw new RangeError(name+' expects integer 1..'+total);
 return value;
}
function weighted(entries,roll,name){
 const total=entries.reduce((n,row)=>n+row[1],0);requireRoll(roll,total,name);
 let pos=0;
 for(const row of entries){pos+=row[1];if(roll<=pos)return row[0];}
 throw Error('weight table exhausted');
}
const bosses=new Map(evidence.in_scope.flatMap(g=>g.bosses.map(b=>[b.npc,{...b,gate:g.gate}])));
function resolve(npc,rolls){
 const boss=bosses.get(Number(npc));if(!boss)throw new RangeError('unmapped NPC: '+npc);
 if(!rolls||typeof rolls!=='object')throw new TypeError('explicit RNG outputs required');
 const lane=weighted(boss.outer,rolls.outer,'outer');
 let item=0,slot=null;
 if(lane==='equip'||lane==='weapon'){
  const pool=boss[lane];if(!pool||pool.ids.length===0)throw Error('missing '+lane+' pool for '+npc);
  const idx=requireRoll(rolls.slot,pool.max,'slot');
  item=pool.ids[idx-1];slot=idx;
 }
 // Some original replay routes unconditionally choose color even on a no-item branch;
 // this conditional translator exposes the requirement instead of advancing unknown seeds.
 const colorRequired=!boss.nested||lane!=='none';
 const color=colorRequired?weighted(boss.color,rolls.color,'color'):0;
 return {gate:boss.gate,npc:Number(npc),sourceBoss:boss.source_boss,lane,slot,itemId:item,
  itemName:item?(lane==='weapon'?boss.weapon.names[slot-1]:boss.equip.names[slot-1]):null,
  color:item?Number(color):0,colorRollConsumed:colorRequired,
  specialDrops:'UNRESOLVED_NATIVE_CONDITIONS',nativeRngPredicted:false};
}
module.exports={resolve,weighted,bosses};
