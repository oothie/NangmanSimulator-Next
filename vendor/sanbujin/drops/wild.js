(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const panel = $('wildDrop'), picker = $('wildTarget'), form = panel.querySelector('form');
  const targets = window.SBJWildCatalog, engine = window.SBJWildDrop;
  const color = ['', '白装', '绿装', '蓝装', '紫装'];
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
      ? '按参考运行时顺序预测虎种和虎骨保底，当前连续未出虎骨 ' + input.drought + ' 次。'
      : timed ? '掉落与品质从存档序列预测，装备词条依赖你填写的结算时间。'
        : '按参考顺序预测首领掉落与品质。同一装备随机序列只显示首次可核对的词条。';
    $('wildHint').textContent = ready ? label : archive ? '当前存档没有该目标的完整掉落序列。' : '导入存档后可读取野外掉落序列。';
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
      picker.add(new Option(target.location + ' · ' + target.name + (ready ? '' : ' · 缺序列'), i));
    });
    picker.value = previous || String(firstReady ?? 0);
    configure();
  }

  function render() {
    const host = $('wildResults'), onlyHits = $('wildOnlyHits').checked;
    const shown = onlyHits ? rows.filter(row => row.itemId) : rows;
    const hits = rows.filter(row => !row.padding && row.itemId).length;
    const padding = rows.filter(row => row.padding).length;
    $('wildStatus').textContent = '垫怪 ' + padding + ' 회 · 预测 ' + (rows.length - padding) + ' 회 · 有掉落 ' + hits + ' 회';
    host.replaceChildren(...shown.map(row => {
      const item = node('li', '');
      const label = '第 ' + row.serial + ' 회' + (row.padding ? ' · 垫怪' : '') +
        (row.tiger ? ' · ' + row.tiger : '') + ' · ' + (row.itemName || '无预测掉落') +
        (row.color ? ' · ' + color[row.color] : '');
      item.append(node('strong', label));
      if (row.tiger) item.append(node('span', '连续未出虎骨 ' + row.droughtBefore + ' → ' + row.droughtAfter, 'wild-row-note'));
      if (row.color > 1) {
        const attrs = row.affixes?.map(({prop, value}) => {
          const label = EQUIP_DATA.propNames?.[prop] || EQUIP_DATA.props?.[prop] || prop;
          const percent = value < 1 || prop === 'atk_extend';
          const display = percent ? (Math.round(value * 10000) / 100) + '%' : value;
          return label + ' ' + display;
        });
        item.append(node('span', attrs ? attrs.join(' · ') || '无随机附加词条' : '缺少装备词条所需资料', 'wild-row-note'));
      }
      if (row.time) {
        const time = new Date((row.time + 28800) * 1000).toISOString().slice(0, 19).replace('T', ' ');
        item.append(node('span', '词条按 ' + time + ' 结算', 'wild-row-note'));
      }
      return item;
    }));
    if (!shown.length) host.append(node('li', '这段序列没有掉落。'));
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
      if (target.kind === 'aidrop' && !engine.usable(time)) throw Error('请填写有效的首场结算时间');
      rows = engine.predict(input, target, {pad, count, interval, bait, time}, EQUIP_DATA.equipment);
      render();
    } catch (error) { $('wildStatus').textContent = error.message; }
  };
  document.addEventListener('yyjh-save', refreshArchive);
  refreshArchive();
})();
