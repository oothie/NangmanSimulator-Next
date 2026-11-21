// Print original wiki source icon structure so ID/name guesses are not used.
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx={window:{}};
const source=fs.readFileSync(path.join(root,'vendor/yysim/wiki_data.js'),'utf8');
vm.runInNewContext(source,ctx,{timeout:15000});
console.log('DATA SCRIPT HEADER:',source.slice(0,1200));
console.log('WINDOW KEYS:',Object.keys(ctx.window));
for(const type of ['crafts','arts','buff','items','equips']){
 const rows=ctx.window.WIKI_DATA?.[type]||[];
 const sample=rows.slice(0,4).map(o=>({id:o.id,n:o.n,icon:o.icon,pic:o.pic,img:o.img,image:o.image,iconId:o.iconId,icon_id:o.icon_id}));
 const withIcon=rows.filter(o=>[o.icon,o.pic,o.img,o.image,o.iconId,o.icon_id].some(x=>x!=null&&x!=='')).length;
 console.log(JSON.stringify({type,count:rows.length,withIcon,sample},null,2));
}
