# 무신전 숙명·절세 29개 원본 가중치 테이블 연결 (2026-11-24)

## 핵심
이전 30보스/60개 장비·색상 테이블을 실제 입장 RNG 호출에 연결하기 위한 **무신전 원본 입장 이벤트 첫 복원**이다.

- 복호화된 두 SBv3 파일: `event__enter_wsd.sbc` (724 instructions), `event__enter_wsdex.sbc` (934 instructions).
- `Recorder`에서 원본 `TDUP/TSET` 추출: 숙명 **9개**, 절세 **20개**, 합계 **29개** 전체 원본 typed key 및 삽입 PC를 재검사했다. 이들은 장비/색상 외 재료·누적보상·조건부 난수 테이블도 포함한다.
- `wsd-29-typed-weight-tables.json`에는 29개 테이블의 원본 키 타입, 쓰기 PC, LuaJIT 2.1 beta3 **모델** 순회와 원본 파일 SHA를 기록. 게임 네이티브 `pairs` 실관측과 구분한다.
- 복호화된 원본 entry 이벤트를 제한된 AST로 재생하는 이전 `dungeon_v108/entry_v108.py`를 사용하되, `wsd_runtime_order.py`에서 원본 typed key를 일치시키고 동일 경로를 1개로 확정할 때에만 model-order를 제공한다. 잘못된 키/분기는 중단.
- `wsd_forward_equipment.py`에서 입장 결과의 `drop_NNNNN_equip/color`를 원본 30보스 소비자 배열에 연결해 4보스 장비 ID, 한국판 이름, 색상 또는 미드랍 표시. 절세 첫 보스는 지급 35600/난수 35603 분리.

## 실제 실행 결과(합성 데이터)
시드 123456과 `num_fuben=1,win_wsd=20,win_wsdex=10`의 합성 상태에서:
- 숙명 20회 원본 가중치 재생 → 모델 종료 시드 2015571949.
- 절세 29회 원본 가중치 재생 → 모델 종료 시드 9881870.
- 기존 JSON insertion-order 모델과 **500개 합성 seed별 비교** 시 숙명/절세 각각 500/500에서 종료 seed 불일치. 호출 횟수 자체도 379/500 및 380/500에서 불일치.
- `test_wsd_equipment.py`: 3개 테스트 통과. 기존 원본 bytecode 재생 회귀 `test_wsd_source_orders.py`: 5개 통과(추가 합성 시작 상태 200회와 모드 연속 호출).
- 원본 30보스/60테이블/181동작 `test-source-gated-drop.cjs`, `test-30-boss-intervals.cjs` 모두 통과.

## 중요한 제한
- **게임 런타임 `pairs` 순회/배포 버전, 실제 실측과 독립 미래 드랍 일치 미검증**. 29개 분기 재현 성공은 실제 드랍 정확도 100%를 의미하지 않는다.
- 기존 제한된 AST는 누락된 `GetP`를 **0으로 취급**한다. 원본 게임에서 정상적인 GetP 기본값과 동일한지는 각 맥락에서 검증 필요.
- 전투 RNG 및 NPC 소비자 지급 시점, 입장 실패 및 특정 재도전 경로는 아직 완전 원본 호출 전수 검증이 아니다.
- 사용자의 1124 세이브에서 `seed_wsd`, `seed_byjzt`, 문향교 개별 `seed_wxj_*`가 확인되지 않아, **이 세이브로 100급 관문 다음 드랍을 예측했다는 주장은 불가**. 없는 seed를 임의로 생성하지 않는다.
- 패키지는 사용자 Library `/NangmanMacro/RNG-recovery/Nangman_Wushinjeon_Original_29_Tables_20261124.zip`. 사이트와 V82 미변경.

## 실행
자기 세이브와 원본 리서치 소스가 별도로 준비된 환경에서:
`python test_wsd_equipment.py`
`python wsd_forward_equipment.py --mode wsd --save MY_SAVE.json`
`python wsd_forward_equipment.py --mode wsdex --save MY_SAVE.json`

위 명령과 관련 원본 event JSON/로컬 재생기 의존성을 함께 준비한 압축 파일은 개인 Library 체크포인트에만 보관했다. GitHub에는 개인 세이브와 원본 게임 SBC, 완전 복호화 스크립트를 게시하지 않았다.
