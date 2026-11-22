(function (root) {
  'use strict';
  const {draw, choose, usable} = root.SBJWildDrop;
  const value = field => Number(field?.Value ?? field?.value ?? field?.V ?? field?.v ?? field?.Num ?? field?.num ?? field);
  const values = group => Object.values(group || {});

  function open(save) {
    const data = Array.isArray(save) ? save[0] : save;
    const rnd = data?.Rnds ?? data?.rnds ?? data?.m_tRands ?? data?.RandData ?? data?.randData ?? {};
    const seeds = rnd.Sds ?? rnd.sds ?? rnd.Seeds ?? rnd.seeds ?? {};
    const eds = rnd.Eds ?? rnd.eds ?? {};
    const raw = data?.globalVariable ?? data?.GlobalVariable ?? data?.GlobalVariables ?? data?.GlobalVars ?? {};
    const entries = Array.isArray(raw)
      ? raw.map(row => [row?.Key ?? row?.key ?? row?.Name ?? row?.name, value(row)])
      : Object.entries(raw).map(([key, field]) => [key, value(field)]);
    const bags = values(data?.EncryptDepots ?? data?.Depots).map(depot => depot?.Depots ?? depot?.Items ?? depot);
    const equipped = [data?.MainRole, ...values(data?.Roles), ...values(data?.Leavers)].map(role => role?.Equips);
    const owned = new Set([data?.Equips, ...equipped, ...bags].flatMap(values).map(item => Number(item?.ID ?? item?.id)));
    return {seeds,eds, flags: new Map(entries), owned, level: value(data?.MainRole?.Level ?? data?.MainRole?.level ?? data?.Level ?? data?.level) || 0};
  }

  function missing(input, event) {
    const keys = new Set([event.outerSeed, event.colorSeed, event.equip?.seed, event.weapon?.seed]);
    return [...keys].filter(key => key && !usable(value(input.seeds[key])));
  }

  function stream(input) {
    const advanced = new Map();
    const next=(key, weights, bound) => {
      const seed = advanced.get(key) ?? value(input.seeds[key]);
      if (!usable(seed)) throw Error('현재 세이브에 해당 난수 순서가 없습니다');
      const output = weights ? choose(seed, weights) : draw(seed, bound);
      advanced.set(key, output.seed);
      return weights ? output.index : output.value;
    };
    next.snapshot=()=>new Map(advanced);
    next.restore=saved=>{advanced.clear();for(const [key,val] of saved)advanced.set(key,val)};
    return next;
  }

  function resolveEvent(step, event) {
    const outer=event.outer.map(branch=>branch[1]),color=event.color.map(branch=>branch[1]);
    const [kind]=event.outer[step(event.outerSeed,outer)];
    const pool=event[kind];
    const item=pool?.ids[pool.random?step(pool.seed,null,pool.max)-1:pool.max-1]||0;
    const rollColor=!event.nested||kind==='equip'||kind==='weapon'&&event.colorSeed;
    const rolled=rollColor?event.color[step(event.colorSeed,color)][0]:0;
    return {kind,item,color:item?rolled:0};
  }
  // All 90+ dungeon common-equipment rewards draw the same persistent
  // Rnds.Eds[itemId] stream as outdoor common equipment. A color other
  // than purple still advances that per-ID stream. Do not fabricate final
  // refinement or mangjeong: only show whether this shared step was tracked.
  function trackEquipment(input,rows){
    const eds={...(input.eds||{})},counts=new Map();
    let tracked=0,missing=0;
    for(const row of rows){
      if(!row.item||!row.color)continue;
      const cfg=root.EQUIP_DATA?.equipment?.[row.item];
      if(!cfg||Number(cfg.type)>=10||Number(cfg.lv)!==90)continue;
      const key=String(row.item),seed=value(eds[key]);
      const index=(counts.get(key)||0)+1;
      counts.set(key,index);
      row.sameItemOrder=index;
      if(!usable(seed)){row.sharedEdsTracked=false;missing++;continue;}
      const next=draw(seed,99999999);
      eds[key]=next.seed;
      row.sharedEdsTracked=true;
      tracked++;
    }
    return {tracked,missing,eds};
  }
  // Native boss scripts include special rewards and extra RNG draws before gear.
  function nativeRoutes(){
    const seen=new Set(),result=[];
    for(const model of Object.values(root.SBJDungeonOrange||{})){
      if(typeof model?.run!=='function'||seen.has(model.run))continue;
      seen.add(model.run);
      const text=Function.prototype.toString.call(model.run);
      const ids=[...new Set([...text.matchAll(/drop_(\d+)_equip/g)].map(m=>Number(m[1])))];
      if(ids.length)result.push({ids,run:model.run});
    }
    return result;
  }
  function replay(input,events,options={}){
    const step=stream(input),vars=new Map(input.flags),temp=new Map();
    const owned=root.SBJDungeonUniqueOwnership;
    owned?.preventExisting(input,vars,options);
    const scope=where=>where==='temp'?temp:vars;
    const state={level:input.level,
      branch:key=>{if(!vars.has(key))throw Error('미복원 임무 분기: '+key);return Number(vars.get(key))},
      get:(key,where)=>scope(where).get(key)||0,
      set:(key,val,where)=>{scope(where).set(key,Number(val)||0)},
      add:(key,val,where)=>{const m=scope(where);m.set(key,(m.get(key)||0)+Number(val||0))},
      draw:(key,bound)=>step(key,null,bound),
      pick:(key,weights)=>step(key,weights)};
    const routes=nativeRoutes(),rows=[];
    const idOf=e=>Number(e?.sourceNpc||String(e?.id||'').match(/drop_(\d+)/)?.[1]||0);
    for(let i=0;i<events.length;){
      const event=events[i],id=idOf(event);
      const native=routes.filter(r=>r.ids[0]===id&&r.ids.every((v,j)=>
        idOf(events[i+j])===v)).sort((a,b)=>b.ids.length-a.ids.length)[0];
      if(!native){
        rows.push({...resolveEvent(step,event),nativeReplay:false});i++;continue;
      }
      owned?.preventExisting(input,vars,options);
      const previous=new Map(vars);
      const seedCheckpoint=step.snapshot(),flagCheckpoint=new Map(vars),tempCheckpoint=new Map(temp);
      try{native.run(state)}catch(error){
        // Missing game-story branches cannot be guessed. Restore every RNG
        // advancement before using the bounded ordinary-drop fallback.
        step.restore(seedCheckpoint);vars.clear();temp.clear();
        for(const [key,val] of flagCheckpoint)vars.set(key,val);
        for(const [key,val] of tempCheckpoint)temp.set(key,val);
        rows.push({...resolveEvent(step,event),nativeReplay:false,
          nativeReason:String(error.message||error)});i++;continue;
      }
      for(let j=0;j<native.ids.length;j++){
        const e=events[i+j],npc=idOf(e),count=Number(vars.get(e.id)||0),
          weapon=Number(vars.get('drop_'+npc+'_weapon')||0);
        const isEquip=count>=1&&count<=(e.equip?.ids?.length||0);
        const isWeapon=!isEquip&&weapon>=1&&weapon<=(e.weapon?.ids?.length||0);
        const item=isEquip?e.equip.ids[count-1]:
          isWeapon?e.weapon.ids[weapon-1]:0;
        const color=Number(vars.get('drop_'+npc+'_color')||0);
        const source=root.SBJDungeonYYAdapter?.findSource(e);
        const specialDrops=(source?.d?.ops||[])
          .filter(op=>op.t==='uniq'&&Number(op.npc)===npc&&
            Number(vars.get(op.flag)||0)===1&&Number(previous.get(op.flag)||0)!==1)
          .map(op=>Number(op.item)).filter(Number.isFinite);
        const availableSpecial=owned?owned.filterRewards(input,specialDrops,options):specialDrops;
        rows.push({kind:isEquip?'equip':isWeapon?'weapon':'none',
          item,color:item?color:0,nativeReplay:true,specialDrops:availableSpecial});
      }
      i+=native.ids.length;
    }
    return rows;
  }
  function predict(input,event,count,options={}){
    if(!Number.isInteger(count)||count<1||count>500)
      throw Error('관문 보상 예측은 1~500회까지 가능합니다');
    const rows=replay(input,Array.from({length:count},()=>event),options)
      .map((x,i)=>({index:i+1,...x}));
    rows.equipmentStream=trackEquipment(input,rows);
    return rows;
  }
  function predictSequence(input,events,options={}){
    if(!Array.isArray(events)||events.length<1||events.length>500)
      throw Error('관문 연속 보상은 1~500개 사건으로 입력하세요');
    for(const event of events) {
      if(!event?.outer||!event?.color||missing(input,event).length)
       throw Error('연속 보상에 필요한 우두머리 난수 시드가 없습니다: '+String(event?.id||'미확인'));
    }
    const rows=replay(input,events,options).map((x,i)=>({
      index:i+1,eventId:events[i].id,dungeon:events[i].dungeon,
      boss:events[i].boss,...x
    }));
    rows.equipmentStream=trackEquipment(input,rows);
    return rows;
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

  root.SBJDungeonDrop = {open, missing, predict, predictSequence, orange};
})(window);
