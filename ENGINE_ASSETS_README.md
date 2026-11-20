# NangmanSimulator — local engine asset pack v0.5.9

This archive is a **source/engine resource pack**, not a GitHub deployment.
Upload the one ZIP archive to the root of `oothie/NangmanSimulator-Next`. The installed GitHub Actions workflow `install-local-engines.yml` will unpack it and commit the vendor files without changing existing wiki UI. This is one-time self-hosting setup.

## Included
- `vendor/yysim/`: all 19 saved yy-sim scripts/styles/assets, with .다운로드 suffix stripped.
- `vendor/sanbujin/`: selected original APK scripts and WASM base64, equipment and dungeon/field drop data; licenses retained.
- `vendor/*/engine-host.html`: separate same-origin isolated WASM engine hosts.
- `engine/local-engine-bridge.js`: parent page message bridge. Calls only relative paths.

## Safety
Do not load yy-sim and Sanbujin core_glue.js in the same global window. Their global variables conflict. Use the iframe hosts.
The compiled WASM sources and scripts remain unmodified; Korean localization belongs in UI/data mapping layers.
The drop algorithm for all Korean 90+ gates and field shared seeds has **not** been verified as perfect.

## Runtime test
Serve with a local HTTP server (`python -m http.server 8765`) and visit `http://localhost:8765/`.
No assets in this pack reference a third-party engine server.

## Licensing
Retain `vendor/sanbujin/shared/licenses/`. Please check other assets' distribution rights before public publication.
