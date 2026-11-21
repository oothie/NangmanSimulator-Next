/* 한국판 save.json -> 실제 인게임 외형 조립 입력 데이터.
 * 저장값 외의 의상/머리/얼굴 이미지를 추정하거나 생성하지 않는다.
 * 렌더러는 검증된 한국판 Spine + atlas + PNG가 확보된 경우에만 동작한다.
 */
(function(root){
 'use strict';
 const slots=['ID','Name','Sex','Shape','Body','Color','Face','Eye','Brow','Nose','Mouth',
  'BaseHair','Hair','HairBefore','Hat','Cloth','Shoe','BaseCloth','BaseShoe','BaseBeads',
  'Beads','BeardUp','BeardDown','Pifeng','Glove','Hand','Hulu','Veil','Weapon'];
 const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:
  typeof v==='string'&&/^-?\d+$/.test(v)?Number(v):null;
 function color(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const out={};
  for(const k of ['b','s','c']){const n=numeric(value[k]);if(n!==null)out[k]=n}
  return Object.keys(out).length?Object.freeze(out):null;
 }
 function appearance(role){
  if(!role||typeof role!=='object'||Array.isArray(role))return null;
  const out={};
  for(const k of slots){
   if(!Object.prototype.hasOwnProperty.call(role,k))continue;
   const v=k==='Name'?String(role[k]??''):k==='Color'?color(role[k]):numeric(role[k]);
   if(v!==null)out[k]=v;
  }
  if(out.ID===undefined)return null;
  out.skeleton=out.Sex===2?'woman':out.Sex===1?'man':null;
  return Object.freeze(out);
 }
 function list(save){
  if(!save||typeof save!=='object')return [];
  const collect=x=>Array.isArray(x)?x:x&&typeof x==='object'?Object.values(x):[];
  const seen=new Set();
  return [save.MainRole,...collect(save.Roles),...collect(save.Leavers)].map(appearance).filter(x=>{
   if(!x||seen.has(String(x.ID)))return false;
   seen.add(String(x.ID));return true;
  });
 }
 // 진단용 누락 리소스 목록. 실제 위치 존재를 보증하지 않음.
 function requiredAssets(data){
  const a=data&&data.skeleton?data:appearance(data);
  if(!a?.skeleton)return [];
  const base='res/hero/'+a.skeleton+'/';
  const resources=[base+'NST_20160621.skel',base+'NST_20160621.atlas',base+'NST_20160621.png',
   base+'face_'+a.skeleton+'.atlas',base+'face_'+a.skeleton+'.png',
   base+'hair_'+a.skeleton+'.atlas',base+'hair_'+a.skeleton+'.png'];
  for(const value of [a.Cloth,a.BaseCloth]){
   if(Number.isInteger(value)&&value>0)resources.push(base+'clothes_'+value+'.atlas',base+'clothes_'+value+'.png');
  }
  return Array.from(new Set(resources));
 }
 let renderer=null;
 function setRenderer(fn){if(typeof fn!=='function')throw Error('한국판 Spine 렌더러 함수가 필요합니다');renderer=fn}
 function hasRenderer(){return !!renderer}
 function render(target,role){
  const data=appearance(role);
  if(!data)return Promise.reject(Error('세이브의 캐릭터 외형 정보를 찾을 수 없습니다.'));
  if(!renderer)return Promise.reject(Error('한국판 게임 Spine·atlas·PNG 리소스가 아직 연결되지 않았습니다.'));
  return Promise.resolve(renderer(target,data));
 }
 root.NangmanCharacterAppearance=Object.freeze({appearance,list,requiredAssets,setRenderer,hasRenderer,render,
  appearanceKeys:Object.freeze(slots.slice())});
})(typeof window!=='undefined'?window:globalThis);
