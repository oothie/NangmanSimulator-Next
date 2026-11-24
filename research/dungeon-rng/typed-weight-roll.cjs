'use strict';
/* Research only: preserve Lua key types. Never equate insertion order with LuaJIT pairs order. */
function typedKey(key) {
  if (typeof key === 'number' && Number.isSafeInteger(key)) return 'n:' + key;
  if (typeof key === 'string') return 's:' + key;
  throw new TypeError('Only integer and string keys are supported');
}
function normalize(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Expected ordered entry array');
  const seen = new Set();
  return entries.map((entry, insertionIndex) => {
    if (!entry || !Object.hasOwn(entry, 'key')) throw new TypeError('Missing key');
    const keyId = typedKey(entry.key);
    if (seen.has(keyId)) throw new Error('Duplicate Lua key: ' + keyId);
    seen.add(keyId);
    if (!Number.isSafeInteger(entry.weight) || entry.weight < 0) throw new RangeError('Invalid weight: ' + keyId);
    return {key: entry.key, keyId, weight: entry.weight, insertionIndex};
  });
}
function resolve(entries, pairsOrder, roll) {
  const normalized = normalize(entries);
  if (!Array.isArray(pairsOrder)) return {status:'unresolved', reason:'Native LuaJIT pairs order not supplied', entries:normalized};
  const order = pairsOrder.map(typedKey);
  if (order.length !== normalized.length || new Set(order).size !== order.length ||
      order.some(key => !normalized.some(e => e.keyId === key))) throw new Error('Order must be a typed key permutation');
  const ordered = order.map(key => normalized.find(e => e.keyId === key));
  const total = ordered.reduce((sum,e) => sum + e.weight,0);
  if (!Number.isSafeInteger(total) || total <= 0) throw new RangeError('Bad total weight');
  if (!Number.isSafeInteger(roll) || roll < 1 || roll > total) throw new RangeError('Roll out of range');
  let current=0;
  const ranges=ordered.map(e => {
    const from=current+1; current+=e.weight;
    return {...e,from,to:current};
  });
  return {status:'conditional-on-supplied-order',total,roll,ranges,
    selected:ranges.find(e => e.weight>0 && roll>=e.from && roll<=e.to)};
}
function compareOrders(entries, candidateOrders, roll) {
  const outcomes=new Map();
  for (const order of candidateOrders) {
    const result=resolve(entries,order,roll);
    if (result.status !== 'conditional-on-supplied-order') throw new Error('Missing order');
    const key=result.selected.keyId;
    outcomes.set(key,(outcomes.get(key)||0)+1);
  }
  return {testedOrders:candidateOrders.length,unambiguous:outcomes.size===1 && candidateOrders.length>0,
    outcomes:[...outcomes].map(([key,count])=>({key,count}))};
}
module.exports={typedKey,normalize,resolve,compareOrders};
