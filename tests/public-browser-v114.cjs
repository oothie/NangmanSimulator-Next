'use strict';
/* Real Chromium public-visitor audit. No customer saves are loaded. */
const {chromium}=require('playwright'),http=require('node:http'),
 path=require('node:path'),fs=require('node:fs'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),port=18764;
const server=cp.spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const rest=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<60;i++){try{
 const res=await new Promise((resolve,reject)=>http.get('http://127.0.0.1:'+port+'/',r=>{r.resume();resolve(r.statusCode)}).on('error',reject));
 if(res===200)return;
 }catch(_){}await rest(200)}
 throw Error('Local static host failed to start')}
(async()=>{
 await ready();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:950},locale:'ko-KR'});
 const page=await context.newPage();
 const errors=[],badResponses=[],visited=[],screenshots=[];
 page.on('pageerror',e=>errors.push(String(e).slice(0,240)));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,180))});
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).host==='127.0.0.1:'+port)
  badResponses.push({status:r.status(),url:r.url().replace('http://127.0.0.1:'+port,'').slice(0,180)})});
 await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await rest(1500);
 const status=await page.locator('#topSaveStatus').innerText().catch(()=>'<missing>');
 if(!status.includes('미연결'))errors.push('New public visitor unexpectedly has a saved account: '+status);
 const tabs=['wash','equip','character','account','wiki','daily','drop','quest'];
 const chinese=/[\u3400-\u9fff]/;
 const scan=async(label)=>{
  await rest(220);
  const results=[];
  for(const frame of page.frames()){
   try{
    const data=await frame.evaluate(()=>{
     const ignored=new Set(['SCRIPT','STYLE','NOSCRIPT','PRE','CODE','TEXTAREA']);
     const iter=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);
     let node,list=[],checked=0;
     while(node=iter.nextNode()){
      if(!node.parentElement||ignored.has(node.parentElement.tagName))continue;
      const el=node.parentElement,style=getComputedStyle(el);
      if(style.display==='none'||style.visibility==='hidden'||el.closest('[hidden],[aria-hidden="true"]'))continue;
      const txt=String(node.nodeValue||'').trim();
      if(/[\u3400-\u9fff]/.test(txt)&&checked++<18)list.push(txt.slice(0,130));
     }
     return {title:document.title,lang:document.documentElement.lang,bodyLength:document.body?.innerText?.length||0,cjk:list};
    });
    if(data.cjk.length)results.push({frame:frame.url().slice(0,110),terms:data.cjk});
   }catch(err){errors.push('scan-'+label+': '+String(err).slice(0,140))}
  }
  visited.push({label,results});
 };
 for(const tab of tabs){
  await page.locator('[data-view="'+tab+'"]').first().click({timeout:12000});
  await rest(400);
  await scan(tab);
  let selectors=['[data-sub]','[data-module-tab]','[data-equipment-tab]','[data-market-panel]','[data-market-tab]','[data-account-tab]','[data-account-growth]','[data-wiki-cat]','[data-quest-filter]','[data-quest-category]','[data-quest-branch]','[data-drop-mode]'];
  let visitedSub=new Set();
  for(const selector of selectors){
   const items=await page.locator(selector).evaluateAll(els=>els.map(e=>({
    key:Array.from(e.attributes).find(a=>a.name.startsWith('data-')&&a.name!=='data-theme')?.value,
    label:e.textContent.trim().slice(0,40)
   }))).catch(()=>[]);
   for(const item of items.slice(0,12)){
    if(!item.key||visitedSub.has(selector+item.key)||visitedSub.size>=44)continue;
    visitedSub.add(selector+item.key);
    try{
     await page.locator(selector).filter({hasText:item.label}).first().click({timeout:2500});
     await scan(tab+'/'+item.label);
    }catch(e){errors.push('subnav: '+tab+'/'+item.key+' '+String(e.message).slice(0,100))}
   }
  }
 }
 // Test with a fully synthetic minimal Korean-shaped save. Never embed
 // user-uploaded save files, account identifiers or actual RNG states.
 const synthetic={BaseSID:4,CenterID:12345,MainRole:{
  ID:10044,Name:'검증용 인물',Level:90,Lv:90,Sex:1, ZiZhi:150,
  BornTalent:{ID:178,S:123456789,RC:0},LuckTalent:{S:987654321},
  Str:100,Con:100,Dex:100,Int:100,BornStr:10,BornCon:10,BornDex:10,BornInt:10,
  StrGift:150,ConGift:150,DexGift:150,IntGift:150,
  Talents:[],Equips:[],Equip:[],Dantian:[],Kongfu:[]},
  Roles:[],Leavers:[],Items:[],Rnds:{Sds:{},Eds:{}},globalVariable:{},
  RandShop:{Counts:[],Items:[],Buy:0,Fresh:0,Lucky:0,Time:0}};
 await page.locator('#file').setInputFiles({name:'synthetic-release-check.json',
  mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))});
 await rest(850);
 const imported=await page.locator('#topSaveStatus').innerText().catch(()=>'<missing>');
 if(!imported.includes('연결'))errors.push('Synthetic save import did not connect: '+imported);
 for(const tab of tabs){
  try{
   await page.locator('[data-view="'+tab+'"]').first().click({timeout:6500});
   await rest(300);
   await scan('synthetic/'+tab);
   for(const selector of ['[data-sub]','[data-module-tab]','[data-equipment-tab]',
    '[data-account-tab]','[data-account-growth]','[data-wiki-cat]','[data-market-tab]',
    '[data-market-panel]','[data-drop-mode]','[data-quest-filter]','[data-quest-category]']){
    const list=await page.locator(selector).evaluateAll(els=>els.slice(0,6).map(e=>({
     label:e.textContent.trim(),visible:e.offsetWidth>0&&e.offsetHeight>0,
     type:e.getAttribute('type')||''}))).catch(()=>[]);
    for(const info of list.filter(x=>x.visible).slice(0,5)){
     try{
      await page.locator(selector).filter({hasText:info.label}).first().click({timeout:1600});
      await scan('synthetic/'+tab+'/'+info.label.slice(0,30));
     }catch(e){errors.push('synthetic-subnav '+tab+': '+String(e.message).slice(0,85))}
    }
   }
  }catch(e){errors.push('synthetic-tab '+tab+': '+String(e.message).slice(0,100))}
 }
 await page.locator('#ink').click().catch(()=>{});
 const theme=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,
  body:getComputedStyle(document.body).backgroundColor,attr:document.documentElement.getAttribute('data-theme')}));
 if(theme.theme!=='ink'&&theme.attr!=='ink')errors.push('Dark-theme did not apply: '+JSON.stringify(theme));
 const summary={testedTabs:tabs,views:visited.length,visibleChinese:visited.filter(x=>x.results.length),
  errors:[...new Set(errors)].slice(0,50),
  brokenLocalRequests:[...new Map(badResponses.map(x=>[x.url,x])).values()].slice(0,50),
  freshSaveStatus:status,theme};
 fs.mkdirSync(path.join(root,'release-reports'),{recursive:true});
 fs.writeFileSync(path.join(root,'release-reports/public-browser-v114.json'),JSON.stringify(summary,null,2)+'\n');
 console.log('PUBLIC_BROWSER_AUDIT '+JSON.stringify(summary));
 await browser.close();
 if(summary.errors.length||summary.brokenLocalRequests.length||summary.visibleChinese.length)
  process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1}).finally(()=>server.kill('SIGTERM'));
