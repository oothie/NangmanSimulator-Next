function playerError(error) { return window.SBJErrors ? SBJErrors.message(error) : (error?.message || String(error)); }
var state = {
    mode: 'seed',
    zizhi: 153,
    sex: 1,
    vip: 1,
    vipConfirmed: false,
    seed: 2000548318,
    luckSeed: 0,
    luckSeedInited: false,
    roleId: 10044,
    salt: 278440,
    talents: [],
    talLucky: 0,
    dlcMode: false,
    totalWash: 0,
    totalTalentBars: 0,
    totalPills: 0,
    bagPills: 0,
    hasBagPills: false,
    goldCount: 0,
    pityCount: 0,
    qualityCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
    washHistory: [],
    lastPurpleTotalPills: null,
    exchangeCount: 0,
    saveData: null,
    strGift: 0,
    conGift: 0,
    dexGift: 0,
    intGift: 0,
    roleLevel: 90,
    roleRaw: null,
    saveRoles: [],
    roleStats: { str_val: 0, dex: 0, con: 0, int_val: 0 },
    globalVars: {},
};
let manualWashUndo = { entries: [], globals: null };
let manualWashTracking = false;
let manualWashReplaying = false;
let manualWashStepTracking = null;
let manualRoute = {start:null,events:[],mode:null};
function manualRouteState(){return {talents:state.talents.map(t=>({id:Number(t.id),locked:!!t.locked})),slots:Math.max(0,Number(state.zizhi)-150),washes:Number(state.totalWash)||0,pills:Number(state.totalPills)||0,exchangeCount:Number(state.exchangeCount)||0};}
function recordManualRoute(type,before,detail=''){
    if(window.SBJ_FEATURE_PAGE!=='wash-manual'||manualWashReplaying||!before)return;
    const after=manualRouteState();if(!manualRoute.start){manualRoute.start=before;manualRoute.mode=state.mode;}
    const washes=Math.max(0,after.washes-before.washes),pills=Math.max(0,after.pills-before.pills);
    manualRoute.events.push({type,before,after,washes,pills,detail});
    const button=document.getElementById('btnManualRouteImage');if(button)button.disabled=false;
}
function clearManualRoute(){manualRoute={start:null,events:[],mode:null};const button=document.getElementById('btnManualRouteImage');if(button)button.disabled=true;}
async function exportManualRouteImage(){
    const button=document.getElementById('btnManualRouteImage');
    try{if(!manualRoute.events.length)throw Error('请先进行洗脉操作，再导出路线图。');if(!window.WashRouteImage?.buildManualModel)throw Error('路线图片资源尚未加载，请刷新后重试。');
        const roleName=state.roleRaw?.Name||'当前人物',model=WashRouteImage.buildManualModel(manualRoute,{roleName,talentData:TALENT_DATA,vip:state.vip,vipConfirmed:state.vipConfirmed,dlcMode:state.dlcMode});
        button.disabled=true;button.textContent='正在生成…';await WashRouteImage.show(model,{returnFocus:button,autoSave:true});
    }catch(error){alert(error?.message||'路线图生成失败，请重试。')}finally{button.disabled=!manualRoute.events.length;button.textContent='一键导出手动路线图'}
}


function pushStateToWasm() {
    syncStateToWasm(state);
}

function pullStateFromWasm() {
    const bagPills = state.bagPills;
    const hasBagPills = state.hasBagPills;
    syncStateFromWasm(state);
    state.bagPills = bagPills;
    state.hasBagPills = hasBagPills;
}

function computeRoleStats() {
    const role = state.roleRaw;
    if (!role) {
        state.roleStats = { str_val: 0, dex: 0, con: 0, int_val: 0 };
        return;
    }
    const GIFT_COEF = 0.00006;
    function baseAttr(key) {
        const cap = key.charAt(0).toUpperCase() + key.slice(1);
        const raw = Number(role[cap === 'Str' ? 'Str' : cap] || 0);
        const born = Number(role[`Born${cap}`] || 0);
        const gift = Number(role[`${cap}Gift`] || 0);
        return Math.floor((raw + born) * (1.0 + GIFT_COEF * gift));
    }
    state.roleStats = {
        str_val: baseAttr('str'),
        dex: baseAttr('dex'),
        con: baseAttr('con'),
        int_val: baseAttr('int'),
    };
}

function extractGlobalVars() {
    const gv = state.saveData && state.saveData.globalVariable;
    state.globalVars = gv || {};
}

function getZZConfig() {
    const zz = ZZ_DATA[String(state.zizhi)] || ZZ_DATA["153"];
    if (state.dlcMode) return { ...zz, zz_name: zz.zz_name || zz.name, bd_zz: 300 };
    return { ...zz, zz_name: zz.zz_name || zz.name };
}


function _buildZZDataForWasm() {
    if (!state.dlcMode) return ZZ_DATA;
    const out = {};
    for (const k of Object.keys(ZZ_DATA)) {
        out[k] = { ...ZZ_DATA[k], bd_zz: 300 };
    }
    return out;
}

function applyDlcMode(checked) {
    resetManualWashUndo();
    state.dlcMode = !!checked;
    if (typeof wasmInitEngine === 'function') {
        wasmInitEngine(TALENT_DATA, _buildZZDataForWasm());
        if (typeof pushStateToWasm === 'function') pushStateToWasm();
    }
    if (typeof invalidatePurpleCache === 'function') invalidatePurpleCache();
    renderPityBar();
    renderCostInfo();
}

function _applyDlcByPlatform(platform) {
    const isTest = platform === 'test';
    const row = document.getElementById('dlcRow');
    const check = document.getElementById('dlcModeCheck');
    if (row) row.style.display = isTest ? '' : 'none';
    if (check) check.checked = isTest;
    applyDlcMode(isTest);
}

function _dlcLuckyBonus() {
    if (!state.dlcMode) return 0;
    const locked = state.talents.filter(t => t.locked).length;
    return Math.max(1, 3 * locked);
}

function doWash() {
    const zzConfig = getZZConfig();
    if (zzConfig.num_talent === 0) return null;

    const lockedCount = state.talents.filter(t => t.locked).length;
    if (zzConfig.num_talent <= lockedCount) return null;

    const undoPoint = manualWashStepTracking ? (manualWashStepTracking.pending === 0
        ? manualWashStepTracking.first
        : captureManualWashPoint(manualWashStepTracking.baseHistory + manualWashStepTracking.pending, false)) : null;

    const dlcBonus = _dlcLuckyBonus();
    if (dlcBonus > 0) state.talLucky += dlcBonus;

    pushStateToWasm();

    const raw = wasmDoWash();
    if (!raw) return null;

    pullStateFromWasm();

    if (undoPoint) {
        manualWashUndo.entries.push({ before: undoPoint, washed: 1, endTotal: state.totalWash });
        manualWashStepTracking.pending++;
    }

    return convertWashResult(raw);
}

function exchangeTalent(index) {
    const routeBefore=manualRouteState();
    pushStateToWasm();

    const raw = wasmExchangeTalent(index);
    if (!raw) return;

    const result = convertExchangeResult(raw);
    if (!result.success) {
        alert(result.error || '置换失败');
        return;
    }

    pullStateFromWasm();
    recordManualRoute('exchange',routeBefore,`${result.exchangedFrom||'当前脉'} → ${result.exchangedTo||'新脉'}`);
    addLogEntry(result);
    updateAll();
}


function getQualityClass(weight) {
    return `q${weight}`;
}

function isShenmaiTalentData(talent) {
    if (!talent) return false;
    const id = Number(talent.id);
    return id === 248 || id === 249 || id === 250 || Number(talent.type) === 248;
}

function analyzeTalentConflicts() {
    const shenmaiIdxs = [];
    state.talents.forEach((slot, index) => {
        const talent = TALENT_DATA[String(slot.id)];
        if (isShenmaiTalentData(talent)) shenmaiIdxs.push(index);
    });
    const multiShenmai = shenmaiIdxs.length >= 2;

    const seenType = {};
    const conflicts = [];

    state.talents.forEach((slot, index) => {
        const talent = TALENT_DATA[String(slot.id)];
        if (!talent || talent.type == null) {
            conflicts.push(null);
            return;
        }
        const typ = talent.type;

        if (isShenmaiTalentData(talent) && multiShenmai) {
            const partner = shenmaiIdxs.find(i => i !== index) ?? index;
            const partnerTalent = TALENT_DATA[String(state.talents[partner].id)];
            conflicts.push({
                index,
                earlierIndex: partner,
                earlierName: partnerTalent ? partnerTalent.name : '神脉',
                canExchange: true,
                shenmaiMutual: true,
            });
            if (seenType[typ] === undefined) seenType[typ] = index;
            return;
        }

        if (seenType[typ] !== undefined) {
            const earlier = seenType[typ];
            const earlierTalent = TALENT_DATA[String(state.talents[earlier].id)];
            const isPurple = (talent.weight >= 4 || talent.pinzhi >= 4);
            const earlierIsPurple = earlierTalent
                ? (earlierTalent.weight >= 4 || earlierTalent.pinzhi >= 4)
                : false;
            const earlierLocked = !!state.talents[earlier]?.locked;
            const canExchange = isPurple
                && (isShenmaiTalentData(talent) || (!earlierIsPurple && earlierLocked));
            conflicts.push({
                index,
                earlierIndex: earlier,
                earlierName: earlierTalent ? earlierTalent.name : '未知',
                canExchange,
                shenmaiMutual: false,
            });
        } else {
            seenType[typ] = index;
            conflicts.push(null);
        }
    });
    return conflicts;
}

function renderTalents() {
    const container = document.getElementById('talentSlots');
    const zzConfig = getZZConfig();
    const maxSlots = zzConfig.num_talent;

    if (maxSlots === 0) {
        container.innerHTML = '<div class="talent-card empty"><span style="color:var(--text-muted)">此资质无天赋槽位</span></div>';
        return;
    }

    const shown = state.talents.slice(0, maxSlots);
    const conflicts = analyzeTalentConflicts();
    let html = '';

    for (let i = 0; i < shown.length; i++) {
        const t = shown[i];
        const talent = TALENT_DATA[String(t.id)];
        const qClass = talent ? getQualityClass(talent.weight) : 'q1';
        const lockedClass = t.locked ? 'locked' : '';
        const lockBtnClass = t.locked ? 'locked' : '';
        const lockText = t.locked ? '已锁定' : '锁定';
        const name = talent ? talent.name : '未知天赋';
        const desc = talent ? talent.desc : '数据表中无此天赋';
        const conflict = conflicts[i];
        const conflictClass = conflict ? ' conflict' : '';

        let conflictHtml = '';
        if (conflict) {
            conflictHtml = conflict.shenmaiMutual
                ? `<span class="talent-conflict" title="多神脉互冲：槽内每条神脉都可置换">互冲 · 另有${conflict.earlierName}</span>`
                : `<span class="talent-conflict" title="与「${conflict.earlierName}」同类型，本条不生效">冲突 · 前有${conflict.earlierName}</span>`;
        }

        let exchangeBtn = '';
        if (conflict && conflict.canExchange && state.mode === 'seed') {
            exchangeBtn = `<button class="talent-exchange-btn" type="button" onclick="exchangeTalent(${i})">置换</button>`;
        }

        html += `
            <div class="talent-card ${qClass} ${lockedClass}${conflictClass} animate-in" style="animation-delay: ${i * 0.08}s">
                <div class="talent-main">
                    <span class="talent-name ${qClass}">${name}${conflict ? '<i class="talent-bang">!</i>' : ''}</span>
                    ${conflictHtml}
                    <span class="talent-desc">${desc}</span>
                </div>
                <div class="talent-actions">
                    ${exchangeBtn}
                    <button class="talent-lock-btn ${lockBtnClass}" type="button" onclick="toggleLock(${i})">${lockText}</button>
                </div>
            </div>
        `;
    }

    for (let i = shown.length; i < maxSlots; i++) {
        html += '<div class="talent-card empty">空槽位</div>';
    }

    container.innerHTML = html;
}

function renderAptitudePanel() {
    document.getElementById('zzStr').textContent = state.strGift.toLocaleString();
    document.getElementById('zzCon').textContent = state.conGift.toLocaleString();
    document.getElementById('zzDex').textContent = state.dexGift.toLocaleString();
    document.getElementById('zzInt').textContent = state.intGift.toLocaleString();

    const total = state.strGift + state.conGift + state.dexGift + state.intGift;
    document.getElementById('zzTotal').textContent = total.toLocaleString();

    const upgradeBtn = document.getElementById('btnUpgradeZiZhi');
    const zzConfig = getZZConfig();
    
    if (state.zizhi >= 154) {
        upgradeBtn.textContent = '资质已满';
        upgradeBtn.disabled = true;
    } else {
        const nextId = state.zizhi + 1;
        const nextConfig = ZZ_DATA[String(nextId)] || { num_talent: 4 };
        upgradeBtn.textContent = `提升资质（${nextConfig.num_talent} 槽）`;
        upgradeBtn.disabled = false;
    }
}

function renderStats() {
    document.getElementById('statTotalWash').textContent = state.totalWash.toLocaleString();
    document.getElementById('statTotalPills').textContent = state.totalPills.toLocaleString();
    document.getElementById('statGoldCount').textContent = state.goldCount.toLocaleString();
    document.getElementById('statPityCount').textContent = state.pityCount.toLocaleString();

    const totalTalents = Object.values(state.qualityCounts).reduce((a, b) => a + b, 0);
    for (let q = 1; q <= 4; q++) {
        const count = state.qualityCounts[q] || 0;
        const pct = totalTalents > 0 ? (count / totalTalents * 100) : 0;
        document.getElementById(`barQ${q}`).style.width = `${pct}%`;
        document.getElementById(`countQ${q}`).textContent = `${count} (${pct.toFixed(1)}%)`;
    }

    if (state.mode === 'seed') {
        document.getElementById('seedInput').value = state.seed;
    }

    if (state.hasBagPills) {
        document.getElementById('bagPillDisplay').textContent = `${state.bagPills.toLocaleString()} 颗`;
        const autoPills = document.getElementById('autoWashBagPillDisplay');
        if (autoPills) autoPills.textContent = `${state.bagPills.toLocaleString()} 颗`;
    }
}

function renderPityBar() {
    const zzConfig = getZZConfig();
    const threshold = zzConfig.bd_zz;
    const pct = threshold > 0 ? Math.min(100, state.talLucky / threshold * 100) : 0;
    
    document.getElementById('pityFill').style.width = `${pct}%`;
    document.getElementById('pityText').textContent = `${state.talLucky} / ${threshold}`;
}

function renderCostInfo() {
    const zzConfig = getZZConfig();
    const lockedCount = state.talents.filter(t => t.locked).length;
    let eatCount = zzConfig.eat_xisui;
    if (lockedCount > 0) {
        eatCount = eatCount + 2 * lockedCount - 1;
    }
    let text = `当前资质：${zzConfig.zz_name || zzConfig.name}（${zzConfig.num_talent} 槽） · 每次消耗洗髓丹 ×${eatCount}`;
    if (lockedCount > 0) {
        text += `（锁定加价 ${lockedCount}）`;
    }
    document.getElementById('costInfo').textContent = text;
}

let historyPage = 1;

function getHistoryPageSize() {
    return Number(document.getElementById('historyPageSize')?.value) || 50;
}

function recordWash(result) {
    const names = [];
    const ids = [];
    for (const t of result.talents) {
        ids.push(Number(t.id));
        const talent = TALENT_DATA[String(t.id)];
        names.push(talent ? talent.name : '未知');
    }
    state.washHistory.push({
        ...result,
        talentIds: ids,
        talentNames: names,
    });
}

function buildLogEntryEl(result) {
    const entry = document.createElement('div');
    entry.className = 'log-entry'
        + (result.gotGold || result.isExchange ? ' log-purple' : '')
        + (result.wasPity && !result.isExchange ? ' log-pity-hit' : '')
        + (result.isExchange ? ' log-exchange' : '');

    let talentsHtml = '';
    for (const t of result.talents) {
        const talent = TALENT_DATA[String(t.id)];
        const name = talent ? talent.name : '未知';
        const qClass = talent ? getQualityClass(talent.weight) : 'q1';
        const lockMark = t.locked ? '[锁]' : '';
        talentsHtml += `<span class="log-talent ${qClass}">${lockMark}${name}</span>`;
    }

    const tags = [];
    if (result.isExchange) {
        tags.push('<span class="log-tag pity">置换</span>');
        if (result.exchangedFrom && result.exchangedTo) {
            tags.push(`<span class="log-tag gap">${result.exchangedFrom}→${result.exchangedTo}</span>`);
        }
    } else if (result.wasPity) {
        tags.push('<span class="log-tag pity">保底</span>');
    } else if (result.gotGold) {
        tags.push('<span class="log-tag purple">出紫</span>');
    }

    if (result.gotGold && !result.isExchange) {
        if (result.isFirstPurple) {
            tags.push(`<span class="log-tag gap">首次 · 累计${result.purpleGapPills}丹</span>`);
        } else if (result.purpleGapPills != null) {
            tags.push(`<span class="log-tag gap">间隔${result.purpleGapPills}丹</span>`);
        }
    }

    if (!result.isExchange) {
        tags.push(`<span class="log-tag meta">×${result.pillsUsed}</span>`);
    }
    tags.push(`<span class="log-tag meta">累${result.totalPills}</span>`);

    const numLabel = result.isExchange ? `换${result.exchangeNo || ''}` : `#${result.washNo}`;
    entry.innerHTML = `
        <span class="log-num">${numLabel}</span>
        <span class="log-talents">${talentsHtml}</span>
        <span class="log-tags">${tags.join('')}</span>
    `;
    return entry;
}

function updateHistoryPager(total) {
    const bar = document.getElementById('historyPager');
    const info = document.getElementById('historyPagerInfo');
    if (!bar || !info) return;
    const pageSize = getHistoryPageSize();
    const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (historyPage > pages) historyPage = pages;
    if (historyPage < 1) historyPage = 1;
    bar.hidden = total <= 0;
    info.textContent = total
        ? `第 ${historyPage}/${pages} 页 · 共 ${total} 条`
        : '—';
    const prev = document.getElementById('btnHistoryPrev');
    const next = document.getElementById('btnHistoryNext');
    if (prev) prev.disabled = historyPage <= 1;
    if (next) next.disabled = historyPage >= pages;
}

function renderHistoryPage() {
    updateCustomWashUndoButton();
    const log = document.getElementById('historyLog');
    if (!log) return;
    const hist = state.washHistory;
    const total = hist.length;
    if (!total) {
        log.innerHTML = '<div class="log-empty">尚未开始洗髓</div>';
        updateHistoryPager(0);
        return;
    }
    const pageSize = getHistoryPageSize();
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (historyPage > pages) historyPage = pages;
    const end = total - (historyPage - 1) * pageSize;
    const start = Math.max(0, end - pageSize);
    const slice = hist.slice(start, end);
    const frag = document.createDocumentFragment();
    for (let i = slice.length - 1; i >= 0; i--) {
        frag.appendChild(buildLogEntryEl(slice[i]));
    }
    log.innerHTML = '';
    log.appendChild(frag);
    updateHistoryPager(total);
}

function addLogEntries(results) {
    if (!results || !results.length) return;
    for (const r of results) recordWash(r);
    historyPage = 1;
    renderHistoryPage();
}

function addLogEntry(result) {
    addLogEntries([result]);
}

function clearWashHistory() {
    resetManualWashUndo();
    state.washHistory = [];
    historyPage = 1;
    renderHistoryPage();
}

function exportWashHistory() {
    if (!state.washHistory.length) {
        alert('暂无洗髓记录');
        return;
    }
    const lines = state.washHistory.map(r => {
        const names = (r.talentNames || []).join('+');
        let flag = '-';
        if (r.isExchange) flag = '置换';
        else if (r.wasPity) flag = '保底';
        else if (r.gotGold) flag = '出紫';
        let gap = '';
        if (r.isExchange) {
            gap = `${r.exchangedFrom || ''}→${r.exchangedTo || ''}`;
        } else if (r.gotGold) {
            gap = r.isFirstPurple ? `首次(${r.purpleGapPills})` : String(r.purpleGapPills ?? '');
        }
        return [
            r.isExchange ? `换` : r.washNo,
            flag,
            names,
            r.pillsUsed,
            r.totalPills,
            gap,
            r.talLucky,
        ].join('\t');
    });
    const header = ['序号', '标记', '天赋', '本次丹', '累计丹', '紫脉间隔/置换', '保底进度'].join('\t');
    const text = header + '\n' + lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `洗髓记录_${state.washHistory.length}次.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function updateAll(result) {
    invalidatePurpleCache();
    renderTalents();
    renderAptitudePanel();
    renderStats();
    renderPityBar();
    renderCostInfo();
    if (result) addLogEntry(result);
}


function asRoleList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.values(value);
    return [];
}

function collectSaveRoles(saveData) {
    const out = [];
    const seen = new Set();

    function push(tag, role, keyPrefix) {
        if (!role || typeof role !== 'object' || role.ID == null) return;
        const key = `${keyPrefix}:${role.ID}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ key, tag, role });
    }

    push('主角', saveData.MainRole, 'main');
    asRoleList(saveData.Roles).forEach(r => push('随从', r, 'role'));
    asRoleList(saveData.Leavers).forEach(r => push('离队', r, 'leave'));
    return out;
}

function selectRoleFromSave(roleKey) {
    const list = state.saveRoles || [];
    let entry = list.find(e => e.key === String(roleKey));
    if (!entry && roleKey !== undefined && roleKey !== null && roleKey !== '') {
        const id = Number(roleKey);
        entry = list.find(e => e.role.ID === id);
    }
    if (!entry) return;

    const role = entry.role;
    const bt = role.BornTalent || {};

    state.seed = bt.S !== undefined ? Number(bt.S) : 0;
    state.bornTalentRC = Number(bt.RC) || 0;
    const lt = role.LuckTalent || {};
    if (lt.S !== undefined && lt.S !== null) {
        state.luckSeed = Number(lt.S);
        state.luckSeedInited = true;
    } else {
        state.luckSeed = 0;
        state.luckSeedInited = false;
    }
    state.roleId = Number(role.ID) || 0;
    state.talLucky = Number(role.TalLucky) || 0;
    state.zizhi = Number(role.ZiZhi) || 153;
    state.sex = Number(role.Sex) || 1;
    state.roleLevel = Number(role.Level) || 90;
    state.roleRaw = role;

    const rawTalents = asRoleList(role.Talents);
    state.talents = rawTalents.map(t => ({
        id: Number(t.ID != null ? t.ID : t.id),
        locked: !!(t.Lock != null ? t.Lock : t.lock)
    })).filter(t => Number.isFinite(t.id) && t.id > 0);

    state.strGift = Number(role.StrGift) || 0;
    state.conGift = Number(role.ConGift) || 0;
    state.dexGift = Number(role.DexGift) || 0;
    state.intGift = Number(role.IntGift) || 0;

    computeRoleStats();
    extractGlobalVars();

    state.totalWash = 0;
    state.totalTalentBars = 0;
    state.totalPills = 0;
    state.goldCount = 0;
    state.pityCount = 0;
    state.qualityCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    state.lastPurpleTotalPills = null;
    state.exchangeCount = 0;
    invalidatePurpleCache();
    clearWashHistory();

    const zizhiEl = document.getElementById('zizhiSelect');
    const sexEl = document.getElementById('sexSelect');
    const seedEl = document.getElementById('seedInput');
    const luckEl = document.getElementById('luckSeedInput');
    const roleEl = document.getElementById('roleIdInput');
    if (zizhiEl) zizhiEl.value = String(state.zizhi);
    if (sexEl) sexEl.value = String(state.sex);
    if (seedEl) seedEl.value = String(state.seed);
    if (luckEl) luckEl.value = state.luckSeedInited ? String(state.luckSeed) : '';
    if (roleEl) roleEl.value = String(state.roleId);

    const roleSelect = document.getElementById('saveRoleSelect');
    if (roleSelect && entry.key) roleSelect.value = entry.key;

    pushStateToWasm();
    updateAll();
    renderAiTalentChoices();
    renderAutoWashSaveGate();
}

function loadParsedSaveData(saveData, silent) {
    state.saveData = saveData;
    loadWashVipPreference(saveData);
    if (!state.saveVersion && saveData && saveData.DBVersion != null) {
        state.saveVersion = String(saveData.DBVersion);
    }
    state.bagPills = 0;
    state.hasBagPills = false;
    autoWashSelectedRoleKey = '';
    aiSelectedTalentIds = [];
    aiDefaultTargetsPending = true;
    invalidateAiPrediction();

    const saveRoles = collectSaveRoles(saveData);
    state.saveRoles = saveRoles;
    if (saveRoles.length === 0) {
        alert("存档中没有可读取的主角或随从，请重新导出并导入存档。");
        return;
    }

    const items = Array.isArray(saveData.Items)
        ? saveData.Items
        : (saveData.Items && typeof saveData.Items === 'object' ? Object.values(saveData.Items) : []);
    let pillCount = 0;
    for (const item of items) {
        if (item.ID === 2601) {
            pillCount += (item.Num || 0);
        }
    }
    state.bagPills = pillCount;    state.hasBagPills = true;

    if (saveData.CenterID) {
        state.salt = Number(saveData.CenterID) % 1000000;
        document.getElementById('saltInput').value = state.salt;
    }

    const roleSelect = document.getElementById('saveRoleSelect');
    roleSelect.innerHTML = '';

    saveRoles.forEach(entry => {
        const role = entry.role;
        const opt = document.createElement('option');
        opt.value = entry.key;
        opt.textContent = `${entry.tag} · ${role.Name || '无名'}`;
        roleSelect.appendChild(opt);
    });

    const preferred =
        saveRoles.find(e => e.role.ID === 10044) ||
        saveRoles.find(e => e.tag === '主角') ||
        saveRoles[0];
    roleSelect.value = preferred.key;

    const roleRow = document.getElementById('saveRoleRow');
    roleRow.hidden = false;
    roleRow.style.display = 'flex';
    document.getElementById('bagPillDisplay').textContent = `${pillCount.toLocaleString()} 颗`;

    state.mode = 'seed';
    document.getElementById('modeSelect').value = 'seed';

    selectRoleFromSave(preferred.key);
    renderAutoWashSaveGate();

    const nMain = saveRoles.filter(e => e.tag === '主角').length;
    const nRole = saveRoles.filter(e => e.tag === '随从').length;
    const nLeave = saveRoles.filter(e => e.tag === '离队').length;
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
        saveStatus.textContent = '导入成功';
    }
    if (typeof renderArchiveState === 'function') renderArchiveState(saveData);
    if (typeof invalidateEquipAutoPrediction === 'function') {
        invalidateEquipAutoPrediction('已载入新的原始存档，可开始装备自动模拟。');
    }
    if (typeof invalidateJianwangAutoPrediction === 'function') {
        invalidateJianwangAutoPrediction('已载入新的原始存档，可开始剑王阁自动模拟。');
        refreshJianwangAutoSwords(false);
    }
    if (!silent) {
        alert(
            `成功载入存档！\n` +
            `- 主角 ${nMain} / 随从 ${nRole} / 离队 ${nLeave}\n` +
            `- 背包洗髓丹: ${pillCount.toLocaleString()} 颗`
        );
    }
}

function handleSaveFileImport(file) {
    (async () => {
        if (typeof _importFeedback === 'function') _importFeedback(true);
        try {
            let json;
            if (typeof decryptSaveFile === 'function') {
                const r = await decryptSaveFile(file);
                json = r.data;
                state.saveVersion = r.version;
                state.saveChannel = r.channel || (r.platform === 'oversea' ? '国际服' : '');
                state.savePlatform = r.platform;
                if (typeof _applyDlcByPlatform === 'function') _applyDlcByPlatform(r.platform);
                state.saveFormat = r.format || 'json';
                state.saveColumns = r.columns || null;
                state.saveRow = r.row || null;
                if (typeof saveShareStore === 'function') {
                    saveShareStore(json, {
                        version: r.version, platform: r.platform,
                        channel: state.saveChannel,
                        format: r.format || 'json', columns: r.columns || null, row: r.row || null,
                    });
                }
            } else {
                const text = await file.text();
                const obj = JSON.parse(text.replace(/^\uFEFF/, '').trim());
                const entry = Array.isArray(obj) ? obj[0] : obj;
                const b64 = entry && (entry.content || entry.encrypted);
                if (b64) json = wasmDecryptSave(b64);
                else json = obj;
            }
            if (typeof _importFeedback === 'function') _importFeedback(false);
            loadParsedSaveData(json);
        } catch (err) {
            console.error(err);
            alert("读取存档失败: " + (err.message || err));
        } finally {
            if (typeof _importFeedback === 'function') _importFeedback(false);
        }
    })();
}

function upgradeZiZhi() {
    if (state.zizhi >= 154) {
        alert("资质已达到最高阶段【空前绝后】，已解锁全部 4 个天赋槽！");
        return;
    }

    const routeBefore=manualRouteState();
    state.zizhi += 1;
    const zzConfig = getZZConfig();
    document.getElementById('zizhiSelect').value = String(state.zizhi);

    state.strGift += 100;
    state.conGift += 100;
    recordManualRoute('upgrade',routeBefore,`提升资质，开启第 ${zzConfig.num_talent} 栏`);

    updateAll();
    alert(`资质提升至【${zzConfig.zz_name}】！成功开启 ${zzConfig.num_talent} 个天赋槽位！`);
}


function toggleLock(index) {
    if (index >= 0 && index < state.talents.length) {
        const routeBefore=manualRouteState(),talent=state.talents[index],talentName=TALENT_DATA[String(talent.id)]?.name||'当前脉';
        state.talents[index].locked = !state.talents[index].locked;
        recordManualRoute('lock',routeBefore,(state.talents[index].locked?'锁定':'解除锁定')+'「'+talentName+'」');
        invalidatePurpleCache();
        renderTalents();
        renderCostInfo();
    }
}

window.exchangeTalent = exchangeTalent;
window.toggleLock = toggleLock;

function washOnce() {
    return trackManualWash(() => {
        const result = doWash();
        if (result) updateAll(result);
    });
}

function washMulti(times) {
    return trackManualWash(() => {
        const zzConfig = getZZConfig();
        if (zzConfig.num_talent === 0) return;
        const lockedCount = state.talents.filter(t => t.locked).length;
        if (zzConfig.num_talent <= lockedCount) return;

        if (state.dlcMode || manualWashStepTracking) {
            const batch = [];
            for (let i = 0; i < times; i++) {
                const r = doWash();
                if (!r) break;
                batch.push(r);
            }
            if (!batch.length) return;
            addLogEntries(batch);
            updateAll();
            return;
        }

        pushStateToWasm();
        const rawBatch = wasmWashMulti(times);
        if (!rawBatch || !rawBatch.length) return;
        pullStateFromWasm();

        const batch = rawBatch.map(convertWashResult);
        addLogEntries(batch);
        updateAll();
    });
}

function washUntilGold() {
    return trackManualWash(() => {
        const zzConfig = getZZConfig();
        if (zzConfig.num_talent === 0) return;
        const lockedCount = state.talents.filter(t => t.locked).length;
        if (zzConfig.num_talent <= lockedCount) return;

        if (state.dlcMode || manualWashStepTracking) {
            const batch = [];
            for (let i = 0; i < 10000; i++) {
                const r = doWash();
                if (!r) break;
                batch.push(r);
                if (r.wasPity || (r.talents || []).some(t => t.weight === 4)) break;
            }
            if (!batch.length) return;
            addLogEntries(batch);
            updateAll();
            return;
        }

        pushStateToWasm();
        const rawBatch = wasmWashUntilGold(10000);
        if (!rawBatch || !rawBatch.length) return;
        pullStateFromWasm();

        const batch = rawBatch.map(convertWashResult);
        addLogEntries(batch);
        updateAll();
    });
}

function onModeChange() {
    resetManualWashUndo();
    state.mode = document.getElementById('modeSelect').value;
    invalidatePurpleCache();
    renderTalents();
    renderCostInfo();
}

function onSeedChange() {
    resetManualWashUndo();
    state.seed = Number(document.getElementById('seedInput').value) || 0;
    invalidatePurpleCache();
    renderCostInfo();
}

function onLuckSeedChange() {
    resetManualWashUndo();
    const el = document.getElementById('luckSeedInput');
    if (!el) return;
    const raw = String(el.value || '').trim();
    if (raw === '') {
        state.luckSeedInited = false;
        state.luckSeed = 0;
        invalidatePurpleCache();
        return;
    }
    state.luckSeed = Number(raw) || 0;
    state.luckSeedInited = true;
    invalidatePurpleCache();
}

function onRoleIdChange() {
    resetManualWashUndo();
    state.roleId = Number(document.getElementById('roleIdInput').value) || 10044;
    invalidatePurpleCache();
}

function onSaltChange() {
    resetManualWashUndo();
    state.salt = Number(document.getElementById('saltInput').value) || 278440;
    invalidatePurpleCache();
}

function onZizhiChange() {
    resetManualWashUndo();
    state.zizhi = parseInt(document.getElementById('zizhiSelect').value);
    invalidatePurpleCache();
    renderTalents();
    renderAptitudePanel();
    renderPityBar();
    renderCostInfo();
    renderAiTalentChoices();
}

function onSexChange() {
    resetManualWashUndo();
    state.sex = parseInt(document.getElementById('sexSelect').value);
    invalidatePurpleCache();
    renderAiTalentChoices();
}

function normalizeVipLevel(value) {
    const vip = parseInt(value, 10);
    if (!Number.isFinite(vip) || vip <= 0) return 0;
    return vip >= 2 ? 2 : 1;
}

function vipImpactText(value) {
    const vip = normalizeVipLevel(value);
    if (vip === 0) {
        return '无 VIP：排除全部 VIP 限定脉；VIP 不改变丹耗或保底。';
    }
    if (vip === 1) {
        return 'VIP 1+：开放九阴鬼脉、玄阳神脉、混元奇脉、一心两用等；仍需满足角色类别、资质等其他条件；VIP 不改变丹耗或保底。';
    }
    return 'VIP 2+：包含 VIP 1+ 候选，并额外开放赴汤蹈火；仍需满足角色类别、资质等其他条件；VIP 不改变丹耗或保底。';
}

function syncVipControls() {
    ['vipSelect', 'autoWashVipSelect'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.value = String(state.vip);
    });
    const impact = vipImpactText(state.vip);
    ['vipImpactHint', 'autoWashVipImpactHint'].forEach(id => {
        const hint = document.getElementById(id);
        if (hint) hint.textContent = impact;
    });
}

function washVipStorageKey(saveData=state.saveData) {
    if (window.__SBJ_COMMUNITY_WASH__) return null;
    const id=Number(saveData?.CenterID);
    return Number.isSafeInteger(id)&&id>0?'sbj_wash_vip_v1:'+aiSearchTaskKey({gameAccount:String(id)}):null;
}
function loadWashVipPreference(saveData) {
    state.vip=1;state.vipConfirmed=false;
    try {const key=washVipStorageKey(saveData),saved=key&&JSON.parse(localStorage.getItem(key)||'null');
        if(saved&&[0,1,2].includes(saved.level)){state.vip=saved.level;state.vipConfirmed=true;}
    } catch(_) {}
    syncVipControls();
}

function onVipChange(event) {
    resetManualWashUndo();
    const value = event?.target?.value ?? document.getElementById('vipSelect')?.value ?? state.vip;
    state.vip = normalizeVipLevel(value);
    state.vipConfirmed = true;
    try {const key=washVipStorageKey();if(key&&!window.__SBJ_COMMUNITY_WASH__)localStorage.setItem(key,JSON.stringify({level:state.vip}));}catch(_){}
    syncVipControls();
    invalidatePurpleCache();
    invalidateAiPrediction();
    renderAiTalentChoices();
    renderAutoWashSaveGate();
}

function clearLog() {
    clearWashHistory();
}

function washCustom() {
    const input = document.getElementById('customWashInput');
    const requested = requestedManualWashCount();
    if (!requested) { manualWashUndoFeedback('请输入需要洗脉或撤回的正整数次数。'); return; }
    const count = Math.min(requested, 1000);
    if (input) input.value = count;
    manualWashUndoFeedback('');
    washMulti(count);
}

// Preserve batch checkpoints and replay only the retained prefix. The rollback
// count can cross any number of batches; immutable archive context is shared,
// rather than storing its full global-variable table for every checkpoint.
const CUSTOM_WASH_CONTEXT_KEYS = ['saveData', 'roleRaw', 'saveRoles', 'globalVars'];
function customWashRuntime() {
    return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(state).filter(([key]) =>
        key !== 'washHistory' && !CUSTOM_WASH_CONTEXT_KEYS.includes(key)))));
}
function requestedManualWashCount() {
    const value = Number(document.getElementById('customWashInput')?.value);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function manualWashUndoFeedback(text) {
    const feedback = document.getElementById('washUndoFeedback');
    if (feedback) feedback.textContent = text;
}
function resetManualWashUndo() {
    clearManualRoute();
    manualWashUndo = { entries: [], globals: null };
    manualWashUndoFeedback('');
    updateCustomWashUndoButton();
}
function captureManualWashPoint(historyLength = state.washHistory.length, synchronize = true) {
    if (synchronize && !syncStateToWasm(state)) return null;
    const wasm = wasmGetState();
    if (!wasm) return null;
    if (manualWashUndo.globals === null) manualWashUndo.globals = wasm.global_vars;
    wasm.global_vars = manualWashUndo.globals;
    return {
        wasm, runtime: customWashRuntime(),
        context: CUSTOM_WASH_CONTEXT_KEYS.map(key => state[key]),
        history: state.washHistory, historyLength, historyPage, routeLength:manualRoute.events.length, routeState:manualRouteState(),
    };
}
function manualWashesAvailable() {
    const last = manualWashUndo.entries[manualWashUndo.entries.length - 1];
    if (last && (last.endTotal !== state.totalWash || !last.before.context.every((value, index) => value === state[CUSTOM_WASH_CONTEXT_KEYS[index]]))) {
        manualWashUndo = { entries: [], globals: null };
    }
    return manualWashUndo.entries.reduce((sum, entry) => sum + entry.washed, 0);
}
function trackManualWash(action) {
    if (!document.getElementById('btnUndoWashCustom') || manualWashTracking || manualWashReplaying) return action();
    manualWashesAvailable();
    const before = captureManualWashPoint(state.washHistory.length, state.mode === 'seed');
    if (!before) return;
    const routeBefore=manualRouteState();
    manualWashTracking = true;
    // Probability mode is nondeterministic. Capture each draw there instead
    // of attempting to recreate a past random prefix by drawing again.
    manualWashStepTracking = state.mode !== 'seed' ? { first: before, baseHistory: before.historyLength, pending: 0 } : null;
    try { return action(); }
    finally {
        if (!manualWashStepTracking) {
            const washed = state.totalWash - before.runtime.totalWash;
            if (washed > 0) manualWashUndo.entries.push({ before, washed, endTotal: state.totalWash });
        }
        if(state.totalWash>routeBefore.washes)recordManualRoute('wash',routeBefore);
        manualWashStepTracking = null;
        manualWashTracking = false;
        updateCustomWashUndoButton();
    }
}
function updateCustomWashUndoButton() {
    const button = document.getElementById('btnUndoWashCustom');
    if (!button || manualWashTracking || manualWashReplaying) return;
    const available = manualWashesAvailable(), count = requestedManualWashCount();
    button.disabled = !available || !count;
    button.textContent = count && String(count).length <= 4 ? `撤回 ${count} 次` : '撤回 N 次';
    button.setAttribute('aria-label', count ? `撤回填写的 ${count} 次洗脉` : '撤回填写次数的洗脉');
    button.title = '按填写的次数回退本页洗脉进度，可跨多轮连洗；回退点之后的锁脉、置换及记录一并恢复。';
    const number = document.getElementById('customWashNum');
    if (number) number.textContent = count ? Math.min(count, 1000) : 'N';
    const hint = document.getElementById('washUndoAvailable');
    if (hint) hint.textContent = `本页可撤回 ${available.toLocaleString()} 次` + (count > 1000 ? '；每轮连洗最多 1000 次，撤回不受此限制。' : '');
}
function restoreManualWashPoint(point) {
    if (!wasmSetState(point.wasm)) throw new Error('撤回状态暂时无法恢复，请稍后重试。');
    for (const key of Object.keys(state)) {
        if (key !== 'washHistory' && !CUSTOM_WASH_CONTEXT_KEYS.includes(key) && !(key in point.runtime)) delete state[key];
    }
    Object.assign(state, point.runtime);
    state.washHistory = point.history.slice(0, point.historyLength);
    historyPage = point.historyPage;
}
function undoCustomWash() {
    const count = requestedManualWashCount(), available = manualWashesAvailable();
    if (!count) { manualWashUndoFeedback('请输入需要撤回的正整数次数。'); return; }
    if (count > available) { manualWashUndoFeedback(`本页当前最多可撤回 ${available.toLocaleString()} 次，请调整次数。`); return; }
    const entries = manualWashUndo.entries;
    let remaining = count, index = entries.length - 1;
    while (index >= 0 && remaining > entries[index].washed) { remaining -= entries[index].washed; index--; }
    const entry = entries[index], keep = entry.washed - remaining;
    const current = captureManualWashPoint(state.washHistory.length, false), originalHistory = state.washHistory, originalRouteEvents = manualRoute.events.slice();
    if (!current) return;
    const expected = keep > 0 ? entry.before.history[entry.before.historyLength + keep - 1] : null;
    manualWashReplaying = true;
    try {
        restoreManualWashPoint(entry.before);
        if (keep > 0) {
            washMulti(keep);
            if (state.totalWash !== entry.before.runtime.totalWash + keep || (expected &&
                (state.seed !== expected.endS || state.totalPills !== expected.totalPills || state.talLucky !== expected.talLucky ||
                 JSON.stringify(state.talents.map(t => [t.id, t.locked])) !== JSON.stringify(expected.talents.map(t => [t.id, t.locked]))))) {
                throw new Error('撤回回放校验未通过，已保留当前进度。');
            }
        }
        const interrupted=originalRouteEvents[entry.before.routeLength];
        manualRoute.events=originalRouteEvents.slice(0,entry.before.routeLength);
        if(!manualRoute.events.length)manualRoute.start=null;
        const partialStart=interrupted?.type==='wash'&&interrupted.before.washes<=entry.before.routeState.washes ? interrupted.before : entry.before.routeState;
        if(state.totalWash>partialStart.washes){manualWashReplaying=false;recordManualRoute('wash',partialStart);manualWashReplaying=true;}
        const routeButton=document.getElementById('btnManualRouteImage');if(routeButton)routeButton.disabled=!manualRoute.events.length;
        manualWashUndo.entries = entries.slice(0, index);
        if (keep > 0) manualWashUndo.entries.push({ before: entry.before, washed: keep, endTotal: state.totalWash });
        manualWashUndo.entries.forEach(item => { item.before.history = state.washHistory; });
        manualWashUndoFeedback(`已按填写数量撤回 ${count.toLocaleString()} 次洗脉。`);
    } catch (error) {
        restoreManualWashPoint(current);
        state.washHistory = originalHistory;
        manualWashUndoFeedback(playerError(error));
    } finally { manualWashReplaying = false; }
    const zizhi = document.getElementById('zizhiSelect');
    if (zizhi) zizhi.value = String(state.zizhi);
    const luck = document.getElementById('luckSeedInput');
    if (luck) luck.value = state.luckSeedInited ? String(state.luckSeed) : '';
    updateAll();
    renderHistoryPage();
}

const EXCHANGE_SEQUENCE_SHENMAI_IDS = new Set([248, 249, 250]);
const EXCHANGE_SEQUENCE_SHENMAI_MAX_GAP = 850;
const EXCHANGE_SEQUENCE_PRIOR_PITY_MESSAGE = '此前存在过保底紫，该处序列固定，只依赖于之前所锁定的序列';
const EXCHANGE_SEQUENCE_DIRECT_PITY_MESSAGE = '首个紫脉为保底紫，仅可选择该保底位置';

let exchangeSequenceDataset = { roles: [], globalVars: {} };
let exchangeSequenceCandidateLoadToken = 0;
let exchangeSequenceRunning = false;
let exchangeCompareToken = 0;

function cloneExchangeSequenceValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function exchangeSequenceTalentByName(name) {
    return Object.values(TALENT_DATA).find(item => item.name === name);
}

function exchangeSequenceRoleStats(role) {
    const coefficient = 0.00006;
    function attribute(name) {
        const raw = Number(role[name] || 0);
        const born = Number(role[`Born${name}`] || 0);
        const gift = Number(role[`${name}Gift`] || 0);
        return Math.floor((raw + born) * (1 + coefficient * gift));
    }
    return {
        str_val: attribute('Str'),
        dex: attribute('Dex'),
        con: attribute('Con'),
        int_val: attribute('Int'),
    };
}

function buildExchangeSequenceWasmState(role) {
    const born = role.BornTalent || {};
    const luck = role.LuckTalent || {};
    const luckInited = luck.S !== undefined && luck.S !== null;
    const effectiveZizhi = Math.max(Number(role.ZiZhi) || 153, 153);
    return {
        mode: 'seed',
        zizhi: effectiveZizhi,
        sex: Number(role.Sex) || 1,
        vip: normalizeVipLevel(state.vip),
        seed: born.S !== undefined ? Number(born.S) : 0,
        born_talent_rc: Number(born.RC) || 0,
        save_version: state.saveVersion || '',
        save_channel: state.saveChannel || '',
        luck_seed: luckInited ? Number(luck.S) : 0,
        luck_seed_inited: luckInited,
        role_id: Number(role.ID) || 0,
        salt: Number(state.saveData?.CenterID || state.salt || 278440) % 1000000,
        talents: asRoleList(role.Talents)
            .map(talent => ({
                id: Number(talent.ID != null ? talent.ID : talent.id),
                locked: !!(talent.Lock != null ? talent.Lock : talent.lock),
            }))
            .filter(talent => Number.isFinite(talent.id) && talent.id > 0),
        tal_lucky: Number(role.TalLucky) || 0,
        total_wash: 0,
        total_talent_bars: 0,
        total_pills: 0,
        bag_pills: Number(state.bagPills) || 0,
        has_bag_pills: true,
        gold_count: 0,
        pity_count: 0,
        quality_counts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        last_purple_total_pills: null,
        exchange_count: 0,
        str_gift: Number(role.StrGift) || 0,
        con_gift: Number(role.ConGift) || 0,
        dex_gift: Number(role.DexGift) || 0,
        int_gift: Number(role.IntGift) || 0,
        role_level: Number(role.Level) || 90,
        role_stats: exchangeSequenceRoleStats(role),
        global_vars: state.saveData?.globalVariable || {},
    };
}

function buildExchangeSequenceDataset() {
    const roles = (state.saveRoles || []).map(entry => {
        const wasmState = buildExchangeSequenceWasmState(entry.role);
        const slotInfo = ZZ_DATA[String(wasmState.zizhi)] || {};
        const slotCount = Number(slotInfo.num_talent || 0);
        return {
            key: entry.key,
            roleName: entry.role.Name || '无名',
            roleKind: entry.tag,
            seedStatus: wasmState.luck_seed_inited ? 'fixed_luck_seed' : 'mutable_born_seed',
            currentSeed: wasmState.luck_seed_inited ? wasmState.luck_seed : wasmState.seed,
            slotCount,
            candidates: [],
            candidatesReady: slotCount < 3,
            directPitySequence: false,
            wasmState,
        };
    });
    return {
        roles,
        globalVars: state.saveData?.globalVariable || {},
    };
}

function selectedExchangeSequenceRole() {
    const select = document.getElementById('exchangeSequenceRoleSelect');
    if (!select || select.value === '') return null;
    return exchangeSequenceDataset.roles.find(role => role.key === select.value) || null;
}

function selectedExchangeSequenceCandidate(role = selectedExchangeSequenceRole()) {
    const select = document.getElementById('exchangeSequencePurpleSelect');
    if (!role || !select || select.value === '') return null;
    return role.candidates[Number(select.value)] || null;
}

function isExchangeSequenceFourSlotRole(role) {
    return Number(role?.slotCount) >= 4;
}

function activeExchangeSequencePadInput(role) {
    return document.getElementById(isExchangeSequenceFourSlotRole(role)
        ? 'exchangeSequenceFourPadInput'
        : 'exchangeSequenceThreePadInput');
}

function readExchangeSequencePadValue(role) {
    const input = activeExchangeSequencePadInput(role);
    const fallback = isExchangeSequenceFourSlotRole(role) ? 0 : 1;
    const raw = Number(input?.value);
    const value = Number.isFinite(raw) ? Math.trunc(raw) : fallback;
    const normalized = Math.max(0, Math.min(200, value));
    if (input) input.value = String(normalized);
    return normalized;
}

function setExchangeSequenceSlotPanels(role) {
    const threeGroup = document.getElementById('exchangeSequenceThreePadGroup');
    const fourGroup = document.getElementById('exchangeSequenceFourPadGroup');
    const panel = document.getElementById('exchangeSequenceModePanel');
    const hasRole = !!role;
    const directPity = !!role?.directPitySequence;
    const fourSlot = hasRole && isExchangeSequenceFourSlotRole(role);
    if (threeGroup) threeGroup.hidden = !hasRole || fourSlot || directPity;
    if (fourGroup) fourGroup.hidden = !hasRole || !fourSlot || directPity;
    if (!panel) return;
    panel.hidden = !hasRole;
    if (!hasRole) {
        panel.textContent = '';
    } else if (directPity) {
        panel.innerHTML = '<strong>首位保底紫</strong>：置换序列已由这次保底固定，无需设置垫洗位置。';
    } else if (fourSlot) {
        panel.innerHTML = '<strong>四栏已开</strong>：选择首紫后，按后续脉序位置比较置换结果。若游戏内结果有偏移，可尝试相邻位置。';
    } else {
        panel.innerHTML = '<strong>三栏已开</strong>：选择首紫后，每多垫洗一次，可比较另一条置换序列；这里的位置数也就是额外洗髓次数。';
    }
}

function clearExchangeSequenceResults(message = '等待选择参数') {
    const grid = document.getElementById('exchangeSequenceGrid');
    const empty = document.getElementById('exchangeSequenceEmpty');
    const meta = document.getElementById('exchangeSequenceResultMeta');
    const seed = document.getElementById('exchangeSequenceInitialSeed');
    if (grid) {
        grid.innerHTML = '';
        grid.hidden = true;
    }
    if (empty) {
        empty.hidden = false;
        empty.textContent = message;
    }
    if (meta) meta.textContent = '尚未生成';
    if (seed) seed.textContent = '等待生成';
}

function appendExchangeSequenceOption(select, value, text, { disabled = false, className = '' } = {}) {
    if (!select) return;
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = text;
    option.disabled = disabled;
    option.className = className;
    select.appendChild(option);
}

function isExchangeSequenceShenmaiRecord(record) {
    return EXCHANGE_SEQUENCE_SHENMAI_IDS.has(Number(record?.talent_id));
}

function exchangeSequenceHasPriorPity(record) {
    return !!(record && (record.has_prior_pity || record.shenmai_has_prior_pity));
}

function isExchangeSequenceOrdinaryTargetWithoutPriorPity(record) {
    return !!record?.can_exchange && !!record?.earlier_conflict_name
        && !record?.was_pity && !isExchangeSequenceShenmaiRecord(record);
}

function isExchangeSequenceShenmaiTargetWithoutPriorPity(record) {
    const gap = Number(record?.shenmai_gap);
    return isExchangeSequenceShenmaiRecord(record)
        && !record?.was_pity
        && !!record?.shenmai_conflict_name
        && Number.isFinite(gap)
        && gap >= 0
        && gap <= EXCHANGE_SEQUENCE_SHENMAI_MAX_GAP;
}

function exchangeSequenceCandidateUnavailableReason(record) {
    if (record?.was_pity) return '保底脉，无法固定定向冲突';
    if (isExchangeSequenceShenmaiRecord(record) && !isExchangeSequenceShenmaiTargetWithoutPriorPity(record)) {
        return '无法冲突';
    }
    if (!isExchangeSequenceShenmaiRecord(record)) {
        if (!record?.earlier_conflict_name) return '无冲突脉可进行置换';
        if (!record?.can_exchange) return record?.block_reason || '当前无法按锁冲突流程置换';
    }
    if (exchangeSequenceHasPriorPity(record)) return EXCHANGE_SEQUENCE_PRIOR_PITY_MESSAGE;
    return '当前紫脉不适用置换初始化';
}

function exchangeSequenceCandidateDisplayReason(record, showPriorPityNotice = true) {
    if (record?.was_pity) return '保底脉，无法固定定向冲突';
    if (isExchangeSequenceShenmaiRecord(record) && isExchangeSequenceShenmaiTargetWithoutPriorPity(record)) {
        const conflict = `神脉冲突：${record.shenmai_conflict_name}`;
        return showPriorPityNotice && exchangeSequenceHasPriorPity(record)
            ? `${conflict}；${EXCHANGE_SEQUENCE_PRIOR_PITY_MESSAGE}`
            : conflict;
    }
    if (!isExchangeSequenceShenmaiRecord(record) && record?.can_exchange && record?.earlier_conflict_name) {
        const conflict = `首紫冲突：${record.earlier_conflict_name}`;
        return showPriorPityNotice && exchangeSequenceHasPriorPity(record)
            ? `${conflict}；${EXCHANGE_SEQUENCE_PRIOR_PITY_MESSAGE}`
            : conflict;
    }
    return exchangeSequenceCandidateUnavailableReason(record);
}
function annotateExchangeSequenceShenmaiPairs(purples, initialTalents) {
    const history = asRoleList(initialTalents)
        .map((slot, index) => {
            const talent = TALENT_DATA[String(slot?.id)];
            if (!talent || !EXCHANGE_SEQUENCE_SHENMAI_IDS.has(Number(talent.id))) return null;
            return {
                talent_id: Number(talent.id),
                talent_name: talent.name,
                wash_no: 0,
                wash_times: 0,
                initial_index: index,
                is_initial: true,
            };
        })
        .filter(Boolean);
    const ordered = purples
        .map((item, index) => ({ item, index }))
        .sort((left, right) => Number(left.item.wash_no) - Number(right.item.wash_no) || left.index - right.index);
    let hasPriorPity = false;

    for (const { item } of ordered) {
        item.has_prior_pity = hasPriorPity;
        if (isExchangeSequenceShenmaiRecord(item)) {
            const partner = [...history].reverse().find(previous =>
                String(previous.talent_name) !== String(item.talent_name));
            const gap = partner ? Number(item.wash_no) - Number(partner.wash_no) : NaN;
            item.shenmai_conflict_name = partner ? partner.talent_name : '';
            item.shenmai_conflict_wash_no = partner ? Number(partner.wash_no) : 0;
            item.shenmai_conflict_wash_times = partner
                ? (Number.isFinite(Number(partner.wash_times)) ? Number(partner.wash_times) : Number(partner.wash_no))
                : 0;
            item.shenmai_gap = Number.isFinite(gap) ? gap : null;
            item.shenmai_has_prior_pity = hasPriorPity;

            const duplicateInitial = Number(item.wash_no) === 0 && history.some(previous =>
                previous.is_initial && Number(previous.talent_id) === Number(item.talent_id));
            if (!duplicateInitial) history.push(item);
        }
        if (item.was_pity) hasPriorPity = true;
    }
}

function runExchangeSequenceWasmSandbox(callback) {
    try {
        if (!wasmInitEngine(TALENT_DATA, ZZ_DATA)) throw new Error('置换脉序引擎初始化失败');
        return callback();
    } finally {
        wasmInitEngine(TALENT_DATA, _buildZZDataForWasm());
        pushStateToWasm();
    }
}

function analyzeExchangeSequenceCandidates(role) {
    if (!role || role.candidatesReady !== false) return;
    runExchangeSequenceWasmSandbox(() => {
        const source = cloneExchangeSequenceValue(role.wasmState);
        source.global_vars = exchangeSequenceDataset.globalVars;
        source.talents = (source.talents || []).map(talent => ({ ...talent, locked: false }));
        if (!wasmSetState(source)) throw new Error(`角色「${role.roleName}」的洗脉进度读取失败，请重新选择人物`);
        const preview = wasmPreviewSequence(10000) || {};
        const purples = Array.isArray(preview.purples) ? preview.purples : [];
        annotateExchangeSequenceShenmaiPairs(purples, source.talents);
        const ordered = purples
            .map((item, index) => ({ item, index }))
            .sort((left, right) => Number(left.item.wash_no) - Number(right.item.wash_no) || left.index - right.index);
        const firstPurple = ordered[0]?.item;
        const directPity = !!(firstPurple && firstPurple.was_pity);
        role.directPitySequence = directPity;
        role.candidates = ordered.map(({ item }) => {
            const isShenmai = isExchangeSequenceShenmaiRecord(item);
            const isDirectPity = directPity && item === firstPurple;
            const normalAvailable = isShenmai
                ? isExchangeSequenceShenmaiTargetWithoutPriorPity(item) && !exchangeSequenceHasPriorPity(item)
                : isExchangeSequenceOrdinaryTargetWithoutPriorPity(item) && !exchangeSequenceHasPriorPity(item);
            const canInitialize = directPity ? isDirectPity : normalAvailable;
            return {
                name: item.talent_name,
                talentId: Number(item.talent_id),
                washNo: Number(item.wash_no),
                conflictName: isShenmai ? item.shenmai_conflict_name : item.earlier_conflict_name,
                conflictWashNo: isShenmai
                    ? Number(item.shenmai_conflict_wash_no || 0)
                    : Number(item.earlier_conflict_wash_no || 0),
                conflictWashTimes: isShenmai
                    ? Number(item.shenmai_conflict_wash_times || 0)
                    : Number(item.earlier_conflict_wash_times || 0),
                isShenmai,
                hasPriorPity: !!item.has_prior_pity,
                shenmaiGap: isShenmai ? item.shenmai_gap : null,
                wasPity: !!item.was_pity,
                isDirectPity,
                canInitialize,
                unavailableReason: canInitialize
                    ? ''
                    : (directPity ? EXCHANGE_SEQUENCE_DIRECT_PITY_MESSAGE : exchangeSequenceCandidateUnavailableReason(item)),
                displayReason: isDirectPity
                    ? '首位保底紫：置换序列已固定'
                    : exchangeSequenceCandidateDisplayReason(item, !directPity),
            };
        });
        role.candidatesReady = true;
    });
}

function updateExchangeSequenceGenerateButton(role = selectedExchangeSequenceRole(), candidate = selectedExchangeSequenceCandidate(role)) {
    const button = document.getElementById('btnGenerateExchangeSequence');
    const disabled = exchangeSequenceRunning || state.dlcMode || !role || !candidate?.canInitialize;
    if (button) button.disabled = disabled;
    const compare = document.getElementById('btnCompareFirstPurple'); if (compare) compare.disabled = disabled;
}

function updateExchangeSequenceSelection() {
    const role = selectedExchangeSequenceRole();
    const candidate = selectedExchangeSequenceCandidate(role);
    const seedSource = document.getElementById('exchangeSequenceSeedSource');
    const selectedLabel = document.getElementById('exchangeSequenceSelectedPurpleLabel');
    const selectedPurple = document.getElementById('exchangeSequenceSelectedPurple');
    const initialLabel = document.getElementById('exchangeSequenceInitialSeedLabel');
    setExchangeSequenceSlotPanels(role);
    updateExchangeSequenceGenerateButton(role, candidate);
    if (!role) {
        if (seedSource) seedSource.textContent = '—';
        if (selectedPurple) selectedPurple.textContent = '—';
        return;
    }
    const fixed = role.seedStatus === 'fixed_luck_seed';
    if (seedSource) {
        seedSource.textContent = fixed ? '置换序列已固定' : '尚未置换，可比较不同垫洗方案';
    }
    if (selectedLabel) selectedLabel.textContent = role.directPitySequence ? '所选首位保底紫' : '所选置换首紫';
    if (initialLabel) initialLabel.textContent = '本次置换起点';
    if (selectedPurple) selectedPurple.textContent = candidate ? `#${candidate.washNo} ${candidate.name}` : '无可选首紫';
}

function renderExchangeSequencePurpleOptions(role) {
    const select = document.getElementById('exchangeSequencePurpleSelect');
    if (!select) return;
    select.innerHTML = '';
    if (role?.candidates.length) {
        role.candidates.forEach((candidate, index) => {
            appendExchangeSequenceOption(
                select,
                index,
                `#${candidate.washNo} ${candidate.name}（${candidate.displayReason || candidate.unavailableReason}）`,
                { disabled: !candidate.canInitialize, className: candidate.wasPity ? 'pity-purple-option' : '' },
            );
        });
        const firstAvailable = role.candidates.findIndex(candidate => candidate.canInitialize);
        if (firstAvailable >= 0) select.value = String(firstAvailable);
        select.disabled = firstAvailable < 0;
    } else {
        appendExchangeSequenceOption(select, '', '该角色当前没有可初始化的首紫');
        select.disabled = true;
    }
    updateExchangeSequenceSelection();
}

async function populateExchangeSequencePurples() {
    const token = ++exchangeSequenceCandidateLoadToken;
    const role = selectedExchangeSequenceRole();
    const select = document.getElementById('exchangeSequencePurpleSelect');
    const status = document.getElementById('exchangeSequenceStatus');
    clearExchangeSequenceResults();
    setExchangeSequenceSlotPanels(role);
    if (!role || !select) return;
    if (state.dlcMode) {
        select.innerHTML = '';
        appendExchangeSequenceOption(select, '', '测试服暂不支持');
        select.disabled = true;
        if (status) {
            status.className = 'exchange-sequence-status is-error';
            status.textContent = '测试服含额外保底累计规则，当前暂不支持置换脉序生成。';
        }
        updateExchangeSequenceGenerateButton(role, null);
        return;
    }
    if (role.candidatesReady === false) {
        select.innerHTML = '';
        appendExchangeSequenceOption(select, '', '正在分析置换首紫…');
        select.disabled = true;
        updateExchangeSequenceGenerateButton(role, null);
        if (status) {
            status.className = 'exchange-sequence-status';
            status.textContent = `正在分析「${role.roleName}」的置换首紫…`;
        }
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (token !== exchangeSequenceCandidateLoadToken || role !== selectedExchangeSequenceRole()) return;
        try {
            analyzeExchangeSequenceCandidates(role);
        } catch (error) {
            if (status) {
                status.className = 'exchange-sequence-status is-error';
                status.textContent = playerError(error);
            }
            return;
        }
        if (token !== exchangeSequenceCandidateLoadToken || role !== selectedExchangeSequenceRole()) return;
    }
    renderExchangeSequencePurpleOptions(role);
    if (status) {
        status.className = 'exchange-sequence-status';
        status.textContent = role.candidates.length ? '' : '该角色当前没有可初始化的置换首紫。';
    }
}

function populateExchangeSequenceRoles() {
    const select = document.getElementById('exchangeSequenceRoleSelect');
    const purpleSelect = document.getElementById('exchangeSequencePurpleSelect');
    const status = document.getElementById('exchangeSequenceStatus');
    if (!select || !purpleSelect) return;
    select.innerHTML = '';
    if (!exchangeSequenceDataset.roles.length) {
        appendExchangeSequenceOption(select, '', '请先导入共享存档');
        select.disabled = true;
        purpleSelect.innerHTML = '';
        appendExchangeSequenceOption(purpleSelect, '', '请先导入共享存档');
        purpleSelect.disabled = true;
        setExchangeSequenceSlotPanels(null);
        updateExchangeSequenceGenerateButton(null, null);
        clearExchangeSequenceResults('请先导入共享存档');
        if (status) {
            status.className = 'exchange-sequence-status is-error';
            status.textContent = '请先在首页导入存档，再生成置换脉序。';
        }
        updateExchangeSequenceSelection();
        return;
    }
    select.disabled = false;
    exchangeSequenceDataset.roles.forEach(role => {
        appendExchangeSequenceOption(select, role.key, `${role.roleKind} · ${role.roleName}`);
    });
    const currentRoleKey = document.getElementById('saveRoleSelect')?.value;
    const preferred = exchangeSequenceDataset.roles.find(role => role.key === currentRoleKey)
        || exchangeSequenceDataset.roles.find(role => role.roleKind === '主角')
        || exchangeSequenceDataset.roles[0];
    select.value = preferred.key;
    void populateExchangeSequencePurples();
}

function openExchangeSequenceFinderModal() {
    const modal = document.getElementById('exchangeSequenceModal');
    if (!modal) return;
    modal.hidden = false;
    document.body?.classList.add('modal-open');
    exchangeSequenceDataset = buildExchangeSequenceDataset();
    exchangeSequenceCandidateLoadToken += 1;
    clearExchangeCompare();
    exchangeSequenceRunning = false;
    clearExchangeSequenceResults();
    populateExchangeSequenceRoles();
}

function closeExchangeSequenceFinderModal() {
    clearExchangeCompare();
    const modal = document.getElementById('exchangeSequenceModal');
    if (modal) modal.hidden = true;
    exchangeSequenceCandidateLoadToken += 1;
    document.body?.classList.remove('modal-open');
    pushStateToWasm();
}

function initializeExchangeSequenceSeed(role, candidate, n) {
    if (!candidate?.canInitialize) throw new Error(candidate?.unavailableReason || '所选紫脉不可进行置换');
    const directPity = !!candidate.isDirectPity;
    const base = cloneExchangeSequenceValue(role.wasmState);
    base.global_vars = exchangeSequenceDataset.globalVars;
    base.talents = (base.talents || []).map(item => ({ ...item, locked: false }));
    base.bag_pills = 999999999;
    base.has_bag_pills = true;
    if (base.luck_seed_inited) {
        const luckSeed = Number(base.luck_seed);
        if (!Number.isFinite(luckSeed)) throw new Error('无法读取当前置换序列，请重新导入存档');
        return { base, luckSeed, fixed: true, directPity };
    }
    if (!wasmSetState(base)) throw new Error('洗脉起点准备失败，请重新导入存档');

    const hasTalent = name => {
        const target = exchangeSequenceTalentByName(name);
        const current = wasmGetState();
        return !!(target && current && current.talents.some(item => Number(item.id) === Number(target.id)));
    };
    const targetTalent = exchangeSequenceTalentByName(candidate.name);
    const targetId = Number(candidate.talentId || targetTalent?.id);
    const isTargetTalent = slot => Number(slot?.id) === targetId;
    if (!Number.isFinite(targetId)) throw new Error(`未找到所选首紫「${candidate.name}」的数据`);

    const lockTalent = name => {
        const target = exchangeSequenceTalentByName(name);
        const current = wasmGetState();
        const slot = target && current?.talents.find(item => Number(item.id) === Number(target.id));
        if (!slot) throw new Error(`洗脉结果中未找到「${name}」`);
        slot.locked = true;
        current.bag_pills = 999999999;
        current.has_bag_pills = true;
        if (!wasmSetState(current)) throw new Error(`锁定「${name}」失败`);
    };

    const findTargetPurpleSnapshot = maxWashes => {
        let remaining = maxWashes;
        while (remaining > 0) {
            const beforeBatch = cloneExchangeSequenceValue(wasmGetState());
            const batchSize = Math.min(128, remaining);
            const batch = wasmWashMulti(batchSize) || [];
            const targetIndex = batch.findIndex(row => (row.talents || []).some(isTargetTalent));
            if (targetIndex >= 0) {
                if (!wasmSetState(beforeBatch)) throw new Error('紫脉定位前状态恢复失败');
                if (targetIndex > 0 && (wasmWashMulti(targetIndex) || []).length !== targetIndex) {
                    throw new Error('紫脉定位前刷新未完整重放');
                }
                const beforeTarget = cloneExchangeSequenceValue(wasmGetState());
                const targetWash = wasmDoWash();
                const targetState = wasmGetState();
                if (!targetWash || !targetState?.talents.some(isTargetTalent)) {
                    throw new Error(`未洗到所选首紫「${candidate.name}」`);
                }
                return { beforeTarget, targetState, targetWash };
            }
            if (batch.length !== batchSize) break;
            remaining -= batchSize;
        }
        throw new Error(`未洗到所选首紫「${candidate.name}」`);
    };

    if (directPity) {
        const { targetState, targetWash } = findTargetPurpleSnapshot(20000);
        if (!targetWash.was_pity) throw new Error('首位保底紫定位结果不是保底脉');
        const luckSeed = Number(targetState?.luck_seed);
        if (!targetState?.luck_seed_inited || !Number.isFinite(luckSeed)) {
            throw new Error('无法读取首位保底紫的置换序列，请重新导入存档');
        }
        return { base, luckSeed, fixed: false, directPity: true };
    }

    const normalizeConflictToFirstSlot = () => {
        const current = wasmGetState();
        const conflict = exchangeSequenceTalentByName(candidate.conflictName);
        const conflictIndex = current && conflict
            ? current.talents.findIndex(item => Number(item.id) === Number(conflict.id))
            : -1;
        if (!current || conflictIndex < 0) throw new Error(`未找到已锁定的首紫冲突脉「${candidate.conflictName}」`);
        const [lockedConflict] = current.talents.splice(conflictIndex, 1);
        lockedConflict.locked = true;
        current.talents = [lockedConflict, ...current.talents.map(item => ({ ...item, locked: false }))];
        current.bag_pills = 999999999;
        current.has_bag_pills = true;
        if (!wasmSetState(current)) throw new Error('首紫冲突脉定位状态写入失败');
    };

    const initializeThreeSlotShenmaiPair = () => {
        const conflictTalent = exchangeSequenceTalentByName(candidate.conflictName);
        const conflictId = Number(conflictTalent?.id);
        if (!Number.isFinite(conflictId)) throw new Error(`未找到神脉冲突「${candidate.conflictName}」的数据`);
        const writeInitializedState = (source, totalTalentBars, targetPosition = null) => {
            const initialized = cloneExchangeSequenceValue(source);
            initialized.talents = [
                { id: conflictId, locked: true },
                { id: 0, locked: false },
                { id: targetId, locked: true },
            ];
            const bars = Number(totalTalentBars);
            if (Number.isFinite(bars)) initialized.total_talent_bars = bars;
            initialized.bag_pills = 999999999;
            initialized.has_bag_pills = true;
            if (!wasmSetState(initialized)) throw new Error('三脉神脉空脉状态写入失败');
            const check = wasmGetState();
            const lockCount = check?.talents.filter(item => item.locked).length || 0;
            if (lockCount !== 2
                || Number(check?.talents[0]?.id) !== conflictId
                || Number(check?.talents[1]?.id) !== 0
                || Number(check?.talents[2]?.id) !== targetId) {
                throw new Error('三脉神脉空脉初始化校验失败');
            }
            return { padLockedCount: lockCount, targetPosition };
        };
        const current = wasmGetState();
        if (current?.talents.some(isTargetTalent)) {
            return writeInitializedState(current, current.total_talent_bars);
        }
        const { beforeTarget, targetState } = findTargetPurpleSnapshot(20000);
        const rawSlots = targetState.talents.filter(item => !item.locked);
        const targetPosition = rawSlots.findIndex(isTargetTalent);
        if (rawSlots.length !== 2 || targetPosition < 0) throw new Error('无法定位所选神脉在三脉刷新批次中的位置');
        const targetPrefix = rawSlots.slice(0, targetPosition + 1).map(item => Number(item.id));
        if (!wasmSetState(beforeTarget)) throw new Error('神脉截断前状态恢复失败');
        const truncated = wasmGetState();
        const requiredLocks = 3 - targetPrefix.length;
        const unlockedIndexes = truncated.talents
            .map((item, index) => (!item.locked ? index : -1))
            .filter(index => index >= 0);
        for (const index of unlockedIndexes) {
            if (truncated.talents.filter(item => item.locked).length >= requiredLocks) break;
            truncated.talents[index] = { id: 0, locked: true };
        }
        truncated.bag_pills = 999999999;
        truncated.has_bag_pills = true;
        if (!wasmSetState(truncated)) throw new Error('三脉神脉截断状态写入失败');
        const truncatedWash = wasmDoWash();
        const truncatedState = wasmGetState();
        const generated = (truncatedState?.talents || []).filter(item => !item.locked).map(item => Number(item.id));
        if (!truncatedWash || generated.length !== targetPrefix.length
            || generated.some((id, index) => id !== targetPrefix[index])) {
            throw new Error('三脉神脉空脉截断未保留所选神脉的原始顺序');
        }
        const startBars = Number(beforeTarget.total_talent_bars) || 0;
        const endBars = Number(truncatedState.total_talent_bars) || 0;
        if (endBars !== startBars + targetPrefix.length || Number(truncatedWash.end_s) !== Number(truncatedState.seed)) {
            throw new Error('三栏神脉置换位置未能核对，请重新生成序列');
        }
        return writeInitializedState(truncatedState, targetState.total_talent_bars, targetPosition);
    };

    const initializeFourSlotEmptyPredecessor = () => {
        const current = wasmGetState();
        if (current?.talents.some(isTargetTalent)) throw new Error('所选首紫已与冲突脉同屏，无法定位紫脉前一条');
        const { beforeTarget, targetState } = findTargetPurpleSnapshot(20000);
        const rawSlots = targetState.talents.filter(item => !item.locked);
        const targetPosition = rawSlots.findIndex(isTargetTalent);
        if (rawSlots.length !== 3 || targetPosition < 0) throw new Error('无法定位所选首紫在四脉刷新批次中的位置');
        const targetPrefix = rawSlots.slice(0, targetPosition + 1).map(item => Number(item.id));
        const previousSlots = beforeTarget.talents.filter(item => !item.locked);
        const secondBefore = targetPosition >= 2
            ? rawSlots[targetPosition - 2]
            : previousSlots[previousSlots.length + targetPosition - 2];
        if (!secondBefore || !Number.isFinite(Number(secondBefore.id))) throw new Error('无法读取所选首紫前第二条脉');
        if (!wasmSetState(beforeTarget)) throw new Error('紫脉截断前状态恢复失败');
        const truncated = wasmGetState();
        const requiredLocks = 4 - targetPrefix.length;
        const unlockedIndexes = truncated.talents
            .map((item, index) => (!item.locked ? index : -1))
            .filter(index => index >= 0);
        const preserveIndex = targetPosition === 0 ? unlockedIndexes[unlockedIndexes.length - 2] : -1;
        for (const index of unlockedIndexes) {
            if (truncated.talents.filter(item => item.locked).length >= requiredLocks) break;
            if (index === preserveIndex) continue;
            truncated.talents[index] = { id: 0, locked: true };
        }
        truncated.bag_pills = 999999999;
        truncated.has_bag_pills = true;
        if (!wasmSetState(truncated)) throw new Error('四脉空脉截断状态写入失败');
        const truncatedWash = wasmDoWash();
        const truncatedState = wasmGetState();
        const generated = (truncatedState?.talents || []).filter(item => !item.locked).map(item => Number(item.id));
        if (!truncatedWash || generated.length !== targetPrefix.length
            || generated.some((id, index) => id !== targetPrefix[index])) {
            throw new Error('四脉空脉截断未保留所选首紫的原始顺序');
        }
        const startBars = Number(beforeTarget.total_talent_bars) || 0;
        const endBars = Number(truncatedState.total_talent_bars) || 0;
        if (endBars !== startBars + targetPrefix.length || Number(truncatedWash.end_s) !== Number(truncatedState.seed)) {
            throw new Error('四栏置换位置未能核对，请重新生成序列');
        }
        const conflict = targetState.talents.find(item => item.locked && Number(item.id) !== 0);
        if (!conflict) throw new Error('四脉空脉定位后丢失首紫冲突脉');
        const initialized = cloneExchangeSequenceValue(truncatedState);
        initialized.talents = [
            { id: Number(conflict.id), locked: true },
            { id: Number(secondBefore.id), locked: false },
            { id: 0, locked: true },
            { id: targetId, locked: true },
        ];
        initialized.total_talent_bars = Number(targetState.total_talent_bars) || initialized.total_talent_bars;
        initialized.bag_pills = 999999999;
        initialized.has_bag_pills = true;
        if (!wasmSetState(initialized)) throw new Error('紫脉前空脉状态写入失败');
        const check = wasmGetState();
        const lockCount = check?.talents.filter(item => item.locked).length || 0;
        if (lockCount !== 3 || Number(check?.talents[3]?.id) !== targetId
            || Number(check?.talents[2]?.id) !== 0 || !check?.talents[2]?.locked) {
            throw new Error('四脉紫脉前空脉初始化校验失败');
        }
        return { extraLockName: '空脉', padLockedCount: lockCount, targetPosition };
    };

    const conflictLimit = Math.max(200, Number(candidate.conflictWashTimes || 0) + 100);
    if (!hasTalent(candidate.conflictName)) wasmWashUntilTalentName(candidate.conflictName, conflictLimit);
    if (!hasTalent(candidate.conflictName)) throw new Error(`未洗到首紫冲突脉「${candidate.conflictName}」`);
    lockTalent(candidate.conflictName);
    const fourSlot = isExchangeSequenceFourSlotRole(role);
    let extraLockName = null;
    let padLockedCount = null;
    let targetPosition = null;
    if (fourSlot) {
        normalizeConflictToFirstSlot();
        ({ extraLockName, padLockedCount, targetPosition } = initializeFourSlotEmptyPredecessor());
    } else if (candidate.isShenmai) {
        ({ padLockedCount, targetPosition } = initializeThreeSlotShenmaiPair());
    } else {
        if (!hasTalent(candidate.name)) wasmWashUntilTalentName(candidate.name, 20000);
        if (!hasTalent(candidate.name)) throw new Error(`未洗到所选首紫「${candidate.name}」`);
        lockTalent(candidate.name);
    }
    const padState = wasmGetState();
    const expectedLocks = fourSlot ? 3 : 2;
    const actualLocks = padState?.talents.filter(item => item.locked).length || 0;
    if (actualLocks !== expectedLocks) throw new Error(`首紫定位前锁定数错误：需要 ${expectedLocks}，实际 ${actualLocks}`);
    if (n > 0 && (wasmWashMulti(n) || []).length !== n) throw new Error(`首紫锁定后未完成 ${n} 次刷新`);
    const initializedState = wasmGetState();
    const luckSeed = Number(initializedState?.seed);
    if (!Number.isFinite(luckSeed)) throw new Error('无法读取所选首紫及垫洗位置对应的置换序列');
    return {
        base,
        luckSeed,
        fixed: false,
        extraLockName,
        padLockedCount: padLockedCount || actualLocks,
        targetPosition,
    };
}

function previewExchangeSequence(base, luckSeed, count) {
    const previewState = cloneExchangeSequenceValue(base);
    previewState.seed = luckSeed;
    previewState.luck_seed = luckSeed;
    previewState.luck_seed_inited = true;
    previewState.talents = (previewState.talents || []).map(item => ({ ...item, locked: false }));
    previewState.total_wash = 0;
    previewState.total_talent_bars = 0;
    previewState.total_pills = 0;
    previewState.pity_count = 0;
    previewState.last_purple_total_pills = null;
    previewState.exchange_count = 0;
    previewState.bag_pills = 999999999;
    previewState.has_bag_pills = true;
    previewState.global_vars = exchangeSequenceDataset.globalVars;
    if (!wasmSetState(previewState)) throw new Error('置换序列状态写入失败');
    let scanLimit = Math.max(20000, count * 3200);
    let pityRows = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const preview = wasmPreviewSequence(scanLimit) || {};
        pityRows = (Array.isArray(preview.purples) ? preview.purples : []).filter(item => item.was_pity);
        if (pityRows.length >= count) break;
        scanLimit = Math.ceil(scanLimit * 1.75);
    }
    if (pityRows.length < count) throw new Error(`只生成 ${pityRows.length}/${count} 条保底紫脉，请减少生成项数`);
    return pityRows.slice(0, count).map((item, index) => ({
        index: index + 1,
        name: item.talent_name,
        talentId: Number(item.talent_id),
        sourceWashNo: Number(item.wash_no),
    }));
}

function buildExchangeSequence(role, candidate, n, count) {
    const initialized = initializeExchangeSequenceSeed(role, candidate, n);
    return {
        outputs: previewExchangeSequence(initialized.base, initialized.luckSeed, count),
        luckSeed: initialized.luckSeed,
        fixed: initialized.fixed,
        directPity: !!initialized.directPity,
        extraLockName: initialized.extraLockName || null,
        padLockedCount: initialized.padLockedCount || null,
    };
}

function renderExchangeSequence(role, candidate, n, result) {
    const initialSeed = document.getElementById('exchangeSequenceInitialSeed');
    const grid = document.getElementById('exchangeSequenceGrid');
    const empty = document.getElementById('exchangeSequenceEmpty');
    const meta = document.getElementById('exchangeSequenceResultMeta');
    if (initialSeed) {
        initialSeed.textContent = result.directPity || result.fixed
            ? '沿用已固定的置换序列'
            : `从首紫后的第 ${n} 条脉开始比较`;
    }
    if (grid) {
        grid.innerHTML = result.outputs.map(item =>
            `<li data-index="${item.index}" data-source-wash-no="${item.sourceWashNo}" title="第 ${item.index} 条保底紫脉"><strong>${item.name}</strong></li>`
        ).join('');
        grid.hidden = false;
    }
    if (empty) empty.hidden = true;
    const extraLock = result.extraLockName ? `（${result.extraLockName}）` : '';
    const lockMode = result.padLockedCount ? ` · ${role.slotCount}脉锁${result.padLockedCount}${extraLock}` : '';
    if (meta) {
        meta.textContent = result.directPity
            ? `${role.roleName} · 首位保底紫 ${candidate.name} · 置换序列已固定 · 前 ${result.outputs.length} 条`
            : `${role.roleName} · 置换首紫 ${candidate.name} · 紫后第 ${n} 条脉${lockMode} · 前 ${result.outputs.length} 条`;
    }
}

function clearExchangeCompare() {
    exchangeCompareToken += 1;
    const results = document.getElementById('exchangeCompareResults'), status = document.getElementById('exchangeCompareStatus');
    if (results) results.replaceChildren();
    if (status) status.textContent = '选择首紫后可生成列表。';
    exchangeSequenceRunning = false;
    updateExchangeSequenceGenerateButton();
}

async function compareFirstPurple() {
    if (exchangeSequenceRunning || state.dlcMode) return;
    const role = selectedExchangeSequenceRole(), candidate = selectedExchangeSequenceCandidate(role);
    const limitInput = document.getElementById('exchangeCompareLimit'), status = document.getElementById('exchangeCompareStatus'), host = document.getElementById('exchangeCompareResults');
    if (!role || !candidate?.canInitialize || !status || !host || !limitInput) return;
    const limit = Number(limitInput.value);
    if (!limitInput.value.trim() || !Number.isInteger(limit) || limit < 0 || limit > 100) { status.textContent = '请输入 0 到 100 的整数。'; return; }
    const fixed = candidate.isDirectPity || role.seedStatus === 'fixed_luck_seed';
    const last = fixed ? 0 : limit, token = ++exchangeCompareToken;
    exchangeSequenceRunning = true;updateExchangeSequenceGenerateButton(role,candidate);host.replaceChildren();
    const table = document.createElement('table');table.className = 'exchange-compare-table';const head = document.createElement('thead'), header = document.createElement('tr');
    for (const label of [fixed ? '置换条件' : isExchangeSequenceFourSlotRole(role) ? '首紫后脉序位置' : '锁紫后垫洗次数','首次置换结果','完整序列']) { const th=document.createElement('th');th.scope='col';th.textContent=label;header.append(th); }head.append(header);table.append(head);const body=document.createElement('tbody');table.append(body);host.append(table);
    try {
        for (let n=0;n<=last;n++) {
            if (token!==exchangeCompareToken || document.getElementById('exchangeSequenceModal')?.hidden || selectedExchangeSequenceRole()!==role || selectedExchangeSequenceCandidate(role)!==candidate) return;
            status.textContent=`正在比较 ${n+1} / ${last+1}…`;
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve,0)));
            if (token!==exchangeCompareToken) return;
            const line=document.createElement('tr'),position=document.createElement('td'),value=document.createElement('td'),action=document.createElement('td');position.textContent=fixed?'已固定':String(n);
            try {
                const result=runExchangeSequenceWasmSandbox(()=>buildExchangeSequence(role,candidate,n,1));
                value.textContent=result.outputs[0]?.name || '未找到';
                const show=document.createElement('button');show.type='button';show.disabled=true;show.textContent='查看';show.setAttribute('aria-label',`查看${fixed?'当前固定序列':`位置 ${n}`}的完整置换序列`);
                show.onclick=()=>{const input=activeExchangeSequencePadInput(role);if(input)input.value=String(n);generateExchangeSequence();};action.append(show);
            } catch(error) {value.textContent=playerError(error);}
            line.append(position,value,action);body.append(line);
        }
        if(token===exchangeCompareToken)status.textContent=fixed?'置换序列已固定，垫洗不会改变置换结果。':`已比较 ${last+1} 个位置；点击“查看”可生成对应的完整置换序列。`;
    } finally { if(token===exchangeCompareToken){exchangeSequenceRunning=false;host.querySelectorAll('button').forEach(button=>{button.disabled=false});updateExchangeSequenceGenerateButton();} }
}

function generateExchangeSequence() {
    if (exchangeSequenceRunning || state.dlcMode) return;
    const role = selectedExchangeSequenceRole();
    const candidate = selectedExchangeSequenceCandidate(role);
    const status = document.getElementById('exchangeSequenceStatus');
    const countInput = document.getElementById('exchangeSequenceCountInput');
    if (!role || !candidate?.canInitialize) {
        if (status) {
            status.className = 'exchange-sequence-status is-error';
            status.textContent = candidate?.unavailableReason || '请先选择可初始化的置换首紫。';
        }
        return;
    }
    const n = candidate.isDirectPity ? 0 : readExchangeSequencePadValue(role);
    const count = Math.max(20, Math.min(1000, Math.trunc(Number(countInput?.value) || 20)));
    if (countInput) countInput.value = String(count);
    exchangeSequenceRunning = true;
    updateExchangeSequenceGenerateButton(role, candidate);
    clearExchangeSequenceResults('正在生成置换脉序…');
    if (status) {
        status.className = 'exchange-sequence-status';
        status.textContent = candidate.isDirectPity ? '正在查看已固定的置换序列…' : '正在生成保底紫脉序列…';
    }
    requestAnimationFrame(() => {
        try {
            const result = runExchangeSequenceWasmSandbox(() => buildExchangeSequence(role, candidate, n, count));
            renderExchangeSequence(role, candidate, n, result);
            if (status) status.textContent = '';
        } catch (error) {
            if (status) {
                status.className = 'exchange-sequence-status is-error';
                status.textContent = playerError(error);
            }
            clearExchangeSequenceResults('置换脉序生成失败');
        } finally {
            exchangeSequenceRunning = false;
            updateExchangeSequenceGenerateButton();
        }
    });
}

let cachedPurpleData = { purples: [], luck_pool: [] };
let cachedPurpleKey = '';
let currentMaxWashes = 3000;
let routeWashNos = [];
let routePadCount = 0;

function washPredictionStateSnapshot() {
    return {
        saveVersion: state.saveVersion || '',
        saveChannel: state.saveChannel || '',
        bornTalentRC: Number(state.bornTalentRC) || 0,
        dlcMode: state.dlcMode,
        mode: state.mode,
        zizhi: state.zizhi,
        sex: state.sex,
        vip: state.vip,
        seed: state.seed,
        luckSeed: state.luckSeed,
        luckSeedInited: state.luckSeedInited,
        roleId: state.roleId,
        salt: state.salt,
        talents: state.talents.map(t => ({ id: t.id, locked: !!t.locked })),
        talLucky: state.talLucky,
        totalWash: state.totalWash,
        totalTalentBars: state.totalTalentBars,
        totalPills: state.totalPills,
        bagPills: state.bagPills,
        hasBagPills: state.hasBagPills,
        goldCount: state.goldCount,
        pityCount: state.pityCount,
        qualityCounts: state.qualityCounts,
        lastPurpleTotalPills: state.lastPurpleTotalPills,
        exchangeCount: state.exchangeCount,
        gifts: [state.strGift, state.conGift, state.dexGift, state.intGift],
        roleLevel: state.roleLevel,
        roleStats: state.roleStats,
        globalVars: state.globalVars,
    };}

function purpleCacheKey() {
    return JSON.stringify({
        max: currentMaxWashes,
        state: washPredictionStateSnapshot(),
    });
}

function invalidatePurpleCache() {
    updateCustomWashUndoButton();
    cachedPurpleKey = '';
    cachedPurpleData = { purples: [], luck_pool: [] };
    cachedExchangePadKey = '';
    cachedExchangePadResults = null;
    if (typeof invalidateAiPrediction === 'function') invalidateAiPrediction();
}

function ensurePurpleSequenceCache({ force = false } = {}) {
    const key = purpleCacheKey();
    if (!force && cachedPurpleKey === key && cachedPurpleData.purples) {
        return cachedPurpleData;
    }
    pushStateToWasm();
    const rawRes = wasmPreviewSequence(currentMaxWashes);
    cachedPurpleData = rawRes || { purples: [], luck_pool: [] };
    cachedPurpleKey = key;
    return cachedPurpleData;
}

function openPurpleAnalysisModal() {
    currentMaxWashes = 3000;
    const modal = document.getElementById('purpleModal');
    if (modal) {
        modal.hidden = false;
        document.body?.classList.add('modal-open');
    }
    const tbody = document.getElementById('purpleTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="loading-td">正在分析推演脉序中...</td></tr>`;
    requestAnimationFrame(() => {
        ensurePurpleSequenceCache({ force: true });
        paintPurpleForecastTable();
        renderExchangeAnalysisBlock();
    });
}

function closePurpleAnalysisModal() {
    const modal = document.getElementById('purpleModal');
    if (modal) modal.hidden = true;
    document.body?.classList.remove('modal-open');
}

function loadMoreSequence() {
    currentMaxWashes += 3000;
    const tbody = document.getElementById('purpleTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="loading-td">正在扩展脉序至 ${currentMaxWashes}...</td></tr>`;
    requestAnimationFrame(() => {
        ensurePurpleSequenceCache({ force: true });
        paintPurpleForecastTable();
        renderExchangeAnalysisBlock();
    });
}

function renderPurpleForecastTable() {
    ensurePurpleSequenceCache();
    paintPurpleForecastTable();
    renderExchangeAnalysisBlock();
}

function paintPurpleForecastTable() {
    const tbody = document.getElementById('purpleTableBody');
    if (!tbody) return;

    const purples = cachedPurpleData.purples || [];

    const searchKeyword = (document.getElementById('purpleSearchInput')?.value || '').trim().toLowerCase();
    const exchangeOnly = document.getElementById('filterExchangeOnly')?.checked || false;
    const pityOnly = document.getElementById('filterPityOnly')?.checked || false;

    let filtered = purples.filter(item => {
        if (exchangeOnly && !item.can_exchange) return false;
        if (pityOnly && !item.was_pity) return false;
        if (searchKeyword) {
            const nameMatch = item.talent_name.toLowerCase().includes(searchKeyword);
            const conflictMatch = (item.earlier_conflict_name || '').toLowerCase().includes(searchKeyword);
            if (!nameMatch && !conflictMatch) return false;
        }
        return true;
    });

    const totalPurples = purples.length;
    const exchangeableTotal = purples.filter(i => i.can_exchange).length;

    const elMax = document.getElementById('currentMaxWashesDisplay');
    const elTotal = document.getElementById('purpleCount');
    const elEx = document.getElementById('exchangeableCount');
    if (elMax) elMax.textContent = currentMaxWashes;
    if (elTotal) elTotal.textContent = totalPurples;
    if (elEx) elEx.textContent = exchangeableTotal;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading-td">未找到符合条件的紫脉（已预测 ${currentMaxWashes} 次洗髓 / 脉序按天赋条数）</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach((item, idx) => {
        const pityTag = item.was_pity
            ? '<span class="tag-pity" title="未锁定连洗下的保底预测；中途锁脉后保底紫可能换成别的（与游戏一致）">保底</span>'
            : '-';

        let conflictText = '-';
        if (item.earlier_conflict_name) {
            const prevWashStr = item.earlier_conflict_wash_no === 0 ? '初始槽位' : `#${item.earlier_conflict_wash_no}`;
            const gapStr = item.earlier_conflict_gap != null ? `相距 ${item.earlier_conflict_gap} 条` : '';
            const purpleTag = item.earlier_conflict_is_purple ? ' · 紫' : '';
            conflictText = `<span class="conflict-cell">前有「${item.earlier_conflict_name}」<span class="conflict-wash-no">(${prevWashStr}，${gapStr}${purpleTag})</span></span>`;
        } else if (item.block_reason) {
            conflictText = `<span class="text-muted">${item.block_reason}</span>`;
        }

        let actionBtn = '-';
        if (item.can_exchange) {
            const isSelected = routeWashNos.includes(item.wash_no);
            actionBtn = `
                <button class="btn-select-exchange ${isSelected ? 'active' : ''}" data-washno="${item.wash_no}">
                    ${isSelected ? '已选推演' : '选择推演'}
                </button>
            `;
        }

        html += `
            <tr data-washno="${item.wash_no}">
                <td>#${idx + 1}</td>
                <td><b>#${item.wash_no}</b><div class="conflict-wash-no">洗${item.wash_times || '-'}次</div></td>
                <td><b class="purple-bright">${item.talent_name}</b></td>
                <td>${pityTag}</td>
                <td>${conflictText}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.btn-select-exchange').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const washNo = parseInt(e.target.getAttribute('data-washno'));
            const idx = routeWashNos.indexOf(washNo);
            if (idx >= 0) {
                routeWashNos.splice(idx, 1);
            } else {
                routeWashNos.push(washNo);
                routeWashNos.sort((a, b) => a - b);
            }
            cachedExchangePadKey = '';
            const maxPad = getRouteMaxPad();
            if (routePadCount > maxPad) routePadCount = maxPad;
            paintPurpleForecastTable();
            renderExchangeAnalysisBlock();
        });
    });
}

function findNextPurpleAfter(afterSeq) {
    const purples = cachedPurpleData.purples || [];
    const after = Math.max(0, Number(afterSeq) || 0);
    return purples.find(p => p.wash_no > after) || null;
}

function hasLockableNonPurpleConflict(item) {
    return !!(item && item.can_exchange && item.earlier_conflict_name && !item.earlier_conflict_is_purple);
}

function highlightPurpleRow(washNo, { conflict = false } = {}) {
    const tbody = document.getElementById('purpleTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.row-highlight').forEach(tr => {
        tr.classList.remove('row-highlight', 'row-highlight-conflict');
    });
    const row = tbody.querySelector(`tr[data-washno="${washNo}"]`);
    if (!row) return;
    row.classList.add('row-highlight');
    if (conflict) row.classList.add('row-highlight-conflict');
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function findTalentSlotIndexByName(name) {
    if (!name) return -1;
    return state.talents.findIndex(t => {
        const td = TALENT_DATA[String(t.id)];
        return td && td.name === name;
    });
}

function lockTalentByName(name) {
    const idx = findTalentSlotIndexByName(name);
    if (idx < 0) return false;
    if(!state.talents[idx].locked){const before=manualRouteState();state.talents[idx].locked=true;recordManualRoute('lock',before,'锁定「'+name+'」');}
    return true;
}

function canContinueWash() {
    const zzConfig = getZZConfig();
    if (zzConfig.num_talent === 0) return false;
    const lockedCount = state.talents.filter(t => t.locked).length;
    return zzConfig.num_talent > lockedCount;
}

function batchWashTimes(times) {
    return trackManualWash(() => {
        if (times <= 0 || !canContinueWash()) return 0;
        if (state.dlcMode || manualWashStepTracking) {
            const batch = [];
            for (let i = 0; i < times; i++) {
                const result = doWash();
                if (!result) break;
                batch.push(result);
            }
            if (batch.length) addLogEntries(batch);
            return batch.length;
        }
        pushStateToWasm();
        const rawBatch = wasmWashMulti(times);
        if (!rawBatch || !rawBatch.length) return 0;
        pullStateFromWasm();
        addLogEntries(rawBatch.map(convertWashResult));
        return rawBatch.length;
    });
}

function batchWashUntilName(name, maxWashes = 5000) {
    return trackManualWash(() => {
        if (!name) return { washed: 0, found: false };
        if (findTalentSlotIndexByName(name) >= 0) return { washed: 0, found: true };
        if (!canContinueWash()) return { washed: 0, found: false };
        if (state.dlcMode || manualWashStepTracking) {
            const batch = [];
            let found = false;
            for (let i = 0; i < maxWashes; i++) {
                const result = doWash();
                if (!result) break;
                batch.push(result);
                found = findTalentSlotIndexByName(name) >= 0;
                if (found) break;
            }
            if (batch.length) addLogEntries(batch);
            return { washed: batch.length, found };
        }
        pushStateToWasm();
        const rawBatch = wasmWashUntilTalentName(name, maxWashes);
        if (!rawBatch || !rawBatch.length) {
            pullStateFromWasm();
            return { washed: 0, found: findTalentSlotIndexByName(name) >= 0 };
        }
        pullStateFromWasm();
        addLogEntries(rawBatch.map(convertWashResult));
        return { washed: rawBatch.length, found: findTalentSlotIndexByName(name) >= 0 };
    });
}

function washToConflictAndLock(item) {
    if (!item || !item.earlier_conflict_name) {
        alert('该紫脉没有可锁定的前置冲突脉');
        return;
    }
    if (item.earlier_conflict_is_purple) {
        alert(`冲突「${item.earlier_conflict_name}」为紫脉/神脉，请改在「紫脉脉序与置换推演」中操作神脉互冲`);
        return;
    }
    const conflictTimes = item.earlier_conflict_wash_times || 0;
    const conflictSeq = item.earlier_conflict_wash_no || 0;
    if (conflictTimes > 0 && state.totalWash > conflictTimes) {
        alert(`当前已洗 ${state.totalWash} 次（超过冲突脉洗髓次数 ${conflictTimes}，脉序 #${conflictSeq}）。请重置网页后重试。`);
        return;
    }
    if (conflictTimes > state.totalWash) {
        const need = conflictTimes - state.totalWash;
        const n = batchWashTimes(need);
        if (n < need && state.totalWash < conflictTimes) {
            updateAll();
            alert('未能洗到冲突脉');
            return;
        }
    }
    if (findTalentSlotIndexByName(item.earlier_conflict_name) < 0) {
        const r = batchWashUntilName(item.earlier_conflict_name, 80);
        if (!r.found) {
            updateAll();
            alert(`脉序 #${conflictSeq || '-'}（洗${conflictTimes || state.totalWash}次）附近未出现「${item.earlier_conflict_name}」`);
            return;
        }
    }
    lockTalentByName(item.earlier_conflict_name);
    updateAll();
    findAndShowNextConflict(state.totalTalentBars);
}

function washToPurpleTalent(item) {
    if (!item) return;
    if (findTalentSlotIndexByName(item.talent_name) >= 0) {
        updateAll();
        findAndShowNextConflict(state.totalTalentBars);
        return;
    }
    const r = batchWashUntilName(item.talent_name, 5000);
    updateAll();
    if (!r.found) {
        alert(r.washed > 0
            ? `连洗 ${r.washed} 次仍未出现「${item.talent_name}」，请确认已锁定冲突脉`
            : '未能洗到紫脉');
    }
    findAndShowNextConflict(state.totalTalentBars);
}

function washConflictThenPurple(item) {
    washToConflictAndLock(item);
    if (findTalentSlotIndexByName(item.earlier_conflict_name) < 0) return;
    washToPurpleTalent(item);
}

function findAndShowNextConflict(afterSeq) {
    const box = document.getElementById('nextConflictResult');
    const afterEl = document.getElementById('nextConflictAfterWash');
    const after = afterSeq != null ? afterSeq : (state.totalTalentBars || 0);
    if (afterEl) afterEl.value = String(after);

    ensurePurpleSequenceCache();

    const item = findNextPurpleAfter(after);
    if (!box) return item;

    if (!item) {
        box.innerHTML = `<span class="text-muted">脉序 #${after} 之后未找到紫脉（可先打开「紫脉脉序与置换推演」加载更多；脉序=天赋条数）</span>`;
        return null;
    }

    if (!hasLockableNonPurpleConflict(item)) {
        const reason = item.block_reason
            || (!item.earlier_conflict_name
                ? `下一紫「${item.talent_name}」无同类冲突，无法置换`
                : (item.earlier_conflict_is_purple
                    ? `下一紫「${item.talent_name}」冲突为紫脉/神脉「${item.earlier_conflict_name}」，无非紫脉冲突可锁定（神脉可在脉序推演中互冲）`
                    : `下一紫「${item.talent_name}」不可按锁冲突流程置换`));
        box.innerHTML = `
            <div class="nc-steps" style="color:var(--red)">查询不到可锁定的非紫冲突脉</div>
            <div>下一紫：<b class="purple-bright">#${item.wash_no} ${item.talent_name}</b>${item.was_pity ? ' · 保底' : ''}</div>
            <div class="nc-steps">${reason}</div>
            <div class="nc-actions">
                <button type="button" class="btn btn-wash-custom" id="btnNcFindAfter" data-after="${item.wash_no}">再查其后下一紫</button>
            </div>
        `;
        const afterBtn = box.querySelector('#btnNcFindAfter');
        if (afterBtn) {
            afterBtn.addEventListener('click', () => {
                findAndShowNextConflict(parseInt(afterBtn.getAttribute('data-after'), 10));
            });
        }
        return null;
    }

    const curBars = state.totalTalentBars || 0;
    const curWash = state.totalWash || 0;
    const conflictSeq = item.earlier_conflict_wash_no || 0;
    const conflictTimes = item.earlier_conflict_wash_times || 0;
    const prevWashStr = conflictSeq === 0 ? '初始槽位' : `#${conflictSeq}`;
    const gapStr = item.earlier_conflict_gap != null ? `相距 ${item.earlier_conflict_gap} 条` : '';
    const pity = item.was_pity ? ' · 保底' : '';

    const toConflictWash = conflictTimes > curWash ? conflictTimes - curWash : 0;
    const toPurpleWash = (item.wash_times || 0) > curWash ? (item.wash_times - curWash) : 0;
    const hasConflictNow = findTalentSlotIndexByName(item.earlier_conflict_name) >= 0;
    const conflictLocked = hasConflictNow && state.talents[findTalentSlotIndexByName(item.earlier_conflict_name)]?.locked;
    const hasPurpleNow = findTalentSlotIndexByName(item.talent_name) >= 0;

    let statusHtml = `<div class="nc-steps">当前：脉序 <b>#${curBars}</b>（已洗 ${curWash} 次）`;
    if (hasPurpleNow) {
        statusHtml += ` · 已刷出「${item.talent_name}」，可直接置换`;
    } else if (conflictLocked) {
        statusHtml += ` · 已锁定「${item.earlier_conflict_name}」，约再洗 <b>${toPurpleWash}</b> 次到紫`;
    } else if (hasConflictNow) {
        statusHtml += ` · 槽内已有「${item.earlier_conflict_name}」，请锁定后继续洗`;
    } else if (conflictTimes > 0 && curWash < conflictTimes) {
        statusHtml += ` · 约再洗 <b>${toConflictWash}</b> 次到冲突，再到紫约 <b>${toPurpleWash}</b> 次`;
    } else if (conflictTimes > 0 && curWash > conflictTimes) {
        statusHtml += ` · 已过冲突洗髓次数 ${conflictTimes}（脉序 #${conflictSeq}），此条需回档/重置`;
    }
    statusHtml += '</div>';

    const stepsHtml = `
        <div class="nc-steps">
            洗脉步骤：洗到 <b>${prevWashStr}</b> 锁定「<b>${item.earlier_conflict_name}</b>」
            → 继续洗到「<b class="purple-bright">${item.talent_name}</b>」（脉序 #${item.wash_no}）后点置换
            ${gapStr ? `（${gapStr}）` : ''}
        </div>
    `;

    const pastConflict = conflictTimes > 0 && curWash > conflictTimes && !hasConflictNow;
    box.innerHTML = `
        <div>
            下一紫：<b class="purple-bright">#${item.wash_no} ${item.talent_name}</b>${pity}
            <span class="text-muted">（洗髓第 ${item.wash_times || '-'} 次）</span>
        </div>
        <div>
            最近冲突脉：
            「<b style="color:var(--red)">${item.earlier_conflict_name}</b>」(${prevWashStr}${gapStr ? '，' + gapStr : ''})
        </div>
        ${statusHtml}
        ${stepsHtml}
        <div class="nc-actions">
            ${!pastConflict ? `
                <button type="button" class="btn btn-wash-gold" id="btnNcWashLock">洗到冲突并锁定</button>
                <button type="button" class="btn btn-wash-custom" id="btnNcWashPurple">继续洗到紫脉</button>
                <button type="button" class="btn btn-wash" id="btnNcWashAll">一键锁冲突洗到紫</button>
            ` : ''}
            ${hasConflictNow && !conflictLocked ? `
                <button type="button" class="btn btn-wash-gold" id="btnNcLockOnly">锁定「${item.earlier_conflict_name}」</button>
            ` : ''}
            <button type="button" class="btn btn-wash-custom" id="btnNcFindAfter" data-after="${item.wash_no}">再查其后下一紫</button>
        </div>
    `;

    const btnLockWash = box.querySelector('#btnNcWashLock');
    if (btnLockWash) btnLockWash.addEventListener('click', () => washToConflictAndLock(item));
    const btnPurple = box.querySelector('#btnNcWashPurple');
    if (btnPurple) btnPurple.addEventListener('click', () => washToPurpleTalent(item));
    const btnAll = box.querySelector('#btnNcWashAll');
    if (btnAll) btnAll.addEventListener('click', () => washConflictThenPurple(item));
    const btnLockOnly = box.querySelector('#btnNcLockOnly');
    if (btnLockOnly) {
        btnLockOnly.addEventListener('click', () => {
            lockTalentByName(item.earlier_conflict_name);
            updateAll();
            findAndShowNextConflict(state.totalTalentBars);
        });
    }
    const afterBtn = box.querySelector('#btnNcFindAfter');
    if (afterBtn) {
        afterBtn.addEventListener('click', () => {
            findAndShowNextConflict(parseInt(afterBtn.getAttribute('data-after'), 10));
        });
    }

    return item;
}

function formatExchangeChainHtml(chain) {
    if (!chain || !chain.length) return '<span class="text-muted">-</span>';
    if (chain.length === 1) {
        const only = chain[0];
        if (/跳过|锁留/.test(only)) return `<span class="text-muted">${only}</span>`;
        return `<b class="purple-bright">${only}</b>`;
    }
    const head = chain.slice(0, -1).map(n => `${n}<span class="reconflict-tag">(再冲突)</span>`).join(' ➔ ');
    return `${head} ➔ <b class="purple-bright">${chain[chain.length - 1]}</b>`;
}

function formatShenmaiForkLine(fork) {
    if (!fork) return '';
    const from = fork.exchange_from || '?';
    const chain = fork.chain || [];
    const rolls = Number(fork.pity_rolls_first) || 0;
    const seedHint = '';
    if (!chain.length) {
        return `<div class="shenmai-fork"><span class="text-muted">换「${from}」</span> ➔ - ${seedHint}</div>`;
    }
    if (/失败/.test(chain[0] || '')) {
        return `<div class="shenmai-fork"><span class="text-muted">换「${from}」</span> ➔ <span class="text-muted">${chain[0]}</span></div>`;
    }
    return `<div class="shenmai-fork"><span class="text-muted">换「${from}」</span> ➔ ${formatExchangeChainHtml(chain)} ${seedHint}</div>`;
}

function formatShenmaiForkNote(forks) {
    const finals = forks.map(f => f.final_name || '');
    const finalsSame = finals.every(n => n && n === finals[0]);
    const afterSeeds = forks.map(f => String(f.luck_seed_after_first ?? ''));
    const seedsSame = afterSeeds.every(s => s === afterSeeds[0]);
    const rolls = forks.map(f => Number(f.pity_rolls_first) || 0);
    const rollsSame = rolls.every(r => r === rolls[0]);
    const chainsSame = forks.every(f => JSON.stringify(f.chain || []) === JSON.stringify(forks[0].chain || []));

    if (!finalsSame) {
        return `<div class="shenmai-fork-note text-muted">换掉不同神脉，会保留不同的另一条神脉；置换会避开仍持有的同名天赋，因此后续结果可能不同。</div>`;
    }
    if (chainsSame && seedsSame && rollsSame) {
        return `<div class="shenmai-fork-note text-muted">本次无论换掉哪条神脉，都会得到相同的置换结果和后续脉序。</div>`;
    }
    return `<div class="shenmai-fork-note text-muted">两种换法这次得到的天赋相同，但后续置换序列已经不同，继续洗脉时请分别查看。</div>`;
}

function formatFollowingNodesBrief(following) {
    if (!following || !following.length) return '<span class="text-muted">（无后续目标）</span>';
    return following.map(n => {
        const name = n.purple_name || '?';
        if (n.shenmai_forks && n.shenmai_forks.length >= 2) {
            const forks = n.shenmai_forks.map(f => `换${f.exchange_from}→${f.final_name || '?'}`).join('；');
            return `<span class="chain-follow-item"><b>${name}</b>：${forks}</span>`;
        }
        const c0 = (n.chain && n.chain[0]) || n.final_name || '-';
        if (/跳过|锁留/.test(c0)) {
            return `<span class="chain-follow-item"><b>${name}</b>：${c0}</span>`;
        }
        const fin = n.final_name || c0;
        const mid = (n.chain && n.chain.length > 1)
            ? `${n.chain.slice(0, -1).join('→')}→${fin}`
            : fin;
        return `<span class="chain-follow-item"><b>${name}</b>→${mid}</span>`;
    }).join('<span class="text-muted"> ｜ </span>');
}

function formatChainStopAltsHtml(node) {
    const alts = node.chain_stop_alts || [];
    if (alts.length < 2) return '';
    const rows = alts.map(alt => {
        const tag = alt.is_full_chain
            ? '<span class="reconflict-tag">打满</span>'
            : `<span class="reconflict-tag">第${Number(alt.stop_at) + 1}环停</span>`;
        return `<div class="chain-stop-row">
            保留「<b class="purple-bright">${alt.keep_name}</b>」${tag}
            → 后续 ${formatFollowingNodesBrief(alt.following_nodes)}
        </div>`;
    }).join('');
    return `
        <details class="chain-stop-alts">
            <summary>展开：中途保留时后续脉结果（${alts.length} 种停法）</summary>
            <div class="chain-stop-body">${rows}</div>
        </details>
    `;
}

function formatNodeExchangeResult(node) {
    if (!node) return '<span class="text-muted">-</span>';
    const forks = node.shenmai_forks || [];
    if (forks.length >= 2) {
        return `<div class="shenmai-forks">${forks.map(formatShenmaiForkLine).join('')}${formatShenmaiForkNote(forks)}</div>`;
    }
    const chain = node.chain || [];
    if (!chain.length) return '<span class="text-muted">-</span>';
    if (/跳过|锁留/.test(chain[0] || '')) return formatExchangeChainHtml(chain);
    const from = node.purple_name || '';
    const conf = node.conflict_name && node.conflict_name !== '—'
        ? `<span class="reconflict-tag">←${node.conflict_name}</span>`
        : '';
    let main;
    if (chain.length === 1 && from && chain[0] !== from) {
        main = `<span class="text-muted">置换「${from}」${conf}</span> ➔ <b class="purple-bright">${chain[0]}</b>`;
    } else {
        main = `<span class="text-muted">置换「${from}」${conf}</span> ➔ ${formatExchangeChainHtml(chain)}`;
    }
    return `${main}${formatChainStopAltsHtml(node)}`;
}

function getRouteMaxPad() {
    if (routeWashNos.length >= 2) {
        const gap = routeWashNos[1] - routeWashNos[0];
        return Math.max(0, Math.min(200, Math.max(0, gap - 1)));
    }
    return 30;
}

function isShenmaiTalentId(id) {
    return id === 248 || id === 249 || id === 250;
}

function buildExchangeRouteTargets() {
    const purples = cachedPurpleData.purples || [];
    return routeWashNos.map((wn, idx) => {
        const item = purples.find(p => p.wash_no === wn);
        if (!item) return null;
        const shenmai = isShenmaiTalentId(item.talent_id);
        if (!item.earlier_conflict_name && !shenmai) return null;
        const lockOnly = shenmai && !item.earlier_conflict_name;
        return {
            purple_name: item.talent_name,
            conflict_name: item.earlier_conflict_name || '',
            conflict_wash_no: (!lockOnly && idx === 0) ? (item.earlier_conflict_wash_times || 0) : 0,
            lock_only: lockOnly,
        };
    }).filter(Boolean);
}

let cachedExchangePadResults = null;
let cachedExchangePadKey = '';

function getExchangePadResults(maxPad) {
    const targets = buildExchangeRouteTargets();
    const key = JSON.stringify({
        targets,
        maxPad,
        washNos: routeWashNos.slice(),
        state: washPredictionStateSnapshot(),
    });
    if (cachedExchangePadKey === key && cachedExchangePadResults) {
        return cachedExchangePadResults;
    }
    pushStateToWasm();
    const results = wasmPreviewExchangePads(targets, maxPad) || [];
    cachedExchangePadKey = key;
    cachedExchangePadResults = results;
    return results;
}

function renderExchangeAnalysisBlock() {
    const container = document.getElementById('exchangeBlockContent');
    if (!container) return;

    const purples = cachedPurpleData.purples || [];

    if (!routeWashNos.length) {
        container.innerHTML = `<div class="block-empty">尚未选择可置换紫脉。请在上方表格点击「选择推演」（建议选 2~3 条，共同推演置换脉序）</div>`;
        return;
    }

    const routeItems = routeWashNos.map(wn => purples.find(p => p.wash_no === wn)).filter(Boolean);
    if (!routeItems.length) {
        container.innerHTML = `<div class="block-empty">所选脉序已不在当前预测范围内，请重新选择</div>`;
        return;
    }
    if (routeItems.some(i => !i.earlier_conflict_name && !isShenmaiTalentId(i.talent_id))) {
        container.innerHTML = `<div class="block-empty">所选紫脉缺少冲突脉信息，无法推演置换</div>`;
        return;
    }

    const maxPad = getRouteMaxPad();
    if (routePadCount > maxPad) routePadCount = maxPad;
    if (routePadCount < 0) routePadCount = 0;

    const previewPads = Math.min(maxPad, Math.max(8, routePadCount + 3));
    const padResults = getExchangePadResults(previewPads);
    const selected = padResults.find(r => r.pad === routePadCount) || padResults[0];

    const luckInited = !!state.luckSeedInited;
    const mechTip = luckInited
        ? '当前置换序列已固定。继续垫洗不会重新选择首紫的置换序列，下表沿用当前进度推演。'
        : '尚未进行首次置换或触发保底。先锁住冲突脉、开至少三栏，再洗出首紫；保持冲突对并多垫洗一次，可比较另一条置换序列。首次置换或保底后，序列便会固定。';

    let nodesSummaryHtml = routeItems.map((item, idx) => {
        const nodeSim = selected && selected.nodes ? selected.nodes[idx] : null;
        const resultHtml = nodeSim ? formatNodeExchangeResult(nodeSim) : '-';
        const lastHint = nodeSim && nodeSim.last_slot_name
            ? `<span class="card-last-slot">末格：${nodeSim.last_slot_name}</span>`
            : '';
        const roleLabel = idx === 0 ? '首紫（可垫洗）' : `第${idx + 1}紫（锁定后固定）`;
        let conflictHtml;
        if (nodeSim && nodeSim.conflict_name) {
            conflictHtml = `冲突：${nodeSim.conflict_name}`;
        } else if (item.earlier_conflict_name) {
            const prevWashStr = item.earlier_conflict_wash_no === 0 ? '初始槽位' : `#${item.earlier_conflict_wash_no}`;
            const gapStr = item.earlier_conflict_gap != null ? `相距 ${item.earlier_conflict_gap} 条` : '';
            conflictHtml = `冲突：「${item.earlier_conflict_name}」(${prevWashStr}${gapStr ? '，' + gapStr : ''})`;
        } else if (isShenmaiTalentId(item.talent_id)) {
            conflictHtml = '冲突：锁留（前序若已有神脉则自动互冲置换）';
        } else {
            conflictHtml = '冲突：-';
        }
        return `
            <div class="selected-exchange-card ${idx === 0 ? '' : 'fixed-node'}">
                <div class="card-header">
                    <span class="card-title">#${idx + 1} ${roleLabel}：<b>#${item.wash_no} ${item.talent_name}</b></span>
                    <span class="card-conflict">${conflictHtml}</span>
                    ${lastHint}
                    <button class="btn-remove-route-item btn-reset-role" data-washno="${item.wash_no}">移除</button>
                </div>
                <div class="exchange-stepper">
                    <span class="step-result">置换结果：${resultHtml}</span>
                </div>
            </div>
        `;
    }).join('');

    let tableHead = '<th>置换脉序</th><th>垫洗</th><th>末格</th>';
    routeItems.forEach((item, idx) => {
        tableHead += `<th>#${item.wash_no} ${item.talent_name}${idx === 0 ? '' : ' <span class="th-fixed">固定</span>'}</th>`;
    });

    let tableBody = '';
    for (let pad = 0; pad <= previewPads; pad++) {
        const row = padResults.find(r => r.pad === pad) || { nodes: [], error: '无数据' };
        const isSel = pad === routePadCount;
        const lastSlot = row.nodes && row.nodes[0] ? (row.nodes[0].last_slot_name || '-') : '-';
        let cells = '';
        if (row.error && (!row.nodes || !row.nodes.length)) {
            cells = `<td colspan="${routeItems.length}" class="loading-td">${row.error}</td>`;
        } else {
            for (let i = 0; i < routeItems.length; i++) {
                const n = row.nodes[i];
                cells += `<td>${n ? formatNodeExchangeResult(n) : '-'}</td>`;
            }
        }
        const padLabel = pad === 0 ? '直接置换' : `锁紫再洗 ${pad} 次`;
        tableBody += `
            <tr class="route-pad-row ${isSel ? 'current-step' : ''}" data-pad="${pad}">
                <td><b>第 ${pad + 1} 条</b></td>
                <td>${padLabel}</td>
                <td>${lastSlot}</td>
                ${cells}
            </tr>
        `;
    }
    if (maxPad > previewPads) {        tableBody += `<tr><td colspan="${3 + routeItems.length}" class="loading-td">… 另有更靠后的脉序，用上方跳转加载（每次最多模拟到当前选中附近）</td></tr>`;
    }

    const errBanner = selected && selected.error
        ? `<p class="modal-tip" style="color:var(--red)">推演警告：${selected.error}</p>`
        : '';

    container.innerHTML = `
        <div class="route-joint-panel">
            <p class="modal-tip"><b>真实路径推演</b>：${mechTip}</p>
            ${errBanner}

            <div class="exchange-stepper route-pad-stepper">
                <span>当前置换脉序：</span>
                <button class="step-btn" id="btnRoutePadMinus" type="button">-</button>
                <span class="step-val">第 ${routePadCount + 1} 条</span>
                <button class="step-btn" id="btnRoutePadPlus" type="button">+</button>
                <span class="pad-jump">
                    跳转垫洗
                    <input type="number" id="routePadInput" min="0" max="${maxPad}" value="${routePadCount}" />
                    发
                </span>
                <span class="step-result">（${routePadCount === 0 ? '直接置换' : '锁紫再洗 ' + routePadCount + ' 次'}）</span>
            </div>

            <div class="route-nodes-summary">${nodesSummaryHtml}</div>

            <div class="multi-exchange-section">
                <p class="modal-tip">点击下表切换脉序。末格为置换前最后一格天赋（社区常用来标记序列）。多环再冲突时可「展开」查看<b>中途保留某一环</b>时后续目标紫的置换结果（默认主列为打满再冲突）。神脉并存时列出各神脉置换；前序已获同名显示「跳过」。</p>
                <div class="route-pad-table-wrap">
                    <table class="route-pad-table">
                        <thead><tr>${tableHead}</tr></thead>
                        <tbody>${tableBody}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.querySelectorAll('.btn-remove-route-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const washNo = parseInt(e.currentTarget.getAttribute('data-washno'));
            const idx = routeWashNos.indexOf(washNo);
            if (idx >= 0) routeWashNos.splice(idx, 1);
            cachedExchangePadKey = '';
            const newMax = getRouteMaxPad();
            if (routePadCount > newMax) routePadCount = newMax;
            renderPurpleForecastTable();
        });
    });

    const minusBtn = container.querySelector('#btnRoutePadMinus');
    const plusBtn = container.querySelector('#btnRoutePadPlus');
    const padInput = container.querySelector('#routePadInput');

    if (minusBtn) {
        minusBtn.addEventListener('click', () => {
            if (routePadCount > 0) {
                routePadCount--;
                renderExchangeAnalysisBlock();
            }
        });
    }
    if (plusBtn) {
        plusBtn.addEventListener('click', () => {
            if (routePadCount < maxPad) {
                routePadCount++;
                renderExchangeAnalysisBlock();
            }
        });
    }
    if (padInput) {
        padInput.addEventListener('change', () => {
            let v = parseInt(padInput.value, 10);
            if (Number.isNaN(v)) v = 0;
            routePadCount = Math.max(0, Math.min(maxPad, v));
            renderExchangeAnalysisBlock();
        });
    }

    container.querySelectorAll('.route-pad-row').forEach(row => {
        row.addEventListener('click', () => {
            const pad = parseInt(row.getAttribute('data-pad'), 10);
            if (!Number.isNaN(pad)) {
                routePadCount = pad;
                renderExchangeAnalysisBlock();
            }
        });
    });
    container.querySelectorAll('.chain-stop-alts').forEach(el => {
        el.addEventListener('click', (e) => e.stopPropagation());
    });
}

const AI_DEFAULT_TARGET_IDS = Object.freeze([271, 272, 250]);
let aiSelectedTalentIds = [];
let aiDefaultTargetsPending = true;
let aiAvailableTalentIds = [];
let aiTargetPoolError = '';
let aiTargetPoolLoading = false;
let aiTargetPoolRequestKey = '';
let aiTargetPoolToken = 0;
let aiTargetPoolControl = null;
const aiTargetPoolCache = new Map();
let aiSearchRunning = false;
let aiLastPrediction = null;
let autoWashSelectedRoleKey = '';
let aiAttachedTaskKey = '';
let aiRestoringTask = false;
let aiSearchUnsubscribe = null;
let aiSearchConnecting = false;
let aiRenderedResultRevision = '';


function getAiSearchManager() {
    return window.WashSearchManager?.get() || null;
}

function isAutomaticWashPage() {
    const mode = window.SBJ_FEATURE_MODE || new URLSearchParams(location.search).get('mode');
    return isAutoSimulatorView() && (!mode || mode === 'wash');
}

function setAiSearchControls(running) {
    const predict = document.getElementById('btnAiPredict');
    const cancel = document.getElementById('btnAiCancel');
    if (predict) {
        predict.hidden = running;
        predict.disabled = !running && (aiTargetPoolLoading || !!aiTargetPoolError);
        const saved = !running ? getAiSearchManager()?.resumable(aiAttachedTaskKey, window.WASH_ROUTE_WORKER_BUNDLE?.hash) : null;
        predict.textContent = saved ? (saved.route.totalPills===0?'核验0丹路线':`继续优化 · ${formatCount4(saved.route.totalPills)}丹`) : '开始查找路线';
        const restart = document.getElementById('btnAiRestart');
        if (restart) restart.hidden = running || !saved;
    }
    if (cancel) {
        cancel.hidden = !running;
        cancel.disabled = false;
        cancel.textContent = '停止并保留结果';
    }
    ['autoWashRoleSelect', 'autoWashVipSelect', 'aiTalentSearch', 'aiMaxTotalPills'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = running || (id === 'autoWashRoleSelect' && !(state.saveRoles || []).length);
    });
    document.querySelectorAll('#aiTalentChoices input').forEach(el => { el.disabled = running; });
}

function restoreAiSearchView(snapshot) {
    const view = snapshot.view || {};
    aiRestoringTask = true;
    try {
        if (view.roleKey && (state.saveRoles || []).some(entry => entry.key === view.roleKey)) {
            if (autoWashSelectedRoleKey !== view.roleKey) selectAutoWashRole(view.roleKey);
        }
        aiSelectedTalentIds = (view.targetIds || []).map(Number);
        aiDefaultTargetsPending = false;
        if (typeof view.dlcMode === 'boolean') state.dlcMode = view.dlcMode;
        const budget = document.getElementById('aiMaxTotalPills');
        if (budget && Number.isFinite(view.maxTotalPills)) budget.value = String(view.maxTotalPills);
        if (typeof view.vip === 'number' && state.vip !== view.vip) {
            state.vip = view.vip;
            pushStateToWasm();
            renderAiTalentChoices();
        }
        renderAutoWashSaveGate();
        updateAiTargetChoiceState();
        aiAttachedTaskKey = snapshot.taskKey;
    } finally {
        aiRestoringTask = false;
    }
}

function renderAiSearchSnapshot(snapshot, restore = false) {
    renderAiAlgorithmVersion(snapshot || {});
    if (!isAutomaticWashPage() || !snapshot || snapshot.status === 'idle') return;
    const wasRunning = aiSearchRunning;
    let archiveContext = renderAiSearchSnapshot.activeArchiveContext;
    let archiveChanged = false;
    if (snapshot.status === 'running' && (!archiveContext || archiveContext.taskKey !== snapshot.taskKey || archiveContext.saveData !== state.saveData)) {
        const input = getAiSearchManager()?.getInput();
        const roles = collectSaveRoles(state.saveData || {});
        const originalRole = roles.find(entry => entry.key === snapshot.view?.roleKey)?.role;
        const sameStart = !!originalRole && !!input?.savedRole && aiSearchTaskKey({
            role: originalRole, globalVars: state.saveData?.globalVariable || {},
        }) === aiSearchTaskKey({role: input.savedRole, globalVars: input.initialState?.global_vars || {}});
        archiveContext = {
            taskKey: snapshot.taskKey,
            saveData: state.saveData,
            roleKey: roles.some(entry => entry.key === autoWashSelectedRoleKey) ? autoWashSelectedRoleKey : '',
            vip: state.vip,
            dlcMode: state.dlcMode,
            resetInput: !sameStart || !!(archiveContext?.taskKey === snapshot.taskKey && archiveContext.saveData !== state.saveData),
        };
        renderAiSearchSnapshot.activeArchiveContext = archiveContext;
        archiveChanged = true;
    }
    if (restore || (snapshot.status === 'running' && aiAttachedTaskKey !== snapshot.taskKey)) restoreAiSearchView(snapshot);
    if (snapshot.taskKey !== aiAttachedTaskKey) return;
    aiSearchRunning = snapshot.status === 'running';
    if (aiSearchRunning) {
        const targets = (snapshot.view?.targetIds || []).map(Number);
        if (targets.join(',') !== aiSelectedTalentIds.join(',')) {
            aiSelectedTalentIds = targets;
            aiDefaultTargetsPending = false;
            updateAiTargetChoiceState();
        }
        if (archiveChanged || restore) renderAutoWashSaveGate();
    }
    setAiSearchControls(aiSearchRunning);
    const results = document.getElementById('aiPredictionResults');
    const found = snapshot.result?.routes?.length || 0;
    const revision = `${snapshot.taskKey}:${snapshot.startedAt}:${snapshot.resultRevision ?? found}`;
    if (found && aiRenderedResultRevision !== revision) {
        renderAiPrediction(snapshot.result, aiRouteImageContext(snapshot));
        aiRenderedResultRevision = revision;
    }
    if (snapshot.status === 'complete') {
        renderAiSearchProgress({ phase: 'complete', message: snapshot.result?.strength || `本轮搜索结束，已找到 ${found} 条路线；尚未证明最优` });
    } else if (snapshot.status === 'running') {
        renderAiSearchProgress({ ...(snapshot.progress || {}), foundCount: found });
        if (!found && results && results.dataset.hasResult !== 'searching') {
            aiLastPrediction = null;
            results.dataset.hasResult = 'searching';
            results.innerHTML = '<div class="ai-result-empty">正在按耗丹上限深度查找，找到的方案会陆续显示。可以切换页面，回来查看进度或结果。</div>';
        }
    } else {
        const failed = snapshot.status === 'error';
        const message = failed ? `查找失败：${snapshot.error || '后台计算异常，请重试'}`
            : snapshot.stopReason === 'optimization-limit'
                ? '本轮持续优化已达到计算量上限，已保留最省候选；尚未证明最优。'
            : snapshot.stopReason === 'resource-limit'
                ? '方案数量或内存达到保护限制，已保留路线；尚未证明最优。'
            : snapshot.stopReason === 'search-incomplete'
                ? `本轮尚未找到 ${Number(snapshot.view?.maxTotalPills || 0).toLocaleString()} 丹以内满足全部目标的路线；搜索未穷尽，不能判定无解。`
                : `${snapshot.stopReason === 'page-reloaded' ? '页面已刷新，可核验后继续' : '已停止'}${found ? '，最好路线已保留。' : '，可重新开始。'}`;
        renderAiSearchProgress({ phase: failed ? 'error' : 'stopped', message });
        if (!found) {
            aiLastPrediction = null;
            if (results) {
                results.dataset.hasResult = 'false';
                results.innerHTML = `<div class="${failed ? 'ai-result-error' : 'ai-result-empty'}">${escapeAiHtml(message)}</div>`;
            }
        }
    }
    if (wasRunning && !aiSearchRunning) {
        delete renderAiSearchSnapshot.activeArchiveContext;
        const attachedTaskKey = aiAttachedTaskKey;
        aiRestoringTask = true;
        try {
            if (archiveContext?.resetInput) {
                autoWashSelectedRoleKey = (state.saveRoles || []).some(entry => entry.key === archiveContext.roleKey) ? archiveContext.roleKey : '';
                aiSelectedTalentIds = [];
                aiDefaultTargetsPending = true;
                state.vip = normalizeVipLevel(archiveContext.vip);
                state.dlcMode = !!archiveContext.dlcMode;
                const currentRole = selectedAutoWashRoleEntry() || (state.saveRoles || []).find(entry => entry.tag === '主角') || state.saveRoles?.[0];
                if (currentRole) selectRoleFromSave(currentRole.key);
                pushStateToWasm();
            }
            renderAutoWashSaveGate();
            renderAiTalentChoices();
        } finally {
            aiAttachedTaskKey = attachedTaskKey;
            aiRestoringTask = false;
        }
        setAiSearchControls(false);
    }
}

async function connectAiSearchManager() {
    if (!isAutomaticWashPage() || aiSearchUnsubscribe || aiSearchConnecting) return;
    aiSearchConnecting = true;
    try {
        const manager = await window.WashSearchManager?.ready();
        if (!manager) throw new Error('后台查找资源未加载，请刷新后重试。');
        renderAiSearchSnapshot(manager.snapshot(), true);
        aiSearchUnsubscribe = manager.subscribe(snapshot => renderAiSearchSnapshot(snapshot));
        window.addEventListener('pagehide', () => {
            aiSearchUnsubscribe?.();
            aiSearchUnsubscribe = null;
        }, { once: true });
    } catch (error) {
        renderAiSearchProgress({ phase: 'error', message: playerError(error) });
    } finally {
        aiSearchConnecting = false;
    }
}

function isAutoSimulatorView() {
    return document.documentElement.classList.contains('auto-simulator-view');
}

function selectedAutoWashRoleEntry() {
    if (!autoWashSelectedRoleKey) return null;
    return (state.saveRoles || []).find(entry => entry.key === autoWashSelectedRoleKey) || null;
}

function renderAutoWashAccountInfo(role, confirmed) {
    const source=document.getElementById('autoWashVipSource');
    if(source)source.textContent=confirmed?'手动设置':'模拟等级，按游戏确认';
    const badge=document.getElementById('autoWashExchangeStatus');
    const qualification=window.WashOriginPreview?.qualification(role);
    if(badge&&qualification){badge.textContent='无限置换：'+qualification.label;badge.dataset.state=qualification.state;badge.dataset.detail=qualification.detail;badge.title=qualification.detail;badge.disabled=!role;}
    const preview=document.getElementById('btnWashOrigin');if(preview)preview.disabled=!role;
}

function renderAutoWashSaveGate() {
    const select = document.getElementById('autoWashRoleSelect');
    const vipSelect = document.getElementById('autoWashVipSelect');
    const status = document.getElementById('autoWashSaveStatus');
    const pills = document.getElementById('autoWashBagPillDisplay');
    const summary = document.getElementById('autoWashRoleSummary');
    if (!select && !vipSelect && !status && !pills && !summary) return;

    const manager = getAiSearchManager();
    const task = manager?.snapshot();
    const frozen = task?.status === 'running' ? manager.getInput() : null;
    if (frozen?.initialState) {
        const original = frozen.initialState;
        const view = task.view || {};
        const roleName = view.roleName || frozen.savedRole?.Name || '查找人物';
        const roleTag = ({main: '主角', role: '随从', leave: '离队'})[String(view.roleKey || '').split(':')[0]] || '人物';
        if (select) {
            select.innerHTML = '<option value="' + escapeAiHtml(view.roleKey || '') + '">' + escapeAiHtml(isAutomaticWashPage()?roleName:roleTag + ' · ' + roleName) + '</option>';
            select.value = view.roleKey || '';
            select.disabled = true;
        }
        if (vipSelect) { vipSelect.value = String(normalizeVipLevel(original.vip ?? view.vip)); vipSelect.disabled = true; }
        renderAutoWashAccountInfo(frozen.savedRole, frozen.vipConfirmed);
        if (status) status.textContent = '正在查找 · ' + roleName;
        if (pills) pills.textContent = frozen.hasBagPills ? Number(frozen.bagPills ?? original.bag_pills ?? 0).toLocaleString() + ' 颗' : '--';
        if (summary) {
            const zz = ZZ_DATA[String(original.zizhi)] || {};
            const ids = (original.talents || []).map(item => Number(item && item.id != null ? item.id : item));
            summary.textContent = (zz.zz_name || zz.name || ('资质 ' + original.zizhi))
                + '（' + Number(zz.num_talent || 0) + ' 栏） · 当前天赋：'
                + (ids.map(id => TALENT_DATA[String(id)]?.name || '未知天赋').join('、') || '无')
                ;
        }
        return;
    }

    const roles = state.saveRoles || [];
    const hasSave = !!state.saveData && roles.length > 0;
    const selected = selectedAutoWashRoleEntry();
    renderAutoWashAccountInfo(selected?.role, state.vipConfirmed);
    if (select) {
        const placeholder = hasSave ? '请选择人物' : '暂无可选人物';
        select.innerHTML = `<option value="">${placeholder}</option>` + ['主角','随从','离队'].map(tag=>{
            const group=roles.filter(entry=>entry.tag===tag);if(!group.length)return '';
            return `<optgroup label="${tag}">`+group.map(entry=>`<option value="${escapeAiHtml(entry.key)}">${escapeAiHtml(entry.role.Name||'无名')}</option>`).join('')+'</optgroup>';
        }).join('');
        select.disabled = !hasSave || aiSearchRunning;
        select.value = selected ? selected.key : '';
    }
    if (vipSelect) { vipSelect.value = String(normalizeVipLevel(state.vip)); vipSelect.disabled = aiSearchRunning; }
    if (status) {
        status.textContent = !hasSave
            ? '尚未导入存档'
            : (selected ? `已选择 · ${selected.tag} · ${selected.role.Name || '无名'}` : `已导入 ${roles.length} 名人物，请继续选择`);
    }
    if (pills) pills.textContent = state.hasBagPills ? `${state.bagPills.toLocaleString()} 颗` : '--';
    if (summary) {
        if (!hasSave) {
            summary.textContent = '请先导入存档，再选择要洗脉的人物；系统会读取这名人物当前的洗脉进度。';
        } else if (!selected) {
            summary.textContent = '存档已导入。必须明确选择一名人物，才能读取其资质、天赋和洗脉状态。';
        } else {
            const zz = ZZ_DATA[String(state.zizhi)] || {};
            const zeroSlotPlan = Number(state.zizhi) <= 152
                ? ' · 从当前天赋栏开始，比较逐步开栏的洗法'
                : '';
            const talentNames = state.talents.map(t => TALENT_DATA[String(t.id)]?.name || '未知天赋').join('、');
            summary.textContent = isAutomaticWashPage()?`${zz.zz_name || zz.name || '当前资质'} · ${Number(zz.num_talent || 0)} 栏 · ${talentNames || '暂无天赋'}`:`${selected.role.Name || '无名'} · ${zz.zz_name || zz.name || `资质 ${state.zizhi}`}（${Number(zz.num_talent || 0)} 栏） · 当前天赋：${talentNames || '无'}${zeroSlotPlan}`;
        }
    }
}

function selectAutoWashRole(roleKey) {
    if (aiSearchRunning && !aiRestoringTask) return;
    const key = String(roleKey || '');
    const changed = key !== autoWashSelectedRoleKey;
    autoWashSelectedRoleKey = (state.saveRoles || []).some(entry => entry.key === key) ? key : '';
    if (changed) {
        const picker=document.getElementById('washTargetPicker');if(picker)delete picker.dataset.initialized;
        aiSelectedTalentIds = [];
        aiDefaultTargetsPending = true;
    }
    invalidateAiPrediction();
    if (autoWashSelectedRoleKey) {
        state.mode = 'seed';
        const mode = document.getElementById('modeSelect');
        if (mode) mode.value = 'seed';
        selectRoleFromSave(autoWashSelectedRoleKey);
    } else {
        aiAvailableTalentIds = [];
        renderAiTalentChoices();
        renderAutoWashSaveGate();
    }
}

function escapeAiHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clampAiNumber(id, min, max, fallback) {
    const el = document.getElementById(id);
    let value = parseInt(el?.value || String(fallback), 10);
    if (Number.isNaN(value)) value = fallback;
    value = Math.max(min, Math.min(max, value));
    if (el) el.value = String(value);
    return value;
}

const AI_COST_BUCKET_LABELS = Object.freeze({
    oneUnlocked: '一脉未锁',
    twoUnlocked: '二脉未锁',
    oneUnlocked: '一脉未锁',
    twoUnlocked: '二脉未锁',
    threeUnlocked: '三脉未锁',
    fourUnlocked: '四脉未锁',
    lock1: '锁 1',
    lock2: '锁 2',
    lock3: '锁 3',
});

function validateAiTargetSet(targetIds, talentData, slotCount = 4) {
    const ids = Array.from(new Set((targetIds || []).map(Number).filter(id => id > 0)));
    const errors = [];
    if (!ids.length) errors.push('请至少选择一条目标脉');
    if (ids.length > slotCount) errors.push(`目标脉数量不能超过 ${slotCount} 条`);
    const seenTypes = new Map();
    for (const id of ids) {
        const item = talentData?.[String(id)];
        if (!item) {
            errors.push(`未找到天赋 ID ${id}`);
            continue;
        }
        if (![2, 3, 4].includes(Number(item.pinzhi ?? item.weight))) errors.push(`「${item.name}」不是可选的绿脉、蓝脉或紫脉`);
        if (item.type == null) continue;
        const type = String(item.type);
        if (seenTypes.has(type)) {
            errors.push(`「${seenTypes.get(type)}」与「${item.name}」同类型，不能作为最终有效脉同时保留`);
        } else {
            seenTypes.set(type, item.name);
        }
    }
    return { valid: errors.length === 0, errors, ids };
}

function readableWashCopy(value) {
    const replacements = [
        ['开槽本身不推进洗髓种子', '开天赋栏不会推进原始脉序'],
        ['紫脉事件规划 · 冲突准备与开槽优化', '冲突准备与开栏方案'],
        ['完整动作搜索 · 锁脉、开槽与冲突置换', '锁脉、开栏与置换方案'],
        ['首紫准备与置换分支 · 完整路线回放', '首紫准备与置换方案 · 已逐步核对'],
        ['事件路线 · 原始序列、冲突置换与开槽', '原始脉序、冲突置换与开栏方案'],
        ['事件搜索达到工作范围，尚不能判定无解', '本轮暂未找到完整路线，可继续尝试其他洗法；这不代表一定洗不出'],
        ['源码规则', '洗脉规则'], ['源码状态机', '洗脉规则'],
        ['状态机回放', '逐步核对操作'], ['回放验证', '逐步核对'],
        ['欧气种子', '置换序列'], ['洗髓种子', '原始脉序'],
        ['因此零丹无法取得完整目标', '因此当前条件下还需要消耗洗髓丹才能达到全部目标'], ['零丹', '无需额外洗髓丹'], ['当前四槽起点', '从当前四栏开始'],
    ];
    let text = String(value ?? '');
    for (const [before, after] of replacements) text = text.split(before).join(after);
    return text.replace(/(\d+) 槽真实起手/g, '从当前 $1 栏开始');
}

function aiRouteImageContext(snapshot) {
    const key = `${snapshot.taskKey}:${snapshot.startedAt}`;
    const previous = aiRouteImageContext.current;
    if (previous?.key === key && previous.originReady) return previous;
    const input = getAiSearchManager()?.getInput();
    const initial = input?.initialState;
    const roleName = String(input?.savedRole?.Name || snapshot.view?.roleName || '').trim();
    const context = {
        key,
        originReady: !!initial && Array.isArray(initial.talents) && !!roleName,
        roleName,
        vip: initial?.vip ?? snapshot.view?.vip,
        vipConfirmed: !!input?.vipConfirmed,
        dlcMode: !!input?.dlcMode,
        startTalents: (initial?.talents || []).map(t => ({
            id: Number(typeof t === 'object' ? t.id : t),
            locked: !!t?.locked,
        })),
    };
    aiRouteImageContext.current = context;
    return context;
}

function invalidateAiPrediction() {
    if (aiRestoringTask) return;
    // A view's save/role initialization must never cancel the shared task.
    const active = getAiSearchManager()?.snapshot();
    if (active?.status === 'running') {
        if (aiAttachedTaskKey === active.taskKey) renderAiSearchSnapshot(active);
        return;
    }
    aiAttachedTaskKey = '';
    aiSearchRunning = false;
    aiLastPrediction = null;
    setAiSearchControls(false);
    const progress = document.getElementById('aiSearchProgress');
    if (progress) progress.hidden = true;
    const results = document.getElementById('aiPredictionResults');
    if (results && results.dataset.hasResult !== 'false') {
        results.dataset.hasResult = 'false';
        results.innerHTML = '<div class="ai-result-empty">选择目标后，点击“开始查找路线”。</div>';
    }
}

function stopAiTargetPoolQuery() {
    aiTargetPoolControl?.finish(null, new Error('目标池请求已替换'));
}

function requestAiTargetPool(input) {
    return new Promise((resolve, reject) => {
        const bundle = window.WASH_ROUTE_WORKER_BUNDLE;
        if (!bundle?.src || !bundle.hash || typeof Worker !== 'function') {
            reject(new Error('目标脉读取资源未加载完整，请刷新后重试。'));
            return;
        }
        let worker, blobUrl, timer;
        const requestId = `wash-pool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const control = { settled: false, finish(pool, error) {
            if (control.settled) return;
            control.settled = true;
            clearTimeout(timer);
            if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            if (aiTargetPoolControl === control) aiTargetPoolControl = null;
            error ? reject(error) : resolve(pool);
        } };
        aiTargetPoolControl = control;
        try {
            blobUrl = URL.createObjectURL(new Blob([bundle.src], { type: 'text/javascript' }));
            worker = new Worker(blobUrl);
            worker.onmessage = event => {
                const message = event?.data || {};
                if (message.requestId !== requestId) return;
                if (message.type === 'eligible-targets') {
                    if (!Array.isArray(message.pool?.targetIds)) control.finish(null, new Error('目标脉读取结果不完整，请重试。'));
                    else control.finish(message.pool, null);
                } else if (message.type === 'error') control.finish(null, new Error(message.error || '目标脉读取失败'));
            };
            worker.onerror = event => { event.preventDefault?.(); control.finish(null, new Error(event.message || '目标脉读取线程失败')); };
            timer = setTimeout(() => control.finish(null, new Error('目标脉读取超时，请重新选择人物后重试。')), 45000);
            worker.postMessage({ type: 'eligible-targets', requestId, input });
        } catch (error) { control.finish(null, error); }
    });
}

function aiTargetPoolInput() {
    const manager = getAiSearchManager();
    if (manager?.snapshot().status === 'running') {
        const frozen = manager.getInput();
        if (!frozen?.initialState || !frozen.savedRole) throw new Error('当前查找的原始人物状态不可用，请先停止查找。');
        return {
            initialState: frozen.initialState,
            savedRole: frozen.savedRole,
            ruleContextUrl: frozen.ruleContextUrl,
            dlcMode: !!frozen.dlcMode,
        };
    }
    pushStateToWasm();
    const initialState = wasmGetState();
    return {
        initialState,
        savedRole: selectedAutoWashRoleEntry()?.role || state.roleRaw || null,
        ruleContextUrl: new URL('../shared/wash_role_context.js?v=20261105313&rev=83768567764a', window.location.href).href,
        dlcMode: !!state.dlcMode,
    };
}

function validateAiTargetSelection({ showMessage = true } = {}) {
    const message = document.getElementById('aiSelectionMessage');
    const task = getAiSearchManager()?.snapshot();
    if (task?.status === 'running') {
        const result = validateAiTargetSet(task.view?.targetIds || [], TALENT_DATA, 4);
        if (showMessage && message) {
            message.classList.toggle('is-error', !result.valid);
            message.textContent = result.valid
                ? '正在查找最终同时包含「' + result.ids.map(id => TALENT_DATA[String(id)]?.name || id).join('、') + '」的路线。'
                : (result.errors[0] || '当前查找目标不可用');
        }
        return result;
    }
    const prerequisiteErrors = [];
    if (aiTargetPoolLoading) prerequisiteErrors.push('正在读取该人物可用的目标脉…');
    if (aiTargetPoolError) prerequisiteErrors.push(aiTargetPoolError);
    if (isAutoSimulatorView()) {
        if (!state.saveData || !(state.saveRoles || []).length) prerequisiteErrors.push('请选择人物');
        else if (!selectedAutoWashRoleEntry()) prerequisiteErrors.push('请选择人物');
    }
    if (selectedAutoWashRoleEntry() && ![150, 151, 152, 153, 154].includes(Number(state.zizhi))) {
        prerequisiteErrors.push('自动洗脉仅支持 0–4 槽资质');
    }
    if (prerequisiteErrors.length) {
        if (showMessage && message) {
            message.textContent = prerequisiteErrors[0];
            message.classList.toggle('is-error', !aiTargetPoolLoading);
        }
        return { valid: false, errors: prerequisiteErrors, ids: [] };
    }
    if (!window.WashSourceEngine) {
        const error = '洗脉资料尚未加载，请刷新后重试';
        if (showMessage && message) {
            message.textContent = error;
            message.classList.add('is-error');
        }
        return { valid: false, errors: [error], ids: [] };
    }
    const result = validateAiTargetSet(aiSelectedTalentIds, TALENT_DATA, 4);
    const unavailable = result.ids.filter(id => !aiAvailableTalentIds.includes(id));
    if (unavailable.length) {
        result.valid = false;
        result.errors.push(`当前角色或四脉资质不可用：${unavailable.map(id => TALENT_DATA[String(id)]?.name || id).join('、')}`);
    }
    if (showMessage && message) {
        message.classList.toggle('is-error', !result.valid);
        message.textContent = result.valid
            ? `将筛选最终同时包含「${result.ids.map(id => TALENT_DATA[String(id)].name).join('、')}」的路线。`
            : (result.errors[0] || '请选择目标脉');
    }
    return result;
}

function updateAiTargetChoiceState() {
    const count = document.getElementById('aiTargetCount');
    if (count) count.textContent = `${aiSelectedTalentIds.length}/4`;
    const selectedSummary=document.getElementById('aiSelectedTargetSummary');
    if(selectedSummary){selectedSummary.replaceChildren();if(!aiSelectedTalentIds.length)selectedSummary.textContent='选择希望最终保留的脉';else for(const id of aiSelectedTalentIds){const chip=document.createElement('span');chip.className='wash-target-chip';chip.dataset.quality=String(Number(TALENT_DATA[String(id)]?.pinzhi??TALENT_DATA[String(id)]?.weight));chip.textContent=TALENT_DATA[String(id)]?.name||String(id);chip.title=({2:'绿脉',3:'蓝脉',4:'紫脉'})[chip.dataset.quality]+' · '+chip.textContent;chip.setAttribute('aria-label',chip.title);selectedSummary.append(chip);}}
    document.querySelectorAll('#aiTalentChoices .ai-talent-choice').forEach(label => {
        const id = Number(label.dataset.talentId);
        const checked = aiSelectedTalentIds.includes(id);
        label.classList.toggle('is-selected', checked);
        const input = label.querySelector('input');
        if (input) input.checked = checked;
    });
    const picker=document.getElementById('washTargetPicker');
    if(picker&&!picker.dataset.initialized&&!aiTargetPoolLoading){picker.open=aiSelectedTalentIds.length===0;picker.dataset.initialized='true';}
    validateAiTargetSelection();
    filterAiTalentChoices();
}

function filterAiTalentChoices() {
    const keyword = (document.getElementById('aiTalentSearch')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#aiTalentChoices .ai-talent-choice').forEach(label => {
        const name = (label.dataset.talentName || '').toLowerCase();
        label.classList.toggle('is-hidden', !!keyword && !name.includes(keyword));
    });
    document.querySelectorAll('#aiTalentChoices .ai-talent-section').forEach(section => {
        const quality = section.dataset.talentQualitySection;
        const labels = Array.from(section.querySelectorAll('.ai-talent-choice:not(.is-hidden)'));
        section.hidden = labels.length === 0;
        const selected = aiSelectedTalentIds.filter(id => Number(TALENT_DATA[String(id)]?.pinzhi ?? TALENT_DATA[String(id)]?.weight) === Number(quality)).length;
        const count = section.querySelector('.ai-talent-group-title small');
        if (count) count.textContent = `${labels.length} 条${selected ? ` · 已选 ${selected} 条` : ''}`;
        if (section.tagName !== 'DETAILS') return;
        if (keyword) {
            if (!('searchWasOpen' in section.dataset)) section.dataset.searchWasOpen = String(section.open);
            section.open = labels.length > 0;
        } else if ('searchWasOpen' in section.dataset) {
            section.open = section.dataset.searchWasOpen === 'true';
            delete section.dataset.searchWasOpen;
        }
    });
}

function renderAiTalentChoices() {
    if (!isAutoSimulatorView()) return;
    const container = document.getElementById('aiTalentChoices');
    if (!container || !wasmReady) return;
    const predict = document.getElementById('btnAiPredict');
    if (!selectedAutoWashRoleEntry() && getAiSearchManager()?.snapshot().status !== 'running') {
        aiTargetPoolToken += 1;
        aiTargetPoolRequestKey = '';
        stopAiTargetPoolQuery();
        aiTargetPoolLoading = false;
        aiTargetPoolError = '';
        aiAvailableTalentIds = [];
        aiSelectedTalentIds = [];
        container.innerHTML = '<span class="text-muted">选择人物后显示可用的紫脉、蓝脉和绿脉。</span>';
        updateAiTargetChoiceState();
        return;
    }
    let input, key;
    try { input = aiTargetPoolInput(); key = aiSearchTaskKey(input); }
    catch (error) { aiTargetPoolError = playerError(error); container.textContent = aiTargetPoolError; if (predict) predict.disabled = true; return; }
    const cached = aiTargetPoolCache.get(key);
    if (cached) {
        aiTargetPoolToken += 1;
        stopAiTargetPoolQuery();
        aiTargetPoolRequestKey = key;
        aiTargetPoolLoading = false;        aiTargetPoolError = '';
        paintAiTalentChoices(cached.targetIds);
        if (predict) predict.disabled = false;
        return;
    }
    if (aiTargetPoolLoading && key === aiTargetPoolRequestKey) return;
    stopAiTargetPoolQuery();
    const token = ++aiTargetPoolToken;
    aiTargetPoolRequestKey = key;
    aiTargetPoolLoading = true;
    aiTargetPoolError = '';
    aiAvailableTalentIds = [];
    container.textContent = '正在读取该人物可用的紫脉、蓝脉和绿脉…';
    if (predict) predict.disabled = true;
    updateAiTargetChoiceState();
    requestAiTargetPool(input).then(pool => {
        if (token !== aiTargetPoolToken) return;
        aiTargetPoolLoading = false;
        aiTargetPoolError = '';
        if (aiTargetPoolCache.size >= 8) aiTargetPoolCache.delete(aiTargetPoolCache.keys().next().value);
        aiTargetPoolCache.set(key, pool);
        paintAiTalentChoices(pool.targetIds);
        if (predict) predict.disabled = false;
    }).catch(error => {
        if (token !== aiTargetPoolToken) return;
        aiTargetPoolLoading = false;
        aiTargetPoolError = `可用目标脉读取失败：${error?.message || error}`;
        aiAvailableTalentIds = [];
        container.textContent = aiTargetPoolError;
        if (predict) predict.disabled = true;
        updateAiTargetChoiceState();
    });
}

function paintAiTalentChoices(targetIds) {
    const container = document.getElementById('aiTalentChoices');
    if (!container) return;
    aiAvailableTalentIds = Array.from(new Set(targetIds.map(Number))).filter(id => [2, 3, 4].includes(Number(TALENT_DATA[String(id)]?.pinzhi ?? TALENT_DATA[String(id)]?.weight))).sort((a, b) => Number(TALENT_DATA[String(b)]?.pinzhi ?? TALENT_DATA[String(b)]?.weight) - Number(TALENT_DATA[String(a)]?.pinzhi ?? TALENT_DATA[String(a)]?.weight) || (TALENT_DATA[String(a)]?.name || '').localeCompare(TALENT_DATA[String(b)]?.name || '', 'zh-CN'));
    aiSelectedTalentIds = (aiDefaultTargetsPending ? AI_DEFAULT_TARGET_IDS : aiSelectedTalentIds).filter(id => aiAvailableTalentIds.includes(id));
    aiDefaultTargetsPending = false;
    if (!aiAvailableTalentIds.length) {
        container.innerHTML = '<span class="text-muted">当前角色没有可选目标脉，请检查角色条件和 VIP。</span>';
        updateAiTargetChoiceState();
        return;
    }
    const previousQualities = new Set(Array.from(container.querySelectorAll('details')).map(el => Number(el.dataset.talentQualitySection)));
    const expandedQualities = new Set(Array.from(container.querySelectorAll('details[open]')).map(el => Number(el.dataset.talentQualitySection)));
    const choiceHtml = id => {
        const item = TALENT_DATA[String(id)] || {};
        const name = item.name || `天赋 #${id}`;
        const quality = Number(item.pinzhi ?? item.weight);
        const qualityName = ({2: '绿', 3: '蓝', 4: '紫'})[quality] || '';
        return `<label class="ai-talent-choice" data-talent-id="${id}" data-talent-name="${escapeAiHtml(name)}" data-talent-quality="${quality}">
            <input type="checkbox" value="${id}" aria-label="${qualityName}脉 · ${escapeAiHtml(name)}" ${aiSearchRunning ? 'disabled' : ''}>
            <span class="ai-talent-quality" aria-hidden="true">${qualityName}</span><span>${escapeAiHtml(name)}</span>
        </label>`;
    };
    container.innerHTML = [4, 3, 2].map(quality => {
        const ids = aiAvailableTalentIds.filter(id => Number(TALENT_DATA[String(id)]?.pinzhi ?? TALENT_DATA[String(id)]?.weight) === quality);
        if (!ids.length) return '';
        const title = ({4: '紫', 3: '蓝', 2: '绿'})[quality] + '脉';
        const heading = `<span>${title}</span><small></small>`;
        const choices = `<div class="ai-talent-grid">${ids.map(choiceHtml).join('')}</div>`;
        return `<details class="ai-talent-section ai-talent-collapsible" data-talent-quality-section="${quality}" ${(previousQualities.has(quality) ? expandedQualities.has(quality) : quality === 4) ? 'open' : ''}><summary class="ai-talent-group-title" data-talent-quality-group="${quality}">${heading}</summary>${choices}</details>`;
    }).join('');
    container.querySelectorAll('.ai-talent-choice').forEach(label => {
        label.addEventListener('click', event => {
            event.preventDefault();
            if (aiSearchRunning) {
                const message = document.getElementById('aiSelectionMessage');
                if (message) {
                    message.textContent = '正在查找路线；如需修改目标，请先停止查找。';
                    message.classList.add('is-error');
                }
                return;
            }
            const id = Number(label.dataset.talentId);
            const index = aiSelectedTalentIds.indexOf(id);
            if (index >= 0) {
                aiSelectedTalentIds.splice(index, 1);
            } else if (aiSelectedTalentIds.length >= 4) {
                const message = document.getElementById('aiSelectionMessage');
                if (message) {
                    message.textContent = '最终最多只能选择 4 条目标脉。';
                    message.classList.add('is-error');
                }
                return;
            } else {
                aiSelectedTalentIds.push(id);
            }
            aiAttachedTaskKey = '';
            aiLastPrediction = null;
            const progress = document.getElementById('aiSearchProgress');
            if (progress) progress.hidden = true;
            const results = document.getElementById('aiPredictionResults');
            if (results) {
                results.dataset.hasResult = 'false';
                results.innerHTML = '<div class="ai-result-empty">目标已更新，点击“开始查找路线”。</div>';
            }
            updateAiTargetChoiceState();
            if(aiSelectedTalentIds.length===4){const picker=document.getElementById('washTargetPicker');if(picker)picker.open=false;}
        });
    });
    updateAiTargetChoiceState();
    filterAiTalentChoices();
}

function formatCount4(value) { return String(Math.trunc(Number(value) || 0)).replace(/\B(?=(\d{4})+(?!\d))/g, ','); }

function renderAiAlgorithmVersion(snapshot = {}, reportedOnly = false) {
    const raw = snapshot.progress?.implementationRevision || snapshot.result?.searchScope?.implementationRevision
        || snapshot.result?.routes?.[0]?.algorithmVersion || snapshot.implementationRevision || snapshot.algorithmVersion;
    if (reportedOnly && !raw) return;
    const candidate = raw || (snapshot.restored ? '' : window.WASH_ROUTE_WORKER_BUNDLE?.algorithmVersion);
    const version = typeof candidate === 'string' && /^[0-9]+\.[0-9]+(?:\.[0-9]+)?$/.test(candidate) ? candidate : '';
    const label = version ? 'AI 洗脉 v' + version.replace(/\.0$/, '') : '洗脉算法：版本读取中…';
    for (const id of ['aiAlgorithmVersion', 'aiRunningAlgorithm']) {
        const node = document.getElementById(id); if (node) {node.textContent = label;node.dataset.algorithmVersion = version;}
    }
}

function renderAiSearchProgress(progress = {}) {
    renderAiAlgorithmVersion(progress, true);
    const box = document.getElementById('aiSearchProgress');
    const text = document.getElementById('aiProgressText');
    const percent = document.getElementById('aiProgressPercent');
    const fill = document.getElementById('aiProgressFill');
    const terminal = ['complete', 'stopped', 'error'].includes(progress.phase);
    if (box) {
        box.hidden = false;
        box.dataset.state = terminal ? progress.phase : 'searching';
        const track = box.querySelector('[role="progressbar"]');
        if (track) {
            track.setAttribute('aria-label', terminal ? (progress.phase === 'complete' ? '路线查找完成' : '路线查找已停止') : '正在查找路线');
            if (progress.phase === 'complete') track.setAttribute('aria-valuenow', '100');
            else track.removeAttribute('aria-valuenow');
        }
    }
    if (text) text.textContent = progress.phase === 'optimizing' ? `继续寻找更省路线 · 第 ${progress.optimizationRound} 轮` : !terminal && progress.message ? readableWashCopy(progress.message) : terminal ? (progress.phase === 'error' ? playerError(progress.message) : readableWashCopy(progress.message)) : (progress.foundCount ? `正在深度查找，已找到 ${progress.foundCount} 条路线…` : '正在深度查找满足目标的路线…');
    const washes = Number(progress.totalRawWashesSimulated ?? progress.rawWashesSimulated ?? 0);
    if (percent) percent.textContent = terminal
        ? (progress.phase === 'complete' ? '完成' : progress.phase === 'stopped' ? '已停止' : '出现错误')
        : (washes > 0 ? `已模拟 ${formatCount4(washes)} 次洗脉` : '正在准备');
    if (fill) fill.style.removeProperty('width');
}

function aiCostBreakdownHtml(route) {
    const labels = AI_COST_BUCKET_LABELS;
    const entries = Object.entries(route.costBreakdown || {}).filter(([, value]) => Number(value) > 0);
    if (!entries.length) return '<div class="ai-result-empty">本路线无需额外洗髓丹</div>';
    const total = Math.max(1, Number(route.totalPills) || 1);
    const segments = entries.map(([key, value]) => {
        const width = Math.max(4, Number(value) / total * 100);
        return `<div class="ai-cost-segment" style="flex-basis:${width}%" title="${escapeAiHtml(labels[key] || key)}：${Number(value).toLocaleString()} 丹">
            ${escapeAiHtml(labels[key] || key)} ${Number(value).toLocaleString()}
        </div>`;
    }).join('');
    const legend = entries.map(([key, value]) => `<span>${escapeAiHtml(labels[key] || key)}：<b>${Number(value).toLocaleString()}</b> 丹</span>`).join('');
    return `<div class="ai-cost-bar" role="img" aria-label="丹耗分解：${escapeAiHtml(entries.map(([key, value]) => `${labels[key] || key}${value}丹`).join('，'))}">${segments}</div>
        <div class="ai-cost-legend">${legend}<span>开四脉 / 置换：<b>0</b> 丹</span></div>`;
}

function aiRouteTimelineHtml(route) {
    return `<div class="ai-route-timeline" role="list" aria-label="路线操作时间轴">${(route.steps || []).map((step, index) => {
        const detail = step.washes > 0
            ? `洗 ${step.washes} 次 · 本步 ${step.pills} 丹`
            : `本步 ${step.pills} 丹`;
        return `<div class="ai-route-step-node is-${escapeAiHtml(step.type)}" role="listitem">
            <b>${index + 1}. ${escapeAiHtml(readableWashCopy(step.label))}</b>
            <span>${escapeAiHtml(detail)}</span>
            <span class="ai-route-step-cost">累计 ${Number(step.cumulativePills).toLocaleString()} 丹</span>
        </div>`;
    }).join('')}</div>`;
}

function aiOperationTableHtml(route) {
    const rows = (route.steps || []).map((step, index) => {
        const afterNames = (step.after?.talents || []).map(t => `${t.name}${t.locked ? '（锁）' : ''}`).join('、');
        const verify = step.type === 'verify' ? '最终目标已逐步核对' : (step.expectedName ? `应出现「${step.expectedName}」` : afterNames);
        return `<tr>
            <td>${index + 1}</td>
            <td><b>${escapeAiHtml(readableWashCopy(step.label))}</b></td>
            <td>${escapeAiHtml(readableWashCopy(step.detail))}</td>
            <td>${Number(step.washes).toLocaleString()}</td>
            <td>${step.unitCost == null ? '—' : Number(step.unitCost).toLocaleString()}</td>
            <td>${Number(step.pills).toLocaleString()}</td>
            <td>${Number(step.cumulativePills).toLocaleString()}</td>
            <td>${Number(step.cumulativeWashes).toLocaleString()}</td>
            <td>${Number(step.cumulativeTalentBars).toLocaleString()}</td>
            <td class="ai-operation-verify">${escapeAiHtml(verify || '状态已记录')}</td>
        </tr>`;
    }).join('');
    return `<div class="ai-operation-wrap"><table class="ai-operation-table">
        <thead><tr><th>#</th><th>操作</th><th>玩家照做步骤</th><th>洗数</th><th>单次丹</th><th>本步丹</th><th>累计丹</th><th>累计洗</th><th>脉序(条)</th><th>操作后验证</th></tr></thead>
        <tbody>${rows}</tbody>
    </table></div>`;
}

function aiRouteResultHtml(route, index) {
    const inventory = route.inventory || {};
    const inventoryLabel = inventory.available == null
        ? '库存未读取'
        : (inventory.enough ? `余 ${Number(inventory.remaining).toLocaleString()} 丹` : `缺 ${Number(inventory.shortfall).toLocaleString()} 丹`);
    const upgradeLabel = Array.isArray(route.slotPath) && route.slotPath.length
        ? `${route.slotPath.join('→')} 槽`
        : '保持当前槽位';
    const finalNames = (route.finalTalents || []).map(item => `${item.name}${item.locked ? '（锁）' : ''}`).join('、');
    return `<div class="ai-route-card"><details class="ai-route-result" data-route-key="${escapeAiHtml(route.branchId || index)}" ${index === 0 && !isAutomaticWashPage() ? 'open' : ''}>
        <summary>
            <span class="ai-route-rank">${index + 1}</span>
            <span class="ai-route-name"><b>${index===0?'最省候选 · 查看操作':'查看操作'}</b><span>${escapeAiHtml(finalNames)}</span></span>
            <span class="ai-route-total">${Number(route.totalPills).toLocaleString()} 丹<small>${Number(route.totalWashes).toLocaleString()} 次洗脉</small></span>
        </summary>
        <div class="ai-route-body">
            ${Number(route.totalPills) === 0 ? '<p class="ai-route-zero-cost"><strong>无需额外洗髓丹</strong>：这条路线不需要继续洗髓，请按下方步骤调整现有天赋；如需开天赋栏，资质材料仍要另外准备。</p>' : ''}
            <div class="ai-route-metrics">
                <div class="ai-route-metric"><b>${Number(route.totalPills).toLocaleString()}</b><span>总丹耗</span></div>
                <div class="ai-route-metric"><b>${Number(route.totalWashes).toLocaleString()}</b><span>洗髓次数</span></div>
                <div class="ai-route-metric"><b>${Number(route.totalTalentBars).toLocaleString()}</b><span>累计洗出天赋</span></div>
                <div class="ai-route-metric"><b>${Number(route.exchangeCount).toLocaleString()}</b><span>置换次数</span></div>
                <div class="ai-route-metric ${inventory.enough === false ? 'is-short' : ''}"><b>${escapeAiHtml(inventoryLabel)}</b><span>洗髓丹是否够用</span></div>
            </div>
            <p class="ai-visual-heading">路线图 · ${escapeAiHtml(upgradeLabel)}</p>
            ${aiRouteTimelineHtml(route)}
            <p class="ai-visual-heading">洗髓丹消耗分解 · 合计 ${Number(route.totalPills).toLocaleString()} 丹</p>
            ${aiCostBreakdownHtml(route)}
            <p class="ai-visual-heading">详细路线与操作</p>
            ${aiOperationTableHtml(route)}
            <div class="ai-route-footer">
                <span class="ai-final-talents">最终槽位：${escapeAiHtml(finalNames)}</span>
            </div>
        </div>
    </details>
    <button type="button" class="btn btn-reset ai-route-image ai-route-card-export" data-route-index="${index}" aria-label="一键导出第 ${index+1} 条路线图">一键导出路线图</button></div>`;
}

function renderAiPrediction(result, imageContext = {}) {
    const container = document.getElementById('aiPredictionResults');
    if (!container) return;
    aiLastPrediction = result;
    container.dataset.hasResult = 'true';
    if (!result || !result.routes || !result.routes.length) {
        container.innerHTML = `<div class="ai-result-error">${escapeAiHtml(readableWashCopy(result?.noResultReason || '暂未找到已核对的路线，请继续查找。'))}</div>`;
        return;
    }
    const moreWasOpen=container.querySelector('.ai-more-routes')?.open;
    const previousDetails = Array.from(container.querySelectorAll('.ai-route-result'));
    const expanded = new Set(previousDetails.filter(el => el.open).map(el => el.dataset.routeKey));
    result.routes.sort((a, b) => Number(a.totalPills) - Number(b.totalPills) || Number(a.totalWashes) - Number(b.totalWashes));
    container.innerHTML = `<div class="ai-result-summary">
        <span><strong>已找到 ${result.routes.length} 条满足全部目标的路线</strong> · 按耗丹从低到高排序</span>
        <span>目标：${escapeAiHtml((result.targetNames || []).join('、'))}</span>
        <span class="ai-best-cost">当前最省 <strong>${formatCount4(result.routes[0].totalPills)} 丹</strong><small>已通过路线回放 · 尚未证明全局最优</small></span>
        <span>路线以开始查找时的人物状态为起点。</span>
    </div>${isAutomaticWashPage()?aiRouteResultHtml(result.routes[0],0)+(result.routes.length>1?`<details class="ai-more-routes" ${moreWasOpen?'open':''}><summary>其他 ${result.routes.length-1} 条可行路线</summary>${result.routes.slice(1).map((route,i)=>aiRouteResultHtml(route,i+1)).join('')}</details>`:''):result.routes.map(aiRouteResultHtml).join('')}`;

    if (previousDetails.length) container.querySelectorAll('.ai-route-result').forEach(el => { el.open = expanded.has(el.dataset.routeKey); });
    container.querySelectorAll('.ai-route-image').forEach(button => {
        button.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            try {
                if (!imageContext.originReady) throw new Error('请先核验或继续优化这条路线，再生成图片，以免使用了不匹配的起点。');
                if (!window.WashRouteImage) throw new Error('路线图片资源尚未加载，请刷新后重试。');
                // Capture one complete displayed candidate before awaiting any
                // painting. Later cheaper results must not change this image.
                const model = WashRouteImage.buildModel(result, result.routes[Number(button.dataset.routeIndex)], {
                    ...imageContext, talentData: TALENT_DATA, readable: readableWashCopy,
                });
                button.disabled = true;
                button.textContent = '正在生成…';
                await WashRouteImage.show(model, { returnFocus: button, autoSave: true });
            } catch (error) {
                alert(error?.message || '路线图生成失败，请重试。');
            } finally {
                button.disabled = false;
                button.textContent = '一键导出路线图';
            }
        });
    });
}

function aiSearchTaskKey(input) {
    // Keep the original role in memory; persist only its opaque identity.
    const ordered = value => Array.isArray(value) ? value.map(ordered) : (value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value);
    const value = JSON.stringify(ordered(input));
    let a = 2166136261, b = 5381;
    for (let index = 0; index < value.length; index++) {
        a = Math.imul(a ^ value.charCodeAt(index), 16777619);
        b = Math.imul(b, 33) ^ value.charCodeAt(index);
    }
    return `wash-auto-v150-${(a >>> 0).toString(16).padStart(8, '0')}-${(b >>> 0).toString(16).padStart(8, '0')}`;
}

function buildAiSearchInput(ids, maxTotalPills) {
    pushStateToWasm();
    const initialState = wasmGetState();

    initialState.source_role = selectedAutoWashRoleEntry()?.role || state.roleRaw || null;
    return {
        mode: 'automatic',
        initialState,
        savedRole: initialState.source_role,
        vipConfirmed: !!state.vipConfirmed,
        requiredGlobalKeys: aiTargetPoolCache.get(aiTargetPoolRequestKey)?.requiredGlobalKeys || [],
        ruleContextUrl: new URL('../shared/wash_role_context.js?v=20261105313&rev=83768567764a', window.location.href).href,
        targetIds: ids.slice(),
        dlcMode: !!state.dlcMode,
        bagPills: state.bagPills,
        hasBagPills: state.hasBagPills,
        options: { automatic: true, depth: 'deep', collectAllRoutes: true, maxTotalPills },
    };
}

function openWashOriginPreview() {
    const C=window.SBJCloud;if(!C)return;
    const manager=getAiSearchManager(),task=manager?.snapshot(),frozen=task?.status==='running'?manager.getInput():null;
    if(!frozen&&!selectedAutoWashRoleEntry()){C.alert('请先选择人物');return;}
    const field=document.getElementById('aiMaxTotalPills'),budget=Number(frozen?.options?.maxTotalPills??field?.value);
    if(!Number.isSafeInteger(budget)||budget<0||!frozen&&!field?.value.trim()){C.alert('请先填写有效的耗丹上限');return;}
    const input=frozen||buildAiSearchInput([],budget),role=input.savedRole;
    const slots=Number(input.initialState.zizhi)-150,roleName=role?.Name||'当前人物',N=C.node;
    const d=C.modal(roleName+' · 初始脉');d.classList.add('wash-origin-dialog');
    if(d.ownerDocument!==document&&!d.ownerDocument.querySelector('link[data-wash-origin-style]')){const link=d.ownerDocument.createElement('link');link.rel='stylesheet';link.href=document.querySelector('link[href*="wash-compact.css"]')?.href||'/vendor/sanbujin/shared/wash-compact.css';link.dataset.washOriginStyle='true';d.ownerDocument.head.append(link);}
    const description=N('p',`不锁脉、不置换，查看 ${formatCount4(budget)} 丹内从当前存档直接洗出的紫脉；不代表能同时保留。`);description.className='wash-origin-description';
    const vip=N('p',`推演条件：VIP ${input.initialState.vip===0?'0':input.initialState.vip+'+'}（${input.vipConfirmed?'手动确认':'模拟等级，未确认'}），原档 ${slots} 栏。`);vip.className='wash-origin-note';
    const label=N('label'),labelText=N('span','预览栏数'),select=N('select');label.className='wash-origin-slots';label.append(labelText);select.setAttribute('aria-label','初始脉预览栏数');
    if(slots===0){const zero=N('option','当前0栏（无法洗脉）');zero.value='0';select.append(zero);}
    for(let count=Math.max(1,slots);count<=4;count++){const option=N('option',count===slots?`当前 ${count} 栏`:`先开至 ${count} 栏（材料另计）`);option.value=String(count);select.append(option);}
    select.value=String(slots);label.append(select);
    const status=N('p'),note=N('p'),noteDetails=N('details'),noteSummary=N('summary','起点与置换说明'),rows=N('div'),actions=N('div'),stop=N('button','停止预览'),exportImage=N('button','导出初始脉长图'),close=N('button','关闭');exportImage.disabled=true;status.className='wash-origin-status';status.setAttribute('role','status');note.className='wash-origin-note';noteDetails.className='wash-origin-note-details';noteDetails.append(noteSummary,note);rows.className='wash-origin-rows';actions.className='sc-actions';close.type=stop.type=exportImage.type='button';stop.hidden=true;actions.append(stop,exportImage,close);d.append(description,vip,label,status,noteDetails,rows,actions);
    let worker,blobUrl,generation=0,running=false;
    function dispose(){if(worker){worker.terminate();worker=null;}if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}}
    function paint(result){
        exportImage.disabled=false;exportImage.onclick=()=>{try{if(!window.WashRouteImage?.buildOriginModel)throw Error('导出功能尚未加载，请刷新后重试');const model=window.WashRouteImage.buildOriginModel(result,{roleName,vip:input.initialState.vip,vipConfirmed:input.vipConfirmed});window.WashRouteImage.show(model,{returnFocus:exportImage,autoSave:true})}catch(error){C.alert(playerError(error))}};
        rows.replaceChildren();note.textContent=result.existingPurples.length?'起点已有紫脉（0丹）：'+result.existingPurples.map(x=>x.name).join('、'):'起点没有已有紫脉。';
        if(result.firstFixedAtPills!==null)note.textContent+=` 此预览分支在 ${formatCount4(result.firstFixedAtPills)} 丹触发保底并固定置换序列；不会改变原始存档的资格。`;
        status.textContent=`已推演 ${formatCount4(result.spentPills)} / ${formatCount4(budget)} 丹 · 紫脉 ${result.rows.length} 次。`+(result.complete?'已检查预算内次数。':result.stopReason==='cancelled'?'已停止，仅显示已检查部分。':'达到计算量保护上限，仅含已检查部分，可缩小范围重试。');
        if(result.openedSlots)note.textContent+=` 本次假设先开至 ${result.previewSlots} 栏，开栏材料另计。`;
        if(!result.rows.length){rows.append(N('p',result.complete?'该预览范围内未直接洗出紫脉。':'已检查部分尚未洗出紫脉。'));return;}
        const table=N('table');table.className='wash-origin-table';table.setAttribute('aria-label','初始紫脉预览；间隔丹为与上一条紫脉的丹数差，首条以横线表示');const head=N('thead'),tr=N('tr');for(const name of ['第几次','累计丹','间隔丹','紫脉','来源']){const th=N('th',name);th.scope='col';if(name==='间隔丹')th.title='与上一条紫脉之间相差的丹数；首条没有上一紫，记为—';tr.append(th);}head.append(tr);const body=N('tbody');table.append(head,body);rows.append(table);let shown=0;
        const more=N('button','显示更多');more.type='button';function next(){for(let index=shown;index<Math.min(shown+50,result.rows.length);index++){const row=result.rows[index],interval=index===0?'—':formatCount4(row.totalPills-result.rows[index-1].totalPills),line=N('tr');for(const text of [formatCount4(row.washNo),formatCount4(row.totalPills),interval,row.name,row.kind==='pity'?'保底紫':'自然紫'])line.append(N('td',text));body.append(line);}shown+=50;more.hidden=shown>=result.rows.length;}more.onclick=next;rows.append(more);next();
    }
    function start(){
        dispose();const token=++generation,previewSlots=Number(select.value);rows.replaceChildren();note.textContent='';stop.hidden=true;exportImage.disabled=true;
        if(!previewSlots){status.textContent='当前人物尚无可洗脉栏位。请明确选择要开至几栏，再预览；不会修改存档。';return;}
        try{const bundle=window.WASH_ROUTE_WORKER_BUNDLE;if(!bundle?.src)throw Error('本机预览资源尚未加载完成，请刷新后重试');blobUrl=URL.createObjectURL(new Blob([bundle.src],{type:'text/javascript'}));worker=new Worker(blobUrl);running=true;stop.hidden=false;stop.disabled=false;stop.textContent='停止预览';status.textContent='正在读取人物条件并预览…';const requestId='origin-'+Date.now()+'-'+token;
            worker.onerror=event=>{if(token!==generation)return;status.textContent=playerError(event.message||'初始脉预览失败');running=false;stop.hidden=true;dispose();};
            worker.onmessage=event=>{if(token!==generation||event.data.requestId!==requestId)return;const m=event.data;
                if(m.type==='origin-preview-progress')status.textContent=`已推演 ${formatCount4(m.progress.spentPills)} / ${formatCount4(budget)} 丹，发现 ${m.progress.purpleCount} 次紫脉…`;
                if(m.type==='origin-preview-result'){running=false;paint(m.result);stop.textContent='重新预览';stop.disabled=false;dispose();}
                if(m.type==='error'){running=false;status.textContent=playerError(m.error);stop.textContent='重试';stop.disabled=false;dispose();}
            };
            worker.postMessage({type:'origin-preview',requestId,input:{...input,options:undefined,maxTotalPills:budget,previewSlots}});
        }catch(error){status.textContent=playerError(error);running=false;stop.hidden=false;stop.textContent='重试';dispose();}
    }
    select.onchange=start;stop.onclick=()=>{if(!running){start();return;}stop.disabled=true;worker?.postMessage({type:'cancel'});};close.onclick=()=>d.close();d.addEventListener('close',()=>{++generation;dispose()},{once:true});d.showModal();start();
}

async function runAiPrediction(restart = false) {
    renderAiAlgorithmVersion();
    let manager;
    try { manager = await window.WashSearchManager?.ready(); } catch (error) {
        renderAiSearchProgress({ phase: 'error', message: playerError(error) });
        return;
    }
    if (!manager) return;
    if (manager.snapshot().status === 'running') {
        renderAiSearchSnapshot(manager.snapshot(), true);
        return;
    }
    const validation = validateAiTargetSelection();
    if (!validation.valid) return;
    const budgetInput = document.getElementById('aiMaxTotalPills');
    const maxTotalPills = Number(budgetInput?.value);
    if (!Number.isSafeInteger(maxTotalPills) || maxTotalPills < 0 || !budgetInput.value.trim()) { budgetInput.reportValidity(); return; }
    const input = buildAiSearchInput(validation.ids, maxTotalPills);
    aiAttachedTaskKey = aiSearchTaskKey(input);
    aiLastPrediction = null;
    aiRenderedResultRevision = '';
    try {
        const snapshot = manager.start({
            taskKey: aiAttachedTaskKey,
            restart: restart === true,
            input,
            bundle: window.WASH_ROUTE_WORKER_BUNDLE,
            view: {
                roleKey: autoWashSelectedRoleKey,
                roleName: selectedAutoWashRoleEntry()?.role?.Name || '当前人物',
                targetIds: validation.ids.slice(),
                vip: normalizeVipLevel(state.vip),
                dlcMode: !!state.dlcMode,
                maxTotalPills,
            },
        });
        aiAttachedTaskKey = snapshot.taskKey;
        renderAiSearchSnapshot(snapshot);
    } catch (error) {
        aiSearchRunning = false;
        setAiSearchControls(false);
        renderAiSearchProgress({ phase: 'error', message: `查找失败：${error?.message || error}` });
    }
}

function cancelAiPrediction() {
    getAiSearchManager()?.cancel();
}

const EQUIP_AUTO_ALLOWED_PAPER_IDS = new Set(
    typeof EquipmentAutoOptimizer !== 'undefined' ? EquipmentAutoOptimizer.AUTO_PAPER_IDS : [],
);
const EQUIP_AUTO_PROPERTY_LABELS = Object.freeze({ hp_add: '气血' });
const EQUIP_AUTO_RESULT_PAGE_SIZES = Object.freeze([10, 30, 50, 100]);
let autoSimulatorMode = 'wash';
let equipAutoSelectedLocations = new Set();
let equipAutoPaperConfigs = new Map();
let equipAutoSelectedProperties = new Set();
let equipAutoPropertyMode = 'multi'; // multi = 单属性词条模式（默认），combo = 组合属性词条模式
let equipAutoMultiProps = new Set(); // 单属性词条模式选中的属性
let equipAutoRunning = false;
let equipAutoCancelRequested = false;
let equipAutoRunToken = 0;
let equipAutoLastResult = null;
let equipAutoInitialMakeState = null;
let equipAutoResultPage = 1;
let equipAutoResultPageSize = 100;
let equipAutoResultLocationFilter = '';
let equipAutoResultPaperFilter = '';
let equipAutoResultQualityFilter = '';
let equipAutoResultQualityAtLeast = true;
let equipAutoResultSort = 'default';
let equipAutoResultSeedFilter = '';
let equipAutoResultPropFilter = '';
let equipAutoResultRegionFilter = '';
let equipAutoResultBlueMode = 'include';
let equipAutoComboDraft = ['', '', ''];
let equipAutoComboActive = false;
let equipAutoComboPlans = new Map();
let equipAutoComboToken = 0;
let equipAutoComboRunning = false;
let equipAutoManualAttachStates = new Map();
let jianwangAutoRunning = false;
let jianwangAutoCancelRequested = false;
let jianwangAutoRunToken = 0;
let jianwangAutoSwords = [];
let jianwangAutoLastResult = null;

function setAutoSimulatorMode(mode) {
    if(window.SBJ_FEATURE_MODE)mode=window.SBJ_FEATURE_MODE;
    autoSimulatorMode = mode === 'equip' || mode === 'jianwang' ? mode : 'wash';
    const isWash = autoSimulatorMode === 'wash';
    const isEquip = autoSimulatorMode === 'equip';
    const isJianwang = autoSimulatorMode === 'jianwang';
    const washButton = document.getElementById('btnAutoWashMode');
    const equipButton = document.getElementById('btnAutoEquipMode');
    const jianwangButton = document.getElementById('btnAutoJianwangMode');
    const washPanel = document.getElementById('autoWashModePanel');
    const equipPanel = document.getElementById('autoEquipModePanel');
    const jianwangPanel = document.getElementById('autoJianwangModePanel');
    const title = document.getElementById('aiPredictionTitle');
    const intro = document.querySelector('#aiPredictionPanel > .ai-prediction-intro');
    [[washButton, isWash], [equipButton, isEquip], [jianwangButton, isJianwang]].forEach(([button, active]) => {
        if (!button) return;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
    });
    if (washPanel) washPanel.hidden = !isWash;
    if (equipPanel) equipPanel.hidden = !isEquip;
    if (jianwangPanel) jianwangPanel.hidden = !isJianwang;
    if (title) {
        title.textContent = isEquip
            ? '自动模拟 · 装备批量预测'
            : (isJianwang ? '自动模拟 · 剑王阁同词条' : '自动模拟 · 最佳洗脉路线');
    }
    if (intro) {
        intro.textContent = isEquip
            ? '选择工匠、图纸和芒晶材料，设置打造与精炼次数；推演完成后再按属性筛选装备。'
            : (isJianwang
                ? '选择存档中的起始剑、90级镇派路线、目标词条与三同/四同目标。系统会自动保留已有目标词条，跨多把剑搜索首次达到所选同词条门槛的可执行流程。'
                : '选择最终要同时保留的天赋。系统会比较当前天赋栏、逐步开栏、保底卡格和冲突置换等方案，并逐步核对操作和丹耗。');
    }
    const kicker = document.querySelector('#aiPredictionPanel .ai-kicker');
    if (kicker) kicker.textContent = isEquip ? 'LOCAL EQUIPMENT OPTIMIZER' : (isJianwang ? 'LOCAL JIANWANG OPTIMIZER' : 'LOCAL ROUTE OPTIMIZER');
    if (isWash) renderAutoWashSaveGate();
    if (isJianwang) refreshJianwangAutoSwords(true);
}

function invalidateEquipAutoPrediction(message) {
    equipAutoComboToken++; equipAutoComboRunning = false; equipAutoComboActive = false; equipAutoComboPlans = new Map(); equipAutoComboDraft = ['', '', ''];
    equipAutoLastResult = null;
    equipAutoResultPage = 1;
    equipAutoResultLocationFilter = '';
    equipAutoResultPaperFilter = '';
    equipAutoResultQualityFilter = '';
    equipAutoResultQualityAtLeast = true;
    equipAutoManualAttachStates = new Map();
    if (equipAutoRunning) equipAutoCancelRequested = true;
    const results = document.getElementById('autoEquipResults');
    if (results) {
        results.dataset.hasResult = 'false';
        results.innerHTML = `<div class="ai-result-empty">${escapeAiHtml(message || '配置已变化，请重新开始装备自动模拟。')}</div>`;
    }
    if (!equipAutoRunning) {
        const progress = document.getElementById('autoEquipProgress');
        if (progress) progress.hidden = true;
    }
}

function extractEquipMakeRnd(saveData) {
    if (!saveData) return null;
    const makeRnd = saveData.MakeRnd
        || (Array.isArray(saveData) && saveData[0] && saveData[0].MakeRnd)
        || ((saveData.Seeds || saveData.LuckySeeds) ? saveData : null);
    if (!makeRnd) return null;
    return {
        save_version: state.saveVersion || '',
        save_channel: state.saveChannel || '',
        Seeds: makeRnd.Seeds || {},
        LuckySeeds: makeRnd.LuckySeeds || {},
        IDSeeds: makeRnd.IDSeeds || {},
        MakeLucky: makeRnd.MakeLucky || {},
    };
}

function selectedEquipAutoLocationIds() {
    return Array.from(equipAutoSelectedLocations).map(Number).filter(Number.isFinite);
}

function equipAutoAvailablePaperMap() {
    const map = new Map();
    if (typeof EquipmentAutoOptimizer === 'undefined' || typeof EQUIP_DATA === 'undefined') return map;
    selectedEquipAutoLocationIds().forEach(npcId => {
        EquipmentAutoOptimizer.papersForCraftsmanByType(EQUIP_DATA, npcId).forEach(item => {
            if (!EQUIP_AUTO_ALLOWED_PAPER_IDS.has(Number(item.paper.id))) return;
            const minColor = Number(item.paper.min_color || 1);
            const maxColor = Number(item.paper.max_color || 4);
            if (Number(item.equip.lv || 0) < 90 || minColor > 4 || maxColor < 4) return;
            const key = String(item.paper.id);
            const entry = map.get(key) || { ...item, npcIds: [] };
            entry.npcIds.push(npcId);
            map.set(key, entry);
        });
    });
    return map;
}

let equipAutoLocationQuery = "";
let equipAutoLocationType = "all";

function renderEquipAutoLocations() {
    const container = document.getElementById("autoEquipLocationChoices");
    if (!container || typeof EquipmentAutoOptimizer === "undefined" || typeof EQUIP_DATA === "undefined") return;
    const query = String(equipAutoLocationQuery || "").trim().toLowerCase();
    const craftsmen = EquipmentAutoOptimizer.sortedCraftsmen(EQUIP_DATA).filter(craftsman => {
        const isXiu = craftsman.zhi === "fengzhi";
        if (equipAutoLocationType === "tie" && isXiu) return false;
        if (equipAutoLocationType === "xiu" && !isXiu) return false;
        if (!query) return true;
        return String(craftsman.place || "").toLowerCase().includes(query)
            || String(craftsman.name || "").toLowerCase().includes(query);
    });
    const tie = craftsmen.filter(craftsman => craftsman.zhi !== "fengzhi");
    const xiu = craftsmen.filter(craftsman => craftsman.zhi === "fengzhi");
    /* 紫金熔炉 / 月绣 置顶；其余按主线地图解锁顺序「从后往前」排 */
    const MAP_ORDER = [
        "忘忧村", "洛阳", "南阳渡", "姑苏", "杭州", "龙泉镇", "泉州", "沧州",
        "少林寺", "恒山", "天刀门", "十方集", "剑王阁", "幽州", "塞北",
        "凤鸣集", "成都", "泠月宫", "无双城", "铸剑山庄"
    ];
    const pinned = craftsman => {
        const name = String(craftsman.name || "");
        return name.includes("熔炉") || name.includes("月绣") ? 0 : 1;
    };
    const mapRank = craftsman => {
        const place = String(craftsman.place || craftsman.name || "");
        let rank = -1;
        MAP_ORDER.forEach((name, index) => {
            if (place.indexOf(name) >= 0 && index > rank) rank = index;
        });
        /* 「铸炼大师·共戈」地点字段只写了称号，按铸剑山庄算 */
        if (rank < 0 && place.indexOf("铸炼") >= 0) rank = MAP_ORDER.indexOf("铸剑山庄");
        return rank;
    };
    const placeCompare = (a, b) => String(a.place || a.name || "").localeCompare(String(b.place || b.name || ""), "zh");
    /* rank 越大 = 主线越晚 → 排在越前面；没收录的地点（-1）垫底 */
    tie.sort((a, b) => (pinned(a) - pinned(b)) || (mapRank(b) - mapRank(a)) || placeCompare(a, b));
    xiu.sort((a, b) => (pinned(a) - pinned(b)) || (mapRank(b) - mapRank(a)) || placeCompare(a, b));
    const labelHtml = craftsman => {
        const id = Number(craftsman.id);
        const selected = equipAutoSelectedLocations.has(id);
        const place = String(craftsman.place || craftsman.name || "");
        const ownName = String(craftsman.name || "");
        const suffix = craftsman.zhi === "fengzhi" ? "绣" : "铁";
        return "<label class=\"equip-auto-choice " + (selected ? "is-selected" : "") + "\" data-location-id=\"" + id + "\">"
            + "<input type=\"checkbox\" value=\"" + id + "\"" + (selected ? " checked" : "") + ">"
            + "<span><strong>" + escapeAiHtml(place) + "</strong><small>" + escapeAiHtml(ownName) + " · " + suffix + "</small></span>"
            + "</label>";
    };
    const section = (title, items, kind) => {
        if (!items.length) return "";
        const selectedNames = items.filter(craftsman => equipAutoSelectedLocations.has(Number(craftsman.id)))
            .map(craftsman => String(craftsman.name || craftsman.place || ""))
            .filter(Boolean);
        const headExtra = selectedNames.length ? " · 已选 " + selectedNames.join("、") : "";
        return "<div class=\"equip-auto-location-group is-" + kind + "\">"
            + "<div class=\"equip-auto-location-group-head\"><strong>" + title + "</strong><span>" + items.length + " 处" + headExtra + "</span></div>"
            + "<div class=\"equip-auto-choice-grid\">" + items.map(labelHtml).join("") + "</div>"
            + "</div>";
    };
    const scrollTop = container.scrollTop;
    container.innerHTML = section("铁匠铺", tie, "tie") + section("绣庄", xiu, "xiu")
        || "<span class=\"text-muted\">没有匹配的地点，换个关键词试试</span>";
    container.scrollTop = scrollTop;
    const count = document.getElementById("autoEquipLocationCount");
    if (count) {
        const names = Array.from(equipAutoSelectedLocations).map(id => {
            const craftsman = EquipmentAutoOptimizer.sortedCraftsmen(EQUIP_DATA).find(item => Number(item.id) === Number(id));
            return craftsman ? String(craftsman.name || craftsman.place || "") : "";
        }).filter(Boolean);
        count.textContent = names.length ? "已选 " + names.join("、") : "已选 0";
    }
}

function equipAutoAttachPickerHtml(equip, selectedIds) {
    const materials = EquipmentAutoOptimizer.specialMaterialsForEquip(EQUIP_DATA, equip);
    const selectedSet = new Set((selectedIds || []).map(Number));
    const buttons = materials.map(material => {
        const selected = selectedSet.has(Number(material.id));
        const action = selected ? 'remove' : 'add';
        const state = selected ? '已选' : '选择';
        return `<button class="equip-auto-attach-option ${selected ? 'is-selected' : 'is-available'}" type="button" data-attach-action="${action}" data-material-id="${material.id}" aria-pressed="${selected}" aria-label="${state}附加材料 ${escapeAiHtml(material.name)}">
            <span>${escapeAiHtml(material.name)}</span><small>${state}</small>
        </button>`;
    }).join('');
    return `<div class="equip-auto-attach-field">
        <span class="equip-auto-field-label">首次打造附加材料（可多选，分别计算）</span>
        <div class="equip-auto-attach-picker" role="group" aria-label="首次打造附加材料多选">
            <div class="equip-auto-attach-options">${buttons || '<span class="equip-auto-attach-empty">当前装备没有可用附加材料</span>'}</div>
        </div>
    </div>`;
}

function updateEquipAutoAttachMaterialSelection(config, materialId, shouldSelect) {
    if (!config) return false;
    const id = Number(materialId);
    if (!Number.isFinite(id) || id <= 0) return false;
    const current = Array.from(new Set((config.craftMaterialIds || []).map(Number).filter(value => value > 0)));
    const exists = current.includes(id);
    if (shouldSelect && !exists) current.push(id);
    if (!shouldSelect && exists) current.splice(current.indexOf(id), 1);
    config.craftMaterialIds = current;
    return shouldSelect ? !exists : exists;
}

function renderEquipAutoPapers() {
    const container = document.getElementById('autoEquipPaperChoices');
    if (!container) return;
    const available = equipAutoAvailablePaperMap();
    for (const paperId of Array.from(equipAutoPaperConfigs.keys())) {
        if (!available.has(String(paperId))) equipAutoPaperConfigs.delete(String(paperId));
    }
    if (!available.size) {
        container.innerHTML = '<span class="text-muted">先选择至少一个打造地点；这里只显示可出紫且可升炼/精炼的 90～100 级图纸。</span>';
        const count = document.getElementById('autoEquipPaperCount');
        if (count) count.textContent = '已选 0';
        return;
    }
    /* 按主材料分组（紫金 / 乌缕 / 雪银…），组内按部位、等级、名称排 */
    const materialNameOf = item => String((EQUIP_DATA.itemNames && EQUIP_DATA.itemNames[String(item.paper.dz_mat)])
        || ('材料' + item.paper.dz_mat));
    const typeRankOf = item => {
        const type = Number(item.equip.type);
        return Number.isFinite(type) ? type : 99;
    };
    const groupMap = new Map();
    Array.from(available.values()).forEach(item => {
        const key = materialNameOf(item);
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(item);
    });
    const METAL_MATERIALS = ['紫金', '黑铁', '雪银', '赤铜', '风蚀陨铁', '昆吾石'];
    const materialKind = name => (METAL_MATERIALS.indexOf(name) >= 0 ? 'metal' : 'fiber');
    const groupList = Array.from(groupMap.entries()).map(([name, items]) => {
        items.sort((a, b) => (typeRankOf(a) - typeRankOf(b))
            || (Number(b.equip.lv) - Number(a.equip.lv))
            || String(a.equip.name).localeCompare(String(b.equip.name), 'zh'));
        const maxLv = items.reduce((value, item) => Math.max(value, Number(item.equip.lv) || 0), 0);
        return { name, items, maxLv, kind: materialKind(name) };
    }).sort((a, b) => (b.items.length - a.items.length)
        || (b.maxLv - a.maxLv)
        || a.name.localeCompare(b.name, 'zh'));

    const cardHtml = item => {
        const paperId = String(item.paper.id);
        const config = equipAutoPaperConfigs.get(paperId);
        const selected = !!config;
        const attachIds = config && config.craftMaterialIds || [];
        const supportedProps = EquipmentAutoOptimizer.supportedTargetProperties(item.equip, EQUIP_DATA, EquipmentAutoOptimizer.TARGET_PROPERTIES);
        const compatibleSelected = supportedProps.filter(prop => equipAutoSelectedProperties.has(prop));
        const isIncompatible = equipAutoSelectedProperties.size > 0 && compatibleSelected.length === 0;        const supportedLabels = supportedProps.map(equipAutoPropertyLabel).join('、');
        return `<div class="equip-auto-paper-card ${selected ? 'is-selected' : ''} ${isIncompatible ? 'is-incompatible' : ''}" data-paper-id="${paperId}" data-search="${escapeAiHtml(`${item.equip.name} ${item.paper.name}`.toLowerCase())}">
            <label class="equip-auto-paper-check">
                <input class="equip-auto-paper-toggle" type="checkbox" value="${paperId}" ${selected ? 'checked' : ''}>
                <strong title="${escapeAiHtml(item.paper.name)} · ${Number(item.equip.lv)}级${item.equip.lv === 90 ? '（自动升炼）' : ''} · 可在 ${item.npcIds.length} 个已选地点打造 · 可精炼：${escapeAiHtml(supportedLabels || '无目标属性')}">${escapeAiHtml(item.equip.name)} · ${escapeAiHtml(EQUIP_DATA.typeNames[String(item.equip.type)] || item.equip.type)}</strong>
            </label>

        </div>`;
    };

    container.innerHTML = groupList.map(group => {
        const hasSelected = group.items.some(item => equipAutoPaperConfigs.has(String(item.paper.id)));
        const selectedNames = group.items.filter(item => equipAutoPaperConfigs.has(String(item.paper.id)))
            .map(item => String(item.equip.name || item.paper.name || ''));
        const headExtra = selectedNames.length ? ' · 已选 ' + selectedNames.join('、') : '';
        return '<div class="equip-auto-paper-group is-' + group.kind + '" data-material="' + escapeAiHtml(group.name) + '">'
            + '<div class="equip-auto-paper-group-head"><strong>' + escapeAiHtml(group.name) + '</strong><span>' + group.items.length + ' 张' + headExtra + '</span></div>'
            + '<div class="equip-auto-paper-group-body">' + group.items.map(cardHtml).join('') + '</div>'
            + '</div>';
    }).join('');
    filterEquipAutoPapers();
    const count = document.getElementById('autoEquipPaperCount');
    if (count) {
        const names = Array.from(equipAutoPaperConfigs.keys()).map(paperId => {
            const paper = EQUIP_DATA.papers && EQUIP_DATA.papers[String(paperId)];
            const equip = paper && EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(paper.dz_equip)];
            return equip ? String(equip.name || '') : (paper ? String(paper.name || '').replace(/图样$/, '') : '');
        }).filter(Boolean);
        count.textContent = names.length ? '已选 ' + names.join('、') : '已选 0';
    }
}

function filterEquipAutoPapers() {
    const query = String(document.getElementById('autoEquipPaperSearch')?.value || '').trim().toLowerCase();
    document.querySelectorAll('#autoEquipPaperChoices .equip-auto-paper-card').forEach(card => {
        card.classList.toggle('is-hidden', !!query && !String(card.dataset.search || '').includes(query));
    });
    /* 搜索后把整组都空掉的分组标题也收起来；有搜索词时自动展开有结果的分组 */
    document.querySelectorAll('#autoEquipPaperChoices .equip-auto-paper-group').forEach(group => {
        const visible = group.querySelectorAll('.equip-auto-paper-card:not(.is-hidden)').length;
        group.classList.toggle('is-hidden', visible === 0);
        if (query) {
            if (visible > 0) group.setAttribute('open', '');
        } else {
            const hasSelected = Array.from(group.querySelectorAll('.equip-auto-paper-card.is-selected')).length > 0;
            if (hasSelected) group.setAttribute('open', '');
            else group.removeAttribute('open');
        }
    });
}

let equipAutoSlotCombos = new Map(); // paperId -> 三个槽位
let equipAutoActiveSlot = { paperId: '', index: 0 };

let equipAutoSlotFollow = new Map(); // paperId -> [false, true, true]，词条2/3 默认跟随词条1

function equipAutoFollowFor(paperId) {
    const key = String(paperId || '');
    if (!equipAutoSlotFollow.has(key)) equipAutoSlotFollow.set(key, [false, true, true]);
    return equipAutoSlotFollow.get(key);
}

function equipAutoSlotFor(paperId) {
    const key = String(paperId || '');
    if (!equipAutoSlotCombos.has(key)) equipAutoSlotCombos.set(key, ['', '', '']);
    return equipAutoSlotCombos.get(key);
}

function equipAutoSelectedPapers() {
    return Array.from(equipAutoPaperConfigs.keys());
}

function equipAutoSupportedPropsForPaper(paperId) {
    const all = EquipmentAutoOptimizer.TARGET_PROPERTIES.slice();
    const paper = EQUIP_DATA.papers && EQUIP_DATA.papers[String(paperId)];
    const equip = paper && EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(paper.dz_equip)];
    if (!equip) return all;
    const supported = EquipmentAutoOptimizer.supportedTargetProperties(equip, EQUIP_DATA, all);
    return supported.length ? all.filter(prop => supported.indexOf(prop) >= 0) : all;
}

function equipAutoSupportedPropsForSelection() {
    const papers = equipAutoSelectedPapers();
    if (!papers.length) return EquipmentAutoOptimizer.TARGET_PROPERTIES.slice();
    const set = new Set();
    papers.forEach(paperId => equipAutoSupportedPropsForPaper(paperId).forEach(prop => set.add(prop)));
    const all = EquipmentAutoOptimizer.TARGET_PROPERTIES;
    return all.filter(prop => set.has(prop));
}

function equipAutoComboProps() {
    const set = new Set();
    if (equipAutoPropertyMode === 'multi') {
        equipAutoMultiProps.forEach(prop => set.add(prop));
        return Array.from(set);
    }
    equipAutoSelectedPapers().forEach(paperId => {
        equipAutoSlotFor(paperId).forEach(value => { if (value) set.add(value); });
    });
    return Array.from(set);
}

function equipAutoSyncComboSelection() {
    equipAutoSelectedProperties.clear();
    equipAutoComboProps().forEach(prop => equipAutoSelectedProperties.add(prop));
}

function equipAutoSlotPlan(candidate) {
    if (candidate && candidate.allRefinements) return equipAutoComboActive ? (equipAutoComboPlans.get(String(candidate.id))?.slots || false) : null;
    const paperId = String(candidate && candidate.paperId != null ? candidate.paperId : '');
    if (equipAutoPropertyMode === 'multi') {
        /* 单属性模式：三个词条全部精炼成同一个属性；多选时每个属性各算一套，取总属性最高的一套 */
        const wanted = Array.from(equipAutoMultiProps);
        if (!wanted.length) return null;
        const plan = [];
        wanted.forEach(prop => {
            const refinement = (candidate && candidate.refinements || []).find(item => item && item.prop === prop);
            if (!refinement || !refinement.maxima) return;
            [1, 2, 3].forEach(slot => {
                const maximum = refinement.maxima[slot];
                const value = Number(maximum && maximum.value);
                if (!Number.isFinite(value)) return;
                plan.push({ slot: slot, prop: prop, value: value });
            });
        });
        if (!plan.length) return false;
        return plan;
    }
    const slots = equipAutoSlotFor(paperId);
    if (!slots.some(Boolean)) return null;
    /* 组合模式：严格按词条位匹配——填了词条2、3，就要求第 2、3 格真的是该属性。
       空着的词条位不参与要求（该位任意）。 */
    const plan = [];
    for (let i = 0; i < 3; i++) {
        const prop = slots[i];
        if (!prop) { plan.push(null); continue; }
        const refinement = (candidate && candidate.refinements || []).find(item => item && item.prop === prop);
        const maximum = refinement && refinement.maxima && refinement.maxima[i + 1];
        if (!maximum) return false;
        plan.push({ slot: i + 1, prop: prop, value: maximum.value });
    }
    return plan;
}

function renderEquipAutoProperties() {
    const container = document.getElementById('autoEquipPropertyChoices');
    if (!container || typeof EquipmentAutoOptimizer === 'undefined' || typeof EQUIP_DATA === 'undefined') return;
    const papers = equipAutoSelectedPapers();
    if (!papers.length) {
        container.innerHTML = '<p class="equip-auto-slot-hint">选择图纸后，可在这里选择首次打造的芒晶材料。</p>';
        return;
    }
    const groups = papers.map(paperId => {
        const paper = EQUIP_DATA.papers && EQUIP_DATA.papers[String(paperId)];
        const equip = paper && EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(paper.dz_equip)];
        if (!equip) return '';
        const materials = EquipmentAutoOptimizer.specialMaterialsForEquip(EQUIP_DATA, equip);
        const config = equipAutoPaperConfigs.get(String(paperId));
        const picked = new Set(((config && config.craftMaterialIds) || []).map(Number));
        const level = Number(equip.lv) || 90;
        const chips = materials.map(material => {
            const pairs = Array.isArray(material.prop) ? material.prop : [];
            const table = material.lvs || {}; const raw = table['lv' + level] != null ? table['lv' + level] : table.lv90;
            const values = pairs.map((pair, index) => {
                const prop = pair && pair[0], value = Array.isArray(raw) ? raw[index] : raw;
                return prop && value != null ? escapeAiHtml(equipAutoPropertyLabel(prop)) + '+' + escapeAiHtml(equipAutoFormatPropValue(prop, value)) : '';
            }).filter(Boolean).join(' · ');
            const selected = picked.has(Number(material.id));
            return '<button type="button" class="equip-auto-attach-chip' + (selected ? ' is-selected' : '') + '" data-attach-paper="' + escapeAiHtml(String(paperId)) + '" data-attach-material="' + Number(material.id) + '" aria-pressed="' + selected + '">' + escapeAiHtml(material.name) + (values ? '<small>' + values + '</small>' : '') + '</button>';
        }).join('');
        const name = String(paper.name || equip.name || '').replace(/图样$/, '');
        return '<div class="equip-auto-attach-group"><div class="equip-auto-attach-group-title">' + escapeAiHtml(name) + '</div><div class="equip-auto-attach-row">' + (chips || '<span>无可选材料</span>') + '</div></div>';
    }).join('');
    container.innerHTML = '<section class="equip-auto-subpanel is-attach"><div class="equip-auto-subpanel-head"><strong>芒晶属性</strong><em>首次打造附加材料，可多选</em></div>' + groups + '<p class="equip-auto-slot-hint">每种材料各形成一条独立打造分支；不选则按普通打造。</p></section>';
    container.querySelectorAll('[data-attach-material]').forEach(button => button.addEventListener('click', () => {
        const config = equipAutoPaperConfigs.get(String(button.dataset.attachPaper || ''));
        if (!config) return;
        const materialId = Number(button.dataset.attachMaterial);
        const shouldSelect = !config.craftMaterialIds || !config.craftMaterialIds.map(Number).includes(materialId);
        if (!updateEquipAutoAttachMaterialSelection(config, materialId, shouldSelect)) return;
        renderEquipAutoProperties();
        invalidateEquipAutoPrediction('芒晶材料已变化，请重新开始装备自动模拟。');
    }));
}

let equipAutoDefaultLocationsApplied = false;

function equipAutoCraftsmanByKeyword(keyword) {
    const list = EquipmentAutoOptimizer.sortedCraftsmen(EQUIP_DATA);
    return list.find(craftsman => String(craftsman.name || "").includes(keyword)) || null;
}

function applyEquipAutoDefaultLocations() {
    if (equipAutoDefaultLocationsApplied) return;
    equipAutoDefaultLocationsApplied = true;
    if (equipAutoSelectedLocations.size) return;
    ["紫金熔炉", "月绣"].forEach(keyword => {
        const craftsman = equipAutoCraftsmanByKeyword(keyword);
        if (craftsman) equipAutoSelectedLocations.add(Number(craftsman.id));
    });
}

function applyEquipAutoDefaultProperties() {
    if (equipAutoComboProps().length) return;
    const list = (typeof EquipmentAutoOptimizer !== 'undefined' && EquipmentAutoOptimizer.TARGET_PROPERTIES) || [];
    const preferred = list.includes('atk_add') ? 'atk_add' : list[0];
    const paperId = equipAutoSelectedPapers()[0];
    if (!preferred || paperId == null) return;
    equipAutoSlotFor(paperId)[0] = preferred;
    equipAutoSyncComboSelection();
}

function initializeEquipAutoControls() {
    equipAutoLoadFavorites();
    renderEquipAutoFavorites();
    if (typeof EquipmentAutoOptimizer === 'undefined' || typeof EQUIP_DATA === 'undefined') return;
    applyEquipAutoDefaultLocations();
    renderEquipAutoLocations();
    applyEquipAutoDefaultProperties();
    renderEquipAutoPapers();
    renderEquipAutoProperties();
}

function handleEquipAutoLocationClick(event) {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const label = event.target.closest('.equip-auto-choice[data-location-id]');
    if (!label) return;
    const id = Number(label.dataset.locationId);
    const checkbox = event.target;
    if (checkbox.checked) equipAutoSelectedLocations.add(id);
    else equipAutoSelectedLocations.delete(id);
    if (checkbox.checked) {
        /* 勾选任意地点后，自动展开第 2 步「选择图纸」 */
        const paperSection = document.querySelectorAll('details.equip-auto-section')[1];
        if (paperSection) paperSection.setAttribute('open', '');
    }
    renderEquipAutoLocations();
    renderEquipAutoPapers();
    renderEquipAutoProperties();
    invalidateEquipAutoPrediction('地点已变化，请重新开始装备自动模拟。');
}

function equipAutoDefaultPropForType(type) {
    const numeric = Number(type) || 0;
    if (numeric >= 1 && numeric <= 4) return 'def_ign';      /* 拳套 / 刀 / 剑 / 枪棍 → 穿甲 */
    if (numeric === 7) return 'dmg_off';                      /* 内甲 → 免伤 */
    if (numeric === 8 || numeric === 9) return 'atk_add';     /* 戒指 / 挂坠 → 攻击 */
    return '';
}

function handleEquipAutoPaperChange(event) {
    const card = event.target.closest('.equip-auto-paper-card');
    if (!card) return;
    const paperId = String(card.dataset.paperId);
    if (event.target.classList.contains('equip-auto-paper-toggle')) {
        let armourDefaults = false;
        if (event.target.checked) {
            /* 默认附加材料：内甲优先佛刻（6884），其余优先龙骨（2021）。 */
            const paperItem = equipAutoAvailablePaperMap().get(paperId);
            const paperMaterials = paperItem && typeof EquipmentAutoOptimizer !== 'undefined' && typeof EQUIP_DATA !== 'undefined'
                ? EquipmentAutoOptimizer.specialMaterialsForEquip(EQUIP_DATA, paperItem.equip) : [];
            const equipType = paperItem && paperItem.equip ? Number(paperItem.equip.type) : 0;
            const hasMaterial = id => paperMaterials.some(material => Number(material.id) === Number(id));
            armourDefaults = equipType === 7;
            let defaultIds = [];
            if (armourDefaults && hasMaterial(6884)) defaultIds = [6884];
            else if (hasMaterial(2021)) defaultIds = [2021];
            equipAutoPaperConfigs.set(paperId, { craftMaterialIds: defaultIds });
        } else {
            equipAutoPaperConfigs.delete(paperId);
        }
        renderEquipAutoPapers();
        /* 有图纸时展开 03～06 步；图纸清空则自动收起 */
        const hasPapers = equipAutoPaperConfigs.size > 0;
        document.querySelectorAll('details.equip-auto-section').forEach((section, index) => {
            if (index < 2) return;
            if (hasPapers) {
                /* 只展开 03~05，收藏列表（06）保持默认收起 */
                if (index <= 3) section.setAttribute('open', '');
                else section.removeAttribute('open');
            } else section.removeAttribute('open');
        });
        renderEquipAutoProperties();
    }
    invalidateEquipAutoPrediction('图纸或附加材料已变化，请重新开始装备自动模拟。');
}

function handleEquipAutoPaperClick(event) {
    const button = event.target.closest('.equip-auto-attach-option[data-attach-action][data-material-id]');
    if (!button) return;
    const card = button.closest('.equip-auto-paper-card');
    if (!card) return;
    const config = equipAutoPaperConfigs.get(String(card.dataset.paperId));
    const shouldSelect = button.dataset.attachAction === 'add';
    if (!updateEquipAutoAttachMaterialSelection(config, button.dataset.materialId, shouldSelect)) return;
    const list = document.getElementById('autoEquipPaperChoices');
    const scrollTop = list ? list.scrollTop : 0;
    renderEquipAutoPapers();
    if (list) list.scrollTop = scrollTop;
    invalidateEquipAutoPrediction('附加材料已变化，请重新开始装备自动模拟。');
}

function handleEquipAutoPropertyClick(event) {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const label = event.target.closest('.equip-auto-choice[data-property]');
    if (!label) return;
    const prop = label.dataset.property;
    const checkbox = event.target;
    if (checkbox.checked) equipAutoSelectedProperties.add(prop);
    else equipAutoSelectedProperties.delete(prop);
    renderEquipAutoProperties();
    renderEquipAutoPapers();
    invalidateEquipAutoPrediction('目标属性已变化，请重新开始装备自动模拟。');
}

function buildEquipAutoBranches() {
    const branches = [];
    const availableByNpc = new Map();
    selectedEquipAutoLocationIds().forEach(npcId => {
        availableByNpc.set(npcId, new Set(
            EquipmentAutoOptimizer.papersForCraftsmanByType(EQUIP_DATA, npcId).map(item => String(item.paper.id)),
        ));
    });
    selectedEquipAutoLocationIds().forEach(npcId => {
        equipAutoPaperConfigs.forEach((config, paperId) => {
            if (!availableByNpc.get(npcId)?.has(String(paperId))) return;
            const specialIds = Array.from(new Set((config.craftMaterialIds || []).map(Number).filter(id => id > 0)));
            const paperSlots = equipAutoSlotFor(String(paperId));
            const slotTargets = equipAutoPropertyMode === 'multi'
                ? Array.from(equipAutoMultiProps).flatMap(prop => [1, 2, 3].map(slot => ({ slot, prop })))
                : paperSlots.map((prop, index) => (prop ? { slot: index + 1, prop } : null)).filter(Boolean);
            /* 组合模式：词条位 = 精炼目标；空着表示这一位不精炼（保持原属性）。
               不再按「打造词条」过滤结果——精炼本来就能把任意格子洗成任意属性。 */
            const slotFilter = null;
            (specialIds.length ? specialIds : [0]).forEach(specialId => {
                branches.push({
                    npcId,
                    paperId: Number(paperId),
                    specialId,
                    slotTargets,
                    slotFilter,
                });
            });
        });
    });
    return branches;
}

function clampEquipAutoNumber(id, min, max, fallback) {
    const element = document.getElementById(id);
    let value = parseInt(element?.value || String(fallback), 10);
    if (Number.isNaN(value)) value = fallback;
    value = Math.max(min, Math.min(max, value));
    if (element) element.value = String(value);
    return value;
}

function validateEquipAutoSelection() {
    const errors = [];
    const makeRnd = extractEquipMakeRnd(state.saveData);
    const branches = buildEquipAutoBranches();
    if (!makeRnd) errors.push('请先导入包含打造状态的有效存档');
    if (!equipAutoSelectedLocations.size) errors.push('请至少选择一个打造地点');
    if (!equipAutoPaperConfigs.size) errors.push('请至少选择一张图纸');
    if (!branches.length && equipAutoPaperConfigs.size) errors.push('当前地点与图纸没有可打造组合');
    const targetProps = EquipmentAutoOptimizer.TARGET_PROPERTIES.slice();
    const compatibleBranches = branches.filter(branch => {
        const paper = EQUIP_DATA.papers[String(branch.paperId)];
        const equip = paper && EQUIP_DATA.equipment[String(paper.dz_equip)];
        return equip && EquipmentAutoOptimizer.supportedTargetProperties(equip, EQUIP_DATA, targetProps).length > 0;
    });
    const skippedBranchCount = branches.length - compatibleBranches.length;
    if (branches.length && targetProps.length && !compatibleBranches.length) {
        errors.push('所选图纸均不会出现当前目标属性，请更换图纸或属性');
    }
    const message = document.getElementById('autoEquipSelectionMessage');
    if (message) {
        message.textContent = errors.length
            ? errors.join('；')
            : (skippedBranchCount ? `将运行 ${compatibleBranches.length} 个兼容分支，跳过 ${skippedBranchCount} 个不可能出现目标属性的分支。` : '可以开始模拟；精炼属性将在结果中筛选。');
        message.classList.toggle('is-error', errors.length > 0);
    }
    return { valid: errors.length === 0, errors, makeRnd, branches, compatibleBranches, skippedBranchCount };
}

function renderEquipAutoProgress(progress) {
    const panel = document.getElementById('autoEquipProgress');
    const text = document.getElementById('autoEquipProgressText');
    const percent = document.getElementById('autoEquipProgressPercent');
    const fill = document.getElementById('autoEquipProgressFill');
    if (!panel) return;
    const ratio = progress.total > 0 ? Math.max(0, Math.min(1, progress.done / progress.total)) : 0;
    const value = progress.phase === 'refine' ? 45 + ratio * 55 : ratio * 45;
    panel.hidden = false;
    if (text) text.textContent = progress.message || '正在计算…';
    if (percent) percent.textContent = `${Math.round(value)}%`;
    if (fill) fill.style.width = `${value}%`;
}

function equipAutoUsesPercentFormat(prop, value) {
    const number = Number(value);
    return Number.isFinite(number) && (number < 1 || prop === 'atk_extend');
}

function equipAutoTruncateDecimal(value, decimals = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return number;
    const factor = 10 ** decimals;
    return Math.floor(number * factor + 1e-8) / factor;
}

function equipAutoFormatDecimal(value, decimals = 1) {
    const truncated = equipAutoTruncateDecimal(value, decimals);
    if (!Number.isFinite(truncated)) return String(value);
    return Number(truncated.toFixed(decimals)).toString();
}

function equipAutoPercentagePoints(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return equipAutoTruncateDecimal(number * 100);
}

function equipAutoFormatPercentagePoints(value) {
    return equipAutoFormatDecimal(value);
}

function equipAutoFormatPropValue(prop, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (equipAutoUsesPercentFormat(prop, number)) return `${equipAutoFormatPercentagePoints(equipAutoPercentagePoints(number))}%`;
    return equipAutoFormatDecimal(number);
}

function equipAutoFormatRefinementTotal(refinement) {
    const total = Number(refinement && refinement.total);
    if (!Number.isFinite(total)) {
        return equipAutoFormatPropValue(refinement && refinement.prop, refinement && refinement.total);
    }
    const slotValues = [1, 2, 3]
        .map(slot => Number(refinement && refinement.maxima && refinement.maxima[slot] && refinement.maxima[slot].value))
        .filter(Number.isFinite);
    if (!slotValues.length) return equipAutoFormatPropValue(refinement.prop, total);
    if (equipAutoUsesPercentFormat(refinement && refinement.prop, total)) {
        const displayedTotal = slotValues.reduce((sum, value) => sum + equipAutoPercentagePoints(value), 0);
        return `${equipAutoFormatPercentagePoints(displayedTotal)}%`;
    }
    const displayedTotal = slotValues.reduce((sum, value) => sum + equipAutoTruncateDecimal(value), 0);
    return equipAutoFormatDecimal(displayedTotal);
}

function equipAutoPropertyLabel(prop) {
    return EQUIP_AUTO_PROPERTY_LABELS[prop] || EQUIP_DATA.propNames[prop] || prop;
}

function equipAutoFormatProps(items) {
    if (!items || !items.length) return '无';
    return items.map(item => `${escapeAiHtml(equipAutoPropertyLabel(item.prop))}+${escapeAiHtml(equipAutoFormatPropValue(item.prop, item.value))}`).join('、');
}

function equipAutoFormatBase(base) {
    const entries = Object.entries(base || {});
    if (!entries.length) return '无';
    return entries.map(([prop, value]) => `${escapeAiHtml(EQUIP_DATA.propNames[prop] || prop)}+${escapeAiHtml(equipAutoFormatPropValue(prop, value))}`).join('、');
}

function equipAutoFormatSilver(value) {
    const amount = Math.max(0, Math.trunc(Number(value) || 0));
    const liang = Math.floor(amount / 1000);
    const wen = amount % 1000;
    return `${liang ? `${liang.toLocaleString()}两` : ''}${wen || !liang ? `${wen}文` : ''}`;
}

function equipAutoFormatCost(cost) {
    if (!cost) return '无';
    const parts = (cost.materials || []).filter(item => Number(item.amount) > 0)
        .map(item => `${escapeAiHtml(item.name)}×${Number(item.amount).toLocaleString()}`);
    if (cost.mainMaterial && cost.mainAmount) parts.push(`${escapeAiHtml(cost.mainMaterial.name)}×${Number(cost.mainAmount).toLocaleString()}`);
    if (cost.lianjin) parts.push(`连金泥×${Number(cost.lianjin).toLocaleString()}`);
    if (cost.silver) parts.push(`银两${equipAutoFormatSilver(cost.silver)}`);
    return parts.join(' · ') || '无';
}

function mergeEquipAutoCosts(...costs) {
    const materials = new Map();
    let silver = 0;
    const addMaterial = (material, amount) => {
        const value = Math.max(0, Number(amount) || 0);
        if (!material || !value) return;
        const name = String(material.name || material.id || '材料');
        const key = `${material.id ?? ''}:${name}`;
        const current = materials.get(key) || { id: material.id, name, amount: 0 };
        current.amount += value;
        materials.set(key, current);
    };
    costs.filter(Boolean).forEach(cost => {
        (cost.materials || []).forEach(item => addMaterial(item, item.amount));
        addMaterial(cost.mainMaterial, cost.mainAmount);
        if (cost.lianjin) addMaterial({ id: 8801, name: '连金泥' }, cost.lianjin);
        silver += Math.max(0, Number(cost.silver) || 0);
    });
    return {
        materials: Array.from(materials.values()).sort((a, b) => Number(a.name === '连金泥') - Number(b.name === '连金泥')),
        silver,
    };
}

function equipAutoRefinementHtml(refinement, upgradeCost = null) {
    const label = equipAutoPropertyLabel(refinement.prop);
    const slots = [1, 2, 3].map(slot => {
        const maximum = refinement.maxima[slot];
        if (!maximum) return `<span>词条 ${slot}：无</span>`;
        const occurrences = maximum.occurrences.map(item => item.source === 'original' ? '原有' : `#${item.index}`).join('、');
        return `<span>词条 ${slot}：${escapeAiHtml(equipAutoFormatPropValue(refinement.prop, maximum.value))}<small>（${occurrences}）</small></span>`;
    }).join('');
    const plan = refinement.plan;
    const accepts = plan ? plan.accepts.map(item => `#${item.index}（词条${item.slot}）`).join(' → ') : '无';
    const totalCost = mergeEquipAutoCosts(upgradeCost, plan && plan.cost);
    return `<div class="equip-auto-refine-card">
        <div class="equip-auto-refine-title"><strong>精炼 · ${escapeAiHtml(label)}</strong><span class="equip-auto-max-value">最高${escapeAiHtml(label)} ${escapeAiHtml(equipAutoFormatRefinementTotal(refinement))}</span></div>
        <div class="equip-auto-slot-list">${slots}</div>
        <div>状态回放：${accepts}${plan ? `，做到第 ${plan.cutoff} 次为止` : ''}</div>
        <div class="equip-auto-cost-line">消耗（精炼消耗）：${plan ? equipAutoFormatCost(plan.cost) : '无'}</div>
        <div class="equip-auto-total-cost-line">总消耗（升炼 + 精炼）：${equipAutoFormatCost(totalCost)}</div>
    </div>`;
}

function equipAutoAttachmentHtml(attachment) {
    const stageText = attachment.stage === 'before' ? '升炼前' : '升炼后';
    const levelText = Number(attachment.equipLevel) > 0 ? ` · ${Number(attachment.equipLevel)}级` : '';
    const stageHtml = `<span class="equip-auto-attachment-stage">${stageText}${levelText}</span>`;
    if (attachment.unavailable) {
        return `<div class="equip-auto-attach-card"><strong>附加 · ${escapeAiHtml(attachment.materialName)} ${stageHtml}</strong><div class="ai-result-error">附加不可用</div></div>`;
    }
    const maxima = (attachment.maxima || []).filter(item => item.recommendedIndex != null);
    const maximumSummary = maxima.map(maximum => `最高${escapeAiHtml(equipAutoPropertyLabel(maximum.prop))} ${escapeAiHtml(equipAutoFormatPropValue(maximum.prop, maximum.value))} · 第 ${maximum.indexes.join('、')} 次`).join('；');
    const sequenceItems = attachment.items || [];
    const showProperty = new Set(sequenceItems.map(item => item.prop)).size > 1;
    const maximumIndexes = new Set(maxima.flatMap(maximum => maximum.indexes || []).map(Number));
    const sequence = sequenceItems.map(item => {
        const value = equipAutoFormatPropValue(item.prop, item.value);
        const property = showProperty ? `<span class="equip-auto-attach-sequence-prop">${escapeAiHtml(equipAutoPropertyLabel(item.prop))}</span>` : '';
        const isMaximum = maximumIndexes.has(Number(item.index));
        const ratingKey = equipAutoAttachmentRatingKey(item);
        return `<li class="equip-auto-attach-sequence-item${ratingKey ? ` is-rating-${ratingKey}` : ''}${isMaximum ? ' is-maximum' : ''}">
            <span class="equip-auto-attach-sequence-index">第 ${Number(item.index)} 次</span>
            ${property}
            <strong class="equip-auto-attach-sequence-value">${escapeAiHtml(value)}</strong>
            ${isMaximum ? '<span class="equip-auto-attach-sequence-badge">最高</span>' : ''}
        </li>`;
    }).join('');
    return `<div class="equip-auto-attach-card">
        <div class="equip-auto-refine-title"><strong>芒晶洗练 · ${escapeAiHtml(attachment.materialName)} ${stageHtml}</strong><span class="equip-auto-attachment-value">${maximumSummary || '预测范围内未出现可用属性'}</span></div>
        <div class="equip-auto-attachment-maxima">${maxima.map(maximum => `<div class="equip-auto-attachment-maximum">
            <span>${escapeAiHtml(equipAutoPropertyLabel(maximum.prop))}</span>
            <span class="equip-auto-cost-line">消耗：芒晶×${maximum.recommendedIndex}</span>
        </div>`).join('')}</div>
        ${sequence ? `<ol class="equip-auto-attach-sequence" aria-label="芒晶洗练逐次结果">${sequence}</ol>` : ''}
    </div>`;
}

const EQUIP_AUTO_ATTACHMENT_RATING_KEYS = Object.freeze(['white', 'green', 'blue', 'purple', 'gold', 'red']);

function equipAutoAttachmentRatingKey(item) {
    const value = Number(item && item.value);
    const minimum = Number(item && item.valueMinimum);
    const maximum = Number(item && item.valueMaximum);
    if (![value, minimum, maximum].every(Number.isFinite) || maximum < minimum) return '';
    if (maximum === minimum) return 'red';
    const ratio = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
    const index = ratio >= 1
        ? EQUIP_AUTO_ATTACHMENT_RATING_KEYS.length - 1
        : Math.floor(ratio * EQUIP_AUTO_ATTACHMENT_RATING_KEYS.length);
    return EQUIP_AUTO_ATTACHMENT_RATING_KEYS[index];
}

function equipAutoManualAttachState(candidate) {
    const key = String(candidate && candidate.id || '');
    let current = equipAutoManualAttachStates.get(key);
    if (!current) {
        current = { stage: 'before', count: 500, result: null, error: '' };
        equipAutoManualAttachStates.set(key, current);
    }
    return current;
}

function equipAutoManualAttachHtml(candidate) {
    const candidateId = String(candidate && candidate.id || '');
    const firstStage = Number(candidate && candidate.craftSpecialEquipLevel) > 0
        ? `升炼前 · ${Number(candidate.craftSpecialEquipLevel)}级`
        : '升炼前';
    if (!candidate || !candidate.canSimulateSpecialAttach || !candidate.specialAttachEquips || !candidate.craftSpecialId) {
        return `<div class="equip-auto-manual-attach is-unavailable" data-candidate-id="${escapeAiHtml(candidateId)}">
            <p class="ai-visual-heading">附加属性</p>
            <div class="equip-auto-attach-card"><strong>未进行首次打造附加</strong><p>图纸未选择附加材料，无法使用芒晶模拟。</p></div>
        </div>`;
    }
    const state = equipAutoManualAttachState(candidate);
    const stage = state.stage === 'after' ? 'after' : 'before';
    const result = state.result ? equipAutoAttachmentHtml(state.result) : '';
    return `<div class="equip-auto-manual-attach" data-candidate-id="${escapeAiHtml(candidateId)}">
        <p class="ai-visual-heading">附加属性</p>
        <div class="equip-auto-attach-card equip-auto-crafted-special">
            <div class="equip-auto-refine-title"><strong>芒晶1次 · ${escapeAiHtml(candidate.craftSpecialName)}</strong><span class="equip-auto-attachment-stage">${firstStage}</span></div>
            <div class="equip-auto-crafted-special-value">${equipAutoFormatProps(candidate.special)}</div>
        </div>
        <div class="equip-auto-manual-attach-controls" aria-label="后续芒晶洗练设置">
            <div class="equip-auto-manual-stage" role="group" aria-label="芒晶洗练阶段">
                <button type="button" data-manual-attach-action="stage" data-stage="before" class="${stage === 'before' ? 'is-active' : ''}" aria-pressed="${stage === 'before'}">升炼前</button>
                <button type="button" data-manual-attach-action="stage" data-stage="after" class="${stage === 'after' ? 'is-active' : ''}" aria-pressed="${stage === 'after'}">升炼后</button>
            </div>
            <label>模拟次数<input class="equip-auto-manual-attach-count" type="number" min="1" max="5000" value="${state.count}"><span>次</span></label>
            <button class="btn equip-auto-manual-attach-button" type="button" data-manual-attach-action="simulate">模拟芒晶洗练</button>
        </div>
        <p class="equip-auto-manual-attach-hint">沿用首次打造材料「${escapeAiHtml(candidate.craftSpecialName)}」的属性池；仅供查看，不推进游戏内的芒晶洗练进度。</p>
        ${state.error ? `<div class="ai-result-error">${escapeAiHtml(state.error)}</div>` : result}
    </div>`;
}

function equipAutoCandidateCostHtml(candidate) {
    const cost = candidate.craftCost || {};
    const specialId = candidate.craftSpecialId != null ? String(candidate.craftSpecialId) : '';
    const parts = (cost.materials || []).filter(item => Number(item.amount) > 0
        && !(specialId && String(item.id) === specialId)).map(item => {
        const isPaper = Number(item.id) === Number(candidate.paperId)
            || String(item.name || '') === String(candidate.paperName || '');
        return isPaper ? '图纸×1' : `${escapeAiHtml(item.name)}×${Number(item.amount).toLocaleString()}`;
    });
    if (cost.mainMaterial && cost.mainAmount) parts.push(`${escapeAiHtml(cost.mainMaterial.name)}×${Number(cost.mainAmount).toLocaleString()}`);
    if (cost.lianjin) parts.push(`连金泥×${Number(cost.lianjin).toLocaleString()}`);
    if (cost.silver) parts.push(`银两${equipAutoFormatSilver(cost.silver)}`);
    const items = parts.length ? parts.map(part => `<span>${part}</span>`).join('') : '<span>无</span>';
    return `<div class="equip-auto-cost-items">${items}</div>`;
}

const EQUIP_AUTO_RATING_LEVELS = Object.freeze([
    { min: 96, key: 'red', label: '神器' },
    { min: 91, key: 'gold', label: '极品' },
    { min: 81, key: 'purple', label: '极佳' },
    { min: 71, key: 'blue', label: '优秀' },
    { min: 51, key: 'green', label: '良好' },
    { min: 0, key: 'white', label: '劣质' },
]);
const EQUIP_AUTO_REFINEMENT_THEORETICAL_MAX_MULTIPLIER = 1.25;
const EQUIP_AUTO_REFINEMENT_SLOT_MULTIPLIERS = Object.freeze([1, 0.75, 0.5]);

function equipAutoRefinementTotal(refinement) {
    const slotValues = [1, 2, 3].map(slot => Number(refinement && refinement.maxima && refinement.maxima[slot] && refinement.maxima[slot].value))
        .filter(Number.isFinite);
    if (slotValues.length) return slotValues.reduce((sum, value) => sum + value, 0);
    return Math.max(0, Number(refinement && refinement.total) || 0);
}

function equipAutoTheoreticalSlotMaximum(candidate, prop, slot = 1) {
    const config = typeof EQUIP_DATA !== 'undefined'
        ? EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(candidate && candidate.equipId)]
        : null;
    const extConfig = config && config.exts && config.exts[prop];
    if (typeof EquipmentAutoOptimizer !== 'undefined'
        && typeof EquipmentAutoOptimizer.theoreticalRefinementSlotMaximum === 'function') {
        return EquipmentAutoOptimizer.theoreticalRefinementSlotMaximum(config, prop, slot);
    }
    const baseValue = Number(Array.isArray(extConfig) ? extConfig[0] : NaN);
    const slotMultiplier = EQUIP_AUTO_REFINEMENT_SLOT_MULTIPLIERS[Math.trunc(Number(slot)) - 1];
    if (!Number.isFinite(baseValue) || baseValue <= 0 || !slotMultiplier) return 0;
    const maximum = baseValue * EQUIP_AUTO_REFINEMENT_THEORETICAL_MAX_MULTIPLIER * slotMultiplier;
    return baseValue >= 1 ? Math.floor(maximum) : maximum;
}

function equipAutoRatingReference(candidate) {
    const reference = {};
    const embedded = candidate && candidate.refinementRatingReference;
    (candidate && candidate.refinements || []).forEach(refinement => {
        const prop = String(refinement.prop || '');
        if (!prop) return;
        const candidateMaximum = Number(embedded && embedded[prop]);
        reference[prop] = Number.isFinite(candidateMaximum) && candidateMaximum > 0
            ? candidateMaximum
            : EQUIP_AUTO_REFINEMENT_SLOT_MULTIPLIERS.reduce((sum, _, index) => (
                sum + equipAutoTheoreticalSlotMaximum(candidate, prop, index + 1)
            ), 0);
    });
    return reference;
}

function equipAutoRatingForPercent(percent) {
    const normalizedPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    const roundedPercent = Math.round(normalizedPercent);
    const level = EQUIP_AUTO_RATING_LEVELS.find(item => roundedPercent >= item.min) || EQUIP_AUTO_RATING_LEVELS[EQUIP_AUTO_RATING_LEVELS.length - 1];
    return { ...level, percent: normalizedPercent, roundedPercent };
}

function equipAutoRefinementRating(candidate, refinement, reference = equipAutoRatingReference(candidate)) {
    const maximum = Number(reference && reference[refinement && refinement.prop]) || 0;
    const percent = maximum > 0 ? equipAutoRefinementTotal(refinement) / maximum * 100 : 0;
    return equipAutoRatingForPercent(percent);
}

function equipAutoVisibleRefinements(candidate) {
    const all = (candidate && candidate.refinements || []);    if (!candidate || !candidate.allRefinements) return all;
    if (equipAutoComboActive) return [];
    return all.filter(refinement => (!equipAutoResultPropFilter || refinement.prop === equipAutoResultPropFilter) && Number(refinement.total) > 0);
}

function equipAutoCandidateRating(candidate, reference = equipAutoRatingReference(candidate)) {
    const combo = candidate && candidate.allRefinements && equipAutoComboActive && equipAutoComboPlans.get(String(candidate.id));
    if (combo) {
        const slots = combo.slots.filter(Boolean);
        const ratios = slots.map(item => { const max = equipAutoTheoreticalSlotMaximum(candidate, item.prop, item.slot); return max > 0 ? Math.min(100, item.value / max * 100) : 0; });
        return equipAutoRatingForPercent(ratios.length ? ratios.reduce((a,b) => a+b, 0) / ratios.length : 0);
    }
    const ratings = equipAutoVisibleRefinements(candidate).map(refinement => equipAutoRefinementRating(candidate, refinement, reference));
    return equipAutoRatingForPercent(ratings.length ? Math.max(...ratings.map(item => item.percent)) : 0);
}

function equipAutoDisplayedRefinementValue(refinement) {
    const total = equipAutoRefinementTotal(refinement);
    const slotValues = [1, 2, 3]
        .map(slot => Number(refinement && refinement.maxima && refinement.maxima[slot] && refinement.maxima[slot].value))
        .filter(Number.isFinite);
    if (!equipAutoUsesPercentFormat(refinement && refinement.prop, total)) {
        return slotValues.length
            ? slotValues.reduce((sum, value) => sum + equipAutoTruncateDecimal(value), 0)
            : equipAutoTruncateDecimal(total);
    }
    const displayedPoints = slotValues.length
        ? slotValues.reduce((sum, value) => sum + equipAutoPercentagePoints(value), 0)
        : equipAutoPercentagePoints(total);
    return displayedPoints / 100;
}

function equipAutoCandidateTotalProps(candidate, slotPlan) {
    const totals = new Map();
    const add = (prop, value, kind) => {
        const key = String(prop || '');
        const number = Number(value);
        if (!key || !Number.isFinite(number)) return;
        const displayedValue = equipAutoUsesPercentFormat(key, number)
            ? equipAutoPercentagePoints(number) / 100
            : equipAutoTruncateDecimal(number);
        const entry = totals.get(key) || { value: 0, kind: 'craft' };
        entry.value += displayedValue;
        const rank = { craft: 0, mang: 1, region: 2 };
        if ((rank[kind] || 0) > (rank[entry.kind] || 0)) entry.kind = kind;
        totals.set(key, entry);
    };
    if (slotPlan && slotPlan.some(Boolean)) {
        slotPlan.filter(Boolean).forEach(item => add(item.prop, item.value, 'craft'));
    } else {
        (candidate && candidate.allRefinements && !equipAutoResultPropFilter ? [] : equipAutoVisibleRefinements(candidate)).forEach(refinement => {
            add(refinement && refinement.prop, equipAutoDisplayedRefinementValue(refinement), 'craft');
        });
    }
    // 主属性取「芒晶 N 次」里的最高附加，而不是第 1 次
    const attachScan = typeof equipAutoAttachScanSummary === 'function' ? equipAutoAttachScanSummary(candidate) : null;
    if (attachScan && attachScan.best) {
        add(attachScan.best.prop, attachScan.best.value, 'mang');
    } else {
        (candidate && candidate.special || []).forEach(item => add(item && item.prop, item && item.value, 'mang'));
    }
    (candidate && candidate.region || []).forEach(item => add(item && item.prop, item && item.value, 'region'));
    return Array.from(totals, ([prop, entry]) => ({ prop, value: entry.value, kind: entry.kind }));
}

let equipAutoAttachScanCache = new Map();

let equipAutoAttachScanOverride = 0;
function equipAutoAttachScanCount() {
    if (equipAutoAttachScanOverride > 0) return equipAutoAttachScanOverride;
    const element = document.getElementById("autoEquipAttachScan");
    const value = Number(element && element.value);
    return Number.isFinite(value) && value > 0 ? Math.min(5000, Math.trunc(value)) : 100;
}

/* 用户在第 04 步选的芒晶等级：before=升炼前(90)，after=升炼后(100) */
function equipAutoAttachStage() {
    const element = document.getElementById("autoEquipAttachLevel");
    return element && element.value === "after" ? "after" : "before";
}

function equipAutoAttachScanSummary(candidate) {
    if (!candidate || !candidate.canSimulateSpecialAttach || !candidate.specialAttachEquips || !candidate.craftSpecialId) return null;
    if (typeof EquipmentAutoOptimizer === "undefined" || typeof EQUIP_DATA === "undefined") return null;
    const material = EQUIP_DATA.special[String(candidate.craftSpecialId)];
    const stage = equipAutoAttachStage();
    const context = candidate.specialAttachEquips[stage] || candidate.specialAttachEquips.before;
    if (!material || !context) return null;
    const count = equipAutoAttachScanCount();
    const key = String(candidate.id) + "|" + candidate.craftSpecialId + "|" + count + "|" + stage;
    if (equipAutoAttachScanCache.has(key)) return equipAutoAttachScanCache.get(key);
    let summary = null;
    try {
        const result = EquipmentAutoOptimizer.predictSpecialAttachSequence(context, material, count);
        let best = null;
        result.items.forEach(item => { if (!best || Number(item.value) > Number(best.value)) best = item; });
        summary = best
            ? {
                count,
                stage,
                level: Number(context.need_lv) || null,
                materialName: material.name || String(material.id),
                best, maxima: result.maxima, items: result.items
            }
            : null;
    } catch (error) {
        summary = null;
    }
    equipAutoAttachScanCache.set(key, summary);
    return summary;
}

function equipAutoAttachQualityKey(candidate, prop, value) {
    try {
        const reference = equipAutoRatingReference(candidate);
        const pseudo = { prop: prop, total: Number(value) || 0, maxima: { 1: { value: Number(value) || 0 } }, plan: null };
        const result = equipAutoRefinementRating(candidate, pseudo, reference);
        return result && result.key ? result.key : 'white';
    } catch (error) {
        return 'white';
    }
}

function equipAutoAttachScanChipHtml(candidate) {
    const scan = equipAutoAttachScanSummary(candidate);
    if (!scan) return "";
    const bestText = equipAutoFormatProps([{ prop: scan.best.prop, value: scan.best.value }]);
    const roundText = scan.best && scan.best.index != null ? ("第" + scan.best.index + "次") : "";
    return "<span class=\"equip-auto-chip is-scan\" title=\"芒晶前 " + scan.count + " 次（" + escapeAiHtml(scan.materialName) + "）中的最高附加" + (roundText ? "，出现在" + roundText : "") + "\"><span>芒晶" + (roundText || "附加") + "</span><strong>" + bestText + "</strong></span>";
}

function equipAutoAttachScanDetailHtml(candidate) {
    const scan = equipAutoAttachScanSummary(candidate);
    if (!scan) return "";
    const rows = scan.maxima.filter(item => item.recommendedIndex != null).map(item => {
        return "<div class=\"equip-auto-attach-scan-row\"><span>" + escapeAiHtml(equipAutoPropertyLabel(item.prop)) + "</span><strong>+" + escapeAiHtml(equipAutoFormatPropValue(item.prop, item.value)) + "（第" + item.recommendedIndex + "次）</strong></div>";
    }).join("");
    return "<div class=\"equip-auto-detail-card equip-auto-attach-scan-card\"><strong>芒晶前 " + scan.count + " 次最高</strong>" + (rows || "无") + "</div>";
}

function equipAutoAddCost(map, id, name, amount) {
    const key = String(id != null && id !== "" ? id : name || "");
    const value = Number(amount) || 0;
    if (!key || value <= 0) return;
    const current = map.get(key) || { id: key, name: String(name || key), amount: 0 };
    current.amount += value;
    map.set(key, current);
}

function equipAutoMergeCost(map, cost) {
    if (!cost) return;
    (cost.materials || []).forEach(item => equipAutoAddCost(map, item.id, item.name || item.id, item.amount));
    if (cost.mainMaterial && cost.mainAmount) equipAutoAddCost(map, cost.mainMaterial.id, cost.mainMaterial.name || cost.mainMaterial.id, cost.mainAmount);
    if (Number(cost.lianjin) > 0) equipAutoAddCost(map, 8801, "连金泥", cost.lianjin);
}

/* 首次打造的附加材料（龙骨之类）不计入消耗统计：游戏里它是“每件只投一次”的选材，
   批量模拟里按次数累乘会失真，用户也不看这项。 */
function equipAutoCandidateCostParts(candidate) {
    const craftMap = new Map();
    equipAutoMergeCost(craftMap, candidate && candidate.craftCost);
    const paperName = String(candidate && candidate.paperName || "");
    const paperId = candidate && candidate.paperId != null ? String(candidate.paperId) : "";
    const specialId = candidate && candidate.craftSpecialId != null ? String(candidate.craftSpecialId) : "";
    const specialName = String(candidate && candidate.craftSpecialName || "");
    const keep = item => !((specialId && String(item.id) === specialId)
        || (specialName && String(item.name) === specialName));
    const craftList = Array.from(craftMap.values()).filter(keep);
    const totalMap = new Map(Array.from(craftMap, ([key, item]) => [key, { ...item }]));
    equipAutoMergeCost(totalMap, candidate && candidate.upgradeCost);
    const combo = candidate && candidate.allRefinements && equipAutoComboActive && equipAutoComboPlans.get(String(candidate.id));
    if (combo) equipAutoMergeCost(totalMap, combo.cost);
    (candidate && candidate.allRefinements && !equipAutoResultPropFilter ? [] : equipAutoVisibleRefinements(candidate)).forEach(refinement => {
        equipAutoMergeCost(totalMap, refinement && refinement.plan && refinement.plan.cost);
    });
    const totalList = Array.from(totalMap.values()).filter(keep);
    const craftSilver = Number(candidate && candidate.craftCost && candidate.craftCost.silver) || 0;
    let totalSilver = craftSilver;
    if (candidate && candidate.upgradeCost) totalSilver += Number(candidate.upgradeCost.silver) || 0;
    if (combo) totalSilver += Number(combo.cost && combo.cost.silver) || 0;
    (candidate && candidate.allRefinements && !equipAutoResultPropFilter ? [] : equipAutoVisibleRefinements(candidate)).forEach(refinement => {
        const cost = refinement && refinement.plan && refinement.plan.cost;
        if (cost) totalSilver += Number(cost.silver) || 0;
    });
    return { craftList, craftSilver, totalList, totalSilver, paperName, paperId };
}

function equipAutoCostText(parts) {
    if (!parts || !parts.length) return "—";
    const chunks = parts.map(item => {
        const isPaper = (parts.paperId && String(item.id) === String(parts.paperId))
            || (parts.paperName && String(item.name) === String(parts.paperName));
        return isPaper ? "图纸×1" : escapeAiHtml(item.name) + "×" + Number(item.amount).toLocaleString();
    });
    return chunks.join("、");
}

function equipAutoCandidateCostLinesHtml(candidate) {
    const parts = equipAutoCandidateCostParts(candidate);
    parts.craftList.paperId = parts.paperId;
    parts.craftList.paperName = parts.paperName;
    parts.totalList.paperId = parts.paperId;
    parts.totalList.paperName = parts.paperName;
    const craftText = equipAutoCostText(parts.craftList) + (parts.craftSilver > 0 ? "、银两" + equipAutoFormatSilver(parts.craftSilver) : "");
    const isPaperItem = item => (parts.paperId && String(item.id) === String(parts.paperId))
        || (parts.paperName && String(item.name) === String(parts.paperName));
    const totalItems = parts.totalList.filter(item => !isPaperItem(item));
    const totalText = equipAutoCostText(totalItems) + (parts.totalSilver > 0 ? "、银两" + equipAutoFormatSilver(parts.totalSilver) : "");
    const label = candidate && candidate.allRefinements && !equipAutoResultPropFilter && !equipAutoComboActive ? '基础消耗' : '方案消耗';
    const title = candidate && candidate.allRefinements && !equipAutoResultPropFilter && !equipAutoComboActive ? '打造与升炼消耗；选择精炼属性后显示对应方案消耗' : '打造、升炼与所选精炼方案的消耗';
    return '<span class="equip-auto-candidate-line equip-auto-cost-line" title="' + title + '"><span class="equip-auto-cost-tag is-total">' + label + '</span><span>' + totalText + '</span></span>';
}

const EQUIP_AUTO_FAV_STORAGE = 'yyjh_auto_favs_v1';
let equipAutoFavorites = [];

function equipAutoLoadFavorites() {
    /* 和「藏兵阁」共用同一份存储（shared/fav_store.js），两边读写完全一致 */
    if (typeof FavoriteStore !== 'undefined') {
        equipAutoFavorites = FavoriteStore.list();
        return;
    }
    try {
        const raw = localStorage.getItem(EQUIP_AUTO_FAV_STORAGE);
        const list = raw ? JSON.parse(raw) : [];
        equipAutoFavorites = Array.isArray(list) ? list.filter(item => item && item.id != null) : [];
    } catch (error) {
        equipAutoFavorites = [];
    }
}

function equipAutoSaveFavorites() {
    if (typeof FavoriteStore !== 'undefined') {
        FavoriteStore.save(equipAutoFavorites);
        return;
    }
    try {
        localStorage.setItem(EQUIP_AUTO_FAV_STORAGE, JSON.stringify(equipAutoFavorites));
    } catch (error) { }
}

function equipAutoFindFavorite(candidateId) {
    return equipAutoFavorites.find(item => String(item.id) === String(candidateId)) || null;
}

/* 收藏前问一下要缓存多少详情：精炼条数 / 淬炼次数。
   看其他NPC附加值不占用户决定，收藏时后台直接算好。 */
function equipAutoAskCacheOptions() {
    return new Promise(function (resolve) {
        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-confirm';
        wrap.innerHTML = '<div class="equip-auto-confirm-card equip-auto-fav-options" role="dialog" aria-modal="true">'
            + '<h3 class="equip-auto-fav-title">收藏到云盘</h3>'
            + '<p class="equip-auto-fav-tip">收藏时会把详情一起存下来，之后换设备、换存档打开都能直接看。</p>'
            + '<label class="equip-auto-fav-field"><span>精炼数据</span>'
            + '<input type="number" id="favRefineRows" min="0" max="2000" step="50" value="500"><i>条</i></label>'
            + '<label class="equip-auto-fav-field"><span>淬炼数据</span>'
            + '<input type="number" id="favForgeCount" min="0" max="2000" step="50" value="300"><i>次</i></label>'
            + '<label class="equip-auto-fav-field"><span>芒晶洗练</span>'
            + '<input type="number" id="favMangCount" min="0" max="5000" step="50" value="500"><i>次</i></label>'
            + '<p class="equip-auto-fav-tip">数字越大，收藏时算得越久、占的地方也越多。其他NPC附加值会自动算好。</p>'
            + '<div class="equip-auto-confirm-actions">'
            + '<button type="button" class="equip-auto-confirm-cancel">取消</button>'
            + '<button type="button" class="equip-auto-confirm-ok">开始收藏</button>'
            + '</div></div>';
        document.body.appendChild(wrap);

        var refineInput = wrap.querySelector('#favRefineRows');
        var forgeInput = wrap.querySelector('#favForgeCount');
        var mangInput = wrap.querySelector('#favMangCount');
        var done = function (value) {
            document.removeEventListener('keydown', onKey);
            wrap.remove();
            resolve(value);
        };
        var onKey = function (e) { if (e.key === 'Escape') done(null); };
        wrap.querySelector('.equip-auto-confirm-cancel').addEventListener('click', function () { done(null); });
        wrap.querySelector('.equip-auto-confirm-ok').addEventListener('click', function () {
            var clamp = function (input, fallback, max) {
                var n = Number.parseInt(input && input.value, 10);
                if (!Number.isFinite(n)) n = fallback;
                return Math.max(0, Math.min(max || 2000, n));
            };
            done({
                refineRows: clamp(refineInput, 500),
                forgeCount: clamp(forgeInput, 300),
                mangCount: clamp(mangInput, 500, 5000)
            });
        });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) done(null); });
        document.addEventListener('keydown', onKey);
        if (refineInput) refineInput.focus();
    });
}

/* 计算期间的提示，避免用户以为卡住了 */
function equipAutoBusy(text) {
    var wrap = document.createElement('div');
    wrap.className = 'equip-auto-confirm';
    wrap.innerHTML = '<div class="equip-auto-confirm-card equip-auto-fav-busy" role="status" aria-live="polite">'
        + '<p class="equip-auto-fav-title">' + escapeAiHtml(text) + '</p>'
        + '<p class="equip-auto-fav-tip">条数多的话要几秒，请先别关页面。</p></div>';
    document.body.appendChild(wrap);
    return { close: function () { wrap.remove(); } };
}

function equipAutoSyncFavoriteButton(id) {
    document.querySelectorAll('[data-fav-id="' + String(id) + '"]').forEach(button => {
        const on = !!equipAutoFindFavorite(id);
        button.classList.toggle('is-on', on);
        button.textContent = on ? '★ 已收藏' : '☆ 收藏';
        button.title = on ? '取消本机收藏标记，云盘副本保留' : '收藏到云盘';
    });
}

var equipAutoCloudSaving = new Set();
function equipAutoAddFavorite(candidate, opts) {
    const id = String(candidate.id);
    if(equipAutoCloudSaving.has(id))return;
    equipAutoCloudSaving.add(id);
    const snapshot = JSON.parse(JSON.stringify(candidate));
    try {
        const equip = EQUIP_DATA && EQUIP_DATA.equipment ? EQUIP_DATA.equipment[String(candidate.equipId)] : null;
        snapshot.equipType = equip && EQUIP_DATA.typeNames ? (EQUIP_DATA.typeNames[String(equip.type)] || '') : '';
        /* 数值类型（1～9）存进来，藏兵阁排序才能和第六步完全一致 */
        snapshot.equipTypeKey = equipAutoFavoriteTypeKey(candidate);
    } catch (error) { }
    /* 来源标签：角色 / 服务器 / 存档版本 / 收藏时间，写死在这条收藏里，
       以后不管加载哪份存档，标签都不会跟着变 */
    try {
        var sharedStore = (typeof loadShareStore === 'function') ? loadShareStore() : null;
        var sm = (sharedStore && sharedStore.meta) || {};
        var roleName = '';
        try {
            if (sharedStore && sharedStore.data && typeof getArchiveMainRoleName === 'function') {
                roleName = getArchiveMainRoleName(sharedStore.data);
                if (roleName === '—') roleName = '';
            }
        } catch (error) { }
        /* 存档时点：和「江湖过往」页一致，取存档正文的 UploadTime（秒），转毫秒 */
        var saveAtMs = 0;
        try {
            var sd = (typeof state !== 'undefined' && state.saveData) || null;
            var upRaw = sd ? Number(sd.UploadTime != null ? sd.UploadTime : (sd.save && sd.save.UploadTime)) : NaN;
            if (Number.isFinite(upRaw) && upRaw > 1e9) saveAtMs = upRaw < 1e12 ? upRaw * 1000 : upRaw;
        } catch (error) { }
        snapshot.origin = {
            saveAt: saveAtMs || 0,
            role: roleName || sm.role || '',
            server: sm.server || (state && state.saveData && state.saveData.ServerID != null ? String(state.saveData.ServerID) : '') || '',
            platform: sm.platform || '',
            channel: sm.channel || '',
            version: sm.version || (typeof state !== 'undefined' && state.saveVersion) || '',
            importedAt: sm.importedAt || null,
            favoritedAt: Date.now(),
            sourceFile: sm.fileName || '',
        };
    } catch (error) { }

    var busy = equipAutoBusy('正在计算收藏数据…');
    var mangCount = Number(opts && opts.mangCount);
    window.setTimeout(async function () {
        var previousOverride = equipAutoAttachScanOverride;
        try {
            /* 芒晶洗练：按用户填的次数扫一遍（同时让卡片上的「芒晶第 N 次」也跟着这个次数走） */
            if (Number.isFinite(mangCount) && mangCount > 0) equipAutoAttachScanOverride = Math.min(5000, Math.round(mangCount));
            /* 卡片在这一步重渲染：上面的「芒晶前 N 次最高」要跟用户填的次数一致 */
            try { snapshot.html = equipAutoCandidateHtml(candidate, { forge: true, refine: true }); } catch (error) { }
            var views = {};
            try {
                if (typeof EquipCardViews !== 'undefined' && EquipCardViews.capture) {
                    views = EquipCardViews.capture(candidate, opts || {}) || {};
                    const combo = equipAutoComboActive && equipAutoComboPlans.get(String(candidate.id));
                    if (combo && Number(opts?.refineRows) !== 0) views.refine = equipAutoComboRefineView(candidate, combo);
                }
            } catch (error) { }
            try {
                if (Number.isFinite(mangCount) && mangCount > 0 && typeof equipAutoAttachScanSummary === 'function') {
                    var mang = equipAutoAttachScanSummary(candidate);
                    if (mang) views.mang = mang;
                } else if (Number.isFinite(mangCount) && mangCount <= 0) {
                    /* 用户明确选了 0：记一笔，之后不要被「补算老收藏」的逻辑补上 */
                    views.mangSkipped = true;
                }
            } catch (error) { }
            snapshot.views = views;
        } catch (error) {
        } finally {
            equipAutoAttachScanOverride = previousOverride;
        }
        if (busy) busy.close();
        try {
            await SBJCloud.put('equipment',snapshot,snapshot.equipName||snapshot.name||'收藏装备');
            equipAutoFavorites.unshift(snapshot);
            equipAutoSaveFavorites();renderEquipAutoFavorites();equipAutoSyncFavoriteButton(id);
        } catch(error) { if(!error.cancelled)SBJCloud.alert(error.message); }
        finally { candidate.cloudKey=snapshot.cloudKey;equipAutoCloudSaving.delete(id); }
    }, 40);
}

/* 开发自测用：把当前模拟结果里的「碎月重刀」自动收藏一件，方便验证收藏/藏兵阁的改动。
   只在本地调试会用到；找不到结果就返回原因，不弹窗。 */
window.equipAutoSeedTestFavorite = function (options) {
    var opts = options || {};
    var list = (equipAutoLastResult && equipAutoLastResult.candidates) || [];
    if (!list.length) return { ok: false, reason: '还没有模拟结果，先在第五步跑一次' };
    var wanted = String(opts.name || '碎月重刀');
    var hit = list.filter(function (item) {
        return String(item && (item.equipName || '')).indexOf(wanted) >= 0;
    })[0] || list[0];
    if (!hit) return { ok: false, reason: '没有可收藏的候选' };
    /* 注意：0 是有效值（表示这次不缓存），不能写成 Number(x) || 默认值 */
    var pick = function (value, fallback) {
        var n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };
    equipAutoAddFavorite(hit, {
        refineRows: pick(opts.refineRows, 200),
        forgeCount: pick(opts.forgeCount, 100),
        mangCount: pick(opts.mangCount, 200),
    });
    return { ok: true, name: hit.equipName || '', id: hit.id };
};

function equipAutoToggleFavorite(candidateId) {
    const id = String(candidateId);
    const index = equipAutoFavorites.findIndex(item => String(item.id) === id);
    if (index >= 0) {
        equipAutoFavorites.splice(index, 1);
        equipAutoSaveFavorites();
        renderEquipAutoFavorites();
        equipAutoSyncFavoriteButton(id);
        return;
    }
    const candidate = (equipAutoLastResult && equipAutoLastResult.candidates || []).find(item => String(item.id) === id)
        || (equipAutoFavorites || []).find(item => String(item.id) === id);
    if (!candidate) return;
    equipAutoAskCacheOptions().then(function (opts) {
        if (!opts) return;
        equipAutoAddFavorite(candidate, opts);
    });
}

function equipAutoFavoriteTypeKey(candidate) {
    try {
        const equip = EQUIP_DATA.equipment[String(candidate && candidate.equipId)];
        return equip && equip.type != null ? Number(equip.type) : 99;
    } catch (error) { return 99; }
}

function equipAutoFavoriteTypeName(candidate) {
    try {
        const key = equipAutoFavoriteTypeKey(candidate);
        return (EQUIP_DATA.typeNames && EQUIP_DATA.typeNames[String(key)]) || '';
    } catch (error) { return ''; }
}

function renderEquipAutoFavorites() {
    const container = document.getElementById('autoEquipFavorites');
    const count = document.getElementById('autoEquipFavoriteCount');
    if (count) count.textContent = equipAutoFavorites.length + ' 件';
    if (!container || container.closest('[hidden]')) return;
    if (!equipAutoFavorites.length) {
        container.innerHTML = '<p class="ai-result-empty">在结果里点 ☆ 收藏，装备会出现在这里。</p>';
        return;
    }
    /* 同类型装备排在一起：先按装备类型，再按打造次数 */
    const sorted = equipAutoFavorites.slice().sort((a, b) =>
        (equipAutoFavoriteTypeKey(a) - equipAutoFavoriteTypeKey(b))
        || (Number(a.craftIndex) - Number(b.craftIndex))
        || String(a.location || '').localeCompare(String(b.location || ''), 'zh'));
    /* 老收藏升级：早期存下来的 html 没带「精炼数据 / 看淬炼」按钮，也没有详情数据，
       这里补渲染一次（纯数据渲染，不跑算法以外的重活）；补完存回去。 */
    let upgraded = false;
    equipAutoFavorites.forEach(item => {
        try {
            if (typeof item.html !== 'string' || item.html.indexOf('data-refine-id') < 0
                || item.html.indexOf('data-card-v="4"') < 0) {
                item.html = equipAutoCandidateHtml(item, { forge: true, refine: true });
                upgraded = true;
            }
            /* 老收藏没有芒晶结果：补算一次（默认 500 次） */
            if (item.views && !item.views.mang && !item.views.mangSkipped && typeof equipAutoAttachScanSummary === 'function') {
                try {
                    var prevOverride = equipAutoAttachScanOverride;
                    equipAutoAttachScanOverride = 500;
                    var mangData = equipAutoAttachScanSummary(item);
                    equipAutoAttachScanOverride = prevOverride;
                    if (mangData) { item.views.mang = mangData; upgraded = true; }
                } catch (error) { equipAutoAttachScanOverride = 0; }
            }
            /* 老收藏只在「完全没有详情」时补算一次，按默认条数；
               已经有详情的绝不重算——用户填多少就保留多少，不能悄悄改成别的数 */
            if (!item.views && typeof EquipCardViews !== 'undefined' && EquipCardViews.capture) {
                item.views = EquipCardViews.capture(item, { refineRows: 500, forgeCount: 300 });
                upgraded = true;
            } else if (item.views && item.views.forge && !item.views.forge.items
                && typeof EquipCardViews !== 'undefined' && EquipCardViews.captureForgeOnly) {
                /* 早期只存了面板 HTML：补一次数据，藏兵阁才能改长度重算 */
                try {
                    var wantN = Math.min(500, Number(item.views.forge.n) || 300);
                    var refilled = EquipCardViews.captureForgeOnly(item, wantN);
                    if (refilled && refilled.items && refilled.items.length) {
                        item.views.forge = refilled;
                        upgraded = true;
                    }
                } catch (error) { }
            }
            /* 老收藏已经有来源、只缺渠道：只有版本/角色/导入时间全都对得上，
               才认为就是同一份存档，补上 platform / channel */
            try {
                if (item.origin && (!item.origin.platform || !item.origin.server || !item.origin.channel || !item.origin.saveAt)) {
                    var cur = (typeof loadShareStore === 'function' ? loadShareStore() : null) || null;
                    var cm = (cur && cur.meta) || {};
                    var sameVersion = String(cm.version || '') === String(item.origin.version || '');
                    var sameImport = String(cm.importedAt || '') === String(item.origin.importedAt || '');
                    if (sameVersion && (sameImport || !item.origin.importedAt)) {
                        item.origin.platform = item.origin.platform || cm.platform || '';
                        item.origin.channel = item.origin.channel || cm.channel || '';
                        if (!item.origin.saveAt) {
                            try {
                                var sd = (typeof state !== 'undefined' && state.saveData) || null;
                                var upv = sd && Number(sd.UploadTime);
                                if (Number.isFinite(upv) && upv > 1e9) {
                                    item.origin.saveAt = upv < 1e12 ? upv * 1000 : upv;
                                    upgraded = true;
                                }
                            } catch (error) { }
                        }
                        if (!item.origin.server) {
                            var sid = (typeof state !== 'undefined' && state.saveData && state.saveData.ServerID != null)
                                ? String(state.saveData.ServerID) : '';
                            item.origin.server = cm.server || sid || '';
                        }
                        upgraded = true;
                    }
                }
            } catch (error) { }
        } catch (error) { }
    });
    if (upgraded) { try { equipAutoSaveFavorites(); } catch (error) { } }

    const tagOf = candidate => (typeof FavoriteStore !== 'undefined' && FavoriteStore.tagHtml) ? FavoriteStore.tagHtml(candidate) : '';
    container.innerHTML = sorted.map(candidate => '<div class="fav-card-wrap">' + tagOf(candidate) + equipAutoCandidateHtml(candidate, { forge: true, refine: true }) + '</div>').join('');
    bindEquipAutoFavoritesExport();
}

function equipAutoCsvCell(value) {
    const text = String(value == null ? '' : value).replace(/"/g, '""');
    return '"' + text + '"';
}

function exportEquipAutoFavorites() {
    if (!equipAutoFavorites.length) {
        window.alert('收藏列表是空的，先在结果里点 ☆ 收藏。');
        return;
    }
    const rows = [[
        '类型', '装备', '图纸', '打造次数', '地点', '品质',
        '基础属性', '蓝/紫词条', '地区附加', '芒晶前N次最高', '首次附加材料',
        '总属性', '打造消耗', '升炼消耗',
        '精炼（词条最高 / 做到第几次 / 状态回放）', '精炼消耗',
        '总消耗（升炼+精炼）',
    ]];
    equipAutoFavorites.slice().sort((a, b) =>
        (equipAutoFavoriteTypeKey(a) - equipAutoFavoriteTypeKey(b))
        || (Number(a.craftIndex) - Number(b.craftIndex))).forEach(candidate => {
        const slotPlan = equipAutoSlotPlan(candidate);
        const totalProps = equipAutoCandidateTotalProps(candidate, Array.isArray(slotPlan) ? slotPlan : null)
            .map(item => equipAutoPropertyLabel(item.prop) + '+' + equipAutoFormatPropValue(item.prop, item.value))
            .join('、');
        const scan = typeof equipAutoAttachScanSummary === 'function' ? equipAutoAttachScanSummary(candidate) : null;
        const scanText = scan && scan.best
            ? (equipAutoPropertyLabel(scan.best.prop) + '+' + equipAutoFormatPropValue(scan.best.prop, scan.best.value) + '（第' + scan.best.index + '次）')
            : '';
        const refineText = (candidate.refinements || []).map(refinement => {
            const label = equipAutoPropertyLabel(refinement.prop);
            const slots = [1, 2, 3].map(slot => {
                const maximum = refinement.maxima && refinement.maxima[slot];
                if (!maximum) return '词条' + slot + ' 无';
                const indexes = (maximum.occurrences || []).map(item => item.source === 'original' ? '原有' : '#' + item.index).join('/');
                return '词条' + slot + ' ' + equipAutoFormatPropValue(refinement.prop, maximum.value) + '（' + indexes + '）';
            }).join('；');
            const cutoff = refinement.plan ? ('做到第 ' + refinement.plan.cutoff + ' 次') : '未达成';
            const replay = refinement.plan && refinement.plan.accepts
                ? refinement.plan.accepts.map(item => '#' + item.index + '（词条' + item.slot + '）').join(' → ')
                : '';
            return label + '：' + slots + '；' + cutoff + (replay ? '；回放 ' + replay : '');
        }).join('\n');
        const refineCost = mergeEquipAutoCosts(...(candidate.refinements || []).map(item => item.plan && item.plan.cost));
        const totalCost = mergeEquipAutoCosts(candidate.craftCost, candidate.upgradeCost, refineCost);
        rows.push([
            equipAutoFavoriteTypeName(candidate),
            candidate.equipName || String(candidate.paperName || '').replace(/图样$/, ''),
            String(candidate.paperName || '').replace(/图样$/, ''),
            candidate.craftIndex,
            candidate.location || '',
            Number(candidate.color) === 3 ? '蓝色' : '紫色',
            equipAutoFormatBase(candidate.base),
            equipAutoFormatProps(candidate.exts),
            equipAutoFormatProps(candidate.region),
            scanText,
            candidate.craftSpecialName ? (candidate.craftSpecialName + ' ' + equipAutoFormatProps(candidate.special)) : '无',
            totalProps,
            equipAutoFormatCost(candidate.craftCost),
            candidate.upgradeCost ? equipAutoFormatCost(candidate.upgradeCost) : '无',
            refineText,
            equipAutoFormatCost(refineCost),
            equipAutoFormatCost(totalCost),
        ]);
    });
    const csv = rows.map(row => row.map(equipAutoCsvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '算不尽-收藏列表-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function bindEquipAutoFavoritesExport() {
    const button = document.getElementById('btnExportFavorites');
    if (button && button.dataset.bound !== '1') {
        button.dataset.bound = '1';
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            exportEquipAutoFavorites();
        });
    }
    bindEquipAutoFavoritesBackup();
}

/* 收藏备份 / 恢复
   localStorage 跟着域名走：换个链接（新隧道、新域名）就是一份空存储，
   或者清一次浏览器数据就没了。这里给一对「整份导出 / 导入合并」的按钮。 */
function equipAutoFavoritesBackupPayload() {
    if (typeof FavoriteStore !== 'undefined') return FavoriteStore.backupJson();
    return JSON.stringify({
        type: 'suanbujin.autoFavorites',
        version: 1,
        savedAt: new Date().toISOString(),
        items: (typeof equipAutoFavorites !== 'undefined' ? equipAutoFavorites : []) || [],
    }, null, 2);
}

function equipAutoFavoritesRestore(text) {
    let payload;
    try { payload = JSON.parse(text); } catch (error) { return { ok: false, error: '不是有效的 JSON 文件' }; }
    if (typeof FavoriteStore !== 'undefined') {
        const merged = FavoriteStore.restoreJson(text);
        if (merged.ok) {
            equipAutoFavorites = FavoriteStore.list();
            renderEquipAutoFavorites();
        }
        return merged;
    }
    const items = Array.isArray(payload) ? payload : (payload && payload.items);
    if (!Array.isArray(items)) return { ok: false, error: '文件里没有收藏数据' };
    const seen = Object.create(null);
    equipAutoFavorites.forEach(item => { seen[String(item.id)] = 1; });
    let added = 0;
    items.forEach(item => {
        if (!item || item.id == null) return;
        const id = String(item.id);
        if (seen[id]) return;
        seen[id] = 1;
        equipAutoFavorites.push(JSON.parse(JSON.stringify(item)));
        added += 1;
    });
    equipAutoSaveFavorites();
    renderEquipAutoFavorites();
    return { ok: true, added, total: equipAutoFavorites.length };
}

function bindEquipAutoFavoritesBackup() {
    const backup = document.getElementById('btnBackupFavorites');
    if (backup && backup.dataset.bound !== '1') {
        backup.dataset.bound = '1';
        backup.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            if (!equipAutoFavorites.length) { window.alert('收藏列表是空的，没有可备份的内容'); return; }
            const blob = new Blob([equipAutoFavoritesBackupPayload()], { type: 'application/json;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = '算不尽-收藏备份-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1500);
        });
    }
    const restore = document.getElementById('btnRestoreFavorites');
    const input = document.getElementById('favoritesRestoreInput');
    if (restore && input && restore.dataset.bound !== '1') {
        restore.dataset.bound = '1';        restore.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            input.value = '';
            input.click();
        });
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = equipAutoFavoritesRestore(String(reader.result || ''));
                if (!result.ok) { window.alert('恢复失败：' + result.error); return; }
                window.alert('恢复完成：新增 ' + result.added + ' 件，现有 ' + result.total + ' 件');
            };
            reader.onerror = () => window.alert('读文件失败');
            reader.readAsText(file);
        });
    }
}

function equipAutoCandidateHtml(candidate, options) {
    const ratingReference = equipAutoRatingReference(candidate);
    const rating = equipAutoCandidateRating(candidate, ratingReference);
    const slotPlanRaw = equipAutoSlotPlan(candidate);
    const slotPlan = Array.isArray(slotPlanRaw) ? slotPlanRaw : null;
    const combo = candidate.allRefinements && equipAutoComboActive ? equipAutoComboPlans.get(String(candidate.id)) : null;
    const visibleRefinements = equipAutoVisibleRefinements(candidate);
    const refinementChips = visibleRefinements.map(refinement => {
        const refinementRating = equipAutoRefinementRating(candidate, refinement, ratingReference);
        return `<span class="equip-auto-chip is-target" title="${escapeAiHtml(equipAutoPropertyLabel(refinement.prop))}品质：${refinementRating.label} ${refinementRating.roundedPercent}%"><span>${escapeAiHtml(equipAutoPropertyLabel(refinement.prop))}</span><strong class="is-${refinementRating.key}">${escapeAiHtml(equipAutoFormatRefinementTotal(refinement))}</strong></span>`;
    }).join('');
    const targetChips = combo ? slotPlan.filter(Boolean).map(item => '<span class="equip-auto-chip is-target"><span>词条' + item.slot + ' ' + escapeAiHtml(equipAutoPropertyLabel(item.prop)) + '</span><strong>' + escapeAiHtml(equipAutoFormatPropValue(item.prop,item.value)) + '</strong></span>').join('') : slotPlan
        ? (equipAutoPropertyMode === 'multi'
            ? (() => {
                const groups = new Map();
                slotPlan.filter(Boolean).forEach(item => {
                    if (!groups.has(item.prop)) groups.set(item.prop, []);
                    groups.get(item.prop).push(item);
                });
                return Array.from(groups, ([prop, items]) => {
                    let key = 'white';
                    try {
                        const refinement = candidate.refinements.find(entry => entry && entry.prop === prop);
                        if (refinement) key = equipAutoRefinementRating(candidate, refinement, equipAutoRatingReference(candidate)).key || 'white';
                    } catch (error) { key = 'white'; }
                    const values = items
                        .slice()
                        .sort((a, b) => a.slot - b.slot)
                        .map(item => equipAutoFormatPropValue(prop, item.value))
                        .join('·');
                    return '<span class="equip-auto-chip is-target" title="' + escapeAiHtml(equipAutoPropertyLabel(prop)) + ' 三个精炼位最大值"><span>' + escapeAiHtml(equipAutoPropertyLabel(prop)) + '</span><strong class="is-' + key + '">' + escapeAiHtml(values) + '</strong></span>';
                }).join('');
            })()
            : slotPlan.filter(Boolean).map(item => {
                let key = 'white';
                try {
                    const refinement = candidate.refinements.find(entry => entry && entry.prop === item.prop);
                    if (refinement) key = equipAutoRefinementRating(candidate, refinement, equipAutoRatingReference(candidate)).key || 'white';
                } catch (error) { key = 'white'; }
                return '<span class="equip-auto-chip is-target" title="词条 ' + item.slot + ' · ' + escapeAiHtml(equipAutoPropertyLabel(item.prop)) + '"><span>词条' + item.slot + ' ' + escapeAiHtml(equipAutoPropertyLabel(item.prop)) + '</span><strong class="is-' + key + '">' + escapeAiHtml(equipAutoFormatPropValue(item.prop, item.value)) + '</strong></span>';
            }).join(''))
        : refinementChips;
    const locationChip = candidate.location ? `<span class="equip-auto-chip is-loc">${escapeAiHtml(candidate.location)}</span>` : '';
    const regionChip = candidate.region.length
        ? `<span class="equip-auto-chip is-region" title="地区附加"><span>地区</span><strong>${equipAutoFormatProps(candidate.region)}</strong></span>`
        : '';
    const paperMeta = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.papers) ? EQUIP_DATA.papers[String(candidate.paperId)] : null;
    const paperMaterialId = paperMeta ? paperMeta.dz_mat : null;
    const paperMaterialName = paperMaterialId && EQUIP_DATA.itemNames ? String(EQUIP_DATA.itemNames[String(paperMaterialId)] || '') : '';
    const paperTone = (Number(candidate.color) === 3 ? ' is-blue' : '')
        + (/紫金/.test(paperMaterialName) ? ' is-zijin' : (/乌缕/.test(paperMaterialName) ? ' is-wulv' : ''));
    const paperLabel = String(candidate.paperName || '').replace(/图样$/, '');
    const totalProps = equipAutoCandidateTotalProps(candidate, slotPlan);
    const totalHtml = candidate.allRefinements && !equipAutoResultPropFilter && !combo ? '选择精炼属性后查看' : totalProps.map(item => '<span class="is-' + item.kind + '">' + escapeAiHtml(equipAutoPropertyLabel(item.prop)) + '+' + escapeAiHtml(equipAutoFormatPropValue(item.prop, item.value)) + '</span>').join('<i class="equip-auto-total-sep">、</i>');
    return `<details class="equip-auto-candidate is-${rating.key}">
        <summary>
            <span class="equip-auto-leading">
            <span class="equip-auto-rating is-${rating.key}" title="${combo ? '组合品质：按选中槽位分别计算百分比后取平均' : '精炼评级：按三槽理论满值'} ${rating.label} ${rating.roundedPercent}%"><strong>${rating.label}</strong><small>${rating.roundedPercent}%</small></span>
            <span class="equip-auto-expand-hint" aria-hidden="true">详情<i>›</i></span>
            </span>
            <span class="equip-auto-candidate-main">
                <span class="equip-auto-candidate-head">
                    <b class="equip-auto-paper${paperTone}">${escapeAiHtml(paperLabel)}</b><span class="equip-auto-round">第 ${candidate.craftIndex} 次</span>
                    ${locationChip}
                </span>
                <span class="equip-auto-chips">${targetChips}${equipAutoAttachScanChipHtml(candidate)}${regionChip}</span>
                <span class="equip-auto-candidate-costs">${equipAutoCandidateCostLinesHtml(candidate)}</span>
            </span>
            <span class="equip-auto-total" title="${combo ? '所选槽位精炼属性 + 芒晶附加 + 地区附加；未选槽位不计入' : '最高精炼属性 + 芒晶 N 次最高附加 + 地区附加'}">
                <span class="equip-auto-total-label">${combo ? '目标合计' : '总属性'}</span><strong>${totalHtml}</strong>
            </span>
            <span class="equip-auto-card-actions" data-card-v="4">
                    <span class="equip-auto-actions-scroll">
                    <button type="button" class="equip-auto-region-compare" data-region-id="${escapeAiHtml(String(candidate.id))}" title="查看这件装备在其他 NPC 打造时的地区附加"><span class="act-full">看其他NPC附加值</span><span class="act-short">附加值</span></button>
                    ${options && options.refine ? '<button type="button" class="equip-auto-refine-seq" data-refine-id="' + escapeAiHtml(String(candidate.id)) + '"><span class="act-full">精炼数据</span><span class="act-short">精炼</span></button>' : ''}
                    ${options && options.forge && equipAutoCanForge(candidate) ? '<button type="button" class="equip-auto-forge" data-forge-id="' + escapeAiHtml(String(candidate.id)) + '"><span class="act-full">看淬炼</span><span class="act-short">淬炼</span></button>' : ''}
                    ${candidate && candidate.canSimulateSpecialAttach ? '<button type="button" class="equip-auto-mang" data-mang-id="' + escapeAiHtml(String(candidate.id)) + '" title="查看这件装备的芒晶洗练序列"><span class="act-full">看芒晶洗练</span><span class="act-short">芒晶</span></button>' : ''}
                    </span>
                    <button type="button" class="equip-auto-fav${equipAutoFindFavorite(candidate.id) ? ' is-on' : ''}" data-fav-id="${escapeAiHtml(String(candidate.id))}" style="${equipAutoFindFavorite(candidate.id) ? 'background:linear-gradient(180deg,var(--sbj-c-660160d401,#b34433),#8f2a20);color:var(--sbj-c-e4902b41a0,#fffdf8);border:1px solid var(--sbj-c-cd06ff8d37,#8a291e);' : 'background:transparent;color:var(--sbj-c-3f9e5e18ed,#9c2f22);border:1px solid var(--sbj-c-29a04590dd,rgba(156,47,34,0.55));'}" title="${equipAutoFindFavorite(candidate.id) ? '取消收藏' : '收藏到云盘'}">${equipAutoFindFavorite(candidate.id) ? '★ 已收藏' : '☆ 收藏'}</button>
            </span>
        </summary>
        <div class="equip-auto-candidate-body">
            <div class="equip-auto-detail-grid">
                <div class="equip-auto-detail-card"><strong>装备品质</strong>${Number(candidate.color) === 3 ? '蓝色' : '紫色'} · ${candidate.exts.length} 词条</div>
                <div class="equip-auto-detail-card"><strong>基础属性</strong>${equipAutoFormatBase(candidate.base)}</div>
                <div class="equip-auto-detail-card"><strong>蓝/紫词条</strong>${equipAutoFormatProps(candidate.exts)}</div>
                <div class="equip-auto-detail-card equip-auto-region-card"><strong>地区附加</strong>${equipAutoFormatProps(candidate.region)}</div>
                ${equipAutoAttachScanDetailHtml(candidate)}
                <div class="equip-auto-detail-card equip-auto-material-cost"><strong>打造消耗</strong>${equipAutoCandidateCostHtml(candidate)}</div>
            </div>
            <p class="ai-visual-heading">精炼属性${candidate.allRefinements && !equipAutoResultPropFilter && !combo ? '（各属性为独立方案，不可叠加）' : ''}</p>
            ${combo ? '<div class="equip-auto-refine-card"><strong>组合路线</strong><div>做到第 ' + combo.cutoff + ' 次 · 精炼消耗：' + equipAutoFormatCost(combo.cost) + '</div><div>点击“精炼数据”查看逐次操作。</div></div>' : visibleRefinements.map(refinement => equipAutoRefinementHtml(refinement, candidate.upgradeCost)).join('')}
            ${equipAutoManualAttachHtml(candidate)}
        </div>
    </details>`;
}

function equipAutoCandidateListHtml(candidates) {
    const sorted = equipAutoResultSort === 'default'
        ? [...(candidates || [])].sort((a, b) => String(a.location).localeCompare(String(b.location), 'zh')
            || String(a.paperName).localeCompare(String(b.paperName), 'zh')
            || (a.craftIndex - b.craftIndex))
        : [...(candidates || [])];
    return `<div class="equip-auto-candidate-list">${sorted.map(candidate => equipAutoCandidateHtml(candidate, { forge: true, refine: true })).join('')}</div>`;
}

function equipAutoResultPaperKey(candidate) {
    return String(candidate && candidate.paperId != null ? candidate.paperId : candidate && candidate.paperName || '');
}

function equipAutoCandidateProps(candidate) {
    if (candidate && candidate.allRefinements) return new Set((candidate.refinements || []).filter(item => Number(item.total) > 0).map(item => String(item.prop)));
    const props = new Set();
    [...(candidate && candidate.exts || []), ...(candidate && candidate.special || []), ...(candidate && candidate.region || [])]
        .forEach(item => { if (item && item.prop) props.add(String(item.prop)); });
    (candidate && candidate.refinements || []).forEach(item => { if (item && item.prop) props.add(String(item.prop)); });
    return props;
}

function equipAutoFilteredCandidates(candidates) {
    return (Array.isArray(candidates) ? candidates : []).filter(candidate => {
        if (candidate.allRefinements && equipAutoComboActive && !equipAutoComboPlans.has(String(candidate.id))) return false;
        if (equipAutoResultLocationFilter && String(candidate.location || '') !== equipAutoResultLocationFilter) return false;
        if (equipAutoResultPaperFilter && equipAutoResultPaperKey(candidate) !== equipAutoResultPaperFilter) return false;
        const blueColor = Number(candidate.color) === 3;
        if (equipAutoResultBlueMode === 'none' && blueColor) return false;
        if (equipAutoResultBlueMode === 'only' && !blueColor) return false;
        if (equipAutoResultSeedFilter && String(candidate.seedKind || '普通') !== equipAutoResultSeedFilter) return false;
        const regionProps = Array.isArray(candidate.region) ? candidate.region : [];
        if (equipAutoResultRegionFilter === 'none' && regionProps.length) return false;
        if (equipAutoResultRegionFilter === 'any' && !regionProps.length) return false;
        if (equipAutoResultRegionFilter && equipAutoResultRegionFilter !== 'none' && equipAutoResultRegionFilter !== 'any') {
            const separator = equipAutoResultRegionFilter.lastIndexOf(':');
            const wantProp = separator > 0 ? equipAutoResultRegionFilter.slice(0, separator) : '';
            const wantValue = Number(equipAutoResultRegionFilter.slice(separator + 1));
            const matched = regionProps.some(item => item && String(item.prop) === wantProp && Number(item.value) === wantValue);
            if (!matched) return false;
        }
        if (equipAutoResultPropFilter && !equipAutoCandidateProps(candidate).has(equipAutoResultPropFilter)) return false;
        if (equipAutoSlotPlan(candidate) === false) return false;
        if (equipAutoResultQualityFilter) {
            const candidateQuality = equipAutoCandidateRating(candidate).key;
            if (!equipAutoResultQualityAtLeast && candidateQuality !== equipAutoResultQualityFilter) return false;
            if (equipAutoResultQualityAtLeast) {
                const selectedIndex = EQUIP_AUTO_RATING_LEVELS.findIndex(level => level.key === equipAutoResultQualityFilter);
                const candidateIndex = EQUIP_AUTO_RATING_LEVELS.findIndex(level => level.key === candidateQuality);
                if (selectedIndex < 0 || candidateIndex < 0 || candidateIndex > selectedIndex) return false;
            }
        }
        return true;
    });
}

function equipAutoResultFilterOptionsHtml(candidates) {
    const locations = Array.from(new Set((candidates || []).map(candidate => String(candidate.location || '')).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'zh'));
    const papers = new Map();
    (candidates || []).forEach(candidate => {
        const key = equipAutoResultPaperKey(candidate);
        if (key && !papers.has(key)) papers.set(key, String(candidate.paperName || key));
    });
    const paperEntries = Array.from(papers.entries()).sort((a, b) => a[1].localeCompare(b[1], 'zh'));
    const propMap = new Map();
    (candidates || []).forEach(candidate => {
        (candidate.allRefinements ? new Set((candidate.refinements || []).map(item => item.prop)) : equipAutoCandidateProps(candidate)).forEach(prop => {
            if (!propMap.has(prop)) propMap.set(prop, equipAutoPropertyLabel(prop));
        });
    });
    const propEntries = Array.from(propMap.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'zh'));
    const comboMap = new Map();
    (candidates || []).forEach(candidate => (candidate.refinements || []).forEach(item => { if (item && item.prop) comboMap.set(String(item.prop), equipAutoPropertyLabel(item.prop)); }));
    const comboEntries = Array.from(comboMap.entries()).sort((a,b) => String(a[1]).localeCompare(String(b[1]), 'zh'));
    const regionMap = new Map();
    (candidates || []).filter(candidate => {
        const blue = Number(candidate.color) === 3;
        if (equipAutoResultBlueMode === 'none' && blue) return false;
        if (equipAutoResultBlueMode === 'only' && !blue) return false;
        return true;
    }).forEach(candidate => {
        (Array.isArray(candidate.region) ? candidate.region : []).forEach(item => {
            if (!item || !item.prop || item.value == null) return;
            const key = String(item.prop) + ':' + Number(item.value);
            if (regionMap.has(key)) return;
            regionMap.set(key, equipAutoPropertyLabel(item.prop) + '+' + equipAutoFormatPropValue(item.prop, item.value));
        });
    });
    const regionEntries = Array.from(regionMap.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'zh'));
    return `<div class="equip-auto-result-filters" aria-label="装备候选筛选与排序">
        <section class="equip-auto-combo-filter" aria-label="精炼组合">
            <div class="equip-auto-combo-heading"><strong>精炼组合</strong><span>选择词条 1 后自动填入其余两项，可单独调整</span></div>
            <div class="equip-auto-combo-controls">
                ${[0,1,2].map(i => `<label class="equip-auto-combo-field"><span>词条 ${i+1}</span><select data-combo-slot="${i}" aria-label="词条 ${i+1}目标属性"><option value="">不限</option>${comboEntries.map(([prop,label]) => `<option value="${escapeAiHtml(prop)}">${escapeAiHtml(label)}</option>`).join('')}</select></label>`).join('')}
                <button type="button" id="btnEquipAutoCombo" class="btn">筛选组合</button>
            </div><p class="equip-auto-combo-help">不限表示该词条不限制，筛选结果会逐件回放验证。</p><p id="equipAutoComboStatus" role="status" aria-live="polite"></p>
        </section>
        <div class="equip-auto-control-row">
            <span class="equip-auto-control-label">筛选</span>
            <div class="equip-auto-filter-grid">
            <label class="equip-auto-filter-field" for="equipAutoResultLocationFilter"><span class="equip-auto-filter-sr">地点</span>
                <select id="equipAutoResultLocationFilter">
                    <option value="">地点：全部</option>
                    ${locations.map(location => `<option value="${escapeAiHtml(location)}">地点：${escapeAiHtml(location)}</option>`).join('')}
                </select>
            </label>
            <label class="equip-auto-filter-field" for="equipAutoResultPaperFilter"><span class="equip-auto-filter-sr">图纸</span>
                <select id="equipAutoResultPaperFilter">
                    <option value="">图纸：全部</option>
                    ${paperEntries.map(([key, name]) => `<option value="${escapeAiHtml(key)}">图纸：${escapeAiHtml(name)}</option>`).join('')}
                </select>
            </label>
            <label class="equip-auto-filter-field" for="equipAutoResultSeedFilter"><span class="equip-auto-filter-sr">打造序列</span>
                <select id="equipAutoResultSeedFilter">
                    <option value="">序列：全部</option>
                    <option value="普通">序列：普通</option>
                    <option value="幸运">序列：幸运</option>
                    <option value="保底">序列：保底</option>
                </select>
            </label>
            <label class="equip-auto-filter-field" for="equipAutoResultPropFilter"><span class="equip-auto-filter-sr">精炼属性</span>
                <select id="equipAutoResultPropFilter">
                    <option value="">精炼：全部</option>
                    ${propEntries.map(([prop, label]) => `<option value="${escapeAiHtml(prop)}">精炼：${escapeAiHtml(label)}</option>`).join('')}
                </select>
            </label>
            <label class="equip-auto-filter-field" for="equipAutoResultRegionFilter"><span class="equip-auto-filter-sr">地区附加</span>
                <select id="equipAutoResultRegionFilter">
                    <option value="">地区：全部</option>
                    <option value="any">地区：有</option>
                    <option value="none">地区：无</option>
                    ${regionEntries.map(([key, label]) => `<option value="${escapeAiHtml(key)}">地区：${escapeAiHtml(label)}</option>`).join('')}
                </select>
            </label>
            <label class="equip-auto-filter-field" for="equipAutoResultBlueMode" title="仅=只看蓝装；无=不显示蓝装；包含=蓝装与紫装一起显示">
                <span class="equip-auto-filter-sr">蓝装备</span>
                <select id="equipAutoResultBlueMode">
                    <option value="only">蓝装：仅看</option>
                    <option value="none">蓝装：不看</option>
                    <option value="include">蓝装：包含</option>
                </select>
            </label>
            <div class="equip-auto-filter-field">
                <span class="equip-auto-filter-sr">品质</span>
                <div class="equip-auto-quality-row">
                    <select id="equipAutoResultQualityFilter" aria-label="品质">
                        <option value="">品质：全部</option>
                        ${[...EQUIP_AUTO_RATING_LEVELS].reverse().map(level => `<option value="${level.key}">品质：${level.label}</option>`).join('')}
                    </select>
                    <label class="equip-auto-quality-toggle" for="equipAutoResultQualityAtLeast" title="同时显示所选品质及更高品质">
                        <input id="equipAutoResultQualityAtLeast" type="checkbox" checked>
                        <span>及以上</span>
                    </label>
                </div>
            </div>

            </div>
        </div>
        <div class="equip-auto-control-row is-sort">
            <span class="equip-auto-control-label">排序</span>
            <div class="equip-auto-sort-chips" role="group" aria-label="结果排序方式">
                <button type="button" class="equip-auto-sort-chip${equipAutoResultSort === 'cost' ? ' is-active' : ''}" data-sort-chip="cost" title="按连金泥消耗从少到多">连金泥</button>
                <button type="button" class="equip-auto-sort-chip${equipAutoResultSort === 'props' ? ' is-active' : ''}" data-sort-chip="props" title="按总属性从高到低">总属性</button>
                <button type="button" class="equip-auto-sort-chip${equipAutoResultSort === 'refine' ? ' is-active' : ''}" data-sort-chip="refine" title="按精炼数值从高到低">精炼数值</button>
            </div>
            <span class="equip-auto-sort-hint">再点取消</span>
        </div>
    </div>`;
}

function equipAutoResultPageData(candidates, requestedPage, requestedPageSize) {
    const items = Array.isArray(candidates) ? candidates : [];
    const parsedPageSize = Number(requestedPageSize);
    const pageSize = EQUIP_AUTO_RESULT_PAGE_SIZES.includes(parsedPageSize) ? parsedPageSize : 100;
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number.parseInt(requestedPage, 10) || 1));
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, items.length);
    return { page, pageSize, pageCount, start, end, items: items.slice(start, end) };
}

function equipAutoSortCandidates(items) {
    const list = Array.isArray(items) ? items.slice() : [];
    const qualityScore = candidate => {
        try {
            const reference = equipAutoRatingReference(candidate);
            return equipAutoCandidateRating(candidate, reference).roundedPercent || 0;
        } catch (error) { return 0; }
    };
    const propsScore = candidate => {
        try {
            const plan = equipAutoSlotPlan(candidate);
            return equipAutoCandidateTotalProps(candidate, Array.isArray(plan) ? plan : null).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
        } catch (error) { return 0; }
    };
    const costScore = candidate => {
        try {
            const parts = equipAutoCandidateCostParts(candidate);
            const item = (parts.totalList || []).find(entry => String(entry.name || '').indexOf('连金泥') >= 0);
            return item ? Number(item.amount) || 0 : 0;
        } catch (error) { return 0; }
    };
    const refineScore = candidate => {
        try {
            return (candidate.refinements || []).reduce((sum, item) => sum + (Number(item && item.total) || 0), 0);
        } catch (error) { return 0; }
    };
    if (equipAutoResultSort === 'props') list.sort((a, b) => propsScore(b) - propsScore(a));
    else if (equipAutoResultSort === 'cost') list.sort((a, b) => costScore(a) - costScore(b));
    else if (equipAutoResultSort === 'refine') list.sort((a, b) => refineScore(b) - refineScore(a));
    return list;
}

function renderEquipAutoResultPage() {
    if (!equipAutoLastResult || !Array.isArray(equipAutoLastResult.candidates)) return;
    const filteredCandidates = equipAutoSortCandidates(equipAutoFilteredCandidates(equipAutoLastResult.candidates));
    const pageData = equipAutoResultPageData(
        filteredCandidates,
        equipAutoResultPage,
        equipAutoResultPageSize,
    );
    equipAutoResultPage = pageData.page;
    equipAutoResultPageSize = pageData.pageSize;

    const pageInfo = document.getElementById('equipAutoCandidatePageInfo');
    const pageSize = document.getElementById('equipAutoResultPageSize');
    const previous = document.getElementById('btnEquipAutoResultPrev');
    const next = document.getElementById('btnEquipAutoResultNext');
    const heading = document.getElementById('equipAutoCandidatePageHeading');
    const page = document.getElementById('equipAutoCandidatePage');
    const locationFilter = document.getElementById('equipAutoResultLocationFilter');
    const paperFilter = document.getElementById('equipAutoResultPaperFilter');
    const qualityFilter = document.getElementById('equipAutoResultQualityFilter');
    const qualityAtLeast = document.getElementById('equipAutoResultQualityAtLeast');
    const seedFilter = document.getElementById('equipAutoResultSeedFilter');
    const propFilter = document.getElementById('equipAutoResultPropFilter');
    const regionFilter = document.getElementById('equipAutoResultRegionFilter');
    const showBlue = document.getElementById('equipAutoResultBlueMode');
    const range = pageData.items.length ? `${pageData.start + 1}–${pageData.end}` : '0';
    const totalSuffix = filteredCandidates.length === equipAutoLastResult.candidates.length
        ? ''
        : `（全部 ${equipAutoLastResult.candidates.length} 件）`;

    if (pageInfo) pageInfo.textContent = `第 ${pageData.page}/${pageData.pageCount} 页 · 显示 ${range} / ${filteredCandidates.length} 件${totalSuffix}`;
    if (pageSize) pageSize.value = String(pageData.pageSize);
    if (locationFilter) locationFilter.value = equipAutoResultLocationFilter;
    if (paperFilter) paperFilter.value = equipAutoResultPaperFilter;
    if (qualityFilter) qualityFilter.value = equipAutoResultQualityFilter;
    if (qualityAtLeast) qualityAtLeast.checked = equipAutoResultQualityAtLeast;
    if (seedFilter) seedFilter.value = equipAutoResultSeedFilter;
    if (propFilter) propFilter.value = equipAutoResultPropFilter;
    if (regionFilter) regionFilter.value = equipAutoResultRegionFilter;
    document.querySelectorAll('[data-sort-chip]').forEach(chip => {
        chip.classList.toggle('is-active', String(chip.dataset.sortChip) === equipAutoResultSort);
        if (equipAutoLastResult?.options?.analyzeAll) { const sort = String(chip.dataset.sortChip || ''); chip.disabled = equipAutoComboActive ? sort !== 'cost' : !equipAutoResultPropFilter; chip.title = chip.disabled ? '请先选择单个精炼属性' : ''; }
    });

    if (showBlue) showBlue.value = equipAutoResultBlueMode;
    if (previous) previous.disabled = pageData.page <= 1;
    if (next) next.disabled = pageData.page >= pageData.pageCount;
    if (heading) heading.textContent = `筛选结果：${filteredCandidates.length} 件，本页 ${pageData.items.length} 件`;
    if (page) {
        page.innerHTML = pageData.items.length
            ? equipAutoCandidateListHtml(pageData.items)
            : '<div class="ai-result-empty">当前筛选条件下没有候选装备，请调整筛选条件或增加精炼次数后重新推演。</div>';
    }
}

function equipAutoCandidateById(candidateId) {
    return (equipAutoLastResult && equipAutoLastResult.candidates || [])
        .find(candidate => String(candidate.id) === String(candidateId));
}

function rerenderEquipAutoManualAttach(candidate, currentElement) {
    if (!candidate || !currentElement) return;
    currentElement.outerHTML = equipAutoManualAttachHtml(candidate);
}

function equipAutoCanForge(candidate) {
    if (typeof EQUIP_DATA === 'undefined' || !EQUIP_DATA.equipment) return false;
    const meta = EQUIP_DATA.equipment[String(candidate && candidate.equipId)] || {};
    const type = Number(meta.type) || 0;
    return type >= 1 && type <= 4;
}

function equipAutoConfirm(message) {
    return new Promise(function (resolve) {
        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-confirm';
        wrap.innerHTML = '<div class="equip-auto-confirm-card" role="dialog" aria-modal="true">'
            + '<p class="equip-auto-confirm-text">' + escapeAiHtml(message) + '</p>'
            + '<div class="equip-auto-confirm-actions">'
            + '<button type="button" class="equip-auto-confirm-cancel">关闭</button>'
            + '<button type="button" class="equip-auto-confirm-ok">取消收藏</button>'
            + '</div></div>';
        document.body.appendChild(wrap);
        var done = function (value) {
            document.removeEventListener('keydown', onKey);
            wrap.remove();
            resolve(value);
        };
        var onKey = function (e) { if (e.key === 'Escape') done(false); };
        wrap.querySelector('.equip-auto-confirm-cancel').addEventListener('click', function () { done(false); });
        wrap.querySelector('.equip-auto-confirm-ok').addEventListener('click', function () { done(true); });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) done(false); });
        document.addEventListener('keydown', onKey);
        wrap.querySelector('.equip-auto-confirm-cancel').focus();
    });
}

function equipAutoRegionEntriesForCraftsman(cm, equip) {
    if (!cm || !equip) return [];
    const tier = Math.floor((Number(equip.lv) || 0) / 10);
    const rows = [];
    if (Array.isArray(cm.tx2) && cm.tx2.length) {
        cm.tx2.forEach(entry => {
            if (!Array.isArray(entry) || entry.length < 2) return;
            rows.push({
                prop: String(entry[0]),
                value: (Number(entry[1]) || 0) + tier * (Number(entry[2]) || 0),
                weight: Number(entry[3]) || 0,
            });
        });
    } else if (Array.isArray(cm.tx) && cm.tx.length) {
        cm.tx.forEach(entry => {
            if (!Array.isArray(entry) || entry.length < 2) return;
            rows.push({ prop: String(entry[0]), value: Number(entry[1]) || 0, weight: Number(entry[2]) || 0 });
        });
    }
    return rows.filter(row => row.prop && row.weight > 0);
}

function equipAutoCanCraftWith(cm, paper, equip) {
    if (!cm || !paper || !equip) return false;
    if ((cm.pf || []).map(Number).includes(Number(paper.id))) return true;
    const allow = cm.zhi === 'fengzhi' ? [5, 6, 7] : [1, 2, 3, 4, 8, 9];
    return allow.includes(Number(equip.type));
}

function equipAutoRegionSimulate(candidate, limit) {
    if (typeof EQUIP_DATA === 'undefined') return { rows: [], error: '数据未加载' };
    if (!equipAutoInitialMakeState) {
        try {
            const mr = typeof extractEquipMakeRnd === 'function' && typeof state !== 'undefined'
                ? extractEquipMakeRnd(state.saveData) : null;
            if (mr) equipAutoInitialMakeState = JSON.parse(JSON.stringify(mr));
        } catch (error) { }
    }
    if (!equipAutoInitialMakeState) return { rows: [], error: '没有可用的打造初始状态，请先导入存档并重新模拟一次' };
    const paper = EQUIP_DATA.papers[String(candidate.paperId)];
    const equip = paper ? EQUIP_DATA.equipment[String(paper.dz_equip)] : null;
    if (!paper || !equip) return { rows: [], error: '找不到这张图纸对应的装备' };
    const parts = String(candidate.branchKey || '').split(':');
    const currentNpc = String(parts[0] || '');
    const specialId = Number(parts[2]) || 0;
    const baseReq = {
        select_id: Number(paper.id),
        equip_id: Number(paper.dz_equip),
        special_id: specialId,
        min_color: Number(paper.min_color || 1),
        max_color: Number(paper.max_color || 4),
    };
    const extsKey = list => (Array.isArray(list) ? list : [])
        .filter(item => item && item.prop)
        .map(item => [String(item.prop), Number(item.value) || 0])
        .sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : (a[1] - b[1]))))
        .map(item => item[0] + '=' + Number(item[1]).toFixed(4))
        .join('|');
    const targetKey = extsKey(candidate.exts);
    if (!targetKey) return { rows: [], error: '这件装备没有词条，无法做同词条比对' };
    const rows = [];
    let lastError = '';
    Object.values(EQUIP_DATA.craftsman || {}).filter(cm => equipAutoCanCraftWith(cm, paper, equip)).forEach(cm => {
        const place = cm.place || cm.name || String(cm.id);
        if (String(cm.id) === currentNpc) return;
        wasmMakeSetState(JSON.parse(JSON.stringify(equipAutoInitialMakeState)));
        const resp = wasmMakePreview(Object.assign({ npc_id: Number(cm.id) }, baseReq), limit);
        if (resp && resp.error) lastError = String(resp.error);
        const items = (resp && resp.items) || [];
        let hitIndex = 0;
        let hitRegion = [];
        for (let i = 0; i < items.length; i++) {
            if (extsKey(items[i].exts) !== targetKey) continue;
            hitIndex = Number(items[i].index) || (i + 1);
            hitRegion = Array.isArray(items[i].region) ? items[i].region.filter(x => x && x.prop) : [];
            break;
        }
        rows.push({ place: place, name: cm.name || '', index: hitIndex, region: hitRegion });
    });
    rows.sort((a, b) => String(a.place).localeCompare(String(b.place), 'zh'));
    wasmMakeSetState(JSON.parse(JSON.stringify(equipAutoInitialMakeState)));
    return { rows: rows, error: lastError };
}

function equipAutoRefineWasmEquip(candidate) {
    const meta = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(candidate.equipId)]) || {};
    return {
        id: Number(candidate.equipId) || candidate.equipId,
        only_id: 0,
        name: candidate.equipName,
        color: Number(candidate.color) || 4,
        level: 0,
        lv_prop: 0,
        S: Number(candidate.S) || 0,
        CZSeed: candidate.CZSeed,
        XLLevel: 0,
        XLNumber: 0,
        exts: (candidate.exts || []).map(item => ({ ...item })),
        xilian_accepted: 0,
        xilian_marks: [],
        need_lv: Number(meta.lv) || 0,
        typ: Number(meta.type) || 0,
    };
}

function equipAutoComboRefineView(candidate, combo) {
    const rows = (items, targets, cutoff) => {
        let cumulative = 0;
        return (items || []).map(item => {
            cumulative += Number(item.cost_mult) || 1;
            const text = prop => prop && prop.prop ? equipAutoPropertyLabel(prop.prop) + '+' + equipAutoFormatPropValue(prop.prop, prop.value) : '—';
            let action = !item.accepted ? '不保留' : (targets[Number(item.slot)-1] && item.prop?.prop === targets[Number(item.slot)-1] ? '目标保留' : '临时锁定');
            if (cutoff && Number(item.index) === cutoff) action += ' · 终止';
            return [Number(item.index)||0, Number(item.slot)||0, text(item.old_prop), text(item.prop), Number(item.cost_mult)||1,
                (item.xl_level_before == null ? '-' : item.xl_level_before) + '→' + (item.xl_level == null ? '-' : item.xl_level), action, cumulative];
        });
    };
    return {schema:2, count:(candidate.refineSequence || []).length, rows:rows(candidate.refineSequence, [], 0), routes:[{
        title:'组合属性', cutoff:combo.cutoff, cost:combo.cost, upgradeCost:candidate.upgradeCost || null,
        rows:rows(combo.items, combo.targets, combo.cutoff)
    }]};
}

function openEquipAutoRefineSequence(candidateId) {
    const result = typeof equipAutoLastResult !== 'undefined' ? equipAutoLastResult : null;
    const candidate = (result && (result.candidates || []).find(item => String(item.id) === String(candidateId)))
        || (typeof equipAutoFavorites !== 'undefined' ? (equipAutoFavorites || []).find(item => String(item.id) === String(candidateId)) : null);
    if (!candidate) return;
    const combo = equipAutoComboActive && equipAutoComboPlans.get(String(candidate.id));
    if (combo && typeof EquipCardViews !== 'undefined' && EquipCardViews.openRefine(candidate, {refine:equipAutoComboRefineView(candidate, combo)})) return;
    /* 收藏时已把精炼序列算好存进快照 → 直接渲染，不再过内核 */
    if (typeof EquipCardViews !== 'undefined') {
        const cached = candidate.views && candidate.views.refine;
        const refine = cached || (EquipCardViews.captureRefineOnly && EquipCardViews.captureRefineOnly(candidate, {
            refineRows: Math.max(1, ...(candidate.refinements || []).map(item => Number(item.previewCount) || 0)),
        }));
        if (refine && EquipCardViews.openRefine(candidate, { refine })) return;
    }
    const refinements = candidate.refinements || [];
    const count = Math.max(1, ...refinements.map(item => Number(item && item.previewCount) || 0));
    const targets = refinements.map(item => equipAutoPropertyLabel(item.prop)).join(' / ') || '—';
    const old = document.querySelector('.equip-auto-forge-modal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'equip-auto-confirm equip-auto-forge-modal';
    wrap.innerHTML = '<div class="equip-auto-forge-card" role="dialog" aria-modal="true" aria-label="精炼序列">'
        + '<div class="equip-auto-forge-head"><div><strong>精炼数据 · ' + escapeAiHtml(String(candidate.equipName || '装备')) + '</strong>'
        + '<span id="equipAutoRefineRange">第 1～' + count + ' 次 · 只读预览，不推进存档</span></div>'
        + '<button type="button" class="equip-auto-forge-close" aria-label="关闭" title="关闭">×</button></div>'
        + '<p class="equip-auto-forge-meta">目标属性：' + escapeAiHtml(targets) + ' · 可自定义查看次数，并按槽位、属性筛选。</p>'
        + '<div class="equip-auto-refine-controls">'
        + '<label>查看次数 <input id="equipAutoRefineCount" type="number" min="1" max="2000" step="1" value="' + count + '"></label>'
        + '<label>槽位 <select id="equipAutoRefineSlot"><option value="">全部</option><option value="1">槽 1</option><option value="2">槽 2</option><option value="3">槽 3</option></select></label>'
        + '<label>属性 <select id="equipAutoRefineProp"><option value="">全部</option></select></label>'
        + '<span class="equip-auto-refine-meta" id="equipAutoRefineMeta"></span>'
        + '</div>'
        + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table">'
        + '<thead><tr><th>次数</th><th>槽位</th><th>原词条 → 新词条</th><th>倍率</th><th>精炼等级</th></tr></thead>'
        + '<tbody><tr><td colspan="5">正在计算精炼序列…</td></tr></tbody></table></div>'
        + '<div class="equip-auto-forge-footer"><button type="button" class="equip-auto-forge-foot-close">关闭</button></div>'
        + '</div>';
    document.body.appendChild(wrap);
    const close = () => { document.removeEventListener('keydown', onKey); wrap.remove(); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    wrap.querySelector('.equip-auto-forge-close').addEventListener('click', close);
    wrap.querySelector('.equip-auto-forge-foot-close').addEventListener('click', close);
    /* 只有真正点在遮罩上才关：从卡片里按下开始选文本、松手在遮罩上，不算点外面 */
    var downOnBackdrop = false;
    wrap.addEventListener('mousedown', function (event) { downOnBackdrop = (event.target === wrap); });
    wrap.addEventListener('click', function (event) {
        var selecting = false;
        try { selecting = String(window.getSelection ? window.getSelection() : '').length > 0; } catch (error) { }
        if (downOnBackdrop && event.target === wrap && !selecting) close();
        downOnBackdrop = false;
    });
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.equip-auto-forge-close').focus();

    const countInput = wrap.querySelector('#equipAutoRefineCount');
    const slotSelect = wrap.querySelector('#equipAutoRefineSlot');
    const propSelect = wrap.querySelector('#equipAutoRefineProp');
    const metaEl = wrap.querySelector('#equipAutoRefineMeta');
    const rangeEl = wrap.querySelector('#equipAutoRefineRange');
    const tbody = wrap.querySelector('tbody');
    const equip = equipAutoRefineWasmEquip(candidate);
    let items = [];

    function paint() {
        const slot = String(slotSelect.value || '');
        const prop = String(propSelect.value || '');
        const shown = items.filter(item => (!slot || String(item.slot) === slot)
            && (!prop || String(item.prop && item.prop.prop) === prop));
        metaEl.textContent = '显示 ' + shown.length + ' / ' + items.length + ' 条';
        if (!shown.length) {
            tbody.innerHTML = '<tr><td colspan="5">没有符合筛选条件的精炼记录</td></tr>';
            return;
        }
        tbody.innerHTML = shown.map(item => {
            const oldProp = item.old_prop
                ? equipAutoPropertyLabel(item.old_prop.prop) + '+' + equipAutoFormatPropValue(item.old_prop.prop, item.old_prop.value)
                : '—';
            const newProp = equipAutoPropertyLabel(item.prop && item.prop.prop) + '+' + equipAutoFormatPropValue(item.prop && item.prop.prop, item.prop && item.prop.value);
            return '<tr>'
                + '<td>第 ' + escapeAiHtml(String(item.index || '-')) + ' 次</td>'
                + '<td>槽 ' + escapeAiHtml(String(item.slot || '-')) + '</td>'
                + '<td>' + escapeAiHtml(oldProp) + ' → ' + escapeAiHtml(newProp) + '</td>'
                + '<td>×' + escapeAiHtml(String(item.cost_mult || 1)) + '</td>'
                + '<td>' + escapeAiHtml(String(item.xl_level_before == null ? '-' : item.xl_level_before)) + ' → ' + escapeAiHtml(String(item.xl_level == null ? '-' : item.xl_level)) + '</td>'
                + '</tr>';
        }).join('');
    }

    function compute() {
        let n = Number.parseInt(countInput.value, 10);
        if (!Number.isFinite(n)) n = count;
        n = Math.max(1, Math.min(2000, n));
        countInput.value = n;
        rangeEl.textContent = '第 1～' + n + ' 次 · 只读预览，不推进存档';
        try {
            if (typeof wasmXilianPreview !== 'function') throw new Error('装备资料尚未加载，请刷新页面后重试');
            const preview = wasmXilianPreview(equip, n);
            if (preview && preview.error && !(preview.items || []).length) throw new Error(preview.error);
            items = (preview && preview.items || []).slice(0, n);
            const current = String(propSelect.value || '');
            const props = new Map();
            items.forEach(item => {
                const key = String(item.prop && item.prop.prop || '');
                if (key && !props.has(key)) props.set(key, equipAutoPropertyLabel(key));
            });
            propSelect.innerHTML = '<option value="">全部</option>'
                + Array.from(props, ([value, label]) => '<option value="' + escapeAiHtml(value) + '">' + escapeAiHtml(label) + '</option>').join('');
            propSelect.value = props.has(current) ? current : '';
            paint();
        } catch (error) {
            items = [];
            tbody.innerHTML = '<tr><td colspan="5">' + escapeAiHtml(error && error.message || String(error)) + '</td></tr>';
            metaEl.textContent = '计算失败';
        }
    }

    countInput.addEventListener('change', compute);
    slotSelect.addEventListener('change', paint);
    propSelect.addEventListener('change', paint);
    window.setTimeout(compute, 30);
}

function openEquipAutoRegionCompare(candidateId) {
    const result = typeof equipAutoLastResult !== 'undefined' ? equipAutoLastResult : null;
    const candidate = (result && (result.candidates || []).find(item => String(item.id) === String(candidateId)))
        || (typeof equipAutoFavorites !== 'undefined' ? (equipAutoFavorites || []).find(item => String(item.id) === String(candidateId)) : null);
    if (!candidate) return;
    /* 同上：NPC 对照也是收藏时模拟好的 */
    if (candidate.views && candidate.views.region && typeof EquipCardViews !== 'undefined'
        && EquipCardViews.openRegion(candidate, candidate.views)) return;
    const limit = 1000;
    const old = document.querySelector('.equip-auto-forge-modal');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'equip-auto-confirm equip-auto-forge-modal';
    wrap.innerHTML = '<div class="equip-auto-forge-card" role="dialog" aria-modal="true" aria-label="地区附加对照">'
        + '<div class="equip-auto-forge-head"><div><strong>其他NPC附加值 · ' + escapeAiHtml(String(candidate.equipName || '装备')) + '</strong>'
        + '<span>同词条、同数值 · 只读模拟，不推进存档</span></div>'
        + '<button type="button" class="equip-auto-forge-close" aria-label="关闭" title="关闭">×</button></div>'
        + '<p class="equip-auto-forge-meta">按同一张图纸、同一打造进度，在其他 NPC 各模拟打造 ' + limit + ' 次，'
        + '找第一次出现与这件装备「词条、数量、数值完全相同」的打造；无匹配或无地区附加填“-”。</p>'
        + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table">'
        + '<thead><tr><th>NPC / 地点</th><th>第几次</th><th>地区附加</th></tr></thead>'
        + '<tbody><tr><td colspan="3">正在模拟打造…</td></tr></tbody></table></div>'
        + '<div class="equip-auto-forge-footer"><button type="button" class="equip-auto-forge-foot-close">关闭</button></div>'
        + '</div>';
    document.body.appendChild(wrap);    const close = () => { document.removeEventListener('keydown', onKey); wrap.remove(); };
    const onKey = event => { if (event.key === 'Escape') close(); };
    wrap.querySelector('.equip-auto-forge-close').addEventListener('click', close);
    wrap.querySelector('.equip-auto-forge-foot-close').addEventListener('click', close);
    /* 只有真正点在遮罩上才关：从卡片里按下开始选文本、松手在遮罩上，不算点外面 */
    var downOnBackdrop = false;
    wrap.addEventListener('mousedown', function (event) { downOnBackdrop = (event.target === wrap); });
    wrap.addEventListener('click', function (event) {
        var selecting = false;
        try { selecting = String(window.getSelection ? window.getSelection() : '').length > 0; } catch (error) { }
        if (downOnBackdrop && event.target === wrap && !selecting) close();
        downOnBackdrop = false;
    });
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.equip-auto-forge-close').focus();

    const tbody = wrap.querySelector('tbody');
    window.setTimeout(() => {
        const simulated = equipAutoRegionSimulate(candidate, limit);
        const fmt = entries => entries.length
            ? entries.map(entry => escapeAiHtml(equipAutoPropertyLabel(entry.prop)) + '+' + escapeAiHtml(equipAutoFormatPropValue(entry.prop, entry.value))).join('、')
            : '-';
        if (simulated.error && !simulated.rows.length) {
            tbody.innerHTML = '<tr><td colspan="3">' + escapeAiHtml(simulated.error) + '</td></tr>';
            return;
        }
        tbody.innerHTML = simulated.rows.map(row => '<tr>'
            + '<td>' + escapeAiHtml(row.place + (row.name && row.name !== row.place ? ' · ' + row.name : '')) + '</td>'
            + '<td>' + (row.index ? '第 ' + row.index + ' 次' : '-') + '</td>'
            + '<td>' + fmt(row.region) + '</td></tr>').join('') || '<tr><td colspan="3">没有其他可打造这件装备的 NPC</td></tr>';
    }, 30);
}

/* 芒晶：这里没有缓存，现算一次（按页面上的芒晶次数），再交给和藏兵阁同一个面板渲染 */
function openEquipAutoMang(candidateId) {
    const id = String(candidateId);
    const candidate = (equipAutoLastResult && equipAutoLastResult.candidates || []).find(item => String(item.id) === id)
        || (equipAutoFavorites || []).find(item => String(item.id) === id);
    if (!candidate) return;
    if (typeof EquipCardViews === 'undefined' || !EquipCardViews.openMang) {
        window.alert('망정 상세 화면을 불러오지 못했습니다.');
        return;
    }
    let summary = null;
    try { summary = equipAutoAttachScanSummary(candidate); }
    catch(error) { console.warn('망정 시퀀스 미리보기 오류',error); }
    if (summary && Array.isArray(summary.items) && summary.items.length) {
        EquipCardViews.openMang(candidate, { mang: summary });
        return;
    }
    // Quick search can omit the first forging material. In that case
    // the source candidate still carries its actual MJSeed: let users select
    // a compatible material and calculate from that unchanged seed.
    const paper = EQUIP_DATA.papers[String(candidate.paperId)];
    const beforeCfg = paper && EQUIP_DATA.equipment[String(paper.dz_equip)];
    const afterCfg = EQUIP_DATA.equipment[String(candidate.equipId)] || beforeCfg;
    const baseCfg = beforeCfg || afterCfg;
    if (!baseCfg) { window.alert('망정에 필요한 장비 도면 데이터를 찾지 못했습니다.'); return; }
    const rawBefore = candidate.specialAttachEquips && candidate.specialAttachEquips.before;
    const rawAfter = candidate.specialAttachEquips && candidate.specialAttachEquips.after;
    const initial = rawBefore || {
        id: baseCfg.id, name: baseCfg.name, typ: baseCfg.type,
        need_lv: baseCfg.lv, MJSeed: candidate.MJSeed
    };
    const levels = [{label:'승련 전 · '+initial.need_lv+'레벨',value:'before',context:initial}];
    if (rawAfter) levels.push({label:'승련 후 · '+rawAfter.need_lv+'레벨',value:'after',context:rawAfter});
    const materials = EquipmentAutoOptimizer.specialMaterialsForEquip(EQUIP_DATA,initial);
    if (!materials.length) { window.alert('이 장비에 사용할 수 있는 망정 재료가 없습니다.'); return; }
    const oldModal = document.querySelector('#nangmanQuickMangModal');
    if(oldModal) oldModal.remove();
    const backdrop = document.createElement('div');
    backdrop.id='nangmanQuickMangModal';
    backdrop.className='equip-auto-confirm equip-auto-forge-modal';
    backdrop.innerHTML='<div class="equip-auto-forge-card" role="dialog" aria-modal="true" aria-label="망정 상세 조회">'
      +'<div class="equip-auto-forge-head"><div><strong>망정 보기 · '+escapeAiHtml(candidate.equipName||baseCfg.name)+'</strong>'
      +'<span>장비의 망정 시드를 기준으로 선택한 재료의 순서를 계산합니다.</span></div>'
      +'<button type="button" class="equip-auto-forge-close" data-close-mang>×</button></div>'
      +'<div class="equip-auto-forge-controls"><label>망정 재료<select data-mang-material>'
      +materials.map(m=>'<option value="'+escapeAiHtml(String(m.id))+'">'+escapeAiHtml(m.name)+'</option>').join('')
      +'</select></label><label>단계<select data-mang-stage>'
      +levels.map(l=>'<option value="'+l.value+'">'+escapeAiHtml(l.label)+'</option>').join('')
      +'</select></label><label>조회 횟수<input data-mang-count type="number" value="100" min="1" max="5000" step="1"></label></div>'
      +'<p class="meta-text">세이브의 장비 시드를 변경하거나 망정 재료를 소모하지 않습니다. 최초 제작 재료를 선택하지 않았던 결과도 조회할 수 있습니다.</p>'
      +'<p data-mang-error role="status" aria-live="polite"></p>'
      +'<div class="equip-auto-forge-footer"><button type="button" class="btn primary" data-mang-calculate>망정 순서 조회</button>'
      +'<button type="button" class="btn" data-close-mang>닫기</button></div></div>';
    document.body.appendChild(backdrop);
    const defaultMaterial = String(candidate.craftSpecialId||'2021');
    if(materials.some(m=>String(m.id)===defaultMaterial))backdrop.querySelector('[data-mang-material]').value=defaultMaterial;
    const close=()=>backdrop.remove();
    backdrop.querySelectorAll('[data-close-mang]').forEach(btn=>btn.addEventListener('click',close));
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    backdrop.querySelector('[data-mang-calculate]').addEventListener('click',()=>{
        const material=EQUIP_DATA.special[backdrop.querySelector('[data-mang-material]').value];
        const stage=backdrop.querySelector('[data-mang-stage]').value;
        const context=levels.find(l=>l.value===stage)?.context||initial;
        const count=Number(backdrop.querySelector('[data-mang-count]').value);
        const status=backdrop.querySelector('[data-mang-error]');
        try{
            if(!Number.isSafeInteger(count)||count<1||count>5000)throw Error('조회 횟수는 1~5000의 정수여야 합니다.');
            if(!Number.isSafeInteger(Number(context.MJSeed))||Number(context.MJSeed)<=0)
                throw Error('이 장비의 실제 망정 시드를 확인할 수 없습니다.');
            const result=EquipmentAutoOptimizer.predictSpecialAttachSequence(context,material,count);
            if(!result||!Array.isArray(result.items)||!result.items.length)throw Error('조회 가능한 망정 결과가 없습니다.');
            const maxima=result.maxima||[];
            const best=result.items.reduce((a,b)=>!a||Number(b.value)>Number(a.value)?b:a,null);
            const view={count,stage,level:context.need_lv,materialName:material.name,best,maxima,items:result.items};
            close();
            if(!EquipCardViews.openMang(candidate,{mang:view}))window.alert('망정 결과 창을 열 수 없습니다.');
        }catch(error){status.textContent='망정 조회 실패: '+String(error?.message||error);}
    });
}

function handleEquipAutoFavoriteClick(event) {
    const mangButton = event.target.closest('[data-mang-id]');
    if (mangButton) {
        event.preventDefault();
        event.stopPropagation();
        openEquipAutoMang(mangButton.dataset.mangId);
        return;
    }
    const regionButton = event.target.closest('[data-region-id]');
    if (regionButton) {
        event.preventDefault();
        event.stopPropagation();
        openEquipAutoRegionCompare(regionButton.dataset.regionId);
        return;
    }
    const refineSeq = event.target.closest('[data-refine-id]');
    if (refineSeq) {
        event.preventDefault();
        event.stopPropagation();
        openEquipAutoRefineSequence(refineSeq.dataset.refineId);
        return;
    }
    const forge = event.target.closest('[data-forge-id]');
    if (forge) {
        event.preventDefault();
        event.stopPropagation();
        equipAutoShowForgePreview(forge.dataset.forgeId);
        return;
    }
    const button = event.target.closest('[data-fav-id]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.favId;
    const inFavorites = !!button.closest('#autoEquipFavorites');
    if (inFavorites && equipAutoFindFavorite(id)) {
        equipAutoConfirm('取消收藏这件装备？').then(function (ok) {
            if (ok) equipAutoToggleFavorite(id);
        });
        return;
    }
    equipAutoToggleFavorite(id);
}

function resetEquipAutoCombo() {
    equipAutoComboActive = false; equipAutoComboPlans = new Map();
}

async function runEquipAutoComboFilter() {
    const button = document.getElementById('btnEquipAutoCombo');
    const status = document.getElementById('equipAutoComboStatus');
    if (equipAutoComboRunning) {
        equipAutoComboToken++; equipAutoComboRunning = false;
        if (button) { button.disabled = false; button.textContent = '筛选组合'; }
        document.querySelectorAll('[data-combo-slot]').forEach(input => { input.disabled = false; });
        if (status) status.textContent = '已停止组合筛选。';
        return;
    }
    const wanted = equipAutoComboDraft.slice();
    if (!wanted.some(Boolean)) {
        resetEquipAutoCombo(); equipAutoResultPage = 1;
        if (status) status.textContent = '已清除组合条件。';
        renderEquipAutoResultPage(); return;
    }
    const candidates = equipAutoLastResult?.candidates || [];
    const count = Number(equipAutoLastResult?.options?.refineCount) || 0;
    if (!count || !candidates.length) return;
    const plans = new Map(), token = ++equipAutoComboToken;
    equipAutoComboRunning = true;
    if (button) button.textContent = '停止筛选';
    document.querySelectorAll('[data-combo-slot]').forEach(input => { input.disabled = true; });
    try {
        for (let i = 0; i < candidates.length; i++) {
            if (token !== equipAutoComboToken) return;
            if (status) status.textContent = `正在回放组合 ${i+1}/${candidates.length} 件…`;
            const candidate = candidates[i], equip = equipAutoRefineWasmEquip(candidate);
            const plan = EquipmentAutoOptimizer.analyzeRefinementCombination({xilianPlan:(eq, flags) => wasmXilianPlan(eq, flags)}, equip, wanted, count, EQUIP_DATA);
            if (plan) plans.set(String(candidate.id), plan);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (token !== equipAutoComboToken) return;
        equipAutoComboPlans = plans; equipAutoComboActive = true; equipAutoResultPropFilter = ''; equipAutoResultSort = 'default'; equipAutoResultPage = 1;
        const prop = document.getElementById('equipAutoResultPropFilter'); if (prop) prop.value = '';
        if (status) status.textContent = `已回放 ${candidates.length} 件，${plans.size} 件满足组合；各结果均可按路线操作。`;
        renderEquipAutoResultPage();
    } catch (error) {
        resetEquipAutoCombo();
        if (status) status.textContent = '组合筛选未完成：' + (error?.message || error);
        renderEquipAutoResultPage();
    } finally {
        if (token === equipAutoComboToken) {
            equipAutoComboRunning = false;
            if (button) button.textContent = '筛选组合';
            document.querySelectorAll('[data-combo-slot]').forEach(input => { input.disabled = false; });
        }
    }
}

function handleEquipAutoResultClick(event) {
    if (!equipAutoLastResult) return;
    if (event.target.closest?.('#btnEquipAutoCombo')) { event.preventDefault(); runEquipAutoComboFilter(); return; }
    const sortChip = event.target.closest?.('[data-sort-chip]');
    if (sortChip) {
        event.preventDefault();
        const nextSort = String(sortChip.dataset.sortChip || '');
        equipAutoResultSort = equipAutoResultSort === nextSort ? 'default' : nextSort;
        equipAutoResultPage = 1;
        renderEquipAutoResultPage();
        return;
    }
    const action = event.target.closest?.('[data-manual-attach-action]');
    if (action) {
        const container = action.closest('.equip-auto-manual-attach[data-candidate-id]');
        const candidate = equipAutoCandidateById(container && container.dataset.candidateId);
        if (!candidate || !candidate.canSimulateSpecialAttach) return;
        const state = equipAutoManualAttachState(candidate);
        if (action.dataset.manualAttachAction === 'stage') {
            state.stage = action.dataset.stage === 'after' ? 'after' : 'before';
            state.result = null;
            state.error = '';
            rerenderEquipAutoManualAttach(candidate, container);
            return;
        }
        if (action.dataset.manualAttachAction === 'simulate') {
            const countInput = container.querySelector('.equip-auto-manual-attach-count');
            let count = Number.parseInt(countInput && countInput.value || String(state.count), 10);
            if (!Number.isFinite(count)) count = 500;
            state.count = Math.max(1, Math.min(5000, count));
            state.error = '';
            try {
                const equip = candidate.specialAttachEquips[state.stage];
                const material = EQUIP_DATA.special[String(candidate.craftSpecialId)];
                state.result = {
                    ...EquipmentAutoOptimizer.predictSpecialAttachSequence(equip, material, state.count),
                    stage: state.stage,
                    equipLevel: equip.need_lv,
                };
            } catch (error) {
                state.result = null;
                state.error = `模拟失败：${error?.message || error}`;
            }
            rerenderEquipAutoManualAttach(candidate, container);
            return;
        }
    }
    if (event.target.id === 'btnEquipAutoResultPrev') equipAutoResultPage -= 1;
    else if (event.target.id === 'btnEquipAutoResultNext') equipAutoResultPage += 1;
    else return;
    renderEquipAutoResultPage();
}

function handleEquipAutoResultControlChange(event) {
    if (event.target.matches?.('[data-combo-slot]')) {
        const slot = Number(event.target.dataset.comboSlot);
        if (slot >= 0 && slot < 3) {
            const value = String(event.target.value || '');
            equipAutoComboDraft[slot] = value;
            if (slot === 0 && value) {
                equipAutoComboDraft[1] = value;
                equipAutoComboDraft[2] = value;
                document.querySelectorAll('[data-combo-slot]').forEach(input => {
                    if (Number(input.dataset.comboSlot) > 0) input.value = value;
                });
            }
        }
        resetEquipAutoCombo(); equipAutoResultSort = 'default'; equipAutoResultPage = 1;
        const status = document.getElementById('equipAutoComboStatus'); if (status) status.textContent = '条件已修改，点击“筛选组合”开始回放。';
        renderEquipAutoResultPage(); return;
    }
    if (event.target.classList?.contains('equip-auto-manual-attach-count')) {
        const container = event.target.closest('.equip-auto-manual-attach[data-candidate-id]');
        const candidate = equipAutoCandidateById(container && container.dataset.candidateId);
        if (!candidate) return;
        const state = equipAutoManualAttachState(candidate);
        let count = Number.parseInt(event.target.value, 10);
        if (!Number.isFinite(count)) count = 500;
        state.count = Math.max(1, Math.min(5000, count));
        state.result = null;
        state.error = '';
        rerenderEquipAutoManualAttach(candidate, container);
        return;
    }
    if (event.target.id === 'equipAutoResultPageSize') {
        equipAutoResultPageSize = Number(event.target.value);
    } else if (event.target.id === 'equipAutoResultLocationFilter') {
        equipAutoResultLocationFilter = String(event.target.value || '');
    } else if (event.target.id === 'equipAutoResultPaperFilter') {
        equipAutoResultPaperFilter = String(event.target.value || '');
    } else if (event.target.id === 'equipAutoResultQualityFilter') {
        equipAutoResultQualityFilter = String(event.target.value || '');
    } else if (event.target.id === 'equipAutoResultQualityAtLeast') {
        equipAutoResultQualityAtLeast = !!event.target.checked;
    } else if (event.target.id === 'equipAutoResultSeedFilter') {
        equipAutoResultSeedFilter = String(event.target.value || '');
    } else if (event.target.id === 'equipAutoResultPropFilter') {
        equipAutoResultPropFilter = String(event.target.value || '');
        if (equipAutoResultPropFilter && equipAutoComboActive) { resetEquipAutoCombo(); equipAutoComboDraft = ['', '', '']; document.querySelectorAll('[data-combo-slot]').forEach(input => { input.value = ''; }); const status = document.getElementById('equipAutoComboStatus'); if (status) status.textContent = ''; }
        if (!equipAutoResultPropFilter && equipAutoLastResult?.options?.analyzeAll) equipAutoResultSort = 'default';
    } else if (event.target.id === 'equipAutoResultRegionFilter') {
        equipAutoResultRegionFilter = String(event.target.value || '');
    } else if (event.target.id === 'equipAutoResultBlueMode') {
        equipAutoResultBlueMode = ['only', 'include', 'none'].includes(String(event.target.value)) ? String(event.target.value) : 'include';
    } else {
        return;
    }
    equipAutoResultPage = 1;
    renderEquipAutoResultPage();
}

function renderEquipAutoResults(result) {
    const container = document.getElementById('autoEquipResults');
    if (!container) return;
    const resultsCount = document.getElementById('autoEquipResultsCount');
    if (resultsCount) {
        const total = Number(result && result.candidates && result.candidates.length || 0);
        resultsCount.textContent = total ? total + ' 件' : '';
    }
    equipAutoLastResult = result;
    equipAutoResultPage = 1;
    equipAutoResultLocationFilter = '';
    equipAutoResultPaperFilter = '';
    equipAutoResultQualityFilter = '';
    equipAutoResultQualityAtLeast = true;
    equipAutoResultSeedFilter = '';
    equipAutoResultPropFilter = '';
    equipAutoResultRegionFilter = '';
    equipAutoResultBlueMode = 'include';
    equipAutoComboDraft = ['', '', '']; equipAutoComboActive = false; equipAutoComboPlans = new Map(); equipAutoComboToken++; equipAutoComboRunning = false;
    equipAutoManualAttachStates = new Map();
    equipAutoAttachScanCache = new Map();
    container.dataset.hasResult = 'true';
    if (!result || !result.candidates || !result.candidates.length) {
        const skipped = Number(result && result.summary && result.summary.skippedBranchCount || 0);
        const filteredBySlot = Number(result && result.summary && result.summary.slotFiltered || 0);
        if (filteredBySlot > 0) {
            container.innerHTML = `<div class="ai-result-error">按所选词条组合过滤掉了 ${filteredBySlot} 件蓝/紫装：没有装备的三词条同时满足你指定的属性。可以清空某个词条位（表示任意属性）再试。</div>`;
            return;
        }
        container.innerHTML = `<div class="ai-result-error">当前兼容范围没有打造出蓝装或紫装，请增加打造次数或调整地点、图纸与材料。${skipped ? ` 已跳过 ${skipped} 个属性不兼容分支。` : ''}</div>`;
        return;
    }
    container.innerHTML = `${(result.skippedBranches || []).length ? `<details class="equip-auto-skipped-branches"><summary>查看跳过的 ${result.skippedBranches.length} 个分支</summary>${result.skippedBranches.map(branch => `<div>${escapeAiHtml(branch.location)} · ${escapeAiHtml(branch.paperName)}：${escapeAiHtml(branch.reason)}</div>`).join('')}</details>` : ''}
    <div class="equip-auto-result-toolbar" aria-label="装备候选筛选与数量">
        ${equipAutoResultFilterOptionsHtml(result.candidates)}
        <p id="equipAutoCandidatePageHeading" class="equip-auto-result-count"></p>
    </div>
    <div id="equipAutoCandidatePage"></div>
    <div class="pager-bar equip-auto-result-pager" aria-label="装备候选分页">
        <div class="equip-auto-pager-controls">
            <span id="equipAutoCandidatePageInfo" class="meta-text"></span>
            <button id="btnEquipAutoResultPrev" class="btn equip-auto-pager-button" type="button">上一页</button>
            <button id="btnEquipAutoResultNext" class="btn equip-auto-pager-button" type="button">下一页</button>
            <label class="pager-size" for="equipAutoResultPageSize">每页
                <select id="equipAutoResultPageSize">
                    ${EQUIP_AUTO_RESULT_PAGE_SIZES.map(size => `<option value="${size}" ${size === equipAutoResultPageSize ? 'selected' : ''}>${size}</option>`).join('')}
                </select>
                件
            </label>
        </div>
    </div>`;
    renderEquipAutoResultPage();
}

function setEquipAutoInputsDisabled(disabled) {
    document.querySelectorAll('#autoEquipModePanel input, #autoEquipModePanel select').forEach(element => {
        element.disabled = !!disabled;
    });
}

/* ---------------- 神器速查 ----------------
   18 张图纸里：40 次打造以内、连金泥 ≤300、品质神器。
   紫金(3025) 只查南阳渡/忘忧村/铸剑山庄；乌缕(3035) 只查洛阳/南阳渡/泠月。 */
var equipAutoSweepRunning = false;
var EQUIP_AUTO_SWEEP_LOCATIONS = {
    '3025': ['南阳渡', '忘忧村', '铸剑山庄'],
    '3035': ['洛阳', '南阳渡', '泠月'],
};

/* 速查卡片里的精炼属性多选：默认全选，点一下切换 */
/* 属性按钮的显示顺序：常用属性在前，其余按原顺序 */
var EQUIP_AUTO_SWEEP_PREFERRED = ['免伤', '穿甲', '攻击', '内劲', '吸血', '聚气', '真元', '溅伤', '反伤', '气血', '命中', '速度'];

function equipAutoSweepPropRank(prop) {
    var label = EQUIP_DATA.propNames[prop] || prop;
    var index = EQUIP_AUTO_SWEEP_PREFERRED.indexOf(label);
    return index < 0 ? EQUIP_AUTO_SWEEP_PREFERRED.length : index;
}

function equipAutoSweepAllProps() {
    var papers = equipAutoSweepPapers();
    var allProps = Object.keys(EQUIP_DATA.propNames || {});
    var set = [];
    papers.forEach(function (paperId) {
        var paper = EQUIP_DATA.papers[paperId];
        var equip = paper && EQUIP_DATA.equipment[String(paper.dz_equip)];
        if (!equip) return;
        EquipmentAutoOptimizer.supportedTargetProperties(equip, EQUIP_DATA, allProps).forEach(function (prop) {
            if (set.indexOf(prop) < 0) set.push(prop);
        });
    });
    return set;
}

function renderEquipAutoSweepProps() {
    var box = document.getElementById('equipAutoSweepProps');
    if (!box || box.dataset.ready === '1') return;
    var props = equipAutoSweepAllProps();
    if (!props.length) return;
    var rank = equipAutoSweepPropRank;
    props = props.map(function (prop, index) { return { prop: prop, index: index }; })
        .sort(function (a, b) { return rank(a.prop) - rank(b.prop) || a.index - b.index; })
        .map(function (item) { return item.prop; });
    box.dataset.ready = '1';
    box.innerHTML = props.map(function (prop) {
        return '<button type="button" class="equip-auto-sweep-prop" data-sweep-prop="' + prop + '">'
            + (EQUIP_DATA.propNames[prop] || prop) + '</button>';
    }).join('');
    box.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-sweep-prop]');
        if (!btn) return;
        btn.classList.toggle('is-on');
        syncAllPropsButton();
    });
    var allButton = document.getElementById('btnEquipAutoSweepAllProps');
    if (allButton) {
        allButton.addEventListener('click', function () {
            var buttons = Array.prototype.slice.call(box.querySelectorAll('[data-sweep-prop]'));
            var allOn = buttons.length > 0 && buttons.every(function (b) { return b.classList.contains('is-on'); });
            buttons.forEach(function (b) { b.classList.toggle('is-on', !allOn); });
            syncAllPropsButton();
        });
        syncAllPropsButton();
    }
}

function syncAllPropsButton() {
    var button = document.getElementById('btnEquipAutoSweepAllProps');
    var box = document.getElementById('equipAutoSweepProps');
    if (!button || !box) return;
    var buttons = Array.prototype.slice.call(box.querySelectorAll('[data-sweep-prop]'));
    var allOn = buttons.length > 0 && buttons.every(function (b) { return b.classList.contains('is-on'); });
    button.textContent = allOn ? '清空' : '一键全选';
}

function equipAutoSweepSelectedProps() {
    var box = document.getElementById('equipAutoSweepProps');
    if (!box) return [];
    var buttons = Array.prototype.slice.call(box.querySelectorAll('[data-sweep-prop]'));
    var selected = buttons.filter(function (b) { return b.classList.contains('is-on'); })
        .map(function (b) { return b.getAttribute('data-sweep-prop'); });
    return selected;
}

/* 速查的图纸：固定这 18 张（紫金 12 + 乌缕 6） */
var EQUIP_AUTO_SWEEP_PAPER_NAMES = [
    '撼岳掌套', '破军指套', '掠影刀', '碎月重刀', '万仞重剑', '巽风剑',
    '碎虚枪', '贪狼棍', '青云戒', '苏布宝戒', '其木格坠', '青云坠',
    '吉达护腰', '玉衡护腰', '乌斯护腕', '紫薇护腕', '呼如木甲', '乌蚕宝甲'
];

function equipAutoSweepPapers() {
    var papers = EQUIP_DATA.papers || {};
    return Object.keys(papers).filter(function (id) {
        var paper = papers[id];
        if (!paper || !EQUIP_AUTO_SWEEP_LOCATIONS[String(paper.dz_mat)]) return false;
        var shortName = String(paper.name || '').replace(/图样$/, '');
        return EQUIP_AUTO_SWEEP_PAPER_NAMES.indexOf(shortName) >= 0;
    });
}

function renderEquipAutoSweepPaperPicker() {
    var box = document.getElementById('equipAutoSweepPaperChoices');
    if (!box || box.dataset.ready === '1') return;
    var papers = equipAutoSweepPapers().sort(function (a, b) {
        var name = function (id) { return String(EQUIP_DATA.papers[id].name || '').replace(/图样$/, ''); };
        return EQUIP_AUTO_SWEEP_PAPER_NAMES.indexOf(name(a)) - EQUIP_AUTO_SWEEP_PAPER_NAMES.indexOf(name(b));
    });
    if (!papers.length) return;
    box.dataset.ready = '1';
    box.innerHTML = ['3025', '3035'].map(function (material) {
        var items = papers.filter(function (id) { return String(EQUIP_DATA.papers[id].dz_mat) === material; });
        return '<div class="sweep-paper-group"><div class="sweep-paper-group-title">' + (material === '3025' ? '紫金' : '乌缕') + ' <span>' + items.length + ' 张</span></div><div class="sweep-paper-grid">'
            + items.map(function (id) {
                var paper = EQUIP_DATA.papers[id];
                var equip = EQUIP_DATA.equipment[String(paper.dz_equip)] || {};
                var label = String(equip.name || paper.name || '').replace(/图样$/, '');
                var type = (EQUIP_DATA.typeNames || {})[String(equip.type)] || '';
                return '<label class="sweep-paper-option"><input type="checkbox" data-sweep-paper="' + escapeAiHtml(String(id)) + '" value="' + escapeAiHtml(String(id)) + '"><span>' + escapeAiHtml(label) + (type ? ' · ' + escapeAiHtml(String(type)) : '') + '</span></label>';
            }).join('') + '</div></div>';
    }).join('');
    var count = document.getElementById('equipAutoSweepPaperCount');
    var inputs = Array.prototype.slice.call(box.querySelectorAll('[data-sweep-paper]'));
    var selectedCount = 0;
    function sync() {
        if (count) count.textContent = '已选 ' + selectedCount + ' / ' + inputs.length;
    }
    box.addEventListener('change', function (event) {
        var input = event.target;
        if (!input || !input.hasAttribute('data-sweep-paper')) return;
        selectedCount += input.checked ? 1 : -1;
        input.parentElement.classList.toggle('is-selected', input.checked);
        sync();
    });
    ['All', 'None'].forEach(function (action) {
        var button = document.getElementById('btnEquipAutoSweepPaper' + action);
        if (button) button.addEventListener('click', function () {
            var selected = action === 'All';
            inputs.forEach(function (input) { input.checked = selected; input.parentElement.classList.toggle('is-selected', selected); });
            selectedCount = selected ? inputs.length : 0;
            sync();
        });
    });
    sync();
}

function equipAutoSweepSelectedPapers() {
    var box = document.getElementById('equipAutoSweepPaperChoices');
    if (!box) return equipAutoSweepPapers();
    return Array.prototype.map.call(box.querySelectorAll('[data-sweep-paper]:checked'), function (input) { return input.value; });
}

function equipAutoSweepFavoriteMatches(item, papers, allPapers) {
    if (papers.length === allPapers.length) return true; // 保持原有全部图纸时的收藏行为
    if (item.paperId != null && String(item.paperId)) return papers.indexOf(String(item.paperId)) >= 0;
    var name = String(item.paperName || item.equipName || item.name || '').replace(/图样$/, '');
    if (!name) return false;
    var matches = allPapers.filter(function (id) {
        var paper = EQUIP_DATA.papers[id] || {};
        var equip = (EQUIP_DATA.equipment || {})[String(paper.dz_equip)] || {};
        return name === String(paper.name || '').replace(/图样$/, '') || name === String(equip.name || '');
    });
    return matches.length === 1 && papers.indexOf(String(matches[0])) >= 0;
}

/* 指定 NPC：紫金类找紫金熔炉/胡铁匠/张铁匠，乌缕类找月绣/红萝/陈三娘 */
var EQUIP_AUTO_SWEEP_NPCS = {
    '3025': ['紫金熔炉', '胡铁匠', '张铁匠'],
    '3035': ['月绣', '红萝', '陈三娘'],
};

function equipAutoSweepCraftsmen(paperId, paper) {
    var wanted = EQUIP_AUTO_SWEEP_NPCS[String(paper && paper.dz_mat)] || [];
    if (!wanted.length) return [];
    var craftsmen = EQUIP_DATA.craftsman || {};
    var list = [];
    Object.keys(craftsmen).forEach(function (id) {
        var entry = craftsmen[id];
        if (!entry || wanted.indexOf(String(entry.name || '')) < 0) return;
        list.push(String(id));
    });
    return list;
}

function equipAutoSweepLianjin(candidate, refinement) {
    // Each quick-search row is one independent target-property route. Reuse
    // the result-card ledger, including forging/upgrade, without adding other
    // alternative target properties into this row's expenditure.
    var refinements = refinement ? [refinement] : ((candidate && candidate.refinements) || []);
    var normalized = refinements.map(function (item) {
        if (item && item.plan && item.plan.cost) return item;
        var consumed = Number(item && item.consumedLianjin);
        return { plan: { cost: { lianjin: Number.isFinite(consumed) ? consumed : 0 } } };
    });
    var parts = equipAutoCandidateCostParts(Object.assign({}, candidate, { refinements: normalized }));
    return (parts.totalList || []).reduce(function (sum, item) {
        return sum + (String(item.id) === '8801' || String(item.name || '').indexOf('连金泥') >= 0 ? Number(item.amount) || 0 : 0);
    }, 0);
}

function equipAutoSweepRegion(candidate) {
    var region = candidate && candidate.region;
    if (!Array.isArray(region) || !region.length) return '-';
    return region.map(function (item) {
        if (!item || !item.prop) return '';
        return (EQUIP_DATA.propNames[item.prop] || item.prop) + ' ' + equipAutoFormatPropValue(item.prop, item.value);
    }).filter(Boolean).join(' · ') || '-';
}

function equipAutoSweepProps(candidate) {
    return (candidate.exts || []).map(function (item) {
        return (EQUIP_DATA.propNames[item.prop] || item.prop) + ' ' + equipAutoFormatPropValue(item.prop, item.value);
    }).join(' · ');
}

async function runEquipAutoSweep() {
    if (equipAutoSweepRunning) return;
    var status = document.getElementById('equipAutoSweepStatus');
    var results = document.getElementById('equipAutoSweepResults');
    var progressBar = document.getElementById('equipAutoSweepProgress');
    function setProgress(done, total) {
        if (!progressBar) return;
        progressBar.hidden = !total;
        progressBar.max = total || 100;
        progressBar.value = done;
    }
    function setStatus(text) {
        if (!status) return;
        status.textContent = text || '';
        status.hidden = !text;
    }
    var button = document.getElementById('btnEquipAutoSweep');

    var saveState = typeof loadShareStore === 'function' ? loadShareStore() : null;
    // 통합 탭은 메모리의 한국판 JSON을 직접 전달한다. 빠른 조회는 저장소에 없는 경우에도 이 데이터를 사용한다.
    var sourceSave = (state && state.saveData) || (saveState && saveState.data);
    var makeRnd = sourceSave && typeof extractEquipMakeRnd === 'function' ? extractEquipMakeRnd(sourceSave) : null;
    if (!makeRnd) { setStatus('불러온 세이브에서 장비 제작 정보(MakeRnd)를 찾지 못했습니다.'); return; }

    renderEquipAutoSweepPaperPicker();
    var allPapers = equipAutoSweepPapers();
    var papers = equipAutoSweepSelectedPapers();
    if (!papers.length) { setStatus('请至少选择一张图纸。'); return; }
    renderEquipAutoSweepProps();
    var chosenProps = equipAutoSweepSelectedProps();
    if (!chosenProps.length) { setStatus('至少选一个精炼属性。'); return; }
    var allProps = chosenProps;
    var chosenPropSet = new Set(chosenProps);

    equipAutoSweepRunning = true;
    if (button) { button.disabled = true; button.textContent = '查找中…'; }
    var paperFieldset = document.getElementById('equipAutoSweepPaperFieldset');
    if (paperFieldset) paperFieldset.disabled = true;
    if (results) results.innerHTML = '';
    setProgress(0, papers.length);
    var found = [];
    var refineCount = clampEquipAutoNumber('autoEquipRefineCount', 1, 2000, 200);
    var lianjinLimit = clampEquipAutoNumber('autoEquipSweepLianjin', 0, 100000, 300);
    /* 每次精炼至少消耗一份连金泥；先按预算扩展候选范围，
       最后用含升炼的实际总消耗过滤，锁定倍率仍由原始内核计算。 */
    if (lianjinLimit > 0) {
        refineCount = Math.max(refineCount, Math.min(lianjinLimit, 2000));
    }
    var craftLimit = clampEquipAutoNumber('autoEquipSweepCrafts', 1, 5000, 40);
    var qualitySelect = document.getElementById('autoEquipSweepQuality');
    var minQuality = qualitySelect ? Number(qualitySelect.value) || 0 : 91;
    var qualityLabel = qualitySelect && qualitySelect.selectedOptions && qualitySelect.selectedOptions[0]
        ? qualitySelect.selectedOptions[0].textContent : '所选等级';

    try {
        for (var index = 0; index < papers.length; index += 1) {
            var paperId = String(papers[index]);
            var paper = EQUIP_DATA.papers[paperId];
            var equip = paper && EQUIP_DATA.equipment[String(paper.dz_equip)];
            if (!equip) continue;
            var props = EquipmentAutoOptimizer.supportedTargetProperties(equip, EQUIP_DATA, allProps);
            if (!props.length) continue;
            var npcIds = equipAutoSweepCraftsmen(paperId, paper);
            if (!npcIds.length) continue;

            /* 每个属性只给一条（不带 slot）：让引擎一次性把三格一起算，
               否则会按格拆成 3 份再相加，把已有词条数值重复计入，合计被放大。 */
            var slotTargets = props.map(function (prop) { return { prop: prop }; });
            var config = equipAutoPaperConfigs.get(paperId) || {};
            var specialIds = Array.from(new Set((config.craftMaterialIds || []).map(Number).filter(function (id) { return id > 0; })));
            var branches = [];
            npcIds.forEach(function (npcId) {
                (specialIds.length ? specialIds : [0]).forEach(function (specialId) {
                    branches.push({ npcId: npcId, paperId: Number(paperId), specialId: specialId, slotTargets: slotTargets });
                });
            });
            if (!branches.length) continue;

            setStatus('查找中 ' + (index + 1) + '/' + papers.length + '：' + (paper.name || paperId) + '（' + props.length + ' 个属性）');
            setProgress(index, papers.length);

            var result = await EquipmentAutoOptimizer.simulateEquipmentRoutes({
                data: EQUIP_DATA,
                initialMakeState: JSON.parse(JSON.stringify(makeRnd)),
                branches: branches,
                targetProps: props,
                options: { craftCount: craftLimit, refineCount: refineCount, refineLianjinBudget: 0 },
                bridge: {
                    getMakeState: function () { return wasmMakeGetState(); },
                    setMakeState: function (next) {
                        if (!wasmMakeSetState(next)) throw new Error('原始打造状态恢复失败');
                        return true;
                    },
                    makePreview: function (request, count) { return wasmMakePreview(request, count); },
                    makePreviewAsync: (request,count,cancel) => wasmMakePreviewAsync(request,count,cancel),
                    xilianPlan: function (equipArg, accepts) { return wasmXilianPlan(equipArg, accepts); },
                },
                shouldCancel: function () { return false; },
                onProgress: function () { },
            });

            (result && result.candidates || []).forEach(function (candidate) {
                if (Number(candidate.craftIndex) > craftLimit) return;
                (candidate.refinements || []).forEach(function (refinement) {
                    var total = Number(refinement.total);
                    if (!Number.isFinite(total) || total <= 0) return;
                    var lianjin = equipAutoSweepLianjin(candidate, refinement);
                    if (!(lianjin <= lianjinLimit)) return;
                    var rating = equipAutoRefinementRating(candidate, refinement);
                    /* 按用户选的品质下限过滤 */
                    if (!rating || Number(rating.roundedPercent) < minQuality) return;
                    found.push({
                        paperId: paperId,
                        paperName: candidate.paperName || paper.name || paperId,
                        npc: candidate.craftsmanName || candidate.location || '—',
                        craftIndex: candidate.craftIndex,
                        prop: String(refinement.prop),
                        value: total,
                        lianjin: lianjin,
                        percent: rating.percent,
                        quality: rating.label,
                        qualityKey: rating.key,
                        props: equipAutoSweepProps(candidate),
                        region: equipAutoSweepRegion(candidate),
                        detailCandidate: candidate,
                        detailRefinement: refinement,
                    });
                });
            });
        }

        /* 把自己的收藏按同一口径也列出来，避免「我明明有这件」却查不到 */
        try {
            var favs = JSON.parse(localStorage.getItem('yyjh_auto_favs_v1') || '[]');
            favs.forEach(function (item) {
                try {
                if (!equipAutoSweepFavoriteMatches(item, papers, allPapers)) return;
                (item.refinements || []).forEach(function (refinement) {
                    var prop = String(refinement.prop || '');
                    if (!prop || !chosenPropSet.has(prop)) return;
                    var total = Number(refinement.total);
                    if (!Number.isFinite(total) || total <= 0) return;
                    var lianjin = equipAutoSweepLianjin(item, refinement);
                    if (!(lianjin <= lianjinLimit)) return;
                    var rating = equipAutoRefinementRating(item, refinement);
                    if (!rating || Number(rating.roundedPercent) < minQuality) return;
                    found.push({
                        paperId: 'my-favorites',
                        paperName: '我的收藏 · ' + (item.equipName || item.name || ''),
                        npc: item.craftsmanName || item.location || '—',
                        craftIndex: item.craftIndex,
                        prop: prop,
                        value: total,
                        lianjin: lianjin,
                        percent: rating.percent,
                        quality: rating.label,
                        qualityKey: rating.key,
                        props: (function () {
                            try { return equipAutoSweepProps(item); } catch (e) { return Object.keys(EQUIP_DATA.propNames || {}); }
                        })(),
                        region: (function () {
                            try { return equipAutoSweepRegion(item); } catch (e) { return []; }
                        })(),
                        mine: true,
                        detailCandidate: item,
                        detailRefinement: refinement,
                    });
                });
                } catch (e) { }
            });
        } catch (error) { }

        if (!found.length) {
            setStatus('没有符合条件的装备（' + craftLimit + ' 次内、单属性路线连金泥总消耗 ≤' + lianjinLimit + '、品质 ≥ ' + qualityLabel + '）。');
            return;
        }
        /* 符合条件的全部展示，不再按属性截前三 */
        /* 排序：先按图纸，再按属性按钮的顺序，最后按数值从高到低 */
        found.sort(function (a, b) {
            if (a.paperId !== b.paperId) return a.paperId < b.paperId ? -1 : 1;
            var rankA = equipAutoSweepPropRank(a.prop);
            var rankB = equipAutoSweepPropRank(b.prop);
            if (rankA !== rankB) return rankA - rankB;
            if (a.prop !== b.prop) return a.prop < b.prop ? -1 : 1;
            return b.value - a.value;
        });
        setStatus('找到 ' + found.length + ' 件。');
        renderEquipAutoSweepResults(found);
    } catch (error) {
        setStatus('查找失败：' + (error && error.message ? error.message : error));
    } finally {
        setProgress(papers.length, papers.length);
        equipAutoSweepRunning = false;
        if (paperFieldset) paperFieldset.disabled = false;
        if (button) { button.disabled = false; button.textContent = '一键查找'; }
    }
}

var equipAutoSweepDetailRows = [];
var equipAutoSweepLastList = [];
function renderEquipAutoSweepResults(list) {
    var box = document.getElementById('equipAutoSweepResults');
    if (!box) return;
    equipAutoSweepLastList = list;
    equipAutoSweepDetailRows = [];
    var byPaper = new Map();
    list.forEach(function (item) {
        if (!byPaper.has(item.paperId)) byPaper.set(item.paperId, new Map());
        var byProp = byPaper.get(item.paperId);
        if (!byProp.has(item.prop)) byProp.set(item.prop, []);
        byProp.get(item.prop).push(item);
    });
    var html = '';
    byPaper.forEach(function (byProp, paperId) {
        var paperName = paperId === 'my-favorites'
            ? '我的收藏'
            : ((EQUIP_DATA.papers[paperId] || {}).name || paperId);
        html += '<div class="equip-auto-sweep-group"><h4>' + paperName + '</h4>';
        byProp.forEach(function (items, prop) {
            var propName = EQUIP_DATA.propNames[prop] || prop;
            html += '<div class="equip-auto-sweep-sub"><span class="equip-auto-sweep-sub-label">' + propName + '</span>'
                + '<table class="equip-auto-sweep-table"><thead><tr>'
                + '<th>NPC</th><th>第几次</th><th>地区附加</th><th>' + propName + '</th><th>连金泥总消耗</th><th>品质</th>'
                + '</tr></thead><tbody>';
            items.forEach(function (item) {
                const detailIndex = equipAutoSweepDetailRows.push(item) - 1;
                html += '<tr tabindex="0" role="button" aria-label="장비 상세 정보 보기" data-sweep-item="' + detailIndex + '">'
                    + '<td>' + item.npc + '</td>'
                    + '<td>' + item.craftIndex + '</td>'
                    + '<td>' + item.region + '</td>'
                    + '<td>' + equipAutoFormatPropValue(item.prop, item.value) + '</td>'
                    + '<td>' + item.lianjin + '</td>'
                    + '<td class="q-' + item.qualityKey + '">' + item.quality + ' ' + Math.round(item.percent) + '%</td>'
                    + '</tr>';
            });
            html += '</tbody></table></div>';
        });
        html += '</div>';
    });
    box.innerHTML = html;
    if (!box.dataset.sweepDetailBound) {
        box.dataset.sweepDetailBound = '1';
        box.addEventListener('click', function(event) {
            const back = event.target.closest('[data-sweep-back]');
            if (back) { renderEquipAutoSweepResults(equipAutoSweepLastList);return; }
            if (event.target.closest('[data-refine-id],[data-mang-id],[data-forge-id],[data-region-id],[data-fav-id]')) {
                handleEquipAutoFavoriteClick(event);return;
            }
            const row = event.target.closest('[data-sweep-item]');
            if (!row) return;
            const picked = equipAutoSweepDetailRows[Number(row.dataset.sweepItem)];
            if (!picked || !picked.detailCandidate || !picked.detailRefinement) return;
            const source = picked.detailCandidate;
            const detail = Object.assign({}, source, {
                refinements: [picked.detailRefinement], allRefinements: true,
                region: Array.isArray(source.region) ? source.region : [],
                exts: Array.isArray(source.exts) ? source.exts : [],
                special: Array.isArray(source.special) ? source.special : []
            });
            equipAutoComboActive = false;
            equipAutoResultPropFilter = String(picked.prop);
            equipAutoLastResult = {candidates: [detail]};
            try {
                let card = equipAutoCandidateHtml(detail, {forge: true, refine: true});
                // Show mangjeong for quick-search candidates even if no first
                // special material was selected during crafting.
                if (!detail.canSimulateSpecialAttach) {
                    const mangId=escapeAiHtml(String(detail.id));
                    card=card.replace('<span class="equip-auto-actions-scroll">',
                        '<span class="equip-auto-actions-scroll"><button type="button" class="equip-auto-mang" data-mang-id="'+mangId+'">망정 보기</button>');
                }
                card = card.replace('<details class="equip-auto-candidate', '<details open class="equip-auto-candidate');
                box.innerHTML = '<button type="button" class="btn" data-sweep-back>← 빠른 조회 목록으로</button>'
                    + '<p class="meta-text">선택한 정련 능력치: ' + escapeAiHtml(equipAutoPropertyLabel(picked.prop))
                    + ' · 이 능력치의 독립 정련 계획과 승련·정련 소모량을 표시합니다.</p>' + card;
                box.scrollIntoView({block: 'start', behavior: 'smooth'});
            } catch(error) {
                box.innerHTML = '<button type="button" class="btn" data-sweep-back>← 목록으로</button><p role="alert">상세 조회 실패: '
                    + escapeAiHtml(error?.message || String(error)) + '</p>';
            }
        });
        box.addEventListener('keydown', function(event) {
            if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-sweep-item]')) {
                event.preventDefault();event.target.click();
            }
        });
    }
}

async function runEquipAutoSimulation() {
    if (equipAutoRunning) return;
    const validation = validateEquipAutoSelection();
    if (!validation.valid) return;
    equipAutoInitialMakeState = JSON.parse(JSON.stringify(validation.makeRnd));
    equipAutoRunning = true;
    equipAutoCancelRequested = false;
    setEquipAutoInputsDisabled(true);
    const runToken = ++equipAutoRunToken;
    const predict = document.getElementById('btnAutoEquipPredict');
    const cancel = document.getElementById('btnAutoEquipCancel');
    const results = document.getElementById('autoEquipResults');
    if (predict) {
        predict.disabled = true;
        predict.textContent = '正在计算装备路线…';
    }
    if (cancel) {
        cancel.hidden = false;
        cancel.disabled = false;
        cancel.textContent = '取消计算';
    }
    if (results) results.innerHTML = '<div class="ai-result-empty">正在按独立存档分支计算打造与精炼结果…</div>';
    renderEquipAutoProgress({ phase: 'craft', done: 0, total: validation.branches.length, message: '正在保存原始打造状态' });
    try {
        const result = await EquipmentAutoOptimizer.simulateEquipmentRoutes({
            data: EQUIP_DATA,
            initialMakeState: validation.makeRnd,
            branches: validation.branches,
            targetProps: EquipmentAutoOptimizer.TARGET_PROPERTIES.slice(),
            options: {
                craftCount: clampEquipAutoNumber('autoEquipCraftCount', 1, 5000, 100),
                refineCount: clampEquipAutoNumber('autoEquipRefineCount', 1, 2000, 200),
                refineLianjinBudget: 0,
                analyzeAll: true,
                includeBlue: !!document.getElementById('autoEquipIncludeBlue')?.checked,
            },
            bridge: {
                getMakeState: () => wasmMakeGetState(),
                setMakeState: next => {
                    if (!wasmMakeSetState(next)) throw new Error('原始打造状态恢复失败');
                    return true;
                },
                makePreview: (request, count) => wasmMakePreview(request, count),
                makePreviewAsync: (request,count,cancel) => wasmMakePreviewAsync(request,count,cancel),
                xilianPlan: (equip, accepts) => wasmXilianPlan(equip, accepts),
            },
            shouldCancel: () => equipAutoCancelRequested || runToken !== equipAutoRunToken,
            onProgress: progress => {
                if (runToken === equipAutoRunToken) renderEquipAutoProgress(progress);
            },
        });
        if (runToken !== equipAutoRunToken) return;
        if (result.cancelled) {
            if (results) results.innerHTML = '<div class="ai-result-empty">装备计算已取消，原始打造状态已恢复，页面模拟状态未改变。</div>';
            const progress = document.getElementById('autoEquipProgress');
            if (progress) progress.hidden = true;
            return;
        }
        renderEquipAutoProgress({ phase: 'refine', done: 1, total: 1, message: '打造与精炼分析完成' });
        renderEquipAutoResults(result);
    } catch (error) {
        console.error('装备自动模拟失败:', error);
        if (runToken === equipAutoRunToken && results) {
            results.innerHTML = `<div class="ai-result-error">计算失败：${escapeAiHtml(error?.message || error)}</div>`;
        }
        const progress = document.getElementById('autoEquipProgress');
        if (progress) progress.hidden = true;
    } finally {
        if (runToken === equipAutoRunToken) {
            equipAutoRunning = false;
            setEquipAutoInputsDisabled(false);
            if (predict) {
                predict.disabled = false;
                predict.textContent = '重新装备自动模拟';
            }
            if (cancel) cancel.hidden = true;
        }
    }
}

function cancelEquipAutoSimulation() {
    if (!equipAutoRunning) return;
    equipAutoCancelRequested = true;
    const button = document.getElementById('btnAutoEquipCancel');
    const text = document.getElementById('autoEquipProgressText');
    if (button) {
        button.disabled = true;
        button.textContent = '正在停止…';
    }
    if (text) text.textContent = '当前批次结束后停止并恢复原始打造状态…';
}

function jianwangAutoModule() {
    return typeof JianwangAutoOptimizer !== 'undefined' ? JianwangAutoOptimizer : null;
}

function jianwangAutoRouteForId(id) {
    const value = Number(id);
    if (value >= 5710 && value <= 5713) return value;
    if (value >= 5714 && value <= 5717) return value - 4;
    return 0;
}

function jianwangAutoSelectedSword() {
    const select = document.getElementById('autoJianwangStartSword');
    if (!select || !select.value || select.value === '__provider__') return null;
    return jianwangAutoSwords.find(sword => sword.key === select.value) || null;
}

function invalidateJianwangAutoPrediction(message) {
    jianwangAutoLastResult = null;
    if (jianwangAutoRunning) jianwangAutoCancelRequested = true;
    const results = document.getElementById('autoJianwangResults');
    if (results) results.innerHTML = `<div class="ai-result-empty">${escapeAiHtml(message || '配置已变化，请重新开始剑王阁自动模拟。')}</div>`;
    if (!jianwangAutoRunning) {
        const progress = document.getElementById('autoJianwangProgress');
        if (progress) progress.hidden = true;
    }
}

function refreshJianwangAutoTargetProps(preserveSelection = true) {
    const optimizer = jianwangAutoModule();
    const routeSelect = document.getElementById('autoJianwangRoute');
    const propSelect = document.getElementById('autoJianwangTargetProp');
    if (!optimizer || !routeSelect || !propSelect || typeof EQUIP_DATA === 'undefined') return;
    const previous = preserveSelection ? propSelect.value : '';
    const props = optimizer.targetPropertiesForRoute(EQUIP_DATA, Number(routeSelect.value));
    propSelect.innerHTML = '';
    if (!props.length) {
        propSelect.appendChild(new Option('先选择镇派路线', ''));
        propSelect.disabled = true;
        return;
    }
    props.forEach(prop => propSelect.appendChild(new Option(EQUIP_DATA.propNames?.[prop] || prop, prop)));
    propSelect.disabled = false;
    propSelect.value = props.includes(previous) ? previous : props[0];
}

function updateJianwangAutoStartHint() {
    const hint = document.getElementById('autoJianwangStartHint');
    const message = document.getElementById('autoJianwangSelectionMessage');
    const routeId = Number(document.getElementById('autoJianwangRoute')?.value || 0);
    const optimizer = jianwangAutoModule();
    if (!hint || !optimizer) return;
    const sword = jianwangAutoSelectedSword();
    const startSelect = document.getElementById('autoJianwangStartSword');
    if (!sword) {
        if (startSelect?.value === '__provider__' && optimizer.hasFirstSwordProvider()) {
            hint.textContent = '将由已启用的首剑生成接口提供起始剑，再复用同一套升阶、保留、重铸与碎剑搜索。';
            if (message) {
                message.textContent = '';
                message.classList.remove('is-error');
            }
            return;
        }
        hint.textContent = '当前没有可用的剑王阁实物；首剑生成接口已预留，但本版本未启用，也不会猜测第一把剑的序列。';
        if (message) {
            message.textContent = '请先导入含剑王阁实物的存档。';
            message.classList.add('is-error');
        }
        return;
    }
    if (message) {
        message.textContent = '';
        message.classList.remove('is-error');
    }
    const id = Number(sword.id);
    if (id <= 5709) {
        hint.textContent = `从${optimizer.stageName(EQUIP_DATA, sword)}开始，按所选路线逐级升至90级；每一步已有目标词条时都会自动保留。`;
        return;
    }
    if (id >= 5714 && id <= 5717) {
        hint.textContent = '起始实物为100级神兵：直接碎神兵并生成下一把60级剑胚，再按所选路线进入搜索。';
        return;
    }
    const currentRoute = jianwangAutoRouteForId(id);
    if (routeId && currentRoute === routeId) {
        const counts = optimizer.extractReforgeCounts(state.saveData || {});
        const used = Number(counts[String(routeId)] || 0);
        hint.textContent = `起始实物与所选路线一致：先从当前进度继续剩余 ${Math.max(0, optimizer.JIANWANG_REFORGE_LIMIT - used)} 次90级重铸；仍未达成才碎剑进入下一把。`;
    } else {
        hint.textContent = '起始90级实物与所选路线不同：不会消耗这把剑的重铸次数，直接碎剑后从下一把60级剑胚进入所选路线。';
    }
}

function refreshJianwangAutoSwords(preserveSelection = true) {
    const optimizer = jianwangAutoModule();
    const select = document.getElementById('autoJianwangStartSword');
    if (!optimizer || !select || typeof EQUIP_DATA === 'undefined') return;
    const previous = preserveSelection ? select.value : '';
    jianwangAutoSwords = optimizer.collectSwords(state.saveData, EQUIP_DATA);
    select.innerHTML = '';
    if (jianwangAutoSwords.length) {
        jianwangAutoSwords.forEach(sword => select.appendChild(new Option(optimizer.swordLabel(EQUIP_DATA, sword), sword.key)));
        select.disabled = false;
        select.value = jianwangAutoSwords.some(sword => sword.key === previous) ? previous : jianwangAutoSwords[0].key;
    } else if (optimizer.hasFirstSwordProvider()) {
        select.appendChild(new Option('首剑生成接口', '__provider__'));
        select.disabled = false;
        select.value = '__provider__';
    } else {
        select.appendChild(new Option('暂无剑王阁实物', ''));
        select.disabled = true;
    }
    updateJianwangAutoStartHint();
}

function initializeJianwangAutoControls() {
    const optimizer = jianwangAutoModule();
    const routeSelect = document.getElementById('autoJianwangRoute');
    if (!optimizer || !routeSelect || typeof EQUIP_DATA === 'undefined') return;
    routeSelect.innerHTML = '';
    optimizer.routeOptions(EQUIP_DATA).forEach(route => routeSelect.appendChild(new Option(route.name, String(route.id))));
    if (routeSelect.options.length) routeSelect.value = routeSelect.options[0].value;
    refreshJianwangAutoTargetProps(false);
    refreshJianwangAutoSwords(false);
    const attachHost = document.getElementById('autoJianwangResults');
    if (attachHost && !attachHost.dataset.attachBound) {
        attachHost.dataset.attachBound = '1';
        attachHost.addEventListener('click', function (event) {
            const button = event.target.closest('[data-jw-attach-run]');
            if (!button) return;
            renderJianwangAttachResult(button.getAttribute('data-jw-attach-run'));
        });
    }
}

function setJianwangAutoInputsDisabled(disabled) {
    ['autoJianwangStartSword', 'autoJianwangRoute', 'autoJianwangTargetProp', 'autoJianwangTargetCount', 'autoJianwangMaxSwords'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = !!disabled || (id === 'autoJianwangStartSword' && !jianwangAutoSwords.length && !jianwangAutoModule()?.hasFirstSwordProvider());
    });
}

function renderJianwangAutoProgress(progress) {
    const panel = document.getElementById('autoJianwangProgress');
    const text = document.getElementById('autoJianwangProgressText');
    const percent = document.getElementById('autoJianwangProgressPercent');
    const fill = document.getElementById('autoJianwangProgressFill');
    if (!panel) return;
    const total = Math.max(1, Number(progress?.total || 1));
    const done = Math.max(0, Number(progress?.done || 0));
    const value = Math.max(0, Math.min(100, Math.round(done / total * 100)));
    panel.hidden = false;
    if (text) text.textContent = progress?.message || '正在搜索…';
    if (percent) percent.textContent = `${value}%`;
    if (fill) fill.style.width = `${value}%`;
}

function jianwangAutoFormatExt(ext) {
    if (!ext) return '';
    const label = EQUIP_DATA?.propNames?.[ext.prop] || ext.prop || '未知词条';
    return `${escapeAiHtml(label)}+${escapeAiHtml(equipAutoFormatPropValue(ext.prop, ext.value))}`;
}

function jianwangAutoFormatExts(exts) {
    if (!Array.isArray(exts) || !exts.length) return '无';
    return exts.slice(0, 4).map(jianwangAutoFormatExt).join('、');
}

function jianwangAutoStepLabel(step) {
    if (step.type === 'blank') return `碎剑后生成${step.toName || '60级剑胚'}`;
    if (step.type === 'reforge') return `第 ${Number(step.reforgeAttempt || 0)} 次重铸`;
    return `${step.fromName || step.fromId} → ${step.toName || step.toId}`;
}

function jianwangMaterialName(itemId) {
    try {
        if (typeof ITEM_NAMES !== 'undefined' && ITEM_NAMES[String(itemId)]) return ITEM_NAMES[String(itemId)];
        if (typeof ITEM_NAMES !== 'undefined' && ITEM_NAMES[Number(itemId)]) return ITEM_NAMES[Number(itemId)];
    } catch (error) { /* 忽略 */ }
    return `物品 ${itemId}`;
}

function jianwangResourcesHtml(resources) {
    if (!resources) return '';
    const netEntries = Object.entries(resources.netMaterials || {}).filter(([, count]) => Number(count) > 0);
    const spentEntries = Object.entries(resources.spent || {}).filter(([id]) => !netEntries.some(([netId]) => netId === id));
    const netRows = netEntries.map(([id, count]) => {
        const returned = Number(resources.returned?.[id]) || 0;
        const spent = Number(resources.spent?.[id]) || 0;
        return `<tr><td>${escapeAiHtml(jianwangMaterialName(id))}</td><td>${spent.toLocaleString()}</td><td>${returned.toLocaleString()}</td><td><strong>${count.toLocaleString()}</strong></td></tr>`;
    }).join('');
    const onlyReturnedRows = Object.entries(resources.returned || {})
        .filter(([id, count]) => Number(count) > 0 && !(Number(resources.spent?.[id]) > 0))
        .map(([id, count]) => `<tr><td>${escapeAiHtml(jianwangMaterialName(id))}</td><td>0</td><td>${Number(count).toLocaleString()}</td><td><strong>−${Number(count).toLocaleString()}（盈余返还）</strong></td></tr>`)
        .join('');
    const bodyRows = netRows + onlyReturnedRows
        || '<tr><td colspan="4" class="empty-row">本路线未消耗材料</td></tr>';
    return `<details class="jianwang-resources-wrap" open>
        <summary><strong>材料与资源净需求</strong>（已扣除碎剑返还；用于备料核对，含前置成长与重铸周转请另留余量）</summary>
        <div class="jianwang-auto-metrics">
            <div><b>${Number(resources.contribution || 0).toLocaleString()}</b><span>贡献</span></div>
            <div><b>${Number(resources.swordIntent || 0).toLocaleString()}</b><span>剑意</span></div>
            <div><b>${Number(resources.qi || 0).toLocaleString()}</b><span>真气</span></div>
        </div>
        <table class="preview-table jianwang-resources-table">
            <thead><tr><th>材料</th><th>消耗</th><th>返还</th><th>净需求</th></tr></thead>
            <tbody>${bodyRows}</tbody>
        </table>
        <p class="meta-text">首次铸进材料与 100 级后的芒晶附加是两笔账：芒晶附加每次需芒晶×10 加所选材料×1，请按页面“芒晶洗练”单独核对；本表不包含常规打造材料与银两。</p>
    </details>`;
}

const JIANWANG_ATTACH_100_TARGETS = { 5710: 5714, 5711: 5715, 5712: 5716, 5713: 5717 };
const jianwangAttachEquips = {};

/* 自动搜到的剑是「90级 id + 铸后的种子」，芒晶附加要按 100 级实物算数值，
 * 所以先按 id 映射成 100 级形态（need_lv=100），再复用装备页那套
 * predictSpecialAttachSequence。 */
function jianwangAttachEquipFor(equip) {
    if (!equip) return null;
    const targetId = JIANWANG_ATTACH_100_TARGETS[Number(equip.id)];
    return Object.assign({}, equip, targetId ? { id: targetId, need_lv: 100 } : {});
}

function jianwangAttachPanelHtml(equip, key) {
    const normalized = jianwangAttachEquipFor(equip);
    if (!normalized || !Number.isSafeInteger(Number(normalized.MJSeed)) || Number(normalized.MJSeed) <= 0) {
        return '<p class="meta-text">这把剑缺少芒晶洗练进度，暂时无法推演附加属性。</p>';
    }
    jianwangAttachEquips[key] = normalized;
    const mod = typeof EquipmentAutoOptimizer !== 'undefined' ? EquipmentAutoOptimizer : null;
    const materials = mod && typeof mod.specialMaterialsForEquip === 'function' && typeof EQUIP_DATA !== 'undefined'
        ? mod.specialMaterialsForEquip(EQUIP_DATA, normalized) : [];
    if (!materials.length) return '<p class="meta-text">没有适用于这把剑的特殊材料。</p>';
    const options = materials.map(material => {
        const isDefault = String(material.name || '') === '龙骨' || Number(material.id) === 2021;
        return '<option value="' + material.id + '"' + (isDefault ? ' selected' : '') + '>' + escapeAiHtml(material.name) + '</option>';
    }).join('');
    return '<details class="jianwang-attach-wrap" open>'
        + '<summary><strong>100 级后 · 芒晶附加序列</strong>（每次 芒晶×10 + 所选材料×1；仅供查看，不推进游戏内进度）</summary>'
        + '<div class="jianwang-attach-controls">'
        + '<label>附加材料 <select data-jw-attach-material="' + key + '">' + options + '</select></label>'
        + '<label>预览次数 <input type="number" min="1" max="200" value="100" data-jw-attach-count="' + key + '"></label>'
        + '<button type="button" class="btn btn-ai-predict" data-jw-attach-run="' + key + '">生成附加序列</button>'
        + '</div>'
        + '<div class="jianwang-attach-result" data-jw-attach-result="' + key + '"></div>'
        + '</details>';
}

function renderJianwangAttachResult(key) {
    const equip = jianwangAttachEquips[key];
    const box = document.querySelector('[data-jw-attach-result="' + key + '"]');
    if (!box) return;
    if (!equip) { box.innerHTML = '<p class="meta-text">没有可用的剑实例。</p>'; return; }
    const select = document.querySelector('[data-jw-attach-material="' + key + '"]');
    const countInput = document.querySelector('[data-jw-attach-count="' + key + '"]');
    const materialId = Number(select && select.value);
    const count = Math.max(1, Math.min(200, Number(countInput && countInput.value) || 100));
    const mod = typeof EquipmentAutoOptimizer !== 'undefined' ? EquipmentAutoOptimizer : null;
    const material = typeof EQUIP_DATA !== 'undefined' ? EQUIP_DATA.special[String(materialId)] : null;
    if (!mod || !material) { box.innerHTML = '<p class="meta-text">材料数据不可用。</p>'; return; }
    let result;
    try {
        result = mod.predictSpecialAttachSequence(equip, material, count);
    } catch (error) {
        box.innerHTML = '<p class="meta-text">' + escapeAiHtml(error && error.message ? error.message : error) + '</p>';
        return;
    }
    const rows = result.items.map(item => {
        const best = result.bestIndexes.indexOf(item.index) >= 0;
        return '<tr class="' + (best ? 'jianwang-best' : '') + '">'
            + '<td>' + item.index + '</td>'
            + '<td>' + jianwangAutoFormatExt({ prop: item.prop, value: item.value }) + '</td>'
            + '<td>' + item.factor + '% · 区间 ' + item.valueMinimum + '–' + item.valueMaximum + '</td>'
            + '<td>' + item.seedBefore + ' → ' + item.seedAfter + '</td>'
            + '<td>' + (best ? '最高' : '') + '</td>'
            + '</tr>';
    }).join('');
    const maxima = result.maxima.filter(item => item.recommendedIndex != null)
        .map(item => jianwangAutoFormatExt({ prop: item.prop, value: item.value }) + '（第 ' + item.recommendedIndex + ' 次）')
        .join(' · ');
    box.innerHTML = '<p class="meta-text">' + escapeAiHtml(result.materialName) + ' · ' + count + ' 次 · 最高系数 '
        + result.bestFactor + '%（第 ' + result.bestIndexes.join('、') + ' 次）· 推荐停在第 ' + result.recommendedIndex + ' 次</p>'
        + '<table class="preview-table"><thead><tr><th>#</th><th>属性</th><th>品质</th><th>洗练序列编号</th><th></th></tr></thead><tbody>'
        + rows + '</tbody></table>'
        + (maxima ? '<p class="meta-text">各项最高：' + maxima + '</p>' : '');
}

function renderJianwangAutoResult(result) {
    const container = document.getElementById('autoJianwangResults');
    if (!container) return;
    if (!result) {
        container.innerHTML = '<div class="ai-result-empty">暂无结果。</div>';
        return;
    }
    if (result.status === 'cancelled') {
        const foundText = Number(result.successCount || 0) > 0 ? `、已找到 ${Number(result.successCount).toLocaleString()} 次三同结果` : '';
        container.innerHTML = `<div class="ai-result-empty">已取消计算。已模拟 ${Number(result.metrics?.newSwords || 0).toLocaleString()} 把新剑、重铸 ${Number(result.metrics?.reforges || 0).toLocaleString()} 次${foundText}。</div>`;
        return;
    }
    if (result.status === 'unreachable') {
        container.innerHTML = `<div class="ai-result-error">${escapeAiHtml(result.reason || '当前序列无法达成所选目标。')}</div>`;
        return;
    }
    if (result.status === 'multi-success') {
        const metrics = result.metrics || {};
        const matches = Array.isArray(result.matches) ? result.matches : [];
        const cards = matches.map((match, matchIndex) => {
            const swordText = match.startedFromCurrent ? '当前起始剑' : `第 ${Number(match.swordOrdinal || 0).toLocaleString()} 把新剑`;
            const path = Array.isArray(match.path) ? match.path : [];
            const steps = path.length ? path.map((step, index) => {
                const keepText = step.kept ? `保留 ${jianwangAutoFormatExt(step.kept)}` : '不保留';
                const seedText = step.type === 'blank'
                    ? `碎剑后已推进剑胚序列 · 新剑胚可继续成长或重铸`
                    : `重铸序列编号 ${Number(step.seedBefore || 0)} → ${Number(step.seedAfter || 0)}`;
                return `<li class="jianwang-auto-path-step">
                    <div class="jianwang-auto-step-head"><b>${index + 1}. ${escapeAiHtml(jianwangAutoStepLabel(step))}</b><span>${keepText}</span></div>
                    <div class="jianwang-auto-step-meta">${escapeAiHtml(seedText)}</div>
                    <div class="jianwang-auto-step-exts">${jianwangAutoFormatExts(step.exts)}</div>
                </li>`;
            }).join('') : '<li class="jianwang-auto-path-step"><div class="jianwang-auto-step-head"><b>起始状态已满足目标</b></div></li>';
            return `<details class="jianwang-auto-path-wrap" ${matchIndex === 0 ? 'open' : ''}>
                <summary><strong>第 ${matchIndex + 1} 次三同</strong> · ${escapeAiHtml(swordText)} · ${escapeAiHtml(match.finalAction || '')}</summary>
                <div class="jianwang-auto-final"><strong>词条</strong><span>${jianwangAutoFormatExts(match.finalEquip?.exts || [])}</span></div>
                ${jianwangAttachPanelHtml(match.finalEquip, 'm' + matchIndex)}
                <ol class="jianwang-auto-path">${steps}</ol>
            </details>`;
        }).join('');
        container.innerHTML = `<div class="jianwang-auto-summary">
            <div><span class="ai-route-strength">三同结果</span><strong>${escapeAiHtml(result.routeName || '')} · ${escapeAiHtml(result.targetName || '')}</strong></div>
            <p>${escapeAiHtml(result.reason || `找到 ${matches.length} 次三同词条结果`)}</p>
            <p class="jianwang-auto-start-line">起点：${escapeAiHtml(result.startSwordLabel || '')}</p>
        </div>
        <div class="jianwang-auto-metrics">
            <div><b>${Number(matches.length).toLocaleString()}</b><span>三同结果</span></div>
            <div><b>${Number(metrics.newSwords || 0).toLocaleString()}</b><span>新剑把数</span></div>
            <div><b>${Number(metrics.shatter90 || 0).toLocaleString()}</b><span>碎90</span></div>
            <div><b>${Number(metrics.shatter100 || 0).toLocaleString()}</b><span>碎100</span></div>
            <div><b>${Number(metrics.grows || 0).toLocaleString()}</b><span>升阶</span></div>
            <div><b>${Number(metrics.reforges || 0).toLocaleString()}</b><span>重铸</span></div>
            <div><b>${Number(metrics.keeps || 0).toLocaleString()}</b><span>保留</span></div>
        </div>
        <div class="jianwang-auto-path-wrap"><h3>三同命中记录（最多 ${Number(result.successLimit || 10)} 次）</h3></div>
        ${jianwangResourcesHtml(result.resources)}
        ${cards}`;
        return;
    }
    if (result.status === 'limit') {
        const metrics = result.metrics || {};
        container.innerHTML = `<div class="jianwang-auto-summary is-limit">
            <strong>${escapeAiHtml(result.reason || '已达到最大模拟次数')}</strong>
            <span>碎90：${Number(metrics.shatter90 || 0).toLocaleString()} · 碎100：${Number(metrics.shatter100 || 0).toLocaleString()} · 升阶：${Number(metrics.grows || 0).toLocaleString()} · 重铸：${Number(metrics.reforges || 0).toLocaleString()} · 保留：${Number(metrics.keeps || 0).toLocaleString()}</span>
        </div>`;
        return;
    }
    if (result.status !== 'success') {
        container.innerHTML = `<div class="ai-result-error">${escapeAiHtml(result.reason || '计算未返回可用结果。')}</div>`;
        return;
    }
    const metrics = result.metrics || {};
    const targetCount = Number(result.targetCount || 4) === 3 ? 3 : 4;
    const swordText = result.startedFromCurrent ? '当前起始剑' : `第 ${Number(result.swordOrdinal || 0).toLocaleString()} 把新剑`;
    const finalExts = jianwangAutoFormatExts(result.finalEquip?.exts || []);
    const path = Array.isArray(result.path) ? result.path : [];
    const steps = path.length ? path.map((step, index) => {
        const keepText = step.kept
            ? `保留 ${jianwangAutoFormatExt(step.kept)}`
            : '不保留';
        const seedText = step.type === 'blank'
            ? `碎剑后已推进剑胚序列 · 新剑胚可继续成长或重铸`
            : `重铸序列编号 ${Number(step.seedBefore || 0)} → ${Number(step.seedAfter || 0)}`;
        return `<li class="jianwang-auto-path-step">
            <div class="jianwang-auto-step-head"><b>${index + 1}. ${escapeAiHtml(jianwangAutoStepLabel(step))}</b><span>${keepText}</span></div>
            <div class="jianwang-auto-step-meta">${escapeAiHtml(seedText)}</div>
            <div class="jianwang-auto-step-exts">${jianwangAutoFormatExts(step.exts)}</div>
        </li>`;
    }).join('') : '<li class="jianwang-auto-path-step"><div class="jianwang-auto-step-head"><b>起始状态已满足目标</b></div></li>';
    container.innerHTML = `<div class="jianwang-auto-summary">
        <div><span class="ai-route-strength">找到结果</span><strong>${escapeAiHtml(result.routeName || '')} · ${targetCount}条${escapeAiHtml(result.targetName || '')}</strong></div>
        <p>${escapeAiHtml(swordText)}达成 · ${escapeAiHtml(result.finalAction || '')}</p>
        <p class="jianwang-auto-start-line">起点：${escapeAiHtml(result.startSwordLabel || '')}</p>
    </div>
    <div class="jianwang-auto-metrics">
        <div><b>${Number(metrics.newSwords || 0).toLocaleString()}</b><span>新剑把数</span></div>
        <div><b>${Number(metrics.shatter90 || 0).toLocaleString()}</b><span>碎90</span></div>
        <div><b>${Number(metrics.shatter100 || 0).toLocaleString()}</b><span>碎100</span></div>
        <div><b>${Number(metrics.grows || 0).toLocaleString()}</b><span>升阶</span></div>
        <div><b>${Number(metrics.reforges || 0).toLocaleString()}</b><span>重铸</span></div>
        <div><b>${Number(metrics.keeps || 0).toLocaleString()}</b><span>保留</span></div>
    </div>
    <div class="jianwang-auto-final"><strong>最终词条</strong><span>${finalExts}</span></div>
    ${jianwangResourcesHtml(result.resources)}
    ${jianwangAttachPanelHtml(result.finalEquip, 'single')}
    <div class="jianwang-auto-path-wrap">
        <h3>成功剑详细流程</h3>
        <ol class="jianwang-auto-path">${steps}</ol>
    </div>`;
}

function validateJianwangAutoSelection() {
    const optimizer = jianwangAutoModule();
    if (!optimizer) throw new Error('剑王阁自动模拟模块未加载');
    if (!state.saveData) throw new Error('请先导入存档');
    const routeId = Number(document.getElementById('autoJianwangRoute')?.value || 0);
    const targetProp = String(document.getElementById('autoJianwangTargetProp')?.value || '');
    const targetCount = Number(document.getElementById('autoJianwangTargetCount')?.value || 4);
    const maxSwords = clampAiNumber('autoJianwangMaxSwords', 1, optimizer.MAX_SIMULATED_SWORDS, 500);
    if (!routeId) throw new Error('请选择90级镇派路线');
    if (!targetProp) throw new Error('请选择目标词条');
    if (targetCount !== 3 && targetCount !== 4) throw new Error('请选择三同词条或四同词条');
    const select = document.getElementById('autoJianwangStartSword');
    if (!select?.value && !optimizer.hasFirstSwordProvider()) throw new Error('请选择起始剑');
    return {
        saveData: state.saveData,
        equipData: EQUIP_DATA,
        startSwordKey: select?.value === '__provider__' ? null : select?.value,
        routeId,
        targetProp,
        targetCount,
        maxSwords,
    };
}

async function runJianwangAutoSimulation() {
    if (jianwangAutoRunning) return;
    const message = document.getElementById('autoJianwangSelectionMessage');
    const predict = document.getElementById('btnAutoJianwangPredict');
    const cancel = document.getElementById('btnAutoJianwangCancel');
    let input;
    try {
        input = validateJianwangAutoSelection();
    } catch (error) {
        if (message) {
            message.textContent = playerError(error);
            message.classList.add('is-error');
        }
        return;
    }
    if (message) {
        message.textContent = '';
        message.classList.remove('is-error');
    }
    jianwangAutoRunning = true;
    jianwangAutoCancelRequested = false;
    const runToken = ++jianwangAutoRunToken;
    setJianwangAutoInputsDisabled(true);
    if (predict) {
        predict.disabled = true;
        predict.textContent = '正在搜索…';
    }
    if (cancel) {
        cancel.hidden = false;
        cancel.disabled = false;
        cancel.textContent = '取消计算';
    }
    renderJianwangAutoProgress({ done: 0, total: input.maxSwords, message: '正在检查起始剑并准备搜索…' });
    const results = document.getElementById('autoJianwangResults');
    if (results) results.innerHTML = '<div class="ai-result-empty">正在本地推演，失败剑只累计次数，不会全部保存在页面中。</div>';
    try {
        const result = await JianwangAutoOptimizer.searchAsync({
            ...input,
            saveVersion: state.saveVersion || '',
            saveChannel: state.saveChannel || '',
            batchSize: 40,
            shouldCancel: () => jianwangAutoCancelRequested || runToken !== jianwangAutoRunToken,
            onProgress: progress => {
                if (runToken === jianwangAutoRunToken) renderJianwangAutoProgress(progress);
            },
        });
        if (runToken !== jianwangAutoRunToken) return;
        jianwangAutoLastResult = result;
        renderJianwangAutoResult(result);
        const progress = document.getElementById('autoJianwangProgress');
        if (progress && result.status !== 'limit') progress.hidden = true;
    } catch (error) {
        console.error('剑王阁自动模拟失败:', error);
        if (runToken === jianwangAutoRunToken && results) {
            results.innerHTML = `<div class="ai-result-error">计算失败：${escapeAiHtml(error?.message || error)}</div>`;
        }
        const progress = document.getElementById('autoJianwangProgress');
        if (progress) progress.hidden = true;
    } finally {
        if (runToken === jianwangAutoRunToken) {
            jianwangAutoRunning = false;
            setJianwangAutoInputsDisabled(false);
            if (predict) {
                predict.disabled = false;
                predict.textContent = '重新剑王阁自动模拟';
            }
            if (cancel) {
                cancel.hidden = true;
                cancel.disabled = false;
                cancel.textContent = '取消计算';
            }
        }
    }
}

function cancelJianwangAutoSimulation() {
    if (!jianwangAutoRunning) return;
    jianwangAutoCancelRequested = true;
    const button = document.getElementById('btnAutoJianwangCancel');
    const text = document.getElementById('autoJianwangProgressText');
    if (button) {
        button.disabled = true;
        button.textContent = '正在停止…';
    }
    if (text) text.textContent = '当前剑计算结束后停止…';
}

window.refreshJianwangAutoStartSwords = refreshJianwangAutoSwords;

function applySimulatorView() {
    const isAutoView = window.YYJH_SIMULATOR_VIEW === 'auto'
        || new URLSearchParams(window.location.search).get('view') === 'auto';
    const root = document.documentElement;
    const pageTitle = document.getElementById('simulatorPageTitle');
    const pageSubtitle = document.getElementById('simulatorPageSubtitle');
    const washNav = document.getElementById('navWashSimulator');
    const autoNav = document.getElementById('navAutoSimulator');

    root.classList.toggle('auto-simulator-view', isAutoView);
    if (pageTitle) pageTitle.textContent = isAutoView ? '自动模拟' : '洗髓模拟器';
    if (pageSubtitle) pageSubtitle.textContent = isAutoView ? '原版游戏 · 本地存档模拟' : '原版游戏 · 天赋洗炼';
    document.title = '算不尽';

    [washNav, autoNav].forEach(link => {
        if (!link) return;
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });
    const activeNav = isAutoView ? autoNav : washNav;
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.setAttribute('aria-current', 'page');
    }
    return isAutoView;
}

async function initApp() {
    applySimulatorView();

    const impEl = document.getElementById('saveFileInput');
    if (impEl) impEl.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleSaveFileImport(e.target.files[0]);        }
    });

    if (typeof markNavTransition === 'function') {
        document.querySelectorAll('header a[href*=".html"]').forEach(a => {
            a.addEventListener('click', () => markNavTransition());
        });
    }

    const ok = await initWasm();
    if (!ok) {
        alert('WebAssembly 模块加载失败：洗髓/预测功能不可用（存档导入与解密不受影响）');
        return;
    }

    wasmInitEngine(TALENT_DATA, _buildZZDataForWasm());
    if (typeof EQUIP_DATA !== 'undefined' && !wasmMakeInitTables(EQUIP_DATA)) {
        console.error('装备表注入失败，装备自动模拟不可用');
        const message = document.getElementById('autoEquipSelectionMessage');
        if (message) {
            message.textContent = '装备表注入失败，装备自动模拟不可用。';
            message.classList.add('is-error');
        }
    }
    initializeEquipAutoControls();
    initializeJianwangAutoControls();

    const dlcCheck = document.getElementById('dlcModeCheck');
    if (dlcCheck) {
        dlcCheck.checked = !!state.dlcMode;
        dlcCheck.addEventListener('change', () => applyDlcMode(dlcCheck.checked));
    }

    const communityWash = new URLSearchParams(location.search).get('communityWash') === '1';
    if (communityWash) {
        window.__SBJ_COMMUNITY_WASH__ = true;
        document.body.classList.add('community-wash-embedded');
        const style=document.createElement('style');style.textContent='.community-wash-embedded .feature-heading,.community-wash-embedded #sbj-app-chrome,.community-wash-embedded .sbj-mobile-nav,.community-wash-embedded .sbj-bottom-nav{display:none!important}.community-wash-embedded .app-container{padding-top:0!important}.community-wash-embedded #saveRoleRow,.community-wash-embedded .wash-cloud-actions{display:none!important}';document.head.append(style);
        let sharedWash;try{sharedWash=window.parent.__SBJCommunityWashContext}catch(_){}
        if (!sharedWash?.role?.BornTalent || !Number.isFinite(sharedWash.salt)) {
            document.body.textContent='洗脉数据已失效，请返回看号重新打开。';return;
        }
        try {
            state.saveVersion=sharedWash.version||'';state.saveChannel=sharedWash.dlc?'国际服':'';
            if(typeof _applyDlcByPlatform==='function')_applyDlcByPlatform(sharedWash.dlc?'oversea':'');
            loadParsedSaveData({MainRole:sharedWash.role,Roles:[],Items:[],CenterID:sharedWash.salt,globalVariable:sharedWash.globalVars||{}},true);
            state.salt=sharedWash.salt;document.getElementById('saltInput').value=String(sharedWash.salt);
            state.hasBagPills=false;state.vip=1;state.vipConfirmed=false;syncVipControls();
            selectAutoWashRole('main:'+sharedWash.role.ID);pushStateToWasm();updateAll();renderAutoWashSaveGate();
        } catch(e){document.body.textContent='洗脉数据加载失败，请返回看号重新打开。';console.error(e);return;}
    }
    if (!communityWash && typeof loadShareStore === 'function') {
        const shared = loadShareStore();
        if (shared && shared.data) {
            try {
                state.saveVersion = shared.meta.version || '';
                state.saveChannel = shared.meta.channel || (shared.meta.platform === 'oversea' ? '国际服' : '');
                state.savePlatform = shared.meta.platform || '';
                state.saveFormat = shared.meta.format || 'json';
                state.saveColumns = shared.meta.columns || null;
                state.saveRow = shared.meta.row || null;
                if (typeof _applyDlcByPlatform === 'function') _applyDlcByPlatform(shared.meta.platform);
                loadParsedSaveData(shared.data, true);
            } catch (e) {
                console.warn('自动加载共享存档失败:', e);
            }
        }
    }

    document.getElementById('btnWashOnce').addEventListener('click', washOnce);
    document.getElementById('btnWash10').addEventListener('click', () => washMulti(10));
    document.getElementById('btnWash100').addEventListener('click', () => washMulti(100));
    document.getElementById('btnWashUntilGold').addEventListener('click', washUntilGold);
    document.getElementById('btnClearLog').addEventListener('click', clearLog);
    document.getElementById('btnManualRouteImage')?.addEventListener('click', exportManualRouteImage);
    const btnExport = document.getElementById('btnExportLog');
    if (btnExport) btnExport.addEventListener('click', exportWashHistory);

    document.getElementById('btnHistoryPrev')?.addEventListener('click', () => {
        if (historyPage > 1) {
            historyPage -= 1;
            renderHistoryPage();
        }
    });
    document.getElementById('btnHistoryNext')?.addEventListener('click', () => {
        historyPage += 1;
        renderHistoryPage();
    });
    document.getElementById('historyPageSize')?.addEventListener('change', () => {
        historyPage = 1;
        renderHistoryPage();
    });

    const btnWashCustom = document.getElementById('btnWashCustom');
    if (btnWashCustom) btnWashCustom.addEventListener('click', washCustom);
    document.getElementById('btnUndoWashCustom')?.addEventListener('click', undoCustomWash);
    updateCustomWashUndoButton();

    const customWashInput = document.getElementById('customWashInput');
    if (customWashInput) {
        customWashInput.addEventListener('input', (e) => {
            manualWashUndoFeedback('');
            updateCustomWashUndoButton();
        });
    }

    const btnExchangeSequenceFinder = document.getElementById('btnExchangeSequenceFinder');
    if (btnExchangeSequenceFinder) btnExchangeSequenceFinder.addEventListener('click', openExchangeSequenceFinderModal);

    const btnCloseExchangeSequenceModal = document.getElementById('btnCloseExchangeSequenceModal');
    if (btnCloseExchangeSequenceModal) btnCloseExchangeSequenceModal.addEventListener('click', closeExchangeSequenceFinderModal);

    const exchangeSequenceModal = document.getElementById('exchangeSequenceModal');
    if (exchangeSequenceModal) {
        exchangeSequenceModal.addEventListener('click', (event) => {
            if (event.target === exchangeSequenceModal) closeExchangeSequenceFinderModal();
        });
    }

    document.getElementById('exchangeSequenceRoleSelect')?.addEventListener('change', () => {
        clearExchangeCompare();
        void populateExchangeSequencePurples();
    });
    document.getElementById('exchangeSequencePurpleSelect')?.addEventListener('change', () => {
        clearExchangeCompare();
        clearExchangeSequenceResults();
        updateExchangeSequenceSelection();
    });
    document.getElementById('btnGenerateExchangeSequence')?.addEventListener('click', generateExchangeSequence);
    document.getElementById('btnCompareFirstPurple')?.addEventListener('click', compareFirstPurple);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && exchangeSequenceModal && !exchangeSequenceModal.hidden) {
            closeExchangeSequenceFinderModal();
        }
    });

    const btnAnalyzePurple = document.getElementById('btnAnalyzePurple');
    if (btnAnalyzePurple) btnAnalyzePurple.addEventListener('click', openPurpleAnalysisModal);

    const btnClosePurpleModal = document.getElementById('btnClosePurpleModal');
    if (btnClosePurpleModal) btnClosePurpleModal.addEventListener('click', closePurpleAnalysisModal);

    const purpleModal = document.getElementById('purpleModal');
    if (purpleModal) {
        purpleModal.addEventListener('click', (e) => {
            if (e.target === purpleModal) closePurpleAnalysisModal();
        });
    }

    const btnRefreshPurple = document.getElementById('btnRefreshPurpleAnalysis');
    if (btnRefreshPurple) {
        btnRefreshPurple.addEventListener('click', () => {
            invalidatePurpleCache();
            ensurePurpleSequenceCache({ force: true });
            paintPurpleForecastTable();
            renderExchangeAnalysisBlock();
        });
    }

    const btnLoadMore = document.getElementById('btnLoadMoreSequence');
    if (btnLoadMore) btnLoadMore.addEventListener('click', loadMoreSequence);

    const repaintFilters = () => paintPurpleForecastTable();
    const purpleSearch = document.getElementById('purpleSearchInput');
    if (purpleSearch) purpleSearch.addEventListener('input', repaintFilters);

    const filterEx = document.getElementById('filterExchangeOnly');
    if (filterEx) filterEx.addEventListener('change', repaintFilters);

    const filterPit = document.getElementById('filterPityOnly');
    if (filterPit) filterPit.addEventListener('change', repaintFilters);

    const btnFindNextConflict = document.getElementById('btnFindNextConflict');
    if (btnFindNextConflict) {
        btnFindNextConflict.addEventListener('click', () => {
            const after = parseInt(document.getElementById('nextConflictAfterWash')?.value || '0', 10);
            findAndShowNextConflict(Number.isNaN(after) ? 0 : after);
        });
    }
    const btnNextFromCurrent = document.getElementById('btnNextConflictFromCurrent');
    if (btnNextFromCurrent) {
        btnNextFromCurrent.addEventListener('click', () => {
            findAndShowNextConflict(state.totalTalentBars || 0);
        });
    }

    document.getElementById('aiTalentSearch')?.addEventListener('input', filterAiTalentChoices);
    document.getElementById('autoWashRoleSelect')?.addEventListener('change', event => selectAutoWashRole(event.target.value));
    document.getElementById('autoWashVipSelect')?.addEventListener('change', onVipChange);
    document.getElementById('btnWashOrigin')?.addEventListener('click', openWashOriginPreview);
    document.getElementById('autoWashExchangeStatus')?.addEventListener('click',event=>{
        const C=window.SBJCloud;if(!C)return;C.alert(event.currentTarget.dataset.detail||'选择人物后核对');
    });
    document.getElementById('btnAiPredict')?.addEventListener('click', () => runAiPrediction(false));
    document.getElementById('btnAiRestart')?.addEventListener('click', () => runAiPrediction(true));
    document.getElementById('btnAiCancel')?.addEventListener('click', cancelAiPrediction);
    document.getElementById('aiMaxTotalPills')?.addEventListener('input', event => {
        event.target.setCustomValidity('');
        invalidateAiPrediction();
    });
    document.getElementById('btnAutoWashMode')?.addEventListener('click', () => setAutoSimulatorMode('wash'));
    document.getElementById('btnAutoEquipMode')?.addEventListener('click', () => setAutoSimulatorMode('equip'));
    document.getElementById('btnAutoJianwangMode')?.addEventListener('click', () => setAutoSimulatorMode('jianwang'));
    document.getElementById('autoJianwangStartSword')?.addEventListener('change', () => {
        invalidateJianwangAutoPrediction('起始剑已变化，请重新开始剑王阁自动模拟。');
        updateJianwangAutoStartHint();
    });
    document.getElementById('autoJianwangRoute')?.addEventListener('change', () => {
        refreshJianwangAutoTargetProps(false);
        invalidateJianwangAutoPrediction('镇派路线已变化，请重新开始剑王阁自动模拟。');
        updateJianwangAutoStartHint();
    });
    document.getElementById('autoJianwangTargetProp')?.addEventListener('change', () => invalidateJianwangAutoPrediction('目标词条已变化，请重新开始剑王阁自动模拟。'));
    document.getElementById('autoJianwangTargetCount')?.addEventListener('change', () => invalidateJianwangAutoPrediction('同词条目标已变化，请重新开始剑王阁自动模拟。'));
    document.getElementById('autoJianwangMaxSwords')?.addEventListener('change', () => invalidateJianwangAutoPrediction('最大模拟次数已变化，请重新开始剑王阁自动模拟。'));
    document.getElementById('btnAutoJianwangPredict')?.addEventListener('click', runJianwangAutoSimulation);
    document.getElementById('btnAutoJianwangCancel')?.addEventListener('click', cancelJianwangAutoSimulation);
    document.getElementById('autoEquipLocationChoices')?.addEventListener('change', handleEquipAutoLocationClick);
    document.getElementById('autoEquipPaperChoices')?.addEventListener('change', handleEquipAutoPaperChange);
    document.getElementById('autoEquipPaperChoices')?.addEventListener('click', handleEquipAutoPaperClick);
    document.getElementById('autoEquipPaperSearch')?.addEventListener('input', filterEquipAutoPapers);
    document.getElementById('autoEquipIncludeBlue')?.addEventListener('change', () => invalidateEquipAutoPrediction('蓝装选项已变化，请重新开始装备自动模拟。'));
    document.getElementById('btnAutoEquipPredict')?.addEventListener('click', runEquipAutoSimulation);
    document.getElementById('btnAutoEquipCancel')?.addEventListener('click', cancelEquipAutoSimulation);
    document.getElementById('autoEquipResults')?.addEventListener('click', handleEquipAutoResultClick);
    document.getElementById('autoEquipResults')?.addEventListener('click', handleEquipAutoFavoriteClick);
    document.getElementById('autoEquipFavorites')?.addEventListener('click', handleEquipAutoFavoriteClick);
    document.getElementById('autoEquipResults')?.addEventListener('change', handleEquipAutoResultControlChange);

/* 从「自动推演」入口页带 mode 参数进入时，自动切到对应标签 */
(function applyAutoModeFromUrl() {
    var params = new URLSearchParams(location.search);
    var mode = window.SBJ_FEATURE_MODE || params.get('mode');
    if (!mode) return;
    var map = {
        equip: 'btnAutoEquipMode',
        jianwang: 'btnAutoJianwangMode',
        hengshan: 'btnAutoHengshanMode',
        wash: 'btnAutoWashMode'
    };
    var targetId = map[mode];
    if (!targetId) return;
    var run = function () {
        var button = document.getElementById(targetId);
        if (button) button.click();
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 250); });
    } else {
        setTimeout(run, 250);
    }
})();
    ['autoEquipCraftCount', 'autoEquipRefineCount'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => invalidateEquipAutoPrediction('模拟次数已变化，请重新开始装备自动模拟。'));
    });
    document.getElementById('autoEquipLocationSearch')?.addEventListener('input', event => {
        equipAutoLocationQuery = String(event.target.value || '');
        renderEquipAutoLocations();
    });
    document.querySelectorAll('.equip-auto-location-types [data-location-type]').forEach(button => {
        button.addEventListener('click', () => {
            equipAutoLocationType = String(button.getAttribute('data-location-type') || 'all');
            document.querySelectorAll('.equip-auto-location-types [data-location-type]').forEach(item => {
                item.classList.toggle('is-active', item === button);
            });
            renderEquipAutoLocations();
        });
    });
    document.getElementById('autoEquipAttachScan')?.addEventListener('change', () => {
        equipAutoAttachScanCache.clear();
        renderEquipAutoResultPage();
    });
    document.getElementById('btnEquipAutoSweep')?.addEventListener('click', () => { runEquipAutoSweep(); });
    try { renderEquipAutoSweepProps(); renderEquipAutoSweepPaperPicker(); } catch (error) { }
    (function bindSweepBlankCollapse() {
        var card = document.getElementById('autoEquipSweepCard');
        var body = document.getElementById('equipAutoSweepBody');
        if (!card) return;
        card.addEventListener('click', function (event) {
            /* 点卡片空白（内边距）或内容区空白处就收起；点控件不触发 */
            if (event.target === card || event.target === body) card.open = false;
        });
    })();
    (function syncSweepCardVisibility() {
        var card = document.getElementById('autoEquipSweepCard');
        var panel = document.getElementById('autoEquipModePanel');
        if (!card || !panel) return;
        function sync() { card.hidden = panel.hidden; }
        try { new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['hidden'] }); } catch (error) { }
        sync();
    })();
    document.getElementById('autoEquipAttachLevel')?.addEventListener('change', () => {
        equipAutoAttachScanCache.clear();
        renderEquipAutoResultPage();
    });

    document.getElementById('modeSelect').addEventListener('change', onModeChange);
    document.getElementById('seedInput').addEventListener('change', onSeedChange);
    const luckSeedEl = document.getElementById('luckSeedInput');
    if (luckSeedEl) luckSeedEl.addEventListener('change', onLuckSeedChange);
    document.getElementById('roleIdInput').addEventListener('change', onRoleIdChange);
    document.getElementById('saltInput').addEventListener('change', onSaltChange);

    document.getElementById('saveRoleSelect').addEventListener('change', (e) => {
        selectRoleFromSave(e.target.value);
    });

    document.getElementById('zizhiSelect').addEventListener('change', onZizhiChange);
    document.getElementById('sexSelect').addEventListener('change', onSexChange);
    document.getElementById('vipSelect').addEventListener('change', onVipChange);
    document.getElementById('btnUpgradeZiZhi').addEventListener('click', upgradeZiZhi);

    renderTalents();
    renderAptitudePanel();
    renderStats();
    renderPityBar();
    renderCostInfo();
    syncVipControls();
    renderAiTalentChoices();
    renderAutoWashSaveGate();
    renderAiAlgorithmVersion();
    connectAiSearchManager();
}

document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('pagehide', () => { aiTargetPoolToken += 1; aiTargetPoolLoading = false; stopAiTargetPoolQuery(); });
window.addEventListener('pageshow', event => {
    if (event.persisted && wasmReady) { renderAiTalentChoices(); connectAiSearchManager(); }
});
setTimeout(function () { if (typeof prewarmSql === 'function') prewarmSql(); }, 200);

window.addEventListener('load', () => { const help=document.getElementById('btnWashHelp');if(help)help.onclick=()=>{const details=document.getElementById('washAlgorithmHelp');details.open=!details.open;help.setAttribute('aria-expanded',String(details.open));}; });
window.addEventListener('load', () => window.WashCloudRoutes?.mount({
    current() {
        const manager=getAiSearchManager(),snapshot=manager?.snapshot(),hash=window.WASH_ROUTE_WORKER_BUNDLE?.hash;
        if(!manager||!snapshot||snapshot.taskKey!==aiAttachedTaskKey)throw Error('请先选择已找到路线的人物和目标');
        return {input:manager.getInput(),snapshot,checkpoint:manager.resumable(snapshot.taskKey,hash),version:window.WASH_ROUTE_WORKER_BUNDLE.algorithmVersion};
    },
    async restore(payload) {
        const manager=await window.WashSearchManager.ready();
        if(manager.snapshot().status==='running')throw Error('请先停止当前查找，再导入云盘路线');
        if(payload.vip!==undefined&&payload.vip!==normalizeVipLevel(state.vip))throw Error('云盘路线与当前选择的游戏VIP不同，请先核对VIP等级后再导入；没有自动修改VIP');
        if(payload.algorithmVersion!==window.WASH_ROUTE_WORKER_BUNDLE.algorithmVersion)throw Error('这条路线使用旧版算法，请在对应版本核对或重新查找后保存');
        const started=Date.now();while(!(state.saveRoles||[]).length&&Date.now()-started<10000)await new Promise(r=>setTimeout(r,100));
        if(!(state.saveRoles||[]).some(entry=>entry.key===payload.roleKey))throw Error('请先导入包含该人物的原始存档，再读取这条云盘路线');
        selectAutoWashRole(payload.roleKey);
        aiSelectedTalentIds=payload.targetIds.map(Number);aiDefaultTargetsPending=false;renderAiTalentChoices();
        const budget=Number(payload.maxTotalPills);
        if(!Number.isSafeInteger(budget)||budget<0||payload.route.totalPills>budget)throw Error('云盘路线的耗丹上限无效');
        document.getElementById('aiMaxTotalPills').value=String(budget);
        const waiting=Date.now();while(aiTargetPoolLoading&&Date.now()-waiting<15000)await new Promise(r=>setTimeout(r,100));
        const validation=validateAiTargetSelection();if(!validation.valid)throw Error('目标脉或人物资料尚不可用，请确认当前存档后重试');
        const input=buildAiSearchInput(payload.targetIds,budget);
        if(await WashCloudRoutes.fingerprint(input,payload.algorithmVersion)!==payload.context)throw Error('当前人物起点与云盘路线不一致，请导入当时的原始存档；没有套用旧路线');
        manager.importCheckpoint(aiSearchTaskKey(input),window.WASH_ROUTE_WORKER_BUNDLE.hash,{route:payload.route,round:payload.round});
        await runAiPrediction(false);
    }
}));