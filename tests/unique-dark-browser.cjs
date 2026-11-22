'use strict';
// Real embedded original unique-item engine: theme switch must recolor cards,
// sequence cells and detail buttons immediately without white-on-white text.
const assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8782','--bind','127.0.0.1'],
  {cwd:path.resolve(__dirname,'..'),stdio:'pipe'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  for(let i=0;i<30;i++){
   try{await page.goto('http://127.0.0.1:8782/#equip',{waitUntil:'domcontentloaded'});break}
   catch(error){if(i===29)throw error;await new Promise(r=>setTimeout(r,200))}
  }
  await page.locator('[data-module-tab="equip:unique"]').click();
  await page.locator('#ink').click();
  await page.waitForFunction(()=>{
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('equipment.html'));
   return frame?.contentWindow?.document.documentElement.dataset.nangmanTheme==='dark' &&
     frame?.contentWindow?.document.querySelector('#rk218 .res.unique218');
  },null,{timeout:30000});
  const sample=await page.evaluate(()=>{
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('equipment.html'));
   const doc=frame.contentWindow.document;
   const card=doc.querySelector('#rk218 .res.unique218');
   const label=card.querySelector('.resname');
   const table=doc.createElement('table');
   table.className='unique-seq-table227';
   table.innerHTML='<tbody><tr><td>시험 값</td></tr></tbody>';
   const pick=doc.createElement('button');
   pick.className='unique-pick247';pick.textContent='#1';
   table.querySelector('td').appendChild(pick);
   doc.querySelector('#rmain').appendChild(table);
   const style=el=>({bg:frame.contentWindow.getComputedStyle(el).backgroundColor,
    color:frame.contentWindow.getComputedStyle(el).color});
   return {card:style(card),label:style(label),cell:style(table.querySelector('td')),
    button:style(pick),theme:doc.documentElement.dataset.nangmanTheme};
  });
  assert.equal(sample.theme,'dark');
  assert.equal(sample.card.bg,'rgb(37, 40, 48)','unique item card uses neutral dark background');
  assert.equal(sample.cell.bg,'rgb(37, 40, 48)','unique sequence row uses neutral dark background');
  assert.equal(sample.button.bg,'rgb(52, 59, 70)','unique item button uses accessible dark contrast');
  assert.notEqual(sample.button.color,sample.button.bg,'unique button label contrast');
  await page.locator('#paper').click();
  await page.waitForFunction(()=>{
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('equipment.html'));
   return frame?.contentWindow?.document.documentElement.dataset.nangmanTheme==='light';
  },null,{timeout:15000});
  const paper=await page.evaluate(()=>{
   const frame=[...document.querySelectorAll('iframe')].find(f=>f.src.includes('equipment.html'));
   const card=frame.contentWindow.document.querySelector('#rk218 .res.unique218');
   return frame.contentWindow.getComputedStyle(card).backgroundColor;
  });
  assert.notEqual(paper,sample.card.bg,'item cards must recolor without reload');
  console.log('PASS: original unique equipment cards, sequence table and detail buttons have readable dark palette, live theme sync');
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(error=>{console.error(error);process.exitCode=1});
