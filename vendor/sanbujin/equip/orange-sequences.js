(function (root) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value)), count = 20;
    const preferredNpc = type => [5, 6, 7].includes(Number(type)) ? 31230 : 40520;
    function papers(data) {
        return Object.values(data.papers).filter(p => p.min_color === 5 && p.max_color === 5 && data.equipment[p.dz_equip] && p.dz_equip !== 5632 && (data.equipment[p.dz_equip].lv !== 100 || p.dz_equip === 5021))
            .sort((a, b) => data.equipment[b.dz_equip].lv - data.equipment[a.dz_equip].lv || a.id - b.id);
    }
    function craftsmen(data, paper) {
        const cfg = data.equipment[paper.dz_equip], category = [5, 6, 7].includes(Number(cfg.type)) ? 'fengzhi' : 'dazao';
        return Object.values(data.craftsman).filter(n => n.zhi === category)
            .sort((a, b) => Number(b.id === preferredNpc(cfg.type)) - Number(a.id === preferredNpc(cfg.type)) || a.id - b.id);
    }
    function paddingPapers(data, paper) {
        const cfg = data.equipment[paper.dz_equip];
        if (cfg.lv >= 100) return []; // 영호아대는 일반 100급 도면이 없으므로 선행 제작 불가
        return Object.values(data.papers).filter(p => {
            const e = data.equipment[p.dz_equip];
            return e && e.lv === cfg.lv && e.type === cfg.type && p.min_color <= 4 && p.max_color <= 4;
        }).sort((a, b) => a.id - b.id);
    }
    function request(paper, npc, materialId = 0) {
        return { npc_id: npc.id, select_id: paper.id, equip_id: paper.dz_equip,
            min_color: paper.min_color, max_color: paper.max_color, special_id: Number(materialId) || 0 };
    }
    function equipment(data, paper, result) {
        if (result.error) throw Error(result.error);
        const cfg = data.equipment[paper.dz_equip], czSeed = result.CZSeed ?? result.cz_seed;
        const mjSeed = czSeed - paper.id * 198;
        if (!Number.isSafeInteger(mjSeed) || mjSeed <= 0) throw Error('这次打造缺少有效芒晶进度');
        return { id: cfg.id, name: cfg.name, typ: cfg.type, need_lv: cfg.lv, color: result.color, level: 0, lv_prop: 0,
            S: result.S ?? result.s, CZSeed: czSeed, MJSeed: mjSeed, XLLevel: 0, XLNumber: 0,
            exts: clone(result.exts || []), base: clone(result.base || {}), specials: clone(result.special || []), xilian_marks: [] };
    }
    root.OrangeForgeSequences = Object.freeze({ count, papers, craftsmen, paddingPapers, request, equipment });
    if (typeof document === 'undefined') return;
    document.addEventListener('DOMContentLoaded', () => {
        const $ = id => document.getElementById(id);
        if (!$('panelOrange') || root.SBJ_FEATURE_PAGE === 'jianwang-manual') return;
        const paperSelect = $('orangePaperSelect'), npcSelect = $('orangeNpcSelect'), paddingSelect = $('orangePaddingPaper');
        const forgeMaterial = $('orangeForgeMaterial');
        let mjMaterialId = '2021';
        const status = $('orangeSequenceStatus'), results = $('orangeSequenceResults'), dialog = $('orangeSequenceDialog');
        let generation = 0, startFingerprint = '', selected = null, resultCache = [];
        const fingerprint = () => JSON.stringify(wasmMakeGetState());
        const npcName = npc => [npc.place, npc.name].filter(Boolean).join(' · ');
        const props = (items, empty = '无附加') => items?.length ? items.map(p => escapeHtml(propLabel(p.prop)) + '+' + formatPropValue(p.prop, p.value)).join(' / ') : empty;
        function option(select, value, label) { const el = document.createElement('option');el.value = value;el.textContent = label;select.append(el); }
        function invalidate(message = '选择图纸、NPC 和垫刀次数后查询') {
            generation++;selected = null;resultCache = [];startFingerprint = '';results.replaceChildren();status.textContent = message;
            $('btnOrangePreview').disabled = false;$('btnOrangeCancel').hidden = true;if (dialog.open) dialog.close();
        }
        function checkState() { if (startFingerprint && startFingerprint !== fingerprint()) invalidate('模拟状态已改变，请重新查询'); }
        root.OrangeForgeUI = { invalidate, checkState };
        function fillConfig() {
            const paper = EQUIP_DATA.papers[paperSelect.value], oldNpc = npcSelect.value, oldPad = paddingSelect.value;
            const oldMat = forgeMaterial.value;
            for (const s of [npcSelect, paddingSelect, forgeMaterial]) s.replaceChildren();
            option(forgeMaterial, 0, '不加特殊材料');
            if (!paper) { invalidate('没有匹配的橙装图纸');return; }
            const cfg = EQUIP_DATA.equipment[paper.dz_equip], npcs = craftsmen(EQUIP_DATA, paper), pads = paddingPapers(EQUIP_DATA, paper);
            for (const npc of npcs) option(npcSelect, npc.id, npcName(npc));
            if (npcs.some(n => String(n.id) === oldNpc)) npcSelect.value = oldNpc;
            for (const p of pads) option(paddingSelect, p.id, p.name + ' · ' + cfg.lv + '级');
            const desired = pads.some(p => String(p.id) === oldPad) ? oldPad : pads.some(p => p.id === 2583) ? '2583' : '';
            if (desired) paddingSelect.value = desired;
            paddingSelect.disabled = !pads.length;
            $('orangePaddingCount').disabled = !pads.length;
            if (!pads.length) { option(paddingSelect, '', '선행 제작 불가');$('orangePaddingCount').value = 0; }
            for (const m of specialMaterialsForEquip(cfg)) option(forgeMaterial, m.id, m.name);
            if ([...forgeMaterial.options].some(o => o.value === oldMat)) forgeMaterial.value = oldMat;
            $('orangePaddingHint').textContent = cfg.lv >= 100
                ? '영호아대: 100급 일반 제작 도면이 없어 선행 제작할 수 없습니다. 최초 1회 제작의 지역 옵션만 조회합니다. 망정 순서는 그대로 조회할 수 있습니다.'
                : '선행 제작과 마지막 주황 장비 제작은 선택한 장인에게서 진행합니다. 추가 재료는 마지막 제작에만 적용합니다.';
            invalidate();
        }
        function fillPapers() {
            const previous = paperSelect.value || '3468', term = $('orangePaperSearch').value.trim().toLocaleLowerCase();
            const list = papers(EQUIP_DATA).filter(p => (p.name + ' ' + EQUIP_DATA.equipment[p.dz_equip].name).toLocaleLowerCase().includes(term));
            paperSelect.replaceChildren();for (const p of list) { const cfg = EQUIP_DATA.equipment[p.dz_equip];option(paperSelect, p.id, cfg.name + ' · ' + cfg.lv + '级 · ' + p.name); }
            if (list.some(p => String(p.id) === previous)) paperSelect.value = previous;
            fillConfig();
        }
        function table(title, heads, rows) {
            return '<h3>' + title + '</h3><div class="table-wrap"><table class="preview-table"><thead><tr>'
                + heads.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
                + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
        }
        function renderMangjing() {
            if (!selected) return;
            const material = EQUIP_DATA.special[$('orangeMangjingMaterial').value], equip = selected.equip;
            mjMaterialId = $('orangeMangjingMaterial').value;
            $('orangeMangjingCost').textContent = '每次消耗 ' + Math.floor(equip.need_lv / 10) + ' 个芒晶及对应特殊材料；从本次垫刀后打造出的这件装备开始连续洗炼。';
            try {
                if (!material) throw Error('该装备没有可用的附加材料');
                const rows = predictSpecialAttachSequence(equip, material, count);
                $('orangeMangjingResults').innerHTML = table('芒晶序列 · 前20次', ['次数', '附加属性', '品质比例'], rows.map(r => [r.index, props([r]), r.factor + '%']));
            } catch (error) { $('orangeMangjingResults').textContent = '芒晶序列：' + error.message; }
        }
        function openDetail(kind) {
            checkState();if (!selected) return;
            const { equip, result, npc, paddingCount } = selected;
            $('orangeDetailTitle').textContent = equip.name + ' · 垫' + paddingCount + '次后打造';
            $('orangeDetailOrigin').textContent = npcName(npc) + ' · 地区附加：' + (result.region?.length ? result.region.map(p => propLabel(p.prop) + '+' + formatPropValue(p.prop, p.value)).join(' / ') : '无附加');
            const select = $('orangeMangjingMaterial');select.replaceChildren();
            for (const m of specialMaterialsForEquip(equip)) option(select, m.id, m.name);
            if ([...select.options].some(o => o.value === mjMaterialId)) select.value = mjMaterialId;
            else if ([...select.options].some(o => o.value === '2021')) select.value = '2021';
            renderMangjing();
            const strong = $('orangeStrongResults');strong.replaceChildren();
            if ([1, 2, 3, 4].includes(Number(equip.typ))) {
                const response = wasmStrongPreview(toWasmEquip(equip), count);
                if (response.error) throw Error(response.error);
                strong.innerHTML = table('武器淬炼序列 · 前20次（同层参考）', ['次数', '结果', '增幅'],
                    response.items.map(r => [r.index, escapeHtml(r.grade_name), '+' + r.add_lv_prop / 2 + '%']))
                    + '<p class="meta-text">按新武器初始层数展示；接受结果会改变层数，后续增幅以实际层数为准。</p>';
            }
            dialog.showModal();if (kind === 'strong') strong.scrollIntoView({ block: 'start' });
        }
        async function renderResults(items, paper, npc, padPaper, maximum, ticket) {
            const cfg = EQUIP_DATA.equipment[paper.dz_equip], weapon = [1, 2, 3, 4].includes(Number(cfg.type));
            
            const card = document.createElement('section');card.className = 'config-panel orange-query-result';card.dataset.npc = npc.id;
            card.innerHTML = '<h2>' + escapeHtml(cfg.name) + ' · ' + escapeHtml(npcName(npc)) + '</h2><p>'
                + '선행 제작 0~' + maximum + '회, 총 ' + items.length + '개 결과입니다. 같은 세이브에서 시작하여 '
                + escapeHtml(padPaper?.name || '일반 장비') + ' 제작 이후 주황 장비를 1회 제작합니다.</p><p>고정 옵션: ' + props(items[0]?.exts, '无固定词条')
                + '</p><div class="table-wrap orange-result-table-wrap"><table class="preview-table orange-query-table"><thead><tr><th>垫刀次数</th><th>地区附加</th><th>打造后红词条</th><th>详细序列</th></tr></thead><tbody></tbody></table></div>';
            results.replaceChildren(card);const body = card.querySelector('tbody');resultCache = [];
            card.addEventListener('click', event => {
                const button = event.target.closest('[data-orange-detail]');if (!button) return;
                selected = resultCache[Number(button.dataset.orangeIndex)];
                try { openDetail(button.dataset.orangeDetail); } catch (e) { status.textContent = '读取失败：' + e.message; }
            });
            for (let start = 0; start < items.length; start += 50) {
                if (ticket !== generation) return;
                const html = items.slice(start, start + 50).map((result, offset) => {
                    const index = start + offset, equip = equipment(EQUIP_DATA, paper, result), paddingCount = result.padding_count ?? index;
                    resultCache.push({ result, equip, npc, paddingCount });
                    const button = (kind, label) => '<button type="button" class="btn btn-reset" data-orange-index="' + index + '" data-orange-detail="' + kind + '">' + label + '</button>';
                    return '<tr data-padding-count="' + paddingCount + '"><td>' + paddingCount + '</td><td class="orange-region-result">' + props(result.region)
                        + '</td><td>' + props(result.special) + '</td><td><div class="orange-row-actions">'
                        + button('mangjing', '查芒晶') + (weapon ? button('strong', '查淬炼') : '') + '</div></td></tr>';
                }).join('');body.insertAdjacentHTML('beforeend', html);
                if (start + 50 < items.length) await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        async function generate() {
            if (!saveLoaded) { status.textContent = '请先导入存档';return; }
            const paper = EQUIP_DATA.papers[paperSelect.value], npc = EQUIP_DATA.craftsman[npcSelect.value], padPaper = EQUIP_DATA.papers[paddingSelect.value];
            const paddingCount = EQUIP_DATA.equipment[paper?.dz_equip]?.lv >= 100 ? 0 : Number($('orangePaddingCount').value);
            if (!paper || !npc) { status.textContent = '도면과 장인을 선택하세요.';return; }
            if (!Number.isSafeInteger(paddingCount) || paddingCount < 0 || paddingCount > 5000) { status.textContent = '垫刀次数必须是0–5000的整数';return; }
            if (paddingCount && !padPaper) { status.textContent = '동일 등급·종류의 일반 제작 도면을 선택하세요.';return; }
            const targetRequest = request(paper, npc, forgeMaterial.value), padRequest = padPaper ? request(padPaper, npc) : null;
            invalidate();const ticket = generation, state = clone(wasmMakeGetState());startFingerprint = JSON.stringify(state);
            $('btnOrangePreview').disabled = true;$('btnOrangeCancel').hidden = false;status.textContent = '正在计算垫' + paddingCount + '次后的打造结果…';
            try {
                const response = await backgroundMakePreview(targetRequest, paddingCount + 1, state, padRequest);
                if (ticket !== generation) return;
                if (fingerprint() !== startFingerprint) { invalidate('模拟状态已改变，请重新查询');return; }
                if (response.error) throw Error(response.error);
                await renderResults(response.items, paper, npc, padPaper, paddingCount, ticket);
                if (ticket !== generation) return;
                status.textContent = '已列出垫0～' + paddingCount + '次的全部' + (paddingCount + 1) + '个方案。每行只打造1次橙装，未推进存档或模拟背包。';
            } catch (e) { if (ticket === generation) status.textContent = '查询失败：' + e.message; }
            finally { if (ticket === generation) { $('btnOrangePreview').disabled = false;$('btnOrangeCancel').hidden = true; } }
        }
        $('orangePaperSearch').addEventListener('input', fillPapers);paperSelect.addEventListener('change', fillConfig);
        for (const el of [npcSelect, paddingSelect, forgeMaterial, $('orangePaddingCount')]) el.addEventListener('change', () => invalidate());
        $('btnOrangePreview').addEventListener('click', generate);$('btnOrangeCancel').addEventListener('click', () => invalidate('已停止查询'));
        $('orangeDetailClose').addEventListener('click', () => dialog.close());$('orangeMangjingMaterial').addEventListener('change', renderMangjing);
        dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect();if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
        fillPapers();
    });
})(typeof window !== 'undefined' ? window : globalThis);
