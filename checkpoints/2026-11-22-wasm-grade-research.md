# 2026-11-22 yy-sim WASM mixed-grade search checkpoint

## User goal
Extend the ORIGINAL `search_wash_routes` native yy-sim optimizer to handle green (quality 2), blue (quality 3), and purple (quality 4) final goals together. Find the **minimum final retained four-slot** pill cost; intermediate acquisition is never a success. Do NOT reintroduce the older independent sequential-lock search.

## Stable production behavior
- `vendor/yysim/engine-host.html` routes auto-search through original `wasmSearchWashRoutes`, protected by `YYWashNativeSearchGuard`.
- `engine/yysim-auto-progressive.js` performs one native request, no artificial steps/percentages.
- Original purple-only search regression passes. No production WASM binary or `TALENT_DATA` has been changed.
- Four-slot tests: [271,268,272,184] and [271,268,202,184] (native family types verified distinct). Original returns 1 route each, neither contains all four selected final talents.

## Native grade-input characterization (read-only experiment)
`tests/yysim-native-grade-input-probe.cjs` runs four isolated processes with ORIGINAL binary:
- Normal 184 green / 202 blue => green-only and blue-only native requests explicitly return `路径搜索只能预选紫脉` (preselected search only purple).
- Test-only initializing talent #184 with pinzhi 4 => green-only final route 185 pills; green+271 final route 1534 pills, but original 271-only reference that had cost 936 no longer yielded a route.
- Test-only initializing talent #202 with pinzhi 4 => blue-only final 190 pills; blue+271 final 1284 pills.
- Mutating both also changes other native route outcomes.
- **Do not ship grade-tag rewriting. It perturbs the actual native RNG/talent distribution; its costs are not valid predictions for the game.**

## Native opcode isolation (read-only experiment)
`tests/yysim-native-quality-opcode-probe.cjs` mutates copies of native function13's immediate 4 -> 2 at offsets 2665, 3332 and 6303, singly and together. Each WASM binary validated, original talent table unchanged, WASM state preserved:
- Reference purple 271 still cost 936.
- Green-purple, blue-purple and both four-slot mixed tests remain incomplete for all tested variants.
- Those three isolated thresholds are **not enough** to extend native candidate generation. The probe never writes back to runtime assets.

## Native callgraph evidence
`tests/yysim-wasm-callgraph.cjs` parses actual bytecode. Function 960 exported `search_wash_routes` reaches adapter function 78, then core function 4 (20,164 bytes), which calls function 13 (`next_purple`) at core offset 14886.
- Exact native error `路径搜索只能预选紫脉` lives at linear-memory address 1069901. A reference to its string data occurs inside native core function4 at bytecode offset 5559 (pointer 1069931, length 71).
- The error-text reference is a string assembly site, **not yet proven to be the conditional grade check**. Inspect preceding comparisons/branches; avoid blindly patching it.

## Native request-flag bypass result
`tests/yysim-native-quality-opcode-probe.cjs` now includes the isolated function4 bytecode patch at offset 5532: `i32.load8_u state+300` is replaced only in a disposable compiled copy with `drop; i32.const 0; nop` (four bytes). The variant retains the exact same original table and deterministic purple 271 baseline of 936 pills. In direct real native tests, BOTH green-only and blue-only are STILL rejected by `路径搜索只能预选紫脉`; mixed final slots remain incomplete. The comparison at offset 5532 is therefore **not sufficient to bypass the original native grade restriction**. Do not deploy this mutation.

## Core four-literal audit (additional)
The original core function4 contains 13 i32.const(4) near-comparison candidates at byte offsets:
515, 1511, 6993, 6997, 7493, 7497, 7845, 7849, 9429, 11400, 11489, 11566, 14313.
The decoded neighborhoods predominantly show slot-vector initialization, clamping to four slots, and 4-byte indexing, **not a demonstrated talent-grade restriction**. In particular:
- 515: writes constant 4 to per-search state offset 1192 before comparing unrelated locals.
- 6993/6997, 7493/7497, 7845/7849: `select` / clamp forms.
- 9429, 11400, 11566, 14313: 4-byte slot array indexing.
- 11489: loop comparing local 11 with slot capacity 4.
**Avoid using any of these core constants as a replacement for a proven pinzhi predicate.**
The original native Rust source modules are only available as filenames embedded in the binary, not as editable source in this repository.

## v0.10.32 implemented purple-anchored final-slot engine (production)
The user changed the requested algorithm: use original yy-sim WASM to fix 3 or 2 purple targets, then scan the closest green/blue candidate between the earlier purple anchors and the last purple, or following the last purple.

