# 2026-11-22 — Yi Il-jin mixed wash cost parity

## Verified discrepancy

The 1121.json save's Yi Il-jin (role 10030) seeks the original native talent IDs 272, 249, 266 and 234 (three purple plus green friendship).

Prior simulated test reported **4,285 pills / 700 washes**, while the live website reported **4,299 pills / 856 washes**. They were **different executable original-WASM routes**, not a difference in rounding or one route's bill.

## Root cause confirmed by differential native-WASM tests

The earlier mock reused default `salt=278440` from a synthetic initialized WASM state rather than the actual save mapping `CenterID % 1000000 = 262731`.

- Older synthetic state, salt **278440**: **4285 pills, 700 washes**
- Change **salt only** to **262731**: **4299 pills, 856 washes**
- Change **role stats only**, retain old salt: **4285 pills, 700 washes**
- Match save's salt and computed role stats: **4299 pills, 856 washes**

All above results were computed with the **original yy-sim WASM** and the existing purple-anchor mixed search. The `open_slot` action is replayed via the original aptitude state rules.

Tests: `tests/yysim-purple-anchor-mixed-native.cjs` now asserts these costs and washes. Do not commit the actual 1121.json save or its private globalVariable values to a public repository.

## Interpretation

**4299** is a verified bounded-search result for the save-derived WASM state. **Global minimum remains unproven.** The prior **4285** was not a valid comparison for the user's save. No production cost formula change is needed.

Other unrelated workflows (e.g. equipment feature/character) may fail independently; inspect job logs and do not conflate with wash correctness.
