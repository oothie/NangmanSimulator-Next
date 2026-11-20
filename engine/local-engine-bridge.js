// Same-origin isolated engine bridge: no external fetch, no global WASM conflicts.
export class LocalEngine {
  constructor(source,kind){this.source=source;this.kind=kind;this.seq=0;this.pending=new Map();this.frame=null;this.bound=e=>{if(e.origin!==location.origin||e.source!==this.frame?.contentWindow||e.data?.kind!==this.kind)return;const p=this.pending.get(e.data.requestId);if(!p)return;this.pending.delete(e.data.requestId);e.data.ok?p.resolve(e.data.data):p.reject(Error(e.data.data?.error||'계산 실패'))};window.addEventListener('message',this.bound)}
  async mount(){if(this.frame)return;const frame=document.createElement('iframe');frame.src=this.source;frame.title=this.kind==='yysim-wash'?'세수 계산 엔진':'장비 계산 엔진';frame.style.display='none';frame.sandbox='allow-scripts allow-same-origin';document.body.append(frame);this.frame=frame;await new Promise((res,rej)=>{frame.onload=res;frame.onerror=()=>rej(Error('로컬 계산 파일 로딩 실패'))});}
  async call(op,payload){await this.mount();const requestId=++this.seq;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.pending.delete(requestId);reject(Error('엔진 응답 시간 초과'))},60000);this.pending.set(requestId,{resolve:v=>{clearTimeout(timeout);resolve(v)},reject:e=>{clearTimeout(timeout);reject(e)}});this.frame.contentWindow.postMessage({kind:'nangman-engine-command',requestId,op,payload},location.origin)})}
  close(){window.removeEventListener('message',this.bound);this.frame?.remove();this.frame=null;for(const p of this.pending.values())p.reject(Error('엔진 종료'));this.pending.clear()}
}
export const washEngine=new LocalEngine('./vendor/yysim/engine-host.html','yysim-wash');
export const equipmentEngine=new LocalEngine('./vendor/sanbujin/engine-host.html','sanbujin-equipment');
