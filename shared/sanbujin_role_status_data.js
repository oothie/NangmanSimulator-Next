(function (root) {
    'use strict';

    var GROUPS = Object.freeze([
        Object.freeze({ id: 'cultivation', name: '修为统计', note: '六类修为、来源明细与可转移点数' }),
        Object.freeze({ id: 'hengshan', name: '恒山职务', note: '每日永久培养与任职效果分开计算' }),
        Object.freeze({ id: 'training', name: '门派与地点修炼', note: '按当前角色或主角独立读取' }),
        Object.freeze({ id: 'consumable', name: '丹药与食物', note: '按服用次数或一次性标记计算' }),
        Object.freeze({ id: 'other', name: '其他永久培养', note: '全队共享进度会特别标明' })
    ]);

    var HENGSHAN_POSITIONS = Object.freeze({
        1001: Object.freeze({ name: '刀法教习', effect: '攻击与刀法修为', limits: '攻击 50 · 刀法修为 100' }),
        1002: Object.freeze({ name: '剑法教习', effect: '速度与剑法修为', limits: '速度 100 · 剑法修为 100' }),
        1003: Object.freeze({ name: '长兵教习', effect: '防御与枪棍修为', limits: '防御 150 · 枪棍修为 100' }),
        1004: Object.freeze({ name: '拳脚教习', effect: '招架与拳脚修为', limits: '招架 100 · 拳脚修为 100' }),
        1005: Object.freeze({ name: '内功教习', effect: '气血与内功修为', limits: '气血 500 · 内功修为 100' }),
        1006: Object.freeze({ name: '轻功教习', effect: '闪避与轻功修为', limits: '闪避 100 · 轻功修为 100' }),
        1007: Object.freeze({ name: '总教头', effect: '任职期间气血 +2%', limits: '任职效果，不累计' }),
        1008: Object.freeze({ name: '大护法', effect: '任职期间免伤 +2%', limits: '任职效果，不累计' }),
        1009: Object.freeze({ name: '执法人', effect: '任职期间攻击 +2%', limits: '任职效果，不累计' })
    });

    var PROGRESS_SOURCES = Object.freeze([
        Object.freeze({
            id: 'jhg-hanyuguan', group: 'training', name: '拘魂阁寒玉棺',
            detail: '闭棺永久提升韧性；每次随机获得 5–12 点，按角色分别累计',
            scope: 'role', key: function (roleId) { return 'getRX_HanYuGuan_' + roleId; },
            max: 100, unit: '韧性'
        }),
        Object.freeze({
            id: 'sea-hit', group: 'training', name: '海岛浪涛修炼',
            detail: '踏浪修炼永久提升命中；每次获得 5 点，按角色分别累计',
            scope: 'role', key: function (roleId) { return 'seahit' + roleId; },
            max: 100, unit: '命中'
        }),
        Object.freeze({
            id: 'dali-pool', group: 'training', name: '苍山·蝴蝶泉修炼',
            detail: '温泉修炼永久提升气血；按角色分别累计',
            scope: 'role', key: function (roleId) { return 'dlhp_' + roleId; },
            max: 100, unit: '气血'
        }),
        Object.freeze({
            id: 'liushanmen-room', group: 'training', name: '六扇门闭关室',
            detail: '闭关永久提升命中；按角色分别累计',
            scope: 'role', key: function (roleId) { return 'getMZ_BiGuanShi_' + roleId; },
            max: 100, unit: '命中'
        }),
        Object.freeze({
            id: 'wanshache-room', group: 'training', name: '万蛇窟石室修炼',
            detail: '观摩石刻永久提升防御；按角色分别累计',
            scope: 'role', key: function (roleId) { return 'wscdef' + roleId; },
            max: 100, unit: '防御'
        }),
        Object.freeze({
            id: 'wuchang', group: 'consumable', name: '无常丹',
            detail: '每次随机永久提升一项战斗属性',
            scope: 'role', key: function (roleId) { return '2630_' + roleId; },
            max: 100, unit: '枚'
        }),
        Object.freeze({
            id: 'zhenwu', group: 'consumable', name: '真武丹',
            detail: '每次随机增加 10 点臂力、身法、根骨或内息资质',
            scope: 'role', key: function (roleId) { return '2640_' + roleId; },
            max: 100, unit: '枚'
        }),
        Object.freeze({
            id: 'putizi', group: 'consumable', name: '菩提子',
            detail: '每粒永久增加臂力、身法、根骨、内息各 1 点；每位角色最多服用 3 粒',
            scope: 'role', key: function (roleId) { return '2637_' + roleId; },
            max: 3, unit: '粒', gain: Object.freeze({ label: '四项基础属性各', perUse: 1,
                note: '仅计每粒的基础加成，不含主角首次服用时可能获得的佛法额外内息。' })
        }),
        Object.freeze({
            id: 'huangquan', group: 'consumable', name: '黄泉水',
            detail: '每次随机永久增加攻击 3、速度 5 或命中 4',
            scope: 'role', key: function (roleId) { return '2645_' + roleId; },
            max: 3, unit: '份'
        }),
        Object.freeze({
            id: 'jiuyougu', group: 'consumable', name: '九幽菇',
            detail: '每次随机永久增加防御 6、闪避 5 或招架 5',
            scope: 'role', key: function (roleId) { return '2646_' + roleId; },
            max: 3, unit: '份'
        }),
        Object.freeze({
            id: 'taiyi-seven', group: 'consumable', name: '七宝玄丹',
            detail: '七次药力依次衰减，永久增加气血、攻击、速度、闪避与韧性',
            scope: 'role', key: function (roleId) { return '2656_' + roleId; },
            max: 7, unit: '枚'
        }),
        Object.freeze({
            id: 'cuiyuan-jindan', group: 'consumable', name: '淬元金丹',
            detail: '解锁内劲后每枚永久增加 20 点内劲',
            scope: 'role', key: function (roleId) { return '8806_' + roleId; },
            max: 5, unit: '枚', gain: Object.freeze({ label: '内劲', perUse: 20 })
        }),
        Object.freeze({
            id: 'ningtian-yugao', group: 'consumable', name: '凝天玉膏',
            detail: '解锁罡气后每份永久增加 30 点罡气',
            scope: 'role', key: function (roleId) { return '8807_' + roleId; },
            max: 5, unit: '份', gain: Object.freeze({ label: '罡气', perUse: 30 })
        }),
        Object.freeze({
            id: 'mingshe-dan', group: 'consumable', name: '冥蛇丹',
            detail: '解锁内劲后每枚永久增加 20 点内劲',
            scope: 'role', key: function (roleId) { return '8823_' + roleId; },
            max: 5, unit: '枚', gain: Object.freeze({ label: '内劲', perUse: 20 })
        }),
        Object.freeze({
            id: 'yougui-dan', group: 'consumable', name: '幽鬼丹',
            detail: '解锁罡气后每枚永久增加 20 点罡气',
            scope: 'role', key: function (roleId) { return '8824_' + roleId; },
            max: 5, unit: '枚', gain: Object.freeze({ label: '罡气', perUse: 20 })
        }),
        Object.freeze({
            id: 'renqing-dan', group: 'consumable', name: '仁青丹',
            detail: '每枚永久增加 6 点韧性；兼容新旧物品计数',
            scope: 'role', keys: function (roleId) { return ['9279_' + roleId, '9408_' + roleId]; },
            max: 5, unit: '枚', gain: Object.freeze({ label: '韧性', perUse: 6 })
        }),
        Object.freeze({
            id: 'stone-lock', group: 'other', name: '家宅石锁较力',
            detail: '胜者永久增加 1 点韧性；30 次为全队共享总上限',
            scope: 'shared', key: 'home_ssrx_max', max: 30, unit: '次'
        })
    ]);

    var ONE_TIME_SOURCES = Object.freeze([
        Object.freeze({
            id: 'one-hp-pill', group: 'consumable', name: '紫清金丹',
            detail: '按根骨永久增加 100–1000 点气血，单个角色只能服用一次',
            scope: 'role', key: function (roleId) { return '2649_' + roleId; }
        })
    ]);

    function saveRoot(saveData) {
        return Array.isArray(saveData) ? (saveData[0] || {}) : (saveData || {});
    }

    function own(object, key) {
        return !!object && Object.prototype.hasOwnProperty.call(object, key);
    }

    function readNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
        if (value && typeof value === 'object') {
            return readNumber(value.value ?? value.Value ?? value.val ?? value.Val);
        }
        return null;
    }

    function readMap(container, key) {
        if (!container) return undefined;
        if (own(container, key)) return container[key];
        if (own(container, String(key))) return container[String(key)];
        if (Array.isArray(container)) {
            for (var index = 0; index < container.length; index += 1) {
                var entry = container[index];
                if (!entry || typeof entry !== 'object') continue;
                var entryKey = entry.ID ?? entry.Id ?? entry.id ?? entry.Key ?? entry.key;
                if (String(entryKey) === String(key)) return entry;
            }
        }
        return undefined;
    }

    function globalVariables(saveData) {
        var source = saveRoot(saveData);
        return source.globalVariable || source.GlobalVariable || source.P || null;
    }

    function readGlobal(saveData, key) {
        var variables = globalVariables(saveData);
        if (!variables) return null;
        var value = readMap(variables, key);
        return value === undefined ? 0 : readNumber(value);
    }

    function roleIdOf(role, tag) {
        var roleId = role && (role.ID ?? role.Id ?? role.id);
        if (roleId != null) return roleId;
        return tag === '主角' ? 1 : null;
    }

    function statusFor(current, max) {
        if (current === null) return 'unknown';
        if (current >= max) return 'full';
        if (current > 0) return 'progress';
        return 'not-started';
    }

    function evaluateProgressSource(source, saveData, role, tag) {
        var roleId = roleIdOf(role, tag);
        if (source.scope === 'main' && tag !== '主角') return null;
        if (source.scope === 'role' && roleId == null) return null;

        var keys = source.keys
            ? source.keys(roleId)
            : [typeof source.key === 'function' ? source.key(roleId) : source.key];
        var values = keys.map(function (key) { return readGlobal(saveData, key); });
        var current = values.every(function (value) { return value === null; })
            ? null
            : Math.max.apply(null, values.map(function (value) { return value === null ? 0 : value; }));
        if (current !== null) current = Math.max(0, Math.min(source.max, current));

        var gains = source.gain && current !== null ? [{
            label: source.gain.label,
            current: current * source.gain.perUse,
            max: source.max * source.gain.perUse,
            ...(source.gain.note ? { note: source.gain.note } : {})
        }] : null;

        return {
            id: source.id,
            group: source.group,
            name: source.name,
            detail: source.detail,
            scope: source.scope,
            current: current,
            max: source.max,
            unit: source.unit,
            remaining: current === null ? null : Math.max(0, source.max - current),
            status: statusFor(current, source.max),
            progressKind: source.group === 'consumable' ? 'uses' : 'amount',
            gains: gains
        };
    }

    function pozhangPill(role, tag) {
        if (roleIdOf(role, tag) == null) return null;
        // item_2662 shows GetYiChu and increments AddYiChu for the chosen stat.
        // YiChu* is the saved per-stat amount, unlike the bag count or the
        // temporary 2662_<role> selection counter; HeDao limit effects are separate.
        var metrics = [['臂力', 'YiChuStr'], ['身法', 'YiChuDex'],
            ['根骨', 'YiChuCon'], ['内息', 'YiChuInt']].map(function (item) {
            var raw = readNumber(role && role[item[1]]);
            return { label: item[0], current: raw === null ? null : Math.max(0, Math.min(30, raw)), max: 30 };
        });
        var current = metrics.every(function (metric) { return metric.current !== null; })
            ? metrics.reduce(function (sum, metric) { return sum + metric.current; }, 0) : null;
        return { id: 'pozhang-dan', group: 'consumable', name: '破障丹', scope: 'role',
            detail: '每枚提升所选属性的溢出上限 1 点；臂力、身法、根骨、内息分别最多提升 30 点',
            current: current, max: 120, unit: '枚', progressKind: 'uses', metrics: metrics,
            remaining: current === null ? null : 120 - current, status: statusFor(current, 120) };
    }

    // 紫清金丹：服用时按当时的根骨给 100 + 根骨×2（上限 1000）。
    // 存档只记录「吃没吃过」，不记录当时的根骨/实际加了多少，
    // 所以这里只给「按当前根骨算出来的上限」，不再冒充历史数值。
    function ziqingGain(context) {
        var con = context && context.finalCon;
        if (con == null || !Number.isFinite(Number(con))) return null;
        var conValue = Math.trunc(Number(con));
        var upper = Math.min(1000, 100 + conValue * 2);
        return {
            label: '气血',
            current: upper,
            max: 1000,
            valueText: '≤ +' + upper,
            note: '存档只记录「已服用」，没记服用时的根骨与实际加成；按当前根骨 ' + conValue
                + ' 推算上限 +' + upper + '（满值 1000），实际不会超过这个数'
        };
    }

    function evaluateOneTimeSource(source, saveData, role, tag, context) {
        var roleId = roleIdOf(role, tag);
        if (source.scope === 'role' && roleId == null) return null;
        var key = typeof source.key === 'function' ? source.key(roleId) : source.key;
        var raw = readGlobal(saveData, key);
        var used = raw === null ? null : raw > 0;
        var gains = null;
        if (used !== null) {
            if (source.id === 'one-hp-pill') {
                var ziqing = ziqingGain(context);
                if (ziqing) gains = [ziqing];
            } else if (source.gain) {
                gains = [{
                    label: source.gain.label,
                    current: used ? source.gain.value : 0,
                    max: source.gain.value
                }];
            }
        }

        return {
            id: source.id,
            group: source.group,
            name: source.name,
            detail: source.detail,
            scope: source.scope,
            current: used === null ? null : (used ? 1 : 0),
            max: 1,
            unit: '次',
            remaining: used === null ? null : (used ? 0 : 1),
            status: used === null ? 'unknown' : (used ? 'full' : 'not-started'),
            oneTime: true,
            progressKind: 'uses',
            gains: gains
        };
    }

    function bloodPoolMetrics(saveData, role, tag) {
        var roleId = roleIdOf(role, tag);
        var isMain = tag === '主角';
        if (!isMain && roleId == null) return null;
        var fields = isMain ? [
            ['攻击', '2660_atk', 50], ['气血', '2660_hp', 200], ['防御', '2660_def', 100],
            ['闪避', '2660_dodge', 80], ['命中', '2660_hit', 80], ['速度', '2660_speed', 80],
            ['招架', '2660_parry', 80], ['韧性', '2660_renxing', 80]
        ] : [
            ['攻击', '2660_atk_' + roleId, 50], ['气血', '2660_hp_' + roleId, 200],
            ['防御', '2660_def_' + roleId, 100], ['韧性', '2660_renxing_' + roleId, 100]
        ];
        var metrics = fields.map(function (field) {
            var current = readGlobal(saveData, field[1]);
            return {
                label: field[0],
                current: current === null ? null : Math.max(0, Math.min(field[2], current)),
                max: field[2]
            };
        });
        var known = metrics.filter(function (metric) { return metric.current !== null; });
        var full = known.length === metrics.length && known.every(function (metric) { return metric.current >= metric.max; });
        var started = known.some(function (metric) { return metric.current > 0; });
        return {
            id: 'jhg-xuechi', group: 'training', name: '拘魂阁血池淬炼',
            detail: isMain ? '主角八项永久属性分别设有上限' : '伙伴四项永久属性按角色分别设有上限',
            scope: isMain ? 'main' : 'role', metrics: metrics,
            status: known.length !== metrics.length ? 'unknown' : (full ? 'full' : (started ? 'progress' : 'not-started'))
        };
    }

    function dragonFightMetrics(saveData, tag) {
        if (tag !== '主角') return null;
        var fields = [
            ['攻击', '3255_atk', 50], ['气血', '3255_hp', 200], ['防御', '3255_def', 100],
            ['闪避', '3255_dodge', 80], ['命中', '3255_hit', 80], ['速度', '3255_speed', 80],
            ['招架', '3255_parry', 80], ['韧性', '3255_renxing', 80]
        ];
        var metrics = fields.map(function (field) {
            var current = readGlobal(saveData, field[1]);
            return {
                label: field[0],
                current: current === null ? null : Math.max(0, Math.min(field[2], current)),
                max: field[2]
            };
        });
        var known = metrics.filter(function (metric) { return metric.current !== null; });
        var full = known.length === metrics.length && known.every(function (metric) { return metric.current >= metric.max; });
        var started = known.some(function (metric) { return metric.current > 0; });
        return {
            id: 'liushanmen-longdou', group: 'training', name: '六扇门龙斗淬炼',
            detail: '主角八项永久属性分别设有上限', scope: 'main', metrics: metrics,
            status: known.length !== metrics.length ? 'unknown' : (full ? 'full' : (started ? 'progress' : 'not-started'))
        };
    }

    function findDeep(object, keys, depth, visited) {
        if (!object || typeof object !== 'object' || depth > 6 || visited.has(object)) return null;
        visited.add(object);
        for (var index = 0; index < keys.length; index += 1) {
            if (own(object, keys[index])) return object[keys[index]];
        }
        var names = Object.keys(object);
        for (var childIndex = 0; childIndex < names.length; childIndex += 1) {
            var found = findDeep(object[names[childIndex]], keys, depth + 1, visited);
            if (found !== null && found !== undefined) return found;
        }
        return null;
    }

    // JHSectData.doResetJob: FDLog[roleId][attribute + '_' + jobId]
    // stores settled permanent gains; globalVariable['sect' + roleId + '_' + attribute]
    // stores their totals. FDJob retains only the current appointment, not a timeline.
    var HENGSHAN_GAINS = Object.freeze([
        [1001, 'atk', '攻击', 50, 2, '刀法修为', 100],
        [1002, 'speed', '速度', 100, 3, '剑法修为', 100],
        [1003, 'def', '防御', 150, 4, '枪棍修为', 100],
        [1004, 'parry', '招架', 100, 1, '拳脚修为', 100],
        [1005, 'hp', '气血', 500, 'ng', '内功修为', 100],
        [1006, 'dodge', '闪避', 100, 'qg', '轻功修为', 100]
    ].map(Object.freeze));

    function hengshanRoleRecord(container, roleId) {
        if (!container || roleId == null) return null;
        if (!Array.isArray(container)) return readMap(container, roleId) ?? null;
        return container.find(function (item) {
            if (!item || typeof item !== 'object') return false;
            var id = item.roleId ?? item.RoleID ?? item.id ?? item.ID ?? item.onlyid;
            return id != null && String(id) === String(roleId);
        }) || null;
    }

    function hengshanJob(saveData, role, tag, context) {
        var roleId = roleIdOf(role, tag);
        var source = saveRoot(saveData);
        var jobs = findDeep(source, ['FDJob', 'm_tFDJob'], 0, new Set());
        var logs = findDeep(source, ['FDLog', 'm_tFDLog'], 0, new Set());
        var record = hengshanRoleRecord(jobs, roleId);
        var log = hengshanRoleRecord(logs, roleId);
        var variables = globalVariables(saveData);
        var positionId = readNumber(record && (record.job ?? record.Job ?? record.position ?? record.Position ?? record.pos));
        if (positionId === null && record !== null) positionId = readNumber(record);
        var position = HENGSHAN_POSITIONS[positionId];
        var active = positionId !== null && positionId > 0;
        var metrics = [];
        var history = [];

        HENGSHAN_GAINS.forEach(function (fields) {
            var jobId = fields[0];
            var recorded = false;
            var gains = [1, 4].map(function (offset) {
                var attribute = fields[offset];
                var logKey = attribute + '_' + jobId;
                var globalKey = 'sect' + roleId + '_' + attribute;
                var max = fields[offset + 2];
                var hasLog = own(log, logKey);
                recorded = recorded || hasLog;
                // Each permanent attribute belongs to exactly one of the six jobs.
                var current = hasLog ? readNumber(log[logKey])
                    : own(variables, globalKey) ? readNumber(variables[globalKey])
                    : (log || logs || variables ? 0 : null);
                if (current !== null) current = Math.max(0, Math.min(max, current));
                var metric = { label: fields[offset + 1], current: current, max: max };
                metrics.push(metric);
                return metric;
            });
            if (recorded || jobId === positionId || gains.some(function (gain) { return gain.current > 0; })) {
                history.push({
                    jobId: jobId, name: HENGSHAN_POSITIONS[jobId].name,
                    active: jobId === positionId, gains: gains
                });
            }
        });
        if (active && !HENGSHAN_GAINS.some(function (fields) { return fields[0] === positionId; })) {
            history.push({ jobId: positionId, name: position ? position.name : '未知职务（' + positionId + '）', active: true, gains: [] });
        }
        var started = metrics.some(function (metric) { return metric.current > 0; });
        var full = metrics.every(function (metric) { return metric.current !== null && metric.current >= metric.max; });
        var ontime = readNumber(record && (record.ontime ?? record.OnTime));
        var nowSeconds = readNumber(context && context.nowSeconds);
        if (nowSeconds === null) nowSeconds = Date.now() / 1000;
        return {
            id: 'hengshan-job', group: 'hengshan', name: '恒山职务',
            detail: '六类教习的属性与修为永久保留；高级职务效果只在任职期间生效',
            scope: 'role', status: active ? 'active' : full ? 'full' : started ? 'progress' : jobs ? 'not-started' : 'unknown',
            currentText: active ? '当前任职：' + (position ? position.name : '未知职务（' + positionId + '）')
                : jobs ? '当前未任职' : '存档未记录当前职务',
            appointmentTime: active && ontime > 0 ? ontime : null,
            appointmentActive: active,
            appointmentDays: active && ontime > 0 ? Math.max(0, Math.floor((nowSeconds - ontime) / 86400)) : null,
            appointmentEffect: active && positionId >= 1007 && position ? position.effect : null,
            history: history,
            historyNote: '按职务汇总可确认记录；完整任免日期、先后顺序及未留记录的已卸任职务无法追溯。',
            permanentMetrics: metrics,
            rules: Object.keys(HENGSHAN_POSITIONS).map(function (key) {
                var item = HENGSHAN_POSITIONS[key];
                return { name: item.name, effect: item.effect, limits: item.limits };
            })
        };
    }

    var CULTIVATION_KINDS = Object.freeze([
        [1, '拳脚', 'Taolus', 'taolu', 'jlgcc_', '极乐谷切磋'],
        [2, '刀法', 'Taolus', 'taolu'],
        [3, '剑法', 'Taolus', 'taolu', 'jwgjz_', '剑王阁切磋'],
        [4, '枪棍', 'Taolus', 'taolu'],
        ['ng', '内功', 'Neis', 'nei'],
        ['qg', '轻功', 'Qings', 'qing']
    ].map(Object.freeze));

    function cultivationList(value) {
        if (Array.isArray(value)) return value;
        return value && typeof value === 'object' ? Object.values(value) : null;
    }

    function cultivationSkill(skill, config, copiedConfig) {
        var cfg = copiedConfig || config;
        if (!skill || !cfg) return null;
        var chong = readNumber(skill.Chong);
        var level = readNumber(skill.Level);
        var grade = readNumber(cfg.grade);
        if (chong === null || level === null || grade === null) return null;
        var data = root.KONGFU_DATA;
        var row = data && data.rate && data.rate[String((chong - 1) * 4 + level + 1)];
        var rate = row && readNumber(row['kf_' + Math.min(5, Math.max(1, grade))]);
        var base = own(cfg, 'wxxw') ? readNumber(cfg.wxxw) : 0;
        return rate == null || base === null ? null : Math.floor(base * Math.min(rate, 1));
    }

    function cultivationStats(saveData, role, tag) {
        var data = root.KONGFU_DATA;
        var roleId = roleIdOf(role, tag);
        var historyNote = '培养记录为历史累计，可能已转出，不与当前余额叠加；未记录的额外来源无法逐笔还原。';
        var records = CULTIVATION_KINDS.map(function (kind) {
            var id = kind[0];
            var list = cultivationList(role && role[kind[2]]);
            var skills = [];
            var unknownTypes = [];
            (list || []).forEach(function (skill) {
                if (!skill || typeof skill !== 'object') { unknownTypes.push('未识别记录'); return; }
                var cfg = data && data[kind[3]] && data[kind[3]][String(skill.ID)];
                var copiedId = readNumber(skill.CopyID);
                var copied = kind[2] === 'Taolus' && copiedId > 0;
                var copyCfg = copied && data && data.taolu && data.taolu[String(copiedId)];
                var actualCfg = copied ? copyCfg : cfg;
                if (kind[2] === 'Taolus') {
                    if (!actualCfg || readNumber(actualCfg.type) === null) {
                        unknownTypes.push(skill.ID);
                        return;
                    }
                    if (Number(actualCfg.type) !== id) return;
                }
                skills.push({
                    id: skill.ID,
                    name: cfg && cfg.name || '未知武学（' + skill.ID + '）',
                    copiedName: copied ? (copyCfg && copyCfg.name || '未知武学（' + copiedId + '）') : null,
                    chong: readNumber(skill.Chong), level: readNumber(skill.Level),
                    current: copied && !copyCfg ? null : cultivationSkill(skill, cfg, copyCfg)
                });
            });
            var learned = list && !unknownTypes.length && skills.every(function (item) { return item.current !== null; })
                ? skills.reduce(function (sum, item) { return sum + item.current; }, 0) : null;
            var extra = readNumber(role && role['WXXW' + id]);
            var fixed = kind[4] ? readGlobal(saveData, kind[4] + roleId) : 0;
            // Actual game transfer pool: home dispatch is included; two sparring counters are excluded.
            var transferable = extra !== null && fixed !== null ? Math.max(0, extra - fixed) : null;
            var gameTransferable = extra !== null && fixed !== null ? Math.max(0, extra - fixed) : null;
            var raw = extra !== null && learned !== null ? extra + learned : null;
            var history = [];
            function addHistory(name, key, multiplier) {
                var value = readGlobal(saveData, key);
                if (value > 0) history.push({ name: name, current: value * (multiplier || 1) });
            }
            addHistory('恒山教习', 'sect' + roleId + '_' + id);
            if (id === 3) addHistory('紫阳书院指点', 'zysy_' + roleId, 2);
            if (id === 'ng') addHistory('紫阳书院指点', 'zysy1_' + roleId, 2);
            return {
                kind: id, name: kind[1], current: raw === null ? null : Math.min(raw, 1500),
                raw: raw, overflow: raw === null ? null : Math.max(0, raw - 1500), max: 1500,
                learned: learned, extra: extra, fixed: fixed, fixedName: kind[5] || null,
                transferable: transferable, gameTransferable: gameTransferable, skills: skills, unknownSkills: unknownTypes, history: history,
                inconsistent: extra !== null && fixed !== null && (extra < 0 || fixed < 0 || fixed > extra)
            };
        });
        function total(field) {
            return records.every(function (record) { return record[field] !== null; })
                ? records.reduce(function (sum, record) { return sum + record[field]; }, 0) : null;
        }
        return {
            id: 'cultivation-summary', group: 'cultivation', name: '修为统计', scope: 'role', status: 'summary',
            detail: '总修为按六类当前生效修为合计，每类上限 1500；可转移点数按游戏规则统计，包含家园派遣，扣除剑王阁与极乐谷切磋所得。',
            cultivation: { records: records, total: total('current'), transferable: total('transferable'),
                learned: total('learned'), historyNote: historyNote,
                transferNote: '可转移点数不含武学与剑王阁、极乐谷切磋所得；实际转移还受受功者修为上限限制。' }
        };
    }

    function evaluate(saveData, role, tag, context) {
        var entries = [
            cultivationStats(saveData, role, tag),
            hengshanJob(saveData, role, tag, context),
            bloodPoolMetrics(saveData, role, tag),
            dragonFightMetrics(saveData, tag),
            pozhangPill(role, tag)
        ];
        PROGRESS_SOURCES.forEach(function (source) {
            entries.push(evaluateProgressSource(source, saveData, role, tag));
        });
        ONE_TIME_SOURCES.forEach(function (source) {
            entries.push(evaluateOneTimeSource(source, saveData, role, tag, context));
        });
        return GROUPS.map(function (group) {
            return Object.assign({}, group, {
                entries: entries.filter(function (entry) { return entry && entry.group === group.id; })
            });
        }).filter(function (group) { return group.entries.length > 0; });
    }

    root.RoleStatusData = Object.freeze({
        cultivation: cultivationStats,
        groups: GROUPS,
        positions: HENGSHAN_POSITIONS,
        sources: PROGRESS_SOURCES,
        evaluate: evaluate,
        globalValue: readGlobal
    });
})(typeof window !== 'undefined' ? window : globalThis);