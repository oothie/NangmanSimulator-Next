# 벽유교 인간정로 원본 `roll`의 난수 호출 출처 확인 — 2026-11-24

## 한국판 게임 APK에서 **60014과 동일한 원본 모듈** 복구

보관된 한국판 게임 APK의 `assets/src_whale64/wapp__task__statements.whale`에서 **`JHTaskStatementsRoll.lua`**를, `wapp__core.whale`에서 **`JHExtern.lua`**를 선택 복호화했다. 각 모듈의 APK 매니페스트 `v`(버전 해시)와 별도 보존한 60014 매니페스트 `v` 및 암호화 파일 크기가 **각각 정확히 일치**한다. 서로 다른 시점의 전체 APK를 동일 버전이라고 단정하지 않고 **이 두 모듈의 내용 버전 동일성**만 인정한다.

### 실제 원본 호출 그래프

```text
인간정로 36274 / 36275 구출 이벤트
   ├─ 8단계 roll: drop_byj_1~6 동적 가중치
   └─ 9단계 roll: drop_byj_7~13 동적 가중치
       ↓
JHTaskStatements.lua 원본 디스패처 (proto862, PC1176)
       ↓
JHTaskStatementsRoll.execute (proto1, PC25)
       ↓
전역 JHRandom(...)
       ↓
JHExtern.lua 전역 등록 (proto79 PC19, 실제 함수 proto8)
       ├─ math.jhrandom(...)
       └─ math.random(...)
```

- 원본 `JHTaskStatementsRoll.execute`는 `pairs(m_json)` 두 번(PC11/PC29)과 `JHRandom` 호출을 확인했다. 일반 장비의 `seedkeyroll`은 별도 `getRands().getRandBetween` 경로다.
- **주의:** 이전 중간 연구에서 `getStoryRnd().intRand`를 일반 구출 `roll`에 연결한 것은 **틀렸음**. 이는 `JHTaskStatementsSeedKeyRoll.executeCheckMode`의 별도 검사 실행 경로(PC19/22)였다. 이번에는 실제 일반 `roll` 실행 함수의 원본을 확보해 수정했다.
- `JHExtern.JHRandom` 함수는 `math.jhrandom`과 `math.random` 두 API를 참조한다. 어느 입력 조건에서 어느 쪽을 실행하는지, 그리고 내부 상태/시드 저장과 반환 경계는 **아직 미확정**이다. `StoryRnd.S`가 4개 저장본에 존재하지만, `JHRandom`이 이 시드를 사용한다는 결론을 내리지 않는다.

## 실제 원본 가중치 테이블

두 원본 인간정로 이벤트(Whale fun record 1777, 2150)에서 문자열 가중치 키 13개의 `TSETS` 명령어 PC와 타입을 직접 검사했다.

| 원본 구출 추첨 | 키 삽입 PC | LuaJIT beta3 **순회 모델 후보** |
|---|---|---|
| 첫 번째 그룹 (6개) | 37,41,45,49,53,57 | **3→4→1→6→2→5** |
| 두 번째 그룹 (7개) | 65,69,73,77,81,85,89 | **7→8→10→9→13→11→12** |

이 순회는 원본 바이트코드 키 삽입 + LuaJIT 베타3 모델의 결과이며, 실제 한국판 게임 런타임의 `pairs` 순서를 직접 실행해 검증한 것은 아니다.

## 연결된 연구 계산

`byj_story_roll_conditional.py`는 활성화된 13개 재료 가중치와 원본 지급/누적 카운터 조정식을 결합해 **후보 순회에 따른 수치 구간**을 만든다. 실제 게임에서 관측한 난수 출력값이 외부 입력으로 주어질 때에만 조건부 지급 결과를 산출한다. `JHRandom` 분기와 난수 생성기를 확정하지 못했으므로 임의 난수·임의 재료 보상을 생성하지 않는다. 가중치 그룹이 모두 0이면 원본 호출이 어떻게 처리되는지 미확인이므로 명시적으로 차단한다.

**테스트:** 신규 모듈 버전 해시·호출 경로 5개, 키/순회 후보/경계 검사 11개, 기존 벽유교/출시 관문 관련 검사 34개, **50/50 성공**. 테스트는 소스 및 과거 자료 기반이며 미획득 실제 계정 독립 실측은 아니다.

## 다음 병목

1. 원본 `JHExtern.JHRandom` (proto8)의 정확한 분기 입력 조건과 `math.jhrandom` 구현 및 시드 갱신 코드를 복원한다.
2. `roll` 가중치 테이블에서 런타임의 `pairs` 순회와 `JHRandom`의 실제 출력 범위를 확인한다.
3. 인간정로 구출 직전·직후 독립 세이브에서 재료 지급 기록과 난수 상태 변화를 대조한다. 기존 일자 단위 세이브에는 다른 활동이 혼재한다.

문향교·무신전·벽유교 본단은 동결 유지. 공개 사이트/V82/사용자 세이브 변경 없음. 원본 게임 APK/SBv3 바이너리는 공개 배포하지 않는다.