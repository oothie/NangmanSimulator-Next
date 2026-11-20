// yy-sim 원본 세수 WASM - 완전 로컬, 독립 iframe. 한국판 세이브 시드 매핑 검증 중.
import {washEngine} from './local-engine-bridge.js';
let ready=false;
export async function initWash(){
 if(!ready){await washEngine.call('init');ready=true}
 return washEngine.call('state');
}
export async function washState(){await initWash();return washEngine.call('state')}
export async function startWashSandbox({seed,roleId,zizhi=153,sex=1,vip=1}){
 if(!/^\d{1,20}$/.test(String(seed)))throw Error('세수 시드를 숫자로 입력하세요.');
 if(!/^\d{1,10}$/.test(String(roleId)))throw Error('유효한 캐릭터 ID가 필요합니다.');
 const existing=await washState();
 if(!existing)throw Error('세수 WASM 상태를 가져올 수 없습니다.');
 const fresh={...existing,mode:'random',seed:String(seed),role_id:Number(roleId),zizhi:Number(zizhi),sex:Number(sex),vip:Number(vip),talents:[],tal_lucky:0,total_wash:0,total_pills:0,gold_count:0,pity_count:0,exchange_count:0};
 return washEngine.call('set-state',fresh);
}
export async function wash(count=1){
 if(!ready)throw Error('세수 WASM을 먼저 초기화하세요.');
 const n=Number(count);if(!Number.isInteger(n)||n<1||n>100)throw Error('세수 횟수는 1~100회');
 return washEngine.call('wash',{count:n});
}
export function isReady(){return ready}
