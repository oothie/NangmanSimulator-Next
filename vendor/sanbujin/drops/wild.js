(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const panel = $('wildDrop'), picker = $('wildTarget'), form = panel.querySelector('form');
  const targets = window.SBJWildCatalog, engine = window.SBJWildDrop;
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
  }

  function configure() {
    reset();
    const target = targets[Number(picker.value)], tiger = target.kind === 'tigerbone', timed = target.kind === 'aidrop';
    input = engine.open(archive, target);
    $('wildBaitField').hidden = !tiger;
    $('wildTiming').hidden = !timed;
    $('wildTime').disabled = $('wildInterval').disabled = !timed;
    const ready = engine.usable(input.seed) && (!tiger || engine.usable(input.tigerSeed));
    $('wildRun').disabled = !ready;
    const label = tiger
      ? '원본 실행 순서에 따라 호랑이 종류와 호골 천장을 예측합니다. 현재 호골 연속 미획득 ' + input.drought + '회.'
      : timed ? '드랍 여부와 품질은 세이브 순서로 예측합니다. 장비 옵션은 입력한 판정 시각에 따라 달라집니다.'
        : '원본 순서로 우두머리 드랍과 품질을 예측합니다. 같은 장비 난수 순서에서는 처음 확인 가능한 옵션만 표시합니다.';
    $('wildHint').textContent = ready ? label : archive ? '현재 세이브에 해당 대상의 전체 드랍 순서가 없습니다.' : '세이브를 불러오면 필드 드랍 순서를 읽을 수 있습니다.';
  }

  function refreshArchive() {
    const previous = picker.value;
    try { archive = window.loadShareStore?.()?.data || null; }
    catch (_) { archive = null; }
    picker.replaceChildren();
    let firstReady = null;
    targets.forEach((target, i) => {
      const saved = engine.open(archive, target);
      const ready = engine.usable(saved.seed) && (target.kind !== 'tigerbone' || engine.usable(saved.tigerSeed));
      if (ready && firstReady == null) firstReady = i;
      picker.add(new Option(target.location + ' · ' + target.name + (ready ? '' : ' · 순서 없음'), i));
    });
    picker.value = previous || String(firstReady ?? 0);
    configure();
  }

  function render() {
    const host = $('wildResults'), onlyHits = $('wildOnlyHits').checked;
    const shown = onlyHits ? rows.filter(row => row.itemId) : rows;
    const hits = rows.filter(row => !row.padding && row.itemId).length;
    const padding = rows.filter(row => row.padding).length;
    $('wildStatus').textContent = '선행 사냥 ' + padding + '회 · 예측 ' + (rows.length - padding) + '회 · 드랍 ' + hits + '회';
    host.replaceChildren(...shown.map(row => {
      const item = node('li', '');
      const label = '제 ' + row.serial + '회' + (row.padding ? ' · 선행 사냥' : '') +
        (row.tiger ? ' · ' + row.tiger : '') + ' · ' + (row.itemName || '예상 드랍 없음') +
        (row.color ? ' · ' + color[row.color] : '');
      item.append(node('strong', label));
      if (row.tiger) item.append(node('span', '호골 연속 미획득 ' + row.droughtBefore + ' → ' + row.droughtAfter, 'wild-row-note'));
      if (row.color > 1) {
        const attrs = row.affixes?.map(({prop, value}) => {
          const label = EQUIP_DATA.propNames?.[prop] || EQUIP_DATA.props?.[prop] || prop;
          const percent = value < 1 || prop === 'atk_extend';
          const display = percent ? (Math.round(value * 10000) / 100) + '%' : value;
          return label + ' ' + display;
        });
        item.append(node('span', attrs ? attrs.join(' · ') || '추가 옵션 없음' : '장비 옵션 계산에 필요한 데이터가 없습니다', 'wild-row-note'));
      }
      if (row.time) {
        const time = new Date((row.time + 28800) * 1000).toISOString().slice(0, 19).replace('T', ' ');
        item.append(node('span', '옵션 판정 시각 ' + time + ' 기준', 'wild-row-note'));
      }
      return item;
    }));
    if (!shown.length) host.append(node('li', '이 구간에서는 드랍이 없습니다.'));
  }

  $('wildTime').value = new Date(Date.now() + 28800000).toISOString().slice(0, 19);
  picker.onchange = configure;
  for (const id of ['wildPad', 'wildCount', 'wildBait', 'wildTime', 'wildInterval']) $(id).addEventListener('input', reset);
  $('wildOnlyHits').onchange = () => { if (rows.length) render(); };
  form.onsubmit = event => {
    event.preventDefault();
    reset();
    const target = targets[Number(picker.value)];
    const pad = Number($('wildPad').value), count = Number($('wildCount').value);
    const interval = Number($('wildInterval').value), bait = $('wildBait').value;
    const time = Math.floor(Date.parse($('wildTime').value + '+08:00') / 1000);
    try {
      if (target.kind === 'aidrop' && !engine.usable(time)) throw Error('올바른 첫 사냥 판정 시각을 입력하세요.');
      rows = engine.predict(input, target, {pad, count, interval, bait, time}, EQUIP_DATA.equipment);
      render();
    } catch (error) { $('wildStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshArchive);
  refreshArchive();
})();
