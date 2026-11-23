/* yy-sim style: one dungeon selection displays every boss and two independent results. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const area=$('dungeonDualArea'),status=$('dungeonDualStatus'),body=$('dungeonDualBody');
if(!area||!status||!body||!root.SBJDungeonDual)return;
const source=root.DAILY_DATA?.dungeons||[];
const original=root.SBJDungeonCatalog||[];
const combined=root.SBJDungeonYYAdapter.fullCatalog(original);
const colors=['색상 미확인','백색','녹색','청색','자색'];
const bossOverrides={'恶贼':'악적','茧':'견','迷':'미','柱子':'주자',
 '风':'풍','山':'산','清虚':'청허','凌红尘':'능홍진'};
const names={
 聚仙寨:'취선채',邹家堡:'추가보',墨门遗迹:'묵문유적',血衣楼:'혈의루',
 铁刃门:'철인문',天一教:'천일교',枯骨门:'고골문',燕王府:'연왕부',
 厂狱:'창옥',碧游教:'벽유교',刘氏别院:'유씨별원',闻香教:'문향교',
 '武神殿·宿命':'무신전 · 숙명','武神殿·绝世':'무신전 · 절세',
 '碧游总坛·普通':'벽유교 본단 · 일반','碧游总坛·追魂':'벽유교 본단 · 추혼',
 '武林大会·追忆':'무림대회 · 추억','武林大会·登峰':'무림대회 · 등봉'
};
const label=d=>names[d.name]||root.SBJ_KOREAN?.translate?.(d.name)||d.name;
const nameOf=id=>{
 if(!id)return '일반 장비 없음';
 return root.NangmanDungeonKoreanNames?.[id]||
  root.EQUIP_DATA?.equipment?.[id]?.koName||
  root.SBJ_KOREAN?.translate?.(root.EQUIP_DATA?.equipment?.[id]?.name||'')||
  '한국판 이름 미확인';
};
const make=(tag,content,cls)=>{
 const el=document.createElement(tag);if(content!=null)el.textContent=String(content);
 if(cls)el.className=cls;return el;
};
function cell(row,content,css){
 const el=make('td',null,css);if(typeof content==='string')el.textContent=content;
 else if(content)el.append(content);row.append(el);
}
function resultNode(r,engine){
 const wrap=make('div',null,'dungeon-dual-result');
 if(r?.missing){wrap.append(make('strong',r.reason||
   '필요한 시드 또는 보상 후보 없음','dungeon-dual-muted'));return wrap}
 if(!r?.supported){
  wrap.append(make('strong',r?.reason||'일반 장비 예측 자료 없음','dungeon-dual-muted'));return wrap;
 }
 if(r.item){
  wrap.append(make('strong',nameOf(r.item),'dungeon-dual-item'));
  wrap.append(make('span','ID '+r.item+' · '+(colors[r.color]||'색상 미확인'),'dungeon-dual-meta'));
 }else wrap.append(make('span','일반 장비 없음','dungeon-dual-muted'));
 if((r.specialDrops||[]).length){
  for(const id of r.specialDrops)wrap.append(make('span',
   '전용 보상: '+nameOf(id)+' · ID '+id,'dungeon-dual-special'));
 }
 if(engine==='san'){
  wrap.append(make('span',r.nativeReplay?'원본 함수 재현':
   r.original?'일반 장비 분기만 예측':'산부진 원본 미지원 · 보완 자료','dungeon-dual-footnote'));
  if(r.reason)wrap.append(make('span',r.reason,'dungeon-dual-footnote'));
 }else wrap.append(make('span','yy-sim 보상 가중치·순서 기준','dungeon-dual-footnote'));
 return wrap;
}
function currentSeedBelongs(key,id){
 if(id==='byj')return key==='seed_byj';
 if(id==='lsby')return key==='seed_lsby';
 if(id==='dcy')return /^seed_dcy_/.test(key);
 return false;
}
let inverseAfter=null;
function renderV3(input,dungeon){
 const target=$('dungeonV3Body'),note=$('dungeonV3Status'),trace=$('dungeonV3Trace');
 const engine=root.SBJDungeonInverse,v2=root.SBJDungeonV2;
 if(!target||!note||!engine||!v2)return;
 target.replaceChildren();
 try{
  const options={throughLiuCompleted:!!$('dungeonThroughLiuCompleted')?.checked};
  const plan=v2.planDungeons(['byj','dcy','lsby']);
  const measured=[...v2.fixture.byj,...v2.fixture.dcy,...v2.fixture.lsby];
  const result=engine.rebuild(input,inverseAfter,plan,combined,measured,options);
  const src=result.models.source,san=result.models.native;
  const crossTarget=$('dungeonV3CrossAudit');
  if(crossTarget){
   const cross=root.SBJDungeonV3CrossAudit?.inspect(src,san,input,inverseAfter);
   if(!cross){crossTarget.textContent='독립 엔진 호출 비교 스크립트를 불러오지 못했습니다.'}
   else{
    const relevant=cross.rows.filter(r=>currentSeedBelongs(r.key,dungeon.id));
    crossTarget.textContent=relevant.map(r=>{
     const where=r.differingBound?
      '최초 추첨 범위 차이: '+r.differingBound.call+'번째 호출 · yy-sim '+r.differingBound.sourceBound+
      ' / 산부진 '+r.differingBound.nativeBound:
      r.differentCallCounts?'동일 접두 구간 이후 총 호출 횟수 차이':
      '표면상 호출 범위 일치 (분기 방향은 별도 확인)';
     const ending=r.actualEnd===null?'종료 세이브 미등록':
      '실측 종료 시드: yy-sim '+(r.source.match?'일치':'불일치')+
      ' / 산부진 '+(r.native.match?'일치':'불일치');
     return r.key+' · yy-sim '+r.source.calls+'회 / 산부진 '+r.native.calls+
      '회\\n'+where+'\\n'+ending;
    }).join('\\n\\n')||'선택한 관문의 RNG 호출 추적 없음';
   }
  }
  const expected=new Map(measured.map(x=>[Number(x.npc),x]));
  const labelRow=x=>x?.item?nameOf(x.item)+' · '+(colors[x.color]||'색상 미확인'):'일반 장비 없음';
  const describe=(row,check)=>{
   if(!row?.supported)return row?.reason||'미복원';
   return labelRow(row)+(check?.pass?' · 실측 일치':' · 실측 불일치');
  };
  for(const entry of plan.filter(x=>x.dungeon.id===dungeon.id)){
   const id=Number(entry.npc.id),ex=expected.get(id);
   const sr=src.rows.find(x=>Number(x.npcId)===id);
   const nr=san.rows.find(x=>Number(x.npcId)===id);
   const sc=src.observed.checks.find(x=>x.npc===id);
   const nc=san.observed.checks.find(x=>x.npc===id);
   const tr=make('tr');
   const boss=bossOverrides[entry.npc.name]||root.SBJ_KOREAN?.translate?.(entry.npc.name)||entry.npc.name;
   cell(tr,boss,'dungeon-dual-boss');
   cell(tr,ex?labelRow(ex):'실측 없음');
   cell(tr,describe(sr,sc));
   cell(tr,describe(nr,nc));
   target.append(tr);
  }
  note.textContent='1122 실측 9보스 기준 · yy-sim형 '+src.observed.matched+'/9, 산부진형 '+
   san.observed.matched+'/9 일치 · '+(inverseAfter?'시드 차분 후보 분석됨':'실측 이후 세이브를 넣으면 시드 차분 역추적 가능')+
   ' · v3 역추적은 진행 중이며 정확한 미래 예측은 미검증';
  if(trace){
   if(!inverseAfter){trace.textContent='실측 이후 세이브가 없어 호출 수 역추적은 실행되지 않았습니다.'}
   else{
    const summary=model=>{
     const r=result.models[model].reconciled;
     return {model,status:r.status,unresolved:r.unresolved,
      keys:Object.fromEntries(Object.entries(r.keys||{}).map(([key,val])=>[key,{
       status:val.status,states:val.states,truncated:val.truncated,
       candidates:val.solutions.slice(0,3).map(s=>({hiddenCalls:s.hiddenCalls,
        steps:s.steps.filter(t=>t.type==='unknown')}))
      }]))};
    };
    trace.textContent=JSON.stringify([summary('source'),summary('native')],null,2);
   }
  }
 }catch(error){note.textContent='v3 역추적 진단 오류: '+String(error?.message||error)}
}
function render(){
 const current=source.find(d=>d.id===area.value);
 body.replaceChildren();
 if(!current)return;
 let save=null;
 try{save=root.loadShareStore?.()?.data}catch(_){}
 if(!save){
  status.textContent='세이브를 불러오면 이 관문의 모든 보스 드랍 결과를 계산합니다.';
  return;
 }
 try{
  const input=root.SBJDungeonDrop.open(save);
  const options={throughLiuCompleted:!!$('dungeonThroughLiuCompleted')?.checked};
  const result=root.SBJDungeonDual.compare(input,current,combined,original,options);
  renderV3(input,current);
  const yy=new Map(result.yy.rows.map(r=>[r.npcId,r]));
  const san=new Map(result.san.rows.map(r=>[r.npcId,r]));
  for(const npc of result.bosses){
   const tr=make('tr');
   const record=combined.find(e=>Number(e.sourceNpc||String(e.id).match(/drop_(\d+)/)?.[1])===Number(npc.id)&&
     e.sourceDungeon===current.name);
   const bossChinese=record?.boss||npc.name;
   cell(tr,bossOverrides[bossChinese]||root.SBJ_KOREAN?.translate?.(bossChinese)||
     bossChinese,'dungeon-dual-boss');
   cell(tr,resultNode(yy.get(npc.id),'yy'));
   cell(tr,resultNode(san.get(npc.id),'san'));
   body.append(tr);
  }
  const missYY=result.yy.missingSeeds.length,missSAN=result.san.missingSeeds.length;
  const rowsBoth=result.bosses.filter(n=>{
   const a=yy.get(n.id),b=san.get(n.id);
   return a?.supported&&!a.missing&&b?.supported&&!b.missing;
  });
  const match=rowsBoth.filter(n=>yy.get(n.id).item===san.get(n.id).item&&
   yy.get(n.id).color===san.get(n.id).color);
  status.textContent=label(current)+' · 보스 '+result.bosses.length+'명 · 양쪽 예측 가능 '+
   rowsBoth.length+'명 · 동일 결과 '+match.length+'명'+
   (missYY||missSAN?' · 시드 누락: yy-sim '+missYY+' / 산부진 '+missSAN:'')+
   (options.throughLiuCompleted?' · 유씨별원까지 주황 장비 획득 완료 조건 반영':'')+
   ' · 다음 1회 보상 · 실측 검증 전';
 }catch(error){status.textContent='관문 드랍 계산 오류: '+String(error?.message||error)}
}
$('dungeonV3AfterSave')?.addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  const raw=JSON.parse(await file.text());
  inverseAfter=root.SBJDungeonDrop.open(raw);
  $('dungeonV3Status').textContent='실측 이후 세이브 불러옴 · RNG 차분 재계산';
  render();
 }catch(error){inverseAfter=null;$('dungeonV3Status').textContent=
  '실측 이후 세이브를 읽지 못했습니다: '+String(error?.message||error)}
});
$('dungeonV3ClearAfter')?.addEventListener('click',()=>{
 inverseAfter=null;if($('dungeonV3AfterSave'))$('dungeonV3AfterSave').value='';render();
});
source.forEach(d=>area.add(new Option(label(d),d.id)));
const first=source.find(d=>d.id==='ywf')||source[0];
if(first)area.value=first.id;
area.addEventListener('change',render);
$('dungeonThroughLiuCompleted')?.addEventListener('change',render);
$('dungeonDualRefresh')?.addEventListener('click',render);
document.addEventListener('yyjh-save',render);
render();
})(window);
