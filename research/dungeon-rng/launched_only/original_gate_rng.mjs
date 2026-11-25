/* Original game RNG progression, pure formula. No save data or test seeds. */
export function draw(seed,bound){
 if(!Number.isSafeInteger(seed)||seed<1||!Number.isSafeInteger(bound)||bound<1)
  throw Error('원본 관문 난수 시드 또는 가중치 누락');
 const state=BigInt.asUintN(64,(BigInt(seed)+BigInt(bound))*245109059551232n+48083817484545n);
 const next=Number((state>>17n)&2147483647n)%2047483645+1;
 return {seed:next,value:next%bound+1};
}
