// Validates the exact Korean 60014 map-object catalogue distributed to browsers.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','data/map-loot-60014.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert(page.includes('./data/map-loot-60014.js'),'map data script must be loaded by main page');
assert(page.includes("nangman-map-loot-ready"),'async map load must trigger account rerender');
let resolveReady,rejectReady;
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
const win={NangmanMapLoot60014:null,dispatchEvent(evt){if(evt.type==='nangman-map-loot-ready')resolveReady()}};
vm.runInNewContext(source,{window:win,atob,Uint8Array,Blob,Response,DecompressionStream,Event,Error},{filename:'map-loot-60014.js'});
ready.then(()=>{
 assert.ifError(win.NangmanMapLoot60014Error);
 const rows=win.NangmanMapLoot60014;
 assert(Array.isArray(rows));
 assert.equal(rows.length,617);
 assert.equal(rows.filter(x=>x.kind==='stump').length,271);
 assert.equal(rows.filter(x=>x.kind==='chest').length,346);
 assert(rows.every(x=>x.mapId&&x.objectId&&Number.isFinite(Number(x.x))&&Number.isFinite(Number(x.y))));
 assert(rows.some(x=>x.depotKey===null),'some source maps have no stable chest depot keys');
 assert(rows.some(x=>x.kind==='stump'&&x.treeFlag.startsWith('shudun_')));
 assert(page.includes('function yyAccountMappedLootView('));
 console.log('PASS: all 617 client map stump/chest IDs, exact positions and save lookup keys decoded');
}).catch(error=>{console.error(error);process.exitCode=1});
