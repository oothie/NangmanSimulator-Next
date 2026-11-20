/* 装备收藏 · 本地轻量收藏层
 *
 * 只保存在当前浏览器 localStorage，不上传、不参与解密。
 *
 * 2026-10-25 改版：
 *   1) 不再按「存档身份」分区。旧版按 version|platform|channel|主角名 分区，
 *      换一份存档（甚至只是游戏版本号变了）就看不到之前的收藏，等于数据丢失。
 *      现在统一一个全局键，所有存档共用一份收藏。
 *   2) 启动时把旧的 v1 分区键合并迁移过来（按 onlyId 去重），迁移后不删旧键。
 *   3) 增加备份/恢复（JSON）：localStorage 跟着域名走，换个链接（新域名/新隧道）
 *      就是一份空存储，只能靠备份搬过去。
 */
(function (root) {
    'use strict';

    const KEY = 'yyjh_equip_favorites_v2';
    const LEGACY_PREFIX = 'yyjh_equip_favorites_v1';
    const MAX_ITEMS = 0;

    function readList() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (error) {
            return [];
        }
    }

    function writeList(list) {
        try {
            localStorage.setItem(KEY, JSON.stringify(list.slice()));
            return true;
        } catch (error) {
            return false;
        }
    }

    /* 把旧版按存档分区的收藏合并成一份（只在还没有 v2 数据时做一次） */
    function migrateLegacy() {
        try {
            if (localStorage.getItem(KEY)) return;
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const k = localStorage.key(i);
                if (k && k.indexOf(LEGACY_PREFIX) === 0) keys.push(k);
            }
            if (!keys.length) return;
            const merged = [];
            const seen = Object.create(null);
            keys.forEach(k => {
                let list = [];
                try { list = JSON.parse(localStorage.getItem(k) || '[]'); } catch (error) { list = []; }
                if (!Array.isArray(list)) return;
                list.forEach(item => {
                    const id = String(item && item.onlyId);
                    if (!id || seen[id]) return;
                    seen[id] = 1;
                    merged.push(item);
                });
            });
            if (merged.length) localStorage.setItem(KEY, JSON.stringify(merged));
        } catch (error) { /* 无痕模式等：忽略 */ }
    }

    function keyOf(onlyId) {
        return String(onlyId ?? '');
    }

    function normalizeItem(item) {
        return {
            onlyId: String(item.onlyId ?? ''),
            name: String(item.name || ''),
            needLv: Number(item.needLv) || 0,
            color: item.color ?? '',
            colorText: String(item.colorText || ''),
            typ: item.typ ?? '',
            typText: String(item.typText || ''),
            propsText: String(item.propsText || ''),
            note: String(item.note || ''),
            refineable: !!item.refineable,
            savedAt: Number(item.savedAt) || Date.now(),
        };
    }

    const EquipFavorites = {
        maxItems: MAX_ITEMS,
        storageKey: KEY,
        /* 下面的 archiveId 参数只为兼容旧调用，已不参与分区 */
        list() {
            migrateLegacy();
            return readList();
        },
        has(archiveId, onlyId) {
            return readList().some(item => item.onlyId === keyOf(onlyId));
        },
        toggle(archiveId, item) {
            const list = readList();
            const key = keyOf(item && item.onlyId);
            if (!key) return null;
            const index = list.findIndex(row => row.onlyId === key);
            if (index >= 0) {
                list.splice(index, 1);
                writeList(list);
                return false;
            }
            list.unshift(normalizeItem(item));
            writeList(list);
            return true;
        },
        remove(archiveId, onlyId) {
            writeList(readList().filter(row => row.onlyId !== keyOf(onlyId)));
        },
        setNote(archiveId, onlyId, note) {
            const list = readList();
            const row = list.find(item => item.onlyId === keyOf(onlyId));
            if (!row) return;
            row.note = String(note || '');
            writeList(list);
        },
        clear() {
            writeList([]);
        },
        /* 备份 / 恢复：localStorage 跟着域名走，换链接只能靠这个搬 */
        backupJson() {
            return JSON.stringify({
                type: 'suanbujin.equipFavorites',
                version: 2,
                savedAt: new Date().toISOString(),
                items: readList(),
            }, null, 2);
        },
        restoreJson(text) {
            let payload;
            try { payload = JSON.parse(text); } catch (error) { return { ok: false, error: '不是有效的 JSON' }; }
            const items = Array.isArray(payload) ? payload : (payload && payload.items);
            if (!Array.isArray(items)) return { ok: false, error: '文件里没有收藏数据' };
            const merged = readList();
            const seen = Object.create(null);
            merged.forEach(item => { seen[item.onlyId] = 1; });
            let added = 0;
            items.forEach(item => {
                const normalized = normalizeItem(item || {});
                if (!normalized.onlyId || seen[normalized.onlyId]) return;
                seen[normalized.onlyId] = 1;
                merged.push(normalized);
                added += 1;
            });
            writeList(merged);
            return { ok: true, added, total: merged.length };
        },
        csv(rows) {
            const headers = ['名称', '等级', '品质', '部位', '词条', '#only_id', '备注'];
            const lines = [headers.join(',')];
            for (const row of rows || []) {
                const cells = [row.name, row.needLv, row.colorText || row.color, row.typText || row.typ, row.propsText, row.onlyId, row.note];
                lines.push(cells.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
            }
            return '\ufeff' + lines.join('\r\n');
        },
        download(filename, text, type) {
            const blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1500);
        },
    };

    /* 加载即迁移一次，避免首次操作是 toggle 时跳过迁移、把 v2 写成空表 */
    migrateLegacy();

    root.EquipFavorites = EquipFavorites;
})(typeof window !== 'undefined' ? window : this);
