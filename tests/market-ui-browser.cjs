/* Browser smoke: synthetic market file only. Never upload player saves. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const typeOf={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8',
 '.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 const file=path.resolve(root,'.'+pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,body)=>{
  if(err){res.writeHead(404);res.end('missing');return}
  res.writeHead(200,{'Content-Type':typeOf[path.extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store'});res.end(body);
 });
});
function listen(){return new Promise(ok=>server.listen(0,'127.0.0.1',ok))}
async function smoke(){
 await listen();
 const port=server.address().port;
 const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium']
  .find(fs.existsSync);
 assert(chrome,'browser smoke requires preinstalled Chromium/Chrome');
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();
  const faults=[];
  page.on('pageerror',err=>faults.push(String(err)));
  page.on('requestfailed',request=>faults.push('failed: '+request.url()+' '+request.failure()?.errorText));
  page.on('response',response=>{if(response.status()>=400)
    faults.push('HTTP '+response.status()+' '+response.url());});
  const first=await page.goto('http://127.0.0.1:'+port+'/#daily',
   {waitUntil:'domcontentloaded',timeout:60000});
  console.log('Browser HTTP',first?.status(),'URL',page.url());
  try{
   await page.waitForFunction(()=>typeof window.NangmanMarket?.predict==='function'&&
    typeof render==='function',null,{timeout:15000});
  }catch(error){
   const state=await page.evaluate(()=>({
    market:typeof window.NangmanMarket,render:typeof render,
    scripts:document.scripts.length,title:document.title,view:!!document.getElementById('view')
   })).catch(e=>({error:String(e)}));
   console.log('Browser runtime diagnostics',JSON.stringify(state));
   console.log('Page faults',JSON.stringify(faults.slice(0,25)));
   throw error;
  }
  // A day-old synthetic seed must remain usable for historical preview.
  await page.evaluate(()=>{
   const old=Math.floor(Date.now()/1000)-86400;
   // Evaluated in the original page global lexical environment.
   save={RandShop:{Time:old,Fresh:0,Lucky:0,Buy:60,Counts:[],Items:[]},
    Rnds:{Sds:{guishishop:12345}}};
   roles=[];v='daily';dailyTab='ghost';marketPanel='refresh';
   marketSimStep=0;marketAutoStep=0;marketVipOverride=0;
   marketStrategyTarget=223;marketStrategyQuantity=1;marketStrategyPeriods=12;
   render();
  });
  await assertButton(page,'#marketSimNext');
  await page.locator('#marketSimNext').click();
  assert.match(await page.locator('[data-market-panel="refresh"]').innerText(),/원보 갱신 1회차/);
  await page.locator('[data-market-tab="current"]').click();
  await assertButton(page,'#marketAutoNext');
  await page.locator('#marketAutoNext').click();
  assert.match(await page.locator('[data-market-panel="current"]').innerText(),/자동 갱신 1회차/);
  await page.locator('[data-market-tab="strategy"]').click();
  await assertButton(page,'#marketStrategyRun');
  await page.locator('#marketStrategyRun').click();
  await page.waitForFunction(()=>document.querySelector('#marketStrategyStatus')?.textContent
    ?.includes('탐색 완료'),{timeout:60000});
  assert.match(await page.locator('[data-market-panel="strategy"]').innerText(),/최단 기간/);
  assert.equal(faults.filter(e=>/ReferenceError|SyntaxError/.test(e)).length,0,
   'browser encountered script errors: '+faults.join(' | '));
  console.log('PASS market browser: archived save, paid preview, free preview and strategy Worker click');
 }finally{await browser.close()}
}
async function assertButton(page,selector){
 const button=page.locator(selector);
 assert.equal(await button.count(),1,'missing '+selector);
 assert.equal(await button.isDisabled(),false,'disabled '+selector);
}
smoke().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
