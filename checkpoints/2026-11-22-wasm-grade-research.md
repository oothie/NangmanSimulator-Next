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

### v0.10.33 validation and remaining work
- The *production* algorithm now replays the original WASM purple backbone and can re-run the original native purple search from the actual locked inter-purple green/blue checkpoint, passing ALL purple targets (including already held) to preserve them. All side branches undergo original-WASM do_wash/exchange state verification; protecting held goals disallows previously scheduled native unlocks.
- Bounded native talent-event resynchronization and monotonic pill-cost branch pruning were added. The verified 2-purple+2-color case still yields **5032 pills / 711 washes** as the best of the measured candidates. Two completed earlier-window branches require **6110** and **6560 pills**, respectively, so no spurious reduction is presented. An unbounded exact global minimum remains unproven.
- The UI shows *observed* scan counts, candidate count, and currently verified lowest pill cost. Stale native `roll_idx` values after changing locks are removed from generated route actions instead of shown as real indices.
- The obsolete v3.50 sequential search and beam CI steps and old `auto-intermediate-search` assertions were replaced with real native purple-anchor checks; the updated wash v3.50 CI has passed. The latest artifact version is `v0.10.33` (index title/site version, iframe and script cache revisions refreshed). Independent Character regression remains failing.
- Important remaining concern: inter-purple route replay is verified by the original native engine but its `optimal:false` flag means the global minimum over all possible lock/exchange timings is NOT certified; future work should evaluate more than four nearest intermediate candidates without heavy runtime cost, and test diverse actual save-derived seeds. WASM original-only purple path must remain unchanged.

## v0.10.34 mixed-grade native candidate broadening
- The original WASM interval scan now collects all events where any requested green or blue appears between the confirmed purple anchors and the next original purple action. It examines up to **eight**: the four nearest the earlier purple and the four nearest the later purple, de-duplicated by wash number. It scans only once with actual original `wasmDoWash`, snapshots states for selected events, and restores each isolated branch before evaluation. Before this it examined just four first events.
- On original WASM synthetic fixture seed 447882174 with 2 purple [271,268] + green 184 + blue 202: **11 candidate events, 8 evaluated, 6 verified complete native inter-purple routes**. Confirmed cost/wash pairs: 6110/793, 6560/839, 5714/760, 5712/760, 5592/750, 5542/746. The best complete route overall **remains 5032 pills / 711 washes** from after the second purple. Every generated result retains all four target IDs, including their locked flags.
- Monotonic pill-bound pruning now also applies while scanning the inter-purple interval. Native replay tests explicitly require >4 distinct color events and <=8 evaluated per backbone, successful native replan, complete four-slot results, and preservation of source save state. UI shows actual native scan progress and verified best cost, not an invented percentage.
- Additional native test inputs cover 3-purple + blue and 2-purple + two greens or two blues with compatible talent families; incompatible same-family combinations are rejected. For the specific synthetic 3-purple [271,268,272] + blue202 case, a short horizon 180 found **no valid complete route**; a blue appearing between purples at wash 905 caused a native locked-state continuation mismatch. The engine keeps it unavailable rather than fabricating a result. Do not generalize this no-route result to other seeds or to horizon 900.
- Native continuation from a protected mixed-grade checkpoint may deadlock all four slots with an unwanted locked filler. The v0.10.34 extension can unlock **only non-goal fillers**, record that action, and continue original WASM; it preserves the selected targets and rejects incompatible native exchange outcomes. This did not magically make the specific blue202 fixture a confirmed route at 180 horizon.
- The original yy-sim WASM is not binary patched. Initial game state and actual pill inventory are restored. Test-only simulated pill funding does not change native RNG; original purple-only code path remains unchanged.
- v0.10.34 title/internal version + iframe and WASM script cache revisions aligned. Character/other functionality CI failures are separate; do not claim all workflows succeeded.

