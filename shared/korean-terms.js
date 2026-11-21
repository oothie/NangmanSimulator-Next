/* v0.8.3: Korean player-facing game terminology.
   Patches text nodes and descriptive attributes only. Never changes IDs, seeds,
   numeric values, input selections, serialized files, or game formula keys. */
(function(){
'use strict';
const rules=[
 [/초식\s*방어\s*무시/g,'막기파기'],
 [/초식\s*방어\s*파기/g,'막기파기'],
 [/회피\s*무시/g,'회피파기'],
 [/범위\s*피해/g,'천상'],
 [/기\s*모으기/g,'집기'],
 [/기\s*회복/g,'집기'],
 [/초식\s*방어/g,'막기'],
 [/창\s*곤법/g,'창곤'],
 [/창·곤법/g,'창곤']
];
function convert(v){let x=String(v||'');for(const [a,b] of rules)x=x.replace(a,b);return x}
const SKIP=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','OPTION','CODE','PRE']);
function convertText(node){
 if(node.nodeType!==Node.TEXT_NODE||SKIP.has(node.parentElement?.tagName))return;
 const old=node.nodeValue,change=convert(old);if(old!==change)node.nodeValue=change;
}
function convertAttrs(el){
 if(!(el instanceof Element))return;
 for(const key of ['placeholder','title','aria-label']){
  if(!el.hasAttribute(key))continue;const old=el.getAttribute(key),after=convert(old);
  if(after!==old)el.setAttribute(key,after);
 }
}
function scan(root){
 if(root.nodeType===Node.TEXT_NODE){convertText(root);return}
 if(root.nodeType!==Node.ELEMENT_NODE)return;
 convertAttrs(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 for(let node=walker.nextNode();node;node=walker.nextNode()){
  if(node.nodeType===Node.TEXT_NODE)convertText(node);else convertAttrs(node);
 }
}
function init(){
 scan(document.body);
 const observer=new MutationObserver(entries=>{
  for(const rec of entries){
   if(rec.type==='characterData'){convertText(rec.target);continue}
   if(rec.type==='attributes'){convertAttrs(rec.target);continue}
   for(const n of rec.addedNodes)scan(n);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();