/* Treasure sequence from general_win, general_Refresh and fight_outtomb. */
(function (root) {
  'use strict';
  const {draw, usable} = root.SBJWildDrop;
  const value = field => Number(field?.Value ?? field?.value ?? field?.V ?? field?.v ?? field?.Num ?? field?.num ?? field);
  const sites = {shifang: '십방집', saibei: '새북'};

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

  function fixedSequence(input, options, random) {
    let day = 0, index = 0, boost = input.boost, checked = input.checked, status = input.status;
    const rows = [];
    while (rows.length < options.count && day <= options.refreshes) {
      if (status !== 5 && (status !== 0 || checked >= 10)) {
        day++;
        checked = 0;
        boost += 10;
        status = 0;
        continue;
      }
      let drop = '';
      if (status === 0) {
        checked++;
        if (random[index++] <= boost + 10) {
          boost = -10;
          checked = 10;
          status = 1;
          drop = 'clue';
        }
      }
      rows.push({fight: rows.length + 1, day, site: options.site, drop, pending: false});
    }
    return rows;
  }

  function predict(input, options) {
    if (!Object.hasOwn(sites,options.site)) throw Error('보물찾기 예측은 십방집과 새북만 지원합니다.');
    if (input.level < 30) throw Error('주인공이 30레벨 이상이어야 보물찾기가 발동합니다.');
    if (!usable(input.seed)) throw Error('세이브에 비단/경문/책장 드랍 순서가 없습니다. 게임에서 필드 사냥을 한 번 진행한 뒤 세이브를 다시 추출하세요.');
    if (!Number.isInteger(input.status) || input.status < 0 || input.status > 5) {
      throw Error('현재 보물찾기 진행 상태를 확인할 수 없습니다. 진행 중인 보물찾기를 완료한 뒤 세이브를 다시 추출하세요.');
    }
    if (!Number.isInteger(options.count) || options.count < 1 || options.count > 500 ||
      !Number.isInteger(options.refreshes) || options.refreshes < 0 || options.refreshes > 60) {
      throw Error('사냥 횟수는 1~500회, 일일 갱신 횟수는 0~60회까지 입력할 수 있습니다.');
    }
    if (input.status === 5) throw Error('진행 중인 보물찾기를 완료한 뒤 다음 순서를 계산하세요.');
    const random = rolls(input.seed, 1010, options.count);
    if (!options.optimize) return fixedSequence(input, options, random);
    const day = input.status > 0 ? 1 : 0;
    const start = day ? {...input, boost: input.boost + 10} : input;
    return ordinaryBest(start, options, random, [], day);
  }

  root.SBJTreasureDrop = {open, predict, sites};
})(window);
