const COLOR_NAMES = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.colorNames) || {
    1: '백색', 2: '녹색', 3: '청색', 4: '자색', 5: '주황색', 6: '적색',
};
const PROP_NAMES = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.propNames) || {};
const TYPE_NAMES = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.typeNames) || {};

function nangmanEquipmentDisplayName(e) {
    const cfg = EQUIP_DATA.equipment?.[String(e?.id ?? e?.equip_id ?? '')];
    const original = String(e?.name ?? cfg?.name ?? '');
    return cfg?.koName || window.SBJ_KOREAN?.translate?.(original) || original;
}
function nangmanEquipmentDisplayText(value) {
    const original = String(value ?? '');
    return window.SBJ_KOREAN?.translate?.(original) || original;
}

let makeRndSnapshot = null;
let saveLoaded = false;
let logLines = [];
let saveMeta = null;
let saveEquips = [];
let saveEquipsSnapshot = [];
let equipRuntime = {};
let equipRuntimeSnapshot = {};
let currentTab = 'make';
let craftedSeq = 900000000;
let makeAdvanceNotice = null;

const PREVIEW_MAX = 5000;
const XILIAN_MAX = 5000;
const LOG_PAGE_SIZE = 40;
const PATH_PAGE_SIZE = 12;
const MAKE_REGION_FILTER_STORAGE_KEY = 'yanyu_utils_equip_make_region_filter_v1';
const MAKE_AUTO_SHENGLIAN_STORAGE_KEY = 'yanyu_utils_equip_make_auto_shenglian_v1';
const CRAFTED_MJ_SEED_PAPER_MULTIPLIER = 198;
const SPECIAL_MATERIAL_PART_OVERRIDES = Object.freeze({
    6884: Object.freeze([7]),
});
const JIANWANG_SWORD_IDS = new Set([5707, 5708, 5709, 5710, 5711, 5712, 5713, 5714, 5715, 5716, 5717]);
const JIANWANG_LEVEL_100_IDS = new Set([5714, 5715, 5716, 5717]);
const JIANWANG_LEVEL_90_IDS = new Set([5710, 5711, 5712, 5713]);
const JIANWANG_GROW_TARGETS = Object.freeze({
    5707: Object.freeze([5708]),
    5708: Object.freeze([5709]),
    5709: Object.freeze([5710, 5711, 5712, 5713]),
});
const JIANWANG_LEVEL_100_TARGETS = Object.freeze({ 5710: 5714, 5711: 5715, 5712: 5716, 5713: 5717 });
const JIANWANG_EXT_PROP_ORDER = Object.freeze([
    'atk_add', 'hit_add', 'def_add', 'hp_add', 'speed_add', 'dodge_add', 'parry_add', 'def_ign',
    'unarmed_add', 'sword_add', 'blade_add', 'stick_add', 'hp_back', 'mp_back', 'mp_f', 'dmg_off',
    'dmg_ref', 'blood', 'renxing', 'po_parry', 'po_dodge', 'atk_extend', 'xx_prob', 'xx_crit',
]);
const JIANWANG_BASE_PROP_ORDER = Object.freeze(['atk', 'def', 'hit', 'hp', 'speed', 'dodge', 'parry', 'neijin', 'gq_base']);
const JIANWANG_COLOR_ROLL_WEIGHTS = Object.freeze([74, 20, 5, 1]);
const JIANWANG_REFORGE_COSTS = Object.freeze([
    Object.freeze([2, 3]), Object.freeze([3, 4]), Object.freeze([4, 4]),
    Object.freeze([6, 5]), Object.freeze([6, 6]),
]);
const JIANWANG_REFORGE_LIMIT = 10;
const JIANWANG_BLANK_ID = 5707;
const JIANWANG_REDSEED_MJ_MULTIPLIER = 123;
const JIANWANG_REDSEED_CZ_MULTIPLIER = 321;
const JIANWANG_SHATTER_ROUTE_IDS = Object.freeze({
    5710: 5710, 5711: 5711, 5712: 5712, 5713: 5713,
    5714: 5710, 5715: 5711, 5716: 5712, 5717: 5713,
});
const JIANWANG_SHATTER_90 = 'shatter:90';
const JIANWANG_SHATTER_100 = 'shatter:100';

let tablePager = {
    mode: null,
    page: 1,
    makeItems: [],
    specialAttachItems: [],
    xilianEntries: [],
    strongItems: [],
    jianwangItems: [],
    jianwangKind: '',
    jianwangCyclePages: [],
    strongMinSet: null,
    strongBestSet: null,
};
let jianwangReforgeCounts = {};
let lastJianwangAction = '';
let jianwangReforgeCountsSnapshot = {};
let jianwangRedSeed = null;
let jianwangRedSeedSnapshot = null;
let jianwangRuleDetection = Object.freeze({
    rule: 'patched',
    confidence: 'fallback',
    reason: '장비 실물의 S값 자료가 부족하여 두 번째 보정 규칙을 유지합니다.',
});
let logPage = 1;
let pathPages = { min: 1, max: 1 };

function propLabel(key) {
    return PROP_NAMES[key] || key;
}

function truncateAttributeDecimal(value, decimals = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return number;
    const factor = 10 ** decimals;
    return Math.floor(number * factor + 1e-8) / factor;
}

function formatAttributeDecimal(value, decimals = 1) {
    const truncated = truncateAttributeDecimal(value, decimals);
    if (!Number.isFinite(truncated)) return String(value);
    return Number(truncated.toFixed(decimals)).toString();
}

function formatPropValue(prop, v) {
    if (typeof v !== 'number') return String(v);
    const asPct = v < 1 || prop === 'atk_extend';
    if (!asPct) return formatAttributeDecimal(v);
    return `${formatAttributeDecimal(v * 100)}%`;
}

function formatProps(list) {
    if (!list || !list.length) return '—';
    return list.map(p => {
        const shown = formatPropValue(p.prop, p.value);
        return `<span class="prop-line">${propLabel(p.prop)}+${shown}</span>`;
    }).join('');
}

function formatBase(base) {
    if (!base || !Object.keys(base).length) return '—';
    const order = ['atk', 'def', 'hit', 'hp', 'speed', 'dodge', 'parry'];
    const parts = [];
    for (const k of order) {
        if (base[k] != null) parts.push(`${propLabel(k)}${formatAttributeDecimal(base[k])}`);
    }
    for (const [k, v] of Object.entries(base)) {
        if (!order.includes(k)) parts.push(`${propLabel(k)}${formatAttributeDecimal(v)}`);
    }
    return parts.join(' / ');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
}

function getPreviewPageSize() {
    return Number(document.getElementById('previewPageSize')?.value) || 20;
}

function updatePreviewPager(total) {
    const bar = document.getElementById('previewPager');
    const info = document.getElementById('previewPagerInfo');
    if (!bar || !info) return;
    const pagerSize = document.getElementById('previewPageSizeWrap');
    if (pagerSize) pagerSize.hidden = false;
    const pageSize = getPreviewPageSize();
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (tablePager.page > pages) tablePager.page = pages;
    if (tablePager.page < 1) tablePager.page = 1;
    bar.hidden = total <= 0;
    info.textContent = total
        ? `${tablePager.page}/${pages}페이지 · 전체 ${total}개`
        : '—';
    const prev = document.getElementById('btnPreviewPrev');
    const next = document.getElementById('btnPreviewNext');
    if (prev) prev.disabled = tablePager.page <= 1;
    if (next) next.disabled = tablePager.page >= pages;
}

function updateJianwangCyclePager(totalPages, swordIndex) {
    const bar = document.getElementById('previewPager');
    const info = document.getElementById('previewPagerInfo');
    if (!bar || !info) return;
    const pages = Math.max(1, Number(totalPages) || 1);
    if (tablePager.page > pages) tablePager.page = pages;
    if (tablePager.page < 1) tablePager.page = 1;
    bar.hidden = totalPages <= 0;
    const pagerSize = document.getElementById('previewPageSizeWrap');
    if (pagerSize) pagerSize.hidden = true;
    info.textContent = totalPages
        ? `${tablePager.page}/${pages}페이지 · ${swordIndex || tablePager.page}번째 검`
        : '—';
    const prev = document.getElementById('btnPreviewPrev');
    const next = document.getElementById('btnPreviewNext');
    if (prev) prev.disabled = tablePager.page <= 1;
    if (next) next.disabled = tablePager.page >= pages;
}

function hidePreviewPager() {
    const bar = document.getElementById('previewPager');
    if (bar) bar.hidden = true;
    tablePager.mode = null;
    tablePager.page = 1;
}

function renderCurrentPreviewPage() {
    if (tablePager.mode === 'make') renderMakePage();
    else if (tablePager.mode === 'specialAttach') renderSpecialAttachPage();
    else if (tablePager.mode === 'xilian') renderXilianPage();
    else if (tablePager.mode === 'strong') renderStrongPage();
    else if (tablePager.mode === 'jianwang') renderJianwangPage();
}

function updateLogPager() {
    const bar = document.getElementById('logPager');
    const info = document.getElementById('logPagerInfo');
    if (!bar || !info) return;
    const total = logLines.length;
    const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE) || 1);
    if (logPage > pages) logPage = pages;
    if (logPage < 1) logPage = 1;
    bar.hidden = total <= LOG_PAGE_SIZE;
    info.textContent = total
        ? `${logPage}/${pages}페이지 · 전체 ${total}개`
        : '—';
    const prev = document.getElementById('btnLogPrev');
    const next = document.getElementById('btnLogNext');
    if (prev) prev.disabled = logPage <= 1;
    if (next) next.disabled = logPage >= pages;
}

function renderLogPage() {
    const el = document.getElementById('makeLog');
    if (!el) return;
    if (!logLines.length) {
        el.textContent = '';
        updateLogPager();
        return;
    }
    const start = (logPage - 1) * LOG_PAGE_SIZE;
    el.textContent = logLines.slice(start, start + LOG_PAGE_SIZE).join('\n');
    updateLogPager();
}

function appendLog(line) {
    logLines.push(line);
    if (logLines.length > 20000) logLines.splice(0, logLines.length - 20000);
    logPage = Math.max(1, Math.ceil(logLines.length / LOG_PAGE_SIZE));
    renderLogPage();
}

function normalizeExts(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.filter(Boolean).map(e => ({
            prop: e.Key || e.prop || e.key,
            value: e.Value != null ? e.Value : e.value,
        })).filter(e => e.prop);
    }
    return [];
}

function normalizeJianwangExts(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.filter(Boolean).map(e => ({
            prop: e.Key || e.prop || e.key,
            value: e.Value != null ? e.Value : e.value,
            S: e.S != null ? e.S : (e.s || 0),
            propCheck: e.PropCheck || e.propCheck || '',
        })).filter(e => e.prop);
    }
    return [];
}

function parseXilianMarks(raw) {
    const data = raw?.ExtsXilianData;
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data)
        .filter(k => data[k])
        .map(Number)
        .filter(n => n >= 1 && n <= 3)
        .sort((a, b) => a - b);
}

/* 新装备补录：藏兵阁等未在 equip_data.js 里的装备 */
if (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.equipment && !EQUIP_DATA.equipment['4027']) {
    EQUIP_DATA.equipment['4027'] = {
        id: 4027, name: '清霜', type: 1, lv: 100, weapon_color: 0, price: 0, equ_next: 0,
        base: { atk: 1100, hit: 1200, neijin: 210 },
        exts: { def_ign: [0.06, 50], unarmed_add: [0.06, 10] },
    };
}

function toEquipInstance(raw, source, equipped, owner = '') {
    const id = raw.ID || raw.id;
    const cfg = EQUIP_DATA.equipment[String(id)] || {};
    const marks = parseXilianMarks(raw);
    const exts = JIANWANG_SWORD_IDS.has(Number(id))
        ? normalizeJianwangExts(raw.EnExts || raw.exts)
        : normalizeExts(raw.EnExts || raw.exts);
    const noXilianExts = normalizeExts(raw.EnNoXLExts || raw.en_no_xl_exts);
    const initialExts = noXilianExts.length ? noXilianExts : exts;
    return {
        id,
        only_id: raw.OnlyID || raw.only_id || 0,
        name: cfg.name || String(id),
        need_lv: cfg.lv || 0,
        typ: cfg.type || 0,
        color: raw.Color != null ? raw.Color : (raw.color || 1),
        level: raw.Level != null ? raw.Level : (raw.level || 0),
        lv_prop: raw.LvProp != null ? raw.LvProp : (raw.lv_prop || 0),
        S: raw.S != null ? raw.S : (raw.s || 0),
        MJSeed: raw.MJSeed != null ? raw.MJSeed : (raw.mj_seed || 0),
        CZSeed: raw.CZSeed != null ? raw.CZSeed : (raw.cz_seed || 0),
        XLLevel: raw.XLLevel != null ? raw.XLLevel : (raw.xl_level || 0),
        XLNumber: raw.XLNumber != null ? raw.XLNumber : (raw.xl_number || 0),
        exp: raw.Exp != null ? raw.Exp : (raw.exp || 0),
        base: {
            atk: raw.Atk != null ? raw.Atk : (raw.atk || 0),
            def: raw.Def != null ? raw.Def : (raw.def || 0),
            hit: raw.Hit != null ? raw.Hit : (raw.hit || 0),
            hp: raw.Hp != null ? raw.Hp : (raw.hp || 0),
            speed: raw.Speed != null ? raw.Speed : (raw.speed || 0),
            dodge: raw.Dodge != null ? raw.Dodge : (raw.dodge || 0),
            parry: raw.Parry != null ? raw.Parry : (raw.parry || 0),
            neijin: raw.Neijin != null ? raw.Neijin : (raw.neijin || 0),
            gq_base: raw.Gangqi != null ? raw.Gangqi : (raw.gq_base || 0),
        },
        exts,
        specials: normalizeExts(raw.EnSpecials || raw.specials),
        xilian_marks: marks,
        xilian_accepted: marks.length,
        _source: source,
        _equipped: !!equipped,
        _owner: equipped ? String(owner || source || '').trim() : '',
        _crafted: false,
        _mark: '',
        _initial_exts: initialExts.map(p => ({ ...p })),
    };
}

function canXilian(e) {
    return e.need_lv > 90 && e.color > 1 && e.color < 5 && e.exts.length > 0;
}

function canStrong(e) {
    /* 满 +15 的武器也留在列表里：选中时明确提示「已满 15 级」，
     * 不再让它们凭空消失。 */
    return e.typ >= 1 && e.typ <= 4;
}

function canShengLian(e) {
    if (!e || e.need_lv !== 90 || e.color >= 5) return false;
    const cfg = EQUIP_DATA.equipment[String(e.id)] || {};
    const nextId = cfg.equ_next || 0;
    return nextId > 0 && !!EQUIP_DATA.equipment[String(nextId)];
}

function nextCraftedOnlyId() {
    craftedSeq += 1;
    return craftedSeq;
}

function alignCraftedSeqToEquips() {
    craftedSeq = 900000000;
    for (const eq of saveEquips || []) {
        const onlyId = Number(eq?.only_id);
        if (Number.isSafeInteger(onlyId) && onlyId > craftedSeq) craftedSeq = onlyId;
    }
}

function getSourceFilter(which) {
    const id = which === 'strong'
        ? 'strongSourceFilter'
        : (which === 'shenglian' ? 'shenglianSourceFilter' : 'xilianSourceFilter');
    return document.getElementById(id)?.value || 'all';
}

function getTextFilter(which) {
    const id = which === 'strong'
        ? 'strongTextFilter'
        : (which === 'shenglian' ? 'shenglianTextFilter' : 'xilianTextFilter');
    return (document.getElementById(id)?.value || '').trim().toLowerCase();
}

function passEquipListFilter(e, which) {
    const source = getSourceFilter(which);
    if (source === 'equipped' && !e._equipped) return false;
    if (source === 'crafted' && !e._crafted) return false;

    const q = getTextFilter(which);
    if (!q) return true;
    const hay = [
        e.name,
        nangmanEquipmentDisplayName(e),
        e._mark,
        e._source,
        e._owner,
        String(e.only_id || ''),
        COLOR_NAMES[e.color] || e.color,
        TYPE_NAMES[e.typ] || e.typ,
        `${e.need_lv}레벨`,
        e._crafted ? '모의 제작' : '',
        e._equipped ? '착용 중' : '미착용',
    ].join(' ').toLowerCase();
    return hay.includes(q);
}

function getDefaultMakeMark() {
    return (document.getElementById('makeDefaultMark')?.value || '').trim();
}

function craftedMJSeedFromMakeResult(result, paperId) {
    const czSeed = result?.CZSeed != null ? result.CZSeed : result?.cz_seed;
    if (!Number.isSafeInteger(paperId) || paperId <= 0) {
        throw new TypeError(`제작 도면 ID는 양의 안전 정수여야 합니다. 입력값: ${String(paperId)}`);
    }
    const offset = paperId * CRAFTED_MJ_SEED_PAPER_MULTIPLIER;
    if (!Number.isSafeInteger(czSeed) || czSeed <= offset) {
        throw new TypeError(`이 장비의 제작 진행 정보가 불완전합니다. 세이브를 다시 불러오세요.`);
    }
    return czSeed - offset;
}

function addCraftedFromMakeResult(r, mark, paperId) {
    if (!r || r.error || !r.equip_id) return null;
    const cfg = EQUIP_DATA.equipment[String(r.equip_id)] || {};
    const onlyId = nextCraftedOnlyId();
    const markText = (mark != null ? String(mark) : getDefaultMakeMark()).trim();
    const czSeed = r.CZSeed != null ? r.CZSeed : r.cz_seed;
    const initialExts = (r.exts || []).map(p => ({ prop: p.prop, value: p.value }));
    const eq = {
        id: r.equip_id,
        only_id: onlyId,
        name: r.name || cfg.name || String(r.equip_id),
        need_lv: cfg.lv || 0,
        typ: cfg.type || 0,
        color: r.color || 1,
        level: 0,
        lv_prop: 0,
        S: r.S != null ? r.S : (r.s || 0),
        MJSeed: craftedMJSeedFromMakeResult(r, paperId),
        CZSeed: czSeed,
        XLLevel: 0,
        XLNumber: 0,
        exts: initialExts.map(p => ({ ...p })),
        specials: (r.special || []).map(p => ({ prop: p.prop, value: p.value })),
        xilian_marks: [],
        xilian_accepted: 0,
        _source: '모의 제작',
        _equipped: false,
        _crafted: true,
        _mark: markText,
        _initial_exts: initialExts,
        _make_base: r.base || {},
        _make_region: r.region || [],
        _make_special: r.special || [],
        _make_index: r.index || 0,
    };
    saveEquips.push(eq);
    const k = runtimeKey(eq);
    const full = { ...eq, ...toWasmEquip(eq), xilian_marks: [] };
    equipRuntime[k] = JSON.parse(JSON.stringify(full));
    updateCraftedBagHint();
    renderCraftedBagList();
    return eq;
}

function setCraftedMark(onlyId, mark) {
    const text = String(mark || '').trim().slice(0, 40);
    const eq = saveEquips.find(e => e.only_id === onlyId);
    if (eq) {
        eq._mark = text;
        const k = runtimeKey(eq);
        if (equipRuntime[k]) equipRuntime[k]._mark = text;
    }
    fillEquipSelects();
    renderCraftedBagList();
}

function removeCraftedEquip(onlyId) {
    const idx = saveEquips.findIndex(e => e.only_id === onlyId && e._crafted);
    if (idx < 0) return;
    const eq = saveEquips[idx];
    const k = runtimeKey(eq);
    saveEquips.splice(idx, 1);
    delete equipRuntime[k];
    updateCraftedBagHint();
    renderCraftedBagList();
    fillEquipSelects();
}

function formatCraftedBagProps(list) {
    return Array.isArray(list) && list.length
        ? formatProps(list)
        : '<span class="crafted-prop-empty">없음</span>';
}

