(function () {
    'use strict';

    var RESET_NOTICE_KEY = 'yyjh_reset_notice_v1';
    var SHARED_SAVE_KEYS = {
        yyjh_share_save_v1: true,
        yyjh_share_save_meta_v1: true,
        yyjh_save_library_v1: true
    };

    /* 用户自己攒的数据，不属于「运行态」：导入新存档/重置网页都不能清掉。
       历史 bug：clearOperationState() 把除存档外所有 yyjh_* 全删了，
       导致每换一次存档，收藏列表就被清空。 */
    var PRESERVED_PREFIXES = [
        'yyjh_equip_favorites_',   /* 装备页收藏（含 v1 分区键与 v2 全局键） */
        'yyjh_auto_favs_'          /* 自动推演·第六步收藏列表 */
    ];

    function isPreservedKey(key) {
        if (!key) return false;
        if (SHARED_SAVE_KEYS[key]) return true;
        for (var i = 0; i < PRESERVED_PREFIXES.length; i += 1) {
            if (key.indexOf(PRESERVED_PREFIXES[i]) === 0) return true;
        }
        return false;
    }

    function getMainRoleName(data) {
        var source = Array.isArray(data) ? data[0] : data;
        var role = source && source.MainRole;
        var name = role && typeof role.Name === 'string' ? role.Name.trim() : '';
        return name || '—';
    }

    function renderArchiveState(data) {
        var shared = data ? { data: data } : (typeof loadShareStore === 'function' ? loadShareStore() : null);
        var hasSave = !!(shared && shared.data);
        var status = document.getElementById('saveStatus');
        var mainRole = document.getElementById('archiveMainRole');
        var importButton = document.getElementById('archiveImportButton');
        if (status) status.textContent = hasSave ? '준비 완료' : '불러오기 전';
        if (mainRole) mainRole.textContent = hasSave ? getMainRoleName(shared.data) : '—';
        if (importButton) importButton.textContent = hasSave ? '교체' : '불러오기';
        /* 角色名后面补区服，例如「绵绵 · 26服」 */
        if (mainRole) {
            var oldServer = mainRole.parentNode && mainRole.parentNode.querySelector('.asb-server');
            if (oldServer) oldServer.remove();
            var meta = null;
            try { meta = JSON.parse(localStorage.getItem('yyjh_share_save_meta_v1') || 'null'); } catch (error) { }
            if (hasSave && meta && meta.server) {
                var serverTag = document.createElement('span');
                serverTag.className = 'asb-server';
                serverTag.textContent = '· ' + String(meta.server).replace(/服$/, '') + '서버';
                mainRole.insertAdjacentElement('afterend', serverTag);
            }
        }
        return hasSave;
    }

    function clearNamespacedStorage(storage, preservedKeys) {
        if (!storage) return;
        var keys = [];
        for (var index = 0; index < storage.length; index += 1) {
            var key = storage.key(index);
            var keep = isPreservedKey(key) || (preservedKeys && preservedKeys[key]);
            if (key && key.indexOf('yyjh_') === 0 && !keep) keys.push(key);
        }
        keys.forEach(function (key) { storage.removeItem(key); });
    }

    function clearWebsiteState() {
        try { clearNamespacedStorage(window.localStorage); } catch (error) { }
        try { clearNamespacedStorage(window.sessionStorage); } catch (error) { }
    }

    function clearOperationState() {
        try { clearNamespacedStorage(window.localStorage, SHARED_SAVE_KEYS); } catch (error) { }
        try { clearNamespacedStorage(window.sessionStorage); } catch (error) { }
    }

    function showResetFeedback() {
        var resetButton = document.getElementById('btnResetWebsite');
        if (!resetButton) return;
        resetButton.textContent = '초기화 완료';
        resetButton.classList.add('is-reset-success');
        window.setTimeout(function () {
            resetButton.classList.remove('is-reset-success');
            resetButton.textContent = '화면 초기화';
        }, 2000);
    }

    function resetWebsiteState() {
        var message = [
            '초기화하면 다음 내용이 삭제됩니다:',
            '· 이 기기에서 불러온 세이브(초기화 후 다시 불러와야 함)',
            '· 시뮬레이션의 임시 상태(선택한 도면, 목표 및 결과)',
            '',
            '유지되는 항목: 장비 즐겨찾기.',
            '초기화 후 페이지가 자동 새로고침됩니다. 계속하시겠습니까?'
        ].join('\n');

        function doReset() {
            clearOperationState();
            try { window.sessionStorage.setItem(RESET_NOTICE_KEY, '1'); } catch (error) { }
            window.location.reload();
        }

        if (window.AppDialog && typeof window.AppDialog.confirm === 'function') {
            window.AppDialog.confirm(message, { title: '화면 초기화', okText: '초기화 확인' }).then(function (ok) {
                if (ok) doReset();
            });
            return;
        }
        if (window.confirm(message)) doReset();
    }

    function showNoExportData() {
        window.alert('내보낼 데이터가 없습니다.');
    }

    function initializeArchiveState() {
        renderArchiveState();
        var exportButton = document.getElementById('btnExportTable');
        var resetButton = document.getElementById('btnResetWebsite');
        if (exportButton && exportButton.dataset.exportCustom !== 'true') {
            exportButton.addEventListener('click', showNoExportData);
        }
        if (resetButton) resetButton.addEventListener('click', resetWebsiteState);
        try {
            if (window.sessionStorage.getItem(RESET_NOTICE_KEY) === '1') {
                window.sessionStorage.removeItem(RESET_NOTICE_KEY);
                showResetFeedback();
            }
        } catch (error) { }
    }

    window.getArchiveMainRoleName = getMainRoleName;
    window.renderArchiveState = renderArchiveState;
    window.clearWebsiteState = clearWebsiteState;
    window.clearOperationState = clearOperationState;
    window.showNoExportData = showNoExportData;
    window.resetWebsiteState = resetWebsiteState;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeArchiveState);
    } else {
        initializeArchiveState();
    }
})();
