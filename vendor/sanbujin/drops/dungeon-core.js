(function (root) {
  'use strict';
  const {draw, choose, usable} = root.SBJWildDrop;
  const value = field => Number(field?.Value ?? field?.value ?? field?.V ?? field?.v ?? field?.Num ?? field?.num ?? field);
  const values = group => Object.values(group || {});

  function open(save) {
    const data = Array.isArray(save) ? save[0] : save;
    const rnd = data?.Rnds ?? data?.rnds ?? data?.m_tRands ?? data?.RandData ?? data?.randData ?? {};
    const seeds = rnd.Sds ?? rnd.sds ?? rnd.Seeds ?? rnd.seeds ?? {};
    const raw = data?.globalVariable ?? data?.GlobalVariable ?? data?.GlobalVariables ?? data?.GlobalVars ?? {};
    const entries = Array.isArray(raw)
      ? raw.map(row => [row?.Key ?? row?.key ?? row?.Name ?? row?.name, value(row)])
      : Object.entries(raw).map(([key, field]) => [key, value(field)]);
    const bags = values(data?.EncryptDepots ?? data?.Depots).map(depot => depot?.Depots ?? depot?.Items ?? depot);
    const equipped = [data?.MainRole, ...values(data?.Roles), ...values(data?.Leavers)].map(role => role?.Equips);
    const owned = new Set([data?.Equips, ...equipped, ...bags].flatMap(values).map(item => Number(item?.ID ?? item?.id)));
    return {seeds, flags: new Map(entries), owned, level: value(data?.MainRole?.Level ?? data?.MainRole?.level ?? data?.Level ?? data?.level) || 0};
  }

  function missing(input, event) {
    const keys = new Set([event.outerSeed, event.colorSeed, event.equip?.seed, event.weapon?.seed]);
    return [...keys].filter(key => key && !usable(value(input.seeds[key])));
  }

  function stream(input) {
    const advanced = new Map();
    return (key, weights, bound) => {
      const seed = advanced.get(key) ?? value(input.seeds[key]);
      if (!usable(seed)) throw Error('현재 세이브에 해당 난수 순서가 없습니다');
      const output = weights ? choose(seed, weights) : draw(seed, bound);
      advanced.set(key, output.seed);
      return weights ? output.index : output.value;
    };
  }

  function predict(input, event, count) {
    const step = stream(input);
    const outer = event.outer.map(branch => branch[1]), color = event.color.map(branch => branch[1]);
    return Array.from({length: count}, (_, i) => {
      const [kind] = event.outer[step(event.outerSeed, outer)];
      const pool = event[kind];
      const item = pool?.ids[pool.random ? step(pool.seed, null, pool.max) - 1 : pool.max - 1] || 0;
      const rollColor = !event.nested || kind === 'equip' || kind === 'weapon' && event.colorSeed;
      const rolled = rollColor ? event.color[step(event.colorSeed, color)][0] : 0;
      return {index: i + 1, kind, item, color: item ? rolled : 0};
    });
  }

  function orange(input, drop, count = 800) {
    const {flag, id, acquired} = drop;
    if (input.owned.has(id) || input.flags.get(flag) >= 2 ||
      [...acquired, 'get_' + id].some(key => input.flags.get(key) > 0)) return {kind: 'owned'};
    if (input.flags.get(flag) === 1) return {kind: 'locked', round: 1};
    const model = root.SBJDungeonOrange[flag];
    if (!model || !usable(value(input.seeds[model.seed]))) return {kind: 'missing'};
    const vars = new Map(input.flags), temp = new Map(), next = stream(input);
    const map = scope => scope === 'temp' ? temp : vars;
    const state = {
      level: input.level,
      branch() { throw Error('스토리 분기 검증 정보가 없습니다'); },
      get(key, scope) { return map(scope).get(key) || 0; },
      set(key, value, scope) { map(scope).set(key, Number(value) || 0); },
      add(key, value, scope) { state.set(key, state.get(key, scope) + value, scope); },
      draw(key, bound) { return next(key, null, bound); },
      pick(key, weights) { return next(key, weights); }
    };
    const offset = model.active && state.get(model.active) === 1 ? 1 : 0;
    if (offset) state.add(model.counter, 1);
    try {
      for (let round = 1 + offset; round <= count; round++) {
        model.run(state);
        if (state.get(flag) === 1) return {kind: 'estimated', round};
        state.add(model.counter, 1);
      }
    } catch (_) { return {kind: 'missing'}; }
    return {kind: 'notFound', round: count};
  }

  root.SBJDungeonDrop = {open, missing, predict, orange};
})(window);