function renderCraftedBagList() {
    const box = document.getElementById('craftedBagList');
    if (!box) return;
    const list = saveEquips.filter(e => e._crafted);
    if (!list.length) {
        box.classList.add('empty');
        box.textContent = '시뮬레이션으로 제작한 장비가 없습니다.';
        return;
    }
    box.classList.remove('empty');
    const favArchive = equipFavoritesArchiveId();
    box.innerHTML = list.map(e => {
        const color = COLOR_NAMES[e.color] || e.color;
        const typ = TYPE_NAMES[e.typ] || e.typ;
        const mark = e._mark || '';
        const current = equipRuntime[runtimeKey(e)] || e;
        const faved = typeof EquipFavorites !== 'undefined'
            ? EquipFavorites.has(favArchive, e.only_id) : false;
        return `<div class="crafted-bag-row" data-only-id="${e.only_id}">
            <div class="bag-meta">${escapeHtml(nangmanEquipmentDisplayName(e))} · ${e.need_lv}레벨 · ${escapeHtml(String(color))} · ${escapeHtml(String(typ))} · #${e.only_id}</div>
            <input type="text" class="crafted-mark-input" maxlength="40" value="${escapeHtml(mark)}" placeholder="표식 입력">
            <div class="bag-actions">
                <button type="button" class="btn btn-reset btn-row-action ${faved ? 'is-faved' : ''}" data-act="fav">${faved ? '★ 즐겨찾기 완료' : '☆ 즐겨찾기'}</button>
                <button type="button" class="btn btn-reset btn-row-action" data-act="remove">제거</button>
            </div>
            <div class="crafted-bag-props">
                <div class="crafted-prop-row">
                    <span class="crafted-prop-label">장비 옵션</span>
                    <span class="crafted-prop-values">${formatCraftedBagProps(current.exts || e.exts)}</span>
                </div>
                <div class="crafted-prop-row">
                    <span class="crafted-prop-label">지역 추가 옵션</span>
                    <span class="crafted-prop-values">${formatCraftedBagProps(e._make_region)}</span>
                </div>
                <div class="crafted-prop-row">
                    <span class="crafted-prop-label red">적색 옵션</span>
                    <span class="crafted-prop-values">${formatCraftedBagProps(e._make_special)}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ===================== 装备收藏 · 本地收藏层 ===================== */

let favBatchRunning = false;
let favBatchLastResults = [];

function equipFavoritesArchiveId() {
    let meta = null;
    try {
        if (typeof loadShareStore === 'function') meta = loadShareStore()?.meta || null;
    } catch (error) { /* 忽略 */ }
    const parts = [
        meta?.version || saveMeta?.version || '',
        meta?.platform || saveMeta?.platform || '',
        meta?.channel || saveMeta?.channel || '',
    ];
    try {
        if (typeof loadShareStore === 'function' && typeof getArchiveMainRoleName === 'function') {
            parts.push(getArchiveMainRoleName(loadShareStore()?.data));
        }
    } catch (error) { /* 忽略 */ }
    return parts.filter(Boolean).join('|') || 'default';
}

function findEquipByOnlyId(onlyId) {
    const wanted = String(onlyId);
    return saveEquips.find(e => String(e.only_id) === wanted)
        || Object.values(equipRuntime).find(e => String(e.only_id) === wanted)
        || null;
}

function favPropsText(e) {
    return formatCraftedBagProps(e.exts || []);
}

function renderFavList() {
    const box = document.getElementById('favList');
    if (!box || typeof EquipFavorites === 'undefined') return;
    const archiveId = equipFavoritesArchiveId();
    const favs = EquipFavorites.list(archiveId);
    const targetSel = document.getElementById('favBatchTargetProp');
    const refineBtn = document.getElementById('btnFavBatchRefine');
    const exportPlanBtn = document.getElementById('btnFavExportPlan');
    if (!favs.length) {
        box.classList.add('empty');
        box.textContent = '즐겨찾기한 장비가 없습니다. 시뮬레이션 가방 또는 제작 예측표에서 ‘즐겨찾기’를 누르세요.';
    } else {
        box.classList.remove('empty');
        box.innerHTML = favs.map(fav => {
            const live = findEquipByOnlyId(fav.onlyId);
            const liveTip = live ? '' : '(현재 시뮬레이션에 없는 장비이므로 일괄 계획에서 제외됩니다.)';
            return `<div class="fav-row" data-only-id="${escapeHtml(fav.onlyId)}">
                <div class="fav-main">
                    <strong>${escapeHtml(live ? nangmanEquipmentDisplayName(live) : nangmanEquipmentDisplayText(fav.name))}</strong>
                    <span class="meta-text">${fav.needLv}레벨 · ${escapeHtml(nangmanEquipmentDisplayText(fav.colorText || String(fav.color)))} · ${escapeHtml(nangmanEquipmentDisplayText(fav.typText || String(fav.typ)))} · #${escapeHtml(fav.onlyId)}${liveTip}</span>
                    <span class="fav-props">${escapeHtml(nangmanEquipmentDisplayText(fav.propsText))}</span>
                </div>
                <input type="text" class="fav-note-input" maxlength="40" placeholder="비고" value="${escapeHtml(fav.note)}">
                <button type="button" class="btn btn-reset btn-row-action" data-fav-act="remove">제거</button>
            </div>`;
        }).join('');
    }
    // 目标属性候选：收藏中可精炼装备的现有词条属性并集
    const props = new Set();
    for (const fav of favs) {
        const eq = findEquipByOnlyId(fav.onlyId);
        if (eq && canXilian(eq)) (eq.exts || []).forEach(p => p?.prop && props.add(p.prop));
    }
    const prev = targetSel?.value || '';
    if (targetSel) {
        targetSel.innerHTML = props.size
            ? '<option value="">목표 능력치 선택</option>' + [...props].sort((a, b) => propLabel(a).localeCompare(propLabel(b), 'zh')).map(p =>
                `<option value="${escapeHtml(p)}">${escapeHtml(propLabel(p))}</option>`).join('')
            : '<option value="">먼저 정련 가능한 장비를 즐겨찾기에 등록하세요</option>';
        targetSel.disabled = !props.size;
        if (prev && props.has(prev)) targetSel.value = prev;
    }
    if (refineBtn) refineBtn.disabled = !props.size || favBatchRunning;
    if (exportPlanBtn) exportPlanBtn.disabled = !favBatchLastResults.length;
    renderCraftedBagList._skipFavRefresh = true;
    if (typeof renderCraftedBagList === 'function' && document.getElementById('craftedBagList')) {
        // 只刷新收藏按钮状态，避免整页重算
        document.querySelectorAll('#craftedBagList [data-act="fav"]').forEach(btn => {
            const row = btn.closest('[data-only-id]');
            const onlyId = row?.dataset.onlyId;
            const faved = EquipFavorites.has(archiveId, onlyId);
            btn.textContent = faved ? '★ 즐겨찾기 완료' : '☆ 즐겨찾기';
            btn.classList.toggle('is-faved', faved);
        });
    }
    renderCraftedBagList._skipFavRefresh = false;
}

function renderFavBatchResults(results) {
    const wrap = document.getElementById('favBatchResults');
    const body = document.getElementById('favBatchBody');
    if (!wrap || !body) return;
    favBatchLastResults = results;
    document.getElementById('btnFavExportPlan').disabled = !results.length;
    wrap.hidden = !results.length;
    if (!results.length) {
        body.innerHTML = '<tr><td colspan="9" class="empty-row">일괄 정련 계획을 실행하지 않았습니다</td></tr>';
        return;
    }
    body.innerHTML = results.map(row => {
        if (row.error) {
            return `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.onlyId)}</td><td colspan="7" class="empty-row">${escapeHtml(row.error)}</td></tr>`;
        }
        const plan = row.plan;
        const stepsTxt = plan.steps.length ? plan.steps.join('、') : '— (이미 목표를 달성하여 추가 보존이 필요 없습니다.)';
        return `<tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.onlyId)}</td>
            <td>${escapeHtml(propLabel(plan.target))}</td>
            <td>${row.currentTotal}</td>
            <td><strong>${plan.total}</strong></td>
            <td>${plan.keepCount}</td>
            <td>${plan.cutoffLianjin.toLocaleString()}</td>
            <td>${stepsTxt}</td>
            <td>${escapeHtml(row.note || '')}</td>
        </tr>`;
    }).join('');
}

async function runFavBatchRefine() {
    if (favBatchRunning || typeof EquipFavorites === 'undefined') return;
    const target = document.getElementById('favBatchTargetProp')?.value || '';
    const count = Math.max(1, Math.min(500, Number(document.getElementById('favBatchCount')?.value) || 100));
    const status = document.getElementById('favBatchStatus');
    const button = document.getElementById('btnFavBatchRefine');
    if (!target) { alert('목표 능력치를 선택하세요'); return; }
    const archiveId = equipFavoritesArchiveId();
    const favs = EquipFavorites.list(archiveId);
    if (!favs.length) { alert('즐겨찾기한 장비가 없습니다.'); return; }
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }

    favBatchRunning = true;
    if (button) { button.disabled = true; button.textContent = '일괄 계획 계산 중…'; }
    if (status) { status.hidden = false; status.textContent = `계획 완료 0/${favs.length}개`; }
    const results = [];
    try {
        for (let i = 0; i < favs.length; i++) {
            const fav = favs[i];
            const eq = findEquipByOnlyId(fav.onlyId);
            const base = {
                name: fav.name, onlyId: fav.onlyId, note: fav.note,
            };
            if (!eq) {
                results.push({ ...base, error: '현재 시뮬레이션에 없는 장비입니다. 초기화되었거나 이전 세이브의 장비일 수 있습니다.' });
            } else if (!canXilian(eq)) {
                results.push({ ...base, error: '정련 불가(100레벨 녹색·청색·자색 장비 필요)' });
            } else {
                try {
                    const plan = buildXilianMaxPlan(eq, count, target);
                    results.push({
                        ...base,
                        name: eq.name, plan,
                        currentTotal: xilianTargetTotal(eq.exts, target),
                    });
                } catch (error) {
                    results.push({ ...base, error: error?.message || String(error) });
                }
            }
            if (status) status.textContent = `계획 완료 ${i + 1}/${favs.length}개`;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        renderFavBatchResults(results);
        if (status) status.textContent = `일괄 정련 계획 완료: ${results.length}개 중 ${results.filter(r => r.plan).length}개 성공`;
    } finally {
        favBatchRunning = false;
        if (button) { button.disabled = false; button.textContent = '일괄 정련 계획'; }
    }
}

function exportFavBatchCsv() {
    if (!favBatchLastResults.length) return;
    const lines = ['장비,#only_id,목표 옵션,현재 합계,계획 최고,보존 횟수,소모 연금니,보존 단계,비고,상태'];
    for (const row of favBatchLastResults) {
        const cells = row.error
            ? [row.name, row.onlyId, '', '', '', '', '', '', row.note, row.error]
            : [row.name, row.onlyId, propLabel(row.plan.target), row.currentTotal, row.plan.total,
                row.plan.keepCount, row.plan.cutoffLianjin, row.plan.steps.join(' '), row.note, 'OK'];
        lines.push(cells.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    }
    EquipFavorites.download(`장비_일괄정련계획_${new Date().toISOString().slice(0, 10)}.csv`, '\ufeff' + lines.join('\r\n'));
}

function bindEquipFavorites() {
    if (typeof EquipFavorites === 'undefined') return;
    document.getElementById('favList')?.addEventListener('change', (e) => {
        const input = e.target.closest('.fav-note-input');
        if (!input) return;
        const onlyId = input.closest('[data-only-id]')?.dataset.onlyId;
        if (onlyId != null) EquipFavorites.setNote(equipFavoritesArchiveId(), onlyId, input.value);
    });
    document.getElementById('favList')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fav-act="remove"]');
        if (!btn) return;
        const onlyId = btn.closest('[data-only-id]')?.dataset.onlyId;
        if (onlyId == null) return;
        if (!confirm('이 장비를 즐겨찾기에서 제거할까요?')) return;
        EquipFavorites.remove(equipFavoritesArchiveId(), onlyId);
        renderFavList();
    });
    document.getElementById('btnFavBatchRefine')?.addEventListener('click', runFavBatchRefine);
    document.getElementById('btnFavExport')?.addEventListener('click', () => {
        const favs = EquipFavorites.list(equipFavoritesArchiveId());
        if (!favs.length) { alert('즐겨찾기한 장비가 없습니다.'); return; }
        EquipFavorites.download(`장비_즐겨찾기_${new Date().toISOString().slice(0, 10)}.csv`, EquipFavorites.csv(favs));
    });
    document.getElementById('btnFavExportPlan')?.addEventListener('click', exportFavBatchCsv);
    renderFavList();
}

function calcShengLianCost(eq) {
    const cfg = EQUIP_DATA.equipment[String(eq.id)] || {};
    const nextCfg = EQUIP_DATA.equipment[String(cfg.equ_next)] || {};
    const isArmor = eq.typ >= 5 && eq.typ <= 7;
    const matId = isArmor ? 3036 : 3026;
    const matName = isArmor ? '青蝉翼' : '昆吾石';
    const price = nextCfg.price > 0 ? nextCfg.price : (cfg.price || 10000);
    const silver = Math.floor(price * 6);
    return [
        { id: 8801, name: '连金泥', n: 10 },
        { id: matId, name: matName, n: 120 },
        { id: 3001, name: '银两', n: silver },
    ];
}

function applyShengLian(key) {
    const idx = saveEquips.findIndex(e => runtimeKey(e) === key);
    if (idx < 0) return { error: '장비를 찾을 수 없습니다.' };
    const cur = saveEquips[idx];
    if (!canShengLian(cur)) return { error: '승련할 수 없는 장비입니다(90레벨이며 다음 등급이 있어야 합니다).' };
    const cfg = EQUIP_DATA.equipment[String(cur.id)] || {};
    const nextId = cfg.equ_next;
    const nextCfg = EQUIP_DATA.equipment[String(nextId)];
    if (!nextCfg) return { error: `다음 등급 장비 ${nextId}가 없습니다.` };

    if (!cur.only_id) cur.only_id = nextCraftedOnlyId();
    const stableKey = runtimeKey(cur);
    const rt = getRuntimeEquip(stableKey) || getRuntimeEquip(key);

    const oldName = cur.name;
    const oldLv = cur.need_lv;
    cur.id = nextId;
    cur.name = nextCfg.name || String(nextId);
    cur.need_lv = nextCfg.lv || 100;
    cur.typ = nextCfg.type || cur.typ;

    if (rt) {
        rt.id = cur.id;
        rt.name = cur.name;
        rt.need_lv = cur.need_lv;
        rt.typ = cur.typ;
        rt.only_id = cur.only_id;
        const newKey = runtimeKey(cur);
        if (key !== newKey) delete equipRuntime[key];
        if (stableKey !== newKey) delete equipRuntime[stableKey];
        equipRuntime[newKey] = { ...rt, ...toWasmEquip(rt), xilian_marks: [...(rt.xilian_marks || [])] };
    }
    return {
        ok: true,
        key: runtimeKey(cur),
        from: `${oldName}(${oldLv})`,
        to: `${cur.name}(${cur.need_lv})`,
        equip: cur,
    };
}

function updateCraftedBagHint() {
    const el = document.getElementById('craftedBagHint');
    if (!el) return;
    const n = saveEquips.filter(e => e._crafted).length;
    const marked = saveEquips.filter(e => e._crafted && e._mark).length;
    const canSl = saveEquips.filter(e => e._crafted && canShengLian(e)).length;
    const canXl = saveEquips.filter(e => e._crafted && canXilian(e)).length;
    const canSt = saveEquips.filter(e => e._crafted && canStrong(e)).length;
    el.textContent = n
        ? `모의 가방: 제작 ${n}개(표시 ${marked}개) · 승련 가능 ${canSl}개 · 정련 가능 ${canXl}개 · 촉련 가능 ${canSt}개`
        : '제작을 진행하거나 예측표에서 ‘여기까지 진행’을 누르면 시뮬레이션 가방에 추가됩니다. 검색용 표식을 남길 수 있습니다.';
}

function toWasmEquip(eq) {
    const marks = eq.xilian_marks || [];
    return {
        id: eq.id,
        only_id: eq.only_id,
        name: eq.name,
        color: eq.color,
        level: eq.level,
        lv_prop: eq.lv_prop,
        S: eq.S,
        CZSeed: eq.CZSeed,
        MJSeed: eq.MJSeed,
        XLLevel: eq.XLLevel,
        XLNumber: eq.XLNumber,
        exp: eq.exp || 0,
        base: eq.base || {},
        exts: eq.exts,
        xilian_accepted: marks.length || eq.xilian_accepted || 0,
        xilian_marks: marks,
        need_lv: eq.need_lv || 0,
        typ: eq.typ || 0,
    };
}


function xilianCostMult(marksCount) {
    return [1, 2, 4, 8][Math.min(3, Math.max(0, marksCount))] || 8;
}

function formatSilver(wen) {
    const liang = Math.floor(wen / 1000);
    const rest = wen % 1000;
    let s = '';
    if (liang > 0) s += `${liang}냥`;
    if (rest > 0 || !s) s += `${rest}문`;
    return s;
}

function calcXilianCost(eq) {
    const marks = (eq.xilian_marks || []).length;
    const mult = xilianCostMult(marks);
    const cfg = EQUIP_DATA.equipment[String(eq.id)] || {};
    const isArmor = eq.typ >= 5 && eq.typ <= 7;
    const matId = isArmor ? 3036 : 3026;
    const matName = isArmor ? '青蝉翼' : '昆吾石';
    const price = cfg.price > 0 ? cfg.price : 10000;
    const silver = Math.floor(price * 1.5);
    return {
        mult,
        mats: [
            { id: matId, name: matName, n: 5 * mult },
            { id: 8801, name: '连金泥', n: mult },
            { id: 3001, name: '银两', n: silver },
        ],
    };
}

function formatCostList(mats) {
    return mats.map(m => {
        if (m.id === 3001) return `${m.name}${formatSilver(m.n)}`;
        return `${m.name}×${m.n}`;
    }).join(' · ');
}

function xlMainBonus(xlLevel, kind) {
    const tiers = kind === 'gq_base'
        ? [[0, 10, 1], [10, 20, 1.5], [20, 30, 2], [30, 40, 2.5], [40, 50, 3],
           [50, 60, 2.5], [60, 70, 2], [70, 80, 1.5], [80, 200, 1]]
        : [[0, 10, 1], [10, 20, 2], [20, 30, 3], [30, 40, 4], [40, 50, 5],
           [50, 60, 4], [60, 70, 3], [70, 80, 2], [80, 300, 1]];
    if (xlLevel <= 0) return 0;
    let sum = 0;
    for (const [lo, hi, rate] of tiers) {
        if (xlLevel >= hi) sum += (hi - lo) * rate;
        else {
            sum += (xlLevel - lo) * rate;
            break;
        }
    }
    return Math.floor(sum);
}

function mainPropDisplay(eq, xlLevel) {
    const cfg = EQUIP_DATA.equipment[String(eq.id)] || {};
    const base = cfg.base || {};
    const out = [];
    if (base.gq_base > 0) {
        const bonus = xlMainBonus(xlLevel, 'gq_base');
        const v = Math.min(200, Math.floor(base.gq_base + bonus));
        out.push({ key: 'gq_base', label: '강기', base: base.gq_base, value: v, bonus });
    }
    if (base.neijin > 0) {
        const bonus = xlMainBonus(xlLevel, 'neijin');
        const v = Math.min(300, Math.floor(base.neijin + bonus));
        out.push({ key: 'neijin', label: '내기', base: base.neijin, value: v, bonus });
    }
    return out;
}

let xilianAcceptFlags = [];
let xilianPlanEquipKey = null;
let xilianPlanItems = [];
let xilianAutoPlan = null;

let strongPlanCache = null;

const STONE_NAMES = { 3027: '백련석', 3028: '녹련석', 3029: '남련석', 3030: '자련석' };
const STONE_WEIGHT = { 3027: 1, 3028: 1e4, 3029: 1e8, 3030: 1e12 };

function resetXilianSession() {
    xilianAcceptFlags = [];
    xilianPlanEquipKey = null;
    xilianPlanItems = [];
    xilianAutoPlan = null;
    const box = document.getElementById('xilianPlanSummary');
    if (box) {
        box.classList.add('empty');
        box.innerHTML = '결과를 예측한 후 유지할 항목을 선택하면 총 소모와 최종 옵션을 확인할 수 있습니다';
    }
    const bar = document.getElementById('xilianFilterBar');
    if (bar) bar.hidden = true;
    const target = document.getElementById('xilianTargetProp');
    if (target) {
        target.innerHTML = '<option value="">먼저 순서를 예측하세요</option>';
        target.disabled = true;
    }
    const optimize = document.getElementById('btnXilianOptimize');
    if (optimize) optimize.disabled = true;
}

function qianghuaEqTier(needLv) {
    return Math.min(11, Math.max(1, Math.floor((needLv || 90) / 10) + 1));
}

function strongAttemptCost(needLv, fromLevel) {
    const target = fromLevel + 1;
    const qh = EQUIP_DATA.qianghua?.[String(target)];
    if (!qh) return null;
    const tier = qianghuaEqTier(needLv);
    const row = qh.costs?.[tier] || qh.costs?.[String(tier)];
    if (!row) return null;
    return { mat: row.mat, num: row.num, silver: row.silver, qhcd: qh.qhcd };
}

function costScore(bag) {
    let s = (bag.silver || 0);
    for (const [id, n] of Object.entries(bag.stones || {})) {
        s += (STONE_WEIGHT[id] || 1) * n;
    }
    return s;
}

function formatStoneBag(bag) {
    const parts = [];
    for (const id of [3027, 3028, 3029, 3030]) {
        const n = bag.stones?.[id] || 0;
        if (n) parts.push(`${nangmanEquipmentDisplayText(STONE_NAMES[id])}×${n}`);
    }
    if (bag.silver) parts.push(`은냥 ${formatSilver(bag.silver)}`);
    return parts.join(' · ') || '—';
}

function planStrongPath(grades, startLevel, targetLevel, minGrade, needLv) {
    const need = targetLevel - startLevel;
    if (need <= 0) return { minCost: { ok: false, reason: '목표 단계 도달' }, maxValue: { ok: false, reason: '목표 단계 도달' } };
    const n = grades.length;

    const better = (a, b, mode) => {
        if (!a) return true;
        if (mode === 'maxValue') {
            if (b.value !== a.value) return b.value > a.value;
            return b.score < a.score;
        }
        if (b.score !== a.score) return b.score < a.score;
        return b.value > a.value;
    };

    const run = (mode) => {
        const d = Array.from({ length: n + 1 }, () => Array(need + 1).fill(null));
        d[0][0] = { score: 0, value: 0, bag: { stones: {}, silver: 0 }, from: null };

        for (let i = 0; i < n; i++) {
            for (let k = 0; k <= need; k++) {
                const cur = d[i][k];
                if (!cur) continue;

                if (k === need) {
                    const stay = { score: cur.score, value: cur.value, bag: cur.bag, from: { i, k, action: 'done', seq: i } };
                    if (better(d[i + 1][k], stay, mode)) d[i + 1][k] = stay;
                    continue;
                }

                const level = startLevel + k;
                if (level >= 15) continue;
                const c = strongAttemptCost(needLv, level);
                if (!c) continue;

                const nextBag = {
                    stones: { ...cur.bag.stones, [c.mat]: (cur.bag.stones[c.mat] || 0) + c.num },
                    silver: cur.bag.silver + c.silver,
                };
                const sc = costScore(nextBag);
                const grade = grades[i];
                const add = Math.floor([0, 600, 700, 800, 1000][grade] * c.qhcd);

                const skipSt = {
                    score: sc, value: cur.value, bag: nextBag,
                    from: { i, k, action: 'skip', seq: i, level, grade, add },
                };
                if (better(d[i + 1][k], skipSt, mode)) d[i + 1][k] = skipSt;

                if (grade >= minGrade) {
                    const accSt = {
                        score: sc, value: cur.value + add, bag: nextBag,
                        from: { i, k, action: 'accept', seq: i, level, grade, add },
                    };
                    if (better(d[i + 1][k + 1], accSt, mode)) d[i + 1][k + 1] = accSt;
                }
            }
        }

        let best = null;
        let bestI = -1;
        for (let i = 0; i <= n; i++) {
            const st = d[i][need];
            if (!st) continue;
            if (better(best, st, mode)) {
                best = st;
                bestI = i;
            }
        }
        if (!best) {
            let maxK = -1;
            for (let i = 0; i <= n; i++) {
                for (let k = 0; k <= need; k++) {
                    if (d[i][k] && k > maxK) maxK = k;
                }
            }
            return {
                ok: false,
                reason: maxK < 0 ? '진행 가능한 경로 없음' : `현재 순서에서는 최대 +${startLevel + maxK}까지 가능합니다(목표 +${targetLevel}). 조회 횟수를 늘리거나 목표 단계를 낮추세요.`,
                reached: startLevel + Math.max(0, maxK),
            };
        }

        const accepts = new Set();
        const steps = [];
        let i = bestI;
        let k = need;
        while (i > 0 || k > 0) {
            const st = d[i][k];
            if (!st || !st.from) break;
            const f = st.from;
            if (f.action === 'accept') {
                accepts.add(f.seq + 1);
                steps.push({ index: f.seq + 1, action: '接受', level: f.level, grade: f.grade, add: f.add });
                i = f.i;
                k = f.k;
            } else if (f.action === 'skip') {
                steps.push({ index: f.seq + 1, action: '取消', level: f.level, grade: f.grade, add: f.add });
                i = f.i;
                k = f.k;
            } else {
                i = f.i;
                k = f.k;
            }
        }
        steps.reverse();
        return {
            ok: true,
            mode,
            accepts,
            steps,
            bag: best.bag,
            value: best.value,
            reached: targetLevel,
            attempts: steps.filter(s => s.action !== 'done').length,
        };
    };

    return { minCost: run('minCost'), maxValue: run('maxValue') };
}

function collectEquipsFromSave(data) {
    const root = Array.isArray(data) ? data[0] : data;
    const out = [];
    const seen = new Set();

    const pushList = (list, src, equipped, owner = '') => {
        if (!list) return;
        const arr = Array.isArray(list) ? list : Object.values(list);
        for (const raw of arr) {
            if (!raw || (raw.ID == null && raw.id == null)) continue;
            const id = raw.ID ?? raw.id;
            if (!EQUIP_DATA.equipment[String(id)]) continue;
            if (raw.CZSeed == null && raw.S == null && !raw.EnExts && raw.Color == null) continue;
            const inst = toEquipInstance(raw, src, equipped, owner);
            const key = inst.only_id || `${src}:${inst.id}:${inst.CZSeed}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(inst);
        }
    };

    const asRoleList = (v) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === 'object') return Object.values(v);
        return [];
    };

    const mainRoleName = String(root.MainRole?.Name || root.MainRole?.name || '').trim();
    pushList(root.MainRole?.Equips, '주인공 장비', true, mainRoleName ? `주인공 · ${mainRoleName}` : '주인공');
    asRoleList(root.Roles).forEach((r, i) => {
        const name = r.Name || r.name || `동료 ${i + 1}`;
        pushList(r.Equips, name, true, `동료 · ${name}`);
    });
    asRoleList(root.Leavers).forEach((r, i) => {
        const name = r.Name || r.name || `이탈 동료 ${i + 1}`;
        pushList(r.Equips, name, true, `이탈 동료 · ${name}`);
    });
    pushList(root.Equips, '가방', false);
    const depots = root.EncryptDepots || root.Depots || {};
    for (const [depotId, depot] of Object.entries(depots)) {
        const list = depot?.Depots || depot?.Items || depot;
        const label = depot?.Desp || depot?.Name || depot?.name || `창고:${depotId}`;
        pushList(list, label, false);
    }

    return out;
}

function runtimeKey(eq) {
    return String(eq.only_id || `${eq.id}_${eq.CZSeed}_${eq.S}`);
}

function getRuntimeEquip(selectId) {
    const base = saveEquips.find(e => runtimeKey(e) === selectId);
    if (!base) return null;
    return equipRuntime[selectId] || JSON.parse(JSON.stringify(toWasmEquip(base)));
}

function setRuntimeEquip(selectId, eq) {
    equipRuntime[selectId] = eq;
}


function sortedCraftsmen() {
    return Object.values(EQUIP_DATA.craftsman).sort((a, b) => {
        const pa = a.place || a.name;
        const pb = b.place || b.name;
        if (pa !== pb) return pa.localeCompare(pb, 'zh');
        return a.id - b.id;
    });
}

function papersForNpc(npcId) {
    const cm = EQUIP_DATA.craftsman[String(npcId)];
    if (!cm) return [];
    const list = [];
    const seen = new Set();
    for (const pid of cm.pf || []) {
        const paper = EQUIP_DATA.papers[String(pid)];
        if (!paper) continue;
        const eq = EQUIP_DATA.equipment[String(paper.dz_equip)];
        if (!eq) continue;
        seen.add(paper.id);
        list.push({
            selectId: paper.id,
            equipId: paper.dz_equip,
            label: `${eq.name}(도면 불필요 · ${eq.lv}레벨)`,
            paper,
            equip: eq,
        });
    }
    const zhi = cm.zhi || 'dazao';
    const allow = zhi === 'fengzhi' ? new Set([5, 6, 7]) : new Set([1, 2, 3, 4, 8, 9]);
    for (const paper of Object.values(EQUIP_DATA.papers)) {
        if (seen.has(paper.id)) continue;
        const eq = EQUIP_DATA.equipment[String(paper.dz_equip)];
        if (!eq || !allow.has(eq.type)) continue;
        list.push({
            selectId: paper.id,
            equipId: paper.dz_equip,
            label: `${eq.name}(${paper.name} · ${eq.lv}레벨)`,
            paper,
            equip: eq,
        });
    }
    list.sort((a, b) => (b.equip.lv - a.equip.lv) || a.label.localeCompare(b.label, 'zh'));
    return list;
}

function fillNpcSelect() {
    const sel = document.getElementById('npcSelect');
    sel.innerHTML = '';
    for (const cm of sortedCraftsmen()) {
        const opt = document.createElement('option');
        opt.value = cm.id;
        opt.textContent = `${cm.place || cm.name} · ${cm.name}(${cm.zhi === 'fengzhi' ? '재봉' : '대장간'})`;
        sel.appendChild(opt);
    }
    for (const id of ['40520', '32180', '31230', '32256']) {
        if (EQUIP_DATA.craftsman[id]) { sel.value = id; break; }
    }
}

function fillPaperSelect() {
    const npcId = Number(document.getElementById('npcSelect').value);
    const sel = document.getElementById('paperSelect');
    const filter = (document.getElementById('paperFilter')?.value || '').trim().toLowerCase();
    const prev = sel.value;
    sel.innerHTML = '';
    let matched = 0;
    for (const it of papersForNpc(npcId)) {
        // Orange patterns belong to the independent padded-sequence tool.
        if (it.paper.min_color === 5 && it.paper.max_color === 5) continue;
        if (filter) {
            const hay = `${it.label} ${it.equip?.name || ''}`.toLowerCase();
            if (!hay.includes(filter)) continue;
        }
        const opt = document.createElement('option');
        opt.value = JSON.stringify({
            selectId: it.selectId,
            equipId: it.equipId,
            minColor: it.paper.min_color,
            maxColor: it.paper.max_color,
        });
        opt.textContent = it.label;
        sel.appendChild(opt);
        matched++;
    }
    if (!matched) {
        sel.innerHTML = '<option value="">(일치하는 장비 없음)</option>';
    } else if (prev && [...sel.options].some(o => o.value === prev)) {
        sel.value = prev;
    } else {
        /* 默认图纸：青云戒（图样 3439）。换工匠后若没有这张图，
         * 就退回列表第一项，不硬留。 */
        const preferred = [...sel.options].find(o => {
            try { return JSON.parse(o.value).selectId === 3439; } catch (error) { return false; }
        });
        if (preferred) sel.value = preferred.value;
    }
    fillSpecialSelect();
    updateMakeHints();
}

