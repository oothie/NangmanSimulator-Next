/* Local-only Korean wash progression comparison (no live-result assumptions).
 * Tracks original saved fields and optionally compares a yy-sim WASM mock-state.
 */
(function(root){
'use strict';
const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const entries=value=>Array.isArray(value)?value:Object.values(value&&typeof value==='object'?value:{});
function archive(input){
 const value=Array.isArray(input)?input[0]:input;
 if(!value||typeof value!=='object')throw Error('세이브 JSON 객체를 확인하세요.');
 return value;
}
function role(save,id){
 const all=[save.MainRole,...entries(save.Roles),...entries(save.Leavers)].filter(Boolean);
 return all.find(x=>String(x.ID??x.Id??x.id)===String(id));
}
function snapshot(raw){
 if(!raw)return null;
 const tal=entries(raw.Talents).filter(x=>x&&number(x.ID)!=null)
  .map(x=>({id:number(x.ID),locked:x.Lock===true})).slice(0,4);
 return {id:Number(raw.ID??raw.Id??raw.id),level:number(raw.Level??raw.Lv),
  bornSeed:number(raw.BornTalent?.S),luckSeed:number(raw.LuckTalent?.S),
  talLucky:number(raw.TalLucky),washCount:number(raw.RXiSui),talents:tal};
}
function delta(before,after,id,wasm){
 const a=archive(before),b=archive(after),r1=snapshot(role(a,id)),r2=snapshot(role(b,id));
 if(!r1||!r2)throw Error('사냥 전후가 아닌 세수 전후 파일에서 동일 캐릭터 ID를 확인할 수 없습니다.');
 const cells=[];
 const add=(field,title,oldValue,newValue)=>{
  const known=oldValue!=null&&newValue!=null;
  cells.push({field,title,before:oldValue,after:newValue,
   status:!known?'정보 부족':oldValue===newValue?'변화 없음':'변화 있음'});
 };
 add('bornSeed','태생 재능 세수 시드',r1.bornSeed,r2.bornSeed);
 add('luckSeed','행운 재능 시드',r1.luckSeed,r2.luckSeed);
 add('talLucky','자맥 천장 진행값',r1.talLucky,r2.talLucky);
 add('washCount','캐릭터 세수 누적 저장값',r1.washCount,r2.washCount);
 for(let i=0;i<4;i++){
  const x=r1.talents[i],y=r2.talents[i];
  add('slot'+(i+1),'재능 슬롯 '+(i+1),x?.id??null,y?.id??null);
  add('lock'+(i+1),'재능 잠금 '+(i+1),x?.locked??null,y?.locked??null);
 }
 const pred=wasm&&Number(wasm.role_id)===r2.id?{
  roleMatch:true,seedExpected:number(wasm.seed),seedActual:r2.bornSeed,
  seedMatch:number(wasm.seed)!=null&&r2.bornSeed!=null?number(wasm.seed)===r2.bornSeed:null,
  slots:entries(wasm.talents).slice(0,4).map((x,i)=>({
   index:i+1,expected:number(x.id),actual:r2.talents[i]?.id??null,
   matches:number(x.id)!=null&&r2.talents[i]?.id!=null?number(x.id)===r2.talents[i].id:null
  }))
 }:null;
 return {id:r2.id,before:r1,after:r2,cells,predicted:pred,warning:
  '세이브의 시드 변경만으로 세수 횟수·자맥 충돌·치환 원인을 확정할 수 없습니다. '+
  'WASM 예상과 실제 값이 일치해도 한국판 전체 세수 엔진의 정확성이 검증된 것은 아닙니다.'};
}
root.NangmanWashCompare={delta,snapshot,role};
})(window);
