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
    $('wildTombOrderField').hidden = !isTomb;
    $('wildTiming').hidden = !timed;
    $('wildTime').disabled = $('wildInterval').disabled = !timed;
    const ready = isTomb ? tomb.ready(input) : engine.usable(input.seed) && (!tiger || engine.usable(input.tigerSeed));
    $('wildRun').disabled = !ready;
    const label = isTomb ? '제릉 일반 필드의 100레벨 특수몹 NPC 35256이 드랍하는 90레벨 장비 8종을 원본 60014 분석 자료로 계산합니다. '+(input.gate3007Unknown?'실제 원본 진행 조건 3007이 세이브에 없어, 이후 결과는 해당 조건을 통과했다고 가정한 조건부 가설입니다. ':'')+'분기 순서는 실험 가설이며 실게임 예측은 미검증입니다. NPC 35255 일반 전투에는 90레벨 장비를 임의 지급하지 않습니다.' : tiger
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

  // Dedicated forecast: one imported save, 1..500 sequential outdoor hunts.
  // Both reward-order hypotheses are shown independently; no actual-outcome
  // comparison and no before/after save upload is needed.
  let tombForecasts=[];
  const forecastHost=$('tombForecastOutput'),forecastStatus=$('tombForecastStatus');
  const forecastCount=$('tombForecastCount'),forecastPad=$('tombForecastPad');
  const forecastCsv=$('tombForecastCsv');
  const colorName=n=>color[n]||'등급 미확인';
  const gearName=id=>EQUIP_DATA.equipment?.[id]?.koName||
    ko(EQUIP_DATA.equipment?.[id]?.name||'장비 #'+id);
  function forecastCell(tr,value,tag='td',className=''){
   const cell=node(tag,value,className);tr.append(cell);
  }
  function forecastReset(){
   tombForecasts=[];
   forecastHost.replaceChildren();
   forecastCsv.disabled=true;
   forecastStatus.textContent='제릉 예측을 다시 계산하려면 위 버튼을 누르세요.';
  }
  function forecastTable(caseData){
   const article=document.createElement('article');
   article.append(node('h3',caseData.order==='descending'?'가설 A · 가중치 높은 순':'가설 B · 가중치 낮은 순'));
   const note=node('p','특수몹 '+caseData.rows.filter(x=>x.spawn&&!x.padding).length+
    '회 · 90레벨 장비 '+caseData.rows.filter(x=>x.color&&!x.padding).length+
    '개 · 자색 '+caseData.rows.filter(x=>x.color===4&&!x.padding).length+'개','progress-note');
   article.append(note);
   const scroll=node('div','','tomb-prediction-scroll');
   const table=node('table','','tomb-prediction-table');
   const head=document.createElement('thead'),tr=document.createElement('tr');
   for(const name of ['회차','몬스터','예상 결과','색상'])forecastCell(tr,name,'th');
   head.append(tr);table.append(head);
   const body=document.createElement('tbody');
   for(const x of caseData.rows.filter(x=>!x.padding)){
    const line=document.createElement('tr');
    if(x.spawn)line.classList.add('tomb-special');
    forecastCell(line,String(x.serial)+'회');
    forecastCell(line,x.spawn?'특수몹 35256':'일반 몬스터');
    if(x.color){
     const item=gearName(x.itemId);
     forecastCell(line,item+' (#'+x.itemId+')','td','tomb-gear');
     forecastCell(line,colorName(x.color),'td',x.color===4?'tomb-purple':'');
    }else if(x.itemId){
     forecastCell(line,'기타 보상 #'+x.itemId);
     forecastCell(line,'—');
    }else{
     forecastCell(line,x.spawn?'장비 없음':'—');
     forecastCell(line,'—');
    }
    body.append(line);
   }
   table.append(body);scroll.append(table);article.append(scroll);
   return article;
  }
  function runTombForecast(){
   forecastHost.replaceChildren();
   tombForecasts=[];forecastCsv.disabled=true;
   const count=Number(forecastCount.value),pad=Number(forecastPad.value);
   if(!Number.isInteger(count)||count<1||count>500||!Number.isInteger(pad)||pad<0||pad>500){
    forecastStatus.textContent='사냥 횟수는 1~500회, 선행 사냥은 0~500회로 입력하세요.';return;
   }
   if(!archive){forecastStatus.textContent='상단에서 제릉 사냥 전 세이브를 먼저 불러오세요.';return;}
   const current=tomb.open(archive);
   if(!tomb.ready(current)){
    const missing=[...current.missingFlags,
      !engine.usable(current.encounterSeed)?'rollenemy_tomb':'',
      !engine.usable(current.equipmentSeed)?'seed_35256':''].filter(Boolean);
    forecastStatus.textContent='예측에 필요한 세이브 데이터가 없습니다: '+missing.join(', ');return;
   }
   try{
    tombForecasts=['descending','ascending'].map(order=>({
      order,rows:tomb.predict(current,{count,pad,order})
    }));
    const all=tombForecasts[0].rows.filter(x=>!x.padding);
    const appear=all.filter(x=>x.spawn).length;
    const box=node('div','','tomb-prediction-metrics');
    for(const [label,value] of [
      ['예측 전투',count+'회'],['특수몹 등장',appear+'회'],
      ['선행 건너뛰기',pad+'회'],['장비 드랍 가설', '2가지']
    ]){
     const stat=node('span','');
     stat.append(node('b',value),node('small',label));box.append(stat);
    }
    const grid=node('div','','tomb-prediction-grid');
    for(const hyp of tombForecasts)grid.append(forecastTable(hyp));
    forecastHost.append(box,grid);
    forecastStatus.textContent='제릉 일반 필드 '+count+'회 예측 완료 · 특수몹 회차는 동일 · 장비 종류와 색상은 분기 순서 가설에 따라 다를 수 있습니다.'+
      (current.gate3007Unknown?' · 진행 변수 3007 미기록으로 해당 조건 통과를 가정했습니다.':'');
    forecastCsv.disabled=false;
   }catch(error){forecastStatus.textContent='제릉 계산 오류: '+String(error.message||error);}
  }
  $('tombForecastRun').onclick=runTombForecast;
  forecastCount.addEventListener('input',forecastReset);
  forecastPad.addEventListener('input',forecastReset);
  forecastCsv.onclick=()=>{
   if(!tombForecasts.length)return;
   const rows=tombForecasts.flatMap(entry=>entry.rows.filter(x=>!x.padding).map(row=>({...row,
     hypothesis:entry.order})));
   window.SBJDropExport.save('Nangman_Diling_Field_Forecast',[
    {title:'분기 순서 가설',value:x=>x.hypothesis==='descending'?'A 높은 순':'B 낮은 순'},
    {title:'사냥 회차',key:'serial'},
    {title:'특수몹 등장',value:x=>x.spawn?'예':'아니오'},
    {title:'NPC ID',value:x=>x.spawn?35256:35255},
    {title:'보상 종류',key:'rewardKind'},
    {title:'장비·아이템 ID',key:'itemId'},
    {title:'한국판 이름',value:x=>x.color?gearName(x.itemId):x.itemId?'기타 보상 '+x.itemId:''},
    {title:'예상 색상',value:x=>x.color?colorName(x.color):''},
    {title:'검증 상태',value:()=> '제릉 60014 분기 순서 가설 · 실게임 미검증'}
   ],rows);
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
      if (target.kind === 'aidrop' && !engine.usable(time)) throw Error('올바른 첫 사냥 판정 시각을 입력하세요.');
      rows = target.kind === 'tomb' ? tomb.predict(input, {pad, count, order: $('wildTombOrder').value}) : engine.predict(input, target, {pad, count, interval, bait, time}, EQUIP_DATA.equipment);
      render();
    } catch (error) { $('wildStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshArchive);
  refreshArchive();
})();