function fillSpecialSelect() {
    const sel = document.getElementById('specialSelect');
    if (!sel) return;
    const previous = sel.value;
    let meta = null;
    try { meta = JSON.parse(document.getElementById('paperSelect')?.value || ''); }
    catch { }
    const equip = meta ? EQUIP_DATA.equipment[String(meta.equipId)] : null;
    sel.innerHTML = '<option value="0">특수 재료 사용 안 함</option>';
    const materials = equip ? specialMaterialsForEquip(equip) : [];
    for (const sp of materials) {
        const opt = document.createElement('option');
        opt.value = sp.id;
        opt.textContent = sp.name || String(sp.id);
        sel.appendChild(opt);
    }
    /* 默认红词条材料：龙骨（2021）；用户手动选过「不加」就尊重 0。 */
    const preferMaterial = (previous && previous !== '0') ? previous : '2021';
    if ([...sel.options].some(option => option.value === preferMaterial)) {
        sel.value = preferMaterial;
    } else if (previous && [...sel.options].some(option => option.value === previous)) {
        sel.value = previous;
    }
}

function currentMakeRequest() {
    const npcId = Number(document.getElementById('npcSelect').value);
    let meta;
    try { meta = JSON.parse(document.getElementById('paperSelect').value); }
    catch { return null; }
    return {
        npc_id: npcId,
        select_id: meta.selectId,
        equip_id: meta.equipId,
        special_id: Number(document.getElementById('specialSelect').value) || 0,
        min_color: meta.minColor,
        max_color: meta.maxColor,
    };
}

function makeRequestValidationError(req) {
    if (!req) return '대상 장비를 선택하세요.';
    const equip = EQUIP_DATA.equipment[String(req.equip_id)];
    if (!equip) return `대상 장비 ${req.equip_id}가 존재하지 않습니다.`;
    if (!req.special_id) return '';
    const material = EQUIP_DATA.special[String(req.special_id)];
    if (!material) return `특수 재료 ${req.special_id}가 존재하지 않습니다.`;
    if (!specialMaterialSupportsEquip(material, equip)) {
        return `특수 재료 '${material.name || material.id}'는 장비 '${equip.name || equip.id}'에 사용할 수 없습니다.`;
    }
    return '';
}

function requireCurrentMakeRequest() {
    const req = currentMakeRequest();
    const error = makeRequestValidationError(req);
    if (error) {
        alert(error);
        return null;
    }
    return req;
}

function updateMakeAutoShenglianControl(req) {
    const checkbox = document.getElementById('makeAutoShenglian');
    const row = document.getElementById('makeAutoShenglianRow');
    if (!checkbox) return;
    const eq = req ? EQUIP_DATA.equipment[String(req.equip_id)] : null;
    const next = eq?.equ_next ? EQUIP_DATA.equipment[String(eq.equ_next)] : null;
    const available = !!(eq && eq.lv === 90 && next);
    checkbox.disabled = !available;
    if (row) {
        row.title = available
            ? `선택하면 '여기까지 진행'으로 제작한 장비를 ${next.name || '100레벨 장비'}(으)로 자동 승련합니다.`
            : '선택한 장비는 90→100레벨 승련을 지원하지 않습니다.';
    }
}

function updateMakeHints() {
    const req = currentMakeRequest();
    const costEl = document.getElementById('costHint');
    const luckyEl = document.getElementById('luckyHint');
    updateMakeAutoShenglianControl(req);
    if (!req) {
        costEl.textContent = '대상 장비를 선택하세요.';
        luckyEl.textContent = '';
        return;
    }
    const paper = EQUIP_DATA.papers[String(req.select_id)];
    const cm = EQUIP_DATA.craftsman[String(req.npc_id)];
    const eq = EQUIP_DATA.equipment[String(req.equip_id)];
    const matName = paper && EQUIP_DATA.itemNames[String(paper.dz_mat)]
        ? EQUIP_DATA.itemNames[String(paper.dz_mat)]
        : (paper ? `재료 ${paper.dz_mat}` : '');
    const silver = (cm?.cost || 0) + (paper?.cost || 0);
    const freePaper = !!(cm && (cm.pf || []).map(Number).includes(Number(req.select_id)));
    if (paper) {
        const parts = [];
        if (!freePaper) parts.push(`도면 '${paper.name}'×1`);
        parts.push(`${matName}×${paper.dz_num}`);
        const special = req.special_id ? EQUIP_DATA.special[String(req.special_id)] : null;
        if (special) parts.push(`특수 재료 '${special.name || special.id}'×1`);
        parts.push(`은냥 약 ${silver}`);
        costEl.textContent = `실행 시 소모: ${parts.join(' · ')} (안내용)`;
    } else {
        costEl.textContent = '소모량 미확인';
    }

    if (!saveLoaded) {
        luckyEl.textContent = '제작 진행도를 읽지 못했습니다. 먼저 세이브를 불러오세요.';
        luckyEl.classList.remove('pity');
        return;
    }
    const st = wasmMakeGetState();
    const lucky = st?.MakeLucky?.[String(req.equip_id)]?.value ?? 0;
    const tier = Math.floor((eq?.lv || 0) / 10);
    const bucket = st?.Seeds?.[String(eq?.type)];
    const hasSeed = !!(bucket && typeof bucket === 'object' && bucket[String(tier)] != null);
    if (!hasSeed && (eq?.lv || 0) < 100) {
        luckyEl.textContent = `경고: 세이브에 Seeds[${eq?.type}][${tier}] 값이 없어 예측할 수 없습니다.`;
        luckyEl.classList.add('pity');
    } else if (lucky >= 10) {
        luckyEl.textContent = `천장 발동(MakeLucky=${lucky}): 다음 제작에서 자색 장비가 확정됩니다.`;
        luckyEl.classList.add('pity');
    } else {
        const seedValue = bucket && bucket[String(tier)] != null ? bucket[String(tier)] : '없음';
        luckyEl.textContent = `천장 MakeLucky=${lucky}/10 · Seeds[${eq?.type}][${tier}]=${seedValue}`;
        luckyEl.classList.remove('pity');
    }
}

function setMakeHead() {
    setPreviewTableKind('make');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>품질</th><th>기본 능력치</th><th>청색 옵션</th><th>지역 추가 옵션</th><th>적색 옵션</th><th>제작 순서</th><th>표식</th><th>작업</th>
    </tr>`;
}

function setSpecialAttachHead() {
    setPreviewTableKind('special-attach');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>장비</th><th>재료</th><th>예상 적색 옵션</th><th>수치 배율</th><th>망정 순서 기록</th>
    </tr>`;
}

function setPreviewTableKind(kind) {
    const table = document.getElementById('previewTable');
    if (!table) return;
    table.classList.toggle('jianwang-state-table', kind === 'jianwang-state');
}

function makeSeedKind(it) {
    if (it.pity) return 'pity';
    if (it.seed_kind === 'lucky') return 'lucky';
    return 'normal';
}

function fillMakePropFilter(items) {
    const sel = document.getElementById('makeFilterProp');
    if (!sel) return;
    const prev = sel.value;
    const keys = new Set();
    for (const it of items || []) {
        for (const list of [it.exts, it.region, it.special]) {
            for (const p of list || []) {
                if (p?.prop) keys.add(p.prop);
            }
        }
    }
    const sorted = [...keys].sort((a, b) => propLabel(a).localeCompare(propLabel(b), 'zh'));
    sel.innerHTML = '<option value="">전체</option>'
        + sorted.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(propLabel(k))}</option>`).join('');
    if (prev && keys.has(prev)) sel.value = prev;
}

function restoreMakeRegionFilter() {
    const select = document.getElementById('makeFilterRegion');
    if (!select) return;
    let value = 'has';
    try {
        const stored = localStorage.getItem(MAKE_REGION_FILTER_STORAGE_KEY);
        if (stored !== null && ['', 'has', 'none'].includes(stored)) value = stored;
    } catch (e) { /* 本地存储不可用时保留默认“有” */ }
    select.value = value;
}

function persistMakeRegionFilter() {
    const value = document.getElementById('makeFilterRegion')?.value;
    if (!['', 'has', 'none'].includes(value)) return;
    try {
        localStorage.setItem(MAKE_REGION_FILTER_STORAGE_KEY, value);
    } catch (e) { /* 当前页面内的选择仍然有效 */ }
}

function restoreMakeAutoShenglian() {
    const checkbox = document.getElementById('makeAutoShenglian');
    if (!checkbox) return;
    try {
        const stored = localStorage.getItem(MAKE_AUTO_SHENGLIAN_STORAGE_KEY);
        if (stored !== null) checkbox.checked = stored === '1';
    } catch (e) { /* 本地存储不可用时保留页面默认值 */ }
}

function persistMakeAutoShenglian() {
    const checkbox = document.getElementById('makeAutoShenglian');
    if (!checkbox) return;
    try {
        localStorage.setItem(MAKE_AUTO_SHENGLIAN_STORAGE_KEY, checkbox.checked ? '1' : '0');
    } catch (e) { /* 当前页面内的选择仍然有效 */ }
}

function makeFilterMatch(it) {
    const color = document.getElementById('makeFilterColor')?.value || '';
    const seed = document.getElementById('makeFilterSeed')?.value || '';
    const prop = document.getElementById('makeFilterProp')?.value || '';
    const region = document.getElementById('makeFilterRegion')?.value || '';
    if (color && String(it.color) !== color) return false;
    if (seed && makeSeedKind(it) !== seed) return false;
    const hasRegion = Array.isArray(it.region) && it.region.length > 0;
    if (region === 'has' && !hasRegion) return false;
    if (region === 'none' && hasRegion) return false;
    if (prop) {
        const has = [...(it.exts || []), ...(it.region || []), ...(it.special || [])]
            .some(p => p?.prop === prop);
        if (!has) return false;
    }
    return true;
}

function applyMakeFilter(resetPage = false) {
    const all = tablePager.makeAllItems || [];
    tablePager.makeItems = all.filter(makeFilterMatch);
    if (resetPage) tablePager.page = 1;
    const metaFilter = document.getElementById('makeFilterMeta');
    if (metaFilter) metaFilter.textContent = `${tablePager.makeItems.length}/${all.length}개 표시`;
    renderMakePage();
}

function renderMakePage() {
    const body = document.getElementById('previewBody');
    if (!body) return;
    const items = tablePager.makeItems || [];
    const pageSize = getPreviewPageSize();
    const start = (tablePager.page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    const defaultMark = escapeHtml(getDefaultMakeMark());
    if (!slice.length) {
        body.innerHTML = `<tr><td colspan="9" class="empty-row">일치하는 기록이 없습니다</td></tr>`;
        updatePreviewPager(items.length);
        return;
    }
    body.innerHTML = slice.map(it => {
        const seedTxt = it.pity ? '천장' : (it.seed_kind === 'lucky' ? '행운' : '일반');
        const seedCls = it.seed_kind === 'lucky' || it.pity ? 'seed-tag lucky' : 'seed-tag';
        return `<tr data-make-index="${it.index}">
            <td>${it.index}</td>
            <td class="color-${it.color}">${COLOR_NAMES[it.color] || it.color}</td>
            <td>${formatBase(it.base)}</td>
            <td>${formatProps(it.exts)}</td>
            <td>${formatProps(it.region)}</td>
            <td>${formatProps(it.special)}</td>
            <td><span class="${seedCls}">${seedTxt}</span></td>
            <td><input type="text" class="mark-input make-row-mark" maxlength="40" value="${defaultMark}" placeholder="표식"></td>
            <td><button type="button" class="btn btn-wash btn-row-action btn-make-advance" data-index="${it.index}">여기까지 진행</button></td>
        </tr>`;
    }).join('');
    updatePreviewPager(items.length);
}

function renderMakePreview(resp) {
    setMakeHead();
    const body = document.getElementById('previewBody');
    const meta = document.getElementById('previewMeta');
    const filterBar = document.getElementById('makeFilterBar');
    const xlFilter = document.getElementById('xilianFilterBar');
    if (xlFilter) xlFilter.hidden = true;
    renderMakeAdvanceNotice();
    if (resp.error && (!resp.items || !resp.items.length)) {
        body.innerHTML = `<tr><td colspan="9" class="empty-row">${escapeHtml(resp.error)}</td></tr>`;
        meta.textContent = '';
        if (filterBar) filterBar.hidden = true;
        hidePreviewPager();
        return;
    }
    const items = resp.items || [];
    const purple = items.filter(i => i.color === 4).length;
    const sequenceTip = makeAdvanceNotice ? ' · 아래 표는 진행 후 다음 장비부터 새로 번호를 부여합니다.' : '';
    meta.textContent = `전체 ${items.length}개 · 자색 장비 ${purple}개 · '이 결과까지 진행'으로 ${sequenceTip}까지 이동 가능` + (resp.error ? ` · ${resp.error}` : '');
    tablePager.mode = 'make';
    tablePager.page = 1;
    tablePager.makeAllItems = items;
    if (filterBar) {
        filterBar.hidden = false;
        document.getElementById('makeFilterColor').value = '4';
        document.getElementById('makeFilterSeed').value = '';
        fillMakePropFilter(items);
        document.getElementById('makeFilterProp').value = '';
    }
    applyMakeFilter(true);
}

const SPECIAL_QUALITY_WEIGHTS = [5000, 500, 50, 5, 1];
const SPECIAL_QUALITY_RANGES = [[85, 95], [95, 105], [105, 115], [115, 125], [125, 150]];
const WHALE_MULTIPLIER = 245109059551232n;
const WHALE_INCREMENT = 48083817484545n;
const WHALE_MASK = 2147483647n;
const WHALE_REDUCTION_LIMIT = 2047483645n;

function requirePositiveInteger(value, field) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`${field}은(는) 양의 정수여야 합니다. 입력값: ${String(value)}`);
    }
    return value;
}

function drawWhaleInt(seed, maximum) {
    const validSeed = requirePositiveInteger(seed, '순서 데이터');
    const validMaximum = requirePositiveInteger(maximum, '난수 상한');
    const mixed = BigInt.asUintN(
        64,
        (BigInt(validSeed) + BigInt(validMaximum)) * WHALE_MULTIPLIER + WHALE_INCREMENT,
    );
    const raw = (mixed >> 17n) & WHALE_MASK;
    const nextSeed = Number((raw < WHALE_REDUCTION_LIMIT ? raw : raw - WHALE_REDUCTION_LIMIT) + 1n);
    return { seed: nextSeed, value: nextSeed % validMaximum + 1 };
}

function drawWeightedIndex(seed, weights, context) {
    if (!Array.isArray(weights) || !weights.length) {
        throw new TypeError(`${context} 가중치는 비워 둘 수 없습니다.`);
    }
    const validWeights = weights.map((weight, index) => {
        if (!Number.isSafeInteger(weight) || weight < 0) {
            throw new TypeError(`${context}의 ${index + 1}번째 가중치는 0 이상의 정수여야 합니다.`);
        }
        return weight;
    });
    const total = validWeights.reduce((sum, weight) => sum + weight, 0);
    requirePositiveInteger(total, `${context} 전체 가중치`);
    const draw = drawWhaleInt(seed, total);
    let cumulative = 0;
    const index = validWeights.findIndex((weight) => {
        cumulative += weight;
        return draw.value <= cumulative;
    });
    if (index < 0) throw new RangeError(`${context} 난수값 ${draw.value}이(가) 전체 가중치 ${total}을(를) 초과합니다.`);
    return { seed: draw.seed, index };
}

function drawJianwangBetween(seed, minimum, maximum, context) {
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
        throw new TypeError(`${context} 범위 오류: ${minimum}–${maximum}`);
    }
    const draw = drawWhaleInt(seed, maximum - minimum + 1);
    return { seed: draw.seed, value: draw.value - 1 + minimum };
}

const JIANWANG_RULE_PATCHED = 'patched';
const JIANWANG_RULE_STANDARD = 'standard';

function classifyJianwangExtSeedBatch(equip) {
    if (!equip || !isJianwangSword(equip) || !Array.isArray(equip.exts)) return null;
    const seeds = equip.exts.map(ext => Number(ext?.S || 0));
    if (seeds.length < 2 || seeds.some(seed => !Number.isSafeInteger(seed) || seed <= 0)) return null;

    // 游戏保留词条时只覆盖下一批的一号位，不会让新生成词条顺延。
    // 因此 3 条以上时用第 2..N 位判断“本轮新生成批次”；一号位允许保留旧 S。
    const generatedBatch = seeds.length >= 3 ? seeds.slice(1) : seeds;
    if (new Set(generatedBatch).size === 1) return JIANWANG_RULE_PATCHED;

    // 当前已经确认的无保留 70→80 实物中，原项目规则会让两条新词出现不同 S。
    // 2 槽装备无法安全剔除一号位，所以两条不同才作为原项目规则证据。
    if (seeds.length === 2) return JIANWANG_RULE_STANDARD;
    return null;
}

function detectJianwangRuleFromEquips(equips) {
    const evidence = (Array.isArray(equips) ? equips : [])
        .filter(isJianwangSword)
        .map(equip => ({ equip, rule: classifyJianwangExtSeedBatch(equip) }))
        .filter(item => item.rule);
    const patchedCount = evidence.filter(item => item.rule === JIANWANG_RULE_PATCHED).length;
    const standardCount = evidence.filter(item => item.rule === JIANWANG_RULE_STANDARD).length;

    if (standardCount > 0 && patchedCount === 0) {
        return Object.freeze({
            rule: JIANWANG_RULE_STANDARD,
            confidence: standardCount > 1 ? 'batch-consensus' : 'batch-evidence',
            reason: `실물 ${standardCount}자루의 생성 회차에서 EnExts.S가 서로 달라 원본 프로젝트 규칙을 사용합니다.`,
        });
    }
    if (patchedCount > 0 && standardCount === 0) {
        return Object.freeze({
            rule: JIANWANG_RULE_PATCHED,
            confidence: patchedCount > 1 ? 'batch-consensus' : 'batch-evidence',
            reason: `실물 ${patchedCount}개에서 확인된 신규 생성 배치가 EnExts.S를 공유하므로 두 번째 보정 규칙을 적용합니다.`,
        });
    }
    if (standardCount > patchedCount) {
        return Object.freeze({
            rule: JIANWANG_RULE_STANDARD,
            confidence: 'batch-majority',
            reason: `실물 회차 S가 충돌합니다(원본 규칙 ${standardCount}건 / 보정 규칙 ${patchedCount}건). 다수인 원본 규칙을 사용합니다.`,
        });
    }
    if (patchedCount > standardCount) {
        return Object.freeze({
            rule: JIANWANG_RULE_PATCHED,
            confidence: 'batch-majority',
            reason: `실물 회차 S가 충돌합니다(보정 규칙 ${patchedCount}건 / 원본 규칙 ${standardCount}건). 다수인 보정 규칙을 사용합니다.`,
        });
    }
    return Object.freeze({
        rule: JIANWANG_RULE_PATCHED,
        confidence: evidence.length ? 'conflict-fallback' : 'fallback',
        reason: evidence.length
            ? '실물 배치 S의 근거가 서로 충돌하여 두 번째 보정 규칙을 유지합니다.'
            : '유효한 EnExts.S가 있는 검왕각 실물이 2개 미만이므로 두 번째 보정 규칙을 유지합니다.',
    });
}

function currentJianwangRule() {
    return jianwangRuleDetection?.rule === JIANWANG_RULE_STANDARD
        ? JIANWANG_RULE_STANDARD
        : JIANWANG_RULE_PATCHED;
}

function generateJianwangEquip(targetId, startSeed, rule = JIANWANG_RULE_PATCHED) {
    const cfg = EQUIP_DATA.equipment[String(targetId)];
    if (!cfg || !JIANWANG_SWORD_IDS.has(Number(targetId))) {
        throw new RangeError(`유효하지 않은 검왕각 대상 장비: ${targetId}`);
    }
    const standard = rule === JIANWANG_RULE_STANDARD;
    let seed = requirePositiveInteger(Number(startSeed), '재주조 진행도');
    seed = drawWeightedIndex(seed, JIANWANG_COLOR_ROLL_WEIGHTS, '검왕각 품질 자리').seed;
    const base = {};
    for (const prop of JIANWANG_BASE_PROP_ORDER) {
        const raw = Number(cfg.base?.[prop]) || 0;
        if (raw <= 0) continue;
        if (!standard) {
            base[prop] = raw;
            continue;
        }
        const draw = drawJianwangBetween(seed, 100, 100, `검왕각 ${prop}`);
        seed = draw.seed;
        base[prop] = Math.floor(raw * draw.value / 100);
    }

    const candidates = JIANWANG_EXT_PROP_ORDER.filter(prop => Number(cfg.exts?.[prop]?.[0]) > 0);
    const candidateWeights = candidates.map(prop => Math.max(0, Math.floor(Number(cfg.exts[prop][1]) || 0)));
    const slotCount = Math.max(0, Math.floor(((Number(cfg.lv) || 60) - 60) / 10) + 1);
    const exts = [];
    for (let slot = 0; slot < slotCount; slot++) {
        const propDraw = drawWeightedIndex(seed, candidateWeights, '검왕각 추가 능력치');
        seed = propDraw.seed;
        const prop = candidates[propDraw.index];
        exts.push({
            prop,
            value: Number(cfg.exts[prop][0]),
        });
        if (standard) candidateWeights[propDraw.index] = 0;
    }
    return { id: Number(targetId), seedAfter: seed, base, exts };
}

function validJianwangRedSeed(value) {
    const seed = Number(value);
    return Number.isSafeInteger(seed) && seed > 0;
}

function createJianwangBlankFromRedSeed(redSeed, swordIndex = null) {
    const sourceRedSeed = requirePositiveInteger(Number(redSeed), '검 배아 진행도');
    const sequenceIndex = swordIndex == null ? null : requirePositiveInteger(Number(swordIndex), '시뮬레이션 가방 검 번호');
    const baseSeed = Math.floor(sourceRedSeed / 10);
    const MJSeed = baseSeed + JIANWANG_BLANK_ID * JIANWANG_REDSEED_MJ_MULTIPLIER;
    const CZSeed = baseSeed + JIANWANG_BLANK_ID * JIANWANG_REDSEED_CZ_MULTIPLIER;
    requirePositiveInteger(MJSeed, '신규 검 배아의 망정 진행도');
    requirePositiveInteger(CZSeed, '신규 검 배아의 성장 진행도');
    const generated = generateJianwangEquip(JIANWANG_BLANK_ID, sourceRedSeed, JIANWANG_RULE_STANDARD);
    const nextRedSeed = drawWhaleInt(sourceRedSeed, SequenceRules.makeMax(saveMeta)).seed;
    const cfg = EQUIP_DATA.equipment[String(JIANWANG_BLANK_ID)] || {};
    const equip = {
        id: JIANWANG_BLANK_ID,
        name: cfg.name || '검 배아',
        need_lv: Number(cfg.lv) || 60,
        typ: Number(cfg.type) || 3,
        color: 6,
        level: 0,
        lv_prop: 0,
        S: generated.seedAfter,
        MJSeed,
        CZSeed,
        XLLevel: 0,
        XLNumber: 0,
        exp: 0,
        base: generated.base,
        exts: generated.exts.map(item => ({ prop: item.prop, value: item.value })),
        specials: [],
        xilian_marks: [],
        xilian_accepted: 0,
        _source: sequenceIndex ? '시뮬레이션 가방' : '웹 검 분해·재주조',
        _equipped: false,
        _crafted: false,
        _mark: '',
        _jianwangRebuilt: true,
        _jianwangSwordIndex: sequenceIndex,
    };
    return {
        redSeedBefore: sourceRedSeed,
        redSeedAfter: nextRedSeed,
        baseSeed,
        MJSeed,
        CZSeed,
        S: generated.seedAfter,
        swordIndex: sequenceIndex,
        base: generated.base,
        exts: generated.exts.map(item => ({ prop: item.prop, value: item.value })),
        equip,
    };
}

function predictJianwangFutureBlanks(startRedSeed, count = 1) {
    const total = Number(count);
    if (!Number.isSafeInteger(total) || total < 1 || total > PREVIEW_MAX) {
        throw new RangeError(`미리보기 검 수는 1~${PREVIEW_MAX}의 정수여야 합니다.`);
    }
    let redSeed = requirePositiveInteger(Number(startRedSeed), "검 배아 순서 번호");
    const rows = [];
    for (let index = 1; index <= total; index++) {
        const created = createJianwangBlankFromRedSeed(redSeed);
        rows.push({ index, ...created });
        redSeed = created.redSeedAfter;
    }
    return rows;
}

function jianwangShatterRouteId(equip) {
    const routeId = JIANWANG_SHATTER_ROUTE_IDS[Number(equip?.id)];
    if (!routeId) throw new TypeError('90레벨 전용 무기 또는 100레벨 신병만 분해·재주조할 수 있습니다.');
    return routeId;
}

function predictJianwangShatterRebuild(equip, action, redSeed) {
    if (!equip || !isJianwangSword(equip)) throw new TypeError('세이브의 검왕각 실물 장비를 선택하세요.');
    const id = Number(equip.id);
    const isNinety = action === JIANWANG_SHATTER_90 && JIANWANG_LEVEL_90_IDS.has(id);
    const isHundred = action === JIANWANG_SHATTER_100 && JIANWANG_LEVEL_100_IDS.has(id);
    if (!isNinety && !isHundred) {
        throw new RangeError(action === JIANWANG_SHATTER_90
            ? '90레벨 검 분해는 5710~5713 장비만 가능합니다.'
            : '100레벨 신병 분해는 5714~5717 장비만 가능합니다.');
    }
    const nextSwordIndex = Math.max(0, Math.floor(Number(equip._jianwangSwordIndex) || 0)) + 1;
    const created = createJianwangBlankFromRedSeed(redSeed, nextSwordIndex);
    const fromStage = jianwangStageName(equip);
    return {
        index: 1,
        action,
        routeId: jianwangShatterRouteId(equip),
        fromId: id,
        toId: JIANWANG_BLANK_ID,
        fromName: fromStage,
        toName: jianwangStageName(created.equip),
        shatterLabel: isNinety ? '90레벨 검 분해' : '100레벨 신병 분해',
        cost: '검 분해 반환: 검 배아6518×1, 설은3024×200, 자금3025×300, 청금석2000×10, 운철2020×2, 공헌도 -500, 분해 횟수 +1; 재제작: 검 배아6518×1, 설은3024×200, 청금석2000×10, 공헌도 -500',
        ...created,
    };
}

function resolveJianwangCycleRouteId(equip, requestedRouteId = null) {
    if (!equip || !isJianwangSword(equip)) throw new TypeError('검왕각 검 배아 또는 전용 무기를 선택하세요.');
    const id = Number(equip.id);
    const fixedRouteId = JIANWANG_SHATTER_ROUTE_IDS[id];
    if (fixedRouteId) return fixedRouteId;
    if (![5707, 5708, 5709].includes(id)) throw new TypeError('현재 검왕각 장비는 검 분해 미리보기를 사용할 수 없습니다.');
    const routeId = Number(requestedRouteId);
    if (!JIANWANG_LEVEL_90_IDS.has(routeId)) throw new TypeError('90레벨 전용 무기 경로를 선택하세요.');
    return routeId;
}

function prepareJianwangCycleStart(equip, routeId, rule = currentJianwangRule()) {
    let current = JSON.parse(JSON.stringify(equip));
    const rows = [];
    const targets = [];
    if (Number(current.id) === 5707) targets.push(5708, 5709, routeId);
    else if (Number(current.id) === 5708) targets.push(5709, routeId);
    else if (Number(current.id) === 5709) targets.push(routeId);
    for (const targetId of targets) {
        const row = predictJianwangStateSequence(current, `grow:${targetId}`, 1, 0, 0, rule)[0];
        current = JSON.parse(JSON.stringify(row.equip));
        rows.push({ ...row, index: rows.length + 1 });
    }
    return { equip: current, rows };
}

function predictJianwangShatterCycle(equip, startRedSeed, count = 1, rule = currentJianwangRule(), requestedRouteId = null) {
    if (!equip || !isJianwangSword(equip)) {
        throw new TypeError('검 분해 미리보기는 검왕각 5707~5717 실물 장비에서만 시작할 수 있습니다.');
    }
    const total = Number(count);
    if (!Number.isSafeInteger(total) || total < 1 || total > PREVIEW_MAX) {
        throw new RangeError(`반복 횟수는 1~${PREVIEW_MAX}의 정수여야 합니다.`);
    }
    const initial = JSON.parse(JSON.stringify(equip));
    const routeId = resolveJianwangCycleRouteId(initial, requestedRouteId);
    const prepared = prepareJianwangCycleStart(initial, routeId, rule);
    let current = prepared.equip;
    let redSeed = requirePositiveInteger(Number(startRedSeed), "검 배아 순서 번호");
    const initialId = Number(initial.id);
    const entryNote = JIANWANG_LEVEL_100_IDS.has(initialId)
        ? `${jianwangStageName(initial)}에서 신병을 바로 분해하고 1회차 시작`
        : prepared.rows.length
            ? `${jianwangStageName(initial)}에서 옵션 보존 없이 ${jianwangStageName(current)}까지 성장 후 분해하여 1회차 시작`
            : `${jianwangStageName(initial)}에서 검을 바로 분해하고 1회차 시작`;
    const pages = [];
    for (let cycle = 1; cycle <= total; cycle++) {
        const shatterAction = JIANWANG_LEVEL_100_IDS.has(Number(current.id))
            ? JIANWANG_SHATTER_100
            : JIANWANG_SHATTER_90;
        const shatter = predictJianwangShatterRebuild(current, shatterAction, redSeed);
        let stage = JSON.parse(JSON.stringify(shatter.equip));
        const rows = [{
            index: 1,
            action: 'blank',
            fromId: Number(current.id),
            toId: JIANWANG_BLANK_ID,
            fromName: jianwangStageName(current),
            toName: jianwangStageName(stage),
            seedBefore: Number(stage.CZSeed),
            seedAfter: Number(stage.CZSeed),
            base: stage.base || {},
            exts: stage.exts || [],
            kept: null,
            cost: shatter.cost,
            shatterLabel: shatter.shatterLabel,
            equip: JSON.parse(JSON.stringify(stage)),
            redSeedBefore: shatter.redSeedBefore,
            redSeedAfter: shatter.redSeedAfter,
        }];
        const growActions = ['grow:5708', 'grow:5709', `grow:${routeId}`];
        for (const action of growActions) {
            const row = predictJianwangStateSequence(stage, action, 1, 0, 0, rule)[0];
            stage = JSON.parse(JSON.stringify(row.equip));
            rows.push({ ...row, index: rows.length + 1 });
        }
        const reforges = predictJianwangStateSequence(stage, 'reforge', JIANWANG_REFORGE_LIMIT, 0, 0, rule);
        for (const row of reforges) {
            stage = JSON.parse(JSON.stringify(row.equip));
            rows.push({ ...row, index: rows.length + 1 });
        }
        pages.push({
            cycle,
            swordIndex: Number(shatter.equip._jianwangSwordIndex) || cycle,
            routeId,
            name: shatter.equip.name,
            entryNote: cycle === 1 ? entryNote : '',
            initialPreparation: cycle === 1 ? prepared.rows : [],
            shatterLabel: shatter.shatterLabel,
            blank: JSON.parse(JSON.stringify(shatter.equip)),
            finalEquip: JSON.parse(JSON.stringify(stage)),
            redSeedBefore: shatter.redSeedBefore,
            redSeedAfter: shatter.redSeedAfter,
            rows,
        });
        current = stage;
        redSeed = shatter.redSeedAfter;
    }
    return pages;
}

function requireJianwangKeepIndex(equip, action, keepIndex) {
    const index = Number(keepIndex) || 0;
    const limit = jianwangKeepLimit(equip, action);
    if (!Number.isSafeInteger(index) || index < 0 || index > limit) {
        throw new RangeError(`보존 슬롯 수는 0~${limit}의 정수여야 합니다.`);
    }
    return index;
}

function predictJianwangGrow(equip, targetId, keepIndex = 0, rule = currentJianwangRule()) {
    if (!equip || !isJianwangSword(equip)) throw new TypeError('세이브의 검왕각 실물 장비를 선택하세요.');
    if (!validJianwangCZSeed(equip)) throw new TypeError('선택한 무기의 성장 진행 정보가 없습니다. 세이브를 다시 불러오세요.');
    const fromId = Number(equip.id);
    const target = Number(targetId);
    const action = target === fromId ? 'reforge' : `grow:${target}`;
    const allowed = target === fromId
        ? JIANWANG_LEVEL_90_IDS.has(fromId)
        : (JIANWANG_GROW_TARGETS[fromId] || []).includes(target);
    if (!allowed) throw new RangeError(`${fromId}에서 ${target}(으)로 성장시킬 수 없습니다.`);
    const index = requireJianwangKeepIndex(equip, action, keepIndex);
    const generated = generateJianwangEquip(target, Number(equip.CZSeed), rule);
    const exts = generated.exts.map(item => ({ prop: item.prop, value: item.value }));
    if (index > 0) {
        const kept = equip.exts[index - 1];
        exts.splice(0, 1);
        exts.unshift({ prop: kept.prop, value: kept.value });
    }
    const cfg = EQUIP_DATA.equipment[String(target)];
    return {
        ...JSON.parse(JSON.stringify(equip)),
        id: target,
        name: cfg.name,
        need_lv: cfg.lv,
        typ: cfg.type,
        color: 6,
        exp: target === fromId ? Number(equip.exp) || 0 : 0,
        base: generated.base,
        exts,
        CZSeed: generated.seedAfter,
    };
}

function predictJianwangAscend(equip, targetId) {
    if (!equip || !JIANWANG_LEVEL_90_IDS.has(Number(equip.id))) {
        throw new TypeError('세이브의 90레벨 검왕각 전용 무기만 100레벨 신병으로 제작할 수 있습니다.');
    }
    const target = Number(targetId);
    if (JIANWANG_LEVEL_100_TARGETS[Number(equip.id)] !== target) {
        throw new RangeError(`90레벨 전용 무기 ${equip.id}는 ${target}(으)로 전환할 수 없습니다.`);
    }
    const cfg = EQUIP_DATA.equipment[String(target)];
    return {
        ...JSON.parse(JSON.stringify(equip)),
        id: target,
        name: cfg.name,
        need_lv: cfg.lv,
        typ: cfg.type,
        color: 6,
        exp: 0,
        base: { ...(cfg.base || {}) },
        exts: (equip.exts || []).slice(0, 6).map(item => ({ prop: item.prop, value: item.value })),
        CZSeed: equip.CZSeed,
    };
}

function predictJianwangStateSequence(equip, action, count = 1, keepIndex = 0, completedReforges = 0, rule = currentJianwangRule()) {
    if (!equip) throw new TypeError('세이브의 검왕각 실물 장비를 선택하세요.');
    const total = action === 'reforge' ? Number(count) : 1;
    if (!Number.isSafeInteger(total) || total < 1 || total > PREVIEW_MAX) {
        throw new RangeError(`예측 횟수는 1~${PREVIEW_MAX}의 정수여야 합니다.`);
    }
    if (action === 'reforge') {
        const completed = Math.max(0, Math.floor(Number(completedReforges) || 0));
        const remaining = Math.max(0, JIANWANG_REFORGE_LIMIT - completed);
        if (total > remaining) {
            throw new RangeError(remaining > 0
                ? `이 계열은 ${completed}회 재주조하여 ${remaining}회만 미리볼 수 있습니다.`
                : `이 계열은 ${completed}회 재주조하여 상한 ${JIANWANG_REFORGE_LIMIT}회에 도달했습니다.`);
        }
    }
    let current = JSON.parse(JSON.stringify(equip));
    const rows = [];
    for (let index = 1; index <= total; index++) {
        const before = current;
        if (action === 'reforge') {
            current = predictJianwangGrow(current, current.id, keepIndex, rule);
        } else if (action.startsWith('grow:')) {
            current = predictJianwangGrow(current, Number(action.split(':')[1]), keepIndex, rule);
        } else if (action.startsWith('ascend:')) {
            current = predictJianwangAscend(current, Number(action.split(':')[1]));
        } else {
            throw new RangeError(`지원하지 않는 검왕각 진행 방식: ${action}`);
        }
        const kept = Number(keepIndex) > 0 ? before.exts?.[Number(keepIndex) - 1] : null;
        rows.push({
            index,
            action,
            fromId: Number(before.id),
            toId: Number(current.id),
            fromName: jianwangStageName(before),
            toName: jianwangStageName(current),
            seedBefore: Number(before.CZSeed),
            seedAfter: Number(current.CZSeed),
            base: current.base || {},
            exts: current.exts || [],
            kept: kept ? { prop: kept.prop, value: kept.value } : null,
            cost: action === 'reforge'
                ? jianwangReforgeCost(Number(completedReforges) + index)
                : jianwangCostText(before, action, index),
            equip: JSON.parse(JSON.stringify(current)),
        });
    }
    return rows;
}

function requireSpecialMaterial(material, equip) {
    if (!material || typeof material !== 'object' || Array.isArray(material)) {
        throw new TypeError('특수 재료 데이터는 객체여야 합니다.');
    }
    if (!Number.isSafeInteger(material.id) || typeof material.name !== 'string' || !material.name) {
        throw new TypeError('특수 재료의 유효한 ID 또는 이름이 없습니다.');
    }
    if (!specialMaterialSupportsEquip(material, equip)) {
        throw new RangeError(`특수 재료 '${material.name}'는 장비 '${equip.name}'에 사용할 수 없습니다.`);
    }
    if (!Array.isArray(material.prop) || !material.prop.length) {
        throw new TypeError(`특수 재료 '${material.name}'의 옵션 가중치가 없습니다.`);
    }
    if (!material.lvs || typeof material.lvs !== 'object' || Array.isArray(material.lvs)) {
        throw new TypeError(`특수 재료 '${material.name}'의 등급별 수치가 없습니다.`);
    }
    return material;
}

function specialMaterialParts(material) {
    if (!Array.isArray(material.part)) {
        throw new TypeError(`특수 재료 '${material.name}'의 적용 부위 형식이 올바르지 않습니다.`);
    }
    if (material.part.length) return material.part;
    return SPECIAL_MATERIAL_PART_OVERRIDES[String(material.id)] || [];
}

function specialMaterialSupportsEquip(material, equip) {
    const equipType = equip && (equip.typ != null ? equip.typ : equip.type);
    return specialMaterialParts(material).includes(equipType);
}

function clearMakeAdvanceNotice() {
    makeAdvanceNotice = null;
    renderMakeAdvanceNotice();
}

function setMakeAdvanceNotice(result, crafted, advancedCount) {
    const n = Math.max(1, Math.floor(Number(advancedCount) || 1));
    const rawColor = Number(result?.color);
    const color = Number.isSafeInteger(rawColor) && rawColor >= 1 && rawColor <= 6 ? rawColor : 1;
    const rawOnlyId = Number(crafted?.only_id);
    makeAdvanceNotice = {
        advancedCount: n,
        result: {
            name: EQUIP_DATA.equipment?.[String(result?.equip_id || result?.id || '')]?.koName || nangmanEquipmentDisplayText(result?.name || String(result?.equip_id || '장비')),
            color,
            base: result?.base || {},
            exts: result?.exts || [],
            region: result?.region || [],
            special: result?.special || [],
            seed_kind: result?.seed_kind || 'normal',
            pity: !!result?.pity,
        },
        onlyId: Number.isSafeInteger(rawOnlyId) && rawOnlyId > 0 ? rawOnlyId : null,
        mark: crafted?._mark || '',
    };
    renderMakeAdvanceNotice();
}

function renderMakeAdvanceNotice() {
    const box = document.getElementById('makeAdvanceNotice');
    if (!box) return;
    if (!makeAdvanceNotice || currentTab !== 'make') {
        box.hidden = true;
        box.innerHTML = '';
        return;
    }
    const { advancedCount: n, result, onlyId, mark } = makeAdvanceNotice;
    const color = COLOR_NAMES[result.color] || result.color;
    const seed = result.pity ? '천장' : (result.seed_kind === 'lucky' ? '행운' : '일반');
    const middle = n > 1 ? `앞선 ${n - 1}개 장비는 순서만 진행하고 가방에 추가하지 않았습니다. ` : '';
    const bag = onlyId ? `시뮬레이션 가방에 추가됨 #${onlyId}` : '진행 완료';
    const markText = mark ? ` · 표시 「${escapeHtml(mark)}」` : '';
    box.innerHTML = `<div class="make-advance-notice-head">
        <span class="make-advance-notice-title">이번 진행 결과: ${escapeHtml(result.name)} · <span class="color-${result.color}">${escapeHtml(String(color))}</span> · ${escapeHtml(seed)}${markText}</span>
        <span class="make-advance-notice-sequence">${middle}${n}번째 장비${bag}; 아래 표는 다음 장비부터 다시 번호를 매깁니다</span>
    </div>
    <div class="make-advance-notice-details">
        <div class="make-advance-notice-detail"><strong>기본 능력치</strong>${formatBase(result.base)}</div>
        <div class="make-advance-notice-detail"><strong>청색·자색 옵션</strong>${formatProps(result.exts)}</div>
        <div class="make-advance-notice-detail"><strong>지역 추가 옵션</strong>${formatProps(result.region)}</div>
        <div class="make-advance-notice-detail"><strong>특수 재료</strong>${formatProps(result.special)}</div>
    </div>`;
    box.hidden = false;
}

