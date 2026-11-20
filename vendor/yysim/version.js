/** 模拟器发布版本（由 pack.ps1 / VERSION 维护） */
var SIMULATOR_VERSION = "1.21";

(function () {
    function applyVersion() {
        var el = document.getElementById("appVersion");
        if (el) el.textContent = "v" + SIMULATOR_VERSION;
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyVersion);
    } else {
        applyVersion();
    }
})();
