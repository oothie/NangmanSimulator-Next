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
    if (!save) hint = '세이브를 불러오면 보물찾기 드랍을 예측할 수 있습니다.';
    else if (input.level < 30) hint = '주인공이 30레벨 이상이어야 보물찾기가 발동합니다.';
    else if (!hasSeed) hint = '현재 세이브에 보물찾기 순서가 없습니다. 게임에서 필드 사냥을 한 번 진행한 뒤 세이브를 다시 추출하세요.';
    else if (input.status === 5) hint = '제릉 보물 단서가 있습니다. 먼저 외전에서 기름종이를 획득하세요.';
    else if (input.status === 1 || input.checked >= 10 && !input.status) hint = '이번 회차 판정이 끝났습니다. 다음 일일 갱신부터 계산합니다.';
    else if (input.status > 1) hint = '진행 중인 보물찾기가 있습니다. 먼저 완료한 뒤 일일 갱신을 기다리세요.';
    $('treasureHint').textContent = hint;
    $('treasureHint').hidden = !hint;
    $('treasureRun').disabled = !hasSeed || input.level < 30;
  }

  function render() {
    const hits = rows.filter(row => row.drop);
    const shown = onlyHits.checked ? hits : rows;
    const end = rows[rows.length - 1];
    const summary = hits.length ? '보물지도 예상 ' + hits.length + ' 개' : '이 범위에서 드랍이 예측되지 않았습니다';
    const cost = end ? ' · 사냥 ' + end.fight + '회 · 갱신 대기 ' + end.day + '회' : '';
    const pending = rows.reduce((waiting, row) => row.pending || waiting && row.drop !== 'oil', input.status === 5);
    result.textContent = summary + cost + (pending ? '. 제릉 단서가 있어 기름종이 획득을 기다리는 중입니다.'
      : hits.length ? '. 보물지도가 나오면 먼저 보물찾기를 완료하세요.' : '. 사냥 횟수나 일일 갱신 횟수를 늘려 다시 조회하세요.');
    $('treasureTable').hidden = !shown.length;
    $('treasureResults').replaceChildren(...shown.map(row => {
      const tr = document.createElement('tr');
      tr.classList.toggle('treasure-hit', Boolean(row.drop));
      const day = row.day ? '제 ' + row.day + '회' : '현재';
      const drop = row.drop === 'oil' ? '낡은 기름종이' : row.drop === 'clue' ? '보물찾기 단서' : row.pending ? '발동됨, 기름종이 획득 대기' : '드랍 없음';
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
