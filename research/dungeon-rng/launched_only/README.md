# 낭만강호 한국 서버 출시 관문 전용 RNG (연구 체크포인트 2026-11-24)

## 적용 범위
- **진행**: 연왕부(이총관·하상·엽내관·연왕), 창옥(무준신·이장·장정), 벽유교(독선생·미·불로선인), 유씨별원(윤무·고리·이뢰운).
- **동결·수정하지 않음**: 문향교, 무신전 숙명/절세, 벽유교 본단 기본/추혼. 이전에 복원된 원본 RNG 연구 패키지와 모델은 보존. `UNRELEASED_GATE_FREEZE_20261124.json`에 ZIP SHA-256 기록.
- 장비 ID 및 한국판 이름은 기존 `gate-60-source-registry.json`의 **원본 지급 배열**을 기준으로 연결. 숫자 ID 단독 노출을 하지 않음.
- 연왕부는 잘못된 `33380_1` 경로를 사용하지 않고 **검증된 `33381_1`**로 재생. 누적보상·시드·장비 슬롯·이전 색상 보존 상태를 전달해 **연속 클리어** 지원.
- 유씨별원은 원본 `35271_1` 및 `seed_lsby`의 상태 갱신을 유지. 벽유교 분기 37이 세이브로 결정되지 않으면 **예측 중단**.
- 연왕부·유씨별원은 지정한 연속 횟수(각 기본 1, 최대 20) 지원. 창옥·벽유교는 현재 1회만 지원하며 상태 보정 없이 2회 이상 강제로 예측하지 않음.

## 실행 및 검증
아래 세 경로는 전부 로컬 원본 연구 체크포인트/사용자 세이브다. **세이브를 GitHub에 업로드하지 않는다.**

```bash
python launched_gate_forward.py --save '1123(입장전).json' \
  --v30-root /path/to/v30 --registry /path/to/gate-60-source-registry.json \
  --liu-clears 3 --ywf-clears 1 --output /private/path/released_gates_only.json
NANGMAN_RESEARCH_ROOT=/path/to/dungeon_native python test_launched_gate_forward.py -v
```

## 실제 보유 세이브 회귀
1123 입장 전→1124 세이브: 출시 4관문에서 예측한 **13개 장비 ID·색상·생성 순서**가 신규 장비 16개 중 최초 13개와 일치. 시드: 연왕부 4개, 창옥 3개, 벽유교 1개, 유씨별원 연속 3회 종료 시드가 일치. 단, 세이브의 개별 장비에는 보스 직접 지급 로그가 없으므로 생성 순서에 근거한 강한 정합성 검증이며 **사용하지 않은 미래 게임 결과 검증이 아님**.

회귀검사 6개: 출시 범위만 출력, 원본 보상 슬롯 범위 엄수, 종료 시드, 신규 장비 13개 연속 일치, 미출시 모드 출력 차단, **1122v3 기준 연왕부 2회 연속 24+22회 RNG·종료 시드 8/8·장비 슬롯 8/8·실제 갱신 색상 7/7 재현**. 테스트가 아닌 실제 미래 결과는 별도 검증 필요.

## 남은 목표
1. 창옥·벽유교의 반복 클리어에 필요한 **모든 상태 변경**(보스 전용 누적 보상·재료·조건부 트리)을 완전히 반영.
2. 원본 LuaJIT `pairs()` 모델을 실제 한국 서버 클라이언트에서 독립 검증; 같은 원본 파일의 패치 버전 차이 감사.
3. 신규 미사용 세이브·실제 클리어를 통한 보스별 장비명·색상·미드랍 성공률 검증.

공개 사이트/버전, 기존 V82 및 100급 관문 연구 코드 변경 없음.

## 특수 드랍 획득 전/후 연구 (2026-11-24)

원본 소비자 이벤트 15개에서 **40개 특수 보상 지급 조건** (`get_` 획득량 상한·1회 제한 등), 원본 진입 스크립트에서 **46개 동적 재료 가중치** (`num_` 누적 상한) 추출 완료. 조건/가중치별 가상 비교 결과는 `RELEASED_4_GATES_SPECIAL_BEFORE_AFTER_AUDIT_20261124.md` 참조.

`launched_gate_forward.py` 실행 시 아래 선택 인자를 **둘 다** 전달하면 기존 출시 관문 장비 예측 결과에 `specialRewardCounterfactual` 요약을 추가한다.

```bash
python launched_gate_forward.py --save /private/MY_SAVE.json \
 --v30-root /local/v30 --registry /local/gate-60-source-registry.json \
 --special-award-registry SPECIAL_AWARD_CONSUMER_SOURCE_20261124.json \
 --special-material-registry MATERIAL_CAP_SOURCE_20261124.json \
 --output /private/RELEASED_GATE_PREDICTIONS.json
```

`specialRewardCounterfactual`은 **특수 보상에 이미 당첨됐을 경우 실제 지급 가능 여부**와 **획득 누적 수치를 0으로 가정한 재료 선택 가중치 차이**만 출력한다. 가상 카운터 0을 실제 미획득 세이브라고 가정하지 않고, 임시 카운터/첫 실행 초기화/특수 numeric `GetP(8915)` 조건은 별도로 보존한다. 아직 실제 미획득 상태의 소비자 재입장 후처리/개별 특수 지급 이력의 미래 정확도는 미검증이다.

테스트: 기존 출시간 7개 + 특수 지급 7개 + 재료 가중치 6개 + 결합 4개 = **24/24 통과**.