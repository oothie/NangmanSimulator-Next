'use strict';
/* LuaJIT beta3 source-guided array+hash table model; not a native game execution oracle. */
const {keyHash,stringHash,numericHash}=require('./luajit-beta3-hash.cjs');
const id=k=>(typeof k==='string'?'s:':'n:')+String(k);
const int=k=>typeof k==='number'&&Number.isSafeInteger(k);
class SourceTable {
 constructor(bits=1){
  if(!Number.isInteger(bits)||bits<0||bits>16)throw RangeError('bits');
  this.nodes=Array.from({length:bits?2**bits:0},()=>({key:null,next:null}));
  this.freeTop=this.nodes.length;this.array=new Map();this.asize=0;this.resizes=[];
 }
 home(k){return this.nodes.length?(keyHash(k)&(this.nodes.length-1)):0}
 find(k){
  if(int(k)&&k>=0&&k<this.asize)return this.array.has(k);
  if(!this.nodes.length)return false;
  let p=this.home(k);const seen=new Set();
  while(p!==null){if(seen.has(p))throw Error('hash cycle');seen.add(p);
   if(this.nodes[p].key!==null&&id(this.nodes[p].key)===id(k))return true;p=this.nodes[p].next;}
  return false;
 }
 static countInt(k,bins){
  if(int(k)&&k>=0&&k<0x4000000){
   bins[k>2?Math.floor(Math.log2(k-1)):0]++;return 1;
  }return 0;
 }
 rehash(k){
  const bins=Array(32).fill(0);
  const oldArray=[...this.array.keys()],oldNodes=this.nodes.filter(n=>n.key!==null).map(n=>n.key);
  for(const x of oldArray)SourceTable.countInt(x,bins);
  const totalAll=1+oldArray.length+oldNodes.length;
  for(const x of oldNodes)SourceTable.countInt(x,bins);
  SourceTable.countInt(k,bins);
  const nn=bins.reduce((a,b)=>a+b,0);
  let sz=0,na=0,sum=0;
  for(let b=0;b<bins.length&&2*nn>2**b&&sum!==nn;b++){
   if(bins[b]>0){sum+=bins[b];if(2*sum>2**b){sz=2**(b+1)+1;na=sum}}
  }
  const total=totalAll-na;
  const hbits=total?Math.max(1,Math.ceil(Math.log2(total))):0;
  this.resizes.push({trigger:k,from:this.nodes.length,to:hbits?2**hbits:0,arrayTo:sz});
  this.array=new Map(oldArray.filter(x=>x<sz).map(x=>[x,true]));
  this.asize=sz;
  this.nodes=Array.from({length:hbits?2**hbits:0},()=>({key:null,next:null}));
  this.freeTop=this.nodes.length;
  for(const x of oldArray)if(!this.array.has(x))this._put(x);
  for(const x of oldNodes)if(!this.find(x))this._put(x);
 }
 _put(k){
  if(int(k)&&k>=0&&k<this.asize){this.array.set(k,true);return}
  if(!this.nodes.length){this.rehash(k);this._put(k);return}
  let p=this.home(k);
  if(this.nodes[p].key!==null){
   let free=null;
   while(this.freeTop>0){const at=--this.freeTop;if(this.nodes[at].key===null){free=at;break}}
   if(free===null){this.rehash(k);this._put(k);return}
   const collide=this.home(this.nodes[p].key);
   if(collide!==p){
    let q=collide;const seen=new Set();
    while(this.nodes[q].next!==p){
     if(seen.has(q))throw Error('hash predecessor cycle');seen.add(q);
     q=this.nodes[q].next;if(q===null)throw Error('hash predecessor missing');
    }
    this.nodes[q].next=free;this.nodes[free]={...this.nodes[p]};this.nodes[p]={key:null,next:null};
    let z=free;
    while(this.nodes[z].next!==null){
     const nn=this.nodes[z].next;
     if(typeof this.nodes[nn].key==='string'&&this.home(this.nodes[nn].key)===p){
      this.nodes[z].next=this.nodes[nn].next;
      this.nodes[nn].next=this.nodes[p].next;
      this.nodes[p].next=nn;
     }else z=nn;
    }
   }else{this.nodes[free].next=this.nodes[p].next;this.nodes[p].next=free;p=free}
  }
  this.nodes[p].key=k;
 }
 put(k){
  if(!int(k)&&typeof k!=='string')throw TypeError('integer or string key only');
  if(!this.find(k))this._put(k);
  if(!this.find(k))throw Error('insertion failed: '+id(k));
 }
 order(){return [...this.array.keys()].sort((a,b)=>a-b).concat(this.nodes.filter(n=>n.key!==null).map(n=>n.key))}
}
function selectWeighted(entries,roll,bits=1){
 const t=new SourceTable(bits);t.put('key');const weights=new Map();
 for(const [k,w] of entries){
  if(!Number.isSafeInteger(w)||w<0)throw RangeError('weight');
  t.put(k);weights.set(id(k),w);
 }
 const total=[...weights.values()].reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(roll)||roll<1||roll>total)throw RangeError('roll');
 let cumulative=0;
 for(const k of t.order()){cumulative+=weights.get(id(k))||0;
  if(roll<=cumulative)return {key:k,total,order:t.order(),asize:t.asize,rehashes:t.resizes.length};
 }
 throw Error('selection failed');
}
module.exports={SourceTable,selectWeighted,stringHash,numericHash};
