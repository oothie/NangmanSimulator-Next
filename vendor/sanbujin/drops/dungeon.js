(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ko = value => window.SBJ_KOREAN?.translate?.(String(value ?? '')) || String(value ?? '');
  const engine = window.SBJDungeonDrop, catalog = window.SBJDungeonCatalog;
  const groups = [...new Set(catalog.map(event => event.dungeon))];
  const area = $('dungeonArea'), boss = $('dungeonBoss');
  const sections = {wild: $('wildDrop'), dungeon: $('dungeonDrop'), shared: $('sharedGear'), treasure: $('treasureDrop')};
  const links = {wild: $('dropWildLink'), dungeon: $('dropDungeonLink'), shared: $('dropSharedLink'), treasure: $('dropTreasureLink')};
  const colors = ['', '백색 장비', '녹색 장비', '청색 장비', '자색 장비'];
  let input, rows = [];

  function switchMode(current) {
    for (const name of Object.keys(sections)) {
      sections[name].hidden = name !== current;
      links[name].setAttribute('aria-pressed', String(name === current));
    }
  }
  function selected() { return catalog[Number(boss.value)]; }
  function record(name, caption) {
    const item = document.createElement('li'), title = document.createElement('strong');
    title.textContent = name;
    item.append(title);
    if (caption) {
      const detail = document.createElement('span');
      detail.className = 'wild-row-note';
      detail.textContent = caption;
      item.append(detail);
    }
    return item;
  }
  function reset() {
    rows = [];
    $('dungeonStatus').textContent = '';
    $('dungeonResults').replaceChildren();
    $('dungeonExport').disabled=true;
  }
  function render() {
    $('dungeonExport').disabled=!rows.length;
    const quality=$('dungeonQuality').value;
    const scoped=quality==='purple'?rows.filter(row=>row.item&&row.color===4):rows;
    const shown = $('dungeonOnlyHits').checked ? scoped.filter(row => row.item) : scoped;
    $('dungeonStatus').textContent = '예측 완료 ' + rows.length + '회 · ' + rows.filter(row => row.item).length + '회 일반 장비 드랍 · 자색 ' + rows.filter(row => row.item && row.color===4).length + '회';
    $('dungeonResults').replaceChildren(...shown.map(row => record(
      '제 ' + row.index + '회 · ' + (row.item ? (EQUIP_DATA.equipment[row.item]?.koName || ko(EQUIP_DATA.equipment[row.item]?.name) || '장비 #' + row.item) : '일반 장비 없음'),
      row.item ? [colors[row.color], row.kind === 'weapon' ? '일반 무기' : '일반 장비'].filter(Boolean).join(' · ') : ''
    )));
    if (!shown.length) $('dungeonResults').append(record(quality==='purple'?'이 구간에서 자색 장비가 예측되지 않았습니다.':'이 구간에서 일반 장비가 예측되지 않았습니다.'));
  }
  function renderBoss() {
    reset();
    const event = selected();
    const ready = event.outer && !engine.missing(input, event).length;
    $('dungeonRun').disabled = !ready;
    $('dungeonCount').disabled = $('dungeonOnlyHits').disabled = !event.outer;
    $('dungeonHint').textContent = ready
      ? '선택한 우두머리의 보상 판정 구간을 독립적으로 예측합니다. 소탕·다른 우두머리·이벤트가 같은 순서를 사용하면 실제 결과가 달라질 수 있습니다.'
      : event.outer ? '현재 세이브에 해당 우두머리의 난수 순서가 없습니다.' : '이 우두머리는 현재 전용 주황 장비 정보와 세이브 상태를 조회할 수 있습니다.';
    $('dungeonOrange').hidden = !event.orange.length;
    $('dungeonOrangeList').replaceChildren(...event.orange.map(drop => {
      const result = engine.orange(input, drop);
      const labels = {owned: '획득 완료', locked: '이번 회차 드랍 확정', estimated: '예상 제 ' + result.round + '회차 드랍',
        notFound: '앞선 ' + result.round + '회 동안 드랍 예상 없음', missing: '현재 자료가 부족해 드랍 회차를 확정할 수 없습니다'};
      return record(EQUIP_DATA.equipment[drop.id]?.koName || ko(EQUIP_DATA.equipment[drop.id]?.name || drop.name), labels[result.kind]);
    }));
  }
  function fillBosses() {
    boss.replaceChildren();
    const inArea = catalog.filter(event => event.dungeon === area.value);
    inArea.forEach(event => {
      const duplicate = inArea.filter(other => other.boss === event.boss).length > 1;
      boss.add(new Option(ko(event.boss) + (duplicate ? ' · ' + ko(event.variant) : '') +
        (event.outer ? '' : ' · 전용 주황 장비'), catalog.indexOf(event)));
    });
    renderBoss();
  }
  function refreshSave() {
    const oldArea = area.value, oldBoss = boss.value;
    let save;
    try { save = window.loadShareStore?.()?.data; } catch (_) { }
    input = engine.open(save);
    if (!oldArea) {
      const first = catalog.find(event => event.outer && !engine.missing(input, event).length);
      if (first) area.value = first.dungeon;
    }
    fillBosses();
    if (oldBoss && [...boss.options].some(option => option.value === oldBoss)) {
      boss.value = oldBoss;
      renderBoss();
    }
  }
  groups.forEach((group, i) => area.add(new Option(ko(group), group, i === 0)));
  area.onchange = fillBosses;
  boss.onchange = renderBoss;
  $('dungeonOnlyHits').onchange = () => { if (rows.length) render(); };
  $('dungeonQuality').onchange = () => { if (rows.length) render(); };
  $('dungeonExport').onclick=()=>{
    try{
      const event=selected();
      const scoped=rows.filter(row=>($('dungeonQuality').value!=='purple'||row.item&&row.color===4)&&
        (!$('dungeonOnlyHits').checked||row.item));
      const columns=[
        {title:'회차',key:'index'},
        {title:'관문',value:()=>ko(event.dungeon)},
        {title:'우두머리',value:()=>ko(event.boss)},
        {title:'장비 ID',key:'item'},
        {title:'장비명',value:row=>row.item?(EQUIP_DATA.equipment?.[row.item]?.koName||
          ko(EQUIP_DATA.equipment?.[row.item]?.name||'장비 #'+row.item)):''},
        {title:'색상',value:row=>colors[row.color]||''},
        {title:'드랍 구분',key:'kind'},
        {title:'한계',value:()=>'독립 관문 보상 예측 · 공유 RNG 소비에 따라 달라질 수 있음 · 최종 정련/망정 미연결'}
      ];
      window.SBJDropExport.save('Nangman_Dungeon_Drop_'+event.id,columns,scoped);
    }catch(err){$('dungeonStatus').textContent=String(err.message||err);}
  };

  let sequenceRows=[];
  const plan=$('dungeonSequencePlan'),seqStatus=$('dungeonSequenceStatus');
  $('dungeonSequenceAdd').onclick=()=>{
    const event=selected();
    if(!event?.outer)return seqStatus.textContent='일반 장비 보상 함수가 있는 우두머리를 선택하세요';
    const rows=plan.value.split(/[\s,;]+/).filter(Boolean);
    if(rows.length>=500)return seqStatus.textContent='연속 보상 호출은 최대 500회입니다';
    rows.push(event.id);
    plan.value=rows.join(', ');
  };
  $('dungeonSequenceRun').onclick=()=>{
    sequenceRows=[];
    $('dungeonSequenceExport').disabled=true;
    $('dungeonSequenceResults').replaceChildren();
    try{
      const ids=plan.value.split(/[\s,;]+/).filter(Boolean);
      if(!ids.length||ids.length>500)throw Error('관문 우두머리 보상 ID를 1~500개 입력하세요');
      const lookup=new Map(catalog.map(x=>[x.id,x]));
      const events=ids.map(id=>{
        const found=lookup.get(id);
        if(!found?.outer)throw Error('알 수 없거나 일반 보상이 없는 관문 ID: '+id);
        return found;
      });
      sequenceRows=engine.predictSequence(input,events);
      const drops=sequenceRows.filter(x=>x.item),purple=drops.filter(x=>x.color===4);
      seqStatus.textContent='연속 보상 '+sequenceRows.length+'회 · 일반 장비 '+drops.length+
       '개 · 자색 '+purple.length+'개 · 동일 시드 공유 구간은 한 번씩 이어서 소비';
      $('dungeonSequenceResults').replaceChildren(...sequenceRows.map(x=>record(
       '#'+x.index+' · '+ko(x.dungeon)+' / '+ko(x.boss)+' · '+
       (x.item?(EQUIP_DATA.equipment?.[x.item]?.koName||ko(EQUIP_DATA.equipment?.[x.item]?.name||'장비 #'+x.item)):'일반 장비 없음'),
       x.item?(colors[x.color]||'색상 미확인')+' · '+x.eventId:'원본 보상 없음')));
      $('dungeonSequenceExport').disabled=!sequenceRows.length;
    }catch(error){seqStatus.textContent=String(error.message||error)}
  };
  $('dungeonSequenceExport').onclick=()=>{
    if(!sequenceRows.length)return;
    const columns=[
      {title:'공유 RNG 보상 순번',key:'index'},
      {title:'관문',value:x=>ko(x.dungeon)},
      {title:'우두머리',value:x=>ko(x.boss)},
      {title:'보상 함수 ID',key:'eventId'},
      {title:'장비 ID',key:'item'},
      {title:'한국판 장비명',value:x=>x.item?
       (EQUIP_DATA.equipment?.[x.item]?.koName||ko(EQUIP_DATA.equipment?.[x.item]?.name||'장비 #'+x.item)):''},
      {title:'예상 색상',value:x=>colors[x.color]||''},
      {title:'예측 한계',value:()=> '공유 보상 RNG 순서 재현, 실전 추가 난수 소비 및 최종 정련/망정 검증 전'}
    ];
    window.SBJDropExport.save('Nangman_Dungeon_Shared_Boss_Sequence',columns,sequenceRows);
  };
  $('dungeonCount').oninput = reset;
  $('dungeonForm').onsubmit = event => {
    event.preventDefault();
    if ($('dungeonRun').disabled) return;
    try {
      rows = engine.predict(input, selected(), Number($('dungeonCount').value));
      render();
    } catch (error) { $('dungeonStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshSave);
  for (const name of Object.keys(links)) links[name].onclick = () => switchMode(name);
  const initial = location.hash.slice(1);
  switchMode(Object.prototype.hasOwnProperty.call(sections, initial) ? initial : 'wild');
  refreshSave();
})();
