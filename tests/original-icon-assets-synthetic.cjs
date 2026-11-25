/* Verify self-hosted 60014 Korean original PNG icons, not personal saves. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),PNG=Buffer.from('89504e470d0a1a0a','hex');
const manifest=fs.readFileSync(path.join(root,'data/item-icon-manifest.js'),'utf8');
const ctx={window:{}};vm.runInNewContext(manifest,ctx);
for(const [group,name,minimum] of [
 ['item','ITEM',1422],['equip','EQUIP',823],['martial','MARTIAL',1028]
]){
 const base=path.join(root,'icons',group);
 const files=fs.readdirSync(base).filter(x=>/^\d+\.png$/.test(x));
 assert(files.length>=minimum,group+' source PNG count');
 const declared=ctx.window['NANGMAN_HOSTED_'+name+'_ICONS'];
 assert.equal(declared.size,files.length,group+' manifest count');
 for(const file of files){
  const payload=fs.readFileSync(path.join(base,file));
  assert(payload.subarray(0,8).equals(PNG),group+'/'+file+' invalid PNG signature');
  assert(declared.has(Number(file.slice(0,-4))),group+'/'+file+' missing manifest ID');
 }
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/<title>낭만강호 통합 시뮬레이터 v1\.3\.0<\/title>/);
assert(html.includes('data/item-icon-manifest.js?rev=1.3.0'),
 'browser must receive the new item icon manifest, not its cached empty predecessor');
assert(html.includes("'./icons/'+folder+'/'+id+'.png'"));
console.log('PASS: 3,273 Korean item/equipment/martial sprites present and locally wired');
