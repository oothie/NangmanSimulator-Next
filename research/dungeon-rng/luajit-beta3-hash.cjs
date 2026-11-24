'use strict';
const u32=x=>x>>>0;
const rol=(x,n)=>u32((x<<n)|(x>>>(32-n)));
function stringHash(value){
 const b=Buffer.from(value,'utf8'),len=b.length;
 if(!len)return 0;
 let a,h=len,v;
 if(len>=4){
  a=b.readUInt32LE(0);h=u32(h^b.readUInt32LE(len-4));
  v=b.readUInt32LE((len>>>1)-2);h=u32((h^v)-rol(v,14));
  v=u32(v+b.readUInt32LE((len>>>2)-1));
 }else{
  a=b[0];h=u32(h^b[len-1]);v=b[len>>>1];h=u32((h^v)-rol(v,14));
 }
 a=u32((a^h)-rol(h,11));v=u32((v^a)-rol(a,25));
 return u32((h^v)-rol(v,16));
}
function numericHash(key){
 if(!Number.isSafeInteger(key))throw new TypeError('integer key required');
 const b=Buffer.alloc(8);b.writeDoubleLE(key);
 let lo=b.readUInt32LE(0),hi=u32(b.readUInt32LE(4)<<1);
 lo=u32(lo^hi);lo=u32(lo-rol(hi,14));hi=u32(lo^rol(hi,19));
 return u32(hi-rol(lo,13));
}
const keyHash=k=>typeof k==='string'?stringHash(k):numericHash(k);
const ident=k=>(typeof k==='string'?'s:':'n:')+k;
class Table{
 constructor(bits=1){
  if(!Number.isInteger(bits)||bits<0||bits>16)throw new RangeError('bits');
  this.nodes=Array.from({length:bits?1<<bits:0},()=>({key:null,next:null}));
  this.free=this.nodes.length;
 }
 home(k){return keyHash(k)&(this.nodes.length-1)}
 find(k){
  if(!this.nodes.length)return false;
  let at=this.home(k);const visited=new Set();
  while(at!==null){
   if(visited.has(at))throw new Error('cycle');visited.add(at);
   const n=this.nodes[at];
   if(n.key!==null&&ident(n.key)===ident(k))return true;
   at=n.next;
  }
  return false;
 }
 resize(newKey){
  const old=this.nodes,count=1+old.filter(n=>n.key!==null).length;
  const bits=Math.max(1,Math.ceil(Math.log2(count)));
  this.nodes=Array.from({length:1<<bits},()=>({key:null,next:null}));
  this.free=this.nodes.length;
  for(const n of old)if(n.key!==null)this._new(n.key);
 }
 _new(k){
  if(!this.nodes.length)this.resize(k);
  let p=this.home(k);
  if(this.nodes[p].key!==null){
   let free=null;
   while(this.free>0){const at=--this.free;if(this.nodes[at].key===null){free=at;break}}
   if(free===null){this.resize(k);return this._new(k)}
   const collide=this.home(this.nodes[p].key);
   if(collide!==p){
    let q=collide;
    while(this.nodes[q].next!==p){q=this.nodes[q].next;if(q===null)throw new Error('pred missing')}
    this.nodes[q].next=free;
    this.nodes[free]={...this.nodes[p]};this.nodes[p]={key:null,next:null};
    let z=free;
    while(this.nodes[z].next!==null){
     const nn=this.nodes[z].next;
     if(typeof this.nodes[nn].key==='string'&&this.home(this.nodes[nn].key)===p){
      this.nodes[z].next=this.nodes[nn].next;
      this.nodes[nn].next=this.nodes[p].next;
      this.nodes[p].next=nn;
     }else z=nn;
    }
   }else{
    this.nodes[free].next=this.nodes[p].next;
    this.nodes[p].next=free;p=free;
   }
  }
  this.nodes[p].key=k;
 }
 insert(k){if(!this.find(k))this._new(k);if(!this.find(k))throw new Error('insertion failed')}
 order(){return this.nodes.filter(n=>n.key!==null).map(n=>n.key)}
}
function rollByNativeOrder(pairs,roll,bits=1){
 const table=new Table(bits);table.insert('key');
 const weights=new Map();
 for(const [key,weight] of pairs){table.insert(key);weights.set(ident(key),weight)}
 let sum=0;
 for(const key of table.order()){
  sum+=weights.get(ident(key))||0;
  if(roll<=sum)return {key,order:table.order(),total:[...weights.values()].reduce((a,b)=>a+b,0)};
 }
 throw new RangeError('roll beyond total');
}
module.exports={stringHash,numericHash,keyHash,Table,rollByNativeOrder};
