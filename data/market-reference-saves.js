// Sanitized ghost-market-only snapshots (no personal save/account data).
// Server 4 is the main six-slot baseline; server 2 is the 독벽도객 reference.
// Source: user-provided saves, 2026-11-21 KST.
window.NANGMAN_MARKET_REFERENCES={
  server4:{
    BaseSID:4,
    RandShop:{Counts:[
      {One:224,Two:3},{One:223,Two:3},{One:9,Two:3},
      {One:231,Two:3},{One:232,Two:2},{One:222,Two:5},
      {One:227,Two:1},{One:8,Two:1},{One:221,Two:1},{One:228,Two:2}
    ],Time:1795260046,Buy:186,Fresh:0,Lucky:0,
    Items:[22,21,101,13,24,19].map(ID=>({ID,Buyed:0}))},
    Rnds:{Sds:{guishishop:1349140356}}
  },
  server2:{
    BaseSID:2,
    RandShop:{Counts:{},Time:1795259703,Buy:0,Fresh:0,Lucky:0,
      Items:[37,100,108].map(ID=>({ID,Buyed:0}))},
    Rnds:{Sds:{guishishop:978587497}}
  }
};