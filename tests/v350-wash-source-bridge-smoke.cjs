// Ensure the archived 3.50 wash engine is actually mounted as the basic
// simulator and yy-sim remains responsible for automatic route exploration.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const original=fs.readFileSync(path.join(base,'vendor/nangman-v350/wash.html'),'utf8');
const shell=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert(original.includes('const PACK='));
for(const key of ['simWash1','simWash5','simWash10','rawPane','simPane','nPane','pityPane'])
 assert(original.includes('id="'+key+'"'),key);
assert(original.includes('function simWashTimes'));
assert(original.includes('function loadSelectedSave'));
assert(original.includes('nangman-v350-load'));
assert(original.includes('nangman-v350-theme'));
assert(shell.includes('id="washV350Frame"'));
assert(shell.includes('./vendor/nangman-v350/wash.html'));
assert(shell.includes("['auto','자동 탐색']"));
assert(shell.includes("washEngine.call('auto-search',options)"));
assert(!shell.includes("'auto-intermediate-search'"),
 'Removed sequential mixed-grade search must not return');
const host=fs.readFileSync(path.join(base,'vendor/yysim/engine-host.html'),'utf8');
assert(host.includes('YYWashPurpleAnchorMixed.run'),
 'Native purple-anchor four-slot search must remain wired to live WASM');
const scripts=[...original.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
for(const src of scripts)assert.doesNotThrow(()=>new Function(src));
console.log('PASS: authentic v3.50 wash engine, auto-search retained, Korean save bridge, executable inline JS');
