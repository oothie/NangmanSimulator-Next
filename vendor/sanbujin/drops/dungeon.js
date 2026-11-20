(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ko = value => window.SBJ_KOREAN?.translate?.(String(value ?? '')) || String(value ?? '');
  const engine = window.SBJDungeonDrop, catalog = window.SBJDungeonCatalog;
  const groups = [...new Set(catalog.map(event => event.dungeon))];
  const area = $('dungeonArea'), boss = $('dungeonBoss');
  const sections = {wild: $('wildDrop'), dungeon: $('dungeonDrop'), treasure: $('treasureDrop')};
  const links = {wild: $('dropWildLink'), dungeon: $('dropDungeonLink'), treasure: $('dropTreasureLink')};
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
  }
  function render() {
    const shown = $('dungeonOnlyHits').checked ? rows.filter(row => row.item) : rows;
    $('dungeonStatus').textContent = '예측 완료 ' + rows.length + '회 · ' + rows.filter(row => row.item).length + '회 일반 장비 드랍';
    $('dungeonResults').replaceChildren(...shown.map(row => record(
      '제 ' + row.index + '회 · ' + (row.item ? (EQUIP_DATA.equipment[row.item]?.koName || ko(EQUIP_DATA.equipment[row.item]?.name) || '장비 #' + row.item) : '일반 장비 없음'),
      row.item ? [colors[row.color], row.kind === 'weapon' ? '일반 무기' : '일반 장비'].filter(Boolean).join(' · ') : ''
    )));
    if (!shown.length) $('dungeonResults').append(record('이 구간에서 일반 장비가 예측되지 않았습니다.'));
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
