// Talent #251 user-confirmed Korean name and every yy-sim slot label regression.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(read('shared/sanbujin_talent_names_ko.js'),ctx);
vm.runInContext(read('engine/yysim-target-catalog.js'),ctx);
vm.runInContext(read('vendor/yysim/data.js'),ctx);
vm.runInContext(read('engine/yysim-auto-search.js'),ctx);
const dict=ctx.window.NANGMAN_TALENT_NAMES_KO;
const groups=ctx.window.YYWashTargetCatalog;
assert.equal(dict['251'],'일심겸용');
const only251=groups.flatMap(g=>g.items).find(x=>x.id===251);
assert(only251,'251 is a selectable purple meridian');
assert.equal(only251.ko,'일심겸용');
assert.equal(only251.name,'一心两用','native string is untouched');
const all=Object.values(ctx.TALENT_DATA).filter(x=>x?.name&&x.name!=='备用天赋');
const missing=all.filter(t=>!dict[String(t.id)]||/^재능\s*#/.test(dict[String(t.id)]));
assert.deepEqual(Array.from(missing,x=>x.id),[],'all yy-sim talent IDs must have Korean labels');
for(const g of groups)for(const t of g.items){
 assert.equal(dict[String(t.id)],t.ko,'target catalog must follow shared Korean dictionary #'+t.id);
 assert.equal(ctx.TALENT_DATA[String(t.id)].pinzhi,g.quality,'quality comes from original yy-sim');
}
const nameIds={'一心两用':251,'天生神力':268};
const converter=id=>dict[String(id)]||'재능 #'+id;
const action=ctx.window.YYWashAutoSearch.describeAction(
 {kind:'lock',talent:'一心两用',wash_no:2},nameIds,converter);
assert.match(action.detail,/일심겸용/);
assert(!action.detail.includes('재능 #251'));
const numeric=ctx.window.YYWashAutoSearch.describeAction({kind:'lock',talent:251},nameIds,converter);
assert.match(numeric.detail,/일심겸용/,'native numeric ID must use Korean confirmed talent name');
const alreadyKorean=ctx.window.YYWashAutoSearch.describeAction({kind:'lock',talent:'일심겸용'},nameIds,converter);
assert.match(alreadyKorean.detail,/일심겸용/,'already localized native route name must be retained');
const status=ctx.window.YYWashAutoSearch.readableStep('锁定一心两用',nameIds,converter);
assert(status.includes('일심겸용'),'native Chinese step is mapped to confirmed Korean');
const html=read('index.html');
assert(html.includes('function characterTalentName(id)'),'all views share one resolver');
assert(html.includes('escape(characterTalentName(t.id))'),'character slots use resolver');
assert(html.includes('data-yy-auto-id'),'automatic targets use resolver');
assert(html.includes('api.describeAction(a,mapNames,talentName)'),'route step uses resolver');
console.log('PASS: #251 일심겸용 fixed in shared dictionary, every yy-sim talent ID, selection, result and route display');