function specialMaterialProperties(material) {
    return material.prop.map((entry, index) => {
        if (!Array.isArray(entry) || entry.length < 2 || typeof entry[0] !== 'string' || !entry[0]) {
            throw new TypeError(`특수 재료 '${material.name}'의 ${index + 1}번째 옵션 형식이 올바르지 않습니다.`);
        }
        if (!Number.isSafeInteger(entry[1]) || entry[1] < 0) {
            throw new TypeError(`특수 재료 '${material.name}'의 ${index + 1}번째 옵션 가중치가 올바르지 않습니다.`);
        }
        return { prop: entry[0], weight: entry[1] };
    });
}

function specialMaterialBaseValue(material, equipLevel, propertyIndex) {
    const level = requirePositiveInteger(equipLevel, '장비 레벨');
    const raw = material.lvs[`lv${level}`];
    if (raw === undefined) {
        throw new RangeError(`추가 재료 '${material.name}'에 레벨 ${level}의 수치가 없습니다.`);
    }
    const value = Array.isArray(raw) ? raw[propertyIndex] : raw;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`추가 재료 '${material.name}'의 레벨 ${level}, ${propertyIndex + 1}번째 수치가 잘못됐습니다.`);
    }
    return value;
}

function scaleSpecialMaterialValue(baseValue, factor) {
    if (baseValue < 1) return baseValue * factor / 100;
    return Math.max(1, Math.floor(baseValue * factor / 100));
}

function predictSpecialAttachSequence(equip, material, count) {
    if (!equip || typeof equip !== 'object' || Array.isArray(equip)) {
        throw new TypeError('대상 장비 데이터는 객체여야 합니다.');
    }
    const validCount = requirePositiveInteger(count, '예측 횟수');
    const validMaterial = requireSpecialMaterial(material, equip);
    const properties = specialMaterialProperties(validMaterial);
    let seed = requirePositiveInteger(equip.MJSeed, `장비 '${equip.name}'의 망정 진행도`);
    const items = [];
    for (let index = 1; index <= validCount; index += 1) {
        const seedBefore = seed;
        const propertyDraw = drawWeightedIndex(seed, properties.map(item => item.weight), '재료 옵션');
        seed = propertyDraw.seed;
        const qualityDraw = drawWeightedIndex(seed, SPECIAL_QUALITY_WEIGHTS, '재료 품질');
        seed = qualityDraw.seed;
        const range = SPECIAL_QUALITY_RANGES[qualityDraw.index];
        const factorDraw = drawWhaleInt(seed, range[1] - range[0] + 1);
        seed = factorDraw.seed;
        const factor = range[0] + factorDraw.value - 1;
        const selected = properties[propertyDraw.index];
        const baseValue = specialMaterialBaseValue(validMaterial, equip.need_lv, propertyDraw.index);
        items.push({
            index,
            equipName: equip.name,
            materialName: validMaterial.name,
            prop: selected.prop,
            value: scaleSpecialMaterialValue(baseValue, factor),
            factor,
            factorMin: range[0],
            factorMax: range[1],
            seedBefore,
            seedAfter: seed,
        });
    }
    const maxValue = Math.max(...items.map(item => item.value));
    return items.map(item => ({ ...item, isBest: item.value === maxValue }));
}

