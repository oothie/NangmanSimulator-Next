# 출시 4관문 특수 보상 연구 엔진

배포 사이트와 분리된 원본 지급자 검증 코드이며 실제 사용자 세이브나 실측값은 포함하지 않는다.

## 원본 범위

- 원본 지급 스크립트 15개에서 특수보상 소비자 40건 추출.
- 연왕부 12건, 창옥 12건, 벽유교 9건, 유씨별원 7건.
- 최초 1회 제한 24건, 잔편 10·15개 제한 11건, 횟수 제한이 없는 조건 4건, 임시 범위 확인 필요 1건.
- 지급 플래그 2에서 1로 돌아가는 원본 조건부 복구 37건. 이를 매 회차 무조건 실행하지 않는다.
- 특수 아이템 ID 35종을 한국판 이름으로 식별해 단순 '특수 보상' 표시를 제거.

## 실행 시나리오

- current: 세이브에 기록된 원본 지급 횟수를 유지한다.
- unclaimed: 특수 보상 획득 횟수만 0으로 가정하며 RNG·재료 상한·임무 상태는 변경하지 않는다.
- fresh: 보상 횟수와 이전 지급 플래그를 가상 초기화한다. 실제 미획득 시점의 모든 게임 상태를 복원한다는 뜻은 아니다.
- 유씨별원 열쇠 실제 보유 여부는 과거 누적 획득 기록과 구분한다.
- 임시 범위 GetP 조건을 저장 파일에서 증명할 수 없으면 지급 확정으로 표시하지 않는다.

## 사용

node research/dungeon-rng/launched_only/test_special_reward_source_engine.mjs
node research/dungeon-rng/launched_only/test_special_reward_four_gates.mjs
node research/dungeon-rng/launched_only/special_reward_lab_cli.mjs --save /private/local-save.json --gate 창옥 --clears 10 --mode current
node research/dungeon-rng/launched_only/special_reward_lab_cli.mjs --save /private/local-save.json --gate 창옥 --clears 10 --mode unclaimed

개인 세이브는 로컬 파일로만 읽으며 공개 저장소에는 올리지 않는다. 배포 사이트·버전은 그대로 유지한다.

## 아직 미확정

- 과거 획득 후 진행된 임무·최초 입장 상태를 현재 세이브만으로 모두 복원할 수 없다.
- 벽유교 귀용문 개방·고리의 열쇠 사용·임시 범위 보상은 별도 원본 조건 검증이 필요하다.
- 장비·재료 RNG와 보상 소비자는 분리되어 있으며 모든 LuaJIT 실행 경로를 네이티브로 검증한 상태는 아니다.
- 유씨별원 소비자 보존본과 다른 3관문의 원본 버전 동일성은 추가 확인이 필요하다.
