(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ko = value => window.SBJ_KOREAN?.translate?.(String(value ?? '')) || String(value ?? '');
  const panel = $('wildDrop'), picker = $('wildTarget'), form = panel.querySelector('form');
  const targets = window.SBJWildCatalog, engine = window.SBJWildDrop, tomb = window.SBJTombDrop;
  const color = ['', '백색 장비', '녹색 장비', '청색 장비', '자색 장비'];
  let archive, input, rows = [];

  function node(tag, text, cls) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (cls) element.className = cls;
    return element;
  }

  function reset() {
    rows = [];
    $('wildStatus').textContent = '';
    $('wildResults').replaceChildren();
    $('wildExport').disabled = true;
  }

  function configure() {
    reset();
    const target = targets[Number(picker.value)], tiger = target.kind === 'tigerbone', timed = target.kind === 'aidrop', isTomb = target.kind === 'tomb';
    input = isTomb ? tomb.open(archive) : engine.open(archive, target);
    const storyCalls=target.kind==='story';
    $('wildPadLabel').textContent=storyCalls?'선행 특수몹 보상 함수 호출 횟수':'선행 사냥 횟수';
    $('wildCountLabel').textContent=storyCalls?'특수몹 보상 함수 예측 호출 횟수':'예측 횟수';
    $('wildBaitField').hidden = !tiger;
    // The previous two simplistic sort options failed actual Diling hunting.
    // Keep the legacy comparison input hidden; use the 144-order panel above.
    $('wildTombOrderField').hidden = true;
    $('wildTiming').hidden = !timed;
    $('wildTime').disabled = $('wildInterval').disabled = !timed;
    const ready = isTomb ? tomb.ready(input) : engine.usable(input.seed) && (!tiger || engine.usable(input.tigerSeed));
    $('wildRun').disabled = !ready || isTomb;
    const label = isTomb ? '제릉은 위의 전용 예측 화면에서 계산하세요. 기존 오름차순/내림차순 두 결과는 10회차 수라장갑 백색 실측과 불일치해 단독 예측을 중지했습니다. 시각 대신 저장된 90레벨 장비별 Eds를 옵션 순서에 활용하며, 분기 순서는 아직 검증되지 않았습니다.' : tiger
      ? '원본 실행 순서에 따라 호랑이 종류와 호골 천장을 예측합니다. 현재 호골 연속 미획득 ' + input.drought + '회.'
      : timed ? '드랍 여부와 품질은 세이브 순서로 예측합니다. 장비 옵션은 입력한 판정 시각에 따라 달라집니다.'
        : '원본 보상 함수를 직접 호출하는 특수몹 드랍 시뮬레이션입니다. 표시 회차는 전체 일반 필드 사냥 횟수가 아닙니다. 별도 특수몹 출현 순서가 연결되기 전까지 일반 사냥 1회당 이 함수를 한 번 호출한다고 해석하면 안 됩니다.';
    const tombMissing = isTomb && archive ? [!engine.usable(input.encounterSeed) ? 'rollenemy_tomb' : '', !engine.usable(input.equipmentSeed) ? 'seed_35256' : '', ...input.missingFlags].filter(Boolean) : [];
    $('wildHint').textContent = ready ? label : !archive ? '세이브를 불러오면 필드 드랍 순서를 읽을 수 있습니다.' : tombMissing.length ? '제릉 분석용 세이브 항목 누락: ' + tombMissing.join(', ') + '. 현재 상태에서는 예측하지 않습니다.' : '현재 세이브에 해당 대상의 전체 드랍 순서가 없습니다.';
  }

  function refreshArchive() {
    forecastReset();
    const previous = picker.value;
    try { archive = window.loadShareStore?.()?.data || null; }
    catch (_) { archive = null; }
    picker.replaceChildren();
    let firstReady = null;
    targets.forEach((target, i) => {
      const saved = target.kind === 'tomb' ? tomb.open(archive) : engine.open(archive, target);
      const ready = target.kind === 'tomb' ? tomb.ready(saved) : engine.usable(saved.seed) && (target.kind !== 'tigerbone' || engine.usable(saved.tigerSeed));
      if (ready && firstReady == null) firstReady = i;
      picker.add(new Option(ko(target.location) + ' · ' + ko(target.name) + (ready ? '' : ' · 순서 없음'), i));
    });
    picker.value = previous || String(firstReady ?? 0);
    configure();
  }

  function render() {
    const host = $('wildResults'), onlyHits = $('wildOnlyHits').checked;
    $('wildExport').disabled = !rows.length;
    const quality=$('wildQuality').value;
    const qualifying=rows.filter(row=>quality==='purple'?row.color===4:
      quality==='equip'?Boolean(row.color):true);
    const shown = onlyHits ? qualifying.filter(row => row.itemId || row.spawn) : qualifying;
    const hits = rows.filter(row => !row.padding && row.itemId).length;
    const padding = rows.filter(row => row.padding).length;
    const appearances = rows.filter(row => !row.padding && row.kind === 'tomb' && row.spawn).length;
    const purple = rows.filter(row => !row.padding && row.color === 4).length;
    const story=targets[Number(picker.value)]?.kind==='story';
    $('wildStatus').textContent = (story?'선행 특수몹 보상 호출 ':'선행 사냥 ') + padding + '회 · 예측 ' + (rows.length - padding) + '회 · 드랍 ' + hits + '회 · 자색 ' + purple + '회' + (story?' · 일반 사냥 회차와 별개':rows.some(row => row.kind === 'tomb') ? ' · 제릉 필드 특수몹 등장 ' + appearances + '회 · '+(input.gate3007Unknown?'3007 미확인·조건부':'실험')+' 가설' : '');
    host.replaceChildren(...shown.map(row => {
      const item = node('li', '');
      const label = '제 ' + row.serial + (story?'회 특수몹 보상 호출':'회') + (row.padding ? ' · 선행 사냥' : '') +
        (row.tiger ? ' · ' + row.tiger : '') + (row.kind === 'tomb' ? ' · ' + (row.spawn ? '특수몹 35256' : '일반 전투') : '') + ' · ' + (EQUIP_DATA.equipment?.[row.itemId]?.koName || (row.kind === 'tomb' ? (row.itemId ? '기타 보상 ID ' + row.itemId : row.spawn ? '장비 드랍 없음' : '예상 드랍 없음') : ko(row.itemName || '예상 드랍 없음'))) +
        (row.color ? ' · ' + color[row.color] : '');
      item.append(node('strong', label));
      if (row.kind === 'tomb') item.append(node('span', row.color ? '90레벨 장비 · 분기 순서 미검증 · 장비 추가 옵션/최종 정련은 미연결' : row.reason || (row.spawn ? '90레벨 일반 장비 이외 보상 또는 드랍 없음' : '특수몹 미등장'), 'wild-row-note'));
      if (row.tiger) item.append(node('span', '호골 연속 미획득 ' + row.droughtBefore + ' → ' + row.droughtAfter, 'wild-row-note'));
      if (row.color > 1 && row.kind !== 'tomb') {
        const attrs = row.affixes?.map(({prop, value}) => {
          const label = EQUIP_DATA.propNames?.[prop] || EQUIP_DATA.props?.[prop] || prop;
          const percent = value < 1 || prop === 'atk_extend';
          const display = percent ? (Math.round(value * 10000) / 100) + '%' : value;
          return ko(label) + ' ' + display;
        });
        item.append(node('span', attrs ? attrs.join(' · ') || '추가 옵션 없음' : '장비 옵션 계산에 필요한 데이터가 없습니다', 'wild-row-note'));
      }
      if (row.time) {
        const time = new Date((row.time + 28800) * 1000).toISOString().slice(0, 19).replace('T', ' ');
        item.append(node('span', '옵션 판정 시각 ' + time + ' 기준', 'wild-row-note'));
      }
      return item;
    }));
    if (!shown.length) host.append(node('li', quality==='purple'?'선택 범위에서 자색 장비 드랍이 예측되지 않았습니다.':'이 구간에서는 드랍이 없습니다.'));
  }

  // Field forecast across ALL candidate Lua weight traversal orders.
  // No clock input: level-90 equipment options use Rnds.Eds[itemId], while
  // only low-level aidrop rolls use a time-derived initial option seed.
  let tombForecastSummary=[];
  const forecastHost=$('tombForecastOutput'),forecastStatus=$('tombForecastStatus');
  const forecastCount=$('tombForecastCount'),forecastPad=$('tombForecastPad');
  const forecastCsv=$('tombForecastCsv');
  const evidenceOn=$('tombEvidenceApply'),evidenceNoEarlier=$('tombEvidenceNoEarlier');
  const colorName=n=>color[n]||'등급 미확인';
  const gearName=id=>EQUIP_DATA.equipment?.[id]?.koName||
    ko(EQUIP_DATA.equipment?.[id]?.name||'장비 #'+id);
  const forecastValue=row=>row.color?
    gearName(row.itemId)+' ('+colorName(row.color)+')':
    row.itemId?'기타 보상 #'+row.itemId:
    row.spawn?'장비 없음':'일반 전투';
  function forecastCell(tr,value,tag='td',className=''){
   const cell=node(tag,value,className);tr.append(cell);
  }
  function forecastReset(){
   tombForecastSummary=[];
   forecastHost.replaceChildren();
   forecastCsv.disabled=true;
   forecastStatus.textContent='새 시드 상태로 예측하려면 위 버튼을 누르세요.';
  }
  function summarizeCandidates(candidates,pad,count){
   const result=[];
   for(let serial=pad+1;serial<=pad+count;serial++){
    const rows=candidates.map(x=>x.rows[serial-1]);
    const first=rows[0];
    const outputs=[...new Set(rows.map(forecastValue))];
    const gearRows=rows.filter(x=>x.color);
    const onlyOne=outputs.length===1;
    const allGear=gearRows.length===rows.length;
    const allNoGear=gearRows.length===0;
    result.push({
      serial,spawn:first.spawn,alternatives:outputs.length,examples:outputs.slice(0,4),
      label:onlyOne?outputs[0]:'미확정 · '+outputs.length+'종류의 결과 후보',
      color:onlyOne?first.color||0:0,
      gearState:allGear?'모든 후보 장비':allNoGear?'모든 후보 장비 없음':'장비 드랍 여부 미확정',
      confirmedByModel:onlyOne,
      trackedEds:onlyOne&&first.color?first.sharedEdsTracked:null
    });
   }
   return result;
  }
  function showForecast(summary,candidates,count,pad,observed){
   const seen=summary.filter(x=>x.spawn).length;
   const agreed=summary.filter(x=>x.confirmedByModel&&x.spawn).length;
   const box=node('div','','tomb-prediction-metrics');
   for(const [name,value] of [
     ['앞으로 사냥',count+'회'],['특수몹 예상',seen+'회'],
     ['보상 후보',candidates.length+'/144'],['특수몹 보상 합의',agreed+'회']
   ]){
     const stat=node('span','');stat.append(node('b',value),node('small',name));box.append(stat);
   }
   const article=node('article','');
   article.append(node('h3','회차별 예측 · 후보가 다르면 미확정 표시'));
   const scroll=node('div','','tomb-prediction-scroll');
   const table=node('table','','tomb-prediction-table');
   const head=document.createElement('thead'),tr=document.createElement('tr');
   for(const label of ['사냥','특수몹','90레벨 장비 / 보상','판정'])forecastCell(tr,label,'th');
   head.append(tr);table.append(head);
   const body=document.createElement('tbody');
   for(const x of summary){
     const tr=document.createElement('tr');
     if(x.spawn)tr.classList.add('tomb-special');
     forecastCell(tr,x.serial+'회');
     forecastCell(tr,x.spawn?'35256 등장':'일반 전투');
     const result= x.confirmedByModel?x.label:
       x.label+' · '+x.examples.join(' / ')+(x.alternatives>4?' 외':'');
     forecastCell(tr,result,'td',x.confirmedByModel?'tomb-known':'tomb-unknown');
     forecastCell(tr,x.confirmedByModel?(x.trackedEds===false?'장비 Eds 누락':'후보들 일치'):'추가 실측 필요');
     body.append(tr);
   }
   table.append(body);scroll.append(table);article.append(scroll);
   forecastHost.append(box,article);
   if(observed){
     forecastHost.append(node('p',candidates.length+'개 순서 후보가 현재 입력한 10회차 실측에 부합합니다. 같은 결과가 나오는 모델이 여러 개이므로 다음 드랍을 확정할 수는 없습니다.','progress-note'));
   }
   forecastHost.append(node('p','정렬 순서 144개를 동일한 가능성으로 취급한 것이 아니며, 후보 개수는 드랍 확률을 뜻하지 않습니다. 등장 순서 자체가 잘못됐다면 이 계산도 불일치할 수 있습니다.','progress-note'));
  }
  function runTombForecast(){
   forecastHost.replaceChildren();tombForecastSummary=[];forecastCsv.disabled=true;
   const count=Number(forecastCount.value),pad=Number(forecastPad.value);
   if(!Number.isInteger(count)||count<1||count>500||!Number.isInteger(pad)||pad<0||pad>500||count+pad>500){
    forecastStatus.textContent='앞선 사냥 + 앞으로의 사냥 합계는 최대 500회입니다.';return;
   }
   if(!archive){forecastStatus.textContent='먼저 사냥 전 세이브를 불러오세요.';return;}
   const current=tomb.open(archive);
   if(!tomb.ready(current)){
    const missing=[...current.missingFlags,
      !engine.usable(current.encounterSeed)?'rollenemy_tomb':'',
      !engine.usable(current.equipmentSeed)?'seed_35256':''].filter(Boolean);
    forecastStatus.textContent='예측에 필요한 세이브 데이터 누락: '+missing.join(', ');return;
   }
   try{
    const observed=evidenceOn.checked;
    const constraints=observed?[{serial:10,itemId:4009,color:1,spawn:true,
      noGearBefore:evidenceNoEarlier.checked}]:[];
    const search=tomb.fitObservations(current,constraints,{count:count+pad});
    if(!search.matches.length){
      forecastStatus.textContent='실측 기록에 맞는 보상 순서 후보가 없습니다. 현재 세이브가 그 10회 사냥 직전 파일인지 확인하세요. 시드 보정은 적용하지 않았습니다.';
      return;
    }
    tombForecastSummary=summarizeCandidates(search.matches,pad,count);
    showForecast(tombForecastSummary,search.matches,count,pad,observed);
    const missing=Object.values(current.eds||{}).length===0?' · 장비별 Eds 저장이 없어 옵션 시드는 일부 미연결입니다.':'';
    forecastStatus.textContent=count+'회 제릉 필드 예측 · '+search.matches.length+
      '/'+search.tested+'개 분기 순서 후보'+
      (observed?' · 10회차 수라장갑 백색 실측 제약 적용':' · 실측 제약 미적용')+
      (current.gate3007Unknown?' · 진행 조건 3007 미기록 (통과 가정)':'')+missing;
    forecastCsv.disabled=false;
   }catch(error){forecastStatus.textContent='제릉 계산 오류: '+String(error.message||error);}
  }
  $('tombForecastRun').onclick=runTombForecast;
  for(const e of [forecastCount,forecastPad,evidenceOn,evidenceNoEarlier])
    e.addEventListener('change',forecastReset);
  evidenceOn.onchange=()=>{
    evidenceNoEarlier.disabled=!evidenceOn.checked;
    if(!evidenceOn.checked)evidenceNoEarlier.checked=false;
    forecastReset();
  };
  forecastCsv.onclick=()=>{
   if(!tombForecastSummary.length)return;
   window.SBJDropExport.save('Nangman_Diling_Candidate_Consensus',[
    {title:'사냥 회차',key:'serial'},
    {title:'특수몹 등장',value:x=>x.spawn?'예':'아니오'},
    {title:'결과 합의 여부',value:x=>x.confirmedByModel?'모든 후보 동일':'미확정'},
    {title:'보상 결과',key:'label'},
    {title:'다른 후보 종류',key:'alternatives'},
    {title:'대표 후보',value:x=>x.examples.join(' / ')},
    {title:'90레벨 장비 Eds 추적',value:x=>x.trackedEds===true?'추적':x.trackedEds===false?'시드 누락':'미확정/해당 없음'},
    {title:'검증 상태',value:()=> 'Lua 순서 144개 중 조건 충족 후보 · 실제 서버 분기 미검증 · 시간 보정 없음'}
   ],tombForecastSummary);
  };
  $('wildTime').value = new Date(Date.now() + 28800000).toISOString().slice(0, 19);
  picker.onchange = configure;
  for (const id of ['wildPad', 'wildCount', 'wildBait', 'wildTime', 'wildInterval', 'wildTombOrder']) $(id).addEventListener('input', reset);
  $('wildOnlyHits').onchange = () => { if (rows.length) render(); };
  $('wildQuality').onchange = () => { if (rows.length) render(); };
  $('wildExport').onclick=()=>{
    try{
      const mode=$('wildQuality').value;
      const scoped=rows.filter(row=>(mode==='purple'?row.color===4:mode==='equip'?!!row.color:true)&&
        (!$('wildOnlyHits').checked||row.itemId||row.spawn));
      const target=targets[Number(picker.value)];
      const fields=[
        {title:'회차',key:'serial'},
        {title:'선행/본회차',value:row=>row.padding?'선행':'예측'},
        {title:'지역',value:()=>ko(target.location)},
        {title:'NPC ID',value:row=>row.npcId||target.npcId},
        {title:'장비/아이템 ID',key:'itemId'},
        {title:'한국판 이름',value:row=>EQUIP_DATA.equipment?.[row.itemId]?.koName||
          ko(row.itemName||'')},
        {title:'색상',value:row=>color[row.color]||''},
        {title:'예상 추가 옵션(검증 전)',value:row=>row.affixes?
          row.affixes.map(a=>a.prop+':'+a.value).join('; '):''},
        {title:'한계',value:row=>target.kind==='tomb'?'제릉 분기 가설·최종 정련/망정 미연결':
          target.kind==='story'?'특수몹 보상 호출 · 일반 사냥 회차 아님 · 최종 정련/망정 미연결':
          '세이브 시드 기반 가상 계산 · 실게임/최종 정련 검증 필요'}
      ];
      window.SBJDropExport.save('Nangman_Wild_Drop_'+target.npcId,fields,scoped);
    }catch(err){$('wildStatus').textContent=String(err.message||err);}
  };

  form.onsubmit = event => {
    event.preventDefault();
    reset();
    const target = targets[Number(picker.value)];
    const pad = Number($('wildPad').value), count = Number($('wildCount').value);
    const interval = Number($('wildInterval').value), bait = $('wildBait').value;
    const time = Math.floor(Date.parse($('wildTime').value + '+08:00') / 1000);
    try {
      if (target.kind === 'tomb') throw Error('제릉은 위의 전용 144분기 후보 예측을 사용하세요. 이전 두 가설은 실측과 불일치합니다.');
      if (target.kind === 'aidrop' && !engine.usable(time)) throw Error('올바른 첫 사냥 판정 시각을 입력하세요.');
      rows = target.kind === 'tomb' ? tomb.predict(input, {pad, count, order: $('wildTombOrder').value}) : engine.predict(input, target, {pad, count, interval, bait, time}, EQUIP_DATA.equipment);
      render();
    } catch (error) { $('wildStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshArchive);
  refreshArchive();
})();
