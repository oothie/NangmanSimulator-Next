#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {reportLocal,TYPES}=require('./local-one-percent-report.cjs');
const original={Rnds:{Sds:{aidrop70:173827}}};
const output=reportLocal(original,{maskKills:2000});
assert.equal(output.scenarios.length,3);
assert.deepEqual(output.scenarios.map(x=>x.branch),['never','on-mask-first-hit','on-any-first-hit']);
assert.equal(output.exactDropPredictionAllowed,false);
assert.equal(output.privateInputsReported,false);
assert(!JSON.stringify(output).includes('173827'));
assert(output.scenarios.every(x=>x.maskKills===2000));
const mix=reportLocal(original,{events:[TYPES.BANDIT,TYPES.MASK,TYPES.BANDIT,TYPES.MASK]});
assert(mix.scenarios.every(x=>x.maskKills===2&&x.otherLevel70Encounters===2));
assert.throws(()=>reportLocal(original,{maskKills:0}),/mask kills/);
assert.throws(()=>reportLocal(original,{events:[35125]}),/30681/);
assert.deepEqual(original,{Rnds:{Sds:{aidrop70:173827}}});
console.log('PASS privacy-safe local-only 7209 hypothetical stage-one report');
