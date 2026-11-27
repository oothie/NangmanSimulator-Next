/* Korean public four-gate success-only forecast. Source-derived game
 * rules exclusively: NO player save, measured seed, account, or fixture.
 * Browser imports only the user's local save. No battle-loss/exit replay.
 */
import {replayLiuManor} from './dungeon-replay-liu.js';
import {replayYanwangfu} from './dungeon-replay-yan.js';
import {replayChangok} from './dungeon-replay-dcy.js';
import {replayByeokyu} from './dungeon-replay-byj.js';
import {forecastInterleavedSpecials} from './dungeon-special.js';
export const GATES=['연왕부','창옥','벽유교','유씨별원'];
const PRODUCERS={
 '연왕부':replayYanwangfu,'창옥':replayChangok,
 '벽유교':replayByeokyu,'유씨별원':replayLiuManor
};
const NPC={
 '연왕부':{이총관:33654,하상:33653,엽내관:33652,연왕:33650},
 '창옥':{무준신:40372,이장:40373,장정:40374},
 '벽유교':{독선생:35219,미:35214,불로선인:35221},
 '유씨별원':{윤무:35260,고리:35264,이뢰운:35268}
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
export function predictGate(save,gate,clears=1,keyMode='auto',claimMode='current'){
 if(!PRODUCERS[gate])throw Error('현재 출시된 4관문만 지원합니다.');
 if(!Number.isInteger(clears)||clears<1||clears>21)
  throw Error('1~21회 클리어만 계산할 수 있습니다.');
 if(!['current','never_claimed'].includes(claimMode))
  throw Error('특수보상 획득 가정이 올바르지 않습니다.');
 const simulated=forecastInterleavedSpecials(save,gate,PRODUCERS[gate],clears,{
  mode:claimMode,keyMode,
  // Native temp-scope lifespan / story unlock not proven; never invent them.
  tempLifetime:'unknown',numericAfterGrant:'unknown'
 });
 const output=simulated.rows.map(played=>{
  const clear=played.producer;
  return {clear:played.clear,drawCount:clear.drawCount,
   keyState:clear.keyState,keyHit:clear.keyHit,
   results:clear.results.map(boss=>{
    // 윤무의 연금니는 확정드랍이므로 특수보상 목록에 표시하지 않음.
    const npc=NPC[gate][boss.boss],grants=played.grants.filter(x=>
     x.npc===npc&&!(gate==='유씨별원'&&npc===35260&&x.itemId===8801));
    const special=grants.filter(x=>x.predicted).map(x=>({
     name:x.name,gradeCode:x.gradeCode,quantity:x.quantity,
     kind:'지급 조건 충족'
    }));
    const unresolved=grants.filter(x=>x.unresolved).map(x=>x.name);
    const warnings=[];
    if(gate==='유씨별원'&&boss.boss==='고리'&&clear.keyState){
     const k=clear.keyState;
     warnings.push(k.received?'고리의 열쇠 지급 예상':
      k.heldAtStart?'열쇠 보유로 별도 추첨 생략':'고리의 열쇠 미획득');
     if(k.consumedByAssumption)warnings.push('열쇠 즉시 사용 가정');
    }
    if(gate==='벽유교'&&boss.boss==='불로선인'&&clear.keyCondition)
     warnings.push(clear.keyCondition);
    return {boss:boss.boss,name:boss.name,grade:boss.grade,
     special,unresolved,warnings};
   })};
 });
 return {gate,output,claimMode,conditional:true,
  incomplete:simulated.incomplete,
  stoppedAt:simulated.stoppedAt,
  totalUnresolved:simulated.unresolved};
}

const DAILY_DEFAULT = Object.freeze({'연왕부':0,'창옥':0,'벽유교':0,'유씨별원':0});
const DAILY_PLAN_KEY='nangman-dungeon-daily-plan';
function loadDailyPlan(){
 const defaults={...DAILY_DEFAULT};
 try{
  const stored=JSON.parse(localStorage.getItem(DAILY_PLAN_KEY)||'null');
  if(!stored||typeof stored!=='object'||Array.isArray(stored))return defaults;
  const plan=Object.fromEntries(GATES.map(g=>[g,Number(stored[g]??0)]));
  if(GATES.some(g=>!Number.isInteger(plan[g])||plan[g]<0||plan[g]>3)||
     GATES.reduce((n,g)=>n+plan[g],0)>6)return defaults;
  return plan;
 }catch{return defaults;}
}
function saveDailyPlan(plan){
 try{localStorage.setItem(DAILY_PLAN_KEY,JSON.stringify(
  Object.fromEntries(GATES.map(g=>[g,plan[g]]))))}catch{}
}
let activeDungeonTab='regular';
let activeDungeonGate='연왕부';
let regularClears=1;
let dailyPlan=loadDailyPlan();
let dailyDays=1;
let claimMode='current',keyMode='auto';

function extractDailyOutput(gate,simulated,day){
 return simulated.rows.map(entry=>({
  day,gate,clear:entry.clear,results:entry.producer.results.map(boss=>{
   const npc=NPC[gate][boss.boss];
   const grants=entry.grants.filter(g=>g.npc===npc&&!(gate==='유씨별원'&&npc===35260&&g.itemId===8801));
   return {boss:boss.boss,name:boss.name,grade:boss.grade,
    special:[...new Set(grants.filter(g=>g.predicted).map(g=>g.name))],
    uncertain:[...new Set(grants.filter(g=>g.unresolved).map(g=>g.name))],
    keyNote:gate==='유씨별원'&&boss.boss==='고리'
      ?entry.producer.keyState?.received?'고리의 열쇠 지급 예상'
      :entry.producer.keyState?.heldAtStart?'열쇠 보유 · 추첨 생략':''
      :''};
  })
 }));
}
export function predictDailyGates(save,plan,days=1){
 if(!save)throw Error('세이브를 불러와 주세요.');
 if(!Number.isInteger(days)||days<1||days>7)throw Error('일일 예측은 1~7일만 가능합니다.');
 const counts=Object.fromEntries(GATES.map(g=>[g,Number(plan[g]??0)]));
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 if(GATES.some(g=>!Number.isInteger(counts[g])||counts[g]<0||counts[g]>3)||total>6)
  throw Error('한 관문 최대 3회 · 하루 총 6회까지만 선택할 수 있습니다.');
 if(!total)throw Error('예측할 관문 횟수를 선택하세요.');
 let state=save;
 const results=[],warnings=[];
 for(let day=1;day<=days;day++){
  const dayRows=[];
  for(const gate of GATES){
   const n=counts[gate];if(!n)continue;
   const simulated=forecastInterleavedSpecials(state,gate,PRODUCERS[gate],n,{
    mode:'current',keyMode:'auto',tempLifetime:'unknown',numericAfterGrant:'unknown'
   });
   dayRows.push(...extractDailyOutput(gate,simulated,day));
   if(simulated.incomplete){
    warnings.push(day+'일차 '+gate+' '+simulated.stoppedAt+'회차부터 계산 불가');
    return {results,partial:dayRows,warnings,complete:false};
   }
   state=simulated.nextState;
  }
  results.push({day,rows:dayRows});
 }
 return {results,warnings,complete:true};
}
export function mountDungeon(host,save){
 if(!host)return;
 const options=(n,chosen,start=0)=>Array.from({length:n-start+1},(_,i)=>start+i).map(v=>
  '<option value="'+v+'" '+(v===chosen?'selected':'')+'>'+v+'회</option>').join('');
 host.innerHTML='<section class="card dungeon-131">'+
 '<nav class="simple-tabs" aria-label="관문 드랍 하위탭">'+
 '<button type="button" data-dun-tab="regular" class="'+(activeDungeonTab==='regular'?'active':'')+'">드랍 예측</button>'+
 '<button type="button" data-dun-tab="daily" class="'+(activeDungeonTab==='daily'?'active':'')+'">일일 예측</button></nav>'+
 '<div id="dunRegular" '+(activeDungeonTab==='regular'?'':'hidden')+'><div class="market-goal-controls">'+
 '<label>관문<select id="dunGate">'+GATES.map(g=>'<option value="'+esc(g)+'" '+(g===activeDungeonGate?'selected':'')+'>'+esc(g)+'</option>').join('')+'</select></label>'+
 '<label>연속 회차<select id="dunCount">'+options(21,regularClears,1)+'</select></label>'+
 '<label>특수보상<select id="dunClaim"><option value="current" '+(claimMode==='current'?'selected':'')+'>현재 획득 기록</option><option value="never_claimed" '+(claimMode==='never_claimed'?'selected':'')+'>미획득 가정</option></select></label>'+
 '<label id="dunKeyWrap" '+(activeDungeonGate==='유씨별원'?'':'hidden')+'>고리의 열쇠<select id="dunKey">'+
 [['auto','획득 후 즉시 사용'],['retain','획득 후 보유'],['owned','매회 보유'],['absent','매회 미보유']].map(([v,n])=>'<option value="'+v+'" '+(keyMode===v?'selected':'')+'>'+n+'</option>').join('')+
 '</select></label><button id="dunRegularRun" type="button">드랍 예측</button></div></div>'+
 '<div id="dunDaily" '+(activeDungeonTab==='daily'?'':'hidden')+'>'+
 '<p class="micro">관문별 최대 3회 · 하루 합계 최대 6회</p>'+
 '<div class="dun-daily-grid">'+GATES.map(g=>'<label class="dun-daily-place">'+esc(g)+
 '<select data-dun-daily="'+esc(g)+'">'+options(3,dailyPlan[g])+'</select></label>').join('')+'</div>'+
 '<div class="market-goal-controls"><label>반복 일수<select id="dunDays">'+
 Array.from({length:7},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===dailyDays?'selected':'')+'>'+(i+1)+'일치</option>').join('')+
 '</select></label><strong id="dunDailyTotal"></strong><button id="dunDailyRun" type="button">일일 예측</button></div></div>'+
 '<div id="dunResults" aria-live="polite"></div></section>';
 const regular=host.querySelector('#dunRegular'),daily=host.querySelector('#dunDaily'),result=host.querySelector('#dunResults');
 const paintRows=(rows,title)=>{
  let html='<h4>'+esc(title)+'</h4><div class="table-scroll"><table class="dun-table"><thead><tr><th>보스</th><th>장비</th><th>색상</th><th>특수보상</th></tr></thead><tbody>';
  for(const r of rows){const color={백색:'#818181',녹색:'#259b61',청색:'#397db3',자색:'#9052c4'}[r.grade]||'';
   const specials=(r.special||[]).map(x=>typeof x==='string'?x:x.name).concat(r.uncertain||r.unresolved||[]);
   if(r.keyNote)specials.push(r.keyNote);
   html+='<tr><td>'+esc(r.boss)+'</td><td>'+esc(r.name)+'</td><td>'+(r.grade?'<b style="color:'+color+'">'+esc(r.grade)+'</b>':'—')+
    '</td><td>'+esc([...new Set(specials)].join(' · ')||'—')+'</td></tr>';
  }
  return html+'</tbody></table></div>';
 };
 function regularRun(){
  try{
   if(!save)throw Error('세이브를 불러와 주세요.');
   const out=predictGate(save,activeDungeonGate,regularClears,keyMode,claimMode);
   result.innerHTML=out.output.map(x=>paintRows(x.results,activeDungeonGate+' '+x.clear+'회차')).join('')+
    (out.incomplete?'<p class="micro">'+out.stoppedAt+'회차부터 계산 불가</p>':'');
  }catch(e){result.textContent='드랍 예측 실패: '+String(e.message||e)}
 }
 function updateDaily(){
  let total=GATES.reduce((s,g)=>s+dailyPlan[g],0);
  const note=host.querySelector('#dunDailyTotal');if(note)note.textContent='하루 '+total+' / 6회';
  host.querySelectorAll('[data-dun-daily]').forEach(el=>{
   const g=el.dataset.dunDaily,remaining=Math.min(3,6-(total-dailyPlan[g]));
   for(const opt of el.options)opt.disabled=Number(opt.value)>remaining;
   el.value=String(dailyPlan[g]);
  });
 }
 function dailyRun(){
  if(!GATES.some(g=>dailyPlan[g]>0)){result.textContent='관문별 횟수를 선택하면 일일 예측 결과가 표시됩니다.';return;}
  try{
   const out=predictDailyGates(save,dailyPlan,dailyDays);
   result.innerHTML=out.results.map(x=>'<details class="dun-day-group" style="margin:12px 0;border:1px solid var(--border);border-radius:8px;background:var(--panel);overflow:hidden">'+
    '<summary style="cursor:pointer;padding:12px 14px;font-weight:700;background:var(--paper)">'+x.day+'일차 · '+x.rows.length+'회차</summary>'+
    '<div style="padding:12px 14px">'+x.rows.map(y=>paintRows(y.results,y.gate+' '+y.clear+'회차')).join('')+'</div></details>').join('')+
    (out.complete?'':'<p class="micro">'+esc(out.warnings.join(' · '))+'</p>');
  }catch(e){result.textContent='일일 예측 실패: '+String(e.message||e)}
 }
 host.querySelectorAll('[data-dun-tab]').forEach(b=>b.onclick=()=>{
  activeDungeonTab=b.dataset.dunTab;
  host.querySelectorAll('[data-dun-tab]').forEach(x=>x.classList.toggle('active',x===b));
  regular.hidden=activeDungeonTab!=='regular';daily.hidden=activeDungeonTab!=='daily';result.replaceChildren();
  if(save)(activeDungeonTab==='daily'?dailyRun:regularRun)();
 });
 host.querySelector('#dunGate').onchange=e=>{
  activeDungeonGate=e.target.value;host.querySelector('#dunKeyWrap').hidden=activeDungeonGate!=='유씨별원';regularRun();
 };
 host.querySelector('#dunCount').onchange=e=>{regularClears=Number(e.target.value);regularRun()};
 host.querySelector('#dunClaim').onchange=e=>{claimMode=e.target.value;regularRun()};
 host.querySelector('#dunKey').onchange=e=>{keyMode=e.target.value;regularRun()};
 host.querySelector('#dunRegularRun').onclick=regularRun;
 host.querySelector('#dunDays').onchange=e=>{dailyDays=Number(e.target.value);dailyRun()};
 host.querySelectorAll('[data-dun-daily]').forEach(el=>el.onchange=e=>{
  const g=el.dataset.dunDaily,value=Number(el.value);
  if(GATES.reduce((s,x)=>s+(x===g?value:dailyPlan[x]),0)>6){el.value=String(dailyPlan[g]);return}
  dailyPlan[g]=value;saveDailyPlan(dailyPlan);updateDaily();dailyRun();
 });
 host.querySelector('#dunDailyRun').onclick=dailyRun;
 updateDaily();
 if(save)(activeDungeonTab==='daily'?dailyRun:regularRun)();
 else result.textContent='세이브를 불러와 주세요.';
}