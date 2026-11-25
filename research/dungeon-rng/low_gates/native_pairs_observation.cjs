'use strict';
/** Strict typed Lua pairs-sequence input verifier. Does not infer or certify
 * native runtime order. The caller must independently capture a complete pass.
 */
const same=(a,b)=>typeof a===typeof b&&Object.is(a,b);
function verifyObservedPairs(entries,observedOrder,includeMetadata){
 if(!Array.isArray(entries)||!Array.isArray(observedOrder))throw new TypeError('Complete source table and observed pairs are required');
 if(typeof includeMetadata!=='boolean')throw new TypeError('Metadata presence must be explicitly observed');
 const keys=entries.map(x=>x.key).concat(includeMetadata?['key']:[]);
 if(observedOrder.length!==keys.length)throw new RangeError('Incomplete original pairs observation');
 for(const key of keys){
  if(keys.filter(x=>same(x,key)).length!==1)throw new RangeError('Repeated original typed key');
  if(observedOrder.filter(x=>same(x,key)).length!==1)throw new RangeError('Missing or duplicated typed key');
 }
 return observedOrder.filter(k=>!same(k,'key'));
}
module.exports={verifyObservedPairs};
