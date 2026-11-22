'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/sanbujin/drops/dungeon-v3-cross-audit.js'),'utf8'),sandbox);
const audit=sandbox.window.SBJDungeonV3CrossAudit;
const start={seeds:{'seed_byj':123}},end={seeds:{'seed_byj':777}};
const src={trace:[{key:'seed_byj',bound:1000,after:12},{key:'seed_byj',bound:100,after:43}],
 finalSeeds:{'seed_byj':43}};
const native={trace:[{key:'seed_byj',bound:1000,after:12},{key:'seed_byj',bound:4,after:777}],
 finalSeeds:{'seed_byj':777}};
const output=audit.inspect(src,native,start,end),row=output.rows[0];
assert.equal(row.key,'seed_byj');
assert.equal(row.firstBoundDifference,1);
assert.equal(row.differingBound.call,2);
assert.equal(row.source.match,false);
assert.equal(row.native.match,true);
assert.equal(output.nativeSeedMatches,1);
const without=audit.inspect(src,native,start,null);
assert.equal(without.rows[0].source.match,null);
assert.equal(without.rows[0].native.match,null);
assert.equal(audit.inspect({trace:[]},{trace:[]},start,end).rows.length,0);
console.log('PASS cross audit: divergence step, seed matching, missing post-save, empty traces');
