/* 개인 브라우저 전용 자동 세수 탐색 기록. 원격 전송 및 기본 샘플 없음. */
(function(){
'use strict';
const DB='nangman-private-wash-search-v1',TABLE='results',ENGINE_REV='all-grade-cost-first-20261127';
function open(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(TABLE))r.result.createObjectStore(TABLE)};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
async function transaction(mode,fn){
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLE,mode),req=fn(tx.objectStore(TABLE));
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  tx.onabort=()=>reject(tx.error);
 })}finally{db.close()}
}
function key(save,role){
 const raw=role?.raw||{};
 if(!save||!role||raw.BornTalent?.S==null)return null;
 return JSON.stringify([save.CenterID??null,role.id,raw.BornTalent.S,raw.BornTalent.RC??null,raw.ZiZhi??null,raw.TalLucky??null,
 (raw.Talents||[]).map(t=>[t.ID,t.Lock===true])]);
}
async function record(save,role,result,options){
 const k=key(save,role);if(!k||!Array.isArray(result?.result?.routes)||!Array.isArray(options?.desiredIds))return;
 const data={key:k,engineRev:ENGINE_REV,desiredIds:[...options.desiredIds],options,result,savedAt:Date.now()};
 await transaction('readwrite',s=>s.put(data,k));
}
async function restore(save,role){
 const k=key(save,role);if(!k)return null;
 const entry=await transaction('readonly',s=>s.get(k));
 return entry?.engineRev===ENGINE_REV?entry:null;
}
async function clear(){return await transaction('readwrite',s=>s.clear())}
window.NangmanSearchCache=Object.freeze({record,restore,clear});
})();
