(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = window.SBJDungeonDrop, catalog = window.SBJDungeonCatalog;
  const groups = [...new Set(catalog.map(event => event.dungeon))];
  const area = $('dungeonArea'), boss = $('dungeonBoss');
  const sections = {wild: $('wildDrop'), dungeon: $('dungeonDrop'), treasure: $('treasureDrop')};
  const links = {wild: $('dropWildLink'), dungeon: $('dropDungeonLink'), treasure: $('dropTreasureLink')};
  const colors = ['', '白装', '绿装', '蓝装', '紫装'];
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
    $('dungeonStatus').textContent = '已推演 ' + rows.length + ' 次 · ' + rows.filter(row => row.item).length + ' 次有普通装备';
    $('dungeonResults').replaceChildren(...shown.map(row => record(
      '第 ' + row.index + ' 次 · ' + (row.item ? (EQUIP_DATA.equipment[row.item]?.name || '装备 #' + row.item) : '无普通装备'),
      row.item ? [colors[row.color], row.kind === 'weapon' ? '普通武器' : '普通装备'].filter(Boolean).join(' · ') : ''
    )));
    if (!shown.length) $('dungeonResults').append(record('这段序列未预测到普通装备。'));
  }
  function renderBoss() {
    reset();
    const event = selected();
    const ready = event.outer && !engine.missing(input, event).length;
    $('dungeonRun').disabled = !ready;
    $('dungeonCount').disabled = $('dungeonOnlyHits').disabled = !event.outer;
    $('dungeonHint').textContent = ready
      ? '按所选首领的结算段独立推演。扫荡、其他首领或活动共用序列时，实战结果可能变化。'
      : event.outer ? '当前存档缺少该首领所需的随机序列。' : '此首领目前可查专属橙装资料与存档状态。';
    $('dungeonOrange').hidden = !event.orange.length;
    $('dungeonOrangeList').replaceChildren(...event.orange.map(drop => {
      const result = engine.orange(input, drop);
      const labels = {owned: '已获得', locked: '本场已锁定掉落', estimated: '预计第 ' + result.round + ' 次掉落',
        notFound: '前 ' + result.round + ' 次未预测到掉落', missing: '当前资料不足，暂无法确定掉落次数'};
      return record(EQUIP_DATA.equipment[drop.id]?.name || drop.name, labels[result.kind]);
    }));
  }
  function fillBosses() {
    boss.replaceChildren();
    const inArea = catalog.filter(event => event.dungeon === area.value);
    inArea.forEach(event => {
      const duplicate = inArea.filter(other => other.boss === event.boss).length > 1;
      boss.add(new Option(event.boss + (duplicate ? ' · ' + event.variant : '') +
        (event.outer ? '' : ' · 专属橙装'), catalog.indexOf(event)));
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
  groups.forEach((group, i) => area.add(new Option(group, group, i === 0)));
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
