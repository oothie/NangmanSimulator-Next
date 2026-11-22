'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const v350=fs.readFileSync(path.join(base,'vendor/nangman-v350/wash.html'),'utf8');
const wasm=fs.readFileSync(path.join(base,'vendor/yysim/engine-host.html'),'utf8');
const catalog=fs.readFileSync(path.join(base,'engine/yysim-target-catalog.js'),'utf8');
for(const grade of [2,3,4])assert(html.includes('data-wash-grade="'+String(grade)+'"')||
 html.includes("data-wash-grade=\"'+group.quality"),'graded selector group template');
assert(html.includes('class="wash-auto-choice"'),'large selectable talent button');
assert(html.includes('aria-pressed="'+String('')), 'pressed-state template');
assert(html.includes("const adding=!ids.includes(id)"),'toggle removes or adds selected target');
assert(html.includes("if(adding&&ids.length>=4)"),'maximum four goals');
assert(html.includes("el.onclick=()=>"),'buttons are directly clickable');
assert(html.includes("el.hidden=!show"),'search filters buttons');
assert(html.includes('wash-auto-choice[aria-pressed="true"]'),'active style');
for(const color of ['#287d54','#286aa9','#8b52a3'])assert(html.includes(color),'quality colors');
assert(!html.includes('input type="checkbox" data-yy-auto-id'),'checkbox selector removed');
assert(v350.includes('<select id="roleSel" hidden'),'source role select retained for internal engine only');
assert(!v350.includes('id="rulesPane"'),'rules panel deleted');
assert(!v350.includes('data-pane="rulesPane"'),'rules tab deleted');
assert(v350.includes('nangman-v350-site-theme'),'same theme palette override');
assert(v350.includes("if(!match)throw Error("),'selected role must exist, no fallback to wrong character');
assert(v350.includes("roleSel.value=match.value"),'parent selection forwarded to source engine');
assert(wasm.includes("op==='auto-search'"));
assert(!wasm.includes("op==='auto-intermediate-search'"),
 'Removed own sequential wash mode must remain disabled');
assert(wasm.includes('YYWashPurpleAnchorMixed.run'),
 'Original WASM purple-anchor route extension must be linked');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts){if(/^\s*import\s/m.test(script))continue;
 assert.doesNotThrow(()=>new Function(script),'integrated script syntax');}
for(const script of [...v350.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]))
 assert.doesNotThrow(()=>new Function(script),'v3.50 engine script syntax');
console.log('PASS: unified v3.50 UI, hidden duplicate role selector, deleted rules, quality-colored selectable target buttons, valid engine JS');
