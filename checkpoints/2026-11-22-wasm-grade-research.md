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

## Pending next steps
1. Follow the branch/dataflow preceding core4's native error builder; identify the grade predicate for the preselection and distinguish it from RNG's native quality distribution.
2. Inspect function13 `next_purple` candidate-event loop beyond the 3 unsuccessful tested offsets.
3. Research-only patch variants must preserve source table, validate `WebAssembly.validate`, remain read-only against the save state, and retain identical original purple baseline.
4. If any candidate produces complete mixed routes, replay its native actions on ORIGINAL unpatched native engine and compare exact costs/final slots. Do not surface an unverified cheapest route, and do not claim global optimality from a bounded scan.
