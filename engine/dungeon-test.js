/* Korean 60014 source-branch dungeon test engine.
 * Public code has NO seed, account, equipment instance, or save-derived data.
 * 13 launched-boss source pools / typed branch order, not a certified future oracle.
 */
import {replayLiuManor} from './dungeon-original-liu.js?rev=key-award-v129';
import {replayYanwangfu} from './dungeon-original-yan.js';
import {replayChangok} from './dungeon-original-dcy.js';
import {replayByeokyu} from './dungeon-original-byj.js';
import {loadV620KoreanReference} from '../data/v620-korean-reference.js';
export const GATES=['연왕부','창옥','벽유교','유씨별원'];
const POOLS={
 '연왕부':[
  ['이총관',33654,[4209,4809,5009,5409,5609]],
  ['하상',33653,[4409,4809,5009,5209,5609]],
  ['엽내관',33652,[4009,4809,5009,5409,5609]],
  ['연왕',33650,[4009,4209,4409,4609,4809,5009,5209,5409,5609]]],
 '창옥':[
  ['무준신',40372,[4609,4809,5009,5409,5609]],
  ['이장',40373,[4009,4809,5009,5409,5609]],
  ['장정',40374,[4009,4809,5009,5409,5609]]],
 '벽유교':[
  ['독선생',35219,[4409,4209,4009,4609]],
  ['미',35214,[4809,5009,5209,5409]],
  ['불로선인',35221,[4009,4209,4409,4609,4809,5009,5209,5409,5609]]],
 '유씨별원':[
  ['윤무',35260,[5609,5409,5009]],
  ['고리',35264,[4809,5209,5609,5409]],
  ['이뢰운',35268,[4609,4409,4209,4009]]]
};
const SPECIAL={
 33654:[[2364,'drop_2364_33654','get_2364_33654',0]],
 33653:[[4422,'drop_4422_33653','get_4422',0],[2921,'drop_2921_33653','get_2921',15],[2364,'drop_2364_33653','get_2364_33653',0]],
 33652:[[2918,'drop_2918_33652','get_2918',15],[5618,'drop_5618_33652','get_5618',0],[3505,'drop_3505_33652',null,null],[2364,'drop_2364_33652','get_2364_33652',0]],
 33650:[[5422,'drop_5422_33650','get_5422',0],[2920,'drop_2920_33650','get_2920',15],[7081,'drop_7081_33650','get_7081',0],[2364,'drop_2364_33650','get_2364_33650',0]],
 40372:[[2924,'drop_2924_40372','get_2924',15],[3523,'drop_3523_40372',null,null],[9072,'drop_9072_40372','get_9072_40372',0],[4634,'drop_4634_40372','get_4634_40372',0]],
 40373:[[2926,'drop_2926_40373','get_2926',10],[9072,'drop_9072_40373','get_9072_40373',0],[4820,'drop_4820_40373','get_4820_40373',0]],
 40374:[[2925,'drop_2925_40374','get_2925',15],[7165,'drop_7165_40374','get_7165',0],[8295,'drop_8295_40374','get_8295',0],[9072,'drop_9072_40374','get_9072_40374',0],[5218,'drop_5218_40374','get_5218',0]],
 35219:[[7265,'drop_7265_35219','get_7265',0],[7264,'drop_7264_35219','get_7264',0]],
 35214:[[2922,'drop_2922_35214','get_2922',15],[7262,'drop_7262_35214','get_7262',0],[7263,'drop_7263_35214','get_7263',0]],
 35221:[[2923,'drop_2923_35221','get_2923',15],[7266,'drop_7266_35221','get_7266',0],[7267,'drop_7267_35221','get_7267',0],[3970,'drop_3970_35221',null,null]],
 35260:[[8801,'drop_35260_rarematerial','get_8801',0],[5020,'drop_5020_35260','get_5020',0]],
 35264:[[8915,'drop_8915_35264',null,null],[8913,'drop_8913_35264','get_8913',15],[5628,'drop_5628_35264','get_5628',0]],
 35268:[[8917,'drop_8917_35268','get_8917',10],[8914,'drop_8914_35268','get_8914',15]]
};
const SPECIAL_KO={8915:'고리의 열쇠',3523:'몰우전',3970:'귀용문 열쇠'};
let publicItemNames=null;
function specialName(id){
 const localized=publicItemNames?.[String(id)]?.[0];
 const clean=typeof localized==='string'?localized.trim():'';
 return SPECIAL_KO[id]||(clean&&!/[\u3400-\u9fff]/.test(clean)?clean:'특수 보상');
}
function number(x){let v=Number(x?.Value??x?.value??x);return Number.isFinite(v)?v:0}
// Advance only hypothetical delivery counters of awards with a verified
// consumer cap. This is an isolated forecast copy, never the visitor's save.
// A missing counter or temp-only counter does not invent a new limit.
function freshReplaySpecials(listed,items,counters){
 return (items||[]).map(item=>{
  const entry=listed.find(e=>e[0]===item);
  const counter=entry?.[2],cap=entry?.[3];
  const consumed=counter?number(counters[counter]):0;
  const eligible=!counter||(cap===0?consumed===0:consumed<cap);
  if(eligible&&counter&&item!==8801)counters[counter]=consumed+1;
  return {name:specialName(item),kind:eligible?
   '추첨 당첨 · 지급 조건 충족':'추첨 당첨 · 지급 상한 도달'};
 });
}
export function predictGate(save,gate,clears=1,keyMode='auto'){
 if(!GATES.includes(gate))throw Error('현재 출시된 4관문만 지원합니다.');
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('1~10회 범위를 선택해 주세요.');
 if(gate==='연왕부'){
  const awardCounters={...(save?.globalVariable||{})};
  const replay=replayYanwangfu(save,clears);
  return {gate,output:replay.output.map(clear=>({
   clear:clear.clear,drawCount:clear.drawCount,
   results:clear.results.map(row=>{
    const npc=POOLS['연왕부'].find(b=>b[0]===row.boss)?.[1];
    const listed=SPECIAL[npc]||[];
    const specialCandidateNames=listed.filter(([item,flag,counter,cap])=>
     !counter||(cap===0?number(awardCounters[counter])===0:
      number(awardCounters[counter])<cap)).map(([item])=>specialName(item));
    const special=freshReplaySpecials(listed,row.specialIds,awardCounters);
    return {boss:row.boss,name:row.name,grade:row.grade,special,
     specialCandidates:specialCandidateNames.length,specialTotal:listed.length,
     specialCandidateNames,warnings:[]};
   })
  })),conditional:true,keyHeld:false,
  caution:'연왕부는 원본 진입 경로 기반 조건부 계산입니다. 장비와 특수 보상의 실제 획득 여부는 게임 진행 상태에 따라 달라질 수 있습니다.',
  keyNote:''};
 }
 if(gate==='유씨별원'){
  const awardCounters={...(save?.globalVariable||{})};
  const replay=replayLiuManor(save,clears,keyMode);
  const output=replay.output.map(clear=>({
   clear:clear.clear,
   drawCount:clear.drawCount,
   keyHit:clear.keyHit,keyState:clear.keyState,
   results:clear.results.map(row=>{
    const npc=POOLS['유씨별원'].find(b=>b[0]===row.boss)?.[1];
    const listed=SPECIAL[npc]||[];
    const specialCandidateNames=listed.filter(([item,flag,counter,cap])=>
     !counter||(cap===0?number(awardCounters[counter])===0:
      number(awardCounters[counter])<cap)).map(([item])=>specialName(item));
    const special=freshReplaySpecials(listed,row.specialIds,awardCounters).map(item=>
     clear.keyAwarded&&item.name==='고리의 열쇠'?
      {...item,kind:'드랍 예측 · 원본 지급 조건 충족'}:item);
    const state=clear.keyState;
    const warnings=row.boss==='고리'?
     [(state.heldAtStart?'열쇠 보유':'열쇠 미보유')+
      ' · 열쇠 추첨 '+(state.heldAtStart?'생략':'실행')+
      (state.received?' · 신규 열쇠 1개 지급 예상':'')+
      (state.consumedByAssumption?' · 사용 가정 '+state.consumedByAssumption+'개':'')+
      ' · 다음 회차 '+(state.heldAfter?'보유':'미보유')]:[];
    return {boss:row.boss,name:row.name,grade:row.grade,special,
     specialCandidates:specialCandidateNames.length,specialTotal:listed.length,
     specialCandidateNames,warnings};
   })
  }));
  return {gate,output,conditional:true,keyHeld:replay.keys[0]?.heldAtStart,
   caution:'유씨별원은 원본 관문 계산 흐름에 따른 조건부 결과입니다. 특수 보상의 추첨 당첨과 실제 지급은 별개이며, 미래 드랍의 일치를 보장하지 않습니다.',
   keyNote:'고리의 열쇠는 실제 아이템 보유량과 해당 회차에 새로 성공한 특수 추첨으로 판정합니다. 누적 획득 기록은 보유량이 아닙니다. 기본은 획득 후 즉시 사용을 가정하며, 「획득 후 보유 유지」로 다음 회차 분기를 비교할 수 있습니다.'};
 }
 if(gate==='창옥'||gate==='벽유교'){
  const awardCounters={...(save?.globalVariable||{})};
  const replay=gate==='창옥'?replayChangok(save,clears):replayByeokyu(save,clears);
  const output=replay.output.map(clear=>({
   clear:clear.clear,drawCount:clear.drawCount,
   results:clear.results.map(row=>{
    const npc=POOLS[gate].find(b=>b[0]===row.boss)?.[1];
    const listed=SPECIAL[npc]||[];
    const candidateList=listed.filter(([item,flag,counter,cap])=>{
     if(gate==='벽유교'&&item===3970&&!clear.keyEnabled)return false;
     return !counter||(cap===0?number(awardCounters[counter])===0:
      number(awardCounters[counter])<cap);
    });
    const special=freshReplaySpecials(listed,row.specialIds,awardCounters);
    const warnings=gate==='벽유교'&&row.boss==='불로선인'?
     ['귀용문 열쇠: '+clear.keyCondition+
       (clear.keyEnabled?' · 추첨 실행':' · 추첨 생략')]:[];
    return {boss:row.boss,name:row.name,grade:row.grade,special,
     specialCandidates:candidateList.length,specialTotal:listed.length,
     specialCandidateNames:candidateList.map(([item])=>specialName(item)),warnings};
   })
  }));
  return {gate,output,conditional:true,keyHeld:false,
   caution:gate==='창옥'?
    '창옥은 원본 장비·색상·특수 보상 선행 추첨과 재료 누적 가중치를 반영한 조건부 결과입니다.':
    '벽유교는 원본 장비·색상과 특수 보상 분기를 재생합니다. 귀용문 열쇠는 임무 단계와 개방 상태에 따라 추첨 여부가 달라집니다.',
   keyNote:gate==='벽유교'?
    '귀용문 열쇠는 추첨 성공과 실제 아이템 지급을 구분해 표시합니다. 원본 임무 단계가 없으면 임의로 예측하지 않습니다.':''};
 }
 throw Error('원본 관문 계산 경로가 없습니다.');
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function mountDungeon(host,save){
 if(!host)return;
 host.innerHTML='<section class="card"><h3>관문 일반 장비 드랍 (테스트)</h3>'+
 '<p class="micro">원본 관문 계산 경로로 장비명·색상·특수 보상 조건을 조회합니다. 실제 획득 여부는 게임에서 확인해 주세요.</p>'+
 '<div class="market-goal-controls"><label>관문 <select id="dungeonTestGate">'+
 GATES.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label>'+
 '<label>연속 클리어 <select id="dungeonTestClears">'+
 [1,2,3,4,5,6,7,8,9,10].map(n=>'<option value="'+n+'">'+n+'회</option>').join('')+'</select></label>'+
 '<label id="dungeonTestKeyControl" hidden>고리의 열쇠 (유씨별원)<select id="dungeonTestKey">'+
 '<option value="auto">세이브 보유 기준 · 열쇠 즉시 사용 가정</option><option value="retain">세이브 보유 기준 · 획득 후 보유 유지</option><option value="owned">매 회차 보유 가정</option><option value="absent">매 회차 미보유 가정</option>'+
 '</select></label><button id="dungeonTestRun" type="button">관문 드랍 계산</button></div>'+
 '<div id="dungeonTestResults" aria-live="polite"></div></section>';
 const gateControl=host.querySelector('#dungeonTestGate');
 const keyControl=host.querySelector('#dungeonTestKeyControl');
 const syncGateOptions=()=>{const visible=gateControl.value==='유씨별원';keyControl.hidden=!visible;keyControl.style.setProperty('display',visible?'grid':'none','important')};
 gateControl.addEventListener('change',()=>{syncGateOptions();run()});
 syncGateOptions();
 const run=()=>{
  const out=host.querySelector('#dungeonTestResults');
  try{
   const gate=host.querySelector('#dungeonTestGate').value;
   const count=Number(host.querySelector('#dungeonTestClears').value);
   const key=host.querySelector('#dungeonTestKey').value;
   const result=predictGate(save,gate,count,key);
   let html='<p class="micro">'+esc(result.caution)+'</p>';
   if(result.keyNote)html+='<p class="micro">'+esc(result.keyNote)+'</p>';
   for(const clear of result.output){
    html+='<h4>'+clear.clear+'회차</h4><div class="table-scroll"><table style="min-width:620px;table-layout:fixed;width:100%"><colgroup><col style="width:22%"><col style="width:30%"><col style="width:16%"><col style="width:32%"></colgroup><thead><tr><th>보스</th><th>장비</th><th>색상</th><th>특수보상</th></tr></thead><tbody>';
    for(const row of clear.results){
     const gradeColor={백색:'#a2a2a2',녹색:'#259b61',청색:'#397db3',자색:'#9052c4'}[row.grade]||'';
     // Only source-predicted, consumer-eligible awards belong in this column.
     // Do not display unawarded candidates, failed draws or branch diagnostics.
     const awarded=(row.special||[]).filter(item=>
      typeof item.name==='string'&&
      (item.kind==='추첨 당첨 · 지급 조건 충족'||
       item.kind==='드랍 예측 · 원본 지급 조건 충족'));
     const rewardNames=[...new Set(awarded.map(item=>item.name))];
     html+='<tr><td>'+esc(row.boss)+'</td><td>'+esc(row.name)+'</td><td>'+
     (row.grade?'<b style="color:'+gradeColor+'">'+esc(row.grade)+'</b>':'—')+
     '</td><td style="overflow-wrap:anywhere">'+
     (rewardNames.length?rewardNames.map(esc).join(', '):'—')+'</td></tr>';
    }
    html+='</tbody></table></div>';
   }
   out.innerHTML=html;
  }catch(err){out.innerHTML='<p class="role-status-note">'+esc(err.message||err)+'</p>'}
 };
 host.querySelector('#dungeonTestRun').onclick=run;
 run();
 // Extracted Korean game terms only. No source is ever sent the uploaded save.
 loadV620KoreanReference().then(publicData=>{
  publicItemNames=publicData?.items||null;
  if(host.isConnected)run();
 }).catch(()=>{});
}
