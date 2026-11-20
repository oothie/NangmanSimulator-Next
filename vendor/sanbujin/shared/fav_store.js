/* 收藏数据层 · 「自动推演·第六步」和「藏兵阁」共用
 *
 * 只读写 localStorage，不碰渲染。两个页面都从这里拿数据，
 * 以后加功能（排序、标签、更多导出格式）只改这一处，两边同时生效。
 *
 * 存储格式：数组，元素是收藏时的快照对象，至少含 id；
 * 自动推演存快照时还会带上 equipType（中文类型）和 html（渲染好的卡片），
 * 藏兵阁直接复用 html，卡片样式和第六步完全一致。
 */
(function (root) {
    'use strict';

    var KEY = 'yyjh_auto_favs_v1';
    var MAX_ITEMS = 0;

    function read() {
        try {
            var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
            return Array.isArray(raw) ? raw.filter(function (item) { return item && item.id != null; }) : [];
        } catch (error) {
            return [];
        }
    }

    function write(list) {
        var rows = Array.isArray(list) ? list.slice() : [];
        try {
            localStorage.setItem(KEY, JSON.stringify(rows));
            return true;
        } catch (error) {
            /* 存不下（快照里的详情数据很占地方）：先把 views 摘掉保住「收藏本身」 */
            try {
                var slim = rows.map(function (item) {
                    if (!item || !item.views) return item;
                    var copy = JSON.parse(JSON.stringify(item));
                    delete copy.views;
                    return copy;
                });
                localStorage.setItem(KEY, JSON.stringify(slim));
                return true;
            } catch (error2) {
                return false;
            }
        }
    }

    function remove(id) {
        var key = String(id);
        var list = read().filter(function (item) { return String(item.id) !== key; });
        write(list);
        return list;
    }

    function backupJson() {
        return JSON.stringify({
            type: 'suanbujin.autoFavorites',
            version: 1,
            savedAt: new Date().toISOString(),
            items: read(),
        }, null, 2);
    }

    /* 按 id 合并，不覆盖已有收藏；重复导入不会产生重复项 */
    function restoreJson(text) {
        var payload;
        try { payload = JSON.parse(text); } catch (error) { return { ok: false, error: '백업 파일이 아닙니다. 이전에 내보낸 백업 파일을 선택하세요.' }; }
        var items = Array.isArray(payload) ? payload : (payload && payload.items);
        if (!Array.isArray(items)) return { ok: false, error: '파일에 즐겨찾기 데이터가 없습니다.' };
        var list = read();
        var seen = Object.create(null);
        list.forEach(function (item) { seen[String(item.id)] = 1; });
        var added = 0;
        items.forEach(function (item) {
            if (!item || item.id == null) return;
            var id = String(item.id);
            if (seen[id]) return;
            seen[id] = 1;
            list.push(JSON.parse(JSON.stringify(item)));
            added += 1;
        });
        write(list);
        return { ok: true, added: added, total: list.length };
    }

    /* 来源标签：收藏那一刻的存档身份，写进快照，之后换任何存档都不会变 */
    var PLATFORM_LABELS = {
        ios: 'iOS', android: '안드로이드', pre_ios: 'iOS 사전 서버', pre_android: '안드로이드 사전 서버',
        oversea: '해외 서버', korea: '한국 서버', japan: '일본 서버', windows: 'Windows', older: '구버전', test: '테스트 서버'
    };

    function day(ts) {
        if (!ts) return '';
        var d = new Date(Number(ts));
        if (isNaN(d.getTime())) return '';
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    /* 标签：角色 · 渠道 · 存档日期 · 版号 · 收藏日期 */
    function tagParts(item) {
        var o = (item && item.origin) || {};
        var parts = [];
        if (o.role) parts.push(o.role);
        var platform = String(o.platform || '').toLowerCase();
        var channel = String(o.channel || '');
        if (channel) parts.push(channel);                      /* 官服 / 华为 / 国际服 … */
        else if (PLATFORM_LABELS[platform]) parts.push(PLATFORM_LABELS[platform]);
        else parts.push('채널 정보 없음');
        if (o.server) {
            var s = String(o.server);
            parts.push(/(?:服|서버)$/.test(s) ? s.replace(/服$/, '서버') : s + '서버');           /* 区服，和渠道并列 */
        }
        var saveDay = day(o.saveAt || o.importedAt);   /* UploadTime（存档时点）优先，导入时间兜底 */
        if (saveDay) parts.push(saveDay + ' 세이브');
        var version = String(o.version || '').replace(/^0+(?=\d)/, '');
        if (version) parts.push(version + ' 버전');
        var favDay = day(o.favoritedAt);
        if (favDay) parts.push(favDay + ' 즐겨찾기');
        return parts;
    }

    function tagHtml(item) {
        if (!item || !item.origin) {
            return '<div class="fav-meta-tag is-unknown" title="이 즐겨찾기에는 당시 세이브 정보가 기록되어 있지 않습니다">来源未记录</div>';
        }
        var parts = tagParts(item);
        var o = (item && item.origin) || {};
        var title = [];
        if (o.sourceFile) title.push('원본 파일: ' + o.sourceFile);
        if (o.importedAt) {
            try { title.push('세이브 불러온 시각: ' + new Date(Number(o.importedAt)).toLocaleString('ko-KR')); } catch (error) { }
        }
        if (!parts.length) return '<div class="fav-meta-tag is-unknown" title="이 즐겨찾기에는 당시 세이브 정보가 기록되어 있지 않습니다">来源未记录</div>';
        return '<div class="fav-meta-tag" title="' + String(title.join(' · ')).replace(/"/g, '&quot;') + '">'
            + parts.map(function (s) { return '<span>' + String(s).replace(/</g, '&lt;') + '</span>'; }).join('<i>·</i>')
            + '</div>';
    }

    function cell(value) {
        return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    }

    function csv(list) {
        var rows = [['종류', '장비', '제작 횟수', '지역', '품질', '즐겨찾기 시각']];
        (list || read()).forEach(function (item) {
            rows.push([
                item.equipType || '',
                item.name || '',
                item.craftIndex == null ? '' : item.craftIndex,
                item.location || '',
                item.colorText || item.color || '',
                item.savedAt ? new Date(Number(item.savedAt)).toLocaleString('ko-KR') : '',
            ]);
        });
        return '\ufeff' + rows.map(function (row) { return row.map(cell).join(','); }).join('\r\n');
    }

    function download(filename, text, type) {
        var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
    }

    root.FavoriteStore = {
        key: KEY,
        maxItems: MAX_ITEMS,
        list: read,
        save: write,
        remove: remove,
        backupJson: backupJson,
        restoreJson: restoreJson,
        csv: csv,
        download: download,
        tagHtml: tagHtml,
    };
})(typeof window !== 'undefined' ? window : this);