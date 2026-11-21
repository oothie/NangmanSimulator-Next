// Compile all project-maintained inline scripts without browser APIs.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const pages=['index.html','vendor/yysim/engine-host.html','vendor/sanbujin/drops/index.html'];
let compiled=0;
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 assert(scripts.length>0,page+' has scripts');
 for(const [i,script] of scripts.entries()){
  if(/\bsrc\s*=/.test(script[1]))continue;
  if(/\btype\s*=\s*["'](?:application\/json|text\/template)/i.test(script[1]))continue;
  if(/\btype\s*=\s*["']module["']/i.test(script[1])){
   const result=spawnSync(process.execPath,['--check','--input-type=module'],
    {input:script[2],encoding:'utf8'});
   assert.equal(result.status,0,'module syntax: '+page+'#inline-'+i+'\n'+result.stderr);
  }else{
   assert.doesNotThrow(()=>new vm.Script(script[2],{filename:page+'#inline-'+i}),
    'JavaScript syntax: '+page+'#inline-'+i);
  }
  compiled++;
 }
}
for(const file of ['engine/wash-chain-core.js','engine/wash-path-model.js','engine/wash-preview-model.js',
  'engine/wash-conflict-model.js','engine/yysim-auto-search.js',
  'engine/yysim-auto-progressive.js','vendor/sanbujin/drops/shared-gear-core.js',
  'vendor/sanbujin/drops/shared-gear.js']){
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file}),
  'syntax: '+file);
 compiled++;
}
console.log('PASS: '+compiled+' inline and new source JavaScript blocks compile without syntax errors');
