/* 算不尽 · 恒山弟子页逻辑
 * 数据流：首页导入的共享存档 → core.js 收集弟子 → 内核推演。
 * 所有推进只改页面沙盒，导入存档保持只读。
 */
(function () {
    'use strict';

    var H = window.YYJHHengshan;
    var pickTargets = new Set(), batchRows = [], batchWorker = null, batchTimer = null;
    var $ = function (id) { return document.getElementById(id); };

    /* ---------------- 工具 ---------------- */

    function esc(v) {
        return String(v === null || v === undefined ? '' : v).replace(/[&<>'"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
        });
    }

    function cloneStudent(s) {
        return JSON.parse(JSON.stringify(s));
    }

    function talentName(id) {
        try { return H.talentName(Number(id)) || ('天赋 ' + id); }
        catch (e) { return '天赋 ' + id; }
    }

    function talentNames(ids) {
        return (ids || []).map(talentName).join('、') || '暂无';
    }

    function say(msg, isErr) {
        var el = $('hsMessage');
        el.textContent = msg || '';
        el.classList.toggle('is-error', !!isErr);
    }

    function sexText(s) {
        return Number(s.sex) === 1 ? '男' : Number(s.sex) === 2 ? '女' : '未知';
    }

    /* ---------------- 页签 ---------------- */

    function currentTab() {
        var active = document.querySelector('.hs-tabs button[aria-selected="true"]');
        return active ? active.getAttribute('data-tab') : 'manual';
    }

    function switchTab(name) {
        var hit = false;
        document.querySelectorAll('.hs-tabs button[data-tab]').forEach(function (btn) {
            var on = btn.getAttribute('data-tab') === name;
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on) hit = true;
        });
        ['manual', 'shop', 'auto'].forEach(function (t) {
            var panel = $('panel' + t.charAt(0).toUpperCase() + t.slice(1));
            if (panel) panel.hidden = t !== name;
        });
        return hit;
    }

    function initTabs() {
        document.querySelector('.hs-tabs').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-tab]');
            if (btn) switchTab(btn.getAttribute('data-tab'));
        });
        var want = new URLSearchParams(location.search).get('tab') || window.YYJH_HS_DEFAULT_TAB || '';
        if (want && switchTab(want)) return;
        switchTab('manual');
    }

    /* ---------------- 学生池 ---------------- */

    var enrolled = [];      // 在册弟子
    var candidates = [];    // 玉秀殿候选（当前批次）
    var candidatesInit = [];// 导入快照
    var shopState = null;   // 商店种子状态
    var shopStateInit = null;
    var shopContext = {};
    var backpack = new Map();
    var pool = [];          // 在册 + 背包，供推演选择
    var byKey = new Map();
    var current = null;     // 手动推演当前弟子
    var refreshHistory = []; // 手动页操作记录
    var chain = null;       // 最近一次批量推进结果
    var bagStorageKey = 'yyjh_hengshan_backpack_v1';
    var bagContext = '', bagRevision = '', bagPreferred = '', studentsReady = false;
    var bagHost = window;
    try { if (window.top.location.origin === location.origin) bagHost = window.top; } catch (_) { }

    function bagKeyOf(s) {
        return 'backpack:' + String(s.key) + ':' + Number(s.seed) + ':' + String(s.name);
    }

    function readBag() {
        var raw = null, memory = bagHost.__YYJHHengshanBag;
        if (memory && memory.fallback) return memory.raw;
        try { raw = sessionStorage.getItem(bagStorageKey); }
        catch (_) { raw = memory && memory.raw; }
        return raw;
    }

    function restoreBag() {
        var raw = readBag();
        if (raw === bagRevision) return false;
        bagRevision = raw;
        var saved;
        try { saved = JSON.parse(raw || 'null'); } catch (_) { }
        backpack.clear();bagPreferred = '';
        if (saved && saved.context === bagContext && Array.isArray(saved.students)) {
            saved.students.forEach(function (s) {
                if (!s || typeof s.key !== 'string' || !(Number(s.seed) > 0) || !Array.isArray(s.talents) || !s.talents.length) return;
                var copy = s.recruitPrepared ? cloneStudent(s) : H.prepareRecruit(s).state;copy.source = 'backpack';backpack.set(copy.key, copy);
            });
            bagPreferred = backpack.has(saved.preferred) ? saved.preferred : '';
        }
        return true;
    }

    function saveBag(preferred) {
        bagPreferred = backpack.has(preferred) ? preferred : '';
        var raw = JSON.stringify({ context: bagContext, students: Array.from(backpack.values()), preferred: bagPreferred });
        var fallback = false;
        try { sessionStorage.setItem(bagStorageKey, raw); } catch (_) { fallback = true; }
        bagRevision = raw;
        bagHost.__YYJHHengshanBag = { raw: raw, fallback: fallback };
        bagHost.dispatchEvent(new CustomEvent('yyjh-hengshan-backpack-change'));
        return !fallback;
    }

    // Cached manual/automatic pages share a tab-scoped sandbox. Only restore
    // against the exact archive identity and Hengshan snapshot, never the save.
    function syncBag() {
        if (!studentsReady || !restoreBag()) return;
        refreshStudentPool();
    }

    function refreshStudentPool(preferred) {
        var manualKey = $('studentSelect').value, autoKey = $('autoStudent').value;
        var previousAuto = autoStudent();
        rebuildPool();
        fillSelect($('studentSelect'), preferred || manualKey);
        fillSelect($('autoStudent'), preferred || autoKey);
        if (!current || String(current.key) !== $('studentSelect').value) selectStudent($('studentSelect').value);
        if (JSON.stringify(previousAuto) !== JSON.stringify(autoStudent())) resetAuto('弟子选择已变化，请重新开始自动推演。');
        renderShop();
    }

    function rebuildPool() {
        pool = enrolled.concat(Array.from(backpack.values()));
        byKey = new Map();
        pool.forEach(function (s) { byKey.set(String(s.key), s); });
        if (window.SBJHengshanJoint) {
            var available = candidatesInit.filter(s => !backpack.has(bagKeyOf(s)));
            window.SBJHengshanJoint.setRoster(pool.concat(available), jointArchive, bagContext);
        }
        var summary = $('autoPoolSummary');
        if (summary) summary.textContent = '在册 ' + enrolled.length + ' 人 · 推演背包 ' + backpack.size + ' 人。背包弟子从纳入时的状态开始推演，原存档不变。';
    }

    function fillSelect(sel, preferred) {
        sel.innerHTML = '';
        if (!pool.length) {
            sel.disabled = true;
            sel.appendChild(new Option('当前存档未识别到恒山弟子', ''));
            return;
        }
        sel.disabled = false;
        pool.forEach(function (s) {
            var tag = s.source === 'backpack' ? '背包' : '在册';
            sel.appendChild(new Option('[' + tag + '] ' + s.name + ' · ' + s.level + '级 · ' + talentNames(s.talents), s.key));
        });
        var keys = pool.map(function (s) { return String(s.key); });
        if (preferred && keys.indexOf(String(preferred)) >= 0) sel.value = String(preferred);
    }

    function pickStudent(sel) {
        var s = byKey.get(String(sel.value || ''));
        return s ? cloneStudent(s) : null;
    }

    /* ---------------- 弟子推演（手动） ---------------- */

    function renderStudent() {
        var has = !!current;
        $('studentState').hidden = !has;
        $('refreshCard').hidden = !has;
        $('unlockCard').hidden = !has;
        $('btnResetStudent').disabled = !has;
        if (!has) return;

        $('studentLevel').textContent = current.level + ' / 100';
        $('studentExp').textContent = formatCount4(Number(current.exp));

        $('studentTalents').innerHTML = current.talents.map(function (id, i) {
            return '<div class="hs-talent-item"><span>槽位 ' + (i + 1) + '</span><strong>' + esc(talentName(id)) + '</strong></div>';
        }).join('');

        var slotSel = $('refreshSlot');
        var prev = slotSel.value;
        slotSel.innerHTML = current.talents.map(function (id, i) {
            return '<option value="' + i + '">槽位 ' + (i + 1) + ' · ' + esc(talentName(id)) + '</option>';
        }).join('');
        if (Array.prototype.some.call(slotSel.options, function (o) { return o.value === prev; })) slotSel.value = prev;

        renderUnlockPreview();
        resetChain();
    }

    function renderUnlockPreview() {
        try {
            var preview = H.advanceDay({...cloneStudent(current), dailyExtraExp: 0}).action;
            $('studentDailyExp').textContent = formatCount4(current.level >= 100 ? 0 : preview.expGained);
            var miles = (preview.milestones || []).map(function (m) {
                return m.level + '级获得 ' + esc(talentName(m.id));
            }).join('；');
            $('unlockPreview').innerHTML = current.level >= 100 ? '弟子已满级，继续结算不会增加升级经验。' :
                '<strong>下次自然结算 +' + formatCount4(Number(preview.expGained)) + ' 经验 · 预计 ' + preview.levelAfter + ' 级</strong><br>' +
                '基础 +' + preview.dailyBaseExp + ' · 天赋加成 +' + (preview.expGained - preview.dailyBaseExp) +
                (miles ? '<br>下一步：' + miles : '');
        } catch (e) {
            $('studentDailyExp').textContent = '—';
            $('unlockPreview').textContent = '推演失败：' + e.message;
        }
    }

    function resetChain() {
        chain = null;
        $('refreshSummary').textContent = '设置次数后批量查看后续结果；点击任一行即可应用到该次推进。';
        $('refreshRows').innerHTML = '<tr><td colspan="4">尚未推演</td></tr>';
    }

    function renderHistory() {
        $('refreshHistoryCount').textContent = refreshHistory.length + ' 条';
        $('refreshHistoryRows').innerHTML = refreshHistory.length
            ? refreshHistory.map(function (h, i) {
                return '<tr><td>第 ' + (i + 1) + ' 次应用</td><td>槽位 ' + (h.slot + 1) + ' · ' + esc(h.replaced) + '</td><td>' + h.count + ' 次</td><td>' + esc(h.drawn) + '</td><td>' + esc(h.combo) + '</td></tr>';
            }).join('')
            : '<tr><td colspan="5">暂无操作记录</td></tr>';
    }

    function simulateRefresh() {
        if (!current) return;
        var slot = Number($('refreshSlot').value);
        var count = Math.max(1, Math.min(1000, Math.trunc(Number($('refreshCount').value) || 1)));
        $('refreshCount').value = count;
        try {
            chain = H.replacementChain(cloneStudent(current), slot, count);
            $('refreshRows').innerHTML = chain.steps.map(function (st) {
                return '<tr><td>第 ' + st.n + ' 次</td><td>' + esc(talentName(st.id)) + '</td><td>' + esc(talentNames(st.talents)) +
                    '</td><td><button class="hs-btn hs-apply-step" type="button" data-step="' + st.n + '">应用到此步</button></td></tr>';
            }).join('');
            $('refreshSummary').textContent = '保留 ' + talentNames(chain.keep) + '；共模拟 ' + chain.steps.length + ' 次，选择任一结果会推进并记录本次操作。';
        } catch (e) {
            chain = null;
            $('refreshSummary').textContent = '推演失败：' + e.message;
        }
    }

    function applyStep(n) {
        if (!current || !chain || !chain.steps) return;
        var step = chain.steps[n - 1];
        if (!step) return;
        var slot = Number($('refreshSlot').value);
        var replaced = current.talents[slot];
        var specials = (current.specials || []).filter(function (sp) {
            return Number(sp.id) !== Number(replaced) && Number(sp.id) !== Number(step.id);
        });
        specials.push({ id: Number(step.id), exp: 0 });
        refreshHistory.push({
            slot: slot, count: n,
            replaced: talentName(replaced),
            drawn: talentName(step.id),
            combo: talentNames(step.talents)
        });
        current.seed = Number(step.nextSeed);
        current.talents = step.talents.slice();
        current.specials = specials;
        renderStudent();
        renderHistory();
        say('已应用槽位 ' + (slot + 1) + ' 的第 ' + n + ' 次推进结果；导入存档未改变。', false);
    }

    function advanceDay() {
        if (!current) return;
        try {
            var wasFull = current.level >= 100;
            var out = H.advanceDay({...cloneStudent(current), dailyExtraExp: 0});
            current = Object.assign(current, out.state);
            renderStudent();
            say(wasFull ? '已结算，弟子保持满级。' : '自然经验 +' + formatCount4(out.action.expGained) +
                ' · 当前 ' + out.action.levelAfter + ' 级', false);
        } catch (e) {
            say('升级进度推演失败：' + e.message, true);
        }
    }

    function resetStudent() {
        var sel = $('studentSelect');
        selectStudent(sel ? sel.value : '');
        refreshHistory = [];
        renderHistory();
        say('已恢复这名弟子导入时的养成进度。', false);
    }

    function selectStudent(key) {
        current = pickStudent({ value: key });
        refreshHistory = [];
        renderStudent();
        renderHistory();
    }

    /* ---------------- 弟子商店 ---------------- */

    function studentCardHtml(s, action, label) {
        var b = s.born || {};
        return '<article class="hs-student-card"><header><div><strong>' + esc(s.name) + '</strong><span>' +
            esc(sexText(s)) + (s.birth ? ' · ' + esc(s.birth) : '') + '</span></div>' +
            '<button type="button" class="hs-btn" data-shop-action="' + action + '" data-student-key="' + esc(s.key) + '">' + label + '</button></header>' +
            '<dl><div><dt>臂力</dt><dd>' + Number(b.str || 0) + '</dd></div>' +
            '<div><dt>身法</dt><dd>' + Number(b.dex || 0) + '</dd></div>' +
            '<div><dt>根骨</dt><dd>' + Number(b.con || 0) + '</dd></div>' +
            '<div><dt>内息</dt><dd>' + Number(b.int || 0) + '</dd></div></dl>' +
            '<p>初始天赋：' + esc(talentNames(s.talents)) + '</p></article>';
    }

    function renderShop() {
        var refreshes = shopState ? Math.max(0, Number(shopState.pageRefreshes) || 0) : 0;
        $('shopStudentCount').textContent = candidates.length + ' 人';
        $('studentBagCount').textContent = backpack.size + ' 人';
        $('bagCard').hidden = backpack.size === 0;
        $('shopRefreshCount').textContent = refreshes + ' 次';
        $('btnShopRefresh').disabled = !shopState || !Number(shopState.seed);
        $('btnShopRefresh').textContent = refreshes ? '继续推进下一批' : '推演下一批';
        $('btnShopRestore').disabled = !refreshes;
        $('shopStudentCards').innerHTML = candidates.map(function (s) {
            var inBag = backpack.has(bagKeyOf(s));
            return studentCardHtml(s, inBag ? 'focus' : 'add', inBag ? '进入推演' : '纳入背包');
        }).join('') || '<p class="hs-note">当前存档没有可展示的玉秀殿候选；请先导入包含 TempStudent 的存档。</p>';
        $('studentBagCards').innerHTML = Array.from(backpack.values()).map(function (s) {
            return studentCardHtml(s, 'remove', '移出背包');
        }).join('');
    }

    function shopClick(ev) {
        var btn = ev.target.closest('[data-shop-action]');
        if (!btn) return;
        var key = String(btn.getAttribute('data-student-key'));
        var action = btn.getAttribute('data-shop-action');
        if (action === 'add') {
            var hit = candidates.find(function (s) { return String(s.key) === key; });
            if (hit) {
                var copy = H.prepareRecruit(hit).state;
                copy.source = 'backpack';
                copy.key = bagKeyOf(hit);
                backpack.set(copy.key, copy);
                refreshStudentPool(copy.key);
                var persisted = saveBag(copy.key);
                say('已将「' + copy.name + '」纳入推演背包，可在自动推演中选择；' + (persisted
                    ? '本次浏览切换页面或刷新后仍保留。'
                    : '浏览器未允许保存，当前页面间可共享；刷新后需要重新纳入。'), false);
            }
        } else if (action === 'focus') {
            var candidate = candidates.find(function (s) { return String(s.key) === key; });
            key = candidate ? bagKeyOf(candidate) : key;
            if (backpack.has(key)) {
                $('studentSelect').value = key;
                switchTab('manual');
                selectStudent(key);
                document.getElementById('studentState').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } else if (action === 'remove') {
            var gone = backpack.get(key);
            backpack.delete(key);
            refreshStudentPool();
            saveBag(bagPreferred === key ? '' : bagPreferred);
            say('已将「' + (gone ? gone.name : '弟子') + '」移出页面推演背包；导入存档未改变。', false);
        }
    }

    function shopNext() {
        if (!shopState || !Number(shopState.seed)) return;
        try {
            var out = H.shopRefresh({
                seed: shopState.seed,
                refreshes: shopState.refreshes,
                npc: shopState.npc || {}
            });
            candidates = (out.students || []).map(function (s) {
                // The kernel generates the candidate, while account time,
                // technology experience and cooldown belong to the archive.
                return Object.assign({}, s, shopContext, { source: 'shop' });
            });
            shopState = Object.assign({}, out.state || {}, {
                pageRefreshes: (Number(shopState.pageRefreshes) || 0) + 1
            });
            $('shopRefreshMessage').textContent = '已按当前商店状态推演出第 ' + shopState.pageRefreshes + ' 批候选；可继续招募推演，或恢复导入时的招募进度';
            renderShop();
        } catch (e) {
            $('shopRefreshMessage').textContent = '商店推演失败：' + (e.message || e);
        }
    }

    function shopRestore() {
        candidates = candidatesInit.map(cloneStudent);
        shopState = cloneStudent(shopStateInit);
        $('shopRefreshMessage').textContent = '已恢复导入存档中的商店批次；推演背包保持不变';
        renderShop();
    }

    /* ---------------- 自动推演 ---------------- */

    var CATEGORY = [
        { key: 'combat', label: '战斗类', ids: [408, 306, 324, 405, 342, 327, 360, 363, 312, 330, 309, 417, 411, 333, 396, 393, 390, 387, 381, 375, 378, 366, 414, 357, 336, 345, 315, 303, 372, 348, 351, 321, 300, 318, 384, 339, 88] },
        { key: 'dispatch', label: '派遣类', ids: [4, 10, 22, 16, 94, 28, 1, 7, 13, 25, 19, 34, 181, 103, 31, 202, 205, 208] },
        { key: 'commission', label: '委托类', ids: [58, 85, 70] },
        { key: 'utility', label: '功能类', ids: [100, 76, 37, 55, 166, 199, 184, 178] }
    ];
    var categoryOf = new Map();
    CATEGORY.forEach(function (g) { g.ids.forEach(function (id) { categoryOf.set(id, g.key); }); });
    var targets = new Set([199, 166]);  /* 默认勾选胆小鬼Ⅰ、天生福星Ⅰ */
    var autoResult = null;
    var autoTask = null;
    var autoRunId = 0;
    function formatCount4(value) { return String(Math.trunc(Number(value) || 0)).replace(/\B(?=(\d{4})+(?!\d))/g, ','); }

    function autoProgress() {
        var box = $('autoProgress');
        if (!box) {
            box = document.createElement('div');
            box.id = 'autoProgress';
            box.className = 'hs-auto-progress';
            box.hidden = true;
            box.innerHTML = '<div class="hs-auto-progress-heading"><strong id="autoProgressStatus" role="status" aria-live="polite"></strong><span id="autoProgressElapsed"></span></div>' +
                '<progress id="autoProgressBar" max="1" aria-label="恒山自动推演进度"></progress>' +
                '<div class="hs-auto-progress-actions"><span id="autoProgressDetail">正在准备推演资料…</span><button type="button" id="autoStop" class="hs-btn">停止推演</button></div>';
            $('autoResults').before(box);
            $('autoStop').onclick = function () { stopAuto('已停止推演，可以调整条件后重新开始。'); };
        }
        return box;
    }

    function stopAuto(message) {
        autoRunId += 1;
        $('btnAutoRun').disabled = false;
        $('btnAutoRun').textContent = '开始恒山自动推演';
        if (!autoTask) return;
        var task = autoTask;
        autoTask = null;
        clearInterval(task.timer);
        task.worker.terminate();
        $('btnAutoRun').disabled = false;
        $('btnAutoRun').textContent = '开始恒山自动推演';
        $('autoResults').removeAttribute('aria-busy');
        autoProgress().hidden = true;
        say(message || '推演条件已变化，请重新开始。', false);
        task.reject(new Error(message || '推演条件已变化，请重新开始。'));
    }

    function planAuto(student, selectedTargets, options) {
        return new Promise(function (resolve, reject) {
            var worker;
            try { worker = new Worker('/suanbujin/hengshan/auto-worker.js?v=20261105local4&rev=c0dce771da4c'); }
            catch (error) { reject(new Error('无法启动后台推演，请刷新页面后重试。')); return; }
            var started = Date.now();
            var task = { worker: worker, reject: reject, timer: null };
            autoTask = task;
            autoProgress().hidden = false;
            $('autoProgressBar').removeAttribute('value');
            $('autoProgressStatus').textContent = '正在准备推演';
            $('autoProgressDetail').textContent = '正在加载推演资料…';
            $('autoProgressElapsed').textContent = '已用时 0 秒';
            $('autoStop').hidden = false;
            $('autoResults').setAttribute('aria-busy', 'true');
            task.timer = setInterval(function () {
                $('autoProgressElapsed').textContent = '已用时 ' + Math.floor((Date.now() - started) / 1000) + ' 秒';
            }, 1000);
            function finish(error, result) {
                if (autoTask !== task) return;
                autoTask = null;
                clearInterval(task.timer);
                worker.terminate();
                $('autoResults').removeAttribute('aria-busy');
                $('autoStop').hidden = true;
                if (error) {
                    $('autoProgressStatus').textContent = '推演未完成';
                    $('autoProgressDetail').textContent = '请检查网络和推演条件后重试。';
                    autoProgress().hidden = true;
                    reject(error);
                } else {
                    $('autoProgressBar').value = 1;
                    $('autoProgressStatus').textContent = '推演完成';
                    $('autoProgressDetail').textContent = '100% · 本次推演已结束，结果见下方';
                    resolve(result);
                }
            }
            worker.onmessage = function (event) {
                if (autoTask !== task) return;
                var data = event.data || {};
                if (data.type === 'progress') {
                    $('autoProgressStatus').textContent = data.phase === 'loading' ? '正在准备推演' : '正在推演目标路线';
                    $('autoProgressDetail').textContent = Number.isFinite(data.expanded)
                        ? '已检查 ' + formatCount4(Math.max(0, Math.floor(data.expanded))) + ' 个状态，正在继续查找…'
                        : data.phase === 'loading' ? '正在加载推演资料…' : '正在比较不同路线，完成后自动显示结果。';
                } else if (data.type === 'result') finish(null, data.result);
                else if (data.type === 'error') finish(new Error(data.error || '后台推演失败，请重试。'));
            };
            worker.onerror = function (event) { event.preventDefault(); finish(new Error('后台推演中断，请刷新页面后重试。')); };
            worker.onmessageerror = function () { finish(new Error('推演结果读取失败，请重试。')); };
            try { worker.postMessage({ type: 'start', student: student, targets: selectedTargets, options: options }); }
            catch (error) { finish(new Error('弟子资料未能传入后台，请重新选择弟子后重试。')); }
        });
    }
    window.addEventListener('pagehide', function () { stopAuto(); });

    function autoStudent() {
        var sel = $('autoStudent');
        var s = byKey.get(String(sel.value || ''));
        return s ? cloneStudent(s) : null;
    }

    function autoSay(msg, isErr) {
        var el = document.createElement('p');
        el.className = 'hs-note' + (isErr ? ' is-error' : '');
        el.textContent = msg;
        return el;
    }

    function renderTargets() {
        var box = $('autoTalentChoices');
        var search = String($('autoTalentSearch').value || '').trim().toLowerCase();
        var cat = $('autoTalentCategory').value || 'all';
        var ids = (window.HENGSHAN_TALENT_DATA.candidates || []).map(Number).filter(function (id) {
            return categoryOf.has(id) && (cat === 'all' || categoryOf.get(id) === cat) &&
                (!search || talentName(id).toLowerCase().indexOf(search) >= 0);
        });
        var html = CATEGORY.map(function (g) {
            var inGroup = ids.filter(function (id) { return categoryOf.get(id) === g.key; });
            if (!inGroup.length) return '';
            var defaultOpen = g.key !== 'combat' && g.key !== 'dispatch';
            return '<details class="hs-choice-group"' + (defaultOpen ? ' open' : '') + '><summary><strong>' + g.label + ' · ' + inGroup.length + ' 项</strong></summary>' +
                '<div class="hs-choice-grid">' + inGroup.map(function (id) {
                    var editingPick = document.querySelector('[name=targetMode]:checked')?.value === 'pick';
                    var on = (editingPick ? pickTargets : targets).has(id);
                    return '<label class="hs-choice' + (on ? ' is-selected' : '') + '"><input type="checkbox" value="' + id + '"' + (on ? ' checked' : '') + '><span>' + esc(talentName(id).replace(/Ⅰ$/, '')) + '</span></label>';
                }).join('') + '</div></details>';
        }).join('');
        box.innerHTML = html || '<span class="hs-note">没有匹配的天赋</span>';
        $('autoTargetCount').textContent = '必选 ' + targets.size + ' · 候选 ' + pickTargets.size;
        $('batchRuleSummary').textContent = '必选：' + talentNames(Array.from(targets)) + '；任选池：' + talentNames(Array.from(pickTargets));
    }

    function targetChange(ev) {
        var input = ev.target.closest('input[type="checkbox"]');
        if (!input) return;
        var id = Number(input.value);
        var targetSet = document.querySelector('[name=targetMode]:checked')?.value === 'pick' ? pickTargets : targets;
        if (input.checked && targetSet.size >= (targetSet === targets ? 3 : 10) && !targetSet.has(id)) {
            input.checked = false; say(targetSet === targets ? '最多三个必选天赋。' : '任选池最多十项天赋。', true); return;
        }
        if (input.checked) {targetSet.add(id); (targetSet === targets ? pickTargets : targets).delete(id);if(targetSet===pickTargets&&Number($('batchPickN')?.value)===0&&targets.size<3)$('batchPickN').value=1;}
        else targetSet.delete(id);
        renderTargets();
        resetAuto();
    }

    function resetAuto(msg) {
        if (batchWorker) {batchWorker.terminate();batchWorker=null;clearInterval(batchTimer);$('btnAutoRun').disabled=false;}
        stopAuto();
        if ($('autoProgress')) $('autoProgress').hidden = true;
        autoResult = null;
        $('autoResults').innerHTML = '<p class="hs-note">' + esc(msg || '配置已变化，请重新开始恒山自动推演。') + '</p>';
    }

    function stageLine(st) {
        if (st && st.type === 'skip') {
            return '<li><strong>节点跳过</strong><span>' + st.fromLevel + ' 级 → ' + st.toLevel + ' 级</span><small>跳过该节点赠送天赋，后续序列按跳过后的状态继续</small></li>';
        }
        if (st && st.type === 'grant') {
            return '<li><strong>' + st.level + ' 级节点赠才</strong><span>获得 ' + esc(talentName(st.id)) + '</span><small>节点额外获得，不占用洗髓次数</small></li>';
        }
        if (st && st.clear) {
            return '<li><strong>' + st.level + ' 级清障 / 换运</strong><span>槽位 ' + (st.slot + 1) + ' · 抽中 ' + esc(talentName(st.id)) + '</span><small>占用 1 次洗髓机会；' + (st.blocking ? '清除目标同组障碍' : '改变后续天赋序列') + '</small></li>';
        }
        if (st && st.count !== null && st.count !== undefined) {
            return '<li><strong>目标 ' + esc(talentName(st.targetId).replace(/Ⅰ$/, '')) + '</strong><span>同步推进槽位 ' + (st.slot + 1) + '，本阶段 ' + st.count + ' 次</span><small>保留：' + esc(talentNames(st.keep)) + '</small></li>';
        }
        return '<li><strong>' + st.level + ' 级替换槽位 ' + (st.slot + 1) + '</strong><span>' + esc(talentName(st.oldId)) + ' → ' + esc(talentName(st.id)) + '</span><small>替换后：' + esc(talentNames(st.talents)) + '</small></li>';
    }

    function routeHtml(route, idx, student, conditions) {
        var order = (route.order || []).map(function (id) { return talentName(id).replace(/Ⅰ$/, ''); }).join(' → ');
        if (route.status !== 'complete') {
            return '<details class="hs-route is-limit"><summary><span>#' + (idx + 1) + ' ' + esc(order) + '</span><strong>上限内未完成</strong></summary><p>' +
                (route.reason === 'resource' ? '当前资源或冷却条件下未能完成该目标顺序。' : '在本次搜索范围内没有完成该目标顺序。') + '</p></details>';
        }
        var steps = student.level < 100 && route.actions?.length && routeSteps(route.actions, student, conditions);
        return '<details class="hs-route"' + (idx === 0 ? ' open' : '') + '><summary><span>#' + (idx + 1) + ' ' + esc(order) + '</span><strong>' + route.totalRefreshes + ' 次替换</strong></summary><ol>' +
            (steps?.length ? routeStepsHtml(steps) : (route.stages || []).map(stageLine).join('')) + '</ol><p>' +
            (route.remainingMasterTokens === null || route.remainingMasterTokens === undefined ? '' : '剩余掌门令 ' + route.remainingMasterTokens + '；') +
            '最终组合：' + esc(talentNames(route.finalTalents)) + '</p><button type="button" class="hs-btn" data-auto-export="'+idx+'">导出路线长图</button></details>';
    }

    function runAuto() {
        if (($('batchScope')?.value || 'current') !== 'current' || Number($('batchPickN')?.value || 0) > 0) { runBatch(); return; }
        if (autoTask || $('btnAutoRun').disabled) return;
        var student = autoStudent();
        if (!student) { say('请先导入并选择恒山弟子。', true); return; }
        if (targets.size < 1 || targets.size > 3) { say('请选择 1～3 个目标天赋。', true); return; }

        var num = function (id, lo, hi, dft) {
            var v = Number($(id).value);
            return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : dft));
        };
        var fullLevel = student.level >= 100 && student.talents.length === 3;
        var maxRefreshes = num('autoMaxRefreshes', fullLevel ? 1 : 0, fullLevel ? 100000 : 100, fullLevel ? 5000 : 20);
        var maxDays = num('autoMaxDays', 0, 3650, 365);
        var cap = num('autoTokenCap', 20, 999, 99);
        var options = {
            maxRefreshes: maxRefreshes,
            maxDays: maxDays,
            dailyExtraExp: num('autoDailyExtraExp', 0, 100000, 0),
            currentMasterTokens: Math.max(0, Math.min(cap, num('autoCurrentTokens', 0, cap, 20))),
            dailyMasterTokens: num('autoDailyTokens', 0, 99, 10),
            masterTokenCap: cap,
            replacementCooldown: Math.round(3600 * num('autoCooldownHours', 0, 168, 24)),
            nextDailyAt: (Number(student.currentTime) || 0) + Math.round(3600 * num('autoNextDailyHours', 0.1, 24, 24))
        };

        var runId = ++autoRunId;
        var selectedTargets = Array.from(targets);
        autoResult = null;
        $('autoResults').innerHTML = '<p class="hs-note">正在推演目标路线…</p>';
        var btn = $('btnAutoRun');
        btn.disabled = true;
        btn.textContent = '正在推演…';
        say('正在后台推演目标路线…', false);
        planAuto(student, selectedTargets, options)
            .then(function (res) {
                if (runId !== autoRunId) return;
                autoResult = res;
                var done = (res.routes || []).filter(function (r) { return r.status === 'complete'; }).length;
                var modeText = res.mode === 'full-level-synchronized'
                    ? '满级三槽同步扫描 · 已按掌门令与冷却安排路线'
                    : res.optimality === 'bounded-level-resource-exhaustive'
                        ? '未满级 · 已查完本次范围内的升级、掌门令领取、等待冷却和天赋替换方案'
                        : '未满级 · 达到状态扫描上限，当前为边界内候选';
                $('autoResults').innerHTML =
                    '<div class="hs-auto-summary"><strong>' + (res.best
                        ? '最佳路线 ' + res.best.totalRefreshes + ' 次替换'
                        : '上限内未找到完整路线') + '</strong><span>' + esc(modeText) + ' · 完成 ' + done + ' / ' + res.routeCount + ' 路</span></div>' +
                    (res.routes || []).map((route, i) => routeHtml(route, i, student, options)).join('');
                $('autoResults').querySelectorAll('[data-auto-export]').forEach(button=>button.onclick=async()=>{
                    button.disabled=true;
                    try {
                        const route = res.routes[Number(button.dataset.autoExport)];
                        await exportRoute(student, route.totalRefreshes, route.actions || route.stages || [],
                            route.finalTalents, route.remainingMasterTokens, options);
                    }catch(e){say(e.message,true)}finally{button.disabled=false}
                });
                say('已从当前弟子进度出发，比较升级、掌门令领取、等待冷却和天赋替换方案。', false);
            })
            .catch(function (e) {
                if (runId !== autoRunId) return;
                if (e.message === '推演条件已变化，请重新开始。' || e.message === '已停止推演，可以调整条件后重新开始。') { say(e.message, false); return; }
                say('自动推演失败：' + (e.message || e), true);
                resetAuto('自动推演失败，请检查弟子状态和目标天赋。');
            })
            .finally(function () { if (runId === autoRunId && !autoTask) { btn.disabled = false; btn.textContent = '开始恒山自动推演'; } });
    }

    function routeSteps(actions, student, conditions) {
        const rows = [];
        let state = Object.assign(H.normalizeState(student), {
            dailyExtraExp: conditions.dailyExtraExp,
            nextDailyAt: conditions.nextDailyAt ?? student.currentTime + (conditions.nextDailySeconds || 86400)
        });
        let natural = 0, extra = 0, startLevel = state.level;
        const flush = () => {
            if (natural || extra) rows.push({title: '结算经验 +' + formatCount4(natural + extra), lines: [
                '自然 +' + formatCount4(natural) + ' · 额外 +' + formatCount4(extra),
                startLevel === state.level ? state.level + ' 级' : startLevel + ' → ' + state.level + ' 级'
            ]});
            startLevel = state.level;
            natural = extra = 0;
        };
        for (const action of actions) {
            if (action.type === 'day') {
                for (let i = 0; i < (action.days ?? 1); i++) {
                    if (state.level >= 100) break;
                    const next = H.advanceDay(state);
                    state = next.state;
                    natural += next.action.expGained - next.action.dailyExtraExp;
                    extra += next.action.dailyExtraExp;
                    if (next.action.milestones?.length) {
                        flush();
                        for (const milestone of next.action.milestones) {
                            rows.push({title: milestone.level + ' 级 · 获得天赋', lines: [talentName(milestone.id ?? milestone.talentId)]});
                        }
                    }
                }
                continue;
            }
            if (action.type === 'wait') continue;
            flush();
            if (action.type === 'grant') {
                rows.push({title: action.level + ' 级 · 获得天赋', lines: [talentName(action.id)]});
            } else if (action.type === 'skip') {
                rows.push({title: '跳过天赋节点', lines: [action.fromLevel + ' 级 → ' + action.toLevel + ' 级']});
            } else if (action.count != null) {
                rows.push({title: '目标 ' + talentName(action.targetId), lines: [
                    '槽位 ' + (action.slot + 1) + ' · 替换 ' + action.count + ' 次',
                    '保留：' + talentNames(action.keep)
                ]});
            } else if (action.type === 'replace') {
                rows.push({title: action.level + ' 级 · 替换槽位 ' + (action.slot + 1), lines: [
                    talentName(action.oldId) + ' → ' + talentName(action.id),
                    '消耗 20 掌门令'
                ]});
                if (state.level < 100) state = H.replacementOnce(state, action.slot).state;
            }
        }
        flush();
        return rows;
    }

    function routeStepsHtml(steps) {
        return steps.map(step=>'<li><strong>'+esc(step.title)+'</strong>　<span>'+esc(step.lines.join(' · '))+'</span></li>').join('');
    }

    function routeStart(student) {
        return student.level + ' 级 · ' + talentNames(student.talents);
    }

    function exportRoute(student, count, actions, finalTalents, remainingTokens, conditions) {
        const final = [talentNames(finalTalents)];
        if (remainingTokens != null) final.push('剩余掌门令 ' + remainingTokens);
        return SBJPlanExport('恒山弟子路线', student.name + ' · ' + count + ' 次替换', [
            {title: student.recruitPrepared ? '先招募 ' + student.name : '推演起点', lines: [
                routeStart(student),
                '每日基础自然经验 ' + student.dailyBaseExp + ' · 自填额外经验 ' + conditions.dailyExtraExp,
                '掌门令 ' + conditions.currentMasterTokens + '（每日 ' + conditions.dailyMasterTokens + '，上限 ' + conditions.masterTokenCap + '）',
                '替换冷却 ' + (conditions.replacementCooldown / 3600) + ' 小时'
            ]},
            ...routeSteps(actions, student, conditions),
            {title: '核对最终天赋', lines: final}
        ]);
    }

    function renderBatch() {
        var expanded = new Set(Array.from($('autoResults').querySelectorAll('details.hs-route[open]')).map(el=>el.dataset.batchKey));
        var firstRender = !$('autoResults').querySelector('details.hs-route');
        var hits=batchRows.filter(x=>x.result.ok).sort((a,b)=>a.result.washes-b.result.washes||a.result.days-b.result.days);
        $('autoResults').innerHTML='<div class="hs-auto-summary"><strong>找到 '+hits.length+' 名符合条件的弟子</strong><span>已检查 '+batchRows.length+' 人；每条命中路线已逐步回放。边界内未命中不代表无解。</span></div>'+hits.map((x,index)=>{
            const r = x.result;
            const steps = x.steps ||= routeSteps(r.actions, x.student, x.conditions);
            return '<details class="hs-route" data-batch-key="'+esc(x.student.key)+'"'+(expanded.has(String(x.student.key))||firstRender&&index===0?' open':'')+'><summary><span>'+esc(x.student.name)+' · '+(x.student.source==='enrolled'?'在册':'招募后')+'</span><strong>'+r.washes+' 次替换</strong></summary>' +
                '<p>最终：'+esc(talentNames(r.finalState.talents))+' · 剩余掌门令 '+r.finalState.masterTokens+'</p>' +
                '<p>起点：'+esc(routeStart(x.student))+'</p>' +
                (steps.length ? '<ol>'+routeStepsHtml(steps)+'</ol>' : '') +
                '<button type="button" class="hs-btn" data-batch-export="'+batchRows.indexOf(x)+'">导出路线长图</button></details>';
        }).join('')+'<details class="hs-batch-misses"><summary>未命中 / 达到边界 '+(batchRows.length-hits.length)+' 人</summary>'+batchRows.filter(x=>!x.result.ok).map(x=>'<p>'+esc(x.student.name)+' · '+(x.result.truncated?'达到扫描上限':'本次范围未命中')+' · '+formatCount4(x.result.checked)+' 个状态</p>').join('')+'</details>';
        $('autoResults').querySelectorAll('[data-batch-export]').forEach(button=>button.onclick=async()=>{
            button.disabled=true;
            try {
                const {student, result, conditions} = batchRows[Number(button.dataset.batchExport)];
                await exportRoute(student, result.washes, result.actions, result.finalState.talents, result.finalState.masterTokens, conditions);
            } catch (e) { say(e.message, true); }
            finally { button.disabled=false; }
        });
    }
    function runBatch() {
        if(batchWorker||autoTask)return;
        var scope=$('batchScope').value,students=scope==='current'?[autoStudent()].filter(Boolean):scope==='enrolled'?enrolled:scope==='backpack'?Array.from(backpack.values()):scope==='shop'?candidates:enrolled.concat(Array.from(backpack.values()),candidates.filter(x=>!backpack.has(bagKeyOf(x))));
        students=students.filter(x=>!$('batchSkipMax').checked||x.level<100).map(x=>x.source==='shop'?H.prepareRecruit(x).state:cloneStudent(x));
        var pickN=Number($('batchPickN').value);if(!students.length){say('这个范围内没有可推演弟子。',true);return;}if(targets.size+pickN<1||targets.size+pickN>3||pickN>pickTargets.size){say('必选与任选合计应为 1～3 项，任选数量不能超过候选数。',true);return;}
        var number=(id,min,max)=>Math.max(min,Math.min(max,Number($(id).value)||0));
        var options={maxRefreshes:number('autoMaxRefreshes',0,pickN ? 10 : 100000),maxDays:number('autoMaxDays',0,3650),dailyExtraExp:number('autoDailyExtraExp',0,100000),currentMasterTokens:Math.min(number('autoCurrentTokens',0,999),number('autoTokenCap',20,999)),dailyMasterTokens:number('autoDailyTokens',0,99),masterTokenCap:number('autoTokenCap',20,999),replacementCooldown:Math.round(3600*number('autoCooldownHours',0,168)),nextDailySeconds:Math.round(3600*number('autoNextDailyHours',0.1,24)),maxStates:number('batchStateCap',1000,pickN ? 30000 : 200000),clearSwap:$('batchClear').checked};
        $('autoMaxRefreshes').value=options.maxRefreshes;batchRows=[];const started=Date.now();batchTimer=setInterval(()=>{$('autoProgressElapsed').textContent='已用时 '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);const worker=new Worker('/suanbujin/hengshan/batch-worker.js?rev=42e9e8693a8b');batchWorker=worker;var progress=autoProgress();progress.hidden=false;$('autoProgressBar').value=0;$('autoProgressStatus').textContent='正在批量筛选';$('btnAutoRun').disabled=true;$('autoStop').hidden=false;$('autoStop').onclick=()=>finish('已停止，已完成的命中路线保留。');
        function finish(message){if(batchWorker!==worker)return;worker.terminate();batchWorker=null;clearInterval(batchTimer);$('btnAutoRun').disabled=false;$('autoStop').hidden=true;$('autoProgressStatus').textContent=message;renderBatch();}
        worker.onmessage=event=>{if(batchWorker!==worker)return;var data=event.data;if(data.type==='progress'){$('autoProgressBar').value=data.done/data.total;$('autoProgressDetail').textContent=(data.done+1)+' / '+data.total+' 人 · '+data.name+(data.checked?' · 已检查 '+formatCount4(data.checked)+' 个状态':'');}else if(data.type==='student'){data.conditions=options;batchRows.push(data);renderBatch();}else if(data.type==='done'){$('autoProgressBar').value=1;finish('批量筛选完成');}else if(data.type==='error'){finish('推演未完成');say(data.error,true)}};worker.onerror=()=>{finish('推演中断，已保留完成结果');say('后台推演失败，请缩小范围后重试。',true)};
        worker.postMessage({students,rule:{must:Array.from(targets),pick:Array.from(pickTargets),pickN},options});
    }
    window.addEventListener('pagehide',()=>{batchWorker?.terminate();batchWorker=null;clearInterval(batchTimer);});

    /* ---------------- 存档接入 ---------------- */

    var jointArchive;
    function loadFromSave() {
        var shared = null;
        try { shared = typeof loadShareStore === 'function' ? loadShareStore() : null; } catch (e) { }
        var data = shared && shared.data;
        var source = Array.isArray(data) ? data[0] : data;
        var sect = source?.MySectData;
        jointArchive = {tokens: Number(sect?.ZhangNum), level: Number(sect?.SectLv), time: Number(source?.RealTime),
            canWash: Object.values(sect?.SectTech || {}).some(tech => Number(tech?.ID ?? tech?.id ?? tech) === 318)};
        var meta = shared && shared.meta || {}, activeId = '';
        try { activeId = (JSON.parse(localStorage.getItem('yyjh_save_library_v1') || '{}') || {}).activeId || ''; } catch (_) { }
        bagContext = JSON.stringify([activeId, meta.role, meta.server, meta.channel, meta.platform, meta.version,
            source && source.MainRole && source.MainRole.Name, source && source.RealTime, source && source.MySectData]);
        bagRevision = '';studentsReady = false;stopAuto();

        var badge = $('hsSaveStatus');
        badge.textContent = data ? '导入成功' : '未导入';
        badge.classList.toggle('is-ok', !!data);

        enrolled = [];
        candidates = [];
        candidatesInit = [];
        backpack.clear();
        shopState = null;
        shopStateInit = null;
        shopContext = {};

        if (data) {
            try {
                var groups = H.collectStudentGroups(data);
                shopContext = cloneStudent(groups.context || {});
                enrolled = groups.enrolled.map(cloneStudent);
                candidates = groups.shop.map(function (s) { s.source = 'shop'; return s; });
                candidatesInit = candidates.map(cloneStudent);
                shopState = Object.assign({}, groups.shopState || {}, { pageRefreshes: 0 });
                shopStateInit = cloneStudent(shopState);
            } catch (e) {
                say('存档解析失败：' + (e.message || e), true);
            }
        }

        if (data) restoreBag();
        rebuildPool();
        fillSelect($('studentSelect'), bagPreferred);
        fillSelect($('autoStudent'), bagPreferred);
        current = pickStudent($('studentSelect'));
        refreshHistory = [];
        renderStudent();
        renderHistory();
        renderShop();
        renderTargets();
        studentsReady = true;

        if (enrolled.length || candidates.length || backpack.size) {
            say('已读取 ' + enrolled.length + ' 名在册弟子、' + candidates.length + ' 名玉秀殿候选与 ' + backpack.size + ' 名背包弟子；背包弟子可在自动、手动推演中选择。', false);
        } else {
            say(data ? '已读取存档，但没有找到恒山在册弟子或玉秀殿候选。' : '请先在首页导入存档。', false);
        }
    }

    /* ---------------- 启动 ---------------- */

    function start() {
        if (window.NANGMAN_DISABLE_HENGSHAN === true) return;
        initTabs();

        $('studentSelect').addEventListener('change', function (e) { selectStudent(e.target.value); });
        $('btnResetStudent').addEventListener('click', resetStudent);
        $('btnAdvanceDay').addEventListener('click', advanceDay);
        $('btnSimulateRefresh').addEventListener('click', simulateRefresh);
        $('refreshSlot').addEventListener('change', resetChain);
        $('refreshCount').addEventListener('change', resetChain);
        $('refreshRows').addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-step]');
            if (btn) applyStep(Number(btn.getAttribute('data-step')));
        });

        $('shopStudentCards').addEventListener('click', shopClick);
        $('studentBagCards').addEventListener('click', shopClick);
        $('btnShopRefresh').addEventListener('click', shopNext);
        $('btnShopRestore').addEventListener('click', shopRestore);

        $('autoTalentChoices').addEventListener('change', targetChange);
        $('autoTalentCategory').addEventListener('change', renderTargets);
        $('autoTalentSearch').addEventListener('input', renderTargets);
        $('autoStudent').addEventListener('change', function () { resetAuto(); });
        $('batchScope')?.addEventListener('change',()=>{$('autoStudent').closest('label').hidden=$('batchScope').value!=='current';});
        ['autoMaxRefreshes', 'autoMaxDays', 'autoDailyExtraExp', 'autoCurrentTokens', 'autoDailyTokens', 'autoTokenCap', 'autoCooldownHours', 'autoNextDailyHours'].forEach(function (id) {
            $(id).addEventListener('change', function () { resetAuto(); $('hsResourceSummary').textContent='资源：当前 '+$('autoCurrentTokens').value+' 令 · 每日 '+$('autoDailyTokens').value+' 令 · 冷却 '+$('autoCooldownHours').value+' 小时（请确认）'; });
            if ($(id).type !== 'checkbox') $(id).addEventListener('input', function () { resetAuto(); });
        });
        $('btnAutoRun').addEventListener('click', runAuto);
        document.querySelectorAll('[name=targetMode]').forEach(el=>el.addEventListener('change', renderTargets));
        ['batchScope','batchPickN','batchClear','batchSkipMax','batchStateCap'].forEach(id=>$(id)?.addEventListener('change',()=>{renderTargets();resetAuto();}));
        bagHost.addEventListener('yyjh-hengshan-backpack-change', syncBag);
        document.addEventListener('yyhx-route-visibility', syncBag);
        window.addEventListener('pageshow', syncBag);
        window.addEventListener('focus', syncBag);
        window.addEventListener('storage', function (event) {
            if (event.key === bagStorageKey || event.key === null) syncBag();
        });
        document.addEventListener('yyjh-save', function () { if (studentsReady) loadFromSave(); });

        say('正在加载恒山弟子资料…', false);
        H.ready()
            .then(function () { loadFromSave(); })
            .catch(function (e) { say('恒山算法初始化失败：' + (e.message || e), true); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();