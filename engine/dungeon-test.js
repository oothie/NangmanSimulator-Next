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
 if(!Number.isInteger(clears)||clears<1||clears>10)
  throw Error('1~10회 클리어만 계산할 수 있습니다.');
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
export function mountDungeon(host,save){
 if(!host)return;
 host.innerHTML='<section class="card"><h3>관문 일반 장비 드랍 (테스트)</h3>'+
 '<div class="market-goal-controls"><label>관문 <select id="dungeonTestGate">'+
 GATES.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label>'+
 '<label>연속 클리어 <select id="dungeonTestClears">'+
 [1,2,3,4,5,6,7,8,9,10].map(n=>'<option value="'+n+'">'+n+'회</option>').join('')+'</select></label>'+
 '<label>특수보상 <select id="dungeonClaimMode">'+
 '<option value="current">현재 획득 기록 기준</option>'+
 '<option value="never_claimed">미획득 가정</option></select></label>'+
 '<label id="dungeonTestKeyControl" hidden>고리의 열쇠 <select id="dungeonTestKey">'+
 '<option value="auto">획득 후 즉시 사용</option>'+
 '<option value="retain">획득 후 보유 유지</option>'+
 '<option value="owned">매 회차 보유</option>'+
 '<option value="absent">매 회차 미보유</option></select></label>'+
 '<button id="dungeonTestRun" type="button">관문 드랍 계산</button></div>'+
 '<div id="dungeonTestResults" aria-live="polite"></div></section>';
 const gateCtrl=host.querySelector('#dungeonTestGate');
 const keyCtrl=host.querySelector('#dungeonTestKeyControl');
 const sync=()=>{const on=gateCtrl.value==='유씨별원';
  keyCtrl.hidden=!on;keyCtrl.style.setProperty('display',on?'grid':'none','important');
 };
 const run=()=>{
  const resultArea=host.querySelector('#dungeonTestResults');
  try{
   const gate=gateCtrl.value;
   const clears=Number(host.querySelector('#dungeonTestClears').value);
   const mode=host.querySelector('#dungeonClaimMode').value;
   const key=host.querySelector('#dungeonTestKey').value;
   const out=predictGate(save,gate,clears,key,mode);
   let html=mode==='never_claimed'?
    '<p class="micro">미획득 가정: 보상 획득 기록·특수 지급 플래그만 초기화. 원본 시드와 임무 진행 상태는 유지합니다.</p>':'';
   for(const clear of out.output){
    html+='<h4>'+clear.clear+'회차</h4><div class="table-scroll">'+
     '<table style="min-width:620px;table-layout:fixed;width:100%">'+
     '<colgroup><col style="width:22%"><col style="width:29%">'+
     '<col style="width:16%"><col style="width:33%"></colgroup>'+
     '<thead><tr><th>보스</th><th>장비</th><th>색상</th><th>특수보상</th></tr></thead><tbody>';
    for(const row of clear.results){
     const gradeColor={백색:'#a2a2a2',녹색:'#259b61',
      청색:'#397db3',자색:'#9052c4'}[row.grade]||'';
     const confirmed=[...new Set(row.special.map(item=>item.name))];
     const uncertain=[...new Set(row.unresolved)];
     const specials=[
      ...confirmed.map(x=>esc(x)),
      ...uncertain.map(x=>esc(x)+' (미확정)')
     ];
     html+='<tr><td>'+esc(row.boss)+'</td><td>'+esc(row.name)+'</td><td>'+
      (row.grade?'<b style="color:'+gradeColor+'">'+esc(row.grade)+'</b>':'—')+
      '</td><td style="overflow-wrap:anywhere">'+
      (specials.length?specials.join(', '):'—')+'</td></tr>';
    }
    html+='</tbody></table></div>';
   }
   if(out.incomplete)
    html+='<p class="micro">원본 재료 가중치 소진 · '+out.stoppedAt+'회차부터 미확정</p>';
   resultArea.innerHTML=html;
  }catch(error){resultArea.innerHTML='<p class="role-status-note">'+
    esc(error?.message||error)+'</p>';}
 };
 gateCtrl.addEventListener('change',()=>{sync();run();});
 sync();
 host.querySelector('#dungeonTestRun').onclick=run;
 run();
}
