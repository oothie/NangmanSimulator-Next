// 산부진 APK (用户 제공) 기준 장비 엔진 브리지.
// yy-sim 장비 난수 엔진과 기존 Roboking 장비 계산은 호출하지 않습니다.
// External assets are loaded from the original Sanbujin server until bundled locally.
// Browser-only, simulations are read-only and reset to the loaded save per preview.
const SOURCE='https://tool.launch-ai.cloud/suanbujin/shared/';
const required=[
 'equip_data.js',
 'wasm_data.js',
 'sequence_rules.js',
 'core_glue.js',
];
let ready=null,loadedState=null,originalSave=null,originalTables=null;
function addScript(url){
 return new Promise((resolve,reject)=>{
  const e=document.createElement('script');e.src=url;e.async=false;
  e.onload=resolve;e.onerror=()=>reject(new Error('산부진 계산 파일을 가져오지 못했습니다: '+url));
  document.head.appendChild(e);
 });
}
export async function initialize(){
 if(ready)return ready;
 ready=(async()=>{
  for(const filename of required)await addScript(SOURCE+filename);
  if(typeof EQUIP_DATA!=='object')throw Error('산부진 장비 테이블을 찾지 못했습니다.');
  if(typeof initWasm!=='function'||typeof wasmMakeInitTables!=='function')throw Error('산부진 WASM 함수를 찾지 못했습니다.');
  const ok=await initWasm();
  if(!ok||!wasmMakeInitTables(EQUIP_DATA))throw Error('산부진 장비 계산 엔진 초기화에 실패했습니다.');
  originalTables=EQUIP_DATA;
  return Object.freeze({papers:Object.values(EQUIP_DATA.papers||{}),craftsmen:Object.values(EQUIP_DATA.craftsman||{}),special:Object.values(EQUIP_DATA.special||{})});
 })().catch(e=>{ready=null;throw e});
 return ready;
}
function asRoot(data){return Array.isArray(data)?data[0]:data}
export function injectSave(data){
 const root=asRoot(data);
 const rnd=root?.MakeRnd;
 if(!rnd||!rnd.Seeds||!rnd.IDSeeds)throw Error('한국판 세이브에서 MakeRnd.Seeds / IDSeeds를 확인할 수 없습니다.');
 const st={
  save_version:String(root.DBVersion||''),
  save_channel:String(root.Channel||''),
  Seeds:rnd.Seeds,
  LuckySeeds:rnd.LuckySeeds||{},
  IDSeeds:rnd.IDSeeds||{},
  MakeLucky:rnd.MakeLucky||{},
 };
 if(typeof wasmMakeSetState!=='function'||!wasmMakeSetState(st))throw Error('MakeRnd 상태를 산부진 엔진에 주입하지 못했습니다.');
 loadedState=JSON.parse(JSON.stringify(st));
 originalSave=data;
 return {seedCategories:Object.keys(st.Seeds).length,lucky:Object.keys(st.MakeLucky).length};
}
export function hasSave(){return loadedState!==null}
export function listCraftsmen(){if(!originalTables)return [];return Object.values(originalTables.craftsman)}
export function listPapers(){if(!originalTables)return [];return Object.values(originalTables.papers)}
export function makeRequest({paperId,npcId,specialId=0}){
 if(!originalTables)throw Error('산부진 데이터가 초기화되지 않았습니다.');
 const paper=originalTables.papers[String(paperId)];
 const eq=originalTables.equipment[String(paper?.dz_equip)];
 const npc=originalTables.craftsman[String(npcId)];
 if(!paper||!eq||!npc)throw Error('제작 도면과 NPC가 필요합니다.');
 return {npc_id:Number(npcId),select_id:Number(paperId),equip_id:Number(eq.id),special_id:Number(specialId),min_color:Number(paper.min_color||1),max_color:Number(paper.max_color||4)};
}
export function preview(request,count=10){
 if(!loadedState)throw Error('세이브를 먼저 불러오세요.');
 const n=Math.floor(Number(count));
 if(!Number.isInteger(n)||n<1||n>200)throw Error('미리보기 횟수는 1–200회입니다.');
 if(!wasmMakeSetState(loadedState))throw Error('세이브 시드 재설정에 실패했습니다.');
 let output;
 try{output=wasmMakePreview(request,n);}
 finally{wasmMakeSetState(loadedState);}
 return output;
}
export function reset(){if(loadedState&&typeof wasmMakeSetState==='function')wasmMakeSetState(loadedState);}
export function status(){return {engine:'sanbujin',ready:!!originalTables,save:!!loadedState,source:SOURCE};}
