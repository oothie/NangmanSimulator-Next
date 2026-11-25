#!/usr/bin/env node
'use strict';
/* Research-only privacy safeguard for the low-gate code archive.
 * No user save, account ID, credentials, original RNG seeds, or native binary
 * may be committed alongside source-derived public gear ID lookup.
 */
const fs=require('node:fs');
const path=require('node:path');
const dir=__dirname;
const allow=new Set([
 '60014_equipment_candidate_pools.json',
 'after_save_equipment_evidence.cjs',
 'sealed_low_gate_equipment.cjs',
 'test_sealed_low_gate_equipment.cjs',
 'run_lower_gate_save_pair.cjs',
 'test_run_lower_gate_save_pair.cjs',
 'audit_40_table_synthetic_key.cjs',
 'test_audit_40_table_synthetic_key.cjs',
 'audit_40_table_metadata_positions.cjs',
 'test_audit_40_table_metadata_positions.cjs',
 'audit_40_table_equipment_effects.cjs',
 'test_audit_40_table_equipment_effects.cjs',
 'gate_table_order_preflight.cjs',
 'test_gate_table_order_preflight.cjs',
 'test_after_save_equipment_evidence.cjs',
 'check_research_privacy.cjs',
 'README.md'
]);
const files=fs.readdirSync(dir);
for(const name of files){
 if(!allow.has(name))throw Error('Unapproved lower-gate research file: '+name);
 const p=path.join(dir,name);
 if(!fs.statSync(p).isFile())throw Error('Research directory must contain files only');
 if(/\.(?:db|sqlite|apk|so|sb3|bin|enc|whale|zip)$/i.test(name))
  throw Error('Source binaries and accounts forbidden');
 const content=fs.readFileSync(p,'utf8');
 if(/(?:\b(?:userid|user_id|account_id|sessionToken|savePassword|access_token)\b)\s*[:=]\s*['"][^'"]{5,}['"]/i.test(content))
  throw Error('Potential account-derived string');
}
console.log('PASS research lower-gate allowlist, no save or original source binary included');