**Production implementation:** `engine/yysim-purple-anchor-mixed.js`, loaded by `vendor/yysim/engine-host.html` for exactly four targets with (3 purple + 1 green/blue) or (2 purple + 2 green/blue). The original `wasmSearchWashRoutes` is called with the PURPLE targets only. Its full native action sequence is replayed with the original WASM `wasmDoWash`, `wasmSetState` locks, and `wasmExchangeTalent`; reject if purple final IDs or native pill cost differ. On a reproducible final purple state, free only non-target slots and use **original WASM wash RNG** to lock the closest green/blue target(s), requiring all four goals simultaneously in final native slots. Native original state is checked/restored after every experimental branch. Candidate routes ranked by **actual native total pills** and retained only if replayed final slots match. Routes are bounded best-found; `optimal:false`, never claim proven global minimum.

Additional inter-purple exploration: captures checkpoint after 2nd purple (or after 1st for 2-purple goals); scans nearest mixed-grade events before the next original action, tests continuing subsequent original purple actions and optional second target after final purple. These branches must be rejected when locks alter original RNG/required purple path; they never become false successes.

**Two real unmodified WASM controls** using seed 447882174, role 10044, 4 slots, original talent dictionary:
- [271,268,272,184] (3 purple + green): native cost **7357 pills**, 1001 washes, final all four locked [268,272,271,184]. Original purple backbone cost 6997; green found 36 native washes after it. State preserved.
- [271,268,184,202] (2 purple + green + blue): native cost **5032 pills**, 711 washes, all four final locked [268,271,202,184]. Two green/blue IDs found over 113 WASM washes following the confirmed purple anchors. State preserved.
These numbers are **only for the synthetic diagnostic fixture**, not a prediction for any user's save. The exact minimum across *all* possible branches is not proved.
- On this fixture, sampled inter-purple candidates for 2 purple goals were rejected (6 divergences) due to native continuation changes, while after-last routes succeeded. This is correct conservative behavior.

Tests: `tests/yysim-purple-anchor-mixed-native.cjs` runs both shapes against unmodified WASM; `tests/yysim-anchor-browser.cjs` exercises the production iframe via Playwright and verifies native final four-slot results and state preservation. Native + browser checks passed for earlier commits before v0.10.32 cache/version bump. `YYWashProgressive` and index forward true in-progress WASM wash scan counts, not fabricated percentages. Purple-only execution path unchanged.
 
### Additional low-inventory safety for v0.10.32
The original yy-sim route search predicts hypothetical cost independent of the pills currently in the save. The new native replay needs pill stock for `wasmDoWash`, so `YYWashPurpleAnchorMixed.run` temporarily funds **only its isolated search state** with up to 100,000 virtual pills and restores the real source state unmodified in `finally`. A native 12-wash parity probe confirms that original RNG seeds, talent IDs and pill cost are identical when virtual stocks are 20,000 or 100,000. `tests/yysim-purple-anchor-mixed-native.cjs` additionally checks that a synthetic character with a zero-pill inventory retains the same predicted cost and original state. Never treat the simulated funds as an in-game item grant.

## v0.10.33 work: native between-purple replanning
- Newly added inter-purple logic calls the ORIGINAL `wasmSearchWashRoutes` **again from the actual checkpoint where an earlier purple and green/blue target are locked**, now passing ALL selected purple goals to avoid the native solver treating an earlier purple as disposable. It replays its native timeline while protecting already held goals, and uses bounded native `wasmDoWash` resynchronization if additional locks alter the expected talent events.
- Real original WASM regression seed 447882174, goal [271,268,184,202]: discovered **two additional valid fully locked native branches** from the gap after first purple. Their costs are **6,110 pills / 793 washes** (color found at wash 489) and **6,560 pills / 839 washes** (wash 493), with all four targets present at the end. The previously found **5,032 pills / 711 washes** after-last-purple path remains the cheaper best-known solution. The search correctly prefers 5,032; it does not call 6,110 the minimum.
- Testing shows the unmodified native route may attempt to unlock green/blue because yy-sim originally only optimizes purple. Held purple/color unlocks are skipped and all subsequent native actions are replayed against the real WASM; divergent paths are discarded. Some correction attempts needing talent #261 failed even after 64 native washes, so bounded resynchronization is not globally complete.
- Original WASM native regression, browser tests, and the v3.50 wash UI native checks passed (latest confirmed prior to performance bound commit). The stale checks for deleted `auto-intermediate-search` and old sequential/beam modules were removed/replaced in CI; old character-regression checks still fail independently.
- For performance, next update introduces monotonic native-pill branch-and-bound: a partial branch at or above a previously verified completed route's pill cost is pruned. This is logically sound because further `do_wash` events cannot reduce consumed pills. It does not prove global optimality.

## Pending next steps
1. Follow the branch/dataflow preceding core4's native error builder; identify the grade predicate for the preselection and distinguish it from RNG's native quality distribution.
2. Inspect function13 `next_purple` candidate-event loop beyond the 3 unsuccessful tested offsets.
3. Research-only patch variants must preserve source table, validate `WebAssembly.validate`, remain read-only against the save state, and retain identical original purple baseline.
4. If any candidate produces complete mixed routes, replay its native actions on ORIGINAL unpatched native engine and compare exact costs/final slots. Do not surface an unverified cheapest route, and do not claim global optimality from a bounded scan.
