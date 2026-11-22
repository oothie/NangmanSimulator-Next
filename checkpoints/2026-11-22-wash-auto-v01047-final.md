# v0.10.47 — 자동 세수 탐색 정리 및 사용자 실행 가이드

## 기능 정리
- 자동탐색은 기본적으로 원본 WASM의 `max_pad=0` 경로를 사용한다. 사용자에게 선행값이나 범위/결과 개수 입력을 노출하지 않는다.
- 원본 네이티브 자맥 3개 경로를 유지하고, 3자맥+녹/파 1개 또는 2자맥+녹/파 2개 조합은 실제 WASM 세수·잠금·치환 후 네 목표가 최종 보유된 결과만 인정한다.
- 검증 기준: 이일진 1121의 귀연정천(#272)·현양신맥(#249)·술소기황(#266)+친구의리(#234), 자맥 4019개/826회 + 녹맥 260개/26회 = 총 **4279개/852회**. 사용자 실게임 검증 경로. 절대적인 최솟값 수학적 증명은 아님.
- 이전 max_pad=20 경로는 4039+260=4299개였으며, 원본에서 padding 검색은 단조개선 함수가 아니라는 것을 실측.
- 자동탐색 화면의 작은 7열 결과 표 대신 전체 너비 순차 단계 카드를 제공한다. 각 카드에 단계 번호, 다음 행동, 추가 세수 회차, 누적 세수단 및 최종 보유 재능을 표시한다.
- 가장 적은 경로는 기본 펼침. 후순위 경로만 펼쳐서 읽기. 전체 한국어 경로 복사 및 원본 WASM 모의 재생 버튼 유지.
- 자동탐색 화면의 원본 이름/개발자용 장황한 문구, 선행 설정 표시, 독립 검사 페이지 링크 제거.
- 검사 목적의 `tests/yysim-native-live-probe.html`, 페이지 전용 `tests/yysim-native-save-probe.js`와 해당 전용 smoke 및 워크플로 단계 제거. 실제 원본 WASM 회귀검사는 보존.
- 사이트 외부 라이브러리 `vendor/yysim` 경로 및 원본 계산 코드는 이름을 바꾸거나 손상시키지 않는다.

## 작업 위치
- `engine/yysim-auto-search.js`
- `engine/yysim-auto-progressive.js`
- `engine/yysim-purple-anchor-mixed.js`
- `vendor/yysim/engine-host.html`
- `index.html`
- `tests/yysim-auto-search-smoke.cjs`, `tests/yysim-grade-catalog-contract.cjs`
- `.github/workflows/yy-wash-native-regression.yml`

## 유의
자동탐색 최저 후보는 확인된 검색 범위의 결과다. 4279개보다 낮은 경로의 존재 가능성은 배제하지 않는다. unrelated character/equipment workflow failures must be tracked separately.