## v0.10.35: real replay and already-held save support
1. **Native three-purple + blue route established, not speculative.** Fixture seed `447882174`, role `10044`, goals `[271,268,272,202]`. At **horizon=900**, the unmodified original WASM found a complete final locked four-slot route costing **4148 pills**. At **horizon=180**, this fixture had no complete route, so the former short-window "unavailable" diagnosis was only a bounded finding. Separate fresh-process `tests/yysim-purple-anchor-blue-isolated.cjs` reproduced the **exact same 4148-pill result**, eliminating concern that earlier runs modified hidden WASM state to create it.
2. **Returnable actions are executable.** Native regression now replays output `actions` from initial original save with unmodified `wasmDoWash`, `wasmSetState` locks and `wasmExchangeTalent`, and checks exact final four slots/lock flags and pill totals. It reproduced: 3 purple + green **7357 pills / 24 actions**, 2 purple + green+blue **5032 pills / 16 actions**, 3 purple + blue **4148 pills / 18 actions**.
3. **Already-held purple anchors and green/blue save goals are preserved.** When all selected purple targets already appear in save slots, original purple search need not be rerun. Native `keep` actions explicitly lock them, with 0 purple-wash costs. Any selected color already in slots is locked rather than removed while searching. When all four goals are already present, the native route costs **0 additional pills** and 0 additional washes; when only 3 purple goals are held, the engine uses original WASM to find the missing green/blue.
4. **Real synthetic save regression:** three purples `[271,268,272]` and green184 already in the four slots produced a **0-pill** final route, with green184 locked and original save restored. Three held purples and missing green184 produced a **1470-pill** native route, replayed exactly back to the target final four slots; source save restored, including zero actual pill stock.
5. **Avoid an incorrect static exchange precheck.** A research attempt used simple grade/family comparisons to reject an exchange before original `wasmExchangeTalent`; this erroneously rejected six genuine successful 2-purple inter-anchor WASM routes. Fully REVERTED in commit `c096f7e4`. Native exchange permissions depend on actual WASM state/history, not simply `from` and `to` talent metadata. Keep original WASM exchange as the authority. The genuine failed blue180 branch was `from 264 -> to 271` at wash1025, where native reported `success:false` and `该天赋不可置换：需同类型低阶脉在前、紫脉在后`, and source state did not change. The full-horizon alternative above resolves this fixture without fabricating a swap.
6. **Live browser tests:** `tests/yysim-anchor-browser.cjs` now includes the complete save / zero-pill native host branch. Production `YYWashAutoSearch.routeOutcome` handles nonnegative 0 costs explicitly, and `YYWashProgressive` filters only incomplete/unverified routes.
7. Site release `v0.10.35`, synchronized page title/site version, iframe `engineRev=0.10.35`, and `anchor-v5` asset cache. No original WASM binary or user save is modified. Native, v3.50 wash, and browser regression checks were passing before v0.10.35 cache update; recheck newest commit CI independently. Character regression remains a separate failing workflow.

## v0.10.36 release validation
- Production-site release version, HTML title, iframe engineRev and anchor script revision were advanced in sync to **v0.10.36** / `20261122-anchor-v6`.
- Real browser/Playwright output with original WASM verified [271,268,272,184] -> **7357 pills**, [271,268,184,202] -> **5032 pills**. A loaded-save fixture already containing [271,268,272,184], with green initially unlocked, returned **0 additional pills**, locked all four goals, `optimal:true` (mathematically the global minimum because cost is nonnegative), and preserved the exact source state. The original purple-only route search was bypassed on this already-held save. This real browser check passed at commit `c40466fe`.
- Original WASM replay of the returned user-facing action sequences is covered by native tests. [271,268,272,202] -> **4148 pills** was also reproduced in a separate fresh native WASM process and independently replayed through 18 actions. No fabricated 180-horizon route is asserted; a larger 900 window is required for this synthetic seed.
- A synthetic saved character holding 3 purple anchors while missing green184 found a **1470-pill** actual native green extension; zero actual inventory was preserved by isolated virtual-funding logic. A character holding all four needed exactly **0** additional pills/0 washes. These are synthetic fixtures, not values for a user's own save.
- Original WASM asset and RNG data remain untouched. Positive-cost best-of-bounded routes retain `optimal:false`; only proven cost-zero routes are marked globally optimal. Other application character regression continues to fail and is not claimed to be addressed.

### Zero-pill UI result pipeline verification
`tests/yysim-auto-progressive-smoke.cjs` now directly verifies the complete 4-slot `YYWashProgressive.run → YYWashAutoSearch.routeOutcome` pipeline preserves `bestPills: 0`, retains one `executable` route, and sets `globallyOptimal: true` on a native complete source route with zero further pills. This prevents a JavaScript falsy-zero filter from hiding a mathematically proven minimum. The browser-native test independently confirms zero-pill source preservation and all four final locks.

## Pending next steps
1. Follow the branch/dataflow preceding core4's native error builder; identify the grade predicate for the preselection and distinguish it from RNG's native quality distribution.
2. Inspect function13 `next_purple` candidate-event loop beyond the 3 unsuccessful tested offsets.
3. Research-only patch variants must preserve source table, validate `WebAssembly.validate`, remain read-only against the save state, and retain identical original purple baseline.
4. If any candidate produces complete mixed routes, replay its native actions on ORIGINAL unpatched native engine and compare exact costs/final slots. Do not surface an unverified cheapest route, and do not claim global optimality from a bounded scan.