function renderSpecialAttachPage() {
    const body = document.getElementById('previewBody');
    if (!body) return;
    const items = tablePager.specialAttachItems || [];
    const pageSize = getPreviewPageSize();
    const start = (tablePager.page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    if (!slice.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty-row">예측 기록이 없습니다</td></tr>';
        updatePreviewPager(items.length);
        return;
    }
    body.innerHTML = slice.map(item => `<tr class="${item.isBest ? 'special-attach-best' : ''}">
        <td>${item.index}</td>
        <td>${escapeHtml(item.equipName)}</td>
        <td>${escapeHtml(item.materialName)}</td>
        <td class="special-attach-value">${escapeHtml(propLabel(item.prop))}+${formatPropValue(item.prop, item.value)}</td>
        <td>${item.factor}% · 범위 ${item.factorMin}–${item.factorMax}%${item.isBest ? ' · 최고' : ''}</td>
        <td>${item.seedBefore} → ${item.seedAfter}</td>
    </tr>`).join('');
    updatePreviewPager(items.length);
}

function renderSpecialAttachPreview(items) {
    setSpecialAttachHead();
    const meta = document.getElementById('previewMeta');
    const makeFilter = document.getElementById('makeFilterBar');
    const xilianFilter = document.getElementById('xilianFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    if (xilianFilter) xilianFilter.hidden = true;
    const bestIndexes = items.filter(item => item.isBest).map(item => item.index).join('、');
    tablePager.mode = 'specialAttach';
    tablePager.page = 1;
    tablePager.specialAttachItems = items;
    if (meta) meta.textContent = `연속 망정 ${items.length}회 · 최고 수치 ${bestIndexes}회차 · 조회 전용(게임 내 망정 진행도에 영향 없음)`;
    renderSpecialAttachPage();
}

function setJianwangCycleHead() {
    setPreviewTableKind('jianwang-state');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>결과</th><th>기본 능력치</th><th>추가 능력치</th><th>제작 순서 / 소모량</th>
    </tr>`;
}

function renderJianwangCyclePage() {
    const body = document.getElementById('previewBody');
    const meta = document.getElementById('previewMeta');
    const pages = tablePager.jianwangCyclePages || [];
    if (!body) return;
    const page = pages[tablePager.page - 1];
    if (!page) {
        body.innerHTML = '<tr><td colspan="5" class="empty-row">검 분해 반복 기록이 없습니다</td></tr>';
        if (meta) meta.textContent = '';
        updateJianwangCyclePager(0, 0);
        return;
    }
    setJianwangCycleHead();
    const blankName = page.blank?.name || '검 배아';
    if (meta) {
        const entryText = page.entryNote ? ` · ${page.entryNote}` : '';
        meta.textContent = `모의 가방 · ${blankName} · ${page.swordIndex}번째 검 · 검 분해 예측${entryText} · 60→90레벨 성장과 옵션 미유지 재주조 10회 포함 · 조회해도 상태는 진행되지 않습니다.`;
    }
    body.innerHTML = page.rows.map((item, rowIndex) => {
        const blank = item.action === 'blank';
        const fromCfg = EQUIP_DATA.equipment[String(item.fromId)] || {};
        const toCfg = EQUIP_DATA.equipment[String(item.toId)] || {};
        const fromLevel = Number(fromCfg.lv) || '?';
        const toLevel = Number(toCfg.lv) || '?';
        const resultName = escapeHtml(toCfg.name || item.toName || item.equip?.name || '검 배아');
        let resultLabel;
        if (blank) {
            resultLabel = `${item.shatterLabel || '검 분해'} → ${toLevel}레벨 · ${resultName}`;
        } else if (item.action === 'reforge') {
            const reforgeIndex = rowIndex - 3;
            resultLabel = `${toLevel}레벨 재주조 제${reforgeIndex}회 · ${resultName}`;
        } else {
            resultLabel = `${fromLevel}→${toLevel} · ${resultName}`;
        }
        const base = escapeHtml(formatBase(item.base || item.equip?.base || {}));
        const props = (item.exts || item.equip?.exts || []).length
            ? (item.exts || item.equip.exts).map(prop => `<span class="jianwang-prop-token">${escapeHtml(propLabel(prop.prop))}+${formatPropValue(prop.prop, prop.value)}</span>`).join('')
            : '<span class="muted">없음</span>';
        const seedText = blank
            ? `검 분해 후 검 배아 순서 진행 · 새 검 배아 생성 완료`
            : `${item.seedBefore === item.seedAfter ? '현재 재주조 진행도 유지' : '재주조 순서 진행 완료'}`;
        const costs = String(item.cost || '—').split(/[、；]/)
            .filter(Boolean)
            .map(cost => `<span class="jianwang-cost-token">${escapeHtml(cost)}</span>`).join('');
        return `<tr>
            <td>${item.index}</td>
            <td class="jianwang-result-cell"><strong>${resultLabel}</strong></td>
            <td>${base}</td>
            <td><div class="jianwang-token-list">${props}</div></td>
            <td class="jianwang-result-cell"><span class="jianwang-seed">${seedText}</span><div class="jianwang-token-list jianwang-cost-list">${costs}</div></td>
        </tr>`;
    }).join('');
    updateJianwangCyclePager(pages.length, page.swordIndex);
}

function renderJianwangCyclePreview(pages) {
    const makeFilter = document.getElementById('makeFilterBar');
    const xilianFilter = document.getElementById('xilianFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    if (xilianFilter) xilianFilter.hidden = true;
    tablePager.mode = 'jianwang';
    tablePager.page = 1;
    tablePager.jianwangKind = 'cycle';
    tablePager.jianwangItems = [];
    tablePager.jianwangCyclePages = Array.isArray(pages) ? pages : [];
    renderJianwangCyclePage();
}

function renderJianwangPage() {
    if (tablePager.jianwangKind === 'cycle') {
        renderJianwangCyclePage();
        return;
    }
    const body = document.getElementById('previewBody');
    if (!body) return;
    const items = tablePager.jianwangItems || [];
    const pageSize = getPreviewPageSize();
    const start = (tablePager.page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    const blankKind = tablePager.jianwangKind === 'blanks' || tablePager.jianwangKind === 'shatter';
    if (!slice.length) {
        const columns = tablePager.jianwangKind === 'mangjing' ? 6 : (blankKind ? 6 : 4);
        body.innerHTML = `<tr><td colspan="${columns}" class="empty-row">전용 무기 예측 기록이 없습니다</td></tr>`;
        updatePreviewPager(items.length);
        return;
    }
    if (tablePager.jianwangKind === 'mangjing') {
        body.innerHTML = slice.map(item => `<tr class="${item.isBest ? 'jianwang-best' : ''}">
            <td>${item.index}</td>
            <td>${escapeHtml(item.equipName)}</td>
            <td>${escapeHtml(item.materialName)}</td>
            <td class="special-attach-value">${escapeHtml(propLabel(item.prop))}+${formatPropValue(item.prop, item.value)}</td>
            <td>${item.factor}% · 범위 ${item.factorMin}–${item.factorMax}%${item.isBest ? ' · 최고' : ''}</td>
            <td>${item.seedBefore} → ${item.seedAfter}</td>
        </tr>`).join('');
    } else if (blankKind) {
        body.innerHTML = slice.map(item => {
            const resultLabel = item.shatterLabel
                ? `${escapeHtml(item.shatterLabel)} → 60레벨 검 배아`
                : `이후 ${item.index}번째 60레벨 검 소재`;
            const base = escapeHtml(formatBase(item.base));
            const props = (item.exts || []).length
                ? item.exts.map(prop => `<span class="jianwang-prop-token">${escapeHtml(propLabel(prop.prop))}+${formatPropValue(prop.prop, prop.value)}</span>`).join('')
                : '<span class="muted">없음</span>';
            const seeds = `재주조 순서 번호 ${item.CZSeed}<br>망정 순서 번호 ${item.MJSeed}<br>S ${item.S}`;
            const redSeed = `${item.redSeedBefore} → ${item.redSeedAfter}`;
            const resources = item.cost
                ? String(item.cost).split('；').map(part => `<span class="jianwang-cost-token">${escapeHtml(part)}</span>`).join('')
                : '<span class="muted">조회 전용 미리보기</span>';
            return `<tr>
                <td>${item.index}</td>
                <td class="jianwang-result-cell"><strong>${resultLabel}</strong><span class="jianwang-seed">${item.shatterLabel ? escapeHtml(item.fromName) : '현재 검 배아 진행도를 기준으로 생성'}</span></td>
                <td>${base}</td>
                <td><div class="jianwang-token-list">${props}</div></td>
                <td class="jianwang-result-cell"><span class="jianwang-seed">${seeds}</span></td>
                <td class="jianwang-result-cell"><span class="jianwang-seed">검 배아 순서 번호 ${redSeed}</span><div class="jianwang-token-list jianwang-cost-list">${resources}</div></td>
            </tr>`;
        }).join('');
    } else {
        body.innerHTML = slice.map(item => {
            const kept = item.kept
                ? `${propLabel(item.kept.prop)} +${formatPropValue(item.kept.prop, item.kept.value)} 보존`
                : (item.action.startsWith('ascend:') ? '현재 옵션 6개 고정 보존' : '기존 옵션 보존 안 함');
            const fromCfg = EQUIP_DATA.equipment[String(item.fromId)] || {};
            const toCfg = EQUIP_DATA.equipment[String(item.toId)] || {};
            const fromLevel = Number(fromCfg.lv) || '?';
            const toLevel = Number(toCfg.lv) || '?';
            const resultName = escapeHtml(toCfg.name || item.toName);
            const resultLabel = item.action === 'reforge'
                ? `${toLevel}레벨 재주조 · ${resultName}`
                : `${fromLevel}→${toLevel} · ${resultName}`;
            const seedStatus = item.seedBefore === item.seedAfter ? ' · 진행하지 않음' : '';
            const props = (item.exts || []).length
                ? item.exts.map(prop => `<span class="jianwang-prop-token">${escapeHtml(propLabel(prop.prop))}+${formatPropValue(prop.prop, prop.value)}</span>`).join('')
                : '<span class="muted">없음</span>';
            const costs = String(item.cost || '—').split('、')
                .map(cost => `<span class="jianwang-cost-token">${escapeHtml(cost)}</span>`).join('');
            return `<tr>
                <td>${item.index}</td>
                <td class="jianwang-result-cell"><strong>${resultLabel}</strong><span class="jianwang-seed">재주조 순서 번호 ${item.seedBefore} → ${item.seedAfter}${seedStatus}</span></td>
                <td><div class="jianwang-token-list">${props}</div></td>
                <td><span class="jianwang-keep">${escapeHtml(kept)}</span><div class="jianwang-token-list jianwang-cost-list">${costs}</div></td>
            </tr>`;
        }).join('');
    }
    updatePreviewPager(items.length);
}

function setJianwangStateHead() {
    setPreviewTableKind('jianwang-state');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>결과</th><th>추가 능력치</th><th>선택 및 소모</th>
    </tr>`;
}

function setJianwangBlankHead() {
    setPreviewTableKind('jianwang-state');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>결과</th><th>기본 능력치</th><th>추가 능력치</th><th>재주조 순서 번호</th><th>검 분해 순서 / 재료</th>
    </tr>`;
}

function renderJianwangPreview(items, kind = 'state') {
    if (kind === 'mangjing') setSpecialAttachHead();
    else if (kind === 'blanks' || kind === 'shatter') setJianwangBlankHead();
    else setJianwangStateHead();
    const meta = document.getElementById('previewMeta');
    const makeFilter = document.getElementById('makeFilterBar');
    const xilianFilter = document.getElementById('xilianFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    if (xilianFilter) xilianFilter.hidden = true;
    tablePager.mode = 'jianwang';
    tablePager.page = 1;
    tablePager.jianwangItems = items;
    tablePager.jianwangKind = kind;
    if (meta) {
        if (kind === 'mangjing') {
            const bestIndexes = items.filter(item => item.isBest).map(item => item.index).join('、');
            meta.textContent = `검왕각 망정 ${items.length}회 · 최고 수치 ${bestIndexes}회차 · 회당 망정×10 · 조회 전용`;
        } else if (kind === 'blanks') {
            meta.textContent = `이후 60레벨 검 소재 ${items.length}개 · 현재 검 소재 진행도부터 순서대로 예측 · 조회만으로 현재 진행도가 변하지 않습니다.`;
        } else if (kind === 'shatter') {
            meta.textContent = `${items[0]?.shatterLabel || '검 분해'} → 다음 60레벨 검 배아 재주조 · 미리보기는 화면 내부 상태를 변경하지 않음`;
        } else {
            meta.textContent = `선택한 세이브 실물에서 시작 · ${items.length}단계 · 미리보기는 화면 내부 상태를 진행하지 않음`;
        }
    }
    renderJianwangPage();
}


function equipOptionLabel(e, mode) {
    const owner = String(e._owner || e._source || '').trim();
    const wear = e._crafted ? '모의 제작' : (e._equipped ? `착용 중${owner ? `: ${owner}` : ''}` : '미착용');
    const color = COLOR_NAMES[e.color] || e.color;
    const mark = e._mark ? `「${e._mark}」` : '';
    if (mode === 'strong') {
        return `${mark}${nangmanEquipmentDisplayName(e)} · 촉련 ${e.level} · 성장 계수 ${e.lv_prop} · ${wear}`;
    }
    if (mode === 'shenglian') {
        const cfg = EQUIP_DATA.equipment[String(e.id)] || {};
        const next = EQUIP_DATA.equipment[String(cfg.equ_next)] || {};
        const typ = TYPE_NAMES[e.typ] || e.typ;
        return `${mark}${nangmanEquipmentDisplayName(e)} · ${e.need_lv}→${next.lv || 100} · ${color} · ${typ} · ${wear}`;
    }
    return `${mark}${nangmanEquipmentDisplayName(e)} · ${e.need_lv}레벨 · ${color} · 옵션 ${e.exts.length}개 · ${wear}`;
}

function canPredictSpecialAttach(equip) {
    return Number.isSafeInteger(equip.MJSeed)
        && equip.MJSeed > 0
        && Object.values(EQUIP_DATA.special).some(material => specialMaterialSupportsEquip(material, equip));
}

function specialAttachEquipLabel(equip) {
    const source = equip._crafted ? '모의 제작' : (equip._equipped ? equip._source : '미착용');
    const base = equip.exts.length
        ? equip.exts.map(item => `${propLabel(item.prop)}+${formatPropValue(item.prop, item.value)}`).join(' / ')
        : '기본 옵션 없음';
    const current = equip.specials.length
        ? equip.specials.map(item => `${propLabel(item.prop)}+${formatPropValue(item.prop, item.value)}`).join(' / ')
        : '현재 적색 옵션 없음';
    return `${source} · ${nangmanEquipmentDisplayName(equip)} · ${base} · ${current} · #${equip.only_id}`;
}

function specialMaterialsForEquip(equip) {
    return Object.values(EQUIP_DATA.special)
        .filter(material => specialMaterialSupportsEquip(material, equip))
        .sort((left, right) => left.id - right.id);
}

function fillSpecialAttachMaterialSelect(preserveSelection) {
    const equipSelect = document.getElementById('specialAttachEquipSelect');
    const materialSelect = document.getElementById('specialAttachMaterialSelect');
    if (!equipSelect || !materialSelect) return;
    const previous = preserveSelection ? materialSelect.value : '';
    const equip = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    materialSelect.innerHTML = '';
    if (!equip) {
        materialSelect.innerHTML = '<option value="">（먼저 예측할 장비를 선택하세요）</option>';
        return;
    }
    const materials = specialMaterialsForEquip(equip);
    for (const material of materials) {
        const option = document.createElement('option');
        option.value = String(material.id);
        option.textContent = material.name;
        materialSelect.appendChild(option);
    }
    if (previous && [...materialSelect.options].some(option => option.value === previous)) {
        materialSelect.value = previous;
    }
}

function fillSpecialAttachEquipSelect(preserveSelection) {
    const select = document.getElementById('specialAttachEquipSelect');
    if (!select) return;
    const previous = preserveSelection ? select.value : '';
    const equips = saveEquips.filter(canPredictSpecialAttach);
    select.innerHTML = '';
    if (!equips.length) {
        select.innerHTML = '<option value="">（망정 진행도를 확인한 장비가 없습니다）</option>';
    } else {
        for (const equip of equips) {
            const option = document.createElement('option');
            option.value = runtimeKey(equip);
            option.textContent = specialAttachEquipLabel(equip);
            select.appendChild(option);
        }
        if (previous && [...select.options].some(option => option.value === previous)) {
            select.value = previous;
        }
    }
    fillSpecialAttachMaterialSelect(preserveSelection);
    updateSpecialAttachHint();
}

function updateSpecialAttachHint() {
    const hint = document.getElementById('specialAttachHint');
    const equipSelect = document.getElementById('specialAttachEquipSelect');
    const materialSelect = document.getElementById('specialAttachMaterialSelect');
    if (!hint || !equipSelect || !materialSelect) return;
    const equip = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const material = EQUIP_DATA.special[String(materialSelect.value)];
    if (!equip || !material) {
        hint.textContent = '세이브를 불러온 뒤 동일한 장비와 재료를 선택하면 적색 옵션을 연속으로 교체한 결과를 예측합니다.';
        return;
    }
    const current = equip.specials.length
        ? equip.specials.map(item => `${propLabel(item.prop)}+${formatPropValue(item.prop, item.value)}`).join(' / ')
        : '없음';
    hint.textContent = `현재 적색 옵션: ${current} · 장비의 현재 망정 진행도부터 예측하며 세이브나 게임 진행도를 변경하지 않습니다.`;
}

function isJianwangSword(equip) {
    return !!equip && JIANWANG_SWORD_IDS.has(Number(equip.id));
}

function collectJianwangSwords() {
    return saveEquips
        .filter(isJianwangSword)
        .sort((a, b) => Number(a.id) - Number(b.id) || String(a._source).localeCompare(String(b._source), 'zh'));
}

function validJianwangCZSeed(equip) {
    return isJianwangSword(equip)
        && Number.isSafeInteger(Number(equip.CZSeed))
        && Number(equip.CZSeed) > 0;
}

function canPredictJianwangMangjing(equip) {
    /* 只要求「100 级 + 橙品 + 有效 MJSeed」。
     * 没记录「已铸进材料」（specials 为空）的剑也允许试算：
     * 自动推演出来的 100 级剑就属于这种，序列按 MJSeed + 所选材料走，
     * 页面会额外标注「未铸进、试算」。 */
    return isJianwangSword(equip)
        && JIANWANG_LEVEL_100_IDS.has(Number(equip.id))
        && Number(equip.color) === 6
        && Number.isSafeInteger(equip.MJSeed)
        && equip.MJSeed > 0;
}

function jianwangStageName(equip) {
    const cfg = EQUIP_DATA.equipment[String(equip?.id)] || {};
    const lv = Number(cfg.lv) || Number(equip?.need_lv) || 0;
    if (Number(equip?.id) === 5707) return '60레벨 검 배아';
    if (Number(equip?.id) === 5708) return '70레벨 검 배아';
    if (Number(equip?.id) === 5709) return '80레벨 검 배아';
    if (JIANWANG_LEVEL_90_IDS.has(Number(equip?.id))) return `90레벨 전용 무기 · ${cfg.name || equip.name}`;
    if (JIANWANG_LEVEL_100_IDS.has(Number(equip?.id))) return `100레벨 신병 · ${cfg.name || equip.name}`;
    return `${lv}레벨`;
}

function jianwangSwordLabel(equip) {
    const key = runtimeKey(equip);
    const current = getRuntimeEquip(key) || equip;
    const seed = JIANWANG_LEVEL_100_IDS.has(Number(current.id))
        ? `망정 순서 번호 ${current.MJSeed || '유효하지 않음'}`
        : `재주조 순서 번호 ${current.CZSeed || '유효하지 않음'}`;
    if (current._jianwangRebuilt) {
        const swordIndex = Math.max(1, Math.floor(Number(current._jianwangSwordIndex) || 1));
        const name = current.name || EQUIP_DATA.equipment[String(current.id)]?.name || jianwangStageName(current);
        return `시뮬레이션 가방 · ${name} · ${swordIndex}번째 검`;
    }
    return `${current._source || equip._source || '출처 미확인'} · ${jianwangStageName(current)} · #${equip.only_id || 'OnlyID 없음'} · ${seed}`;
}

function jianwangActionOptions(equip) {
    if (!equip) return [];
    const id = Number(equip.id);
    if (JIANWANG_GROW_TARGETS[id]) {
        return JIANWANG_GROW_TARGETS[id].map(targetId => ({
            value: `grow:${targetId}`,
            label: `${jianwangStageName(equip)} → ${jianwangStageName({ id: targetId })}`,
        }));
    }
    if (JIANWANG_LEVEL_90_IDS.has(id)) {
        return [
            { value: 'reforge', label: `${jianwangStageName(equip)} 재주조` },
            { value: `ascend:${JIANWANG_LEVEL_100_TARGETS[id]}`, label: `100레벨 신병 제작(옵션 6개 고정 보존)` },
            { value: JIANWANG_SHATTER_90, label: '90레벨 검 분해 → 다음 60레벨 검 배아 재주조' },
        ];
    }
    if (JIANWANG_LEVEL_100_IDS.has(id)) {
        return [
            { value: 'mangjing', label: '망정 순서 보기' },
            { value: JIANWANG_SHATTER_100, label: '100레벨 신병 분해 → 다음 60레벨 검 배아 재주조' },
        ];
    }
    return [];
}

function jianwangKeepLimit(equip, action) {
    if (!equip || !action) return 0;
    if (action === 'reforge') return Math.min(4, equip.exts?.length || 0);
    if (action.startsWith('grow:')) {
        const byId = { 5707: 1, 5708: 2, 5709: 3 };
        return Math.min(byId[Number(equip.id)] || 0, equip.exts?.length || 0);
    }
    return 0;
}

function fillJianwangActionSelect(preserveSelection = true) {
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const actionSelect = document.getElementById('jianwangActionSelect');
    if (!equipSelect || !actionSelect) return;
    const previous = preserveSelection ? actionSelect.value : '';
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    const actions = jianwangActionOptions(equip);
    actionSelect.innerHTML = '';
    if (!actions.length) {
        actionSelect.innerHTML = '<option value="">(현재 실물 장비에 가능한 경로 없음)</option>';
    } else {
        for (const action of actions) {
            const option = document.createElement('option');
            option.value = action.value;
            option.textContent = action.label;
            actionSelect.appendChild(option);
        }
        if (previous && [...actionSelect.options].some(option => option.value === previous)) {
            actionSelect.value = previous;
        }
    }
    fillJianwangKeepSelect(preserveSelection);
    fillJianwangMaterialSelect(preserveSelection);
    updateJianwangControls();
}

function fillJianwangCycleRouteSelect(preserveSelection = true) {
    const routeSelect = document.getElementById('jianwangCycleRouteSelect');
    const equipSelect = document.getElementById('jianwangEquipSelect');
    if (!routeSelect || !equipSelect) return;
    const previous = preserveSelection ? routeSelect.value : '';
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    const fixedRouteId = equip ? JIANWANG_SHATTER_ROUTE_IDS[Number(equip.id)] : null;
    routeSelect.innerHTML = '';
    if (!equip) {
        routeSelect.innerHTML = '<option value="">(검왕각 실물 장비를 먼저 선택하세요)</option>';
        routeSelect.disabled = true;
        return;
    }
    if (fixedRouteId) {
        const option = document.createElement('option');
        option.value = String(fixedRouteId);
        option.textContent = jianwangStageName({ id: fixedRouteId });
        routeSelect.appendChild(option);
        routeSelect.disabled = true;
        return;
    }
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '90레벨 전용 무기 경로를 선택하세요.';
    routeSelect.appendChild(placeholder);
    for (const routeId of JIANWANG_GROW_TARGETS[5709]) {
        const option = document.createElement('option');
        option.value = String(routeId);
        option.textContent = jianwangStageName({ id: routeId });
        routeSelect.appendChild(option);
    }
    routeSelect.disabled = false;
    if (previous && [...routeSelect.options].some(option => option.value === previous)) {
        routeSelect.value = previous;
    }
}

function fillJianwangKeepSelect(preserveSelection = true) {
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const actionSelect = document.getElementById('jianwangActionSelect');
    const keepSelect = document.getElementById('jianwangKeepSelect');
    if (!equipSelect || !actionSelect || !keepSelect) return;
    const previous = preserveSelection ? keepSelect.value : '';
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    const limit = jianwangKeepLimit(equip, actionSelect.value);
    keepSelect.innerHTML = '<option value="0">보존 안 함</option>';
    for (let i = 0; i < limit; i++) {
        const prop = equip.exts[i];
        const option = document.createElement('option');
        option.value = String(i + 1);
        option.textContent = `슬롯 ${i + 1} · ${propLabel(prop.prop)}+${formatPropValue(prop.prop, prop.value)}`;
        keepSelect.appendChild(option);
    }
    if (previous && [...keepSelect.options].some(option => option.value === previous)) keepSelect.value = previous;
}

function jianwangMaterialsForEquip(equip) {
    const materials = specialMaterialsForEquip(equip);
    const currentProps = new Set((equip?.specials || []).map(item => item.prop));
    const matched = materials.filter(material => material.prop.some(entry => currentProps.has(entry[0])));
    return matched.length ? matched : materials;
}

function fillJianwangMaterialSelect(preserveSelection = true) {
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const materialSelect = document.getElementById('jianwangMaterialSelect');
    if (!equipSelect || !materialSelect) return;
    const previous = preserveSelection ? materialSelect.value : '';
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    materialSelect.innerHTML = '';
    if (!equip) {
        materialSelect.innerHTML = '<option value="">（승련한 전용 무기를 선택하세요）</option>';
        return;
    }
    for (const material of jianwangMaterialsForEquip(equip)) {
        const option = document.createElement('option');
        option.value = String(material.id);
        option.textContent = `${material.name} · ${material.prop.map(entry => propLabel(entry[0])).join('/')}`;
        materialSelect.appendChild(option);
    }
    if (previous && [...materialSelect.options].some(option => option.value === previous)) {
        materialSelect.value = previous;
    }
}

function fillJianwangEquipSelect(preserveSelection = true) {
    const select = document.getElementById('jianwangEquipSelect');
    if (!select) return;
    const previous = preserveSelection ? select.value : '';
    const swords = collectJianwangSwords();
    select.innerHTML = '';
    if (!swords.length) {
        select.innerHTML = '<option value="">(세이브에 검왕각 검 배아 또는 전용 무기가 없습니다)</option>';
    } else {
        for (const sword of swords) {
            const option = document.createElement('option');
            option.value = runtimeKey(sword);
            option.textContent = jianwangSwordLabel(sword);
            select.appendChild(option);
        }
        if (previous && [...select.options].some(option => option.value === previous)) {
            select.value = previous;
        }
    }
    fillJianwangActionSelect(preserveSelection);
    fillJianwangCycleRouteSelect(preserveSelection);
    updateJianwangHint();
    updateJianwangCycleHint();
}

function updateJianwangControls() {
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const action = document.getElementById('jianwangActionSelect')?.value || '';
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect?.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    const keepGroup = document.getElementById('jianwangKeepGroup');
    const countGroup = document.getElementById('jianwangCountGroup');
    const materialGroup = document.getElementById('jianwangMaterialGroup');
    const countInput = document.getElementById('jianwangCount');
    if (keepGroup) keepGroup.hidden = !(action === 'reforge' || action.startsWith('grow:'));
    if (countGroup) countGroup.hidden = !(action === 'reforge' || action === 'mangjing');
    if (materialGroup) materialGroup.hidden = action !== 'mangjing';
    const countLabel = countGroup ? countGroup.querySelector('label') : null;
    if (countLabel) countLabel.textContent = action === 'mangjing' ? '망정 횟수' : '미리보기 횟수';
    const completedReforges = Math.max(0, Math.floor(Number(
        jianwangReforgeCounts[String(Number(equip?.id))],
    ) || 0));
    const remainingReforges = Math.max(0, JIANWANG_REFORGE_LIMIT - completedReforges);
    const reforgeExhausted = action === 'reforge' && remainingReforges === 0;
    if (countInput) {
        countInput.disabled = reforgeExhausted;
        countInput.min = '1';
        countInput.max = String(action === 'reforge' ? remainingReforges : PREVIEW_MAX);
        if (action === 'mangjing' && lastJianwangAction !== 'mangjing') countInput.value = '10';
        lastJianwangAction = action;
        if (action === 'reforge') {
            const current = Number(countInput.value);
            if (!Number.isSafeInteger(current) || current < 1 || current > remainingReforges) {
                countInput.value = '1';
            }
        }
    }
    const previewButton = document.getElementById('btnJianwangPreview');
    if (previewButton) {
        const shatter = action === JIANWANG_SHATTER_90 || action === JIANWANG_SHATTER_100;
        previewButton.disabled = reforgeExhausted || (shatter && !validJianwangRedSeed(jianwangRedSeed));
    }
    const applyButton = document.getElementById('btnJianwangApply');
    if (applyButton) {
        const shatter = action === JIANWANG_SHATTER_90 || action === JIANWANG_SHATTER_100;
        const deterministic = action === 'reforge' || action.startsWith('grow:') || action.startsWith('ascend:') || shatter
            || action === 'mangjing';
        applyButton.disabled = !equip || !deterministic || reforgeExhausted
            || (shatter ? !validJianwangRedSeed(jianwangRedSeed)
                : (action === 'mangjing' ? !canPredictJianwangMangjing(equip)
                    : (action !== '' && !action.startsWith('ascend:') && !validJianwangCZSeed(equip))));
        applyButton.textContent = action === 'mangjing' ? '망정 순서 생성(조회 전용)' : '1회 진행(웹 내부만)';
    }
}

function findSaveScalar(root, wantedKey) {
    const seen = new Set();
    const unwrap = value => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
        if (value && typeof value === 'object') {
            for (const key of ['Value', 'value', 'V', 'v', 'Number', 'number']) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    const parsed = unwrap(value[key]);
                    if (parsed != null) return parsed;
                }
            }
        }
        return null;
    };
    const walk = value => {
        if (!value || typeof value !== 'object' || seen.has(value)) return null;
        seen.add(value);
        if (Object.prototype.hasOwnProperty.call(value, wantedKey)) {
            const found = unwrap(value[wantedKey]);
            if (found != null) return found;
        }
        for (const child of Object.values(value)) {
            const found = walk(child);
            if (found != null) return found;
        }
        return null;
    };
    return walk(root);
}

function jianwangReforgeCost(attemptNumber) {
    const index = Math.min(JIANWANG_REFORGE_COSTS.length - 1, Math.max(0, Number(attemptNumber) - 1));
    const [coreA, coreB] = JIANWANG_REFORGE_COSTS[index];
    return `진기×500, 검심6516×${coreA}, 검심6517×${coreB}`;
}

function jianwangCostText(equip, action, sequenceIndex = 1) {
    if (!equip) return '';
    const id = Number(equip.id);
    if (action === 'reforge') {
        const completed = Number(jianwangReforgeCounts[String(Number(equip.id))]) || 0;
        return jianwangReforgeCost(completed + sequenceIndex);
    }
    if (action === 'grow:5708') return '검의×150, 설은×400, 청금석×20, 공헌도×1200';
    if (action === 'grow:5709') return '검의×300, 자금×200, 운철×1, 공헌도×2000';
    if (action.startsWith('grow:') && id === 5709) return '검의×600, 자금×400, 운철×2, 공헌도×4000';
    if (action.startsWith('ascend:')) return '곤오석×100, 운철×2, 연금니×10, 내력×1000, 주련 진행도×10';
    if (action === 'mangjing') return '망정×10 / 회';
    if (action === JIANWANG_SHATTER_90) return '90레벨 검 분해 후 60레벨 검 배아 재제작';
    if (action === JIANWANG_SHATTER_100) return '100레벨 신병 분해 후 60레벨 검 배아 재제작';
    return '';
}

