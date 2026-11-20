// 산부진 APK v22 장비 WASM 로컬 실행 브리지.
// yy-sim 세수 WASM과 서로 다른 iframe에 유지하여 전역 이름 충돌을 방지합니다.
// 외부 사이트 / 제3자 서버 호출 없음. 산부진 파일은 vendor/sanbujin/에 자체 보관.
import {equipmentEngine} from './local-engine-bridge.js';
let catalog=null,saveReady=false;
export async function initialize(){
 if(catalog)return catalog;
 const info=await equipmentEngine.call('init');
 catalog={papers:info.papers||[],craftsmen:info.craftsmen||[],specials:info.specials||[]};
 return catalog;
}
export async function injectSave(data){
 if(!catalog)await initialize();
 const result=await equipmentEngine.call('save',data);
 saveReady=true;
 return result;
}
export function hasSave(){return saveReady}
export function listCraftsmen(){return catalog?.craftsmen||[]}
export function listPapers(){return catalog?.papers||[]}
export function makeRequest({paperId,npcId,specialId=0}){
 if(!catalog)throw Error('산부진 계산 엔진이 초기화되지 않았습니다.');
 const paper=catalog.papers.find(x=>String(x.id)===String(paperId));
 const npc=catalog.craftsmen.find(x=>String(x.id)===String(npcId));
 if(!paper||!npc)throw Error('제작 도면과 제작 NPC를 선택하세요.');
 return {
  npc_id:Number(npc.id),select_id:Number(paper.id),
  equip_id:Number(paper.dz_equip),special_id:Number(specialId)||0,
  min_color:Number(paper.min_color??1),max_color:Number(paper.max_color??4)
 };
}
export async function preview(request,count=10){
 if(!saveReady)throw Error('한국판 세이브의 MakeRnd 데이터를 먼저 불러오세요.');
 return equipmentEngine.call('preview',{request,count:Number(count)});
}
export function status(){return {engine:'산부진 APK 로컬 WASM',ready:!!catalog,save:saveReady,source:'vendor/sanbujin/'};}
