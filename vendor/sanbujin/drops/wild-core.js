/* Read-only wild drop projection from the saved random streams. */
(function (root) {
  'use strict';
  const PROP_ORDER = 'atk_add hit_add def_add hp_add speed_add dodge_add parry_add def_ign unarmed_add sword_add blade_add stick_add hp_back mp_back mp_f dmg_off dmg_ref blood renxing po_parry po_dodge atk_extend xx_prob xx_crit'.split(' ');
  const AFFIX_RANGES = [[75, 95], [95, 110], [110, 120], [120, 125]];
  const asNumber = value => Number(value?.Value ?? value?.value ?? value?.V ?? value?.v ?? value?.Num ?? value?.num ?? value);
  const usable = value => Number.isSafeInteger(value) && value > 0;
  const raw = state => BigInt.asUintN(64, state * 245109059551232n + 48083817484545n);
  const output = state => Number((state >> 17n) & 2147483647n);

  function draw(seed, bound) {
    if (!usable(seed) || !usable(bound)) throw Error('세이브의 드랍 순서를 사용할 수 없습니다');
    const next = output(raw(BigInt(seed) + BigInt(bound))) % 2047483645 + 1;
    return {seed: next, value: next % bound + 1};
  }

  function choose(seed, weights) {
    const hit = draw(seed, weights.reduce((sum, weight) => sum + weight, 0));
    let remaining = hit.value;
    const index = weights.findIndex(weight => (remaining -= weight) <= 0);
    return {seed: hit.seed, index};
  }

  function open(archive, target) {
    const top = Array.isArray(archive) ? archive[0] : archive;
    const rnd = top?.Rnds ?? top?.rnds ?? top?.m_tRands ?? top?.RandData ?? top?.randData ?? {};
    const sds = rnd.Sds ?? rnd.sds ?? rnd.Seeds ?? rnd.seeds ?? {};
    const eds = rnd.Eds ?? rnd.eds ?? {};
    const counters = top?.globalVariable ?? top?.GlobalVariable ?? top?.GlobalVariables ?? top?.GlobalVars ?? {};
    const drought = Array.isArray(counters)
      ? counters.find(entry => (entry?.Key ?? entry?.key ?? entry?.Name ?? entry?.name) === 'no_drop_3065')
      : counters.no_drop_3065;
    return {seed: asNumber(sds[target.seedKey]), tigerSeed: asNumber(sds[target.tigerTypeSeedKey]),
      drought: Math.max(0, Math.floor(asNumber(drought) || 0)), sds, eds};
  }

  function tiger(state, bait) {
    const bound = bait === 'tiger' ? 3 : 5;
    const kind = draw(state.tigerSeed, bound);
    state.tigerSeed = kind.seed;
    const white = kind.value === bound;
    const boost = state.drought >= 5 ? 1000 : 1;
    const drops = white ? [[3088, 200], [3921, 150], [3065, 350 * boost], [3922, 300]]
      : [[3065, 300 * boost], [3088, 250], [3922, 150], [3921, 200]];
    const hit = choose(state.seed, drops.map(entry => entry[1]));
    state.seed = hit.seed;
    const itemId = drops[hit.index][0], before = state.drought;
    state.drought = itemId === 3065 ? 0 : before + 1;
    return {itemId, itemName: ({3065: '호골', 3088: '호피', 3921: '호랑이 고기', 3922: '호편'})[itemId],
      tiger: white ? '백호' : '맹호', droughtBefore: before, droughtAfter: state.drought};
  }

  function loot(state, target) {
    if (target.kind === 'aidrop') {
      const weights = target.drop.map(entry => entry.weight);
      const hit = choose(state.seed, weights.concat(100 - weights.reduce((a, b) => a + b, 0)));
      state.seed = hit.seed;
      const item = target.drop[hit.index];
      if (!item) return {};
      if (!item.isEquip) return {itemId: item.id, itemName: item.name};
      const quality = choose(state.seed, [1000, 100, 10, 1]);
      state.seed = quality.seed;
      return {itemId: item.id, itemName: item.name, color: quality.index + 1};
    }
    const hit = choose(state.seed, target.branches.map(branch => branch.weight));
    state.seed = hit.seed;
    const branch = target.branches[hit.index];
    if (!branch.equipIds.length) return {};
    const quality = choose(state.seed, branch.colors.map(entry => entry[1]));
    const equip = draw(quality.seed, branch.equipIds.length);
    state.seed = equip.seed;
    return {itemId: branch.equipIds[equip.value - 1], color: branch.colors[quality.index][0]};
  }

  function equipmentSeed(state, cfg, id, unix, persistent) {
    if (!persistent) return output(raw(BigInt(unix))) % 2047483645 + 1;
    const perItem = Number(cfg.type) < 10 && Number(cfg.lv) > 80;
    const map = perItem ? state.eds : state.sds;
    const key = perItem ? String(id) : 'mdrop';
    const seed = asNumber(map[key]);
    if (!usable(seed)) return null;
    // The saved value can verify the first use. Subsequent story affixes
    // depend on how the live client writes back and shares this stream.
    delete map[key];
    return draw(seed, 99999999).value;
  }

  function affixes(cfg, color, initial) {
    let seed = choose(initial, [74, 20, 5, 1]).seed;
    for (const key of ['atk', 'def', 'hit', 'hp', 'speed', 'dodge', 'parry', 'neijin', 'gangqi']) {
      if (Number(cfg.base?.[key === 'gangqi' ? 'gq_base' : key] ?? cfg.base?.[key]) > 0) seed = draw(seed, 1).seed;
    }
    const pool = PROP_ORDER.filter(prop => cfg.exts?.[prop]);
    const weights = pool.map(prop => Number(cfg.exts[prop][1]) || 0);
    const result = [];
    for (let slot = 0; slot < Math.min(3, color - 1) && weights.some(Boolean); slot++) {
      const type = choose(seed, weights);
      const prop = pool[type.index], base = Number(cfg.exts[prop][0]) || 0;
      const quality = choose(type.seed, [70, 25, 4, 1]);
      const [min, max] = AFFIX_RANGES[quality.index];
      const factor = draw(quality.seed, max - min + 1);
      seed = factor.seed;
      const multiplier = (min + factor.value - 1) * [100, 75, 50][slot] / 10000;
      const fixed = base > 1 && base < 2 || base === 1 && (prop === 'mp_f' || prop === 'mp_back');
      const value = fixed ? base : base > 1 ? Math.max(1, base * multiplier) : base * multiplier;
      result.push({prop, value: value > 1 ? Math.floor(value) : value});
    }
    return result;
  }

  function predictWithState(input, target, options, equipment) {
    if (!usable(input.seed) || target.kind === 'tigerbone' && !usable(input.tigerSeed)) throw Error('현재 세이브에 해당 대상의 드랍 순서가 없습니다');
    const state = {...input, sds: {...input.sds}, eds: {...input.eds}};
    const rows = [];
    for (let index = 0; index < options.pad + options.count; index++) {
      const row = target.kind === 'tigerbone' ? tiger(state, options.bait) : loot(state, target);
      // Game table equipment[7200] has appearance data and no combat affixes.
      const cfg = equipment[String(row.itemId)] || (row.itemId === 7200 ? {} : null);
      if (row.color) {
        row.itemName = row.itemName || cfg?.name || '장비 ' + row.itemId;
        if (cfg) {
          const persistent = target.kind === 'story';
          row.time = persistent ? null : options.time + index * options.interval;
          const seed = equipmentSeed(state, cfg, row.itemId, row.time, persistent);
          if (seed != null) row.affixes = affixes(cfg, row.color, seed);
        }
      }
      rows.push({...row, serial: index + 1, padding: index < options.pad});
    }
    return {rows,final:{
      seed:state.seed,tigerSeed:state.tigerSeed,drought:state.drought,
      // Return copied streams only for verification; never mutate archive.
      sds:{...state.sds},eds:{...state.eds}
    }};
  }
  function predict(input,target,options,equipment){
    return predictWithState(input,target,options,equipment).rows;
  }

  root.SBJWildDrop = {open,predict,predictWithState,usable,draw,choose};
})(window);
