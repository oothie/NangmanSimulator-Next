/* Korean 60014 source-branch dungeon test engine.
 * Public code has NO seed, account, equipment instance, or save-derived data.
 * 13 launched-boss source pools / typed branch order, not a certified future oracle.
 */
import {draw} from './dungeon.js';
export const GATES=['연왕부','창옥','벽유교','유씨별원'];
const GRADE=['','백색','녹색','청색','자색'];
const NAMES={4009:'수라장갑',4209:'지수검',4409:'천운도',4609:'흑살곤',
 4809:'옥형 허리띠',5009:'자미아대',5209:'오잠보갑',5409:'청운반지',5609:'청운추'};
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
const SPECIAL_KO={8915:'고리의 열쇠',3523:'몰우전'};
function number(x){let v=Number(x?.Value??x?.value??x);return Number.isFinite(v)?v:0}
function countItem(save,id){
 let sum=0;
 for(const entry of save?.Items||[])if(number(entry?.ID??entry?.id)===id)
  sum+=Math.max(0,number(entry?.Num??entry?.Count??entry?.count??1));
 return sum;
}
function weighted(rng,key,entries){
 const total=entries.reduce((s,x)=>s+x[0],0),x=rng(key,total);
 let rem=x;
 for(const [weight,output] of entries){rem-=weight;if(rem<=0)return output}
 throw Error('원본 색상·장비 분기 선택 오류');
}
function colorTable(npc){
 if(npc===33650)return [[5,4],[44,1],[16,3],[45,2]];
 if(npc===35260)return [[40,2],[5,4],[40,1],[15,3]];
 return [[30,2],[5,4],[50,1],[15,3]];
}
function equipmentBranch(npc){return npc===33652?[[50,true],[10,false],[40,false]]:[[50,true],[50,false]]}
function slotBounds(gate,npc,length){return npc===35221?4:length}
function seedName(gate,npc){
 if(gate==='벽유교')return 'seed_byj';
 if(gate==='유씨별원')return 'seed_lsby';
 if(gate==='창옥')return 'seed_dcy_'+npc;
 return 'seed_'+npc;
}
function specialsFor(npc,gv){
 const group=SPECIAL[npc]||[];
 const results=[],available=[];
 for(const [item,flag,counter,cap] of group){
  const count=counter?number(gv[counter]):0;
  const eligible=!counter||(cap===0?count===0:count<cap);
  if(eligible)available.push(item);
  if(number(gv[flag])===1){
   results.push({name:SPECIAL_KO[item]||'특수 보상',kind:eligible?'조건 충족':'지급 상한 도달'});
  }
 }
 return {results,candidateCount:available.length,totalCount:group.length};
}
function createState(save){
 if(!save||typeof save!=='object')throw Error('세이브를 먼저 불러와 주세요.');
 const seeds=save?.Rnds?.Sds;
 if(!seeds||typeof seeds!=='object')throw Error('관문 시드가 저장된 세이브가 아닙니다.');
 return {seeds:{...seeds},gv:{...(save.globalVariable||{})}};
}
function sourceRoll(state,key,bound){
 const seed=number(state.seeds[key]);
 if(!Number.isSafeInteger(seed)||seed<1)throw Error('이 관문의 실행 시드가 세이브에 없습니다.');
 const rolled=draw(seed,bound);state.seeds[key]=rolled.seed;return rolled.value;
}
// Recovered 40389/35227 entry producer: special rolls occur BEFORE
// equipment rolls and therefore affect equipment ID/grade. This is distinct
// from the later consumer's get_* delivery cap.
function beforeBoss(state,save,gate,npc){
 if(gate!=='창옥'&&gate!=='벽유교')return;
 const gv=state.gv,key=seedName(gate,npc);
 const rng=bound=>sourceRoll(state,key,bound);
 const g=name=>number(gv[name]);
 const setIf=(flag,hit)=>{if(hit)gv[flag]=1;else delete gv[flag]};
 const threshold=(flag,offset,limit,lower=1000)=>{
  const x=rng(lower);
  setIf(flag,x-offset<limit&&!g(flag));
 };
 const accumulating=(flag,counter,bound,limit,onHit,onMiss)=>{
  const x=rng(bound),offset=g(counter);
  if(x-offset<limit){gv[flag]=1;gv[counter]=offset+onHit}
  else{delete gv[flag];gv[counter]=offset+onMiss}
 };
 const material=(caps)=>{
  // Original material table has one fixed weight 200 plus dynamically active
  // entries; later material selection changes future num_* counters and is
  // intentionally not invented in this test-only simulator.
  let total=200;
  for(const [id,cap,weight] of caps)
   if(g('num_'+id+'_'+npc)<cap)total+=weight;
  rng(total);
 };
 const win=g('win_'+(gate==='창옥'?'dcy':'byj'));
 if(gate==='창옥'){
  if(npc===40372){
   threshold('drop_4634_40372',win*2,51);
   threshold('drop_9072_40372',win,41);
   threshold('drop_3523_40372',win,201);
   accumulating('drop_2924_40372','roll_2924_40372',1000,400,-600,400);
   material([[2601,1000,1000],[2603,6,25],[2604,6,25],[2605,6,25],
    [2606,6,25],[2607,1000,1000],[2641,100,80]]);
  }else if(npc===40373){
   threshold('drop_4820_40373',win*2,51);
   threshold('drop_9072_40373',win,41);
   accumulating('drop_2926_40373','roll_2926_40373',1000,300,-700,400);
   material([[3025,1500,1000],[3029,500,500],[3030,500,500],
    [2000,100,50],[2001,100,50],[2002,100,50]]);
  }else if(npc===40374){
   threshold('drop_5218_40374',win*2,51);
   threshold('drop_9072_40374',win,41);
   threshold('drop_8295_40374',win,41);
   threshold('drop_7165_40374',win,21);
   accumulating('drop_2925_40374','roll_2925_40374',1000,400,-600,400);
  }
 }else{
  if(npc===35219){
   if(win>2)threshold('drop_7264_35219',win,71);
   threshold('drop_7265_35219',win,71);
  }else if(npc===35214){
   accumulating('drop_2922_35214','roll_2922_35214',100,45,-55,45);
   if(win>10){
    threshold('drop_7262_35214',win,51);
    threshold('drop_7263_35214',win,51);
   }
  }else if(npc===35221){
   accumulating('drop_2923_35221','roll_2923_35221',100,45,-55,45);
   if(win>5)threshold('drop_7267_35221',win,51);
   threshold('drop_7266_35221',win,101);
   const branch=save?.Branch?.byj_bz;
   const step=branch&&typeof branch==='object'?number(branch.step):null;
   if(win>=10&&step!==null&&step<0&&!g('glm_open'))
    accumulating('drop_3970_35221','roll_3970_35221',100,10,-50,10);
  }
 }
}
function buildBoss(state,save,gate,boss,keyOwned){
 const [name,npc,pool]=boss,key=seedName(gate,npc);
 const rng=(k,b)=>sourceRoll(state,k,b);
 beforeBoss(state,save,gate,npc);
 // Original 35271 producer skips the dedicated 8915 roll if the key
 // is held on entry. This changes subsequent equipment/colour RNG calls.
 // The independent receipt/consumption timeline is not available in a save.
 if(gate==='유씨별원'&&npc===35264&&!keyOwned)rng(key,1000);
 const gateHit=weighted(rng,key,equipmentBranch(npc));
 const slot=gateHit?rng(key,slotBounds(gate,npc,pool.length)):null;
 const alwaysColor=gate==='벽유교';
 const grade=(slot!==null||alwaysColor)?weighted(rng,key,colorTable(npc)):0;
 const special=specialsFor(npc,state.gv);
 const warnings=[];
 if(gate==='유씨별원'&&npc===35264){
  warnings.push(keyOwned?'고리의 열쇠 보유: 열쇠 추첨 호출 생략 조건':'고리의 열쇠 미보유: 특수 열쇠 추첨 분기 대상');
 }
 return {boss:name,name:slot===null?'미드랍':NAMES[pool[slot-1]],
   grade:slot===null?'':GRADE[grade],special:special.results,
   specialCandidates:special.candidateCount,specialTotal:special.totalCount,warnings};
}
export function predictGate(save,gate,clears=1,keyMode='auto'){
 if(!GATES.includes(gate))throw Error('현재 출시된 4관문만 지원합니다.');
 if(!Number.isInteger(clears)||clears<1||clears>10)throw Error('1~10회 범위를 선택해 주세요.');
 const state=createState(save),output=[],owned=countItem(save,8915)>0;
 const held=keyMode==='owned'?true:keyMode==='absent'?false:owned;
 for(let i=1;i<=clears;i++){
  const group=[];
  // Source-gated trace uses typed LuaJIT weight/insertion order. Complete
  // pre-award material and special event RNG is not reconstructed for all
  // gates, hence these results are deliberately marked as conditional.
  for(const b of POOLS[gate])group.push(buildBoss(state,save,gate,b,held));
  output.push({clear:i,results:group});
  state.gv['win_'+({창옥:'dcy',벽유교:'byj',연왕부:'ywf',유씨별원:'lsby'}[gate])]=
   number(state.gv['win_'+({창옥:'dcy',벽유교:'byj',연왕부:'ywf',유씨별원:'lsby'}[gate])])+1;
 }
 return {gate,output,conditional:true,keyHeld:held,
  caution:'장비 지급 배열과 창옥·벽유교 선행 특수 추첨은 원본 기반입니다. 연왕부·유씨별원의 일부 선행 호출, 재료 후처리 및 반복 클리어 상태 변경은 미완성이므로 장비 색상·특수 보상은 실측 확인이 필요한 조건부 결과입니다.',
  keyNote:gate==='유씨별원'?'고리의 열쇠 보유 시 원본에서 전용 추첨 호출이 생략됩니다. 세이브 보유 수량과 누적 지급 기록은 서로 다릅니다.':''};
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function mountDungeon(host,save){
 if(!host)return;
 host.innerHTML='<section class="card"><h3>관문 일반 장비 드랍 (테스트)</h3>'+
 '<p class="micro">원본 지급 배열을 사용하는 조건부 시뮬레이션입니다. 현재는 장비명·색상만 확인하며, 실제 드랍으로 확정하지 않습니다.</p>'+
 '<div class="market-goal-controls"><label>관문 <select id="dungeonTestGate">'+
 GATES.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label>'+
 '<label>연속 클리어 <select id="dungeonTestClears">'+
 [1,2,3,4,5,6,7,8,9,10].map(n=>'<option value="'+n+'">'+n+'회</option>').join('')+'</select></label>'+
 '<label>고리의 열쇠 (유씨별원)<select id="dungeonTestKey">'+
 '<option value="auto">세이브 보유 기준</option><option value="owned">보유한 경우</option><option value="absent">미보유인 경우</option>'+
 '</select></label><button id="dungeonTestRun" type="button">관문 드랍 계산</button></div>'+
 '<div id="dungeonTestResults" aria-live="polite"></div></section>';
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
    html+='<h4>'+clear.clear+'회차</h4><div class="table-scroll"><table><thead><tr><th>보스</th><th>장비</th><th>색상</th><th>특수 드랍·조건</th></tr></thead><tbody>';
    for(const row of clear.results){
     const gradeColor={백색:'#a2a2a2',녹색:'#259b61',청색:'#397db3',자색:'#9052c4'}[row.grade]||'';
     const specials=row.special.map(s=>esc(s.name)+' · '+esc(s.kind)).join(', ');
     const extra=row.warnings.map(esc).join(' · ');
     const detail=[specials,extra,'특수 보상 후보 '+row.specialCandidates+'종 (추첨 결과 미확정)'].filter(Boolean).join(' / ');
     html+='<tr><td>'+esc(row.boss)+'</td><td>'+esc(row.name)+'</td><td>'+
     (row.grade?'<b style="color:'+gradeColor+'">'+esc(row.grade)+'</b>':'—')+
     '</td><td>'+detail+'</td></tr>';
    }
    html+='</tbody></table></div>';
   }
   out.innerHTML=html;
  }catch(err){out.innerHTML='<p class="role-status-note">'+esc(err.message||err)+'</p>'}
 };
 host.querySelector('#dungeonTestRun').onclick=run;
 run();
}
