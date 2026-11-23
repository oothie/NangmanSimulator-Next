// Standalone Diling before/after JSON comparison regression, no real save mutation.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'vendor','sanbujin','drops'),ctx={window:{}};
vm.createContext(ctx);
for(const name of ['wild-core.js','tomb-core.js','tomb-compare-core.js'])
 vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),ctx);
const tomb=ctx.window.SBJTombDrop,compare=ctx.window.SBJTombSaveCompare;
const before={Rnds:{Sds:{rollenemy_tomb:45671,seed_35256:28719}},
 globalVariable:{3007:6,eat_2659:0,rollenemy_tomb2:1000,get_history:0,
 treasure_hunting_cbt:0}};
const snapshot=JSON.stringify(before);
const initial=tomb.open(before);
const primary=tomb.trace(initial,{count:2,order:'descending'});
const after={Rnds:{Sds:{rollenemy_tomb:primary.final.encounterSeed,
 seed_35256:primary.final.equipmentSeed}},
 globalVariable:{...before.globalVariable,rollenemy_tomb2:primary.final.flags.rollenemy_tomb2}};
const snapshotAfter=JSON.stringify(after);
const changed=compare.diff(before,after);
assert(changed.seeds.length===2&&changed.flags.length>0);
assert(changed.gearPool.length===8,'source 90-level equipment pool retained');
const result=compare.reconcile(before,after,2);
assert.equal(result.count,2);
assert.equal(result.cases.length,2);
assert(result.cases.some(c=>c.order==='descending'&&c.mismatches===0&&c.missing===0),
 'generated checkpoint should match same model order');
assert.equal(result.cases.find(c=>c.order==='descending').checks.length,3);
assert.equal(JSON.stringify(before),snapshot,'comparison never modifies saved before state');
assert.equal(JSON.stringify(after),snapshotAfter,'after-save JSON preserved');
assert.equal(compare.preview(before,2000).length,2000,
 'two-save preview must accept the advertised 2000 field events');
assert.equal(compare.reconcile(before,after,2000).count,2000,
 'two-save comparison must accept the advertised 2000 field events');
assert.throws(()=>compare.reconcile(before,after,2001),/1~2000/);
const noSeed={Rnds:{Sds:{}},globalVariable:before.globalVariable};
assert(compare.reconcile(noSeed,after,2).cases.length===0,'missing before RNG blocks candidate ordering');
assert(compare.diff(before,noSeed).seeds.every(x=>x.status==='데이터 누락'));
const noFlags={Rnds:before.Rnds,globalVariable:{3007:6}};
assert(compare.reconcile(noFlags,after,2).cases.length===0,'missing flags cannot become assumed zeros');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert(html.includes('id="tombBefore"')&&html.includes('id="tombAfter"'));
assert(html.includes('id="tombCompareCount"')&&html.includes('src="./tomb-compare-core.js"'));
assert(html.includes('src="./tomb-compare.js"'));
assert(html.indexOf('tomb-core.js')<html.indexOf('tomb-compare-core.js'));
assert(html.indexOf('tomb-compare-core.js')<html.indexOf('tomb-compare.js'));
assert(html.indexOf('<section id="wildDrop"')<html.indexOf('<section id="tombSaveCompare"'));
const between=html.slice(html.indexOf('<section id="wildDrop"'),html.indexOf('<section id="tombSaveCompare"'));
const nesting=(between.match(/<section\b/g)||[]).length-(between.match(/<\/section>/g)||[]).length;
assert(nesting>0,'save comparison remains nested inside wild tab even when earlier nested sections close');
console.log('PASS: Diling before/after saved RNG delta and dual-source-order hypothesis checks');
