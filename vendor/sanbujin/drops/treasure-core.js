/* Treasure sequence from general_win, general_Refresh and fight_outtomb. */
(function (root) {
  'use strict';
  const {draw, usable} = root.SBJWildDrop;
  const value = field => Number(field?.Value ?? field?.value ?? field?.V ?? field?.v ?? field?.Num ?? field?.num ?? field);
  const sites = {shifang: '十方集', saibei: '塞北', tomb: '帝陵外殿'};

  function open(save) {
    const {seeds, flags, level} = root.SBJDungeonDrop.open(save);
    return {
      level, seed: value(seeds.battle_cbt_Adventure), tombSeed: value(seeds.rollenemy_tomb),
      boost: flags.get('normal_Adventure03') || 0, checked: flags.get('day_cbt_out') || 0,
      status: flags.get('treasure_hunting_cbt') || 0, tombBoost: flags.get('rollenemy_tomb2') || 0,
      tombFood: flags.get('eat_2659') || 0
    };
  }

  function rolls(seed, bound, count) {
    return Array.from({length: count}, () => {
      const roll = draw(seed, bound);
      seed = roll.seed;
      return roll.value;
    });
  }

  function tombEnemies(input, count) {
    let boost = input.tombBoost;
    return rolls(input.tombSeed, 1000, count).map(roll => {
      const special = roll <= boost + input.tombFood * 10;
      boost += special ? -200 : 100;
      return special;
    });
  }

  function ordinaryBest(input, options, random, prefix, day) {
    let best = {count: 0, end: 0, day: 0};
    let layer = new Map([[input.boost, {end: prefix.length, boost: input.boost, count: 0}]]);
    for (; day <= options.refreshes && layer.size; day++) {
      const next = new Map();
      for (const previous of layer.values()) {
        const daily = day === 0 ? Math.max(0, 10 - input.checked) : 10;
        const limit = Math.min(daily, options.count - previous.end);
        // The native LuaJIT hash iteration checks the hit branch first.
        const offset = previous.end - prefix.length;
        let misses = 0;
        while (misses < limit && random[offset + misses] > previous.boost + 10) misses++;
        const stop = Math.min(limit, misses + 1);
        for (let battles = 0; battles <= stop; battles++) {
          const hit = battles > misses;
          const end = previous.end + battles;
          const boost = hit ? 0 : previous.boost + 10;
          const count = previous.count + Number(hit);
          const key = end + ':' + boost;
          const improves = count > best.count || count === best.count && end < best.end;
          const keep = day < options.refreshes && end < options.count && (next.get(key)?.count ?? -1) < count;
          if (!improves && !keep) continue;
          const path = {end, day, hit, count, boost, previous};
          if (improves) best = path;
          if (keep) next.set(key, path);
        }
      }
      layer = next;
    }
    const rows = [...prefix];
    const days = [];
    for (let path = best; path.previous; path = path.previous) days.push(path);
    for (const path of days.reverse()) {
      for (let fight = path.previous.end + 1; fight <= path.end; fight++) {
        rows.push({fight, day: path.day, site: options.site, drop: path.hit && fight === path.end ? 'clue' : ''});
      }
    }
    return rows;
  }

  function fixedSequence(input, options, random, enemies) {
    let day = 0, index = 0, tombIndex = 0, boost = input.boost, checked = input.checked, status = input.status;
    const rows = [];
    while (rows.length < options.count && day <= options.refreshes) {
      if (status !== 5 && (status !== 0 || checked >= 10)) {
        day++;
        checked = 0;
        boost += 10;
        status = 0;
        continue;
      }
      const site = status === 5 ? 'tomb' : options.site;
      const special = site === 'tomb' && enemies[tombIndex++];
      let drop = '', pending = false;
      if (status === 5 && special) {
        drop = 'oil';
        status = 1;
      } else if (status === 0) {
        checked++;
        if (random[index++] <= boost + 10) {
          boost = -10;
          checked = 10;
          pending = site === 'tomb' && options.oil;
          status = pending ? 5 : 1;
          if (!pending) drop = 'clue';
        }
      }
      rows.push({fight: rows.length + 1, day, site, drop, pending});
    }
    return rows;
  }

  function predict(input, options) {
    if (input.level < 30) throw Error('主角达到 30 级后才会触发寻宝。');
    if (!usable(input.seed)) throw Error('当前存档没有藏宝掉落序列，可先在游戏里打一次野怪并重新提档。');
    if (!Number.isInteger(input.status) || input.status < 0 || input.status > 5) {
      throw Error('当前存档的寻宝状态无法识别，请完成手头的寻宝后重新提档。');
    }
    if (!Number.isInteger(options.count) || options.count < 1 || options.count > 500 ||
      !Number.isInteger(options.refreshes) || options.refreshes < 0 || options.refreshes > 60) {
      throw Error('场次可填 1–500，每日刷新可填 0–60 次。');
    }
    const random = rolls(input.seed, 1010, options.count);
    const needsTomb = input.status === 5 || options.site === 'tomb' && options.oil;
    if (needsTomb && !usable(input.tombSeed)) {
      throw Error('当前存档缺少帝陵外殿的敌人序列，可先在游戏里打一次外殿野怪并重新提档。');
    }
    const enemies = needsTomb ? tombEnemies(input, options.count) : [];
    if (!options.optimize) return fixedSequence(input, options, random, enemies);

    // A newly triggered ordinary clue is immediate. An oil-paper trigger uses
    // the same draw but needs a later battle, so it cannot improve total drops.
    const prefix = [];
    if (input.status === 5) {
      const hit = enemies.indexOf(true);
      const length = hit < 0 ? options.count : hit + 1;
      for (let fight = 1; fight <= length; fight++) {
        prefix.push({fight, day: 0, site: 'tomb', drop: fight === hit + 1 ? 'oil' : ''});
      }
    }
    if (prefix.length === options.count) return prefix;
    const day = input.status > 0 ? 1 : 0;
    const start = day ? {...input, boost: input.boost + 10} : input;
    return ordinaryBest(start, options, random, prefix, day);
  }

  root.SBJTreasureDrop = {open, predict, sites};
})(window);
