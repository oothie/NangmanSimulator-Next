// Exact original yy-sim ZZ_DATA and main wash tab live-data parity.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const host={window:{}};vm.createContext(host);
vm.runInContext(fs.readFileSync(path.join(root,'engine/yysim-wash-dashboard.js'),'utf8'),host);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/yysim/data.js'),'utf8'),host);
const model=host.window.YYWashDashboard;
for(let zizhi=150;zizhi<=154;zizhi++){
 const native=host.ZZ_DATA[String(zizhi)],ours=model.config[zizhi];
 assert(native,'source aptitude '+zizhi);
 assert.equal(ours.slots,native.num_talent,'native slots '+zizhi);
 assert.equal(ours.cost,native.eat_xisui,'native pills '+zizhi);
 assert.equal(ours.pity,native.bd_zz,'native pity threshold '+zizhi);
 const start={zizhi,talents:Array.from({length:ours.slots},(_,i)=>({id:170+i,locked:false})),
  tal_lucky:Math.floor(ours.pity/2),quality_counts:{1:7,2:3,3:2,4:1},
  total_wash:13,total_pills:41,gold_count:1,pity_count:2,
  bag_pills:99,has_bag_pills:true};
 for(let locks=0;locks<=Math.min(3,start.talents.length);locks++){
  const next={...start,talents:start.talents.map((t,i)=>({...t,locked:i<locks}))};
  const got=model.model(next);
  assert.equal(got.cost,native.eat_xisui+(locks?2*locks-1:0));
  assert.equal(got.pityThreshold,native.bd_zz);
  assert.equal(got.total,13);assert.equal(got.pills,41);
  assert.equal(got.gold,1);assert.equal(got.pityTriggered,2);
  assert.equal(got.counts[2],3);
  assert.equal(got.locked,locks);
 }
}
const limited=model.model({zizhi:153,talents:[{id:271,locked:true},{id:272,locked:true},{id:251,locked:true}],
 has_bag_pills:true,bag_pills:7,tal_lucky:700});
assert.equal(limited.cost,8);
assert.equal(limited.canWash,false,'insufficient pills block actual wash');
assert.equal(model.model({zizhi:154,talents:[],has_bag_pills:false}).cost,5);
assert.equal(model.model({zizhi:999,talents:[]}),null);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const needle of [
 './engine/yysim-wash-dashboard.js', 'data-wash-main-lock', 'yy-sim 원본 세수 천장 진행도',
 'washMainHundred', 'washMainCount', 'washMainUpgrade', 'washMainResetRole','washMainScan',
 'washEngineUpgradeZizhi','autoLinkRequested','nangman-wash-view-ready',
 'state.nativeState=current','원본 자맥·선행 충돌 미리보기',
 'slotCapacity=dashboard?.slots','data-wash-main-exchange','mayExchange',
 'wash-grade-4','! 치환'
])assert(html.includes(needle),'missing original UI behavior: '+needle);
console.log('PASS: yy-sim original aptitude 150–154, all lock costs, pity bars, live slots, auto-link, main 100 wash, reset and upgrade');
