/* Integration bridge for the original NangmanSimulator v3.50 equipment engine.
 * Keep original RNG, multi-condition finder, automatic search, regional crafting,
 * inventory, and shared detail functions untouched.
 */
(function(){
'use strict';
const validViews=new Set(['find','auto','owned','region','unique']);
const origin=location.origin;
let active='find',saveVersion=-1;

/* Unified paper/ink presentation. Only the original engine performs calculations. */
const themeStyle=document.createElement('style');
themeStyle.id='nangman-host-equipment-theme';
themeStyle.textContent="\n:root{--host-bg:#f8f4eb;--host-panel:#fffdf7;--host-card:#fffdf7;--host-text:#231e17;--host-sub:#776e60;--host-border:#d6caba;--host-gold:#9c7941;--host-active:#ad8b4c22;--host-hover:#ad8b4c18;--host-shadow:none;--rbg:#f8f4eb;--rc:#fffdf7;--rl:#d6caba;--rt:#231e17;--rm:#776e60;--ra:#9c7941;--ra2:#e9dfcf;color-scheme:light}\nhtml[data-nangman-theme=\"dark\"]{--host-bg:#1d2027;--host-panel:#252830;--host-card:#252830;--host-text:#e9e3d9;--host-sub:#aba59c;--host-border:#44454d;--host-gold:#cca76b;--host-active:#cca76b24;--host-hover:#cca76b14;--host-shadow:none;--rbg:#1d2027;--rc:#252830;--rl:#44454d;--rt:#e9e3d9;--rm:#aba59c;--ra:#cca76b;--ra2:#3e382e;color-scheme:dark}\nhtml,body{margin:0!important;padding:0!important;min-height:0!important;overflow-x:hidden!important;background:var(--host-bg)!important;color:var(--host-text)!important;font-family:system-ui,\"Malgun Gothic\",sans-serif!important}\nbody>.app-container.equip-app,#rk218>.rk218-top,#rk218>.rhome{display:none!important}\nbody #rk218{max-width:100%!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;padding:0 0 24px!important;background:transparent!important;color:var(--host-text)!important;font-family:inherit!important;font-size:14px!important;line-height:1.55!important}\nbody #rk218 #rmain{display:grid;gap:13px;min-width:0}\nbody #rk218 :is(.box218,.rb-detail233,.rb-card233,.mini,.grp218,.picker237,.rk237-total,.recipe-card,.auto339-box,.config-panel,.rk218-jianwang-live,.rk240-slot,.rk240-allhint,.unique-special247,.rb-card,.detail-controls218){background:var(--host-card)!important;color:var(--host-text)!important;border-color:var(--host-border)!important;box-shadow:none!important;border-radius:6px!important}\nbody #rk218 .box218{margin:0!important;overflow:visible!important;border:1px solid var(--host-border)!important}\nbody #rk218 .box218>summary{padding:12px 15px!important;background:var(--host-bg)!important;color:var(--host-text)!important;border-radius:5px!important;font-size:15px!important;font-weight:700!important;cursor:pointer}\nbody #rk218 .bbody{padding:13px!important;background:transparent!important;color:var(--host-text)!important}\nbody #rk218 :is(.mini,.grp218,.rb-card233){padding:12px!important}\nbody #rk218 :is(.glab,.panel-header h2,.rb-detail233 h2,.rk-detail-head233 b,.rk237-total b){color:var(--host-text)!important}\nbody #rk218 :is(.meta,.note218,.side-text275,.side-title275,.cost-hint,.rsel,.rk240-allhint,.rk240-slot small){color:var(--host-sub)!important}\nbody #rk218 :is(.tabs218,.chips){background:transparent!important;color:var(--host-text)!important}\nbody #rk218 .tabs218{position:static!important;top:auto!important;display:flex!important;flex-wrap:wrap!important;overflow:visible!important;gap:4px!important;padding:0 0 7px!important;margin:12px 0!important;border-bottom:1px solid var(--host-border)!important}\nbody #rk218 :is(.tabs218 button,.chip,.rbtn,.btn,.back218,.jh-home-btn,.auto345-region-picks button,.auto345-result-filter button,.auto349-sort button){appearance:none!important;background:transparent!important;color:var(--host-sub)!important;border:1px solid var(--host-border)!important;box-shadow:none!important;border-radius:5px!important;font-size:14px!important;font-weight:600!important;min-height:38px!important;padding:8px 11px!important}\nbody #rk218 :is(.tabs218 button.on,.chip.on,.rbtn.primary,.btn.primary,.auto345-region-picks button.on,.auto345-result-filter button.on,.auto349-sort button.on,button[aria-selected=\"true\"],button[aria-pressed=\"true\"]){background:var(--host-active)!important;background-color:var(--host-active)!important;color:var(--host-text)!important;border-color:var(--host-gold)!important;border-bottom:2px solid var(--host-gold)!important;box-shadow:none!important}\nbody #rk218 :is(.tabs218 button,.chip,.rbtn,.btn,.back218):hover:not(:disabled){background:var(--host-hover)!important;color:var(--host-text)!important}\nbody #rk218 button:disabled{opacity:.42!important;cursor:not-allowed!important}\nbody #rk218 :is(input:not([type=\"checkbox\"]):not([type=\"radio\"]),select,textarea,.rinput,.num218,.rsel){background:var(--host-panel)!important;color:var(--host-text)!important;border:1px solid var(--host-border)!important;border-radius:5px!important;min-height:38px!important;padding:7px 9px!important;font-size:14px!important;max-width:100%!important;opacity:1!important}\nbody #rk218 :is(input,select,textarea):focus-visible{outline:2px solid var(--host-gold)!important;outline-offset:2px!important}\nbody #rk218 :is(input[type=\"checkbox\"],input[type=\"radio\"]){min-height:16px!important;min-width:16px!important;width:16px!important;accent-color:var(--host-gold)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227){border-color:var(--host-border)!important;color:var(--host-text)!important;font-size:13px!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) :is(th,td){border-color:var(--host-border)!important;padding:9px 10px!important;line-height:1.5!important;color:var(--host-text)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) th{background:var(--host-bg)!important;font-weight:650!important;color:var(--host-sub)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) td{background:var(--host-card)!important}\nbody #rk218 :is(.tbl218,.detail-table218,.regionTbl225,.unique-seq-table227) tr:hover td{background:var(--host-hover)!important}\nbody #rk218 :is(.regionTbl225 .sticky225,.unique-seq-table227 .sticky227,.tag,.detail-region277,.unique-pick247,.rk-initial-special-value250,.rk240-allhint,.detail-controls218,.search-result-side275,.search-result-layout275){background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\nbody #rk218 :is(.scroll218,.regionScroll225,.unique-seq-scroll227){max-width:100%!important;overflow-x:auto!important;scrollbar-color:var(--host-border) transparent}\nbody #rk218 .detail-controls218{display:flex!important;flex-wrap:wrap!important;align-items:flex-end!important;gap:12px!important;padding:12px!important;margin:12px 0!important}\nbody #rk218 .rb-detail233{padding:14px!important}\nbody #rk218 .region-prop226{color:var(--host-gold)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.preview-table,.result-table,.history-table-wrap,.table-wrap,.scroll,.history-table,.preview-card,.config-row,.config-group,.rk237-groups,.search-result-layout275,.search-result-side275,.rb-detail233,.r225q,.regionbar225,.rk-detail-head233){background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.r225ext,.r225reg,.r225spec,.rk240-slot,.rk240-slot b,.meta-text,.help-text,.glab,.props,.route,.bbody,.label,.hint,.config-group label,.picker237 b,.rk237-groups b,.search-result-side275 p){color:var(--host-text)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(table,thead,tbody,tr,th,td,pre,code,.sticky225,.sticky227){border-color:var(--host-border)!important;color:var(--host-text)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(pre,code){background:var(--host-bg)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 option{background:#252830!important;color:#e9e3d9!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.back218,.tag,.rk237-total,.picker237,.rb-detail233,.mini,.grp218){background:var(--host-panel)!important;color:var(--host-text)!important}\n@media(max-width:700px){body #rk218 .bbody{padding:9px!important}body #rk218 .rb-detail233{padding:9px!important}body #rk218 .tabs218 button{padding:7px 9px!important}body #rk218 .detail-controls218{padding:8px!important}}\n";
themeStyle.textContent+="\n\n/* Dark-mode legibility guard against remaining hardcoded light-only source rules. */\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(p,span,b,strong,small,label,li,summary,h1,h2,h3,h4,td,th,.props,.meta,.route,.tag,.cost-hint,.note218,.glab,.r225ext,.r225reg,.r225spec,.search-result-side275,.panel-header,.panel-header *,.rb-detail233,.rb-detail233 *,.mini,.mini *,.grp218,.grp218 *){\n color:var(--host-text)!important\n}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.meta,.note218,.meta-text,.side-text275,.rsel,small,.cost-hint){color:var(--host-sub)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.clg1,.q-white,.q-white226){color:var(--host-text)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.clg2,.q-green,.q-green226){color:#80c78a!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.clg3,.clg4,.q-purple,.q-purple226,.quality226.q-purple226){color:#cba5e3!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.region-prop226,.z-region){color:var(--host-gold)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.row-keep,.row-keep td,.search-hit272,.search-hit272 td,.rk-initial-special-value250){background:var(--host-active)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 ::placeholder{color:var(--host-sub)!important;opacity:.9!important}\n";
themeStyle.textContent+="\n\n/* Automated equipment simulator: neutral base cards, readable colored metadata.\n   These rules deliberately cover the nested result/filter/grade classes which\n   the original v3.50 page hardcodes for a white background. */\nbody #rk218 :is(.auto339-box,.auto339-result,.auto346-result,.auto345-filter-wrap,.auto345-refine-chip,.auto345-refine-chip.total,.auto339-progress,.auto346-main,.auto346-side,.auto346-region-summary,.auto345-filter-head,.auto345-optionblock,.auto339-props,.auto339-refine,.auto339-title,.auto339-grid,.auto345-optionrow){\n color:var(--host-text)!important;\n border-color:var(--host-border)!important;\n}\nbody #rk218 :is(.auto339-box,.auto339-result,.auto346-result,.auto345-filter-wrap){background:var(--host-card)!important;border:1px solid var(--host-border)!important;box-shadow:none!important}\nbody #rk218 :is(.auto345-filter-wrap,.auto345-refine-chip,.auto345-refine-chip.total){background:var(--host-panel)!important}\nbody #rk218 .auto339-progress,body #rk218 .auto346-region-summary{color:var(--host-sub)!important}\nbody #rk218 .auto339-result:hover{background:var(--host-hover)!important;border-color:var(--host-gold)!important}\nbody #rk218 :is(.auto345-region-picks button,.auto345-result-filter button,.auto349-sort button,.auto345-filter-wrap button){\n background:var(--host-panel)!important;\n border:1px solid var(--host-border)!important;\n border-radius:5px!important;\n color:var(--host-text)!important;\n font-size:13px!important;\n min-height:38px!important;\n padding:7px 11px!important;\n box-shadow:none!important;\n}\nbody #rk218 :is(.auto345-region-picks button.on,.auto345-result-filter button.on,.auto349-sort button.on,.auto345-region-picks .all.on,.auto345-result-filter .all.on,.auto345-filter-wrap button[aria-pressed=\"true\"]){\n background:var(--host-active)!important;\n border:1px solid var(--host-gold)!important;\n border-bottom:2px solid var(--host-gold)!important;\n color:var(--host-text)!important;\n box-shadow:none!important;\n font-weight:750!important;\n}\nbody #rk218 :is(.auto345-region-picks button,.auto345-result-filter button,.auto349-sort button):hover:not(:disabled){color:var(--host-text)!important;background:var(--host-hover)!important}\nbody #rk218 .auto345-refine-chip b{color:var(--host-sub)!important}\nbody #rk218 .auto345-purple-note{background:#f2e5f8!important;color:#73358b!important;border:1px solid #b78dcf!important}\nbody #rk218 .auto339-region{background:#f5e7f7!important;color:#85349b!important;border:1px solid #cc9fd9!important}\nbody #rk218 .auto339-material{background:#fbf0db!important;color:#82550a!important;border:1px solid #dbc08a!important}\nbody #rk218 .auto339-mang{background:#e4f3ec!important;color:#206449!important;border:1px solid #98cbb3!important}\nbody #rk218 .rk-grade256{background:var(--gback)!important;color:var(--gc)!important;border:1px solid var(--gb)!important}\nbody #rk218 .rk-grade256 :is(b,small){color:inherit!important}\nbody #rk218 .rk-grade256.is-white{--gc:#626b75;--gback:#f4f5f6;--gb:#cfd4da}\nbody #rk218 .rk-grade256.is-green{--gc:#27814f;--gback:#edf9f1;--gb:#9fd5b3}\nbody #rk218 .rk-grade256.is-blue{--gc:#246ba8;--gback:#edf6ff;--gb:#9bc7ed}\nbody #rk218 .rk-grade256.is-purple{--gc:#8b42b8;--gback:#f7ecff;--gb:#cda6e6}\nbody #rk218 .rk-grade256.is-red{--gc:#c9382f;--gback:#fff0ef;--gb:#efaaa5}\nbody #rk218 .rk-grade256.is-gold{--gc:#9a6a00;--gback:#fff7dc;--gb:#e3c875}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto339-box,.auto339-result,.auto346-result,.auto345-filter-wrap,.auto345-optionblock,.auto345-optionrow,.auto345-filter-head,.auto339-title,.auto339-props,.auto339-refine,.auto346-side,.auto346-main,.auto339-row,.auto339-grid,.auto349-filter-head,.auto345-refine-chip,.auto345-refine-chip.total){color:var(--host-text)!important;border-color:var(--host-border)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto339-box,.auto339-result,.auto346-result,.auto345-filter-wrap,.auto345-refine-chip,.auto345-refine-chip.total){background:var(--host-panel)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto339-region,.auto339-material,.auto339-mang,.auto345-purple-note,.rk-grade256,.auto345-refine-chip) :is(b,strong,small,span){color:inherit!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto339-region{background:#412845!important;color:#efc2f5!important;border-color:#9563aa!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto339-material{background:#473922!important;color:#f6dc9d!important;border-color:#a98b52!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto339-mang{background:#234437!important;color:#a5ebc9!important;border-color:#568e72!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto345-purple-note{background:#422846!important;color:#edc4fa!important;border-color:#9965b1!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-white{--gc:#e4e3df;--gback:#41454c;--gb:#727680}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-green{--gc:#a5e8b8;--gback:#204632;--gb:#548868}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-blue{--gc:#a9d7fa;--gback:#26465e;--gb:#5a8da9}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-purple{--gc:#e5b9ff;--gback:#4a285f;--gb:#9968bd}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-red{--gc:#ffb6ad;--gback:#552a2b;--gb:#ad6660}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .rk-grade256.is-gold{--gc:#f7df9c;--gback:#514020;--gb:#b39957}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto339-region,.auto339-material,.auto339-mang,.auto345-purple-note,.rk-grade256) :is(b,strong,small,span){color:inherit!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto339-result:hover{background:var(--host-hover)!important;border-color:var(--host-gold)!important}\n";
themeStyle.textContent+="\n\n/* Earlier automatic simulation revisions still produce these result widgets. */\nbody #rk218 :is(.auto342-slot,.auto342-total,.auto343-refine-inline span,.auto343-refine-inline .total,.auto346-region-summary,.auto346-base90,.auto346-costtitle){\n background:var(--host-panel)!important;\n color:var(--host-text)!important;\n border-color:var(--host-border)!important\n}\nbody #rk218 :is(.auto342-slot b,.auto343-refine-inline b){color:var(--host-sub)!important}\nbody #rk218 .auto346-base90{border:1px solid var(--host-gold)!important;background:var(--host-active)!important;color:var(--host-text)!important}\nbody #rk218 .auto346-costtitle{font-weight:800!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto342-slot,.auto342-total,.auto343-refine-inline span,.auto343-refine-inline .total,.auto346-region-summary,.auto346-costtitle){background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 :is(.auto342-slot b,.auto343-refine-inline b){color:var(--host-sub)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 .auto346-base90{background:var(--host-active)!important;color:var(--host-text)!important;border:1px solid var(--host-gold)!important}\n";
themeStyle.textContent+="\n\n/* Equipment detail's original in-frame navigation mirrors the shared header.\n   Keep functional colors independent, preserve paper/ink legibility. */\nbody #rk218 #dtabs.tabs218{\n display:grid!important;\n grid-template-columns:repeat(4,minmax(0,1fr))!important;\n align-items:stretch!important;\n gap:9px!important;\n margin:12px 0 17px!important;\n padding:0!important;\n border-bottom:0!important;\n}\nbody #rk218 #dtabs.tabs218 button.chip{\n min-width:0!important;\n width:100%!important;\n min-height:56px!important;\n padding:12px 9px!important;\n border:1px solid var(--detail-border)!important;\n border-left:4px solid var(--detail-border)!important;\n background:var(--detail-bg)!important;\n color:var(--detail-text)!important;\n font-size:15px!important;\n font-weight:750!important;\n border-radius:7px!important;\n box-shadow:none!important\n}\nbody #rk218 #dtabs button.chip:nth-child(1){--detail-border:#927b62;--detail-bg:#eee6d8;--detail-text:#584631}\nbody #rk218 #dtabs button.chip:nth-child(2){--detail-border:#6688ad;--detail-bg:#e9f0f8;--detail-text:#294f7a}\nbody #rk218 #dtabs button.chip:nth-child(3){--detail-border:#a37abd;--detail-bg:#f2eaf7;--detail-text:#70428d}\nbody #rk218 #dtabs button.chip:nth-child(4){--detail-border:#b58a49;--detail-bg:#f7efdf;--detail-text:#76531f}\nbody #rk218 #dtabs button.chip.on{\n outline:2px solid var(--detail-border)!important;\n outline-offset:1px!important;\n box-shadow:0 3px 10px #20170c12!important;\n background:var(--detail-bg)!important;\n color:var(--detail-text)!important;\n border-color:var(--detail-border)!important\n}\nbody #rk218 #dtabs button.chip:hover:not(:disabled){filter:brightness(.98)!important}\nhtml[data-nangman-theme=\"dark\"] body #rk218 #dtabs button.chip:nth-child(1){--detail-border:#b8a58e;--detail-bg:#373229;--detail-text:#f0e4d1}\nhtml[data-nangman-theme=\"dark\"] body #rk218 #dtabs button.chip:nth-child(2){--detail-border:#7eaddd;--detail-bg:#26384a;--detail-text:#d2e9ff}\nhtml[data-nangman-theme=\"dark\"] body #rk218 #dtabs button.chip:nth-child(3){--detail-border:#c8a0e5;--detail-bg:#3a2c46;--detail-text:#f2daff}\nhtml[data-nangman-theme=\"dark\"] body #rk218 #dtabs button.chip:nth-child(4){--detail-border:#d8b679;--detail-bg:#403526;--detail-text:#ffebc5}\n@media(max-width:680px){body #rk218 #dtabs.tabs218{grid-template-columns:repeat(2,minmax(0,1fr))!important}body #rk218 #dtabs button.chip{min-height:50px!important}}\n";
/* Unique-item lists are the one view with source-level white/blue
   backgrounds. Use the same neutral site theme on both the item cards and
   their region-sequence table, without flattening grade colors. */
themeStyle.textContent += `
html[data-nangman-theme="dark"] body #rk218 #rmain :is(.res.unique218,.unique218,.ownedlist>.res,.resname){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important;box-shadow:none!important
}
html[data-nangman-theme="dark"] body #rk218 .res.unique218{
 display:block!important;border:1px solid var(--host-border)!important;
 border-radius:7px!important;padding:12px!important
}
html[data-nangman-theme="dark"] body #rk218 .res.unique218:hover{
 background:#303640!important;border-color:var(--host-gold)!important
}
html[data-nangman-theme="dark"] body #rk218 .res.unique218 :is(.resname,.meta,.quality226){
 color:var(--host-text)!important;background:transparent!important
}
html[data-nangman-theme="dark"] body #rk218 :is(.unique-seq-table227,.unique-seq-table227 thead,.unique-seq-table227 tbody,
.unique-seq-table227 tr,.unique-seq-table227 th,.unique-seq-table227 td){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important
}
html[data-nangman-theme="dark"] body #rk218 .unique-seq-table227 th{
 background:var(--host-bg)!important;color:var(--host-text)!important
}
html[data-nangman-theme="dark"] body #rk218 .unique-seq-table227 tr:hover td{
 background:#303640!important
}
html[data-nangman-theme="dark"] body #rk218 .unique-pick247{
 background:#343b46!important;border:1px solid #797d85!important;
 color:#f3eadc!important;min-height:34px!important;padding:6px 12px!important
}
html[data-nangman-theme="dark"] body #rk218 .unique-pick247:hover{
 background:#51442f!important;border-color:var(--host-gold)!important
}
html[data-nangman-theme="dark"] body #rk218 :is(.unique-seq-scroll227,.unique-special247,.region-prop226){
 border-color:var(--host-border)!important
}
html[data-nangman-theme="dark"] body #rk218 .region-prop226{
 color:#e3b8fa!important;background:transparent!important
}
html[data-nangman-theme="dark"] body #rk218 .q-orange226{
 color:#f4c26c!important
}
html[data-nangman-theme="light"] body #rk218 .res.unique218{
 background:var(--host-card)!important;color:var(--host-text)!important;
 border:1px solid var(--host-border)!important;padding:12px!important;border-radius:7px!important
}
html[data-nangman-theme="light"] body #rk218 .unique-pick247{
 color:var(--host-text)!important;background:var(--host-bg)!important;
 border:1px solid var(--host-border)!important
}
`;
/* Small-screen detail content must be scrollable within the iframe, never clipped. */
themeStyle.textContent += `
@media(max-width:760px){
  body #rk218,body #rk218 #rmain,body #rk218 #dtop233,body #rk218 #dpanel,
  body #rk218 .rb-detail233,body #rk218 .rk-detail-head233,body #rk218 .box218,
  body #rk218 .bbody,body #rk218 .mini,body #rk218 .rk237-total{
    box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important
  }
  body #rk218 .rk-detail-head233{display:grid!important;grid-template-columns:minmax(0,1fr)!important}
  body #rk218 .rk-detail-head233>*{min-width:0!important;max-width:100%!important}
  body #rk218 :is(.scroll218,.regionScroll225,.unique-seq-scroll227,.detail-scroll,.table-scroll,.rrows233){
    display:block!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;
    min-width:0!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
  }
  body #rk218 .scroll218 :is(table,.detail-table218){
    width:max-content!important;min-width:100%!important;table-layout:auto!important
  }
  body #rk218 .detail-table218 :is(th,td){white-space:nowrap!important}
  body #rk218 .auto345-optionrow{display:grid!important;grid-template-columns:minmax(0,1fr)!important}
  body #rk218 .auto345-optionblock,body #rk218 .auto346-main{min-width:0!important;max-width:100%!important}
  body #rk218 .tabs218{width:100%!important;max-width:100%!important;min-width:0!important}
  body #rk218 .props{display:flex!important;flex-wrap:wrap!important;min-width:0!important}
  body #rk218 .props .tag{max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important}
  body #rk218 input,body #rk218 select{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}
}
`;
/* Regional crafting uses later light-only styles with !important declarations.
   Override these only under the host ink theme. Preserve item-grade labels. */
themeStyle.textContent += `
html[data-nangman-theme="dark"]{
 --host-bg:#20242b;--host-panel:#282c33;--host-card:#282c33;
 --host-text:#e2ded6;--host-sub:#b5ada4;--host-border:#626873;
 --host-gold:#c5a777;--host-hover:#343a44;--host-active:#c5a77726;
 color-scheme:dark;
}
html[data-nangman-theme="dark"] body #rk218 :is(.regionbar225,.region-group352,.regionScroll225,.region-grid223,.region-route223,#eseq,#regionDetail231){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionScroll225{
 border:1px solid var(--host-border)!important;border-radius:8px!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.regionTbl225,.regionTbl225 thead,.regionTbl225 tbody,.regionTbl225 tfoot,.regionTbl225 tr){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 :is(th,td),
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 :is(th.sticky225,td.sticky225){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-bottom:1px solid var(--host-border)!important;
 border-right:1px solid #535965!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 thead :is(th,th.sticky225){
 background:#353a44!important;color:var(--host-text)!important;
 border-bottom:2px solid #727987!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 tbody tr:nth-child(even) :is(td,td.sticky225){
 background:#30353e!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 tbody tr:hover :is(td,td.sticky225){
 background:#3b414c!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 :is(.r225q,.r225ext,.r225reg,.r225spec,small),
html[data-nangman-theme="dark"] body #rk218 .regionbar225 :is(label,.note218){
 color:var(--host-text)!important;
}
html[data-nangman-theme="dark"] body #rk218 .regionTbl225 .r225reg.none{
 color:var(--host-sub)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.r239-label,.rk240-allhint,.region-group352 .note218){
 background:#333842!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.regionbar225 select,.regionbar225 option,.regionbar225 input){
 background:#282c33!important;color:var(--host-text)!important;
 border:1px solid #727986!important;color-scheme:dark;
}
html[data-nangman-theme="dark"] body #rk218 #regionDetail231 :is(.box218,.rb-detail233,.rb-card233,.mini,.grp218,.rk240-slot){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 border-color:var(--host-border)!important;
}
`;
/* Narrow-screen equipment tabs, filters and result tables: scroll only data areas. */
themeStyle.textContent += `
@media(max-width:760px){
 html,body{width:100%!important;max-width:100%!important;}
 body #rk218,body #rk218 #rmain,body #rk218 .box218,
 body #rk218 .bbody,body #rk218 .rb-detail233,
 body #rk218 .region-group352,body #rk218 .regionbar225,
 body #rk218 .equip-card-list{
  min-width:0!important;max-width:100%!important;box-sizing:border-box!important;
 }
 body #rk218 .regionbar225{display:flex!important;flex-wrap:wrap!important;gap:8px!important;}
 body #rk218 .regionbar225 label{min-width:0!important;max-width:100%!important;flex-wrap:wrap!important;}
 body #rk218 .regionbar225 select{max-width:100%!important;min-width:0!important;}
 body #rk218 :is(.regionScroll225,.unique-seq-scroll227,.scroll218,.detail-scroll,
 .rk237-table-wrap,.table-wrap,.result-table-wrap,.history-table-wrap){
  display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
  overflow-x:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
 }
 body #rk218 :is(.regionTbl225,.unique-seq-table227,.detail-table218){
  width:max-content!important;min-width:100%!important;table-layout:auto!important;
 }
 body #rk218 .regionTbl225 :is(th,td){white-space:nowrap!important;}
 body #rk218 .tabs218{flex-wrap:nowrap!important;overflow-x:auto!important;
  overflow-y:hidden!important;max-width:100%!important;-webkit-overflow-scrolling:touch;}
 body #rk218 .tabs218 button{flex:0 0 auto!important;}
 body #rk218 .equip-card-list{grid-template-columns:minmax(0,1fr)!important;}
 body #rk218 :is(.grid218,.region-grid223,.unique-grid223,.search-result-layout275,
 .rk237-groups,.auto346-main){grid-template-columns:minmax(0,1fr)!important;}
 body #rk218 :is(.auto339-result,.auto342-slot,.auto345-optionblock,
 .rb-card233,.recipe-card,.rk-detail-head233){min-width:0!important;max-width:100%!important;}
 body #rk218 :is(input,select,textarea,button){max-width:100%!important;}
}
@media(max-width:420px){
 body #rk218 .bbody{padding:8px!important;}
 body #rk218 :is(.box218,.rb-detail233,.mini,.grp218){padding-left:8px!important;padding-right:8px!important;}
 body #rk218 .regionbar225{padding:8px!important;}
}
`;
/* Complete ink-mode text contrast across legacy engine cards and nested tables.
   Preserve rarity and quality colors by excluding known grade/value classes. */
themeStyle.textContent += `
html[data-nangman-theme="dark"] body #rk218 :is(
 .box218,.box218>summary,.bbody,.rb-card233,.rb-controls233,.rb-detail233,
 .rk-detail-head233,.rk240-slot,.rk240-allhint,.regionbar225,.region-group352,
 .regionScroll225,.unique-special247,.search-result-layout275,.search-result-side275,
 .recipe-card,.auto339-result,.auto345-optionblock,.auto346-main,.ownedlist,
 .equip-pick-card,.equip-pick-title,.equip-pick-meta,.equip-pick-options,
 .detail-controls218,.picker237,.rk237-total,.region-route223
){
 color:var(--host-text)!important;border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .box218,.rb-detail233,.rb-card233,.rk240-slot,.region-group352,
 .regionScroll225,.unique-special247,.recipe-card,.equip-pick-card
){
 background:var(--host-panel)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .box218,.rb-detail233,.rb-card233,.rk240-slot,.region-group352,
 .regionScroll225,.unique-special247,.equip-pick-card
) :is(h1,h2,h3,h4,h5,h6,label,summary,small,p,th,td,strong){
 color:var(--host-text)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .regionbar225,.region-group352,.regionScroll225,.auto339-result,
 .auto345-optionblock,.equip-pick-card,.rb-detail233
) :is(input:not([type=checkbox]),select,option,optgroup,textarea){
 background:var(--host-panel)!important;color:var(--host-text)!important;
 color-scheme:dark;border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .regionTbl225,.detail-table218,.tbl218,.unique-seq-table227
) :is(th,td){
 color:var(--host-text)!important;border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .chip,.rbtn,.tabs218 button,.rb-equip-nav button,.equip-pick-card,.auto345-refine-chip
):not(.on):not(.active):not(.primary){
 color:var(--host-text)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .meta,.note218,.cost-hint,.equip-pick-meta,.r225reg.none,.side-text275
){
 color:var(--host-sub)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(
 .q-purple226,.q-purple,.clg4,.grade-4
){color:#d2afea!important}
html[data-nangman-theme="dark"] body #rk218 :is(
 .q-green226,.q-green,.clg2,.grade-2
){color:#83d39b!important}
html[data-nangman-theme="dark"] body #rk218 :is(
 .q-blue226,.q-blue,.clg3,.grade-3
){color:#91c7f0!important}
html[data-nangman-theme="dark"] body #rk218 :is(
 .q-orange226,.grade-5,.region-prop226,.z-region
){color:#e7ba84!important}
`;
/* Grade/quality colors must override the generic ink-mode text guard.
 * Grade chips use their own dark background AND foreground, never translucent
 * neutral host-active; retain original grade semantics across detailed tables. */
themeStyle.textContent += `
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-white{--gc:#e1e5eb;--gback:#3c4652;--gb:#8693a2}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-green{--gc:#a8f1bf;--gback:#204b36;--gb:#529d73}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-blue{--gc:#b0ddff;--gback:#254d70;--gb:#649cc7}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-purple{--gc:#ebc9ff;--gback:#4b3267;--gb:#a677d0}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-red{--gc:#ffc5c2;--gback:#633237;--gb:#cb7779}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256.is-gold{--gc:#ffe6a5;--gback:#5b4722;--gb:#ba9555}
html[data-nangman-theme="dark"] body #rk218 :is(.rk-grade-row256,.rb-detail233,.rk237-total,.search-hit272,.row-keep,.auto339-result,.auto346-result) .rk-grade256,
html[data-nangman-theme="dark"] body #rk218 .rk-grade256{
 display:inline-flex!important;align-items:center!important;gap:4px!important;
 background:var(--gback)!important;background-color:var(--gback)!important;
 color:var(--gc)!important;border:1px solid var(--gb)!important;
 border-radius:999px!important;padding:3px 8px!important;
 opacity:1!important;box-shadow:none!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.rb-detail233,.rk237-total,.search-hit272,.row-keep,.rk-grade-row256,.auto339-result,.auto346-result) .rk-grade256 :is(b,small,strong,span),
html[data-nangman-theme="dark"] body #rk218 .rk-grade256 :is(b,small,strong,span){
 color:var(--gc)!important;opacity:1!important;
}
html[data-nangman-theme="dark"] body #rk218 .rk-grade256 small{font-weight:650!important}
html[data-nangman-theme="dark"] body #rk218 :is(.auto339-region,.auto339-material,.auto339-mang,.auto345-purple-note) :is(b,strong,span,small){
 color:inherit!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.rk237-total,.picker237,.detail-controls218,.search-result-side275,.rb-detail233) :is(.rinput,select,input){
 background:var(--host-panel)!important;color:var(--host-text)!important;border-color:var(--host-border)!important;
}
html[data-nangman-theme="dark"] body #rk218 :is(.rk237-total,.picker237,.detail-controls218,.search-result-side275) :is(.glab,.note218,.meta,.side-text275){
 color:var(--host-sub)!important;
}
`;
function setHostTheme(theme){
 document.documentElement.dataset.nangmanTheme=theme==='dark'?'dark':'light';
}
function syncHostTheme(){
 try{
  if(window.parent!==window){
   setHostTheme(window.parent.document.documentElement.dataset.theme==='ink'?'dark':'light');
  }
 }catch(_){}
}
function applyHostPresentation(){
 if(document.body&&themeStyle.parentNode!==document.body)document.body.appendChild(themeStyle);
 const root=document.getElementById('rk218');
 if(!root)return;
 const duplicate=root.querySelector(':scope > .rk218-top');
 if(duplicate)duplicate.remove();
 root.querySelectorAll(':scope > .rhome').forEach(el=>el.remove());
}
/* Opaque result-row backgrounds: the previous transparent host-active layer
 * exposed the source table's beige highlight while the bridge forced light text.
 * Keep all highlighted cells and nested labels on the SAME dark surface. */
themeStyle.textContent += `
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272,
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272 > td,
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272:hover > td,
html[data-nangman-theme="dark"] body #rk218 tr.row-keep,
html[data-nangman-theme="dark"] body #rk218 tr.row-keep > td,
html[data-nangman-theme="dark"] body #rk218 tr.row-keep:hover > td{
 background:#294b43!important;background-color:#294b43!important;
 color:#f1fff6!important;border-color:#668d7f!important;
 opacity:1!important;
}
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272 > td :is(b,strong,span,small),
html[data-nangman-theme="dark"] body #rk218 tr.row-keep > td :is(b,strong,span,small){
 color:#f1fff6!important;opacity:1!important;
}
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272 .rk-grade256{
 background:var(--gback)!important;border-color:var(--gb)!important;color:var(--gc)!important;
}
html[data-nangman-theme="dark"] body #rk218 tr.search-hit272 .rk-grade256 :is(b,small,strong,span){
 color:var(--gc)!important;
}
`;
syncHostTheme();
document.head.appendChild(themeStyle);
function capMangjing(){
 const field=document.getElementById('specialAttachCount');
 if(field){field.max='200';if(Number(field.value)>200)field.value='200'}
 const detailField=document.getElementById('dsearchmj264');
 if(detailField){detailField.max='200';if(Number(detailField.value)>200)detailField.value='200'}
}

function reply(status,message,version){
 if(window.parent!==window)window.parent.postMessage({
  kind:'nangman-native-equipment',status,module:'nangman-v350',
  message:message||'',version
 },origin);
}
function go(view){
 if(!validViews.has(view))return;
 active=view;
 try{
  if(typeof window.rk218Open!=='function')throw Error('원본 장비 화면이 준비되지 않았습니다');
  window.rk218Open(view);
  reply('navigated',view+' 화면 선택됨');
  requestAnimationFrame(()=>{applyHostPresentation();capMangjing();syncHeight()});
 }catch(e){reply('error','장비 화면 전환 오류: '+String(e.message||e))}
}
window.addEventListener('message',e=>{
 if(e.source!==window.parent||e.origin!==origin||!e.data)return;
 const d=e.data;
 if(d.kind==='nangman-equipment-target'){
  go(String(d.view||'find'));return;
 }
 if(d.kind==='nangman-equipment-focus'){
  try{
   const selected=window.nangman350FocusEquipment?.(d.equipment,d.tab||'route');
   if(!selected?.ok)throw Error(selected?.message||'저장된 장비를 찾지 못했습니다.');
   reply('focused',selected.message||(selected.source==='snapshot'?'전달된 개별 시드로 정련·망정·촉련 상세를 표시했습니다':'선택한 보유 장비의 상세를 표시했습니다'));
  }catch(error){reply('error',String(error.message||error))}
  return;
 }
 if(d.kind==='nangman-equip-save'){
  try{
   if(!d.save){reply('applied','세이브가 연결되지 않았습니다',d.version);return}
   if(typeof window.applySharedSaveJson!=='function')throw Error('원본 세이브 적용 함수 없음');
   window.applySharedSaveJson(d.save);
   saveVersion=d.version;
   go(active);
   reply('applied','가져온 계정의 제작 시드와 보유 장비가 적용되었습니다',d.version);
  }catch(error){reply('error',String(error.message||error),d.version)}
 }
 if(d.kind==='nangman-equipment-theme'){
  document.documentElement.dataset.nangmanTheme=d.theme==='dark'?'dark':'light';
  applyHostPresentation();capMangjing();
 }
});
let previousHeight=0;
function syncHeight(){
 const height=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0);
 if(height>0&&Math.abs(height-previousHeight)>12&&window.parent!==window){
  previousHeight=height;
  window.parent.postMessage({kind:'nangman-equipment-height',height},origin);
 }
}
window.addEventListener('load',()=>{
 reply('ready','v3.50 장비 계산 엔진 로드 완료');
 go(active);
 applyHostPresentation();syncHeight();
 if(typeof ResizeObserver==='function'){
  const resize=new ResizeObserver(()=>syncHeight());
  resize.observe(document.documentElement);
  if(document.getElementById('rk218'))resize.observe(document.getElementById('rk218'));
  const mutation=new MutationObserver(()=>{applyHostPresentation();capMangjing();syncHeight()});
  if(document.getElementById('rk218'))mutation.observe(document.getElementById('rk218'),{childList:true,subtree:true});
 }
});

})();
