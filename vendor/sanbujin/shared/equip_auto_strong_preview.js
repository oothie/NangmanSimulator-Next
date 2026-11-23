/* 自动장비 · 看淬炼：只读淬炼序列预览（对齐장비-淬炼页的功能） */
(function () {
    var STONE_NAMES = { 3027: '백련석', 3028: '녹련석', 3029: '청련석', 3030: '자련석' };
    var STONE_WEIGHT = { 3027: 1, 3028: 1e4, 3029: 1e8, 3030: 1e12 };
    var GRADE_NAMES = { 1: '일반', 2: '양호', 3: '우수', 4: '완벽' };
    var state = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatSilver(wen) {
        var liang = Math.floor(wen / 1000);
        var rest = wen % 1000;
        var s = '';
        if (liang > 0) s += liang + '냥';
        if (rest > 0 || !s) s += rest + '문';
        return s;
    }

    function qianghuaTier(needLv) {
        return Math.min(11, Math.max(1, Math.floor((needLv || 90) / 10) + 1));
    }

    function attemptCost(needLv, fromLevel) {
        var target = fromLevel + 1;
        var qh = (EQUIP_DATA.qianghua || {})[String(target)];
        if (!qh) return null;
        var tier = qianghuaTier(needLv);
        var row = (qh.costs || {})[String(tier)];
        if (!row) return null;
        return { mat: row.mat, num: row.num, silver: row.silver, qhcd: qh.qhcd };
    }

    function costScore(bag) {
        var s = bag.silver || 0;
        Object.keys(bag.stones || {}).forEach(function (id) {
            s += (STONE_WEIGHT[id] || 1) * bag.stones[id];
        });
        return s;
    }

    function planPath(grades, start, targetLevel, minGrade, needLv) {
        var need = targetLevel - start;
        if (need <= 0) return { minCost: { ok: false, reason: '목표 단계에 도달했습니다' }, maxValue: { ok: false, reason: '목표 단계에 도달했습니다' } };
        var n = grades.length;
        function better(a, b, mode) {
            if (!a) return true;
            if (mode === 'maxValue') {
                if (b.value !== a.value) return b.value > a.value;
                return b.score < a.score;
            }
            if (b.score !== a.score) return b.score < a.score;
            return b.value > a.value;
        }
        function run(mode) {
            var d = [];
            for (var i0 = 0; i0 <= n; i0++) {
                var row = [];
                for (var k0 = 0; k0 <= need; k0++) row.push(null);
                d.push(row);
            }
            d[0][0] = { score: 0, value: 0, bag: { stones: {}, silver: 0 }, from: null };
            for (var i = 0; i < n; i++) {
                for (var k = 0; k <= need; k++) {
                    var cur = d[i][k];
                    if (!cur) continue;
                    if (k === need) {
                        var stay = { score: cur.score, value: cur.value, bag: cur.bag, from: { i: i, k: k, action: 'done', seq: i } };
                        if (better(d[i + 1][k], stay, mode)) d[i + 1][k] = stay;
                        continue;
                    }
                    var level = start + k;
                    if (level >= 15) continue;
                    var c = attemptCost(needLv, level);
                    if (!c) continue;
                    var stones = Object.assign({}, cur.bag.stones);
                    stones[c.mat] = (stones[c.mat] || 0) + c.num;
                    var nextBag = { stones: stones, silver: cur.bag.silver + c.silver };
                    var sc = costScore(nextBag);
                    var grade = grades[i];
                    var add = Math.floor([0, 600, 700, 800, 1000][grade] * c.qhcd);
                    var skipSt = { score: sc, value: cur.value, bag: nextBag, from: { i: i, k: k, action: 'skip', seq: i, level: level, grade: grade, add: add } };
                    if (better(d[i + 1][k], skipSt, mode)) d[i + 1][k] = skipSt;
                    if (grade >= minGrade) {
                        var accSt = { score: sc, value: cur.value + add, bag: nextBag, from: { i: i, k: k, action: 'accept', seq: i, level: level, grade: grade, add: add } };
                        if (better(d[i + 1][k + 1], accSt, mode)) d[i + 1][k + 1] = accSt;
                    }
                }
            }
            var best = null;
            var bestI = -1;
            for (var ii = 0; ii <= n; ii++) {
                var st = d[ii][need];
                if (!st) continue;
                if (better(best, st, mode)) { best = st; bestI = ii; }
            }
            if (!best) {
                var maxK = -1;
                for (var i2 = 0; i2 <= n; i2++) {
                    for (var k2 = 0; k2 <= need; k2++) {
                        if (d[i2][k2] && k2 > maxK) maxK = k2;
                    }
                }
                return { ok: false, reason: maxK < 0 ? '진행 가능한 경로 없음' : ('현재 순서에서 최대 +' + (start + maxK) + '(목표 +' + targetLevel + ')까지 가능합니다. 조회 횟수를 늘리거나 목표 단계를 낮추세요.') };
            }
            var accepts = {};
            var steps = [];
            var i3 = bestI;
            var k3 = need;
            while (i3 > 0 || k3 > 0) {
                var st3 = d[i3][k3];
                if (!st3 || !st3.from) break;
                var f = st3.from;
                if (f.action === 'accept') {
                    accepts[f.seq + 1] = true;
                    steps.push({ index: f.seq + 1, action: '接受', level: f.level, grade: f.grade });
                    i3 = f.i; k3 = f.k;
                } else if (f.action === 'skip') {
                    steps.push({ index: f.seq + 1, action: '取消', level: f.level, grade: f.grade });
                    i3 = f.i; k3 = f.k;
                } else {
                    i3 = f.i; k3 = f.k;
                }
            }
            steps.reverse();
            return {
                ok: true, accepts: accepts, steps: steps, bag: best.bag, value: best.value,
                attempts: steps.filter(function (s) { return s.action !== 'done'; }).length
            };
        }
        return { minCost: run('minCost'), maxValue: run('maxValue') };
    }

    function costChips(bag) {
        var parts = [];
        [3027, 3028, 3029, 3030].forEach(function (id) {
            var n = (bag.stones || {})[id] || 0;
            if (n) parts.push('<span class="equip-auto-forge-chip">' + STONE_NAMES[id] + '×' + n + '</span>');
        });
        if (bag.silver) parts.push('<span class="equip-auto-forge-chip">은냥' + formatSilver(bag.silver) + '</span>');
        return parts.join('') || '<span class="equip-auto-forge-chip">—</span>';
    }

    function pathChips(steps) {
        if (!steps || !steps.length) return '<span class="equip-auto-forge-path-empty">—</span>';
        return steps.map(function (step) {
            var next = (step.level || 0) + 1;
            return '<span class="equip-auto-forge-path"><span class="lv">+' + step.level + '→+' + next + '</span>'
                + '<span class="idx">#' + step.index + '</span>'
                + '<span class="g' + step.grade + '">' + (GRADE_NAMES[step.grade] || '') + '</span></span>';
        }).join('');
    }

    function planCard(title, plan, tag) {
        if (!plan || !plan.ok) {
            return '<article class="equip-auto-forge-plan is-fail"><header><h4>' + title + '</h4></header>'
                + '<p>' + escapeHtml((plan && plan.reason) || '사용 불가') + '</p></article>';
        }
        var accepts = plan.steps.filter(function (s) { return s.action === '接受'; });
        return '<article class="equip-auto-forge-plan"><header><h4>' + title + '</h4><span>' + tag + '</span></header>'
            + '<div class="equip-auto-forge-metrics">'
            + '<div><b>' + plan.attempts + '</b><span>시도 횟수</span></div>'
            + '<div><b>+' + (plan.value / 2) + '%</b><span>촉련도</span></div>'
            + '<div><b>+' + (Math.round(plan.value / 10 * 10) / 10) + '%</b><span>예상 능력치</span></div>'
            + '</div>'
            + '<div class="equip-auto-forge-costs">' + costChips(plan.bag) + '</div>'
            + '<p class="equip-auto-forge-path-label">수락 경로 (총 ' + accepts.length + '회 단계 상승)</p>'
            + '<div class="equip-auto-forge-paths">' + pathChips(accepts) + '</div>'
            + '</article>';
    }

    function payload(candidate) {
        var meta = (typeof EQUIP_DATA !== 'undefined' && EQUIP_DATA.equipment && EQUIP_DATA.equipment[String(candidate.equipId)]) || {};
        return {
            id: Number(candidate.equipId) || 0,
            name: candidate.equipName || meta.name || '',
            color: Number(candidate.color) || 4,
            level: 0,
            lv_prop: Number(meta.lv_prop) || 0,
            S: candidate.S, CZSeed: candidate.CZSeed, MJSeed: candidate.MJSeed,
            XLLevel: 0, XLNumber: 0, exp: 0,
            base: candidate.base || {}, exts: candidate.exts || [],
            xilian_accepted: 0, xilian_marks: [],
            need_lv: Number(meta.need_lv) || 0,
            typ: Number(meta.type) || 0
        };
    }

    function close() {
        var wrap = document.querySelector('.equip-auto-forge-modal');
        if (wrap) wrap.remove();
        document.removeEventListener('keydown', onEsc);
        state = null;
    }

    function onEsc(event) { if (event.key === 'Escape') close(); }

    function render(targetWrap) {
        /* 允许指定容器：离屏生成时不能去抓页面上已经打开的那个弹窗 */
        var wrap = targetWrap || document.querySelector('.equip-auto-forge-modal');
        if (!wrap || !state) return;
        var card = wrap.querySelector('.equip-auto-forge-card');
        var items = state.items || [];
        var perfect = items.filter(function (it) { return Number(it.grade) === 4; }).length;
        var plans = state.plans || {};
        var minSet = (plans.minCost && plans.minCost.ok) ? plans.minCost.accepts : {};
        var bestSet = (plans.maxValue && plans.maxValue.ok) ? plans.maxValue.accepts : {};
        var minAccepts = minSet, bestAccepts = bestSet;
        var highlight = state.highlight;
        var rows = items.slice(0, 200).map(function (it) {
            var idx = Number(it.index);
            var grade = Number(it.grade) || 1;
            var pct = (Number(it.add_lv_prop) || 0) / 2;
            var cls = '';
            if (highlight === 'min' && minAccepts[idx]) cls = ' is-min';
            if (highlight === 'best' && bestAccepts[idx]) cls = ' is-best';
            return '<tr class="' + cls + '"><td>' + idx + '</td>'
                + '<td><span class="equip-auto-forge-grade g' + grade + '">' + (GRADE_NAMES[grade] || it.grade_name || '') + '</span></td>'
                + '<td>' + pct + '%</td>'
                + '<td class="' + (minAccepts[idx] ? 'is-yes' : '') + '">' + (minAccepts[idx] ? '수락' : '—') + '</td>'
                + '<td class="' + (bestAccepts[idx] ? 'is-yes' : '') + '">' + (bestAccepts[idx] ? '수락' : '—') + '</td></tr>';
        }).join('');
        var targetOptions = '';
        for (var lv = 1; lv <= 15; lv++) {
            targetOptions += '<option value="' + lv + '"' + (lv === Number(state.target) ? ' selected' : '') + '>+' + lv + '</option>';
        }
        var gradeOptions = '';
        [1, 2, 3, 4].forEach(function (g) {
            gradeOptions += '<option value="' + g + '"' + (g === Number(state.minGrade) ? ' selected' : '') + '>' + GRADE_NAMES[g] + ' 이상</option>';
        });
        card.innerHTML = '<div class="equip-auto-forge-head"><div><strong>' + escapeHtml(state.candidate.equipName || '장비') + '</strong>'
            + '<span>촉련 순서 미리보기 · 조회 전용, 순서 진행 없음</span></div>'
            + '<button type="button" class="equip-auto-forge-close" aria-label="닫기" title="닫기">×</button></div>'
            + '<div class="equip-auto-forge-controls">'
            + '<label>순서 길이<input type="number" class="equip-auto-forge-n" min="10" max="2000" value="' + state.n + '"></label>'
            + '<label>목표 촉련 단계<select class="equip-auto-forge-target">' + targetOptions + '</select></label>'
            + '<label>허용할 최저 등급<select class="equip-auto-forge-grade">' + gradeOptions + '</select></label>'
            + '<button type="button" class="equip-auto-forge-run">다시 예측</button>'
            + '</div>'
            + '<p class="equip-auto-forge-meta">현재 +' + state.level + ' · 순서 ' + items.length + '개 · 완벽 ' + perfect + '개</p>';
        if (state.error && !items.length) {
            card.innerHTML += '<p class="equip-auto-forge-empty">' + escapeHtml(state.error) + '</p>';
        } else {
            card.innerHTML += '<div class="equip-auto-forge-plans">' + planCard('소모 최소', plans.minCost, '희귀 촉련석 소모 최소화 우선') + planCard('수치 최적', plans.maxValue, '높은 촉련도 우선') + '</div>'
                + '<div class="equip-auto-forge-actions"><button type="button" class="equip-auto-forge-hl" data-hl="min">강조 · 소모 최소</button>'
                + '<button type="button" class="equip-auto-forge-hl" data-hl="best">강조 · 수치 최적</button></div>'
                + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table"><thead><tr><th>#</th><th>품질</th><th>동일 단계 참고</th><th>최소</th><th>최적</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
                + '<p class="equip-auto-forge-note">※ 취소해도 촉련석이 소모됩니다. 같은 결과라면 더 저렴한 단계에서 시도하도록 계산합니다. 조회 전용으로 세이브나 촉련 순서는 변경되지 않습니다.</p>'
                + '<div class="equip-auto-forge-footer"><button type="button" class="equip-auto-forge-foot-close">닫기</button></div>';
        }
        card.querySelector('.equip-auto-forge-close').addEventListener('click', close);
        var footClose = card.querySelector('.equip-auto-forge-foot-close');
        if (footClose) footClose.addEventListener('click', close);
        var runBtn = card.querySelector('.equip-auto-forge-run');
        if (runBtn) runBtn.addEventListener('click', rerun);
        card.querySelectorAll('.equip-auto-forge-hl').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.highlight = state.highlight === btn.dataset.hl ? '' : btn.dataset.hl;
                render();
            });
        });
    }

    function rerun() {
        var wrap = document.querySelector('.equip-auto-forge-modal');
        if (!wrap || !state) return;
        var nInput = wrap.querySelector('.equip-auto-forge-n');
        var targetSel = wrap.querySelector('.equip-auto-forge-target');
        var gradeSel = wrap.querySelector('.equip-auto-forge-grade');
        state.n = Math.max(10, Math.min(2000, Number(nInput.value) || 200));
        state.target = Number(targetSel.value) || Math.min(15, state.level + 1);
        state.minGrade = Number(gradeSel.value) || 3;
        run(state.n, state.target, state.minGrade);
    }

    function run(n, target, minGrade) {
        if (!state) return;
        var resp = null;
        try {
            resp = wasmStrongPreview(payload(state.candidate), n);
        } catch (error) {
            resp = { error: String(error && error.message || error) };
        }
        state.items = (resp && Array.isArray(resp.items)) ? resp.items : [];
        state.error = resp && resp.error ? String(resp.error) : '';
        state.level = Number(resp && resp.level) || 0;
        state.plans = {};
        if (state.items.length) {
            var grades = state.items.map(function (it) { return Number(it.grade) || 1; });
            var meta = (EQUIP_DATA.equipment || {})[String(state.candidate.equipId)] || {};
            state.plans = planPath(grades, state.level, target, minGrade, Number(meta.need_lv) || 90);
        }
        render();
    }

    /* ---- 供「藏兵阁」复用：从已存的 items 重算方案并生成面板 HTML ----
       不碰 WASM、不碰 DOM 状态，纯计算 + 拼接，避免两套渲染逻辑走偏。 */

    window.equipAutoStrongPreviewData = function (candidate, n) {
        var resp = null;
        try {
            resp = wasmStrongPreview(payload(candidate), Math.max(10, Math.min(2000, Number(n) || 200)));
        } catch (error) {
            resp = { error: String(error && error.message || error) };
        }
        return {
            items: (resp && Array.isArray(resp.items)) ? resp.items : [],
            level: Number(resp && resp.level) || 0,
            error: resp && resp.error ? String(resp.error) : ''
        };
    };

    window.equipAutoStrongPreviewPlans = function (items, level, target, minGrade, needLv) {
        var grades = (items || []).map(function (it) { return Number(it && it.grade) || 1; });
        if (!grades.length) return {};
        return planPath(grades, Number(level) || 0, target, minGrade, needLv);
    };

    window.equipAutoStrongPreviewBuild = function (options) {
        var opts = options || {};
        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-forge-modal';
        wrap.style.display = 'none';
        wrap.innerHTML = '<div class="equip-auto-forge-card"></div>';
        document.body.appendChild(wrap);
        var previous = state;
        state = {
            candidate: opts.candidate || {},
            n: opts.n,
            target: opts.target,
            minGrade: opts.minGrade,
            items: opts.items || [],
            level: Number(opts.level) || 0,
            plans: opts.plans || {},
            error: opts.error || '',
            highlight: opts.highlight || 'min'
        };
        var html = '';
        try {
            render(wrap);
            html = wrap.querySelector('.equip-auto-forge-card').innerHTML;
        } catch (error) { html = ''; }
        wrap.remove();
        state = previous;
        return html;
    };

    window.equipAutoShowForgePreview = function (candidateId, options) {
        var list = (typeof equipAutoFavorites !== 'undefined' && equipAutoFavorites) || [];
        var candidate = list.find(function (item) { return String(item.id) === String(candidateId); });
        if (!candidate && typeof equipAutoLastResult !== 'undefined' && equipAutoLastResult) {
            candidate = (equipAutoLastResult.candidates || []).find(function (item) { return String(item.id) === String(candidateId); });
        }
        if (!candidate) return;
        /* 收藏时已把淬炼面板渲染好存进快照 → 直接显示，不再跑 200 次推演 */
        if (candidate.views && candidate.views.forge && typeof EquipCardViews !== 'undefined'
            && EquipCardViews.openForge(candidate, candidate.views)) return;
        close();
        var wanted = Number(options && options.n);
        var n = Number.isFinite(wanted) && wanted > 0 ? Math.min(2000, Math.max(10, Math.round(wanted))) : 200;
        state = { candidate: candidate, n: n, target: 15, minGrade: 3, items: [], plans: {}, level: 0, error: '', highlight: 'min' };
        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-confirm equip-auto-forge-modal';
        wrap.innerHTML = '<div class="equip-auto-forge-card" role="dialog" aria-modal="true"></div>';
        document.body.appendChild(wrap);
        /* 只有真正点在遮罩上才关：从卡片里按下开始选文本、松手在遮罩上，不算点外面 */
        var downOnBackdrop = false;
        wrap.addEventListener('mousedown', function (event) { downOnBackdrop = (event.target === wrap); });
        wrap.addEventListener('click', function (event) {
            var selecting = false;
            try { selecting = String(window.getSelection ? window.getSelection() : '').length > 0; } catch (error) { }
            if (downOnBackdrop && event.target === wrap && !selecting) close();
            downOnBackdrop = false;
        });
        document.addEventListener('keydown', onEsc);
        run(n, 15, 3);
    };
})();