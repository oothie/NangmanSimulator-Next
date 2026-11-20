(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const engine = window.SBJTreasureDrop;
  const form = $('treasureForm'), result = $('treasureResult'), view = $('treasureView');
  const tombRule = $('treasureTombRule'), onlyHits = $('treasureOnlyHits');
  let input, settings, rows;

  function clear() {
    settings = rows = null;
    $('treasureOutput').hidden = true;
    $('treasureTable').hidden = true;
    $('treasureResults').replaceChildren();
    result.textContent = '';
  }

  function refreshSave() {
    clear();
    let save;
    try { save = window.loadShareStore?.()?.data; } catch (_) { }
    input = engine.open(save);
    const hasSeed = window.SBJWildDrop.usable(input.seed);
    let hint = '';
    if (!save) hint = '导入存档后即可推演藏宝掉落。';
    else if (input.level < 30) hint = '主角达到 30 级后才会触发寻宝。';
    else if (!hasSeed) hint = '当前存档缺少藏宝序列。可以在游戏里打一场野怪后重新提档。';
    else if (input.status === 5) hint = '已有帝陵藏宝线索，先在外殿打出油纸。';
    else if (input.status === 1 || input.checked >= 10 && !input.status) hint = '本轮判定已结束，从下一次每日刷新开始。';
    else if (input.status > 1) hint = '存档里有未完成的寻宝。先完成它，再等每日刷新。';
    $('treasureHint').textContent = hint;
    $('treasureHint').hidden = !hint;
    $('treasureRun').disabled = !hasSeed || input.level < 30;
  }

  function render() {
    const hits = rows.filter(row => row.drop);
    const shown = onlyHits.checked ? hits : rows;
    const end = rows[rows.length - 1];
    const summary = hits.length ? '预计出图 ' + hits.length + ' 개' : '这个范围内未推演到掉落';
    const cost = end ? ' · 打 ' + end.fight + ' 场 · 等 ' + end.day + ' 회每日刷新' : '';
    const pending = rows.reduce((waiting, row) => row.pending || waiting && row.drop !== 'oil', input.status === 5);
    result.textContent = summary + cost + (pending ? '。还有帝陵线索待掉油纸。'
      : hits.length ? '。每次出图后先完成寻宝。' : '。可以增加场次或每日刷新次数再查。');
    $('treasureTable').hidden = !shown.length;
    $('treasureResults').replaceChildren(...shown.map(row => {
      const tr = document.createElement('tr');
      tr.classList.toggle('treasure-hit', Boolean(row.drop));
      const day = row.day ? '第 ' + row.day + ' 회' : '当前';
      const drop = row.drop === 'oil' ? '残破的油纸' : row.drop === 'clue' ? '藏宝线索' : row.pending ? '触发，待掉油纸' : '无掉落';
      for (const label of [row.fight, day, engine.sites[row.site], drop]) {
        const td = document.createElement('td');
        td.textContent = label;
        tr.append(td);
      }
      return tr;
    }));
  }

  function showRoute() {
    if (!settings) return;
    const selected = view.value;
    $('treasureTombField').hidden = selected !== 'tomb';
    try {
      rows = engine.predict(input, {
        ...settings, site: selected === 'best' ? 'shifang' : selected,
        optimize: selected === 'best', oil: tombRule.value === 'oil'
      });
      render();
    } catch (error) {
      rows = null;
      $('treasureTable').hidden = true;
      $('treasureResults').replaceChildren();
      result.textContent = error.message;
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    settings = {count: $('treasureCount').valueAsNumber, refreshes: $('treasureRefreshes').valueAsNumber};
    view.value = 'best';
    $('treasureOutput').hidden = false;
    showRoute();
  });
  form.addEventListener('input', clear);
  view.addEventListener('change', showRoute);
  tombRule.addEventListener('change', showRoute);
  onlyHits.addEventListener('change', () => { if (rows) render(); });
  document.addEventListener('yyjh-save', refreshSave);
  refreshSave();
})();
