#!/usr/bin/env node
/* Public artifact guard. No real save data, identifiers, or fixtures embedded. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const skip=new Set(['.git','node_modules','.cache','dist']);
const findings=[];
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(skip.has(ent.name))continue;
  const full=path.join(dir,ent.name);
  const rel=path.relative(root,full).replace(/\\/g,'/');
  if(ent.isDirectory()){walk(full);continue}
  if(!ent.isFile())continue;
  const name=ent.name.toLowerCase();
  // Only check prohibited filename classes and structured user-save snapshots;
  // public game data and program code are allowed.
  if(/(?:^|[._-])(?:personal[-_]?save|user[-_]?save|actual[-_]?save|private[-_]?fixture)(?:[._-]|$)/i.test(name)||
      /(?:세이브|서버세이브|섭세이브).*\.(?:json|zip|csv|txt)$/i.test(name)||
      /(?:^|\/)\d+(?:섭|서버).*\.(?:json|zip|csv)$/i.test(rel)){
    findings.push(rel+': prohibited save-derived filename');
  }
  if(!/\.(?:json|jsonl|csv|md|txt|cjs|js|ts)$/i.test(name))continue;
  if(fs.statSync(full).size>5*1024*1024)continue;
  const source=fs.readFileSync(full,'utf8');
  // Keep personal replay evidence out of the deployable dungeon engines.
  // Test saves and observed drops belong to local/off-repository validation only.
  if(/^engine\/dungeon(?:-[a-z0-9-]+)?\.js$/i.test(rel) &&
      /(?:11[0-3][0-9]|20[0-9]{2}[.\/-]?11[.\/-]?[0-9]{2})\s*(?:세이브|실측)|(?:세이브|실측)\s*(?:11[0-3][0-9]|20[0-9]{2}[.\/-]?11[.\/-]?[0-9]{2})/i.test(source))
    findings.push(rel+': dated personal save validation text must stay outside the public engine');
  // Serialized save snapshots: multiple independent account-specific roots.
  if(/\.(?:json|jsonl|csv|md|txt)$/i.test(name)&&
      /["']?RandShop["']?\s*:/.test(source)&&
      /["']?Rnds["']?\s*:/.test(source)&&
      /["']?(?:CenterID|MainRole|GoldSum)["']?\s*:/.test(source))
    findings.push(rel+': serialized account save detected');
  // Catch embedded numeric account RNG fixtures (not code that reads state).
  if(/\.(?:js|cjs|ts|md|txt)$/i.test(name)&&
      /(?:guishishop|BornTalent\s*\.\s*S)\s*[:=]\s*\d{6,}\b/.test(source))
    findings.push(rel+': hardcoded save-derived RNG value');
 }
}
walk(root);
if(findings.length){
 console.error('BLOCKED: public repository contains potentially private artifacts:');
 for(const item of findings)console.error(' - '+item);
 process.exitCode=1;
}else console.log('PASS: no prohibited personal-save artifacts found (heuristic scan only)');
