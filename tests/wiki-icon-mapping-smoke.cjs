'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function wikiSourceIcon(x){'),b=html.indexOf('function wikiEffectDescription(x){',a);
assert(a>0&&b>a,'wiki icon resolver found');
const source={
 crafts:[{id:301,n:'음률'}],
 arts:[{id:309,n:'오금희'}],
 buff:[{id:201,n:'조급',icon:'icon_buff_10'}]
};
const win={NANGMAN_V620_BUFF_KO:{201:['조급','설명','icon_buff_10']},NANGMAN_54506_BUFF_KO:{}};
const {wikiImage,wikiImgTag}=new Function('window','wikiSource','wikiFallbackSource','escape',
 html.slice(a,b)+';return {wikiImage,wikiImgTag}')(win,source,null,x=>String(x));
assert.equal(wikiImage({source:'crafts',cat:'craft',id:'301',obj:source.crafts[0]}),
 'https://yy-sim.pages.dev/icons/skill/301.png','craft uses actual skill icon folder');
assert.equal(wikiImage({source:'arts',cat:'arts',id:'309',obj:source.arts[0]}),
 'https://yy-sim.pages.dev/icons/skill/309.png','secret art uses actual skill icon folder');
assert.equal(wikiImage({source:'buff',cat:'buff',id:'201',obj:source.buff[0]}),
 'https://yy-sim.pages.dev/icons/buff/icon_buff_10.png','V6.20 original buff sprite');
assert(wikiImgTag({source:'arts',cat:'arts',id:'309',obj:source.arts[0]}).includes('src="https://yy-sim.pages.dev/icons/skill/309.png"'));
assert(!wikiImgTag({source:'arts',cat:'arts',id:'999999',obj:{}}).includes('role="img"'),'invalid image placeholder does not invent a glyph');
console.log('PASS: craft/secret-art skill PNGs and original V6.20 buff sprite paths');
