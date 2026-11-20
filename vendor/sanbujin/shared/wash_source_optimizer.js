/* Compatibility entry only. The active core is suanbujin-ximai.js. */
(function (root) {
    'use strict';
    if (!root.SuanbujinXimai) throw new Error('suanbujin-ximai 核心未加载，请刷新后重试');
    root.WashSourceOptimizer = root.SuanbujinXimai;
})(typeof window !== 'undefined' ? window : globalThis);