function updateJianwangHint() {
    const hint = document.getElementById('jianwangHint');
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const materialSelect = document.getElementById('jianwangMaterialSelect');
    if (!hint || !equipSelect || !materialSelect) return;
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    const action = document.getElementById('jianwangActionSelect')?.value || '';
    const material = EQUIP_DATA.special[String(materialSelect.value)];
    if (!equip) {
        hint.textContent = saveLoaded
            ? '현재 세이브에 검왕각 실물 장비 5707~5717이 없어 전용 무기 경로를 미리볼 수 없습니다.'
            : '세이브를 불러오면 주인공, 동료, 이탈 동료, 가방, 창고의 검왕각 실물 장비를 자동 검색합니다.';
        return;
    }
    if (action === 'mangjing') {
        if (!canPredictJianwangMangjing(equip)) {
            hint.textContent = `${equip._source || base?._source || '세이브'} · ${jianwangStageName(equip)}의 망정 결과를 아직 예측할 수 없습니다. 망정 진행도가 포함된 100레벨 주황 신병이 필요합니다(현재 시드: ${equip.MJSeed || '없음'}).`;
            return;
        }
        const materialText = material ? `'${material.name}' 추가 옵션 목록 기준` : '게임에서 실제로 주조에 사용한 재료를 선택하세요.';
        const castNote = (Array.isArray(equip.specials) && equip.specials.length)
            ? ''
            : ' · 이 검은 주조에 사용한 재료가 기록되지 않아 현재 망정 진행도를 기준으로 예측합니다. 게임에서 재료를 주조한 뒤 세이브를 다시 불러오세요.';
        hint.textContent = `${equip._source || base?._source || '세이브'} · ${materialText} · 현재 망정 진행도부터 계산 · ${jianwangCostText(equip, action)}${castNote}`;
        return;
    }
    if (action === JIANWANG_SHATTER_90 || action === JIANWANG_SHATTER_100) {
        if (!validJianwangRedSeed(jianwangRedSeed)) {
            hint.textContent = `${jianwangStageName(equip)} · 세이브에 검 배아 진행도가 없어 다음 60레벨 검 배아를 예측할 수 없습니다.`;
            return;
        }
        const next = createJianwangBlankFromRedSeed(jianwangRedSeed);
        const actionLabel = action === JIANWANG_SHATTER_90 ? '90레벨 검 분해' : '100레벨 신병 분해';
        hint.textContent = `${actionLabel} · 새 60레벨 검 배아가 생성됐습니다. 성장·재주조·망정 결과를 확인할 수 있으며 이번 예측에만 적용됩니다.`;
        return;
    }
    if ((action === 'reforge' || action.startsWith('grow:')) && !validJianwangCZSeed(equip)) {
        hint.textContent = `${base?._source || '세이브'} · ${jianwangStageName(equip)}을 찾았지만 유효한 재주조 진행도가 없어 예측할 수 없습니다.`;
        return;
    }
    if (action === 'reforge') {
        const completed = Math.max(0, Math.floor(Number(
            jianwangReforgeCounts[String(Number(equip.id))],
        ) || 0));
        const remaining = Math.max(0, JIANWANG_REFORGE_LIMIT - completed);
        if (remaining === 0) {
            hint.textContent = `${base?._source || '세이브'} · ${jianwangStageName(equip)} · 재주조 ${completed}회 완료, 최대 ${JIANWANG_REFORGE_LIMIT}회에 도달했습니다.`;
            return;
        }
        hint.textContent = `${base?._source || '세이브'} · ${jianwangStageName(equip)} · 현재 재주조 진행도에서 시작 · ${completed}/${JIANWANG_REFORGE_LIMIT}회 완료, 남은 횟수 ${remaining}회 · ${jianwangCostText(equip, action)}`;
        return;
    }
    const seedText = action.startsWith('ascend:') ? `이번 신병 전환은 재주조 순서를 진행하지 않습니다.` : `현재 재주조 진행도부터 시작`;
    hint.textContent = `${base?._source || '세이브'} · ${jianwangStageName(equip)} · ${seedText} · ${jianwangCostText(equip, action)}`;
}

function updateJianwangCycleHint() {
    const hint = document.getElementById('jianwangCycleHint');
    const button = document.getElementById('btnJianwangCyclePreview');
    const equipSelect = document.getElementById('jianwangEquipSelect');
    const routeSelect = document.getElementById('jianwangCycleRouteSelect');
    const base = saveEquips.find(item => runtimeKey(item) === equipSelect?.value);
    const equip = base ? (getRuntimeEquip(runtimeKey(base)) || base) : null;
    if (!hint) return;
    const id = Number(equip?.id);
    const needsRoute = [5707, 5708, 5709].includes(id);
    const routeId = Number(routeSelect?.value);
    const routeReady = !needsRoute || JIANWANG_LEVEL_90_IDS.has(routeId);
    const startSeedReady = !needsRoute || validJianwangCZSeed(equip);
    const available = saveLoaded && !!equip && isJianwangSword(equip)
        && routeReady && startSeedReady && validJianwangRedSeed(jianwangRedSeed);
    if (button) button.disabled = !available;
    if (!saveLoaded) {
        hint.textContent = '세이브를 불러온 뒤 검왕각 검 배아 또는 전용 무기를 선택하면 신규 검마다 한 페이지씩 전체 과정을 미리볼 수 있습니다.';
    } else if (!equip || !isJianwangSword(equip)) {
        hint.textContent = '검왕각 실물 장비 5707~5717을 선택하세요.';
    } else if (!validJianwangRedSeed(jianwangRedSeed)) {
        hint.textContent = '세이브에 검 배아 진행도가 없어 검 분해 결과를 볼 수 없습니다.';
    } else if (needsRoute && !validJianwangCZSeed(equip)) {
        hint.textContent = `${jianwangStageName(equip)}의 성장 진행도가 없어 90레벨까지 예측할 수 없습니다.`;
    } else if (needsRoute && !routeReady) {
        hint.textContent = `${jianwangStageName(equip)}는 아직 90레벨이 아닙니다. 최종 90레벨 전용 무기 경로를 선택하세요.`;
    } else if (JIANWANG_LEVEL_100_IDS.has(id)) {
        hint.textContent = '현재 검 배아부터 계산합니다. 100레벨에 도달했거나 재주조 10회를 완료했다면 검을 분해하고 다음 회차로 이동합니다. 옵션을 보존하지 않는 조건으로 계산합니다.';
    } else if (needsRoute) {
        hint.textContent = `${jianwangStageName(equip)}를 선택한 90레벨 경로까지 옵션 보존 없이 성장시킨 뒤 분해합니다. 이후 새 검마다 별도 페이지로 표시합니다.`;
    } else {
        hint.textContent = '현재 90레벨 전용 무기를 바로 분해해 1회차를 시작합니다. 새 검마다 60→90레벨 성장과 옵션 보존 없는 재주조 10회를 미리봅니다.';
    }
}

function emptyEquipTip(which) {
    const source = getSourceFilter(which);
    if (source === 'crafted') return '(일치하는 모의 제작 장비가 없습니다. 출처나 검색어를 변경하세요)';
    if (source === 'equipped') return '(일치하는 장착 장비가 없습니다. 출처를 변경하세요)';
    if (which === 'shenglian') return '(승련 가능한 90레벨 장비가 없습니다)';
    if (which === 'strong') return '(촉련 가능한 무기가 없습니다)';
    return '(정련 가능한 100레벨 장비가 없습니다. 90레벨 장비는 승련하세요)';
}

function fillEquipSelects(preserveSelection = true) {
    const configs = [
        { which: 'xilian', selId: 'xilianEquipSelect', pred: canXilian },
        { which: 'strong', selId: 'strongEquipSelect', pred: canStrong },
        { which: 'shenglian', selId: 'shenglianEquipSelect', pred: canShengLian },
    ];
    for (const { which, selId, pred } of configs) {
        const sel = document.getElementById(selId);
        if (!sel) continue;
        const prev = preserveSelection ? sel.value : '';
        const list = saveEquips.filter(e => pred(e) && passEquipListFilter(e, which));
        sel.innerHTML = '';
        if (!list.length) {
            sel.innerHTML = `<option value="">${emptyEquipTip(which)}</option>`;
        } else {
            for (const e of list) {
                const opt = document.createElement('option');
                opt.value = runtimeKey(e);
                opt.textContent = equipOptionLabel(e, which);
                sel.appendChild(opt);
            }
            if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
        }
    }
    fillSpecialAttachEquipSelect(preserveSelection);
    fillJianwangEquipSelect(preserveSelection);
    updateXilianHint();
    updateStrongHint();
    updateShenglianHint();
    updateJianwangHint();
    updateCraftedBagHint();
}

function updateShenglianHint() {
    const el = document.getElementById('shenglianHint');
    const box = document.getElementById('shenglianPreview');
    const sel = document.getElementById('shenglianEquipSelect');
    if (!el || !sel) return;
    const key = sel.value;
    const base = key ? saveEquips.find(e => runtimeKey(e) === key) : null;
    if (!base) {
        el.textContent = '다음 등급이 존재하는 90레벨 일반 장비는 100레벨까지 승련할 수 있습니다. 정련은 승련 후 가능합니다';
        if (box) {
            box.classList.add('empty');
            box.textContent = '장비 선택 시 90→100레벨 변화가 표시됩니다';
        }
        return;
    }
    const cfg = EQUIP_DATA.equipment[String(base.id)] || {};
    const next = EQUIP_DATA.equipment[String(cfg.equ_next)] || {};
    const cost = calcShengLianCost(base);
    el.textContent = `예상 소모: ${formatCostList(cost)}(안내 전용, 가방에서 차감하지 않음)`;
    if (box) {
        box.classList.remove('empty');
        const typ = TYPE_NAMES[base.typ] || base.typ;
        const mark = base._mark ? ` · 표시 「${escapeHtml(base._mark)}」` : '';
        box.innerHTML = `
            <div><strong>현재</strong>：${escapeHtml(base.name)} · ${base.need_lv}레벨 · ${COLOR_NAMES[base.color] || base.color} · ${escapeHtml(String(typ))} · 옵션 ${base.exts.length}개${mark}</div>
            <div><strong>승련 후</strong>：${escapeHtml(nangmanEquipmentDisplayName(next) || '?')} · ${next.lv || 100}레벨 · 장비 ID ${cfg.equ_next}</div>
            <div class="warn">승련 시 기존 옵션, 촉련 단계, 이후 순서와 표시가 유지됩니다. 승련 후 정련 화면에서 출처를 모의 제작으로 설정해 찾을 수 있습니다</div>
        `;
    }
}

function updateXilianInitialExts(key) {
    const el = document.getElementById('xilianInitialExts');
    if (!el) return;
    const baseEq = key ? saveEquips.find(e => runtimeKey(e) === key) : null;
    if (!baseEq) {
        el.classList.add('empty');
        el.innerHTML = '<span class="xilian-initial-label">제작 당시 초기 옵션</span><span class="xilian-initial-values">장비를 선택하세요</span>';
        return;
    }
    const initialExts = baseEq._initial_exts?.length ? baseEq._initial_exts : (baseEq.exts || []);
    el.classList.remove('empty');
    el.innerHTML = `<span class="xilian-initial-label">제작 당시 초기 옵션</span><span class="xilian-initial-values">${formatProps(initialExts)}</span>`;
}

function updateXilianHint() {
    const el = document.getElementById('xilianHint');
    const key = document.getElementById('xilianEquipSelect').value;
    const eq = key ? getRuntimeEquip(key) : null;
    updateXilianInitialExts(key);
    if (!eq) {
        el.textContent = '100레벨 녹색·청색·자색 장비만 정련할 수 있습니다. 90레벨 장비는 승련하세요. 모의 제작 장비만 골라 보거나 표시별로 필터링할 수 있습니다';
        return;
    }
    const marks = eq.xilian_marks || [];
    const cost = calcXilianCost(eq);
    const slots = (eq.exts || []).map((p, i) => {
        const marked = marks.includes(i + 1) ? '🔒' : '';
        return `${i + 1}:${propLabel(p.prop)}${marked}`;
    }).join(' · ');
    const main = mainPropDisplay(eq, eq.XLLevel || 0)
        .map(m => `${m.label}${m.value}`)
        .join(' · ');
    const baseEq = saveEquips.find(e => runtimeKey(e) === key);
    const userMark = baseEq?._mark ? ` · 표시 「${baseEq._mark}」` : '';
    el.textContent = `정련 레벨 ${eq.XLLevel} · 표시한 옵션 슬롯: ${marks.join(',') || '없음'} · 다음 회차 소모: ${formatCostList(cost.mats)} · ${main || '강기/내경 없음'} · 옵션 ${slots || '—'}${userMark}`;
}

function updateStrongHint() {
    const el = document.getElementById('strongHint');
    const key = document.getElementById('strongEquipSelect').value;
    const eq = key ? getRuntimeEquip(key) : null;
    if (!eq) {
        el.textContent = '촉련은 무기만 가능합니다. 출처를 모의 제작으로 제한하거나 표시별로 필터링할 수 있습니다';
        return;
    }
    const preview = strongPreviewEquip(eq);
    fillStrongTargetLevels(preview);
    const baseEq = saveEquips.find(e => runtimeKey(e) === key);
    const userMark = baseEq?._mark ? ` · 표시 「${baseEq._mark}」` : '';
    const resetNote = isStrongResetOrigin()
        ? `유화정 예측: 촉련 전 상태에서 이 장비의 촉련 순서를 그대로 사용하며 세이브를 변경하지 않습니다· `
        : '';
    if (Number(preview.level) >= 15) {
        el.textContent = `이미 +15까지 촉련되어 이후 결과가 없습니다${userMark}; 다시 예측하려면 「유화정 사용 후 0단계부터 예측」을 선택하세요`;
        return;
    }
    const c = strongAttemptCost(eq.need_lv || 90, preview.level);
    const stone = c ? `${STONE_NAMES[c.mat] || c.mat}×${c.num}` : '?';
    el.textContent = `${resetNote}S=${eq.S} · 현재 +${preview.level}/15 · 다음 단계 소모 ${stone} · 성장 계수 ${eq.lv_prop}${userMark}`;
}

function setXilianHead() {
    setPreviewTableKind('xilian');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>유지</th><th>#</th><th>슬롯</th><th>이전→신규</th><th>배율</th><th>정련 등급</th>
    </tr>`;
}

function fillXilianPropFilter(items) {
    const sel = document.getElementById('xilianFilterProp');
    if (!sel) return;
    const prev = sel.value;
    const props = [...new Set((items || []).map(it => it.prop?.prop).filter(Boolean))].sort((a, b) => {
        return propLabel(a).localeCompare(propLabel(b), 'zh');
    });
    sel.innerHTML = '<option value="">전체</option>' + props.map(p =>
        `<option value="${escapeHtml(p)}">${escapeHtml(propLabel(p))}</option>`
    ).join('');
    if (prev && props.includes(prev)) sel.value = prev;
}

function fillXilianTargetProps(eq, items) {
    const sel = document.getElementById('xilianTargetProp');
    const btn = document.getElementById('btnXilianOptimize');
    if (!sel) return;
    const prev = sel.value;
    const props = [...new Set([
        ...(eq?.exts || []).map(p => p?.prop),
        ...(items || []).map(it => it.prop?.prop),
    ].filter(Boolean))].sort((a, b) => propLabel(a).localeCompare(propLabel(b), 'zh'));
    sel.innerHTML = '<option value="">목표 능력치 선택</option>' + props.map(p =>
        `<option value="${escapeHtml(p)}">${escapeHtml(propLabel(p))}</option>`
    ).join('');
    if (prev && props.includes(prev)) sel.value = prev;
    sel.disabled = !props.length;
    if (btn) btn.disabled = !props.length;
}

function xilianTargetTotal(exts, target) {
    return (exts || []).reduce((sum, prop) => {
        return sum + (prop?.prop === target && Number.isFinite(Number(prop.value)) ? Number(prop.value) : 0);
    }, 0);
}

function buildXilianMaxPlan(eq, count, target) {
    if (typeof EquipmentAutoOptimizer === 'undefined' || typeof EquipmentAutoOptimizer.buildRefinementMaxPlan !== 'function') throw new Error('정련 계획 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도하세요');
    return EquipmentAutoOptimizer.buildRefinementMaxPlan({ xilianPlan: (equip, accepts) => wasmXilianPlan(equip, accepts) }, eq, count, target);
}

async function optimizeXilianPlan() {
    const button = document.getElementById('btnXilianOptimize');
    const target = document.getElementById('xilianTargetProp')?.value || '';
    const key = document.getElementById('xilianEquipSelect')?.value || '';
    const eq = getRuntimeEquip(key);
    if (!eq || !xilianAcceptFlags.length) { alert('먼저 정련 순서를 계산하세요'); return; }
    if (!target) { alert('목표 능력치를 선택하세요'); return; }

    const oldText = button?.textContent || '최대 합계 계획';
    if (button) {
        button.disabled = true;
        button.textContent = '계획 계산 중…';
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
        const result = buildXilianMaxPlan(eq, xilianAcceptFlags.length, target);
        const verified = wasmXilianPlan(toWasmEquip(eq), result.accepts);
        if (verified.error || !verified.equip) throw new Error(verified.error || '계획 재계산 실패');
        const actualTotal = xilianTargetTotal(verified.equip.exts, target);
        if (Math.abs(actualTotal - result.total) > 1e-9) {
            throw new Error(`계획 검증 불일치: 계산 ${result.total}, 재검산 ${actualTotal}`);
        }
        xilianAcceptFlags = result.accepts;
        xilianAutoPlan = { ...result, total: actualTotal, equipKey: key };
        refreshXilianPlan();
        const propFilter = document.getElementById('xilianFilterProp');
        if (propFilter) {
            if (![...propFilter.options].some(option => option.value === target)) {
                const option = document.createElement('option');
                option.value = target;
                option.textContent = propLabel(target);
                propFilter.appendChild(option);
            }
            propFilter.value = target;
            renderXilianRows(xilianPlanItems, xilianAcceptFlags, true);
        }
    } catch (err) {
        xilianAutoPlan = null;
        alert(`자동 계획 실패：${err.message || err}`);
    } finally {
        if (button) {
            button.textContent = oldText;
            button.disabled = false;
        }
    }
}

function xilianFilterMatch(it) {
    const slot = document.getElementById('xilianFilterSlot')?.value || '';
    const prop = document.getElementById('xilianFilterProp')?.value || '';
    if (slot && String(it.slot) !== slot) return false;
    if (prop && it.prop?.prop !== prop) return false;
    return true;
}

function bindXilianKeepChecks() {
    document.querySelectorAll('#previewBody input.xl-keep').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = Number(cb.dataset.idx);
            if (Number.isFinite(idx)) xilianAcceptFlags[idx] = cb.checked;
            xilianAutoPlan = null;
            refreshXilianPlan();
        });
    });
}

function buildXilianEntries(items) {
    const out = [];
    (items || []).forEach((it, idx) => {
        if (xilianFilterMatch(it)) out.push({ it, idx });
    });
    return out;
}

function renderXilianPage() {
    const body = document.getElementById('previewBody');
    const metaFilter = document.getElementById('xilianFilterMeta');
    if (!body) return;
    const entries = tablePager.xilianEntries || [];
    const accepts = xilianAcceptFlags;
    const pageSize = getPreviewPageSize();
    const start = (tablePager.page - 1) * pageSize;
    const slice = entries.slice(start, start + pageSize);
    if (!slice.length) {
        body.innerHTML = `<tr><td colspan="6" class="empty-row">일치하는 기록이 없습니다</td></tr>`;
    } else {
        body.innerHTML = slice.map(({ it, idx }) => {
            const oldTxt = it.old_prop
                ? `${propLabel(it.old_prop.prop)}+${formatPropValue(it.old_prop.prop, it.old_prop.value)}`
                : '—';
            const newTxt = `${propLabel(it.prop.prop)}+${formatPropValue(it.prop.prop, it.prop.value)}`;
            const kept = !!accepts[idx];
            return `<tr class="${kept ? 'row-keep' : ''}" data-idx="${idx}">
                <td><input type="checkbox" class="xl-keep" data-idx="${idx}" ${kept ? 'checked' : ''}></td>
                <td>${it.index}</td>
                <td>슬롯 ${it.slot}</td>
                <td>${oldTxt} → ${newTxt}</td>
                <td>×${it.cost_mult}</td>
                <td>${it.xl_level_before}→${it.xl_level}</td>
            </tr>`;
        }).join('');
        bindXilianKeepChecks();
    }
    if (metaFilter) {
        metaFilter.textContent = `${entries.length}/${(xilianPlanItems || []).length}개 표시`;
    }
    updatePreviewPager(entries.length);
}

function renderXilianRows(items, accepts, resetPage = false) {
    tablePager.mode = 'xilian';
    if (resetPage) tablePager.page = 1;
    tablePager.xilianEntries = buildXilianEntries(items);
    void accepts;
    renderXilianPage();
}

function sumXilianCosts(eq, items, untilIdx) {
    const end = untilIdx == null ? items.length - 1 : untilIdx;
    const total = {};
    const isArmor = eq.typ >= 5 && eq.typ <= 7;
    const matName = isArmor ? '青蝉翼' : '昆吾石';
    const price = (EQUIP_DATA.equipment[String(eq.id)]?.price) || 10000;
    const silverOnce = Math.floor(price * 1.5);
    for (let i = 0; i <= end && i < items.length; i++) {
        const mult = items[i].cost_mult;
        total[matName] = (total[matName] || 0) + 5 * mult;
        total['连金泥'] = (total['连金泥'] || 0) + mult;
        total['银两'] = (total['银两'] || 0) + silverOnce;
    }
    return total;
}

function formatXilianCostText(total) {
    return Object.entries(total).map(([name, n]) => {
        if (name === '银两') return `${nangmanEquipmentDisplayText(name)} ${formatSilver(n)}`;
        return `${nangmanEquipmentDisplayText(name)}×${n}`;
    }).join(' · ') || '—';
}

function refreshXilianPlan() {
    const key = document.getElementById('xilianEquipSelect').value;
    const eq = getRuntimeEquip(key);
    const box = document.getElementById('xilianPlanSummary');
    if (!eq || !xilianAcceptFlags.length) {
        if (box) {
            box.classList.add('empty');
            box.innerHTML = '결과를 예측한 후 유지할 항목을 선택하면 총 소모와 최종 옵션을 확인할 수 있습니다';
        }
        return;
    }
    const accepts = xilianAcceptFlags.slice();
    const plan = wasmXilianPlan(toWasmEquip(eq), accepts);
    if (plan.error && !plan.items?.length) {
        box.classList.remove('empty');
        box.textContent = plan.error;
        return;
    }

    xilianPlanItems = plan.items || [];

    let marks = new Set(eq.xilian_marks || []);
    let simMarks = marks.size;
    for (const it of xilianPlanItems) {
        if (it.accepted) {
            marks.add(it.slot);
            simMarks = marks.size;
        }
    }

    const total = sumXilianCosts(eq, xilianPlanItems);
    const keepN = accepts.filter(Boolean).length;
    let lastKeepIdx = -1;
    for (let i = accepts.length - 1; i >= 0; i--) {
        if (accepts[i]) {
            lastKeepIdx = i;
            break;
        }
    }
    const cutoffTotal = lastKeepIdx >= 0
        ? sumXilianCosts(eq, xilianPlanItems, lastKeepIdx)
        : null;
    const lastKeepNo = lastKeepIdx >= 0
        ? (xilianPlanItems[lastKeepIdx]?.index ?? lastKeepIdx + 1)
        : 0;

    const finalEq = plan.equip || eq;
    const xl = finalEq.XLLevel ?? finalEq.xl_level ?? 0;
    const main = mainPropDisplay(eq, xl);
    const exts = finalEq.exts || [];

    const costTxt = formatXilianCostText(total);
    const cutoffTxt = cutoffTotal ? formatXilianCostText(cutoffTotal) : '';

    const extTxt = exts.length
        ? exts.map((p, i) => {
            const mk = (finalEq.xilian_marks || []).includes(i + 1) || (finalEq.xilian_marks || []).includes(String(i + 1));
            return `${i + 1}.${propLabel(p.prop)}+${formatPropValue(p.prop, p.value)}${mk ? '🔒' : ''}`;
        }).join(' · ')
        : '—';

    const lianjinTotal = plan.total_lianjin != null ? plan.total_lianjin : (total['连金泥'] || 0);
    const mainTxt = main.map(m => m.label + m.value).join(' · ') || '강기·내경 기본 옵션 없음';
    const cutoffLine = cutoffTotal
        ? `<div><strong>종료 회차까지 소모량</strong>（제${lastKeepNo}회까지 총 정련 ${lastKeepIdx + 1}회, 옵션 유지 ${keepN}회）：${cutoffTxt}</div>`
        : '';
    let autoLine = '';
    if (xilianAutoPlan && xilianAutoPlan.equipKey === key) {
        const target = xilianAutoPlan.target;
        const naturalSteps = xilianAutoPlan.steps.map(step => xilianPlanItems[step - 1]?.index ?? step);
        const pathText = naturalSteps.length ? naturalSteps.map(no => `제${no}회`).join(' → ') : '추가 유지 불필요';
        const targetSlots = exts.map((p, i) => {
            const value = p?.prop === target ? Number(p.value) || 0 : 0;
            return `슬롯 ${i + 1}=${formatPropValue(target, value)}`;
        }).join(' · ');
        autoLine = `
            <div class="xilian-opt-total"><strong>${escapeHtml(propLabel(target))} 최대 합계</strong>：${formatPropValue(target, xilianAutoPlan.total)}（${targetSlots || '옵션 없음'}）</div>
            <div><strong>자동 유지 경로</strong>：${pathText}</div>
        `;
    }

    box.classList.remove('empty');
    box.innerHTML = `
        ${autoLine}
        <div><strong>총 소모</strong>(정련 ${accepts.length}회 전체): ${costTxt}</div>
        ${cutoffLine}
        <div>연금니 합계 ${lianjinTotal} · 최종 정련 등급=${xl} · 표시된 슬롯 ${simMarks}개</div>
        <div>${mainTxt}</div>
        <div class="swap-line"><strong>최종 추가 옵션</strong>：${extTxt}</div>
        <div class="warn">※ 정련 시 매회 재료가 소모됩니다. 유지하기로 선택한 결과만 해당 슬롯을 교체하며 이후 소모량은 2배가 됩니다. 종료 회차까지 소모량은 마지막으로 유지한 회차까지 계산합니다.</div>
    `;

    fillXilianPropFilter(xilianPlanItems);
    renderXilianRows(xilianPlanItems, accepts, false);
}

function renderXilianPreview(n) {
    setXilianHead();
    const body = document.getElementById('previewBody');
    const meta = document.getElementById('previewMeta');
    const key = document.getElementById('xilianEquipSelect').value;
    const eq = getRuntimeEquip(key);
    const filterBar = document.getElementById('xilianFilterBar');
    const makeFilter = document.getElementById('makeFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    if (!eq) {
        body.innerHTML = `<tr><td colspan="6" class="empty-row">장비를 선택하세요</td></tr>`;
        if (filterBar) filterBar.hidden = true;
        hidePreviewPager();
        return;
    }
    xilianPlanEquipKey = key;
    xilianAutoPlan = null;
    xilianAcceptFlags = Array(n).fill(false);
    const plan = wasmXilianPlan(toWasmEquip(eq), xilianAcceptFlags);
    if (plan.error && !plan.items?.length) {
        body.innerHTML = `<tr><td colspan="6" class="empty-row">${escapeHtml(plan.error)}</td></tr>`;
        meta.textContent = '';
        if (filterBar) filterBar.hidden = true;
        hidePreviewPager();
        return;
    }
    xilianPlanItems = plan.items || [];
    meta.textContent = `전체 ${xilianPlanItems.length}회 · '유지'를 선택하면 소모량과 최종 능력치를 자동 계산합니다.`;
    fillXilianTargetProps(eq, xilianPlanItems);
    if (filterBar) {
        filterBar.hidden = false;
        document.getElementById('xilianFilterSlot').value = '';
        fillXilianPropFilter(xilianPlanItems);
        document.getElementById('xilianFilterProp').value = '';
    }
    tablePager.page = 1;
    refreshXilianPlan();
}

function setStrongHead() {
    setPreviewTableKind('strong');
    document.getElementById('previewHead').innerHTML = `<tr>
        <th>#</th><th>품질</th><th>촉련도</th><th>소모 최소</th><th>수치 최적</th>
    </tr>`;
}

function strongMinGrade() {
    return Number(document.getElementById('strongMinGrade')?.value) || 3;
}

/* 硫华晶：把淬炼层数清零，但保留当前随机进度（S / LvProp）。
 * 这里只是模拟：按 0 层重新起算序列，不改存档。 */
function isStrongResetOrigin() {
    return !!document.getElementById('strongResetOrigin')?.checked;
}

function strongPreviewEquip(equip) {
    if (!equip) return equip;
    return isStrongResetOrigin() ? Object.assign({}, equip, { level: 0 }) : equip;
}

function fillStrongTargetLevels(eq) {
    const sel = document.getElementById('strongTargetLevel');
    if (!sel) return;
    const cur = eq?.level || 0;
    const prev = Number(sel.value) || 0;
    sel.innerHTML = '';
    for (let lv = cur + 1; lv <= 15; lv++) {
        const opt = document.createElement('option');
        opt.value = lv;
        opt.textContent = `+${lv}`;
        sel.appendChild(opt);
    }
    if (!sel.options.length) {
        sel.innerHTML = '<option value="">+15 최대 단계 도달</option>';
        return;
    }
    const prefer = prev > cur ? prev : Math.min(15, cur + 15);
    sel.value = String(prefer);
}

function formatCostChips(bag) {
    const chips = [];
    for (const id of [3027, 3028, 3029, 3030]) {
        const n = bag?.stones?.[id] || 0;
        if (n) chips.push(`<span class="cost-chip">${nangmanEquipmentDisplayText(STONE_NAMES[id])}×${n}</span>`);
    }
    if (bag?.silver) chips.push(`<span class="cost-chip">은냥 ${formatSilver(bag.silver)}</span>`);
    return chips.join('') || '<span class="cost-chip">—</span>';
}

function renderPathChipsHtml(accepts, names, which) {
    const total = accepts.length;
    if (!total) return '<div class="advice-path">—</div>';
    const pages = Math.max(1, Math.ceil(total / PATH_PAGE_SIZE));
    let page = pathPages[which] || 1;
    if (page > pages) page = pages;
    if (page < 1) page = 1;
    pathPages[which] = page;
    const start = (page - 1) * PATH_PAGE_SIZE;
    const slice = accepts.slice(start, start + PATH_PAGE_SIZE);
    const path = slice.map(st => {
        const nextLv = (st.level || 0) + 1;
        return `<span class="path-chip">
            <span class="lv">+${st.level}→+${nextLv}</span>
            <span class="idx">#${st.index}</span>
            <span class="grade-${st.grade}">${names[st.grade] || ''}</span>
        </span>`;
    }).join('');
    const pager = total > PATH_PAGE_SIZE
        ? `<div class="path-pager" data-which="${which}">
            <button type="button" class="btn btn-reset path-prev" ${page <= 1 ? 'disabled' : ''}>이전 페이지</button>
            <span>${page}/${pages}페이지 · 총 ${total}회</span>
            <button type="button" class="btn btn-reset path-next" ${page >= pages ? 'disabled' : ''}>다음 페이지</button>
           </div>`
        : '';
    return `<div class="advice-path">${path}</div>${pager}`;
}

function formatPlanCard(title, plan, names, tag, which) {
    if (!plan?.ok) {
        return `<article class="advice-card fail">
            <div class="advice-card-head"><h3>${title}</h3></div>
            <div>${escapeHtml(plan?.reason || '사용할 수 없음')}</div>
        </article>`;
    }
    const deg = plan.value / 2;
    const atk = formatAttributeDecimal(plan.value / 10);
    const accepts = plan.steps.filter(s => s.action === '接受');
    plan._acceptSteps = accepts;
    plan._names = names;
    return `<article class="advice-card" data-plan="${which}">
        <div class="advice-card-head">
            <h3>${title}</h3>
            <span class="tag">${tag}</span>
        </div>
        <div class="advice-metrics">
            <div class="advice-metric"><span class="v">${plan.attempts}</span><span class="k">시도 횟수</span></div>
            <div class="advice-metric"><span class="v">+${deg}%</span><span class="k">촉련도</span></div>
            <div class="advice-metric"><span class="v">+${atk}%</span><span class="k">예상 능력치</span></div>
        </div>
        <div class="advice-costs">${formatCostChips(plan.bag)}</div>
        <div class="advice-path-label">수락 경로(단계 상승 ${accepts.length}회)</div>
        <div class="advice-path-wrap">${renderPathChipsHtml(accepts, names, which)}</div>
    </article>`;
}

function bindPathPagers() {
    document.querySelectorAll('.path-pager').forEach(bar => {
        const which = bar.dataset.which;
        bar.querySelector('.path-prev')?.addEventListener('click', () => {
            pathPages[which] = (pathPages[which] || 1) - 1;
            refreshPathSection(which);
        });
        bar.querySelector('.path-next')?.addEventListener('click', () => {
            pathPages[which] = (pathPages[which] || 1) + 1;
            refreshPathSection(which);
        });
    });
}

function refreshPathSection(which) {
    if (!strongPlanCache) return;
    const plan = which === 'min' ? strongPlanCache.minCost : strongPlanCache.maxValue;
    const card = document.querySelector(`.advice-card[data-plan="${which}"]`);
    const wrap = card?.querySelector('.advice-path-wrap');
    if (!wrap || !plan?._acceptSteps) return;
    wrap.innerHTML = renderPathChipsHtml(plan._acceptSteps, plan._names || {}, which);
    bindPathPagers();
}

function highlightStrongPlan(which) {
    if (!strongPlanCache) return;
    const plan = which === 'min' ? strongPlanCache.minCost : strongPlanCache.maxValue;
    const set = plan?.ok ? plan.accepts : new Set();
    document.querySelectorAll('#previewBody tr[data-idx]').forEach(tr => {
        const idx = Number(tr.dataset.idx);
        tr.classList.toggle('row-keep', set.has(idx));
    });
}

function renderStrongPage() {
    const body = document.getElementById('previewBody');
    if (!body) return;
    const items = tablePager.strongItems || [];
    const minSet = tablePager.strongMinSet || new Set();
    const bestSet = tablePager.strongBestSet || new Set();
    const pageSize = getPreviewPageSize();
    const start = (tablePager.page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    if (!slice.length) {
        body.innerHTML = `<tr><td colspan="5" class="empty-row">데이터 없음</td></tr>`;
    } else {
        body.innerHTML = slice.map(it => {
            const deg = it.add_lv_prop / 2;
            return `<tr data-idx="${it.index}">
                <td>${it.index}</td>
                <td class="grade-${it.grade}">${it.grade_name}</td>
                <td>+${deg}%(동일 단계 참고)</td>
                <td class="${minSet.has(it.index) ? 'advice-yes' : 'advice-no'}">${minSet.has(it.index) ? '수락' : '—'}</td>
                <td class="${bestSet.has(it.index) ? 'advice-yes' : 'advice-no'}">${bestSet.has(it.index) ? '수락' : '—'}</td>
            </tr>`;
        }).join('');
    }
    updatePreviewPager(items.length);
}

function renderStrongPreview(resp, eq) {
    setStrongHead();
    const body = document.getElementById('previewBody');
    const meta = document.getElementById('previewMeta');
    const advice = document.getElementById('strongAdvice');
    const xlFilter = document.getElementById('xilianFilterBar');
    if (xlFilter) xlFilter.hidden = true;
    const makeFilter = document.getElementById('makeFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    if (resp.error && (!resp.items || !resp.items.length)) {
        body.innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHtml(resp.error)}</td></tr>`;
        meta.textContent = '';
        if (advice) advice.innerHTML = '';
        strongPlanCache = null;
        hidePreviewPager();
        return;
    }
    const items = resp.items || [];
    const grades = items.map(i => i.grade);
    const startLevel = eq.level || 0;
    const target = Number(document.getElementById('strongTargetLevel')?.value) || Math.min(15, startLevel + 3);
    const minG = strongMinGrade();
    const names = { 1: '일반', 2: '양호', 3: '우수', 4: '완벽' };

    const plans = planStrongPath(grades, startLevel, target, minG, eq.need_lv || 90);
    strongPlanCache = plans;
    strongPlanCache.items = items;
    pathPages = { min: 1, max: 1 };

    const perfect = items.filter(i => i.grade === 4).length;
    meta.textContent = `순서 ${items.length}개 · 완벽 ${perfect}개 · 현재 +${startLevel} → 목표 +${target} · 최저 ${names[minG]}`
        + (resp.resetOrigin ? ` · 유화정 시뮬레이션(기존 +${resp.originLevel}단계, 무작위 진행도 유지)` : '');

    advice.innerHTML = [
        formatPlanCard('소모 최소', plans.minCost, names, '희귀 촉련석 소모 최소화 우선', 'min'),
        formatPlanCard('수치 최적', plans.maxValue, names, '높은 촉련도 우선', 'max'),
        '<div class="advice-note">※ 유지하지 않아도 정련석이 소모됩니다. 같은 결과라면 소모량이 적은 단계에서 시도하세요. 등급은 자색·청색·녹색·백색 순입니다. 아래 버튼을 누르면 해당 유지 회차가 강조됩니다.</div>',
    ].join('');
    bindPathPagers();

    const minSet = plans.minCost?.ok ? plans.minCost.accepts : new Set();
    const bestSet = plans.maxValue?.ok ? plans.maxValue.accepts : new Set();

    tablePager.mode = 'strong';
    tablePager.page = 1;
    tablePager.strongItems = items;
    tablePager.strongMinSet = minSet;
    tablePager.strongBestSet = bestSet;
    renderStrongPage();
}


