/* 算不尽 · 恒山算法核心
 * ---------------------------------------------------------------
 * 职责两件事：
 *   1. 加载 wasm/hengshan_engine.wasm（Rust 内核），约定接口为
 *      yanyu_alloc / yanyu_call / yanyu_free，env.yanyu_progress 上报进度；
 *   2. 在内核之上包一层恒山 API：配置天赋表与商店表，
 *      再透传 normalizeState / advanceDay / replacementChain /
 *      shopRefresh / optimize 等方法。
 * 另含从存档第一层收集恒山弟子的纯 JS 解析（不依赖内核）。
 */
(function (global) {
    'use strict';

    var TALENT_DATA = global.HENGSHAN_TALENT_DATA || null;
    var SHOP_DATA = global.HENGSHAN_SHOP_DATA || null;

    /* ---------------- WASM 桥 ---------------- */

    var instance = null;
    var readyPromise = null;
    var configured = false;
    var decoder = new TextDecoder('utf-8', { fatal: true });
    var encoder = new TextEncoder();

    function instantiate(bytes) {
        return WebAssembly.instantiate(bytes, {
            env: {
                yanyu_progress: function () { /* 内核进度上报，页面侧暂不需要 */ }
            }
        }).then(function (res) {
            instance = res.instance || res;
        });
    }

    function rawCall(method, payload) {
        var exp = instance.exports;
        var req = encoder.encode(JSON.stringify(Object.assign({ method: method }, payload || {})));
        var reqPtr = Number(exp.yanyu_alloc(req.length));
        if (!reqPtr) throw new Error('本次弟子推演未能开始，请稍后重试');
        try {
            new Uint8Array(exp.memory.buffer, reqPtr, req.length).set(req);
            var packed = exp.yanyu_call(reqPtr, req.length);
            var respPtr = Number(BigInt.asUintN(32, packed));
            var respLen = Number(packed >> 32n);
            if (!respPtr || !respLen) throw new Error('未能取得弟子推演结果，请重试');
            var text, out;
            try {
                text = decoder.decode(new Uint8Array(exp.memory.buffer, respPtr, respLen));
                out = JSON.parse(text);
            } finally {
                exp.yanyu_free(respPtr, respLen);
            }
            if (!out.ok) throw new Error(out.error || '弟子推演失败，请重试');
            return out.value;
        } finally {
            exp.yanyu_free(reqPtr, req.length);
        }
    }

    function call(method, payload) {
        if (!instance) throw new Error('恒山资料尚未加载，请稍候重试');
        // 内核统一包一层 input
        return rawCall(method, { input: payload || {} });
    }

    function fingerprint(obj) {
        var text = JSON.stringify(obj || null);
        var h = 2166136261;
        for (var i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return text.length.toString(16) + '-' + (h >>> 0).toString(16);
    }

    var lastFingerprint = '';

    function configure() {
        if (!TALENT_DATA || !TALENT_DATA.talents) throw new Error('缺少恒山天赋表');
        var fp = fingerprint({ data: TALENT_DATA, shopData: SHOP_DATA || null });
        if (fp === lastFingerprint) return;
        call('hengshan.configure', {
            data: TALENT_DATA,
            shopData: SHOP_DATA || null,
            kernelVersion: '',
            configFingerprint: fp
        });
        lastFingerprint = fp;
        configured = true;
    }

    function ready() {
        if (!readyPromise) {
            readyPromise = fetch('../wasm/hengshan_engine.wasm')
                .then(function (r) {
                    if (!r.ok) throw new Error('恒山资料下载失败，请检查网络后重试。错误码：' + r.status);
                    return r.arrayBuffer();
                })
                .then(function (buf) { return instantiate(new Uint8Array(buf)); })
                .then(function () { configure(); });
        }
        return readyPromise;
    }

    /* ---------------- 存档里的弟子收集（纯 JS） ---------------- */

    function pick(obj, keys) {
        if (!obj || typeof obj !== 'object') return undefined;
        for (var i = 0; i < keys.length; i++) {
            var v = obj[keys[i]];
            if (v !== undefined && v !== null) return v;
        }
        return undefined;
    }

    function toId(v) {
        var n = Number(v && typeof v === 'object' ? pick(v, ['ID', 'id', 'TalentID', 'talentId', 'SPID']) : v);
        return Number.isFinite(n) ? Math.trunc(n) : 0;
    }

    // SPData 可能是数组，也可能是 {槽位: 对象} 的映射
    function talentIds(sp) {
        var list;
        if (Array.isArray(sp)) list = sp;
        else if (sp && typeof sp === 'object') {
            list = Object.keys(sp).sort(function (a, b) {
                return (Number(a) - Number(b)) || String(a).localeCompare(String(b));
            }).map(function (k) { return sp[k]; });
        } else return [];
        return list.map(toId).filter(function (x) { return x > 0; }).slice(0, 3);
    }

    function normalizeStudent(raw, path, index, context) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        var seed = Number(pick(raw, ['S', 'Seed', 'seed']));
        if (!Number.isFinite(seed)) return null;
        var sp = raw.SPData;
        if (sp === undefined) return null;
        var talents = talentIds(sp);
        if (!(seed > 0) || !talents.length) return null;

        var spList = Array.isArray(sp)
            ? sp
            : Object.keys(sp).sort(function (a, b) {
                return (Number(a) - Number(b)) || String(a).localeCompare(String(b));
            }).map(function (k) { return sp[k]; });

        var lv = raw.LvProp && typeof raw.LvProp === 'object' ? raw.LvProp : {};
        var id = pick(raw, ['ID', 'Id', 'id', 'UID', 'StudentID']);
        var name = String(pick(raw, ['Name', 'name', 'Nick', 'nick']) || '').trim();

        return {
            key: String(path),
            id: id === undefined ? null : id,
            name: name || ('恒山弟子 ' + (index + 1)),
            level: Math.max(1, Math.trunc(Number(pick(raw, ['Level', 'Lv', 'level', 'lv'])) || 1)),
            exp: Math.max(0, Math.trunc(Number(pick(raw, ['Exp', 'EXP', 'exp'])) || 0)),
            seed: Math.trunc(seed),
            talents: talents,
            path: String(path),
            source: 'enrolled',
            sex: Math.trunc(Number(pick(raw, ['Sex', 'sex'])) || 0),
            birth: String(pick(raw, ['Birth', 'birth']) || '').trim(),
            born: {
                str: Math.trunc(Number(pick(raw, ['BornStr', 'bornStr'])) || 0),
                dex: Math.trunc(Number(pick(raw, ['BornDex', 'bornDex'])) || 0),
                con: Math.trunc(Number(pick(raw, ['BornCon', 'bornCon'])) || 0),
                int: Math.trunc(Number(pick(raw, ['BornInt', 'bornInt'])) || 0)
            },
            levelGrowth: {
                str: Math.max(0, Math.trunc(Number(lv.str) || 0)),
                con: Math.max(0, Math.trunc(Number(lv.con) || 0)),
                dex: Math.max(0, Math.trunc(Number(lv.dex) || 0)),
                int: Math.max(0, Math.trunc(Number(lv.int) || 0))
            },
            specials: spList.map(function (e) {
                return {
                    id: toId(e),
                    exp: Math.max(0, Math.trunc(Number(pick(e, ['Exp', 'exp'])) || 0)),
                    cd: Math.max(0, Math.trunc(Number(pick(e, ['CD', 'cd'])) || 0)),
                    seed: Math.trunc(Number(pick(e, ['S', 'Seed', 'seed'])) || 0)
                };
            }).filter(function (e) { return e.id > 0; }),
            currentTime: context.currentTime,
            replacementLastAt: context.replacementLastAt,
            replacementCooldown: context.replacementCooldown,
            dailyBaseExp: context.dailyBaseExp,
            dailyExtraExp: context.dailyExtraExp,
            masterTokens: context.masterTokens,
            dailyMasterTokens: context.dailyMasterTokens,
            masterTokenCap: context.masterTokenCap,
            nextDailyAt: context.nextDailyAt
        };
    }

    function collectStudentGroups(save) {
        var empty = { enrolled: [], shop: [], shopState: null, context: null };
        var top = Array.isArray(save) ? save[0] : save;
        var sect = top && top.MySectData;
        if (!sect || typeof sect !== 'object') return empty;

        // 每日基础经验来自科技：dayexp 超过 1 万按千分位换算
        var dayexp = sect.SectTechKV && sect.SectTechKV.dayexp;
        var base = Array.isArray(dayexp) ? Number(dayexp[0]) : Number(dayexp !== undefined && dayexp !== null ? (dayexp[0] !== undefined ? dayexp[0] : dayexp[1] !== undefined ? dayexp[1] : dayexp.value) : 0);
        var dailyBaseExp = base > 10000 ? Math.trunc(base / 1000) : (base > 0 ? Math.trunc(base) : 200);
        var now = Math.trunc(Number(top.RealTime) || 0);

        var context = {
            currentTime: now,
            replacementLastAt: Math.trunc(Number(sect.TaskCD ? (sect.TaskCD[10056] !== undefined ? sect.TaskCD[10056] : 0) : 0) || 0),
            replacementCooldown: 86400,
            dailyBaseExp: dailyBaseExp,
            dailyExtraExp: 0,
            masterTokens: 20,
            dailyMasterTokens: 10,
            masterTokenCap: 99,
            nextDailyAt: now + 86400
        };

        function collect(container, prefix, source) {
            var out = [];
            if (Array.isArray(container)) {
                container.forEach(function (raw, i) {
                    var s = normalizeStudent(raw, prefix + '[' + i + ']', i, context);
                    if (s) { s.source = source; out.push(s); }
                });
            }
            return out;
        }

        return {
            enrolled: collect(sect.Student, '$.MySectData.Student', 'enrolled'),
            shop: collect(sect.TempStudent, '$.MySectData.TempStudent', 'shop'),
            context: context,
            shopState: {
                seed: Math.trunc(Number(sect.StuSeed) || 0),
                refreshes: Math.max(0, Math.trunc(Number(sect.StuFresh) || 0)),
                npc: sect.ShopNpc && typeof sect.ShopNpc === 'object' ? sect.ShopNpc : {}
            }
        };
    }

    /* ---------------- 对外 API ---------------- */

    function withConfig(fn) {
        return function () {
            if (!configured) configure();
            return fn.apply(null, arguments);
        };
    }

    global.YYJHHengshan = {
        ready: ready,
        call: call,
        collectStudentGroups: collectStudentGroups,
        talentName: withConfig(function (id) { return call('hengshan.talentName', { id: Number(id) }); }),
        normalizeState: function (student) { return call('hengshan.normalizeState', { student: student }); },
        advanceDay: withConfig(function (student) { return call('hengshan.advanceDay', { student: student }); }),
        replacementChain: withConfig(function (student, slotIndex, count) {
            return call('hengshan.replacementChain', { student: student, slotIndex: slotIndex, count: count });
        }),
        replacementOnce: withConfig(function (student, slotIndex) {
            return call('hengshan.replacementOnce', { student: student, slotIndex: slotIndex });
        }),
        shopRefresh: withConfig(function (state) { return call('hengshan.shopRefresh', { state: state }); }),
        buildPool: withConfig(function (keep, gettag) { return call('hengshan.buildPool', { keep: keep, gettag: gettag }); }),
        draw: function (seed, pool) { return call('hengshan.draw', { seed: seed, pool: pool }); },
        lrand48First: function (seed) { return call('hengshan.lrand48First', { seed: seed }); },
        prepareRecruit: function (student) {
            if (student.recruitPrepared || student.source === 'enrolled') return {state: JSON.parse(JSON.stringify(student)), action: null};
            var state = call('hengshan.normalizeState', {student: student});
            state.specials = state.specials.map(function (special) { return {id: special.id, exp: special.exp}; });
            var before = JSON.parse(JSON.stringify(state.levelGrowth));
            state.seed = call('hengshan.lrand48First', {seed: state.seed + 4}) % 2047483645 + 1;
            var property = ['str', 'con', 'dex', 'int'][state.seed % 4];
            state.levelGrowth[property] += 1;
            return {state: Object.assign({}, student, state, {recruitPrepared: true}), action: {
                type: 'recruit', seedBefore: student.seed, seedAfter: state.seed,
                levelGrowthBefore: before, levelGrowthAfter: state.levelGrowth
            }};
        },
        optimize: withConfig(function (student, targetIds, options) {
            return call('hengshan.optimize', { student: student, targetIds: targetIds, options: options });
        })
    };
})('undefined' !== typeof globalThis ? globalThis : window);