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

  function missingReason(target, saved) {
    if (!archive) return '세이브 필요';
    if (target.kind === 'tomb') {
      const missing = [
        !engine.usable(saved.encounterSeed) ? '조우 시드' : '',
        !engine.usable(saved.equipmentSeed) ? '장비 드랍 시드' : '',
        ...(saved.missingFlags || [])
      ].filter(Boolean);
      return missing.length ? missing.join('·') + ' 누락' : '';
    }
    const missing = [];
    if (!engine.usable(saved.seed)) missing.push('드랍 시드');
    if (target.kind === 'tigerbone' && !engine.usable(saved.tigerSeed)) missing.push('호랑이 종류 시드');
    if (target.encounter) {
      if (!engine.usable(saved.encounterSeed)) missing.push('특수몹 조우 시드');
      if (!Number.isFinite(saved.encounterScore)) missing.push('조우 누적값');
      if (!Number.isFinite(saved.encounterBoost)) missing.push('조우 보정값');
    }
    return missing.join('·') + (missing.length ? ' 누락' : '');
  }

  function configure() {
    reset();
    const target = targets[Number(picker.value)], tiger = target.kind === 'tigerbone', timed = target.kind === 'aidrop', isTomb = target.kind === 'tomb';
    input = isTomb ? tomb.open(archive) : engine.open(archive, target);
    const storyCalls=target.kind==='story' && !target.encounter;
    const normalHunts=!!target.encounter;
    $('wildPadLabel').textContent=storyCalls?'선행 특수몹 보상 함수 호출 횟수':'선행 사냥 횟수';
    $('wildCountLabel').textContent=storyCalls?'특수몹 보상 함수 예측 호출 횟수':normalHunts?'일반 사냥 횟수':'예측 횟수';
    $('wildBaitField').hidden = !tiger;
    // The previous two simplistic sort options failed actual Diling hunting.
    // Keep the legacy comparison input hidden; use the 144-order panel above.
    $('wildTombOrderField').hidden = true;
    $('wildTiming').hidden = !timed;
    $('wildTime').disabled = $('wildInterval').disabled = !timed;
    const ready = isTomb ? tomb.ready(input) : engine.usable(input.seed) &&
      (!tiger || engine.usable(input.tigerSeed)) &&
      (!normalHunts || engine.usable(input.encounterSeed) &&
        Number.isFinite(input.encounterScore) && Number.isFinite(input.encounterBoost));
    $('wildRun').disabled = !ready;
    const label = normalHunts ?
      '일반 사냥 횟수에 따라 특수몹 등장과 장비 드랍을 순서대로 계산합니다.' :
      isTomb ? '제릉 · 거령 병용 출현과 90레벨 장비 및 기타 보상을 함께 계산합니다. 장비별 옵션 상태도 함께 추적합니다.' : tiger
      ? '원본 실행 순서에 따라 호랑이 종류와 호골 천장을 예측합니다. 현재 호골 연속 미획득 ' + input.drought + '회.'
      : timed ? '드랍 여부와 품질은 세이브 순서로 예측합니다. 장비 옵션은 입력한 판정 시각에 따라 달라집니다.'
        : '원본 보상 함수를 직접 호출하는 특수몹 드랍 시뮬레이션입니다. 표시 회차는 전체 일반 필드 사냥 횟수가 아닙니다. 별도 특수몹 출현 순서가 연결되기 전까지 일반 사냥 1회당 이 함수를 한 번 호출한다고 해석하면 안 됩니다.';
    const tombMissing = isTomb && archive ? [!engine.usable(input.encounterSeed) ? 'rollenemy_tomb' : '', !engine.usable(input.equipmentSeed) ? 'seed_35256' : '', ...input.missingFlags].filter(Boolean) : [];
    $('wildHint').textContent = ready ? label : !archive ? '세이브를 불러오면 필드 드랍 순서를 읽을 수 있습니다.' :
      '현재 세이브: ' + (missingReason(target, input) || tombMissing.join(', ') || '필요한 상태값') +
      '. 해당 지역에서 실제 사냥·보상 판정을 진행한 후 최신 세이브로 다시 확인하세요. 시드가 없는 대상을 다른 시드로 임의 예측하지 않습니다.';
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
      const ready = target.kind === 'tomb' ? tomb.ready(saved) : engine.usable(saved.seed) &&
        (target.kind !== 'tigerbone' || engine.usable(saved.tigerSeed)) &&
        (!target.encounter || engine.usable(saved.encounterSeed) &&
          Number.isFinite(saved.encounterScore) && Number.isFinite(saved.encounterBoost));
      if (ready && firstReady == null) firstReady = i;
      picker.add(new Option(ko(target.location) + ' · ' + ko(target.name) + (ready ? '' : ' · ' + (missingReason(target, saved) || '예측 데이터 누락')), i));
    });
    picker.value = previous || String(firstReady ?? 0);
    configure();
  }

  // Show only equipment rewards, never material receipts. Preserve true battle numbering.
  // Preserve raw rows, seed progression and filtering data for the original engine.
  function render() {
    const host=$('wildResults');
    if (targets[Number(picker.value)].kind === 'tigerbone') {
      const played = rows.filter(row => !row.padding);
      const bones = played.filter(row => Number(row.itemId) === 3065);
      host.replaceChildren(...bones.map(row => {
        const item = node('li', '', 'nm-field-drop');
        item.append(node('span', String(row.serial)+'회 사냥', 'nm-field-round'));
        item.append(node('strong', '호골', 'nm-field-name'));
        item.append(node('span', row.tiger || '', 'nm-field-quality'));
        return item;
      }));
      if (!bones.length) host.append(node('li', '호골 드랍 없음', 'nm-field-empty'));
      $('wildStatus').textContent = played.length+'회 사냥 · 호골 '+bones.length+'개';
      $('wildExport').disabled = true;
      return;
    }
    const shown=rows.filter(row=>!row.padding && row.itemId && Number(row.color)>=1 && Number(row.color)<=4);
    const labels=['','백색','녹색','청색','자색'];
    host.replaceChildren(...shown.map(row=>{
      const item=node('li','', 'nm-field-drop nm-field-grade-'+Number(row.color));
      const name=ko(EQUIP_DATA.equipment?.[row.itemId]?.koName || row.itemName || '장비');
      item.append(node('span',String(row.serial)+(targets[Number(picker.value)].kind==='story'&&!targets[Number(picker.value)].encounter?'회 호출':'회 사냥'),'nm-field-round'));
      item.append(node('strong',name,'nm-field-name'));
      item.append(node('span',labels[Number(row.color)],'nm-field-quality'));
      return item;
    }));
    if(!shown.length)host.append(node('li','장비 드랍 없음','nm-field-empty'));
    const target=targets[Number(picker.value)];
    if(target.encounter){
      const played=rows.filter(row=>!row.padding);
      const found=played.filter(row=>row.spawn).length;
      $('wildStatus').textContent=played.length+'회 일반 사냥 · 특수몹 '+found+'회 · 장비 '+shown.length+'개'+
        '';
    }else $('wildStatus').textContent=target.kind==='story'?
      '이 결과는 특수몹 보상 함수 호출 번호이며 일반 사냥 횟수가 아닙니다.':'';
    $('wildExport').disabled=true;
  }

  // Field forecast across ALL candidate Lua weight traversal orders.
  // No clock input: level-90 equipment options use Rnds.Eds[itemId], while
  // only low-level aidrop rolls use a time-derived initial option seed.
  let tombForecastSummary=[];
  const forecastHost=$('tombForecastOutput'),forecastStatus=$('tombForecastStatus');
  const forecastCount=$('tombForecastCount'),forecastPad=$('tombForecastPad');
  const forecastCsv=$('tombForecastCsv'),eighthEvidence=$('tombEvidenceEighth');
  const colorName=n=>color[n]||'등급 미확인';
  const gearName=id=>EQUIP_DATA.equipment?.[id]?.koName||
    ko(EQUIP_DATA.equipment?.[id]?.name||'장비 #'+id);
  const forecastValue=row=>row.color?
    gearName(row.itemId)+' ('+colorName(row.color)+')':
    row.itemId?'기타 보상 #'+row.itemId:
    row.spawn?'장비 없음':'35256 미등장';
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
  function showForecast(summary,candidates,count,pad){
   const seen=summary.filter(x=>x.spawn).length;
   const agreed=summary.filter(x=>x.confirmedByModel&&x.spawn).length;
   const box=node('div','','tomb-prediction-metrics');
   for(const [name,value] of [
     ['조우 이벤트 호출',count+'회'],['특수몹 발생 가설',seen+'회'],
     ['보상 후보',candidates.length+'/144'],['특수몹 보상 합의',agreed+'회']
   ]){
     const stat=node('span','');stat.append(node('b',value),node('small',name));box.append(stat);
   }
   const article=node('article','');
   article.append(node('h3','회차별 예측 · 후보가 다르면 미확정 표시'));
   const scroll=node('div','','tomb-prediction-scroll');
   const table=node('table','','tomb-prediction-table');
   const head=document.createElement('thead'),tr=document.createElement('tr');
   for(const label of ['이벤트 호출','조건부 특수몹','90레벨 장비 / 보상','판정'])forecastCell(tr,label,'th');
   head.append(tr);table.append(head);
   const body=document.createElement('tbody');
   for(const x of summary){
     const tr=document.createElement('tr');
     if(x.spawn)tr.classList.add('tomb-special');
     forecastCell(tr,x.serial+'번 호출');
     forecastCell(tr,x.spawn?'35256 등장':'35256 미등장');
     const result= x.confirmedByModel?x.label:
       x.label+' · '+x.examples.join(' / ')+(x.alternatives>4?' 외':'');
     forecastCell(tr,result,'td',x.confirmedByModel?'tomb-known':'tomb-unknown');
     forecastCell(tr,x.confirmedByModel?(x.trackedEds===false?'장비 Eds 누락':'후보들 일치'):'추가 실측 필요');
     body.append(tr);
   }
   table.append(body);scroll.append(table);article.append(scroll);
   forecastHost.append(box,article);
   forecastHost.append(node('p','정렬 순서 144개를 동일한 가능성으로 취급한 것이 아니며, 후보 개수는 드랍 확률을 뜻하지 않습니다. 등장 순서 자체가 잘못됐다면 이 계산도 불일치할 수 있습니다.','progress-note'));
  }
  function runTombForecast(){
   forecastHost.replaceChildren();tombForecastSummary=[];forecastCsv.disabled=true;
   const count=Number(forecastCount.value),pad=Number(forecastPad.value);
   if(!Number.isInteger(count)||count<1||count>2000||!Number.isInteger(pad)||pad<0||pad>2000||count+pad>2000){
    forecastStatus.textContent='앞선 이벤트 호출 + 이후 이벤트 호출 합계는 최대 2000회입니다.';return;
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
    // Do not embed account-derived RNG snapshots in the public build.
    // An old private-save-specific evidence preset is intentionally disabled.
    if(eighthEvidence.checked){
      forecastStatus.textContent='과거 특정 세이브의 실측 조건 고정 기능은 공개판에서 지원하지 않습니다.';
      return;
    }
    const constraints=[];
    const search=tomb.fitObservations(current,constraints,{count:Math.max(count+pad,8)});
    if(!search.matches.length){
      forecastStatus.textContent='현재 모델에 맞는 보상 후보가 없습니다. 실제 일반 사냥 회차와 35255 조우 호출 회차를 동일하다고 가정하지 마세요.';
      return;
    }
    tombForecastSummary=summarizeCandidates(search.matches,pad,count);
    showForecast(tombForecastSummary,search.matches,count,pad);
    const missing=Object.values(current.eds||{}).length===0?' · 장비별 Eds 저장이 없어 옵션 시드는 일부 미연결입니다.':'';
    forecastStatus.textContent=count+'회 35255 조우 이벤트 계산 · '+search.matches.length+
      '/'+search.tested+'개 분기 순서 후보'+
      (eighthEvidence.checked?' · 선택한 추가 조건 적용':' · 별도의 실측 조건 미적용')+
      ' · 실제 필드 사냥 횟수와 이벤트 호출 횟수의 매핑 미확정'+
      (current.gate3007Unknown?' · 진행 조건 3007 미기록 (통과 가정)':'')+missing;
    forecastCsv.disabled=false;
   }catch(error){forecastStatus.textContent='제릉 계산 오류: '+String(error.message||error);}
  }
  // Source-scope audit, deliberately NOT labelled '50 wild hunts'.
  // The 8th actual battle's white 4009 cannot automatically be equated to gate call #8
  // without the missing 35255 combat -> walk-event invocation schedule.
  function renderTombGateAudit(){
   const status=$('tombGateStatus'),out=$('tombGateOutput');
   out.replaceChildren();
   if(!archive){
    status.textContent='먼저 제릉 사냥 전 세이브를 불러오세요.';return;
   }
   const state=tomb.open(archive);
   if(!tomb.ready(state)){
    status.textContent='조우 시드/조건 변수 부족: '+
      [...state.missingFlags,!engine.usable(state.encounterSeed)?'rollenemy_tomb':'',
       !engine.usable(state.equipmentSeed)?'seed_35256':''].filter(Boolean).join(', ');
    return;
   }
   try{
    const diagnostic=tomb.traceEncounterCalls(state,50);
    const nine=diagnostic.encounters[8],ten=diagnostic.encounters[9];
    const count=diagnostic.encounters.filter(r=>r.spawn).length;
    status.textContent='원본 35255 조건부 이벤트를 50회 연속 호출한 가상 계산: 특수몹 '+count+
      '회 · 내부 호출 9번 '+(nine.spawn?'등장':'미등장')+
      ', 10번 '+(ten.spawn?'등장':'미등장')+
      ' · 일반 사냥 50회의 정확한 출현 예측이 아닙니다.'+
      (diagnostic.gate3007Unknown?' · 진행 조건 3007 확인 불가':'');
    const table=node('table','','tomb-prediction-table');
    const thead=node('thead',''),head=node('tr','');
    for(const name of ['이벤트 호출','RNG 판정값','비교 기준','결과','다음 기준']){
     forecastCell(head,name,'th');
    }
    thead.append(head);table.append(thead);
    const body=node('tbody','');
    for(const r of diagnostic.encounters){
     const tr=node('tr','','');
     if(r.call===8)tr.classList.add('tomb-gate-mismatch');
     if(r.spawn)tr.classList.add('tomb-special');
     forecastCell(tr,r.call+'번'+(r.call===8?' · 실측 8회와 직접 비교 불가':''));
     forecastCell(tr,r.encounterRoll==null?'게이트 미호출':String(r.encounterRoll));
     forecastCell(tr,r.thresholdBefore==null?'—':String(r.effectiveRoll)+' ≤ '+r.thresholdBefore);
     forecastCell(tr,r.spawn?'35256 등장':'35256 미등장');
     forecastCell(tr,r.thresholdAfter==null?'—':String(r.thresholdAfter));
     body.append(tr);
    }
    table.append(body);out.append(table);
    out.append(node('p','이 표는 실제 8번째 거령 병용 전투에서 수라장갑(4009) 백색을 얻었다는 실측을 취소하거나 설명하지 않습니다. 실제 일반 사냥과 35255 이벤트 호출 사이 관계를 원본 소스로 확인하기 전까지 드랍 회차 확정은 중단합니다.','progress-note'));
   }catch(error){status.textContent='제릉 조우 진단 오류: '+String(error.message||error);}
  }
  $('tombGateRun').onclick=renderTombGateAudit;
  $('tombForecastRun').onclick=runTombForecast;
  for(const e of [forecastCount,forecastPad,eighthEvidence])e.addEventListener('change',forecastReset);
  forecastCsv.onclick=()=>{
   if(!tombForecastSummary.length)return;
   window.SBJDropExport.save('Nangman_Diling_Candidate_Consensus',[
    {title:'35255 이벤트 호출 번호(사냥회차 아님)',key:'serial'},
    {title:'특수몹 등장',value:x=>x.spawn?'예':'아니오'},
    {title:'결과 합의 여부',value:x=>x.confirmedByModel?'모든 후보 동일':'미확정'},
    {title:'보상 결과',key:'label'},
    {title:'다른 후보 종류',key:'alternatives'},
    {title:'대표 후보',value:x=>x.examples.join(' / ')},
    {title:'90레벨 장비 Eds 추적',value:x=>x.trackedEds===true?'추적':x.trackedEds===false?'시드 누락':'미확정/해당 없음'},
    {title:'검증 상태',value:()=> '35255 이벤트 호출 순서 가설 · 실제 일반 사냥 회차 대응 미확정 · 시간 보정 없음'}
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
        {title:'한계',value:row=>target.kind==='tomb'?'제릉 장비 · 최종 정련/망정 미연결':
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
    if(!Number.isInteger(pad)||pad<0||!Number.isInteger(count)||count<1||pad+count>2000){
      $('wildStatus').textContent='선행 사냥과 예측 횟수의 합계는 최대 2000회입니다.';return;
    }
    const interval = Number($('wildInterval').value), bait = $('wildBait').value;
    const time = Math.floor(Date.parse($('wildTime').value + '+08:00') / 1000);
    try {
      if (target.kind === 'aidrop' && !engine.usable(time)) throw Error('올바른 첫 사냥 판정 시각을 입력하세요.');
      rows = target.kind === 'tomb' ? tomb.predict(input, {pad, count, order:'verified',equipment:EQUIP_DATA.equipment}) : engine.predict(input, target, {pad, count, interval, bait, time}, EQUIP_DATA.equipment);
      render();
    } catch (error) { $('wildStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshArchive);
  refreshArchive();
})();
