#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {safeResult}=require('./qingcheng-mask-cli.cjs');
const save={Rnds:{Sds:{aidrop70:173827}},PrivateAccountId:'DO_NOT_ECHO',EncryptID:'DO_NOT_ECHO'};
const prior=safeResult(save);
assert.equal(prior.observedFieldFights,0);
assert.equal(prior.exactFutureBanditAppearances,null);
assert.equal(prior.actualMaskDropVerified,false);
assert.equal(prior.rawSavePrinted,false);
const observed=safeResult(save,[{bandits:0,otherEnemies:3},{bandits:1,otherEnemies:2}]);
assert.equal(observed.observedFieldFights,2);
assert.equal(observed.observedLevel70Bandits,1);
assert.equal(observed.nextCandidateDraw,prior.nextCandidateDraw-1);
assert.equal(observed.requiredLevel70CallsBeforeTarget,prior.requiredLevel70CallsBeforeTarget-1);
assert(!JSON.stringify(observed).includes('173827'));
assert(!JSON.stringify(observed).includes('DO_NOT_ECHO'));
assert.deepEqual(save,{Rnds:{Sds:{aidrop70:173827}},PrivateAccountId:'DO_NOT_ECHO',EncryptID:'DO_NOT_ECHO'});
console.log('PASS local-only field bandit ledger, current mask target and strict private-data non-disclosure');
