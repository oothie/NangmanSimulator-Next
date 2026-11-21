// Full save Branch progress, Korean mission titles and CSV regression.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'engine','quest-branch.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(script,ctx);
const api=ctx.window.NangmanQuest;
assert(api&&typeof api.model==='function'&&typeof api.csv==='function');
const branches={};
for(let n=0;n<556;n++)branches['finished_'+n]={step:-1,recv:1731680000+n};
const names=[
 'cbs_treasure_js','general_jiwo_egg','ly_GengFu','eastsea_nature','lxz_LinHeng',
 'qls_gf_talk','cbs_swarm_jianshi','lv_100_one','taiyi_daoxue','qls_gf',
 'cd_baguafuxi2','ly_alyd','cd_bagua_task','cbsbz_js','td_blademaster',
 'cl_dragonspear','ly_GengFuTalk','dmqj_js2','lxz_ylg','hz_setXuanWo',
 'dmqj_js','lingyue_jiayi_js','byj_rd'
];
names.forEach((key,i)=>{branches[key]={step:i%7,trace:i%4===0,hint:i%5===0,
 recv:1791710508+i}});
const model=api.model({Branch:branches});
assert.equal(model.rows.length,579,'all saved Branch entries');
assert.equal(model.active,23,'original Branch step nonnegative');
assert.equal(model.done,556,'original Branch step minus one');
assert(model.traced>0,'tracked active quests counted');
assert.equal(model.rows.filter(x=>x.active).length,23);
assert.equal(Object.keys(api.verified).length,23,'all 23 known active branch names translated');
assert(model.rows.find(x=>x.id==='cl_dragonspear').name==='풍우가 닥쳐오다');
assert(!model.rows.find(x=>x.id==='dmqj_js').detail.includes('*****'),'Chinese placeholder removed');
assert.equal(api.model({Branch:{'no-step':{recv:1791710508}}}).unknown,1,'missing step is not done');
assert.equal(api.model({Branch:{foo:{step:-2}}}).unknown,1,'unknown negative step never considered done');
const csv=api.csv(model);
assert(csv.startsWith('\uFEFF'),'Excel BOM');
const untrusted=api.csv({rows:[{id:'=1+1',name:' +SUM(1)',step:0,status:'진행 중',traced:false,received:null,detail:'-1+2'}]});
assert(untrusted.includes('"\'=1+1"'),'CSV ID formula injection escaped');
assert(untrusted.includes('"\' +SUM(1)"'),'CSV leading whitespace formula injection escaped');
assert(untrusted.includes('"\'-1+2"'),'CSV negative formula injection escaped');
assert(csv.includes('완료 기록')&&csv.includes('진행 중'),'CSV contains state');
assert(csv.includes('풍우가 닥쳐오다'),'CSV Korean branch name');
assert(csv.includes('"cl_dragonspear"'),'CSV stable source ID');
assert(!csv.includes('undefined'),'CSV no undefined fields');
assert(html.includes('./engine/quest-branch.js'),'main site imports mission logic');
assert(html.includes("['branch','임무 진행도']"),'branch tab in main UI');
assert(html.includes("id=\"questBranchExport\""),'branch CSV button');
assert(html.includes("data-quest-filter"),'status filters');
assert(html.includes('다음 이야기 준비 중'),'original 9999999 main-story sentinel localized');
console.log('PASS: 579 saved Branch status records, 23 Korean active entries and mission CSV');
