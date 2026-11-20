/* 装备卡片的三块「详情」数据 · 收藏时算好，之后只渲染
 *
 * 背景：第五步结果卡片上的三个按钮（看其他NPC附加值 / 精炼数据 / 看淬炼）
 * 原来都是「点开才跑算法」——精炼要过一遍内核、NPC 对照要模拟 1000 次、
 * 看淬炼要跑 200 次推演。收藏到藏兵阁之后这些按钮更是直接失效（处理函数在别的页面）。
 *
 * 现在改成：点 ☆ 收藏时同步算一次，把「能直接显示的数据」塞进收藏快照：
 *   views.refine = { count, rows: [[序, 槽, 旧词条文本, 新词条文本, 배율, 等级前后], ...] }
 *   views.region = { limit, rows: [[地点文本, 횟수, 附加值文本], ...], error }
 *   views.forge  = { html, meta }   —— 淬炼面板结构复杂，直接存渲染好的 HTML
 * 之后两个页面点开都只做渲染，不再跑算法。
 *
 * 只在有内核的页面（自动推演）调用 capture()；藏兵阁只调用 open*()。
 */
(function (root) {
    'use strict';

    var MAX_REFINE_ROWS = 2000;     /* 收藏时直接跑满 2000 次；内核本身没有 500 的硬限制，那只是面板钳制 */
    var MAX_REGION_ROWS = 120;
    var MAX_FORGE_HTML = 90000;     /* 单个淬炼面板 HTML 上限，超了就不存 */

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function koText(value) {
        var text = String(value == null ? '' : value);
        try { return root.SBJ_KOREAN?.translate?.(text) || text; }
        catch (error) { return text; }
    }
    function koEquipName(candidate) {
        try {
            var id = candidate && (candidate.equipId ?? candidate.equip_id);
            var equipment = root.EQUIP_DATA?.equipment?.[String(id)];
            if (equipment?.koName) return equipment.koName;
        } catch (error) { }
        return koText(candidate?.equipName || '장비');
    }

    function label(prop) {
        try {
            if (typeof equipAutoPropertyLabel === 'function') return equipAutoPropertyLabel(prop);
        } catch (error) { }
        /* 藏兵阁没加载 simulator.js，退回 EQUIP_DATA 的属性名表 */
        try {
            var names = root.EQUIP_DATA && root.EQUIP_DATA.propNames;
            if (names && names[prop]) return names[prop];
        } catch (error) { }
        return String(prop || '');
    }

    function fmtValue(prop, value) {
        try {
            if (typeof equipAutoFormatPropValue === 'function') return equipAutoFormatPropValue(prop, value);
        } catch (error) { }
        var num = Number(value);
        if (!Number.isFinite(num)) return String(value == null ? '' : value);
        /* 小于 1 的按百分比显示（和主站一致）：0.0565 → 5.65% */
        if (num < 1 || prop === 'atk_extend') {
            var points = Math.floor(num * 100 * 10 + 1e-8) / 10;
            return Number(points.toFixed(1)).toString() + '%';
        }
        var plain = Math.floor(num * 10 + 1e-8) / 10;
        return Number(plain.toFixed(1)).toString();
    }

    /* ---------------- 收藏时：把三块数据算出来 ---------------- */

    function refineRows(items, target, cutoff) {
        var cumulative = 0, lastKeeps = {};
        items.forEach(function (item) { if (item.accepted) lastKeeps[item.slot] = item.index; });
        return items.map(function (item) {
            cumulative += Number(item.cost_mult) || 1;
            var oldText = item.old_prop ? label(item.old_prop.prop) + '+' + fmtValue(item.old_prop.prop, item.old_prop.value) : '—';
            var newText = label(item.prop && item.prop.prop) + '+' + fmtValue(item.prop && item.prop.prop, item.prop && item.prop.value);
            var action = !item.accepted ? '유지 안 함' : item.prop && item.prop.prop === target && lastKeeps[item.slot] === item.index ? '목표 유지' : '임시 잠금';
            if (cutoff && Number(item.index) === cutoff) action += ' · 종료';
            return [Number(item.index) || 0, Number(item.slot) || 0, oldText, newText, Number(item.cost_mult) || 1,
                (item.xl_level_before == null ? '-' : item.xl_level_before) + '→' + (item.xl_level == null ? '-' : item.xl_level), action, cumulative];
        });
    }

    function captureRefine(candidate, opts) {
        try {
            if (typeof wasmXilianPreview !== 'function' || typeof equipAutoRefineWasmEquip !== 'function') return null;
            var want = Number(opts && opts.refineRows);
            if (Number.isFinite(want) && want <= 0) return null;
            var count = Number.isFinite(want) && want > 0 ? Math.min(MAX_REFINE_ROWS, Math.round(want)) : 500;
            var equip = equipAutoRefineWasmEquip(candidate);
            var items;
            if (Array.isArray(candidate.refineSequence) && candidate.refineSequence.length >= count) {
                items = candidate.refineSequence.slice(0, count);
            } else {
                var preview = wasmXilianPreview(equip, count);
                items = (preview && preview.items || []).slice(0, MAX_REFINE_ROWS);
            }
            if (!items.length) return null;
            var routes = (candidate.refinements || []).map(function (refinement) {
                var plan = refinement.plan, cutoff = Math.max(0, Number(plan && plan.cutoff) || 0);
                var route = { prop: refinement.prop, title: label(refinement.prop), cutoff: cutoff, total: refinement.total,
                    cost: plan && plan.cost || null, upgradeCost: candidate.upgradeCost || null, rows: [] };
                if (!cutoff) return route;
                try {
                    if (typeof wasmXilianPlan !== 'function' || cutoff > MAX_REFINE_ROWS) throw new Error('보존 계획의 재계산 기록이 저장되지 않았습니다');
                    var flags = Array(cutoff).fill(false);
                    (plan.accepts || []).forEach(function (keep) { if (Number(keep.index) >= 1 && Number(keep.index) <= cutoff) flags[Number(keep.index) - 1] = true; });
                    var replay = wasmXilianPlan(equip, flags);
                    if (replay.error || !replay.equip || !replay.items || replay.items.length !== cutoff) throw new Error(replay.error || '보존 계획의 재계산 기록이 불완전합니다');
                    var spent = replay.items.reduce(function (sum, item) { return sum + (Number(item.cost_mult) || 1); }, 0);
                    var total = (replay.equip.exts || []).reduce(function (sum, item) { return sum + (item.prop === refinement.prop ? Number(item.value) || 0 : 0); }, 0);
                    if (spent !== Number(plan.cost && plan.cost.lianjin) || Math.abs(total - Number(refinement.total)) > 1e-9) throw new Error('이전 계획과 현재 재계산 결과가 일치하지 않습니다. 다시 계산한 뒤 즐겨찾기에 등록하세요');
                    route.rows = refineRows(replay.items, refinement.prop, cutoff);
                } catch (error) { route.error = String(error.message || error); }
                return route;
            });
            return { schema: 2, count: count, rows: refineRows(items), routes: routes };
        } catch (error) { return null; }
    }

    function captureRegion(candidate) {
        try {
            if (typeof equipAutoRegionSimulate !== 'function') return null;
            var simulated = equipAutoRegionSimulate(candidate, 1000);
            var rows = (simulated && simulated.rows || []).slice(0, MAX_REGION_ROWS).map(function (row) {
                var region = (row.region || []).map(function (entry) {
                    return label(entry.prop) + '+' + fmtValue(entry.prop, entry.value);
                }).join('、') || '-';
                return [
                    String(row.place || '') + (row.name && row.name !== row.place ? ' · ' + row.name : ''),
                    row.index ? '제 ' + row.index + '회' : '-',
                    region,
                ];
            });
            return { rows: rows, error: simulated && simulated.error ? String(simulated.error) : '' };
        } catch (error) {
            return { rows: [], error: String(error && error.message || error) };
        }
    }

    /* 淬炼面板结构复杂（多档方案、消耗芯片、路径），
       直接调用现成面板拿渲染结果，存 HTML，比复刻一份渲染器更稳。 */
    function captureForge(candidate, opts) {
        try {
            var wantForge = Number(opts && opts.forgeCount);
            if (Number.isFinite(wantForge) && wantForge <= 0) return null;
            var n = Number.isFinite(wantForge) && wantForge > 0 ? Math.min(2000, Math.max(10, Math.round(wantForge))) : 300;
            if (typeof root.equipAutoStrongPreviewData !== 'function'
                || typeof root.equipAutoStrongPreviewBuild !== 'function') return null;

            var data = root.equipAutoStrongPreviewData(candidate, n);
            var items = (data && data.items || []).slice(0, n);
            if (!items.length) return null;

            var needLv = 0;
            try {
                var meta = (root.EQUIP_DATA && root.EQUIP_DATA.equipment) ? root.EQUIP_DATA.equipment[String(candidate.equipId)] : null;
                needLv = Number(meta && meta.need_lv) || 0;
            } catch (error) { }

            var target = 15;
            var minGrade = 3;
            var plans = root.equipAutoStrongPreviewPlans(items, data.level, target, minGrade, needLv);
            var html = root.equipAutoStrongPreviewBuild({
                candidate: candidate, n: items.length, target: target, minGrade: minGrade,
                items: items, level: data.level, plans: plans
            });
            if (!html) return null;
            return {
                n: items.length,
                target: target,
                minGrade: minGrade,
                level: data.level || 0,
                needLv: needLv,
                items: items,
                html: html
            };
        } catch (error) {
            return null;
        }
    }

    function capture(candidate, opts) {
        var views = {};
        var refine = captureRefine(candidate, opts);
        if (refine) views.refine = refine;
        var region = captureRegion(candidate);
        if (region) views.region = region;
        var forge = captureForge(candidate, opts);
        if (forge) views.forge = forge;
        return views;
    }

    /* ---------------- 点开时：只用存下来的数据渲染 ---------------- */

    function modal(title, subtitle, bodyHtml, footerNote) {
        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-confirm equip-auto-forge-modal';
        wrap.innerHTML = '<div class="equip-auto-forge-card" role="dialog" aria-modal="true">'
            + '<div class="equip-auto-forge-head"><div><strong>' + esc(title) + '</strong>'
            + '<span>' + esc(subtitle || '') + '</span></div>'
            + '<button type="button" class="equip-auto-forge-close" aria-label="닫기" title="닫기">×</button></div>'
            + bodyHtml
            + '<div class="equip-auto-forge-footer"><button type="button" class="equip-auto-forge-foot-close button">닫기</button></div>'
            + '</div>';
        document.body.appendChild(wrap);

        function close() {
            document.removeEventListener('keydown', onKey);
            wrap.remove();
        }
        function onKey(event) { if (event.key === 'Escape') close(); }

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
        return wrap;
    }

    function refineCostText(cost, upgrade) {
        var materials = new Map(), silver = 0;
        function add(item, amount) { if (!item || !(Number(amount) > 0)) return; var key = String(item.id || item.name); var row = materials.get(key) || { name: item.name || key, amount: 0 }; row.amount += Number(amount); materials.set(key, row); }
        [cost, upgrade].forEach(function (part) { if (!part) return; (part.materials || []).forEach(function (item) { add(item, item.amount); }); add(part.mainMaterial, part.mainAmount); add({ id: 8801, name: '연금니' }, part.lianjin); silver += Number(part.silver) || 0; });
        var text = Array.from(materials.values()).map(function (item) { return item.name + '×' + item.amount.toLocaleString(); });
        if (silver) text.push('은냥' + (Math.floor(silver / 1000) ? Math.floor(silver / 1000).toLocaleString() + '냥' : '') + (silver % 1000 ? silver % 1000 + '문' : ''));
        return text.join(' · ') || '없음';
    }

    function openRefine(candidate, views) {
        var data = views && views.refine;
        if (!data || !Array.isArray(data.rows) || (!data.rows.length && !(data.routes || []).length)) return false;
        var routes = Array.isArray(data.routes) ? data.routes : [];
        var body = '<div class="equip-auto-forge-controls">'
            + '<label>조회 <select id="cvRefineRoute">'
            + routes.map(function (route, index) { return '<option value="' + index + '">' + esc(route.title || label(route.prop)) + ' · 유지 계획</option>'; }).join('')
            + '<option value="raw">원본 순서(옵션 유지 없음)</option></select></label>'
            + '<label>옵션 슬롯 <select id="cvRefineSlot"></select></label>'
            + '<label>능력치 <select id="cvRefineProp"></select></label>'
            + '<span class="equip-auto-forge-meta" id="cvRefineMeta"></span></div>'
            + '<div class="equip-auto-forge-meta" id="cvRefineSummary"></div>'
            + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table" style="min-width:760px">'
            + '<thead><tr><th>횟수</th><th>슬롯</th><th>옵션 변경</th><th>처리</th><th>배율</th><th>누적 연금니</th><th>레벨</th></tr></thead><tbody></tbody></table></div>';
        var old = document.querySelector('.equip-auto-forge-modal'); if (old) old.remove();
        var wrap = modal('정련 상세 · ' + koEquipName(candidate), '장비의 옵션 유지 계획에 따라 종료 회차까지 정련 순서를 표시합니다.', body);
        var tbody = wrap.querySelector('tbody'), meta = wrap.querySelector('#cvRefineMeta'), summary = wrap.querySelector('#cvRefineSummary');
        var routeSel = wrap.querySelector('#cvRefineRoute'), slotSel = wrap.querySelector('#cvRefineSlot'), propSel = wrap.querySelector('#cvRefineProp');
        var rows = [], route = null;
        function paint() {
            var slot = slotSel.value, prop = propSel.value;
            var shown = rows.filter(function (row) { return (!slot || String(row[1]) === slot) && (!prop || String(row[3] || '').indexOf(prop + '+') === 0); });
            meta.textContent = '표시 ' + shown.length + ' / ' + rows.length + '개';
            tbody.innerHTML = shown.length ? shown.map(function (row) {
                return '<tr class="' + (/^(?:목표 유지|임시 잠금|目标保留|临时锁定)/.test(String(row[6] || '')) ? 'row-keep' : '') + '"><td>제 ' + esc(row[0]) + '회</td><td>슬롯 ' + esc(row[1]) + '</td><td>' + esc(row[2]) + ' → ' + esc(row[3]) + '</td><td>' + esc(row[6] || '유지 안 함') + '</td><td>×' + esc(row[4]) + '</td><td>' + esc(row[7] == null ? '—' : row[7]) + '</td><td>' + esc(row[5]) + '</td></tr>';
            }).join('') : '<tr><td colspan="7">' + esc(route && route.error ? route.error : route && !route.cutoff ? '새로 유지할 옵션이 필요하지 않습니다. 현재 옵션을 유지합니다' : '검색 조건에 맞는 정련 기록이 없습니다') + '</td></tr>';
        }
        function selectRoute() {
            route = routeSel.value === 'raw' ? null : routes[Number(routeSel.value)];
            rows = route ? route.rows || [] : data.rows;
            if (route && route.error) summary.textContent = route.error;
            else if (route) {
                var ending = rows.filter(function (row) { return ! /^(?:不保留|유지 안 함)/.test(String(row[6] || '')); }).map(function (row) { return '#' + row[0] + '(슬롯 ' + row[1] + ')'; }).join(' → ') || '추가로 유지할 옵션 없음';
                summary.textContent = '상태 재현: ' + ending + (route.cutoff ? ', 제' + route.cutoff + '회까지 진행' : '') + '\n정련 소모: ' + refineCostText(route.cost) + '\n총 소모(승련+정련): ' + refineCostText(route.cost, route.upgradeCost);
            } else summary.textContent = routes.length ? '원본 순서에는 옵션 유지 계획이 적용되지 않았습니다. 실제 경로는 다를 수 있습니다' : '기존 즐겨찾기에는 원본 순서만 저장되어 옵션 유지 계획을 확인할 수 없습니다';
            summary.style.whiteSpace = 'pre-line';
            var slots = {}, props = {}; rows.forEach(function (row) { slots[String(row[1])] = '슬롯 ' + row[1]; var name = String(row[3] || '').split('+')[0]; if (name) props[name] = name; });
            slotSel.innerHTML = '<option value="">전체</option>' + Object.keys(slots).sort().map(function (key) { return '<option value="' + esc(key) + '">' + esc(slots[key]) + '</option>'; }).join('');
            propSel.innerHTML = '<option value="">전체</option>' + Object.keys(props).sort().map(function (key) { return '<option value="' + esc(key) + '">' + esc(key) + '</option>'; }).join('');
            paint();
        }
        routeSel.value = routes.length ? '0' : 'raw'; routeSel.addEventListener('change', selectRoute); slotSel.addEventListener('change', paint); propSel.addEventListener('change', paint); selectRoute();
        return true;
    }

    function openRegion(candidate, views) {
        var data = views && views.region;
        if (!data) return false;
        var body = '<p class="equip-auto-forge-meta">같은 도면과 제작 진행도에서 다른 장인에게 각각 1,000회 제작을 예측합니다. '
            + '옵션 종류·개수·수치가 완전히 같은 장비가 처음 등장하는 회차를 찾습니다.</p>'
            + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table">'
            + '<thead><tr><th>장인 / 지역</th><th>횟수</th><th>지역 추가 옵션</th></tr></thead><tbody>'
            + (data.error && !(data.rows || []).length
                ? '<tr><td colspan="3">' + esc(data.error) + '</td></tr>'
                : ((data.rows || []).length
                    ? data.rows.map(function (row) {
                        return '<tr><td>' + esc(row[0]) + '</td><td>' + esc(row[1]) + '</td><td>' + esc(row[2]) + '</td></tr>';
                    }).join('')
                    : '<tr><td colspan="3">다른 장인에게서 이 장비를 제작할 수 없습니다</td></tr>'))
            + '</tbody></table></div>';
        modal('다른 장인의 추가 옵션 · ' + koEquipName(candidate), '저장된 계산 결과를 표시합니다', body);
        return true;
    }

    /* 淬炼面板：存的是「整张 card 的 HTML + 当时的 items」。
       有 items 就能在藏兵阁里改长度重新算方案（只重算方案，不重跑内核）；
       早期收藏只有 HTML、没有 items，那种就退回只读快照。 */
    function openForge(candidate, views) {
        var data = views && views.forge;
        if (!data || !data.html) return false;

        var items = Array.isArray(data.items) ? data.items : null;
        var canRerun = !!(items && items.length
            && typeof root.equipAutoStrongPreviewBuild === 'function'
            && typeof root.equipAutoStrongPreviewPlans === 'function');

        var wrap = document.createElement('div');
        wrap.className = 'equip-auto-confirm equip-auto-forge-modal';
        wrap.innerHTML = '<div class="equip-auto-forge-card" role="dialog" aria-modal="true"></div>';
        document.body.appendChild(wrap);
        var card = wrap.querySelector('.equip-auto-forge-card');

        function close() {
            document.removeEventListener('keydown', onKey);
            wrap.remove();
        }
        function onKey(event) { if (event.key === 'Escape') close(); }

        function bindShell() {
            var closers = wrap.querySelectorAll('.equip-auto-forge-close, .equip-auto-forge-foot-close');
            Array.prototype.forEach.call(closers, function (btn) { btn.addEventListener('click', close); });
            var downOnBackdrop = false;
            wrap.addEventListener('mousedown', function (event) { downOnBackdrop = (event.target === wrap); });
            wrap.addEventListener('click', function (event) {
                var selecting = false;
                try { selecting = String(window.getSelection ? window.getSelection() : '').length > 0; } catch (error) { }
                if (downOnBackdrop && event.target === wrap && !selecting) close();
                downOnBackdrop = false;
            });
            document.addEventListener('keydown', onKey);
        }

        function paint(n, target, minGrade) {
            var limit = Math.max(10, Math.min(items.length, Math.round(n)));
            var sliced = items.slice(0, limit);
            var plans = root.equipAutoStrongPreviewPlans(sliced, data.level, target, minGrade, data.needLv || 0);
            var html = root.equipAutoStrongPreviewBuild({
                candidate: candidate, n: limit, target: target, minGrade: minGrade,
                items: sliced, level: data.level, plans: plans
            });
            card.innerHTML = html || data.html;
            bindControls();
            addLimitNote(limit);
        }

        /* 说明「最多只能用到收藏时缓存的次数」，长度够不到目标时给出下一步 */
        function addLimitNote(limit) {
            if (!canRerun) return;
            var controls = card.querySelector('.equip-auto-forge-controls');
            if (!controls || !controls.parentNode) return;
            var old = controls.parentNode.querySelector('.equip-auto-forge-limit-note');
            if (old) old.remove();
            var note = document.createElement('p');
            note.className = 'equip-auto-forge-meta equip-auto-forge-limit-note';
            var capped = limit >= items.length;
            var plansFailed = true;
            try {
                var cards = card.querySelectorAll('.equip-auto-forge-plan');
                plansFailed = cards.length > 0 && Array.prototype.every.call(cards, function (el) {
                    return el.classList.contains('is-fail');
                });
            } catch (error) { }
            var text = capped
                ? '최대 사용 가능 ' + items.length + '회까지 계산 가능합니다. 더 긴 순서는 자동 탐색에서 다시 계산한 뒤 즐겨찾기에 저장하세요.'
                : '이번 계산에 사용한 횟수 ' + limit + '회, 최대 ' + items.length + '회.';
            if (capped && plansFailed) {
                text += ' 현재 조건으로 목표 촉련 단계에 도달할 수 없습니다. 목표 단계를 낮추거나 허용 등급을 완화하세요.';
            }
            note.textContent = text;
            if (capped) {
                var go = document.createElement('a');
                go.href = '../auto/index.html';
                go.textContent = '자동 탐색에서 더 긴 순서 계산';
                go.style.marginLeft = '0.2rem';
                note.appendChild(go);
            }
            controls.parentNode.insertBefore(note, controls.nextSibling);
        }

        function bindControls() {
            var runBtn = card.querySelector('.equip-auto-forge-run');
            var nInput = card.querySelector('.equip-auto-forge-n');
            var targetSel = card.querySelector('.equip-auto-forge-target');
            var gradeSel = card.querySelector('.equip-auto-forge-grade');
            if (nInput) {
                nInput.max = String(items ? items.length : 2000);
                nInput.title = items ? '최대 ' + items.length + '회(즐겨찾기 저장 시 보관된 데이터)' : '';
            }
            if (runBtn && canRerun) {
                runBtn.addEventListener('click', function () {
                    var n = Math.max(10, Math.min(items.length, Number(nInput && nInput.value) || items.length));
                    if (nInput) nInput.value = String(n);
                    paint(n, Number(targetSel && targetSel.value) || data.target || 15,
                        Number(gradeSel && gradeSel.value) || data.minGrade || 3);
                });
            } else if (runBtn) {
                runBtn.disabled = true;
            }
        }

        if (canRerun) {
            paint(data.n || items.length, data.target || 15, data.minGrade || 3);
        } else {
            card.innerHTML = data.html;
            var frozen = wrap.querySelectorAll('.equip-auto-forge-controls input, .equip-auto-forge-controls select, .equip-auto-forge-run');
            Array.prototype.forEach.call(frozen, function (el) { el.disabled = true; });
            var controls = wrap.querySelector('.equip-auto-forge-controls');
            if (controls && controls.parentNode && !controls.parentNode.querySelector('.equip-auto-forge-frozen-note')) {
                var hint = document.createElement('p');
                hint.className = 'equip-auto-forge-meta equip-auto-forge-frozen-note';
                hint.textContent = '이전 버전에서 저장한 장비입니다. 자동 탐색을 한 번 열어 계산 데이터를 갱신하면 조회 횟수를 변경할 수 있습니다.';
                controls.parentNode.insertBefore(hint, controls.nextSibling);
            }
        }
        bindShell();
        return true;
    }

    /* 芒晶洗练：只显示收藏时算好的结果——前三大 + 可展开的全部明细 */
    function openMang(candidate, views) {
        var data = views && views.mang;
        if (!data) return false;

        var items = Array.isArray(data.items) ? data.items : null;
        var maxima = (data.maxima || []).filter(function (item) { return item && item.recommendedIndex != null; });
        var body;

        if (items && items.length) {
            var byProp = {};
            items.forEach(function (item) {
                var key = String(item.prop);
                (byProp[key] = byProp[key] || []).push(item);
            });
            var topRows = [];
            Object.keys(byProp).forEach(function (key) {
                byProp[key].slice().sort(function (a, b) { return Number(b.value) - Number(a.value); })
                    .slice(0, 3)
                    .forEach(function (item, i) {
                        topRows.push({ rank: i + 1, prop: item.prop, value: item.value, index: item.index });
                    });
            });

            var topHtml = topRows.map(function (row) {
                return '<tr>'
                    + '<td>제 ' + esc(row.rank) + '</td>'
                    + '<td>' + esc(label(row.prop)) + '</td>'
                    + '<td>+' + esc(fmtValue(row.prop, row.value)) + '</td>'
                    + '<td>제 ' + esc(row.index) + '회</td>'
                    + '</tr>';
            }).join('');

            var allRows = items.map(function (item) {
                return '<tr><td>제 ' + esc(item.index) + '회</td>'
                    + '<td>' + esc(label(item.prop)) + '</td>'
                    + '<td>+' + esc(fmtValue(item.prop, item.value)) + '</td></tr>';
            }).join('');

            var levelText = data.level ? (esc(data.level) + '레벨') : '';
            var parts = [];
            if (data.materialName) parts.push('재료: ' + esc(koText(data.materialName)));
            if (levelText) parts.push(levelText);
            body = '<p class="equip-auto-forge-meta">망정 ' + esc(data.count || items.length) + '회 계산 결과'
                + (parts.length ? '（' + parts.join(' · ') + '）' : '')
                + '. 능력치별 상위 3개 결과입니다.</p>'
                + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table">'
                + '<thead><tr><th>순위</th><th>능력치</th><th>수치</th><th>횟수</th></tr></thead>'
                + '<tbody>' + topHtml + '</tbody></table></div>'
                + '<details class="equip-auto-mang-all"><summary>전체 ' + items.length + '회 상세 보기</summary>'
                + '<div class="equip-auto-forge-table-wrap" style="margin-top:.5rem"><table class="equip-auto-forge-table">'
                + '<thead><tr><th>횟수</th><th>능력치</th><th>수치</th></tr></thead>'
                + '<tbody>' + allRows + '</tbody></table></div></details>';
        } else {
            maxima.sort(function (a, b) { return Number(b.value) - Number(a.value); });
            var mrows = maxima.length
                ? maxima.map(function (item) {
                    return '<tr><td>' + esc(label(item.prop)) + '</td>'
                        + '<td>+' + esc(fmtValue(item.prop, item.value)) + '</td>'
                        + '<td>제 ' + esc(item.recommendedIndex) + '회</td></tr>';
                }).join('')
                : '<tr><td colspan="3">이 장비에서 얻을 수 있는 망정 추가 옵션이 없습니다</td></tr>';
            body = '<p class="equip-auto-forge-meta">이전에 저장한 결과로, 능력치별 최고값만 남아 있습니다(총 '
                + esc(data.count || '') + '회). 자동 탐색에서 다시 즐겨찾기에 등록하면 상세 순서를 확인할 수 있습니다.</p>'
                + '<div class="equip-auto-forge-table-wrap"><table class="equip-auto-forge-table">'
                + '<thead><tr><th>능력치</th><th>최고 수치</th><th>획득 횟수</th></tr></thead><tbody>' + mrows + '</tbody></table></div>';
        }

        modal('망정 · ' + koEquipName(candidate), '해당 장비의 망정 예측 결과', body);
        return true;
    }

    root.EquipCardViews = {
        openMang: openMang,
        maxRefineRows: MAX_REFINE_ROWS,
        capture: capture,
        captureForgeOnly: captureForge,
        captureRefineOnly: captureRefine,
        openRefine: openRefine,
        openRegion: openRegion,
        openForge: openForge,
    };
})(typeof window !== 'undefined' ? window : this);
