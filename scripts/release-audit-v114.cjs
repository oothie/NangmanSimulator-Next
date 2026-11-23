'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),all=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
 if(ent.name==='.git'||ent.name==='node_modules')continue;
 const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else all.push(path.relative(root,p).replaceAll('\\','/'));
}}walk(root);
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const htmlFiles=all.filter(p=>p.endsWith('.html')&&!p.startsWith('tests/'));
const jsFiles=all.filter(p=>p.endsWith('.js')&&!p.startsWith('tests/'));
const findings=[],counts={html:htmlFiles.length,js:jsFiles.length,visibleCjk:0,maybeUiChinese:0,broken:0,userExample:0};
const add=(severity,file,kind,detail,n)=>findings.push({severity,file,kind,detail:detail.slice(0,130),count:n});
for(const p of htmlFiles){
 const html=load(p),visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<!--[\s\S]*?-->/g,'')
 .replace(/<[^>]+>/g,' ');
 const matches=[...visible.matchAll(/.{0,30}[\u3400-\u9fff].{0,55}/gu)];
 counts.visibleCjk+=matches.length;
 if(matches.length)add('HIGH',p,'visible-Chinese',matches[0][0].replace(/\s+/g,' '),matches.length);
 if(!/\blang=["']ko["']/i.test(html))add('MEDIUM',p,'no-Korean-language-attribute','',1);
 for(const m of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"'#?]+)/gi)){
  let uri=m[1];if(/^(?:https?:|\/\/|data:|blob:|#)/i.test(uri))continue;
  if(uri.startsWith('/'))uri=uri.slice(1);
  else uri=path.posix.normalize(path.posix.join(path.posix.dirname(p),uri));
  if(!uri||uri.startsWith('..'))continue;
  if(!fs.existsSync(path.join(root,uri))){counts.broken++;add('HIGH',p,'missing-static-dependency',uri,1)}
 }
 const og=[...html.matchAll(/(?:content|src|href)=["']https?:\/\/[^"']+/gi)]
 .filter(m=>/launch-ai\.cloud|yy-sim\.pages\.dev|github\.io/i.test(m[0]));
 if(og.length)add('MEDIUM',p,'external-links',og[0][0],og.length);
}
const trusted=/^(?:data\/|vendor\/yysim\/|vendor\/sanbujin\/shared\/(?:item_names|data|born_talent_data|hengshan_talent_data|equip_data|i18n|simulator)|vendor\/nangman-v350\/)/;
for(const p of jsFiles){
 if(trusted.test(p))continue;
 const s=load(p);const matches=[...s.matchAll(/["'][^"'\r\n]{0,180}[\u3400-\u9fff][^"'\r\n]{0,180}["']/g)]
 .filter(m=>!/[가-힣]/.test(m[0])&&!/[/\\]|\.js/.test(m[0]));
 if(matches.length){counts.maybeUiChinese+=matches.length;add('MEDIUM',p,'possible-Chinese-runtime-label',matches[0][0],matches.length)}
}
for(const p of all.filter(p=>/data\/market-reference-saves|tests\/fixtures\/.*\.json/i.test(p))){
 counts.userExample++;add('BLOCKER',p,'user-derived-example-present',p,1)
}
const report={generated:new Date().toISOString(),status:counts.userExample||counts.visibleCjk||counts.broken?'NOT_READY':'SOURCE_PASS',counts,findings:findings.sort((a,b)=>
 ({BLOCKER:0,HIGH:1,MEDIUM:2}[a.severity]-{BLOCKER:0,HIGH:1,MEDIUM:2}[b.severity])).slice(0,120)};
fs.mkdirSync(path.join(root,'release-reports'),{recursive:true});
fs.writeFileSync(path.join(root,'release-reports/qa-v1.1.4.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
