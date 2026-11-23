'use strict';
/* Deterministic allowlisted public bundle; research, uploaded user data and
 * private test fixtures must not be served from the site root. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist-public');
const allowed=new Set(['data','engine','shared','i18n','vendor','assets','icons']);
const disallowed=/^(?:assets\/archive_parts\/|(?:data\/market-reference-saves\.js)|tests\/|checkpoints\/|docs\/|release-reports\/)/;
const forbidden=/\.(?:zip|apk|sqlite|db|bak|map|md|csv|log)$/i;
const exts=/\.(?:html|css|js|json|svg|png|webp|jpg|jpeg|woff2|woff|wasm|txt|licence|license)$/i;
if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
const copied=[],skipped=[];
function copyFile(rel){
 const dest=path.join(out,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.copyFileSync(path.join(root,rel),dest);copied.push(rel);
}
copyFile('index.html');
function walk(dir){
 if(!fs.existsSync(dir))return;
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,ent.name),rel=path.relative(root,full).replaceAll('\\','/');
  if(disallowed.test(rel))continue;
  if(ent.isDirectory())walk(full);
  else if(exts.test(ent.name)&&!forbidden.test(ent.name))copyFile(rel);
  else skipped.push(rel);
 }
}
for(const dir of allowed)if(fs.existsSync(path.join(root,dir)))walk(path.join(root,dir));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
fs.writeFileSync(path.join(out,'_headers'),
 '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: geolocation=(), microphone=(), camera=()\n');
const bad=copied.filter(p=>disallowed.test(p)||/\.json$/.test(p)&&/fixture|sample|save/i.test(p));
if(bad.length)throw Error('Public bundle contains forbidden user data: '+bad.join(', '));
for(const rel of ['shared/readability-v084.css','vendor/sanbujin/shared/app/equipment-detail-v084.js',
 'data/item-icon-manifest.js','vendor/nangman-v350/equipment.html','vendor/nangman-v350/wash.html']){
 if(!fs.existsSync(path.join(out,rel)))throw Error('Required public asset missing: '+rel);
}
const summary={publicFiles:copied.length,totalBytes:copied.reduce((n,p)=>n+fs.statSync(path.join(out,p)).size,0),
 bannedSavedArtifacts:bad.length,
 containsSourceDocs:copied.some(p=>p.startsWith('tests/')||p.startsWith('docs/')||p.startsWith('checkpoints/')),
 originalSeedSnapshots:copied.filter(p=>/market-reference|lsby-reset-ticket/i.test(p)),skipped:skipped.slice(0,15)};
fs.mkdirSync(path.join(root,'release-reports'),{recursive:true});
fs.writeFileSync(path.join(root,'release-reports/public-bundle-v114.json'),JSON.stringify(summary,null,2));
console.log('PUBLIC_BUNDLE '+JSON.stringify(summary));
