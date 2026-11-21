// All original yy-sim talent IDs must display Korean names in every wash surface.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['shared/sanbujin_talent_names_ko.js','engine/yysim-target-catalog.js'])
 vm.runInContext(read(file),ctx,{filename:file});
vm.runInContext(read('vendor/yysim/data.js'),ctx,{filename:'original-talent-data'});
const index=read('index.html'),start=index.indexOf('function characterTalentName(id){'),
 end=index.indexOf('function characterTalentTimeDisplay(',start);
assert(start>0&&end>start,'shared Korean talent resolver exists');
vm.runInContext('const wikiHasChinese=value=>/[\u3400-\u9fff]/.test(String(value||""));\n'+
 index.slice(start,end)+'\nwindow._talentName=characterTalentName;',ctx);
const names=ctx.window.NANGMAN_TALENT_NAMES_KO;
const catalog=ctx.window.YYWashTargetCatalog;
const original=Object.values(ctx.TALENT_DATA)
 .filter(item=>item.name&&item.name!=='备用天赋');
assert(original.length>=90);
for(const item of original){
 const ko=ctx.window._talentName(item.id);
 assert(ko&&!/재능 #/.test(ko),'ID '+item.id+' should show a Korean talent name: '+ko);
 assert(!/[\u3400-\u9fff]/.test(ko),'Chinese name not exposed: '+item.id+' '+ko);
 assert.equal(ko,names[String(item.id)],'same authoritative name across all wash views');
}
for(const group of catalog){
 for(const item of group.items){
  assert.equal(item.ko,names[String(item.id)],'catalog and shared source agree: '+item.id);
  assert.equal(ctx.window._talentName(item.id),item.ko,'auto checkbox displays canonical Korean name');
 }
}
for(const [id,name] of Object.entries({
  170:'정기 왕성',171:'뛰어난 힘',182:'도법 명인',184:'짙은 기운',
  193:'거대한 체구',194:'권각 고수',248:'구음귀맥',
  249:'현양신맥',250:'혼원기맥',251:'일심겸용',268:'천생신력',
  271:'환생금선',272:'귀연정천',400:'도심검담',401:'월봉청영'
}))assert.equal(ctx.window._talentName(id),name,'Korean game ID mapping '+id);
assert.equal(ctx.window._talentName(999999),'재능 #999999','non-source unknown IDs are not invented');
const native=index.slice(index.indexOf("if(sub==='auto'){"),index.indexOf("if(sub==='exchange'){"));
assert(native.includes('const talentName=id=>characterTalentName(id)'));
assert(native.includes('api.describeAction(a,mapNames,talentName)'));
assert(native.includes('talentName(a.id)'));
assert(index.includes('./shared/sanbujin_talent_names_ko.js'));
assert(index.includes('options.desiredIds.map(id=>'),'auto search status should format Korean goal names');
assert(!index.includes("options.desiredIds.join(', ')"),'raw numeric IDs must not replace the goal-name list');
assert(index.includes("window.__nangmanTalentKoName?.(talentId)"),'collision target should show Korean name');

console.log('PASS: all '+original.length+' original yy-sim talents mapped to Korean; 71 searchable color goals, character/preview/route names share one resolver');
