/* Character appearance: save-bound, read-only, manifest-driven sprite compositor.
   No generic character stand-ins; assets must come from verified game extraction. */
(function(global){
'use strict';
const defaultManifests=['assets/character/manifest.json','assets/appearance/manifest.json'];
let manifest=null,manifestPromise=null;
const validPath=p=>typeof p==='string'&&!/^(?:javascript:|data:|blob:)/i.test(p)&&!p.includes('..')&&(/^(?:https:\/\/|\/|assets\/|heads\/|full\/)/i.test(p));
function safePath(p){return validPath(p)?p:null;}
function choose(raw,names){for(const k of names){const v=raw?.[k];if(v!==undefined&&v!==null&&v!==''&&typeof v!=='object')return String(v);}return null;}
function specimen(role){
 const raw=role?.raw||role||{};
 const id=choose(raw,['ID','Id','id'])||String(role?.id||'');
 return {id,sex:choose(raw,['Sex','Gender','sex','gender']),head:choose(raw,['Head','HeadID','HeadId','head','headId','TouXiang','FaceId']),hair:choose(raw,['Hair','HairID','HairId','hair','hairId']),body:choose(raw,['Body','BodyID','BodyId','body','bodyId']),dress:choose(raw,['Fashion','FashionID','FashionId','Cloth','ClothID','ClothId','Costume','SkinID','SkinId','fashion']),hat:choose(raw,['Hat','HatID','HatId','hat','hatId']),weapon:choose(raw,['Weapon','WeaponID','WeaponId','weapon','weaponId'])};
}
function matching(obj,...keys){for(const k of keys){if(k!=null&&obj&&Object.prototype.hasOwnProperty.call(obj,k))return obj[k];}return null;}
function normalizeLayer(layer,root){
 if(typeof layer==='string')layer={src:layer};
 if(!layer||typeof layer!=='object')return null;
 const url=safePath(layer.src||layer.path||layer.url||layer.image);
 if(!url)return null;
 return {src:url,x:Number(layer.x)||0,y:Number(layer.y)||0,width:Number(layer.width)||0,height:Number(layer.height)||0,z:Number(layer.z)||0,opacity:Math.min(1,Math.max(0,Number(layer.opacity??1)))};
}
function layersFromRecord(record){
 if(typeof record==='string')return [{src:record}];
 if(Array.isArray(record))return record;
 if(record&&Array.isArray(record.layers))return record.layers;
 return [];
}
function resolve(role,m){
 const s=specimen(role),char=matching(m.characters,s.id)||matching(m.roles,s.id);
 let layers=layersFromRecord(char);
 if(!layers.length){
  const groups=[['body',s.body],['dress',s.dress],['hair',s.hair],['head',s.head],['hat',s.hat],['weapon',s.weapon]];
  layers=groups.flatMap(([kind,key])=>{
   const record=matching(m[kind]||m[kind+'s'],key,s.sex&&key?s.sex+'_'+key:null);
   return layersFromRecord(record);
  });
 }
 if(!layers.length&&char&&typeof char==='object'){
  const direct=char.image||char.src||char.full;
  if(direct)layers=[{src:direct}];
 }
 return {spec:s,layers:layers.map(x=>normalizeLayer(x,m)).filter(Boolean).sort((a,b)=>a.z-b.z),width:Number(m.width)||300,height:Number(m.height)||480};
}
async function acquire(){
 if(manifest)return manifest;
 if(manifestPromise)return manifestPromise;
 manifestPromise=(async()=>{
  for(const path of defaultManifests)try{
   const r=await fetch(path,{cache:'force-cache'});
   if(!r.ok)continue;
   const parsed=await r.json();
   if(parsed&&typeof parsed==='object'&&(parsed.characters||parsed.roles||parsed.heads||parsed.full||parsed.body||parsed.layers)){manifest=parsed;return manifest;}
  }catch(e){}
  return null;
 })();
 return manifestPromise;
}
function escapeText(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function section(role){
 if(!role)return '';
 const x=specimen(role);
 return '<section class="role-section appearance-section" data-appearance-role="'+escapeText(x.id)+'">'+
 '<h3>현재 인게임 모습</h3>'+
 '<div class="appearance-stage" role="img" aria-label="'+escapeText(role.name||'인물')+'의 세이브 기반 외형"><span class="appearance-status">게임 원본 외형 자료 확인 중</span></div>'+
 '<p class="micro appearance-caption">세이브의 인물 외형값과 원본 이미지가 연결될 때만 표시합니다.</p></section>';
}
function paint(stage,res){
 if(!stage)return;
 if(!res.layers.length){stage.innerHTML='<span class="appearance-status">원본 이미지 매핑 없음 · 임의 외형은 표시하지 않습니다.</span>';return;}
 const size=Math.max(160,Math.min(640,res.width));
 stage.style.aspectRatio=res.width+' / '+res.height;
 stage.innerHTML='';
 const fragment=document.createDocumentFragment();
 let loaded=0,failed=0;
 res.layers.forEach((lay,index)=>{
  const img=document.createElement('img');img.alt='';img.decoding='async';img.loading='lazy';img.className='appearance-layer';
  img.style.zIndex=String(index+1);img.style.opacity=String(lay.opacity);
  if(lay.width&&lay.height){
   img.style.left=(lay.x/res.width*100)+'%';img.style.top=(lay.y/res.height*100)+'%';
   img.style.width=(lay.width/res.width*100)+'%';img.style.height=(lay.height/res.height*100)+'%';
  }
  img.onload=()=>{loaded++;if(loaded+failed===res.layers.length&&loaded===0)stage.innerHTML='<span class="appearance-status">외형 이미지 리소스를 불러오지 못했습니다.</span>';};
  img.onerror=()=>{failed++;img.remove();if(loaded+failed===res.layers.length&&loaded===0)stage.innerHTML='<span class="appearance-status">외형 이미지 리소스를 불러오지 못했습니다.</span>';};
  img.src=lay.src;fragment.append(img);
 });stage.append(fragment);
}
async function update(root,roles){
 const active=[...root.querySelectorAll('[data-appearance-role]')];if(!active.length)return;
 const m=await acquire();
 for(const node of active){
  if(!node.isConnected)continue;
  const role=roles.find(r=>String(r.id||r.raw?.ID)===node.dataset.appearanceRole);
  const stage=node.querySelector('.appearance-stage');
  if(!m){if(stage)stage.innerHTML='<span class="appearance-status">원본 외형 이미지 자료 미연결</span>';continue;}
  paint(stage,resolve(role,m));
 }
}
global.NangmanAppearance={section,update,resolve,specimen,loadManifest:()=>acquire()};
})(window);
