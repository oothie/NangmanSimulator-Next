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
    const label = isTomb ? '제릉 외전 100레벨 특수몹 NPC 35256의 90레벨 장비 8종을 원본 60014 분석 자료로 계산합니다. 분기 순서는 실험 가설이며 실게임 예측은 미검증입니다. NPC 35255 일반 전투에는 90레벨 장비를 임의 지급하지 않습니다.' : tiger
      ? '원본 실행 순서에 따라 호랑이 종류와 호골 천장을 예측합니다. 현재 호골 연속 미획득 ' + input.drought + '회.'
      : timed ? '드랍 여부와 품질은 세이브 순서로 예측합니다. 장비 옵션은 입력한 판정 시각에 따라 달라집니다.'
        : '원본 보상 함수를 직접 호출하는 특수몹 드랍 시뮬레이션입니다. 표시 회차는 전체 일반 필드 사냥 횟수가 아닙니다. 별도 특수몹 출현 순서가 연결되기 전까지 일반 사냥 1회당 이 함수를 한 번 호출한다고 해석하면 안 됩니다.';
    const tombMissing = isTomb && archive ? [!engine.usable(input.encounterSeed) ? 'rollenemy_tomb' : '', !engine.usable(input.equipmentSeed) ? 'seed_35256' : '', ...input.missingFlags].filter(Boolean) : [];
    $('wildHint').textContent = ready ? label : !archive ? '세이브를 불러오면 필드 드랍 순서를 읽을 수 있습니다.' : tombMissing.length ? '제릉 분석용 세이브 항목 누락: ' + tombMissing.join(', ') + '. 현재 상태에서는 예측하지 않습니다.' : '현재 세이브에 해당 대상의 전체 드랍 순서가 없습니다.';
  }

  function refreshArchive() {
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
    const quality=$('wildQuality').value;
    const qualifying=rows.filter(row=>quality==='purple'?row.color===4:
      quality==='equip'?Boolean(row.color):true);
    const shown = onlyHits ? qualifying.filter(row => row.itemId || row.spawn) : qualifying;
    const hits = rows.filter(row => !row.padding && row.itemId).length;
    const padding = rows.filter(row => row.padding).length;
    const appearances = rows.filter(row => !row.padding && row.kind === 'tomb' && row.spawn).length;
    const purple = rows.filter(row => !row.padding && row.color === 4).length;
    const story=targets[Number(picker.value)]?.kind==='story';
    $('wildStatus').textContent = (story?'선행 특수몹 보상 호출 ':'선행 사냥 ') + padding + '회 · 예측 ' + (rows.length - padding) + '회 · 드랍 ' + hits + '회 · 자색 ' + purple + '회' + (story?' · 일반 사냥 회차와 별개':rows.some(row => row.kind === 'tomb') ? ' · 제릉 특수몹 등장 ' + appearances + '회 · 실험 가설' : '');
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

  $('wildTime').value = new Date(Date.now() + 28800000).toISOString().slice(0, 19);
  picker.onchange = configure;
  for (const id of ['wildPad', 'wildCount', 'wildBait', 'wildTime', 'wildInterval', 'wildTombOrder']) $(id).addEventListener('input', reset);
  $('wildOnlyHits').onchange = () => { if (rows.length) render(); };
  $('wildQuality').onchange = () => { if (rows.length) render(); };
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
