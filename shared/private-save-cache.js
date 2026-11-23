/* Private per-browser save cache. Only IndexedDB, no network or cloud sync.
 * Same-origin browser profiles are isolated; other visitors cannot access this database.
 * A cache is convenience, not encryption against someone using the same unlocked profile. */
(function(){
'use strict';
const NAME='nangman-local-save-v1',STORE='latest',KEY='save';
function database(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(Error('브라우저가 로컬 저장소를 지원하지 않습니다.'));return}
  const req=indexedDB.open(NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('로컬 저장소 열기 실패'));
 });
}
async function transact(mode,handler){
 const db=await database();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),req=handler(store);
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error('저장소 작업 실패'));
   tx.onabort=()=>reject(tx.error||Error('저장소 작업 중단'));
  });
 }finally{db.close()}
}
function normalize(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('세이브 형식이 올바르지 않습니다.');
 return data;
}
window.NangmanPrivateSave=Object.freeze({
 async read(){const record=await transact('readonly',s=>s.get(KEY));return record&&record.data?record:null},
 async store(data,filename){
  const clean=normalize(data);
  await transact('readwrite',s=>s.put({data:clean,filename:String(filename||'로컬 세이브'),savedAt:Date.now()},KEY));
 },
 async clear(){await transact('readwrite',s=>s.delete(KEY))}
});
})();
