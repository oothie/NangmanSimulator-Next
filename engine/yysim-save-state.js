/* Shared save-only yy-sim state mapping, matching the integrated simulator.
 * Read-only: builds a fresh native WASM input state for the selected role.
 * No invented RNG seed, sequential wash, or dummy talent generation.
 */
(function(root){
'use strict';
const entries=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];
function unwrap(obj){
 let rootSave=obj?.data?.MainRole?obj.data:obj?.save?.MainRole?obj.save:obj;
 if(Array.isArray(rootSave))rootSave=rootSave.find(item=>item&&typeof item==='object'&&!Array.isArray(item))||null;
 if(!rootSave||typeof rootSave!=='object'||Array.isArray(rootSave)||!rootSave.MainRole)
  throw Error('한국판 JSON 세이브의 MainRole 정보를 찾지 못했습니다');
 return rootSave;
}
function roles(save){
 const output=[],seen=new Set();
 function add(raw,type){
  if(!raw||typeof raw!=='object')return;
  const id=Number(raw.ID??raw.Id??raw.id);
  if(!Number.isInteger(id)||id<=0||seen.has(id))return;
  seen.add(id);
  output.push({id,type,name:String(raw.Name||raw.NickName||raw.name||'캐릭터 '+id).trim(),
   level:raw.Lv??raw.Level??'',raw});
 }
 add(save.MainRole,'주인공');
 for(const [key,type] of [['Roles','동료'],['Leavers','이탈']])
  entries(save[key]).forEach(raw=>add(raw,type));
 return output;
}
function build(save,role,original){
 const raw=role?.raw;
 if(!raw)throw Error('세이브 캐릭터를 선택하세요');
 const seed=Number(raw.BornTalent?.S);
 const id=Number(raw.ID??role.id);
 if(raw.BornTalent?.S==null||!Number.isFinite(seed))
  throw Error('선택 캐릭터의 BornTalent.S 시드가 없어 원본 세수를 계산할 수 없습니다');
 if(!Number.isInteger(id)||id<=0)throw Error('캐릭터 ID를 읽을 수 없습니다');
 const num=(v,d=0)=>v!=null&&Number.isFinite(Number(v))?Number(v):d;
 const luck=raw.LuckTalent?.S;
 const talent=entries(raw.Talents).filter(t=>t&&Number.isInteger(Number(t.ID))&&Number(t.ID)>0)
  .map(t=>({id:Number(t.ID),locked:t.Lock===true}));
 const nGift=key=>num(raw[key]);
 const attr=key=>Math.floor((num(raw[key])+num(raw['Born'+key]))*(1+0.00006*nGift(key+'Gift')));
 const bag=entries(save.Items).filter(x=>Number(x?.ID)===2601).reduce((sum,x)=>sum+num(x.Num),0);
 const salt=save.CenterID!=null?num(save.CenterID)%1000000:num(original?.salt,278440);
 return {...(original&&typeof original==='object'?original:{}),
  mode:'seed',seed,luck_seed:luck==null?0:num(luck),luck_seed_inited:luck!=null,
  role_id:id,salt,born_rc:num(raw.BornTalent?.RC),has_born_talent:Number(raw.BornTalent?.ID)>0,
  rng_variant:'73324',zizhi:num(raw.ZiZhi,153),sex:num(raw.Sex,1),vip:num(original?.vip,1),
  talents:tal,tal_lucky:num(raw.TalLucky),
  total_wash:0,total_talent_bars:0,total_pills:0,bag_pills:bag,has_bag_pills:true,
  gold_count:0,pity_count:0,quality_counts:{1:0,2:0,3:0,4:0},
  last_purple_total_pills:null,exchange_count:0,
  str_gift:nGift('StrGift'),con_gift:nGift('ConGift'),dex_gift:nGift('DexGift'),int_gift:nGift('IntGift'),
  role_level:num(raw.Level,90),
  role_stats:{str_val:attr('Str'),con:attr('Con'),dex:attr('Dex'),int_val:attr('Int')},
  global_vars:save.globalVariable&&typeof save.globalVariable==='object'?save.globalVariable:{}
 };
}
root.YYWashSaveState={unwrap,roles,build,entries};
})(window);
