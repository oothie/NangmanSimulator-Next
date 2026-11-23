'use strict';
// One-shot, first-party icon mirror for the Korean simulator.
// A failed download is NEVER replaced with a different item's art.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={window:{}};vm.createContext(context);
for(const source of ['vendor/yysim/wiki_data.js','vendor/yysim/daily_data.js']){
 vm.runInContext(fs.readFileSync(path.join(root,source),'utf8'),context,{timeout:20000,filename:source});
}
const wiki=context.WIKI_DATA||context.window.WIKI_DATA||{};
const daily=context.DAILY_DATA||context.window.DAILY_DATA||{};
const targets=new Map();
function add(folder,value){
 const token=String(value??'').replace(/\\/g,'/').split('/').pop().replace(/\.png$/i,'');
 if(!/^\d+$/.test(token)||Number(token)<=0)return;
 targets.set(folder+'/'+token+'.png','https://yy-sim.pages.dev/icons/'+folder+'/'+token+'.png');
}
for(const item of (wiki.items||[]))add('item',item.icon??item.pic??item.img??item.id);
for(const item of (wiki.equips||[]))add('equip',item.icon??item.pic??item.img??item.id);
for(const item of (daily.shops?.guishi||[]))add('item',item.item);
const requests=[...targets].filter(([target])=>!fs.existsSync(path.join(root,'icons',target)));
const stat={requested:requests.length,success:0,failed:0,existing:targets.size-requests.length,marketTotal:daily.shops?.guishi?.length||0};
let cursor=0;
async function download(){
 while(cursor<requests.length){
  const [target,url]=requests[cursor++];
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),8500);
   let response;
   try{response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'NangmanSimulator-icon-mirror/1.1.0','Accept':'image/png'}})}
   finally{clearTimeout(timer)}
   if(!response.ok)throw Error('HTTP '+response.status);
   const buf=Buffer.from(await response.arrayBuffer());
   if(buf.length<64||buf.length>2000000||!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('not PNG');
   const file=path.join(root,'icons',target);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buf);
   stat.success++;
  }catch(err){stat.failed++;if(stat.failed<=20)console.warn('SKIP '+target+': '+err.message)}
 }
}
(async()=>{
 await Promise.all(Array.from({length:16},()=>download()));
 console.log('ICON_MIRROR_RESULT '+JSON.stringify(stat));
 // Network failure must never produce a successful "restored" status.
 if(stat.requested&&stat.success===0)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1});
