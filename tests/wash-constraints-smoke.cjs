// Original WASM available talents / conflict metadata are read-only and scoped.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),host=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const body=host.match(/<script>([\s\S]*?)<\/script>/);assert(body);
let listener,called=0;const sent=[],parent={postMessage(x){sent.push(x)}};
const native={window:{addEventListener(op,fn){if(op==='message')listener=fn}},location:{origin:'https://n.example'},parent,
 TALENT_DATA:{261:{name:'拳脚无双',pinzhi:4},262:{name:'剑术无双',pinzhi:4}},ZZ_DATA:{},
 initWasm:async()=>true,wasmInitEngine:()=>true,
 wasmGetState(){return {role_id:1,seed:123}},
 wasmGetAvailableTalents(){called++;return [{id:261}]},
 wasmGetConflicts(){called++;return [{id:261,opponent_id:262}]}
};
vm.createContext(native);vm.runInContext(body[1],native);
async function req(op,requestId){await listener({origin:'https://n.example',source:parent,
 data:{kind:'nangman-engine-command',op,requestId}});return sent.at(-1)}
(async()=>{
 assert((await req('init',1)).ok);
 const result=await req('talent-constraints',2);
 assert(result.ok,'read-only API works');
 assert.equal(result.data.available.length,1);
 assert.equal(result.data.conflicts.length,1);
 assert.equal(result.data.nameIds['剑术无双'],'262');
 assert.equal(called,2);
 assert(html.includes('washConflictInspect'));
 assert(html.includes("washEngine.call('talent-constraints')"));
 assert(html.includes('window.__nangmanTalentKoName=characterTalentName;'));
 assert(!html.includes("['verify','실게임 검증']"));
 assert(!html.includes("washVerifyRun"));
 assert(!html.includes('wash-save-compare.js'));
 console.log('PASS: native WASM talent constraints, Korean name bridge, wash A/B comparison removed');
})().catch(e=>{console.error(e);process.exitCode=1});
