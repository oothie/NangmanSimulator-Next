# 관문 드랍 원본 RNG 연구 (최신 체크포인트: 2026-11-24)

최신 보고서: [9모드 60개 원본 테이블 전수 검증](ALL_NINE_MODES_60_NATIVE_TABLES_20261124.md)

- 7개 관문, 9개 모드, 30보스, 장비 여부/색상 `TDUP/TSET` **60/60개 원본 바이트코드 검증**.
- 실제 정수·문자열 키 타입, 입력 순서, PC, 원본 동작 **181개** (31개 미드랍, 30개 장비 슬롯, 120개 색상) 연결.
- 원본 SBv3 9개 파일. 4개 신규 Whale 원본 복호화 파일은 기존 재구성 트리와 구조 동등성 검증.
- `gate-60-source-registry.json`: 원본 경로/키 타입/분기/한국판 장비 ID. `ORIGINAL_30_BOSS_CONDITIONAL_INTERVALS.json`: LuaJIT beta3 해시 **모델 기반** 조건부 선택 구간.
- `source-gated-drop.cjs`: externally supplied `equipRoll`, `slotRoll`, `colorRoll`을 원본 장비명·색상으로 연결.
- `node research/dungeon-rng/test-source-gated-drop.cjs` 및 `node research/dungeon-rng/test-30-boss-intervals.cjs`로 60테이블·181동작·30보스 회귀 검사.

**미완료**: 실제 한국판 LuaJIT의 `pairs` 해시 노드 순회 게임 런타임 검증, 조건부 RNG 소비 전체 시퀀스, 사용하지 않은 100급 관문 세이브 미래 결과 검증. 현재 30보스에 대해 모든 난수 출력값을 *외부에서 제공할 때* 조건부 매핑이 가능하다는 의미이지, 미래 장비명·색상 자동예측이 완성됐다는 뜻은 아니다.

공개 사이트, 버전, V82 기존 필드 드랍 엔진 유지. 사용자 개인 세이브/게임 바이너리를 공개 연구 브랜치에 포함하지 않는다.
