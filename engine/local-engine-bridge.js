// Same-origin isolated native engines. A failed WASM bootstrap gets one clean
// iframe reload; mutating operations are never replayed automatically.
export class LocalEngine {
 constructor(source,kind){
  this.source=source;this.kind=kind;this.seq=0;this.pending=new Map();
  this.frame=null;this.mountPromise=null;this.mountReject=null;this.bootAttempt=0;
  this.bound=e=>{
   if(e.origin!==location.origin||e.source!==this.frame?.contentWindow||
      e.data?.kind!==this.kind)return;
   const p=this.pending.get(e.data.requestId);
   if(!p)return;
   if(e.data.progress===true){
    if(typeof p.onProgress==='function')p.onProgress(e.data.data);
    return;
   }
   this.pending.delete(e.data.requestId);
   e.data.ok?p.resolve(e.data.data):p.reject(Error(e.data.data?.error||'계산 실패'));
  };
  window.addEventListener('message',this.bound);
 }
 async mount(){
  if(this.mountPromise)return this.mountPromise;
  if(this.frame?.contentWindow)return;
  const frame=document.createElement('iframe');
  frame.title=this.kind==='yysim-wash'?'세수 계산 엔진':'장비 계산 엔진';
  frame.style.display='none';
  frame.sandbox='allow-scripts allow-same-origin';
  const separator=this.source.includes('?')?'&':'?';
  frame.src=this.source+separator+'engineRev=1.3.1-extended-chain&attempt='+this.bootAttempt;
  this.frame=frame;
  this.mountPromise=new Promise((resolve,reject)=>{
   this.mountReject=reject;
   frame.onload=()=>{if(this.frame===frame)resolve()};
   frame.onerror=()=>reject(Error('로컬 계산 엔진 페이지를 불러오지 못했습니다'));
   document.body.append(frame);
  });
  try{await this.mountPromise}
  catch(error){
   if(this.frame===frame){frame.remove();this.frame=null}
   throw error;
  }finally{if(this.frame===frame)this.mountPromise=null;
   this.mountReject=null}
 }
 async call(op,payload,onProgress){
  const isBoot=op==='init';
  // Searches can take longer when the actual WASM enumerates locked branches.
  const timeLimit=op==='auto-search'?(payload?.searchMode==='expanded'?615000:300000):60000;
  const callOnce=async()=>{
   await this.mount();
   const requestId=++this.seq;
   return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{
     this.pending.delete(requestId);
     reject(Error('엔진 응답 시간 초과 ('+Math.round(timeLimit/1000)+'초)'));
    },timeLimit);
    this.pending.set(requestId,{
     onProgress,
     resolve:value=>{clearTimeout(timeout);resolve(value)},
     reject:error=>{clearTimeout(timeout);reject(error)}
    });
    try{this.frame.contentWindow.postMessage({
     kind:'nangman-engine-command',requestId,op,payload},location.origin)}
    catch(error){
     clearTimeout(timeout);this.pending.delete(requestId);reject(error);
    }
   });
  };
  if(!isBoot)return callOnce();
  try{return await callOnce()}
  catch(firstError){
   if(String(firstError?.message||'').includes('탐색 중단'))throw firstError;
   // A fresh iframe clears a partial WASM instance and bypasses cached
   // engine HTML; only initialization is safe to retry automatically.
   this.bootAttempt++;
   this.frame?.remove();this.frame=null;this.mountPromise=null;
   try{return await callOnce()}
   catch(secondError){
    throw Error('세수 WASM 초기화 재시도 실패: '+String(secondError?.message||secondError)+
     ' (최초 오류: '+String(firstError?.message||firstError)+')');
   }
  }
 }
 cancel(){
  // Destroy only this engine's isolated iframe and workers. Keep the
  // message listener so a new search can remount cleanly afterwards.
  this.mountReject?.(Error('탐색 중단'));
  this.mountReject=null;
  this.frame?.remove();this.frame=null;this.mountPromise=null;
  this.bootAttempt++;
  for(const p of this.pending.values())p.reject(Error('탐색 중단'));
  this.pending.clear();
 }
 close(){
  this.cancel();
  window.removeEventListener('message',this.bound);
 }
}
export const washEngine=new LocalEngine('./vendor/yysim/engine-host.html','yysim-wash');
// Search operates on an independent WASM instance: failed branches cannot mutate the current wash simulator.
export const washSearchEngine=new LocalEngine('./vendor/yysim/engine-host.html','yysim-wash');
export const equipmentEngine=new LocalEngine('./vendor/sanbujin/engine-host.html','sanbujin-equipment');