function extractMakeRnd(data) {
    if (!data) return null;
    if (data.MakeRnd) return data.MakeRnd;
    if (Array.isArray(data) && data[0]?.MakeRnd) return data[0].MakeRnd;
    if (data.Seeds || data.LuckySeeds) return data;
    return null;
}

function loadSaveData(json) {
    const makeRnd = extractMakeRnd(json);
    if (!makeRnd) throw new Error('세이브에서 MakeRnd를 찾을 수 없습니다');
    const state = {
        save_version: saveMeta?.version || (Array.isArray(json) ? json[0]?.DBVersion : json?.DBVersion) || '',
        save_channel: saveMeta?.channel || saveMeta?.platform || '',
        Seeds: makeRnd.Seeds || {},
        LuckySeeds: makeRnd.LuckySeeds || {},
        IDSeeds: makeRnd.IDSeeds || {},
        MakeLucky: makeRnd.MakeLucky || {},
    };
    if (!wasmMakeSetState(state)) throw new Error('MakeRnd 적용 실패');
    makeRndSnapshot = JSON.parse(JSON.stringify(state));

    saveEquips = collectEquipsFromSave(json);
    alignCraftedSeqToEquips();
    saveEquipsSnapshot = JSON.parse(JSON.stringify(saveEquips));
    equipRuntime = {};
    equipRuntimeSnapshot = {};
    if (typeof renderFavList === 'function') renderFavList();
    jianwangRuleDetection = detectJianwangRuleFromEquips(saveEquips);
    jianwangRedSeed = validJianwangRedSeed(makeRnd.RedSeeds?.[String(JIANWANG_BLANK_ID)])
        ? Number(makeRnd.RedSeeds[String(JIANWANG_BLANK_ID)])
        : null;
    jianwangRedSeedSnapshot = jianwangRedSeed;
    jianwangReforgeCounts = {};
    const saveRoot = Array.isArray(json) ? json[0] : json;
    for (const id of JIANWANG_LEVEL_90_IDS) {
        const savedCount = findSaveScalar(saveRoot, `again_${id}`);
        jianwangReforgeCounts[String(id)] = Math.max(0, Math.floor(Number(savedCount) || 0));
    }
    for (const e of saveEquips) {
        const k = runtimeKey(e);
        const full = { ...e, ...toWasmEquip(e), xilian_marks: [...(e.xilian_marks || [])] };
        equipRuntime[k] = JSON.parse(JSON.stringify(full));
        equipRuntimeSnapshot[k] = JSON.parse(JSON.stringify(full));
    }
    jianwangReforgeCountsSnapshot = { ...jianwangReforgeCounts };

    saveLoaded = true;
    window.OrangeForgeUI?.invalidate();
    clearMakeAdvanceNotice();
    resetXilianSession();
    document.getElementById('saveStatus').textContent = '세이브 적용 완료';
    if (typeof renderArchiveState === 'function') renderArchiveState(json);
    fillEquipSelects();
    renderCraftedBagList();
    updateMakeHints();
    updateCraftedBagHint();
    updateJianwangCycleHint();
}

async function handleSaveFile(file) {
    if (typeof _importFeedback === 'function') _importFeedback(true);
    let json;
    try {
        if (typeof decryptSaveFile === 'function') {
            const r = await decryptSaveFile(file);
            json = r.data;
            saveMeta = {
                version: r.version || '',
                channel: r.channel || '',
                platform: r.platform || '',
                columns: r.columns || null,
                row: r.row || null,
            };
            if (typeof saveShareStore === 'function') {
                saveShareStore(json, {
                    version: r.version, platform: r.platform,
                    channel: r.channel || (String(r.platform || '').toLowerCase() === 'oversea' ? '해외 서버' : ''),
                    format: r.format || 'json', columns: r.columns || null, row: r.row || null,
                });
            }
        } else {
            const text = await file.text();
            const raw = JSON.parse(text);
            const entry = Array.isArray(raw) ? raw[0] : raw;
            if (entry && (entry.content || entry.encrypted)) {
                json = wasmDecryptSave(entry.content || entry.encrypted);
            } else {
                json = raw;
            }
        }
    } catch (e) {
        if (typeof _importFeedback === 'function') _importFeedback(false);
        throw new Error('세이브 분석 실패: ' + e.message);
    }
    if (typeof _importFeedback === 'function') _importFeedback(false);
    loadSaveData(json);
}

function switchTab(tab) {
    currentTab = tab;
    document.body.classList.toggle('sbj-orange-mode', tab === 'orange');
    const orangePanel = document.getElementById('panelOrange');
    if (orangePanel) orangePanel.hidden = tab !== 'orange';
    if (tab === 'orange') window.OrangeForgeUI?.checkState();
    document.body.classList.toggle('sbj-jianwang-mode', tab === 'jianwang');
    document.querySelectorAll('.yyhx-manual-tabs a').forEach(a => {
        if (a.dataset.category === (tab === 'jianwang' ? 'jianwang' : 'equip')) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('panelMake').hidden = tab !== 'make';
    const sl = document.getElementById('panelShenglian');
    if (sl) sl.hidden = tab !== 'shenglian';
    document.getElementById('panelXilian').hidden = tab !== 'xilian';
    document.getElementById('panelStrong').hidden = tab !== 'strong';
    const jwg = document.getElementById('panelJianwang');
    if (jwg) jwg.hidden = tab !== 'jianwang';
    renderMakeAdvanceNotice();
    if (tab === 'shenglian') {
        fillEquipSelects();
        updateShenglianHint();
        clearPreview('승련은 순서 예측이 필요 없습니다. 장비를 선택한 뒤 ‘승련 실행’을 누르세요.');
    } else if (tab === 'jianwang') {
        fillJianwangEquipSelect(true);
        updateJianwangHint();
        clearPreview('세이브의 검 배아 또는 전용 무기와 경로를 선택한 뒤 ‘현재 경로 미리보기’를 누르세요.');
    } else {
        clearPreview('예측을 눌러 결과 확인');
    }
}


let makePreviewWorker=null,makePreviewId=0,makePreviewPending=new Map(),makePreviewIdle=null;
function backgroundMakePreview(request,count,state,paddingRequest=null,paddingCount=null){if(location.protocol==='file:'||typeof Worker!=='function'){const before=wasmMakeGetState();try{if(!wasmMakeSetState(state))throw Error('제작 상태가 올바르지 않습니다');return Promise.resolve(paddingCount!=null?wasmMakePaddedOnce(request,paddingRequest,paddingCount):paddingRequest?wasmMakePaddingPreview(request,paddingRequest,count):wasmMakePreview(request,count));}finally{wasmMakeSetState(before);}}return new Promise((resolve,reject)=>{clearTimeout(makePreviewIdle);try{if(!makePreviewWorker){makePreviewWorker=new Worker(new URL('/vendor/sanbujin/equip/preview-worker.js?v=20261105314&rev=c7c6fbd21c6d',location.href));makePreviewWorker.onmessage=event=>{const m=event.data,p=makePreviewPending.get(m.id);if(!p)return;clearTimeout(p.timer);makePreviewPending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m.result);if(!makePreviewPending.size)makePreviewIdle=setTimeout(()=>{makePreviewWorker?.terminate();makePreviewWorker=null;},30000);};makePreviewWorker.onerror=()=>{for(const p of makePreviewPending.values()){clearTimeout(p.timer);p.reject(Error('\u540e\u53f0\u63a8\u6f14\u672a\u80fd\u52a0\u8f7d\uff0c\u8bf7\u91cd\u8bd5'));}makePreviewPending.clear();makePreviewWorker?.terminate();makePreviewWorker=null;};}const id=++makePreviewId,timer=setTimeout(()=>{makePreviewWorker?.terminate();makePreviewWorker=null;for(const p of makePreviewPending.values()){clearTimeout(p.timer);p.reject(Error('\u63a8\u6f14\u8d85\u65f6\uff0c\u8bf7\u51cf\u5c11\u6b21\u6570\u540e\u91cd\u8bd5'));}makePreviewPending.clear();},60000);makePreviewPending.set(id,{resolve,reject,timer});makePreviewWorker.postMessage({id,request,count,state,paddingRequest,paddingCount});}catch(error){reject(error);}});}
window.addEventListener('pagehide',()=>{makePreviewWorker?.terminate();makePreviewWorker=null;});
function doMakePreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const req = requireCurrentMakeRequest();
    if (!req) return;
    const n = Math.max(1, Math.min(PREVIEW_MAX, Number(document.getElementById('previewCount').value) || 20));
    const meta = document.getElementById('previewMeta');
    const button = document.getElementById('btnPreview');
    const originalLabel = button ? button.textContent : '';
    if (meta) meta.textContent = '예측 중 ' + n + '회…';
    if (button) { button.disabled = true; button.textContent = '예측 중…'; }
    /* 让浏览器先把“推演中”画出来，再开始占用主线程 */
    window.setTimeout(async function () {
        try {
            const snapshot=wasmMakeGetState(),result=await backgroundMakePreview(req,n,snapshot);if(JSON.stringify(wasmMakeGetState())!==JSON.stringify(snapshot)||JSON.stringify(currentMakeRequest())!==JSON.stringify(req)){if(meta)meta.textContent='\u914d\u7f6e\u6216\u5b58\u6863\u5df2\u6539\u53d8\uff0c\u8bf7\u91cd\u65b0\u63a8\u6f14\u3002';return;}renderMakePreview(result);
            updateMakeHints();
        } catch (error) {
            if (meta) meta.textContent = '예측 오류: ' + String(error && error.message || error).slice(0, 60);
        } finally {
            if (button) { button.disabled = false; button.textContent = originalLabel; }
        }
    }, 24);
}

function doSpecialAttachPreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const equipKey = document.getElementById('specialAttachEquipSelect')?.value || '';
    const materialId = document.getElementById('specialAttachMaterialSelect')?.value || '';
    const equip = saveEquips.find(item => runtimeKey(item) === equipKey);
    const material = EQUIP_DATA.special[String(materialId)];
    if (!equip) { alert('연속 망정에 사용할 장비를 선택하세요'); return; }
    if (!material) { alert('반복 적용할 특수 재료를 선택하세요'); return; }
    const count = Number(document.getElementById('specialAttachCount')?.value);
    try {
        if (!Number.isSafeInteger(count) || count < 1 || count > PREVIEW_MAX) {
            throw new RangeError(`예측 횟수는 1~${PREVIEW_MAX}의 정수여야 합니다.`);
        }
        renderSpecialAttachPreview(predictSpecialAttachSequence(equip, material, count));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        clearPreview(`연속 망정 예측 실패: ${message}`);
        alert(`연속 망정 예측 실패: ${message}`);
    }
}

function doMakeOnce() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const req = requireCurrentMakeRequest();
    if (!req) return;
    const r = wasmMakeOnce(req);
    if (r.error) { alert(r.error); return; }
    r.index = 1;
    const mark = getDefaultMakeMark();
    const crafted = addCraftedFromMakeResult(r, mark, req.select_id);
    setMakeAdvanceNotice(r, crafted, 1);
    const markTip = crafted?._mark ? ` · 표시 「${crafted._mark}」` : '';
    const bagTip = crafted
        ? ` · 시뮬레이션 가방에 추가됨(#${crafted.only_id})${markTip}`
        : '';
    appendLog(`[제작] ${EQUIP_DATA.equipment?.[r.equip_id || r.id]?.koName || window.SBJ_KOREAN?.translate?.(r.name) || r.name} · ${COLOR_NAMES[r.color] || r.color} · ${r.pity ? '천장' : r.seed_kind === 'lucky' ? '행운' : '일반'}${bagTip}`);
    fillEquipSelects();
    updateMakeHints();
    doMakePreview();
}

function doMakeAdvanceTo(targetIndex, mark) {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const req = requireCurrentMakeRequest();
    if (!req) return;
    const autoShenglianCheckbox = document.getElementById('makeAutoShenglian');
    const autoShenglian = autoShenglianCheckbox?.checked === true && !autoShenglianCheckbox.disabled;
    const n = Math.floor(Number(targetIndex));
    if (!(n >= 1 && n <= PREVIEW_MAX)) {
        alert(`대상 순서 번호가 올바르지 않습니다(1~${PREVIEW_MAX}).`);
        return;
    }
    let last = null;
    for (let i = 1; i <= n; i++) {
        const r = wasmMakeOnce(req);
        if (r.error) {
            alert(`${i}번째까지 진행 실패: ${r.error}`);
            updateMakeHints();
            return;
        }
        r.index = i;
        last = r;
    }
    const crafted = addCraftedFromMakeResult(last, mark != null ? mark : getDefaultMakeMark(), req.select_id);
    setMakeAdvanceNotice(last, crafted, n);
    const markTip = crafted?._mark ? ` · 표시 「${crafted._mark}」` : '';
    let shenglianTip = '';
    if (autoShenglian && crafted) {
        const result = applyShengLian(runtimeKey(crafted));
        if (result.error) {
            shenglianTip = ` · 자동 승련 실패: ${result.error}`;
            alert(`장비를 제작해 시뮬레이션 가방에 추가했으나 자동 승련에 실패했습니다: ${result.error}`);
        } else {
            shenglianTip = ` · 자동 승련 완료 ${result.from} → ${result.to}`;
            renderCraftedBagList();
        }
    }
    appendLog(`[제작·${n}회까지 진행] ${last.name} · ${COLOR_NAMES[last.color] || last.color} · ${last.pity ? '천장' : last.seed_kind === 'lucky' ? '천장 순서' : '일반'} · 가방 등록 #${crafted?.only_id || '?'}${markTip}${shenglianTip}`);
    fillEquipSelects();
    updateMakeHints();
    doMakePreview();
}

function doShengLianOnce() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const sel = document.getElementById('shenglianEquipSelect');
    const key = sel?.value;
    if (!key) { alert('승련할 수 있는 장비를 선택하세요.'); return; }
    const result = applyShengLian(key);
    if (result.error) { alert(result.error); return; }
    const markTip = result.equip?._mark ? ` · 표시 「${result.equip._mark}」` : '';
    appendLog(`[승련] ${result.from} → ${result.to}${markTip}`);
    fillEquipSelects();
    renderCraftedBagList();
    if (sel) sel.value = '';
    updateShenglianHint();
    if (result.equip && canXilian(result.equip)) {
        const xl = document.getElementById('xilianEquipSelect');
        const src = document.getElementById('xilianSourceFilter');
        if (result.equip._crafted && src) {
            src.value = 'crafted';
            fillEquipSelects(false);
        }
        if (xl) {
            const nk = runtimeKey(result.equip);
            if ([...xl.options].some(o => o.value === nk)) xl.value = nk;
        }
        clearPreview(`승련 완료: ${result.to}. 이제 정련 화면에서 선택할 수 있습니다.`);
    } else {
        clearPreview(`승련 완료: ${result.to}`);
    }
}

function doXilianPreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const key = document.getElementById('xilianEquipSelect').value;
    const eq = getRuntimeEquip(key);
    if (!eq) { alert('장비를 선택하세요'); return; }
    const n = Math.max(1, Math.min(XILIAN_MAX, Number(document.getElementById('xilianCount').value) || 20));
    renderXilianPreview(n);
    updateXilianHint();
}

function doStrongPreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const key = document.getElementById('strongEquipSelect').value;
    const eq = getRuntimeEquip(key);
    if (!eq) { alert('장비를 선택하세요'); return; }
    const preview = strongPreviewEquip(eq);
    fillStrongTargetLevels(preview);
    if (Number(preview.level) >= 15) {
        clearPreview('이미 +15까지 촉련되어 이후 결과가 없습니다. 다시 예측하려면 「유화정 사용 후 0단계부터 예측」을 선택하세요');
        updateStrongHint();
        return;
    }
    const n = Math.max(5, Math.min(PREVIEW_MAX, Number(document.getElementById('strongCount').value) || 200));
    const resp = wasmStrongPreview(toWasmEquip(preview), n);
    if (isStrongResetOrigin() && resp && !resp.error) {
        resp.resetOrigin = true;
        resp.originLevel = Number(eq.level) || 0;
    }
    renderStrongPreview(resp, preview);
    updateStrongHint();
}

function clearPreview(msg) {
    const body = document.getElementById('previewBody');
    const meta = document.getElementById('previewMeta');
    const head = document.getElementById('previewHead');
    if (head) head.innerHTML = '';
    if (meta) meta.textContent = '';
    if (body) {
        body.innerHTML = `<tr><td class="empty-row">${escapeHtml(msg || '예측을 눌러 결과 확인')}</td></tr>`;
    }
    const advice = document.getElementById('strongAdvice');
    if (advice) advice.innerHTML = '';
    const xlFilter = document.getElementById('xilianFilterBar');
    if (xlFilter) xlFilter.hidden = true;
    const makeFilter = document.getElementById('makeFilterBar');
    if (makeFilter) makeFilter.hidden = true;
    xilianPlanItems = [];
    tablePager.makeAllItems = [];
    tablePager.makeItems = [];
    tablePager.jianwangCyclePages = [];
    strongPlanCache = null;
    hidePreviewPager();
}

function resetAll() {
    window.OrangeForgeUI?.invalidate();
    const clearCrafted = document.getElementById('resetClearCrafted')?.checked !== false;
    const craftedEquips = clearCrafted
        ? []
        : JSON.parse(JSON.stringify(saveEquips.filter(e => e._crafted)));
    const craftedRuntime = {};
    if (!clearCrafted) {
        for (const eq of craftedEquips) {
            const key = runtimeKey(eq);
            if (equipRuntime[key]) craftedRuntime[key] = JSON.parse(JSON.stringify(equipRuntime[key]));
        }
    }
    if (makeRndSnapshot) wasmMakeSetState(makeRndSnapshot);
    saveEquips = JSON.parse(JSON.stringify(saveEquipsSnapshot));
    equipRuntime = JSON.parse(JSON.stringify(equipRuntimeSnapshot));
    jianwangReforgeCounts = { ...jianwangReforgeCountsSnapshot };
    jianwangRedSeed = jianwangRedSeedSnapshot;
    if (clearCrafted) {
        alignCraftedSeqToEquips();
    } else {
        saveEquips.push(...craftedEquips);
        Object.assign(equipRuntime, craftedRuntime);
    }
    resetXilianSession();
    strongPlanCache = null;
    fillEquipSelects();
    renderCraftedBagList();
    clearMakeAdvanceNotice();
    clearPreview(clearCrafted
        ? '초기화되어 시뮬레이션 가방이 비워졌습니다. 다시 예측을 실행하세요.'
        : `초기화했습니다. 모의 가방의 장비 ${craftedEquips.length}개는 유지됩니다. 예측을 다시 실행하세요.`);
    updateMakeHints();
    updateXilianHint();
    updateStrongHint();
    updateShenglianHint();
    updateCraftedBagHint();
    updateJianwangCycleHint();
    appendLog(clearCrafted
        ? '— 세이브를 불러온 시점으로 초기화(시뮬레이션 가방 삭제, 승련·정련·촉련·검왕각 진행도 되돌림) —'
        : `— 세이브 불러온 시점으로 초기화(모의 가방 장비 ${craftedEquips.length}개와 육성 상태는 유지하고 나머지 시뮬레이션은 초기화) —`);
}

function doJianwangCyclePreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const equipKey = document.getElementById('jianwangEquipSelect')?.value || '';
    const base = saveEquips.find(item => runtimeKey(item) === equipKey);
    const equip = base ? (getRuntimeEquip(equipKey) || base) : null;
    try {
        if (!equip || !isJianwangSword(equip)) {
            throw new TypeError('검왕각 실물 장비 5707~5717을 선택하세요.');
        }
        if (!validJianwangRedSeed(jianwangRedSeed)) {
            throw new TypeError('세이브에 검 배아 진행도가 없습니다. 세이브를 다시 불러오세요.');
        }
        const count = Number(document.getElementById('jianwangCycleCount')?.value);
        const routeId = Number(document.getElementById('jianwangCycleRouteSelect')?.value || 0);
        renderJianwangCyclePreview(predictJianwangShatterCycle(
            equip,
            jianwangRedSeed,
            count,
            currentJianwangRule(),
            routeId || null,
        ));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        clearPreview(`검 분해 미리보기 실패: ${message}`);
        alert(`검 분해 미리보기 실패: ${message}`);
    }
}

function doJianwangPreview() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const equipKey = document.getElementById('jianwangEquipSelect')?.value || '';
    const action = document.getElementById('jianwangActionSelect')?.value || '';
    const materialId = document.getElementById('jianwangMaterialSelect')?.value || '';
    const base = saveEquips.find(item => runtimeKey(item) === equipKey);
    const equip = base ? (getRuntimeEquip(equipKey) || base) : null;
    const material = EQUIP_DATA.special[String(materialId)];
    if (!equip || !action) {
        alert('세이브의 검왕각 검 배아 또는 전용 무기를 선택하세요.');
        return;
    }
    try {
        const count = Number(document.getElementById('jianwangCount')?.value);
        if (!Number.isSafeInteger(count) || count < 1 || count > PREVIEW_MAX) {
            throw new RangeError(`예측 횟수는 1~${PREVIEW_MAX}의 정수여야 합니다.`);
        }
        if (action === 'mangjing') {
            if (!canPredictJianwangMangjing(equip)) {
                throw new TypeError('선택한 100레벨 무기의 망정 진행 정보가 없거나 특수 옵션이 이미 주조됐습니다.');
            }
            if (!material) throw new TypeError('게임에서 실제로 주조한 특수 재료를 선택하세요.');
            renderJianwangPreview(predictSpecialAttachSequence(equip, material, count), 'mangjing');
            return;
        }
        if (action === JIANWANG_SHATTER_90 || action === JIANWANG_SHATTER_100) {
            renderJianwangPreview([predictJianwangShatterRebuild(equip, action, jianwangRedSeed)], 'shatter');
            return;
        }
        const keepIndex = Number(document.getElementById('jianwangKeepSelect')?.value || 0);
        const rows = predictJianwangStateSequence(
            equip,
            action,
            count,
            keepIndex,
            Number(jianwangReforgeCounts[String(Number(equip.id))]) || 0,
        );
        renderJianwangPreview(rows, 'state');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        clearPreview(`검왕각 전용 무기 순서 예측 실패: ${message}`);
        alert(`검왕각 전용 무기 순서 예측 실패: ${message}`);
    }
}

function doJianwangApplyOnce() {
    if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
    const equipKey = document.getElementById('jianwangEquipSelect')?.value || '';
    const action = document.getElementById('jianwangActionSelect')?.value || '';
    const base = saveEquips.find(item => runtimeKey(item) === equipKey);
    const equip = base ? (getRuntimeEquip(equipKey) || base) : null;
    if (!equip || !action) { alert('세이브의 검왕각 검 배아 또는 전용 무기를 선택하세요.'); return; }
    if (action === 'mangjing') {
        const materialId = document.getElementById('jianwangMaterialSelect')?.value || '';
        const material = EQUIP_DATA.special[String(materialId)];
        const count = Math.max(1, Math.min(PREVIEW_MAX, Number(document.getElementById('jianwangCount')?.value) || 10));
        try {
            if (!canPredictJianwangMangjing(equip)) {
                throw new TypeError('선택한 100레벨 무기의 망정 진행 정보가 없거나 특수 옵션이 이미 주조됐습니다.');
            }
            if (!material) throw new TypeError('게임에서 실제로 주조한 특수 재료를 선택하세요.');
            renderJianwangPreview(predictSpecialAttachSequence(equip, material, count), 'mangjing');
            appendLog('[검왕각 · 망정] ' + equip.name + ' · ' + material.name + ' × ' + count + '회(조회 전용, 게임 내 망정 진행도에 영향 없음)');
            updateJianwangHint();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            clearPreview('망정 미리보기 실패:' + message);
            alert('망정 미리보기 실패:' + message);
        }
        return;
    }
    try {
        if (action === JIANWANG_SHATTER_90 || action === JIANWANG_SHATTER_100) {
            const result = predictJianwangShatterRebuild(equip, action, jianwangRedSeed);
            setRuntimeEquip(equipKey, result.equip);
            jianwangRedSeed = result.redSeedAfter;
            jianwangReforgeCounts[String(result.routeId)] = 0;
            appendLog(`[검왕각 · ${result.shatterLabel}] ${result.fromName} → ${result.toName} · 이번 예측의 검 배아 순서 진행 완료`);
            fillJianwangEquipSelect(true);
            renderJianwangPreview([result], 'shatter');
            updateJianwangHint();
            updateJianwangCycleHint();
            return;
        }
        const keepIndex = Number(document.getElementById('jianwangKeepSelect')?.value || 0);
        const rows = predictJianwangStateSequence(
            equip,
            action,
            1,
            keepIndex,
            Number(jianwangReforgeCounts[String(Number(equip.id))]) || 0,
        );
        const result = rows[0];
        setRuntimeEquip(equipKey, result.equip);
        if (action === 'reforge') {
            const idKey = String(Number(equip.id));
            jianwangReforgeCounts[idKey] = (Number(jianwangReforgeCounts[idKey]) || 0) + 1;
        }
        appendLog(`[검왕각·${action === 'reforge' ? '재주조' : (action.startsWith('ascend:') ? '신병' : '성장')}] ${result.fromName} → ${result.toName} · 이번 시뮬레이션의 재주조 순서를 진행했습니다.`);
        fillJianwangEquipSelect(true);
        renderJianwangPreview(rows, 'state');
        updateJianwangHint();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        alert(`검왕각 전용 무기 진행 실패: ${message}`);
    }
}

async function initApp() {
    restoreMakeRegionFilter();
    restoreMakeAutoShenglian();
    if (typeof markNavTransition === 'function') {
        document.querySelectorAll('header a[href*=".html"]').forEach(a => {
            a.addEventListener('click', () => markNavTransition());
        });
    }

    const ok = await initWasm();
    if (!ok) { alert('장비 데이터를 불러오지 못해 현재 예측할 수 없습니다. 세이브 불러오기는 가능합니다. 새로고침 후 다시 시도하세요.'); return; }
    if (!wasmMakeInitTables(EQUIP_DATA)) { alert('장비 데이터 적용 실패'); return; }

    if (typeof loadShareStore === 'function') {
        const shared = loadShareStore();
        if (shared && shared.data) {
            try {
                saveMeta = {
                    version: (shared.meta && shared.meta.version) || '',
                    channel: (shared.meta && shared.meta.channel) || '',
                    platform: (shared.meta && shared.meta.platform) || '',
                    columns: (shared.meta && shared.meta.columns) || null,
                    row: (shared.meta && shared.meta.row) || null,
                };
                loadSaveData(shared.data);
            } catch (e) {
                console.warn('공유 세이브 자동 불러오기 실패:', e);
            }
        }
    }

    fillNpcSelect();
    fillPaperSelect();
    renderCraftedBagList();

    document.getElementById('tabBar').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (btn) switchTab(btn.dataset.tab);
    });

    /* P1：记住上一次的打造配置（地点/图纸/材料/次数），下次自动恢复 */
    var EQUIP_MEMORY_KEY = 'yyjh_equip_make_memory_v1';
    function saveMakeMemory() {
        try {
            localStorage.setItem(EQUIP_MEMORY_KEY, JSON.stringify({
                npc: document.getElementById('npcSelect').value,
                paper: document.getElementById('paperSelect').value,
                material: document.getElementById('specialSelect') ? document.getElementById('specialSelect').value : '',
                count: document.getElementById('previewCount') ? document.getElementById('previewCount').value : ''
            }));
        } catch (e) { }
    }
    function restoreMakeMemory() {
        try {
            var raw = localStorage.getItem(EQUIP_MEMORY_KEY);
            if (!raw) return;
            var mem = JSON.parse(raw);
            if (mem.npc && Array.from(document.getElementById('npcSelect').options).some(function (o) { return o.value === mem.npc; })) {
                document.getElementById('npcSelect').value = mem.npc;
                fillPaperSelect();
            }
            if (mem.paper && Array.from(document.getElementById('paperSelect').options).some(function (o) { return o.value === mem.paper; })) {
                document.getElementById('paperSelect').value = mem.paper;
                fillSpecialSelect();
            }
            if (mem.material && document.getElementById('specialSelect')) {
                var s = document.getElementById('specialSelect');
                if (Array.from(s.options).some(function (o) { return o.value === mem.material; })) s.value = mem.material;
            }
            if (mem.count && document.getElementById('previewCount')) document.getElementById('previewCount').value = mem.count;
            updateMakeHints();
        } catch (e) { }
    }
    restoreMakeMemory();
    ['npcSelect', 'paperSelect', 'specialSelect', 'previewCount'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', saveMakeMemory);
    });
    document.getElementById('npcSelect').addEventListener('change', () => {
        const filter = document.getElementById('paperFilter');
        if (filter) filter.value = '';
        fillPaperSelect();
        clearPreview('대상이 변경됐습니다. ‘순서 예측’을 다시 누르세요.');
    });
    document.getElementById('paperFilter')?.addEventListener('input', fillPaperSelect);
    document.getElementById('paperSelect').addEventListener('change', () => {
        fillSpecialSelect();
        updateMakeHints();
        clearPreview('대상이 변경됐습니다. ‘순서 예측’을 다시 누르세요.');
    });
    document.getElementById('specialSelect').addEventListener('change', () => {
        updateMakeHints();
        clearPreview('재료가 변경됐습니다. ‘순서 예측’을 다시 누르세요.');
    });
    document.getElementById('specialAttachEquipSelect')?.addEventListener('change', () => {
        fillSpecialAttachMaterialSelect(false);
        updateSpecialAttachHint();
        clearPreview('대상 장비가 변경됐습니다. ‘연속 망정 예측’을 다시 누르세요.');
    });
    document.getElementById('specialAttachMaterialSelect')?.addEventListener('change', () => {
        updateSpecialAttachHint();
        clearPreview('추가 재료가 변경됐습니다. ‘연속 망정 예측’을 다시 누르세요.');
    });
    document.getElementById('btnJianwangCyclePreview')?.addEventListener('click', doJianwangCyclePreview);
    document.getElementById('jianwangCycleCount')?.addEventListener('change', () => {
        clearPreview('반복 횟수가 변경됐습니다. 검 분해 미리보기를 다시 실행하세요.');
    });
    document.getElementById('jianwangCycleRouteSelect')?.addEventListener('change', () => {
        updateJianwangCycleHint();
        clearPreview('90레벨 경로가 변경됐습니다. 검 분해 미리보기를 다시 실행하세요.');
    });
    document.getElementById('jianwangEquipSelect')?.addEventListener('change', () => {
        fillJianwangActionSelect(false);
        fillJianwangCycleRouteSelect(false);
        updateJianwangHint();
        updateJianwangCycleHint();
        clearPreview('세이브 실물 장비가 변경됐습니다. ‘현재 경로 미리보기’를 다시 누르세요.');
    });
    document.getElementById('jianwangActionSelect')?.addEventListener('change', () => {
        fillJianwangKeepSelect(false);
        fillJianwangMaterialSelect(false);
        updateJianwangControls();
        updateJianwangHint();
        clearPreview('진행 경로가 변경됐습니다. ‘현재 경로 미리보기’를 다시 누르세요.');
    });
    document.getElementById('jianwangKeepSelect')?.addEventListener('change', () => {
        updateJianwangHint();
        clearPreview('보존 슬롯이 변경됐습니다. 미리보기를 다시 실행하세요.');
    });
    document.getElementById('jianwangMaterialSelect')?.addEventListener('change', () => {
        updateJianwangHint();
        clearPreview('주조 재료가 변경됐습니다. ‘전용 무기 순서 보기’를 다시 누르세요.');
    });
    document.getElementById('xilianEquipSelect').addEventListener('change', () => {
        resetXilianSession();
        updateXilianHint();
        clearPreview('장비가 변경됐습니다. ‘순서 예측’을 다시 누르세요.');
    });
    document.getElementById('strongEquipSelect').addEventListener('change', () => {
        strongPlanCache = null;
        updateStrongHint();
        clearPreview('장비가 변경됐습니다. ‘예측 및 추천 생성’을 다시 누르세요.');
    });
    document.getElementById('strongResetOrigin')?.addEventListener('change', () => {
        strongPlanCache = null;
        updateStrongHint();
        clearPreview(isStrongResetOrigin()
            ? '유화정 시뮬레이션으로 전환했습니다. 촉련 0단계부터 계산하므로 ‘예측 및 추천 생성’을 누르세요.'
            : '유화정 시뮬레이션을 종료했습니다. 현재 촉련 단계부터 계산합니다.');
    });
    document.getElementById('shenglianEquipSelect')?.addEventListener('change', () => {
        updateShenglianHint();
    });
    const onEquipFilterChange = () => fillEquipSelects(true);
    document.getElementById('xilianSourceFilter')?.addEventListener('change', onEquipFilterChange);
    document.getElementById('strongSourceFilter')?.addEventListener('change', onEquipFilterChange);
    document.getElementById('shenglianSourceFilter')?.addEventListener('change', onEquipFilterChange);
    document.getElementById('xilianTextFilter')?.addEventListener('input', onEquipFilterChange);
    document.getElementById('strongTextFilter')?.addEventListener('input', onEquipFilterChange);
    document.getElementById('shenglianTextFilter')?.addEventListener('input', onEquipFilterChange);
    document.getElementById('strongMinGrade')?.addEventListener('change', () => {
        clearPreview('조건이 변경됐습니다. ‘예측 및 추천 생성’을 다시 누르세요.');
        updateStrongHint();
    });
    document.getElementById('strongTargetLevel')?.addEventListener('change', () => {
        clearPreview('목표 단계가 변경됐습니다. ‘예측 및 추천 생성’을 다시 누르세요.');
        updateStrongHint();
    });

    document.getElementById('btnPreview').addEventListener('click', doMakePreview);
    document.getElementById('btnSpecialAttachPreview')?.addEventListener('click', doSpecialAttachPreview);
    document.getElementById('btnJianwangPreview')?.addEventListener('click', doJianwangPreview);
    document.getElementById('btnJianwangApply')?.addEventListener('click', doJianwangApplyOnce);
    document.getElementById('btnMakeOnce').addEventListener('click', doMakeOnce);

    document.getElementById('previewBody')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-make-advance');
        if (!btn || tablePager.mode !== 'make') return;
        const idx = Number(btn.dataset.index);
        const row = btn.closest('tr');
        const mark = row?.querySelector('.make-row-mark')?.value ?? getDefaultMakeMark();
        const autoShenglianCheckbox = document.getElementById('makeAutoShenglian');
        const autoShenglian = autoShenglianCheckbox?.checked === true && !autoShenglianCheckbox.disabled;
        const autoTip = autoShenglian ? '\n목표 장비가 가방에 들어가면 100레벨로 자동 승련합니다.' : '';
        if (!confirm(`연속으로 ${idx}회 제작을 진행하고 ${idx}번째 장비를 모의 가방에 넣으시겠습니까?\n(중간 제작 결과는 이번 시뮬레이션에서만 진행하고 가방에 넣지 않습니다.)${autoTip}`)) return;
        doMakeAdvanceTo(idx, mark);
    });

    document.getElementById('craftedBagList')?.addEventListener('change', (e) => {
        const input = e.target.closest('.crafted-mark-input');
        if (!input) return;
        const row = input.closest('[data-only-id]');
        const onlyId = Number(row?.dataset.onlyId);
        if (onlyId) setCraftedMark(onlyId, input.value);
    });
    document.getElementById('craftedBagList')?.addEventListener('click', (e) => {
        const favBtn = e.target.closest('[data-act="fav"]');
        if (favBtn) {
            const row = favBtn.closest('[data-only-id]');
            const onlyId = Number(row?.dataset.onlyId);
            if (!onlyId) return;
            const eq = saveEquips.find(item => Number(item.only_id) === onlyId);
            if (!eq) return;
            const current = equipRuntime[runtimeKey(eq)] || eq;
            const added = EquipFavorites.toggle(equipFavoritesArchiveId(), {
                onlyId,
                name: eq.name,
                needLv: eq.need_lv,
                color: eq.color,
                colorText: String(COLOR_NAMES[eq.color] || eq.color),
                typ: eq.typ,
                typText: String(TYPE_NAMES[eq.typ] || eq.typ),
                propsText: favPropsText(current),
                refineable: canXilian(current),
            });
            const faved = EquipFavorites.has(equipFavoritesArchiveId(), onlyId);
            document.querySelectorAll(`#craftedBagList [data-only-id="${onlyId}"] [data-act="fav"]`).forEach(btn => {
                btn.textContent = faved ? '★ 즐겨찾기 완료' : '☆ 즐겨찾기';
                btn.classList.toggle('is-faved', faved);
            });
            renderFavList();
            void added;
            return;
        }
        const btn = e.target.closest('[data-act="remove"]');
        if (!btn) return;
        const row = btn.closest('[data-only-id]');
        const onlyId = Number(row?.dataset.onlyId);
        if (!onlyId) return;
        if (!confirm('이 제작 장비를 시뮬레이션 가방에서 제거할까요?')) return;
        removeCraftedEquip(onlyId);
    });
    bindEquipFavorites();
    document.getElementById('btnShenglianOnce')?.addEventListener('click', doShengLianOnce);
    document.getElementById('btnXilianPreview').addEventListener('click', doXilianPreview);
    document.getElementById('btnXilianOptimize')?.addEventListener('click', optimizeXilianPlan);
    document.getElementById('xilianTargetProp')?.addEventListener('change', () => {
        if (!xilianAutoPlan) return;
        xilianAutoPlan = null;
        refreshXilianPlan();
    });
    document.getElementById('btnStrongPreview').addEventListener('click', doStrongPreview);
    document.getElementById('btnStrongShowMin')?.addEventListener('click', () => highlightStrongPlan('min'));
    document.getElementById('btnStrongShowBest')?.addEventListener('click', () => highlightStrongPlan('best'));
    document.getElementById('xilianFilterSlot')?.addEventListener('change', () => {
        if (xilianPlanItems.length) renderXilianRows(xilianPlanItems, xilianAcceptFlags, true);
    });
    document.getElementById('xilianFilterProp')?.addEventListener('change', () => {
        if (xilianPlanItems.length) renderXilianRows(xilianPlanItems, xilianAcceptFlags, true);
    });
    const onMakeFilterChange = () => {
        if ((tablePager.makeAllItems || []).length) applyMakeFilter(true);
    };
    document.getElementById('makeFilterColor')?.addEventListener('change', onMakeFilterChange);
    document.getElementById('makeFilterSeed')?.addEventListener('change', onMakeFilterChange);
    document.getElementById('makeFilterProp')?.addEventListener('change', onMakeFilterChange);
    document.getElementById('makeFilterRegion')?.addEventListener('change', () => {
        persistMakeRegionFilter();
        onMakeFilterChange();
    });
    document.getElementById('makeAutoShenglian')?.addEventListener('change', persistMakeAutoShenglian);
    document.getElementById('btnResetAll')?.addEventListener('click', () => {
        if (!saveLoaded) { alert('먼저 세이브를 불러오세요'); return; }
        resetAll();
    });
    document.getElementById('btnPreviewPrev')?.addEventListener('click', () => {
        if (tablePager.page > 1) {
            tablePager.page -= 1;
            renderCurrentPreviewPage();
        }
    });
    document.getElementById('btnPreviewNext')?.addEventListener('click', () => {
        tablePager.page += 1;
        renderCurrentPreviewPage();
    });
    document.getElementById('previewPageSize')?.addEventListener('change', () => {
        tablePager.page = 1;
        renderCurrentPreviewPage();
    });
    document.getElementById('btnLogPrev')?.addEventListener('click', () => {
        if (logPage > 1) {
            logPage -= 1;
            renderLogPage();
        }
    });
    document.getElementById('btnLogNext')?.addEventListener('click', () => {
        logPage += 1;
        renderLogPage();
    });
    document.getElementById('btnClearLog').addEventListener('click', () => {
        logLines = [];
        logPage = 1;
        renderLogPage();
    });
    if(window.SBJ_FEATURE_TAB)switchTab(window.SBJ_FEATURE_TAB);
}

document.addEventListener('DOMContentLoaded', initApp);

/* 深链：?tab=strong 打开淬炼并按默认设置出结果 */
document.addEventListener('DOMContentLoaded', function () {
    try {
        var params = new URLSearchParams(location.search);
        var tab = window.SBJ_FEATURE_TAB || params.get('tab');
        if (!tab) return;
        var btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]');
        if (!btn) return;
        setTimeout(function () { try { btn.click(); } catch (e) { } }, 300);
        if (tab !== 'strong') return;
        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            var sel = document.getElementById('strongEquipSelect');
            var ready = false;
            try { ready = typeof saveLoaded !== 'undefined' && saveLoaded && sel && sel.options.length > 0; } catch (e) { ready = false; }
            if (ready) {
                clearInterval(timer);
                try {
                    if (!sel.value) sel.value = sel.options[0].value;
                    var preview = document.getElementById('btnStrongPreview');
                    if (preview) preview.click();
                } catch (e) { }
            } else if (tries > 40) {
                clearInterval(timer);
            }
        }, 300);
    } catch (e) { }
});

setTimeout(function () { if (typeof prewarmSql === 'function') prewarmSql(); }, 200);
