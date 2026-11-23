'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const groups={
 '공통·배포':['html-inline-syntax','module-integration-smoke','workflow-integration-smoke'],
 '세수':['wash-chain-smoke','wash-conflict-model-smoke','wash-goal-audit-smoke',
  'wash-goal-lock-smoke','wash-path-model-smoke','wash-preview-model-smoke',
  'wash-slot-controls','wash-target-path-smoke','wash-ui-theme-regression',
  'wash-opened-slot-display','yysim-auto-search-smoke','yysim-auto-progressive-smoke',
  'yysim-native-search-guard-smoke','yysim-native-save-state-smoke'],
 '장비':['equipment-detail-bridge-smoke','nangman-v350-equipment-smoke',
  'shared-gear-sequence-smoke'],
 '인물·계정':['character-layout-smoke','character-source-smoke',
  'account-growth-counts-smoke','account-record-resources-smoke',
  'character_saved_info_regression'],
 '백과':['wiki-icon-structure','wiki-icon-mapping-smoke','yysim-korean-names-smoke'],
 '일일·암시장':['daily-market-smoke','daily-market-scenarios-smoke',
  'market-arbitrary-save-regression','market-quantity-strategy-smoke',
  'market-dual-server-six-slots-regression','market-second-server-vip-strategy-regression'],
 '드랍':['drop-90-catalog-parity','drop-quality-filter-smoke','drop-boss-removal-smoke',
  'dungeon-boss-probability-smoke','dungeon-dual-forecast-smoke',
  'dungeon-one-time-ownership-smoke','dungeon-yysim-rng-parity',
  'tomb-field-smoke','tomb-compare-smoke','wild-special-32299-verified'],
 '임무':['quest-branch-smoke']
};
const files=Object.entries(groups).flatMap(([group,names])=>names.map(name=>({group,name,path:'tests/'+name+'.cjs'})));
const output=[];
for(const item of files){
 const target=path.join(root,item.path);
 if(!fs.existsSync(target)){output.push({...item,status:'MISSING'});continue}
 const r=cp.spawnSync(process.execPath,[target],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:128*1024});
 output.push({...item,status:r.error?.code==='ETIMEDOUT'?'TIMEOUT':r.status===0?'PASS':'FAIL',
  details:r.status===0?'':String((r.stderr||r.stdout||'').slice(-600)).replace(/[0-9]{8,}/g,'[number]').slice(0,360)});
 console.log('QA_TEST '+item.group+' '+item.name+' '+output.at(-1).status);
}
const total={checked:output.length,pass:output.filter(x=>x.status==='PASS').length,
 fail:output.filter(x=>x.status==='FAIL').length,
 timeout:output.filter(x=>x.status==='TIMEOUT').length,
 missing:output.filter(x=>x.status==='MISSING').length};
fs.mkdirSync(path.join(root,'release-reports'),{recursive:true});
fs.writeFileSync(path.join(root,'release-reports/test-matrix-v114.json'),JSON.stringify({total,output},null,2));
console.log('QA_MATRIX '+JSON.stringify({total,issues:output.filter(x=>x.status!=='PASS')}));
if(total.fail||total.timeout||total.missing)process.exitCode=1;
