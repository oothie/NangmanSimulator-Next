// yy-sim native WASM wash targeting command and main path binding regression.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const host=fs.readFileSync(path.join(root,'vendor/yysim/engine-host.html'),'utf8');
const main=host.match(/<script>([\s\S]*?)<\/script>/);
assert(main,'WASM inline host event router');
let onMessage,originalState={role_id:10044,seed:777,sex:2},targetCalls=[],washCalls=[],outputShape='array';
const posted=[],parent={postMessage(data){posted.push(data)}};
const talentData={'261':{name:'拳脚无双',pinzhi:4},'262':{name:'剑术无双',pinzhi:4},
 '260':{name:'两仪相合',pinzhi:3}};
const env={window:{addEventListener(name,fn){if(name==='message')onMessage=fn}},
 location:{origin:'https://local.example'},parent,
 initWasm:async()=>true,wasmInitEngine:()=>true,TALENT_DATA:talentData,ZZ_DATA:{},
 wasmGetState:()=>({...originalState}),wasmSetState:()=>true,
 wasmPreviewExchangePads:(targets,maxPad)=>{targetCalls.push({targets,maxPad});return outputShape==='array'?[{pad:12}]:{paths:[{pad:3}]}},
 wasmWashUntilTalentName:(name,count)=>{washCalls.push({name,count});originalState={...originalState,seed:888};return [{wash:1}]}
};
vm.createContext(env);vm.runInContext(main[1],env);
async function send(requestId,op,payload){
 await onMessage({origin:'https://local.example',source:parent,
  data:{kind:'nangman-engine-command',requestId,op,payload}});
 return posted.at(-1);
}
(async()=>{
 assert((await send(1,'init')).ok,'original WASM initialize');
 const before=JSON.stringify(originalState);
 const result=await send(2,'exchange-pads',{targets:[{purpleId:261,conflictId:262}],maxPad:500});
 assert(result.ok&&result.data.results.length===1,'native dual-target preview');
 assert.equal(JSON.stringify(originalState),before,'read-only path must not change WASM state');
 assert.equal(targetCalls.length,1);
 assert.equal(targetCalls[0].maxPad,500);
 assert.equal(targetCalls[0].targets[0].purple_name,'拳脚无双');
 assert.equal(result.data.nameIds['拳脚无双'],'261','source names mapped to id for Korean display');
 const invalid=await send(3,'exchange-pads',{targets:[{purpleId:260,conflictId:262}],maxPad:500});
 assert.equal(invalid.ok,false,'lower quality talent not accepted');
 assert.equal(targetCalls.length,1,'invalid target never reaches native RNG');
 const blocked=await send(4,'exchange-pads',{targets:[{purpleId:261,conflictId:262}],maxPad:6000});
 assert.equal(blocked.ok,false,'bounded exchange path');
 outputShape='object';
 const objectResult=await send(7,'exchange-pads',{targets:[{purpleId:261,conflictId:262}],maxPad:200});
 assert(objectResult.ok&&objectResult.data.results.paths.length===1,
  'native structured object response must not be discarded');
 const wash=await send(5,'until-talent',{talentId:261,count:400});
 assert(wash.ok&&wash.data.state.seed===888,'purple target mutating WASM result has a state');
 assert.deepEqual(washCalls.map(x=>x.name),['拳脚无双']);
 assert.equal((await send(6,'until-talent',{talentId:260,count:100})).ok,false,
  'purple wash rejects non-purple talent');
 assert(html.includes("id=\"washPathRun\"")&&html.includes("id=\"washTalentRun\""),
  'path controls exist');
 assert(html.includes("op==='washEnginePads'")&&html.includes("washEngine.call('exchange-pads'"),
  'path operation really connects to original WASM');
 assert(html.includes("op==='washEngineUntilTalent'")&&html.includes("washEngine.call('until-talent'"),
  'targeted wash connects to original WASM');
 assert(html.includes('state.undoStates.push(snapshot);state.log.push(result);'),
  'targeted wash saves undo snapshot');
 assert(html.includes('state.pathReports=null;'),'invalidated cached path cannot outlive save');
 assert(html.includes('pathText=pathText.split(nativeName).join(characterTalentName(id))'),'path display uses Korean talent labels');
 console.log('PASS: original WASM target-path and purple wash command safeguards, main UI/undo bridge');
})().catch(err=>{console.error(err);process.exitCode=1});
