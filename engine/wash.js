// yy-sim wash WebAssembly bridge. Scripts are loaded lazily and results stay in
// the browser. Until Korean save mapping is verified, only an explicit sandbox
// seed may be used. No account/save data are posted to yy-sim.
let ready=null,initDone=false;
const BASE='./vendor/yysim/';
function script(url){
 return new Promise((resolve,reject)=>{
 const el=document.createElement('script');el.src=url;el.async=false;
 el.onload=resolve;el.onerror=()=>reject(Error('엔진 자산을 불러올 수 없습니다: '+url));
 document.head.appendChild(el);
 });
}
export async function initWash(){
 if(ready)return ready;
 ready=(async()=>{
   for(const path of ['wasm_data.js','core_glue.js','data.js'])await script(BASE+path);
   if(typeof initWasm!=='function'||typeof wasmInitEngine!=='function')throw Error('yy-sim WASM 연결 함수를 찾지 못했습니다.');
   if(!await initWasm())throw Error('WASM 초기화 실패');
   if(!wasmInitEngine(window.TALENT_DATA,window.ZZ_DATA))throw Error('세수 데이터 초기화 실패');
   initDone=true;return wasmGetState();
 })().catch(e=>{ready=null;initDone=false;throw e});
 return ready;
}
export function washState(){return initDone?wasmGetState():null}
export function startWashSandbox({seed,roleId,zizhi=153,sex=1,vip=1}){
 if(!initDone)throw Error('먼저 세수 엔진을 불러오세요.');
 if(!/^\d{1,20}$/.test(String(seed))||!/^\d{1,10}$/.test(String(roleId)))throw Error('유효한 세수 시드와 캐릭터 ID가 필요합니다.');
 const state=wasmGetState();
 if(!state)throw Error('WASM 상태를 가져오지 못했습니다.');
 Object.assign(state,{seed:String(seed),role_id:Number(roleId),zizhi:Number(zizhi),sex:Number(sex),vip:Number(vip),
   talents:[],tal_lucky:0,total_wash:0,total_pills:0,gold_count:0,pity_count:0,exchange_count:0});
 if(!wasmSetState(state))throw Error('세수 상태 설정 실패');
 return wasmGetState();
}
export function wash(count=1){
 if(!initDone)throw Error('WASM 초기화 전입니다.');
 if(!Number.isInteger(count)||count<1||count>100)throw Error('세수 횟수는 1–100회입니다.');
 const result=count===1?wasmDoWash():wasmWashMulti(count);
 if(result==null)throw Error('WASM 계산 실패');
 return {results:Array.isArray(result)?result:[result],state:wasmGetState()};
}
export function previewExchange(count=20){
 if(!initDone)throw Error('세수 엔진이 준비되지 않았습니다.');
 return wasmPreviewExchangePads([],Math.min(100,Math.max(1,Number(count)||20)));
}
