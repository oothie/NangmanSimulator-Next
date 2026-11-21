/* 낭만강호 한국판 세이브의 실제 캐릭터 외형 데이터.
 * 외형은 캐릭터 ID가 아니라 저장된 장착 부위 조합으로 결정된다.
 * Spine 원본 atlas/skel/png가 없을 때 임의 픽셀 이미지로 대체하지 않는다.
 */
(function(root){
 'use strict';
 const appearanceKeys=['ID','Name','Sex','Shape','Body','Color','Face','Eye','Brow','Nose','Mouth',
  'BaseHair','Hair','HairBefore','Hat','Cloth','Shoe','BaseCloth','BaseShoe','BaseBeads',
  'Beads','BeardUp','BeardDown','Pifeng','Glove','Hand','Hulu','Veil','Weapon'];
 const toInt=value=>typeof value==='number'&&Number.isFinite(value)?value:
   typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):null;
 function appearance(role){
  if(!role||typeof role!=='object')return null;
  const out={};
  for(const k of appearanceKeys)if(Object.prototype.hasOwnProperty.call(role,k)){
   const v=k==='Name'?String(role[k]??''):toInt(role[k]);
   if(v!==null)out[k]=v;
  }
  if(out.ID==null)return null;
  out.skeleton=out.Sex===2?'woman':out.Sex===1?'man':null;
  return Object.freeze(out);
 }
 function list(save){
  if(!save||typeof save!=='object')return [];
  const a=[save.MainRole,...(Array.isArray(save.Roles)?save.Roles:Object.values(save.Roles||{})),
    ...(Array.isArray(save.Leavers)?save.Leavers:Object.values(save.Leavers||{}))];
  const seen=new Set;
  return a.map(appearance).filter(x=>{if(!x||seen.has(x.ID))return false;seen.add(x.ID);return true});
 }
 // 실제 인게임 리소스가 로딩된 렌더러만 등록 가능.
 // UI는 등록되지 않은 렌더러를 가짜 캐릭터 이미지로 대체하지 않는다.
 let nativeRenderer=null;
 function setRenderer(fn){if(typeof fn!=='function')throw Error('캐릭터 Spine 렌더러 함수가 필요합니다');nativeRenderer=fn}
 function render(target,role){
  const data=appearance(role);
  if(!data)return Promise.reject(Error('세이브의 캐릭터 외형을 확인할 수 없습니다.'));
  if(!nativeRenderer)return Promise.reject(Error('한국판 인게임 Spine 리소스가 아직 연결되지 않았습니다.'));
  return Promise.resolve(nativeRenderer(target,data));
 }
 root.NangmanCharacterAppearance=Object.freeze({appearance,list,setRenderer,render,appearanceKeys:Object.freeze(appearanceKeys.slice())});
})(typeof window!=='undefined'?window:globalThis);
