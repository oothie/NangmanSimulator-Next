#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const source=require('./60014-qingcheng-source-formation-provenance.json');
const modules=source.sources;
assert.equal(source.evidenceVersion,'60014');
assert.equal(modules.JHTmxMap.prototypes,286);
assert.equal(modules.JHTmxMap.methods.length,3);
assert.deepEqual(modules.JHTmxMap.methods.map(x=>x.prototype),[99,126,202]);
assert(modules.JHTmxMap.methods.every(x=>x.directRandomTokensPresent===false));
assert.equal(modules.JHNetServer.prototype,23);
assert.equal(modules.QingchengTmx.prefix,'DADDY');
assert.equal(modules.QingchengTmx.decrypted,false);
assert.equal(source.futureBanditAppearances,null);
assert.equal(source.originalRuntimeNextSpawnVerified,false);
assert.equal(source.exact7209AwardPredictionAllowed,false);
assert(!JSON.stringify(source).includes('aidrop70Seed'));
console.log('PASS source-only 60014 Qingcheng map NPC formation provenance and no invented spawn schedule');
