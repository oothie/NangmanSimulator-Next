# 한국 서버 20~80급 관문 드랍 — 일반 장비 사후 검증 및 사전 봉인

## 이전 구현에 이어서 작업한 범위

이 디렉터리는 보존된 원본 60014 7관문 연구 엔진의 **실제 클리어 후 장비 ID·색상 검증**을 보강한 독립 연구 코드입니다. 공개 사이트와 메인 브랜치는 변경하지 않습니다.

6개 일반 장비 관문:

- 취선채(20급): `seed_jxz`, 보스 3명
- 추가성(30급): `seed_zjb` / `seed_33888`, 보스 3명
- 혈의루(60급): `seed_xyl`, 보스 3명
- 철인문(70급): `seed_trm`, 보스 3명
- 천일교(80급): `seed_tyj`, 보스 4명
- 고골문(80급): `seed_kgm`, 보스 3명

총 **6관문, 원본 일반 장비 후보 보스 19명**. 원본 `native_source_registry.json`의 `equipment-array` 지급 배열에서 ID를 추출한 결과를 `60014_equipment_candidate_pools.json`에 보존했습니다.

일곱 번째 **묵문유적(40급)**은 `seed_mmyj`와 특수보상 생산자·소비자 6회 추첨을 별도 복원한 상태지만, 일반 장비 ID·색상 전방 재생에 필요한 원본 소비자 실행/네이티브 시드 동등성이 검증되지 않아 **미구현·분리**합니다.

## 이번 구현

### 사냥·관문 클리어 전후 세이브 차분

`after_save_equipment_evidence.cjs`는 두 세이브의 `Rnds.Sds`, `globalVariable.win_*`, `Equips`를 비교하여 **원본 60014 지급 배열에 실제로 존재하는 장비 ID와 색상만** 분류합니다.

동일 장비 ID의 여러 보스·관문 출현을 누락하지 않습니다. 특히 **천일교와 고골문은 80급 장비 ID를 공유**하므로 두 관문의 승리·시드가 모두 변경되었다면 실제 장비의 관문 출처를 단일 결과로 확정하지 않습니다. 장비 객체 `OnlyID`, 원시 난수 및 계정 식별정보는 출력하지 않습니다.

로컬 실행:

```bash
node research/dungeon-rng/low_gates/run_lower_gate_save_pair.cjs PRIVATE_BEFORE.json PRIVATE_AFTER.json
```

결과의 `one-compatible-gate-not-confirmed`도 실제 해당 관문의 드랍이 확정됐다는 의미는 아닙니다. 필드 등 다른 경로에서 동일 아이템을 얻었을 가능성이 남습니다.

### 미리 예측한 장비 ID/색상 봉인

`sealed_low_gate_equipment.cjs`는 **보스별 전부**(미드랍도 명시) 사전 장비 후보가 원본 지급 배열에 존재하는지 확인하고, 세이브·예측을 담은 비공개 봉인 객체와 공개용 SHA-256 해시만 생성합니다.

클리어 후에는 실제 세이브를 기반으로 장비 ID·색상 **다중집합**, 시드·승리 횟수, 보유 장비 유지 여부, 동시 다른 관문 진행 여부를 모두 확인합니다. 변경·관문 혼합·장비 처분·모델 예측 오류가 있으면 일치로 처리하지 않습니다. **SHA-256 해시 자체로는 예측이 전투 전에 작성되었음을 입증하지 못하므로** 외부의 사전 기록 시각이 확인되지 않는 한 `PASS` 또는 원본 네이티브 예측 확정이라고 표시하지 않습니다.

## 남은 실제 복원 과제

1. 보존된 6관문 원본 40개 가중치 테이블의 실제 한국판 LuaJIT `pairs()` 노드·해시 순회와 `getLuaJsonFile()` 구성 순서 검증
2. 30·60·70·80급 일반 장비를 원본 각 관문 클리어 조건/특수재료 분기까지 포함해 정확한 단일 전방 예측으로 완성
3. 묵문유적 일반 장비 소비자와 `seed_mmyj` 6회 추첨의 네이티브 전이 재현
4. 게임에서 **새로 사용하지 않은 사전 세이브 → 클리어 → 사후 세이브**로 한국판 장비 ID·색상을 홀드아웃 검증

기존 90급 출시 관문(연왕부·창옥·벽유교·유씨별원)의 구현과 한국 미출시 관문 연구 동결은 변경하지 않았습니다. 원본 게임 파일, 사용자 개인 세이브·시드, 실제 봉인 본문은 저장소에 업로드하지 않습니다.

## 2026-11-26 후속 구현 — 원본 가중치 분기 관측 역검증

`discriminate_table_orders.cjs`는 정적 가중치 38개에 대해 세 가지 연구 가설(`key` 선행·후행·부재)의 **실제 보상 효과**를 비교하고, 가설을 서로 구분하는 추첨값 구간을 합칩니다. 직접 확인한 원본 분기 추첨값과 분기 효과가 있으면 일치하지 않는 가설을 제거하며, 충돌하는 관측은 결과를 비우고 검증 실패로 남깁니다. `test_discriminate_table_orders.cjs`는 구간의 전체 범위, 가설 제거, 모순·동적 분기 차단을 검사하도록 작성했습니다.

주의: 세이브에서 구한 시드와 게임 아이템 색상만으로는 **원본 개별 가중치 추첨값을 관측했다고 주장할 수 없습니다**. 같은 원본 분기 추첨값을 독립적으로 알 수 있을 때만 가설 구별 근거입니다. 묵문유적의 네이티브 실행 경로, 취선채·추가성 동적 가중치, 원본 LuaJIT 노드 순회, 색상까지 이어지는 RNG 소비는 여전히 미검증입니다. 따라서 본 추가 기능은 **단일 관문 드랍 예측을 완성하지 않으며** 배포 사이트·버전을 변경하지 않습니다.

검증 명령(실행 결과는 별도 CI 확인 필요):

```bash
node research/dungeon-rng/low_gates/test_discriminate_table_orders.cjs
node research/dungeon-rng/low_gates/check_research_privacy.cjs
```

## 2026-11-26 추가 — 40개 테이블 전체 효과 민감도 검사

`gate_order_sensitivity.cjs` / `test_gate_order_sensitivity.cjs`에서 6관문 정적 38개 테이블의 가능한 추첨값 **3,800개를 전수 검사**했다. 세 가설의 실제 보상 효과가 모두 같은 경우 1,240개, 하나라도 다른 경우 **2,560개**다. 취선채·추가성의 동적 가중치 2개는 값이 달라질 수 있어 이 합계에서 제외했다.

| 관문 | 정적 추첨값(합계) | 가설 간 효과 차이 | 효과 동일 | 동적 테이블 |
|---|---:|---:|---:|---:|
| 취선채 | 600 | 300 | 300 | 1 |
| 추가성 | 600 | 300 | 300 | 1 |
| 혈의루 | 600 | 540 | 60 | 0 |
| 철인문 | 600 | 540 | 60 | 0 |
| 천일교 | 800 | 340 | 460 | 0 |
| 고골문 | 600 | 540 | 60 | 0 |

해당 결과는 **원본 코드에서 재구성한 세 테이블 구성 가설의 민감도**이며 실제 플레이 드랍 예측 성공률이나 한국판 LuaJIT 순회 관측이 아니다. 특히 가설이 일치하는 추첨값도 이전 단계가 RNG를 더 소비하면 다음 단계의 추첨값 자체가 달라질 수 있다.

신규 검사와 기존 정적 소스 3종 회귀 테스트를 JavaScript 실행 환경에서 실행하여 통과를 확인했다. 본 체크포인트는 네이티브 실행·실게임 홀드아웃 검증이 아니다.

## 2026-11-26 — 원본 파생 6관문 엔진의 세 모델 전방 재생

사용자의 라이브러리 보존 자료 `Low_Gates_Source_Lane_SavePair_Research_20261125.zip`에서 **원본 이벤트 실행기 전체**를 직접 회수해 수정했다. 수정된 별도 독립 패키지는 `Low_Gates_Original_Function_Replay_20261126.zip`으로 생성했다(이 패키지는 이 연구 브랜치에 원본 게임 파일이나 개인 세이브를 업로드하지 않음).

- `engine/source_order_forward.cjs`: 전 테이블에 `orderMode=first|last|absent` 주입. 기존 모델은 `first`로 유지하며 `key` 메타 키의 존재/위치를 확정된 원본 사실로 간주하지 않음.
- `engine/repeat_session.cjs`: 연속 클리어 재생 전체에 선택한 구성 모델을 전달.
- `engine/original_constructor_ensemble.cjs`: **세 가설을 매번 독립 시드 상태에서 시작**해 전 관문/연속 클리어 장비 ID·색상·슬롯, 종료 시드 및 플래그의 일치 여부 비교. 응답에 개인 시드/계정 값 미출력.
- `engine/test_original_constructor_ensemble.cjs`: 합성 90사례 중 86개에서 모델 간 장비 차이 확인, 2회 연속 클리어·누락조건·입력 상태불변 점검. 기존 32개 + 신규 1개 = **33개 Node 테스트 모두 통과**.

주의: 여기의 86/90은 *합성 시드에서 세 모델끼리 예측이 달랐다*는 뜻이지 실제 게임 예측 실패율이 아니다. 원본 `getLuaJsonFile` 테이블 구성/네이티브 LuaJIT 순회, `JHRandom` 실제 경로, 묵문유적 일반 장비는 계속 미검증. yy-sim 보존된 `shared_simulator.js`에 관문용 원본 드랍 재생이 없어 직접 채택하지 않았으며, 산부진 관문 원본 소스도 아직 검증되지 않아 원본 60014 추출 코드가 우선이다. 공개 사이트/버전 수정 없음.

## 2026-11-26 후속 v2 — 원본 이벤트 흐름 7관문 확장

독립 실행 패키지 `Low_Gates_Original_Function_Replay_20261126_v2.zip`(대화 산출물, 공개 저장소에 세이브/네이티브 바이너리 미포함)을 구성했다.

- 기존 여섯 관문 소스 파생 실행기의 반복 클리어 **첫 번째 원본 RNG 분기 차이**를 원본 회차/호출 번호로 찾아낸다. 실제 추첨값과 개인 시드는 결과에 표시하지 않는다.
- 원본 `src/app/story/fun/33040_1.lua`에서 추출한 **묵문유적 특수보상 6개 SeedRandom 호출**을 복원된 난수 점화식의 명시적 **비네이티브 모델**로 재생하는 옵션을 추가했다. 기본은 여전히 '검증된 6개 난수값 없으면 차단'이다. 일반 장비 지급은 미복원.
- 7관문 혼합 순서 및 `first/last/absent` LuaJIT 테이블 구성 가설 3개를 독립 실행하여 결과가 달라지는지 비교한다. 묵문유적의 승리 횟수는 별도 확인 없이는 올리지 않는다.
- 세이브 어댑터에서도 `sourceModeledMMYJ:true`와 실제 진입 조건 `dropTemp:0|1`을 명시한 경우에만 원본 생산자 조건을 가상 재생한다.
- Node.js **38개 테스트 파일 전부 통과**. 연속 추적 기본 비활성화/시드 비노출/실패 트랜잭션 보존 포함.

**미검증:** 원본 `getLuaJsonFile`의 실제 메타 키 순서, 게임 LuaJIT `pairs()` 네이티브 추첨 순회, MMYJ 실제 시드 동등성, 한국판 미래 드랍 홀드아웃. 본 연구 결과를 실게임 확정 드랍으로 표시하지 않는다. 공개 사이트/버전 및 기존 90급 엔진은 불변.

## 2026-11-26 후속 v3 — 독립 클리어 후 시드 기반 모델 역검증

대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v3.zip`에 `engine/native_candidate_reconciliation.cjs`, `engine/test_native_candidate_reconciliation.cjs` 추가. 본 GitHub 변경은 **연구 체크포인트 문서 갱신이며 실행 코드 자체는 별도 ZIP에 저장**.

- 7관문 원본 파생 `play` 실행기 기준, 별도로 관측한 클리어 종료 시드와 `first/last/absent` 세 모델의 종료 시드 1개 이상을 비교해 불일치 가설 제거.
- **독립 보스별 지급 정보가 있는 경우에만** 장비 ID/색상 대조. 일반 보유 장비 증감에서 보스별 지급을 임의로 추론하지 않음.
- 묵문유적 일반 장비 지급 원본 미복원으로 빈 관측 목록을 미드랍 증명에 사용하지 않음.
- 개인 시드·계정 식별값·OnlyID 미출력. 한 모델만 남아도 원본 네이티브 LuaJIT 동등성의 입증은 아님.
- Node.js 22에서 **39/39개 .cjs 테스트 파일 통과**. 실제 게임 독립 미래 홀드아웃은 미실시. 공개 사이트·버전/90급 관문 코드 변경 없음.

다음 연구: 한국판 `getLuaJsonFile`의 실제 테이블 구성/메타 키 삽입 근거, 묵문유적 일반 장비 함수 역추적, 별도 사전·사후 플레이 세이브 대조.

## 2026-11-26 후속 v4 — 한국판 원본 SeedKeyRoll 함수 2회 순회 복원

보존된 60014 `JHTaskStatementsSeedKeyRoll.sb3`에서 추출된 PC11~13 첫 `pairs(m_json)`, PC29/32/37의 난수 호출, PC39~41 두 번째 `pairs(m_json)` 구성을 근거로 독립 실행 패키지 `Low_Gates_Original_Function_Replay_20261126_v4.zip`을 만들었다.

- `engine/native_seedkeyroll_two_pass.cjs`: 가중치 합산 순회 → 범위 난수 한 번 → 누적 선택 순회를 구현. Lua 동일 타입/동일 키 중복 대입 시 마지막 값 선택, 정수 키와 문자열 키 분리.
- `engine/source_order_forward.cjs`: 기존 6관문 `table`/`gear-table` 이벤트를 신규 2회 순회 함수에 연결. 기존 RNG/보상 조건을 임의로 변경하지 않음.
- `engine/test_native_seedkeyroll_two_pass.cjs`: 3모델 × 100 추첨값 조합, 난수 호출 횟수, 키 유형 및 입력 오류 확인. **전체 40/40개 Node 테스트 통과**.
- **실제 네이티브 확정은 아님:** 원본 `getLuaJsonFile`의 리턴 테이블 키 삽입/순서와 LuaJIT `pairs()` 해시 순회, 원본 게임 시드 등가 및 묵문유적 일반 장비 소비자는 여전히 미확정.

코드와 검증은 대화 산출물 ZIP에 보존했으며, 이 커밋에는 **개인 세이브/원시 시드/원본 게임 바이너리 없이 연구 경과만** 남겼다. 공개 사이트·버전/기존 90급 엔진 미수정.

## 2026-11-26 후속 v5 — 원본 `pairs` 순회 관측 직접 주입

별도 복원 패키지 `Low_Gates_Original_Function_Replay_20261126_v5.zip`에서 기존 원본 파생 6관문 재생기의 가중치 선택기에 `observed` 경로를 추가했다.

- `native_pairs_observation.cjs`: **관측된 순회 기록**과 원본 테이블의 키를 타입(정수/문자열)까지 보존해 비교. 메타키 `key`의 실제 존재 여부는 반드시 별도로 지정. 누락·중복·타입 혼동은 거부.
- `native_seedkeyroll_two_pass.cjs`: 기존 `first/last/absent`와 분리한 `observed` 순서로 합산 → 한 번 RNG → 동일 순서로 분기 선택. **관측을 제공했다고 원본 런타임 검증을 자동 부여하지 않음**.
- `source_order_forward.cjs`: `orderMode='observed'`일 때 관문별 원본 단계 `index`의 전체 기록이 없으면 계산 차단. 가설을 조용히 사용하는 fallback 없음.
- 천일교 80급 전체 4보스의 source-replay 및 키 타입 오류 차단 테스트 추가. **전체 Node .cjs 42/42 통과**.

원본 파일 증거: 60014 JHTaskMgr의 `genEventFile`/`genNpcFunFile`/`genPlaceFunFile`는 `createFromFile`을 경유하며 원본 로더에는 `cacheLuaJson`, `cacheLuaJsonKeys`, `.lua`/`require`, `.whale`/`ResourceManager.loadGroup` 참조가 있다. 이 참조만으로 특정 관문의 가중치 테이블 구성 순서는 확정할 수 없다.

**가장 중요한 미복원:** 원본 `getLuaJsonFile` 반환 테이블의 실제 키 삽입 과정과 LuaJIT 네이티브 `pairs` 실행 기록. 독립 게임 실행의 관측이 아직 없으므로 본 v5는 **원본을 관측했을 때 그대로 대입할 안전한 경로**를 만든 것이며, 게임 네이티브 예측 완성을 주장하지 않는다. 연구 모듈의 핵심 키 검증기와 테스트는 이 브랜치에도 보존한다. 개인 세이브·원시 시드·원본 바이너리 미포함, 배포 사이트·버전 불변.

## 2026-11-26 v6 — 원본 LuaJIT 2.1 beta3 재해시 공식 오류 교정

실제 60014의 런타임 기반인 LuaJIT 2.1-beta3의 공개 `lj_tab.c`/`lj_tab.h`와 보존된 연구 ZIP `SourceTable`을 대조하여 **두 개의 수학적 구현 오류**를 확인·교정했다.

- `countint`의 숫자 키 bin은 `k>2 ? lj_fls(k-1) : 0` (1부터 시작하는 최상위 비트 위치). 기존 `floor(log2(k-1))`는 1칸 작았음.
- `hsize2hbits(s)`는 `s=0:0`, `s=1:1`, `s>=2:1+lj_fls(s-1)`. 기존 `ceil(log2(s))`는 노드 수를 과소 추정.

이에 따라 38개 정적 원본 테이블/3,800개 가능한 추첨값에서 세 *가상 생성 모델*이 보상 결과를 달리하는 구간은 종전 **2,560 → 1,100**, 효과가 동일한 구간은 **1,240 → 2,700**으로 갱신. 이전 연구의 수치를 원본 증명처럼 취급하면 안 된다. 취선채/추가성 동적 테이블 2개 제외. 합성 시드 90개에서 세 모델의 장비 결과가 달라지는 수치도 86 → 61개로 변경. 천일교 합성 임무 조건 최초 분기 차이는 5번째 → 4번째 호출로 변경.

독립 실행 패키지 `Low_Gates_Original_Function_Replay_20261126_v6.zip` (대화 파일, 비공개 세이브·게임 바이너리 제외)에 수정된 `engine/source_table_local.cjs`, 전체 38개 테이블 효과를 계산하는 `engine/audit_beta3_source_tables.cjs`, 새 검증 2개 및 기존 회귀 보정을 기록했다. **Node.js 22에서 44/44 검사 통과**.

원본 공개 참고: [Debian LuaJIT 2.1 beta3 lj_tab.c](https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.c), [lj_tab.h](https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.h).

이는 공개 LuaJIT 코드에 맞춘 **연구 모델의 부분 교정**일 뿐, 한국판 게임의 `getLuaJsonFile` 테이블 초기 해시 크기/생성 순서, 동적 값 및 네이티브 `pairs()` 관측은 아직 확보되지 않았다. 한국판 미래 드랍 확정 불가. 배포 사이트·버전·기존 90급 엔진 변경 없음.

## 2026-11-26 v7 — 원본 40개 가중치 실행 단계의 소스 경로 정합성

별도 연구 패키지 `Low_Gates_Original_Function_Replay_20261126_v7.zip`에서 60014 복원 자료의 `low_gate_event_program.json`과 `native_source_registry.json`을 대조하여 **6관문 40개 가중치 단계를 전부 소스 트리 경로로 연결**했다. 로컬 내부 인덱스는 원본 소스 경로와 같은 값이 아니므로 네이티브 증거 식별자로 사용할 수 없다.

- `engine/original_stage_binding.cjs`: 원본 관문명 + 분기 순회 순서 + 실제 숫자/문자열 키 타입·공백·가중치 순서가 모두 일치할 때만 원본 단계 경로 부여. 원본 40/40 일치.
- `engine/source_order_forward.cjs`: 실제 순회 관측이 있다면 `observedPairsByPath`로 그 원본 경로를 직접 지정하며, 해당 경로가 빠지면 계산을 차단. 구 `observedPairsByIndex` 호환 유지. 가중치 추첨 trace에 원본 소스 경로 포함.
- `test_original_stage_binding.cjs`와 `test_all_gate_observed_source_paths.cjs`: 천일교와 6관문 전체 원본 40단계의 합성 입력 재생/타입 검증/누락 경로 차단. 기존 테스트 포함 **46/46 Node .cjs 테스트 통과**. 원본 지급 기록 Python 검사도 12원본 스크립트·40가중치 단계·19보스·74지급 기록 통과.

이번 패키지는 실제 한국판 게임에서 얻은 `pairs()` 순회 기록이나 새로운 플레이 종료 시드를 포함하지 않는다. **원본 소스 경로 정합성**을 검증한 것이지 LuaJIT 네이티브 순회, `getLuaJsonFile` 키 생성 과정, 묵문유적 일반 장비 지급, 실게임 미래 드랍을 확정한 것은 아니다. 원본 게임 파일·개인 세이브·원시 시드는 공개 브랜치에 저장하지 않았으며 공개 사이트·버전/90급 엔진은 변경하지 않았다.

## 2026-11-26 v8 — 90급 출시 4관문 교차감사 / 원본 로더 및 초기 해시 크기

대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v8.zip`에는 사용자 라이브러리 보존 60014의 `JHTaskMgr` 바이트코드 감사 및 출시 90급 연구의 `luajit-beta3-hash-strict.cjs`/혼합 관문 재생기와 비교한 독립 코드가 있다. 원본 게임 바이너리/세이브는 브랜치에 업로드하지 않음.

- **로더:** `genEventFile`, `genNpcFunFile`, `genPlaceFunFile`의 `createFromFile` 경로 및 `createFromString`/`createFromLuaString` 별도 분기를 정적 증거에 따라 검사. 관문 6개·40개 가중치 소스 경로 결합. `getLuaJsonFile`의 실제 디코딩/테이블 삽입 결과는 여전히 관측하지 못함.
- **초기 테이블 크기:** 기존 90급·20~80급 모델 모두 초기 해시 비트 1을 암묵적으로 가정한 부분 발견. 크기 0·1·2·3 비트와 메타 키 배치 3종을 가정 비교하면 **정적 38/38개 테이블이 초기 크기에 따라 다른 순회 결과를 가질 수 있음**. 이는 실제 런타임 결과가 아니라 원본 수학 공식에 기댄 *후보 모델 간 민감도*.
- **구 90급 해시 모델:** 과거 `luajit-beta3-hash-strict.cjs`의 정수 키 bin 및 해시 노드 수 공식은 20~80급 v6 교정 버전과 불일치. 90급의 과거 실측 재생 13개 장비·9개 시드 정합성은 유지하되, 그 재생 순서를 네이티브 보증으로 옮기지 않음. 90급 기존 구현 자체는 수정하지 않음.
- **연구 엔진:** `native_seedkeyroll_two_pass.cjs`와 `source_order_forward.cjs`에 선택적 `initialHashBits` 전달; 이전 기본값 1 유지, `observed` 네이티브 순회 기록과 추정 해시 크기 동시 사용 차단.
- **검사:** 신규 세 가지 포함 **49/49 Node .cjs 테스트 통과**; 사용자의 사전·사후 세이브나 원본 바이너리를 GitHub에 포함하지 않음.

**원본 완전 복원 이전의 필수 증거:** 실제 60014 `getLuaJsonFile` 구현과 생성되는 Lua 테이블의 배열·해시 초기 크기/메타 키 배치, 그 테이블에 대한 실제 게임 LuaJIT `pairs()` 순회 기록. 묵문유적 일반 장비 지급 원본 및 미래 홀드아웃도 미완료. 공개 사이트/버전/기존 90급 엔진 불변.

## 2026-11-26 v9 — 실제 원본 LuaJIT `pairs` 수집용 실행 후킹 인터페이스

`Low_Gates_Original_Function_Replay_20261126_v9.zip`(대화 연구 산출물)에 `native_pairs_capture.lua`, `native_pairs_capture_import.cjs`, `native_pairs_capture_bridge.cjs` 및 검증 테스트 2개를 추가했다.

- 게임의 **실제 SeedKeyRoll bounded RNG 호출 전후** 같은 `m_json` 객체에 `begin()/finish()`를 호출하도록 설계한 읽기 전용 Lua 모듈. **아직 실제 게임에 설치·실행하거나 기록을 채집하지 않았음**.
- 타입이 다른 `50`(숫자) 및 `"50 "`(문자열)을 구별하고 원본 6관문·40경로를 확인한다. 38개 정적 테이블의 전체 키 집합을 검사할 수 있다. 2개 동적 가중치 테이블은 원본 실행 가중치가 확인되기 전까지 차단한다.
- `observedPairsByPath`로 해당 결과를 기존 관문 엔진에 전달하는 어댑터. 혈의루·철인문·천일교·고골문 4관문 전체를 **합성 관측 입력**으로 관통하는 회귀 검사 포함.
- **전체 51/51 Node 테스트 파일 통과**. 테스트는 소스 정합성 및 연결 검증이지 원본 60014 게임 런타임의 독립 실행 증명이 아님.
- 90급 출시 4관문의 상태 전달 및 잘못된 기존 해시 크기 가정과 교차 비교. 원본 `getLuaJsonFile` 반환 객체 생성/테이블 초기 크기, 실제 네이티브 `pairs` 관측은 여전히 미완료. 공개 사이트/버전, 기존 출시 4관문 엔진, 사용자 세이브 변경 없음.

재현: ZIP의 `engine` 폴더에서 `for f in test_*.cjs; do node "$f" || exit 1; done`. SHA-256 `8b503586a768eb721c885c0591d9836f598409fc0228c061820ea5b4c1ec55dc`.

## 2026-11-26 v10 — LuaJIT 2.1 beta3 배열 재해시 원본 불일치 교정

독립 산출물 Low_Gates_Original_Function_Replay_20261126_v10.zip의 engine/source_table_local.cjs에 **countarray()/countint() 분리 교정**을 적용했다. 공개 원본 lj_tab.c의 rehashtab()은 기존 배열 슬롯을 배열 인덱스 구간별로 세는 countarray()와 해시 영역/새 키를 세는 countint()를 구분한다. 이전 연구 모델은 기존 배열 슬롯에도 countint()를 사용해 **배열 크기 17 대신 9**가 되어야 하는 사례에서 해시 순회가 달라졌다. 새로운 test_beta3_array_rehash.cjs가 이 사례와 뒤따르는 신규 키 9의 순회 차이를 고정했다.

- 전체 Node.js **52/52 검사 통과**, Python 소스 검사 12파일·40가중치·19보스·74지급 기록 통과.
- 기존 원본 정적 38개 테이블 × 초기 해시 비트 0~3 × 메타 키 3종 = 456가지 구성에서 배열 영역이 생성된 사례는 **0개**. 따라서 이 수정만으로 기존 정적 38테이블의 가설 결과 수치를 변경하지 않는다. 다른 테이블/동적 가중치의 조건에서 의미가 있음.
- 원본 게임 실행 pairs() 관측, getLuaJsonFile 함수 본체 및 반환 테이블 내부 구성, 묵문유적 일반 장비 소비자는 **여전히 미확정**. 원본 소스를 확인하지 않은 상태에서 예측 적중 주장 금지.
- 게임 바이너리·세이브·실제 시드 및 식별정보 브랜치 미업로드. 공개 웹사이트·버전/기존 90급 엔진 불변.

공개 원본: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.c/

## 2026-11-26 v11 — 네이티브 순회 기록 메타키 위치 보존 / 생성자 유일성 판정

독립 패키지 `Low_Gates_Original_Function_Replay_20261126_v11.zip`에 아래 수정과 검사 포함:

- v10까지 `native_pairs_capture_import.cjs`는 관측한 메타키 `key` 위치를 제거하고, `native_pairs_capture_bridge.cjs`는 이를 무조건 **맨 앞에 재삽입**했다. 결과적으로 original pairs의 위치 증거가 훼손되었다. v11에서는 `fullNativePairOrder`를 보존해 원본에서 앞/중간/뒤에 있던 메타키 위치를 그대로 전달한다.
- `native_pairs_candidate_reconciler.cjs`: 38개 정적 원본 가중치 테이블을 대상으로 가상 해시 초기비트 0~3 및 메타 키 first/last/absent 12종을 합성 비교하는 식별기. 각 경로의 두 번의 관측 입력 타입·구성 정합성 확인 후 **동일한 순회 순서가 나오는 여러 생성자 가설을 모두 유지**한다.
- **새로운 복원상 중요 사실:** 38개 정적 테이블을 모두 관측해도 가상 메타키 first 혹은 last 조건에서 초기 해시 비트 0/1/3이 전부 동일한 순회를 생성한다. 따라서 순회 기록만으로 원본 초기 할당 크기를 항상 유일하게 알 수 없으며 `getLuaJsonFile`의 테이블 생성 코드를 직접 확인해야 한다.
- Node.js 소스 회귀 **53/53 테스트 파일 통과** (38정적 테이블 × 12모델 = 456개의 합성 캡처를 신규 테스트에서 검증). 이는 **게임 실행의 native 관측이 아님**.
- 기존 90급 4관문, 사이트·버전, 원본 파일·실제 세이브·원시 시드 불변. 코드 산출물은 ZIP에 따로 보존하고 이 저장소에는 연구 체크포인트만 게시.

미완료: 게임 60014 `getLuaJsonFile` 실제 함수 본체, 원본 VM에서 발생한 `pairs()` 순회 기록, 묵문유적 일반 장비 지급. 따라서 미래 장비 드랍 정확도 미검증.

## 2026-11-26 v12 — 60014 빌드 근거와 20~80급 소스의 버전 일치 차단

보존된 `Low_Gate_Original_Source_20261125.zip`의 `source_provenance_20261125.json`을 확인한 결과, 6관문 12개 이벤트 생산자/소비자 스크립트는 `gameversion(1).json` + `src_whale64(3).zip`의 **selected-current-gameversion**에서 추출했다. 문서상 **원본 60014와 완전 일치하지 않을 수 있음**을 명시한다. 반면 로더 감사 `ORIGINAL_TASK_LOADER_AUDIT.json`은 **60014 빌드의 `JHTaskMgr`**이다. 따라서 60014 `createFromFile` 경로를 20~80급 관문에서 실제 실행한 함수라고 확정하면 안 된다.

별도 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v12.zip`에 원본 소스 출처 검사 모듈 `source_build_provenance_guard.cjs`와 관련 검사 2개를 추가했다. 12개 스크립트의 빌드별 SHA-256 전부 독립 일치 확인이 없으면 동일 빌드의 실행이라고 주장하지 않도록 막고, `original_loader_provenance.cjs` 출력에 원본 버전 일치/실제 VM 호출 여부를 구분해 둔다.

Node.js 테스트 **55/55 통과**. Python `test_native_source_registry.py`는 12스크립트·40테이블·19보스·74지급 기록 통과. 원본 `.sbc` 파일이 없는 환경이어서 원본 바이트코드를 읽어야 하는 `verify_native_task_source.py`, `verify_dynamic_contract.py`는 이번에 실행하지 못함. 실제 게임에서 `getLuaJsonFile` 및 `pairs()`를 독립 관측한 상태도 아님. 공개 사이트·버전/기존 출시 4관문 미변경; 개인 세이브 및 네이티브 게임 바이너리 비공개 유지.

## 2026-11-26 v13 — 60014 동일 버전 확인 및 6관문 원본 생산자·소비자 연결

사용자가 보존된 현 Whale 소스와 60014 빌드가 **동일하다고 명시적으로 확인**함. 연구는 이 전제를 받아 진행한다. 독립적인 12개 SHA-256 교차검증을 수행한 것으로 기록하지 않는다.

별도 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v13.zip`:
- `source_build_provenance_guard.cjs`: `userConfirmedSameBuild:true`를 **연구용 호환성**으로 허용. `sourceEqualityWith60014Verified`는 실제 해시가 맞을 때만 참. 실제 해시 불일치가 있으면 사용자 확인만으로 덮지 않음.
- `original_loader_provenance.cjs`: 6관문 소스 이벤트 `genEventFile → createFromFile`(60014 JHTaskMgr PC13), 전투 보상 소비자 `genNpcFunFile → createFromFile`(PC6·20) **12개 원본 스크립트 경로**를 분리 연결.
- 신규 검사 두 개 포함 Node.js **57/57 테스트 통과**. 원본 함수 호출부 및 각 스크립트 경로의 정적 대응이 확인된 것이며 실제 실행 시 테이블 생성 결과를 관측한 것은 아님.

이로써 빌드 비교 반복은 우선 중단하고 다음 직접 복원 목표는 **60014 `getLuaJsonFile` 함수 본체의 최초 테이블 할당/키 삽입 명령**과 **실제 LuaJIT 네이티브 `pairs()` 순회**로 유지. 이는 아직 미확정이며 모델의 전방 예측 정확도 또한 미검증. 공개 사이트/버전, 출시 90급 4관문 엔진과 비공개 세이브 미변경.

## 2026-11-26 v14 — 원본 SBv3 KGC 상수 테이블 크기와 TDUP 복제 경로

대화 산출물 Low_Gates_Original_Function_Replay_20261126_v14.zip에 실행 코드 및 테스트 보존.

- LuaJIT 2.1 beta3 bcread_ktab (lj_bcread.c)는 원본 직렬화된 narray, nhash로 lj_tab_new(L,narray,hsize2hbits(nhash))를 수행하며, 해시 키·값을 저장 순서로 삽입한다. lj_tab_dup (lj_tab.c)는 TDUP 과정에서 배열·해시 노드·연결 정보까지 복제한다. **KGC/TDUP 경로만큼은 초기 해시 크기가 실제 상수 데이터로 결정된다.**
- 기존 parse_sb3_tables.py에서 읽고 버리던 상수 배열 슬롯 수·직렬화 해시 쌍 수·타입 구분·삽입 순서 및 TDUP KGC 참조를 preserve_layout=True 옵션으로 보존하도록 변경. 이전 API 기본 반환은 유지.
- original_ktab_loader.cjs는 원본 해시 비트 계산을 사용해 상수 템플릿을 조립하고, 후속 키 쓰기까지 적용한다. 배열이 실제 존재하는 경우 불완전한 복제이므로 계산 차단.
- native_seedkeyroll_two_pass.cjs와 source_order_forward.cjs에 orderMode='ktab' 지원. 각 원본 소스 경로의 KGC 레이아웃이 없으면 차단하며 모델로 대체하지 않음.
- Node.js 59/59 테스트 통과, 신규 Python 합성 SBv3 상수 검사 3/3 통과, 보존된 원본 지급 레지스트리 12개 스크립트/40개 테이블/19개 보스/74개 지급 기록 검사 통과.
- 실제 관문 게임 SBv3 상수 바이트를 새로 복호화한 것은 아니다. KGC 경로가 해당 관문의 실제 getLuaJsonFile 실행 경로인지, 네이티브 pairs 순서 및 미래 드랍 정답인지 여전히 미확정. 현재 이 단계는 원본 동작을 대입할 정확한 코드 경로를 확보한 것.
- 개인 세이브, 게임 바이너리, 원시 시드는 공개 저장소에 업로드하지 않았고 공개 사이트·버전·90급 관문 엔진은 수정하지 않았다.

원본 참고: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_bcread.c/ , https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.c/

## 2026-11-26 v15 — 원본 KGC 배열 0번 슬롯 및 음수 정수 키 복원

별도 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v15.zip`에 원본 바이트코드 로더 관련 **실제 파서 오류 2개**를 수정한 실행기와 회귀검사를 보존했다.

- 60014 LuaJIT beta3 `lj_bcread.c:bcread_ktab`은 배열을 index 0부터 `narray-1`까지 채운다. 기존 `parse_sb3_tables.py`가 index 1부터 기록하던 오류를 교정.
- 같은 원본의 `bcread_ktabk` 정수형은 signed int32로 변환한다. 기존 파서는 ULEB 수치를 unsigned로 유지했으므로 `0xffffffff -> -1` 처리 수정.
- `original_ktab_loader.cjs`의 KGC/T DUP 해시 전용 제한 해제. `narray`의 nil 슬롯, 배열/해시 동시 배치, TDUP 이후 배열 인덱스 post-write를 소스 기반으로 계산. 원본에서 명시되지 않은 배열/해시 중복 키 및 hash nil 삭제는 차단.
- **전체 Node.js 테스트 60/60**, Python SBv3 파서 테스트 **4/4**, 보존 원본 레지스트리 12스크립트/40가중치/19보스/74기록 구조 검증 통과.
- 새로 확보한 실제 관문 60014 원본 KGC 바이트코드나 게임 네이티브 `pairs()` 관측은 없으므로 **원본 `getLuaJsonFile` 전체 함수 및 미래 드랍의 완전 재현은 여전히 미검증**. 특히 38개 정적 가중치는 기존 자료에서 해시형이고 이번 배열 지원이 해당 테이블의 게임 적중률을 개선했다고 주장하지 않는다.

공개 사이트·버전, 90급 기존 관문 엔진, 개인 세이브·원시 시드 미변경. 코드 ZIP은 개인 자료를 포함하지 않는다.

원본: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_bcread.c/

## 2026-11-26 v16 — 실제 Whale 원본 12개 복호화, 40개 TDUP/KGC 생성 구조 확정

**이전 v8~v15의 초기 테이블 크기와 메타키 삽입 위치는 이 6관문·40가중치 경로에서는 더 이상 임의의 가설이 아니다.** 사용자의 Library에 보존된 `gameversion(1).json`과 `src_whale64(3).zip`를 직접 읽고, 원본 Whale의 인덱스를 이용해 6개 관문 생산자·소비자 스크립트 **12개를 선택 복호화**했다. 모든 복호화 산출물의 SHA-256이 2026-11-25 보존 원본 지문과 **12/12 일치**했다. 동일 암호화 크기 후보가 2개였던 추가성 소비자도 복호화한 SHA-256으로 유일하게 확정했다.

- 게임 원본 생산자에 있는 가중치 단계 **40/40개**의 실제 `TDUP` PC, KGC 상수 인덱스, 원본 `TSET` 가중치 키 타입·공백·순서를 복구하고 기존 보상 레지스트리의 정확한 40개 소스 경로와 대조했다.
- 해당 40개 **실제 원본 KGC 템플릿은 모두 `arraySlotCount=0`, `serializedHashPairCount=1`, 최초 해시 키 `key`**였다. 그 이후 가중치 키를 TSET으로 삽입한다. `hsize2hbits(1)=1`이므로 **최초 해시 비트 1과 메타키 선행**을 이 경로의 *바이트코드 생성 증거*로 확정. `first/last/absent` 및 초기비트 0~3 가설 분기 대신 실제 원본 KGC 레이아웃을 우선한다.
- 구조는 **정적 38개 + 동적 표현식 문자열 키 2개**다. KGC 모드에서는 동적 표현식의 원본 **문자열 키 타입을 유지**하고 평가한 숫자만 추첨 가중치로 사용하도록 별도 교정했다. 숫자 50과 문자열 `"50 "`는 계속 구분한다.
- 원본 레이아웃의 `ktab` 실행기를 6관문에 연결. 정적 38개 테이블의 가능한 합성 추첨값 **3,800개**에서 실제 KGC 생성 모델과 기존 `first/initialHashBits=1`의 선택 결과가 일치. 6관문 **합성 시드 600건** 통합 실행 성공, 그중 동적 테이블이 없는 4관문 400건은 장비·종료 시드가 이전 first 모델과 동일.
- 전체 Node.js .cjs 검사 **62/62**, 기존 Python SBv3 파서 **4/4**, 원본 지급 레지스트리 검사 **12스크립트·40테이블·19보스·74기록** 통과.
- 연구 메타데이터 [40개 원본 TDUP/KGC 위치 증거](original_40_ktab_position_proof_20261126.json)에 정확한 스크립트 SHA·원본 PC·KGC 인덱스를 공개 가능한 범위에서 보존했다. 개인 세이브·실제 RNG 원시 시드·게임 바이너리는 저장소에 넣지 않았다.
- **실행기·정밀 레이아웃·선택 추출 재현 코드**는 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v16.zip`에 별도 보존. 원본 복호화된 게임 스크립트 자체는 ZIP에도 포함하지 않았다. 패키지 SHA-256: `c82c3e0963d75ac076ec930ea602823ff279188d33762cddcfaae2510fd5ddd8`.

**남은 실제 검증:** 원본 게임 ARM64의 `pairs()` 해시 노드 방문 순서가 연구 LuaJIT 2.1 beta3 JS 구현과 동일하다는 네이티브 독립 증명은 아직 없다. `JHTaskMgr.getLuaJsonFile`의 Whale require/cache 호출 경로는 원본 proto 44에서 확인했으나 해당 런타임의 실제 조건/캐시 상태는 별도 관측이 필요하다. 또한 관문 모든 소비자 후처리/특수보상과 미래 실게임 홀드아웃 및 묵문유적 40급 일반 장비는 미완료. **실게임 정확한 미래 드랍으로 확정하지 않는다.** 공개 사이트·버전·기존 90급 4관문 엔진 미수정.

## 2026-11-26 v17 — 40개 실제 KGC 테이블을 세이브 기반 6관문 연속 재생에 연결

이전 v16에서는 개별 관문의 `playOriginalKtab`만 원본 KGC가 전달되고 `repeat_session.replay`, `low_gate_win_only.play`, `replayMixedFromSave`, `seriesFromSave`, `replayFromSave`의 실사용 경로에서는 원본 레이아웃이 전달되지 않거나 기본 가상 `first`를 계속 사용했다. **원본 KGC 데이터를 확보하고도 세이브/혼합 재생에서 사용하지 못하던 연결 결함을 수정.**

- `repeat_session.cjs`: 단계별 실제 관문 KGC 레이아웃 `ktabLayoutsByGate[gate]`을 원본 이중 순회 추첨 함수까지 전달. 매핑 없음은 **차단**하며 과거 `first`로 자동 대체하지 않음. 관측 네이티브 순서 경로도 게이트별로 전달.
- `low_gate_win_only.cjs`: 40개 원본 TDUP/KGC SHA·소스 경로·키 타입·TSET 순서 정합성을 한 번 검사한 뒤 연속 6관문에 제공. 묵문유적 일반 장비는 아직 미복원으로 별도 처리.
- `save_adapter.cjs`, `replay_mixed_from_save.cjs`, `replay_series_from_save.cjs`, `task_rng_divergence.cjs`: 6관문 일반 드랍의 세이브 기반 조회, 혼합 클리어, 연속 클리어 및 천일교 임무 조건 진단에서 **원본 `orderMode:'ktab'`** 을 기본 사용.
- 신규 테스트 `test_original_ktab_mixed_sequence.cjs`, `test_save_entry_original_ktab.cjs`: 6관문 혼합 120건, 단일 관문·연속 조회, 불완전 KGC 차단, 비공개 시드 결과 비노출. 기존 테스트 포함 Node.js **64/64**, Python **4/4**, 원본 지급 레지스트리 **12스크립트/40가중치/19보스/74기록** 검사 통과.
- 합성 시드 150개에서 6관문 `first`/원본 `ktab` 모델의 장비 및 종료 시드가 동일했다. 이는 게임 네이티브 동등성/미래 드랍 예측의 실측은 아니다.

수정된 실제 엔진 전체는 대화 파일 `Low_Gates_Original_Function_Replay_20261126_v17.zip` (SHA-256 `511fe6f83acb233a9da37c03ce5fae64e2045e60a31acb2dd6e8ee9bea0b7570`)에 보존했다. **비공개 세이브·실제 시드·복호화 게임 바이트코드 포함하지 않음.** 공개 사이트/버전/기존 90급 엔진 변경 없음.

미완료: ARM64 네이티브 `pairs()` 순회 독립 검증, `getLuaJsonFile` 실행시 캐시 조건 실측, 특수소비자 완전 상태 전달, 묵문유적 일반 드랍, 새로운 미래 플레이 홀드아웃.

## 2026-11-26 v18 — 40개 원본 테이블 해시 순회 C↔JS 이중 구현 및 JHTaskMgr 원본 이중 추출 감사

- 공개 LuaJIT 2.1.0 beta3 `lj_tab_newkey`, `rehashtab`, `lj_tab_next`에 근거한 **독립 C 언어 참조 모델** `native_beta3_reference.c` 작성. 실제 C 컴파일 후 실행 결과를 JS 원본 KGC 실행기와 교차 검사.
- 60014 Whale 원본에서 직접 추출했던 정적/동적 **40/40개 타입 있는 가중치 키 배열**의 순회 결과가 C 및 JS 모델 사이에서 전부 일치. 숫자/문자 혼합과 공백 키, 해시 충돌/재해시/배열을 포함한 **1,000개 합성 사례**도 일치. 합계 **1,040건 모델 간 순회 일치**. **이것은 ARM64 게임 내 `pairs()` 직접 실행 검증이 아니다.**
- 이전 60014 `JHTaskMgr` 바이트코드와 사용자 Library에 있던 독립 Whale 선택 복호화 `JHTaskMgr`에 `audit_original_task_loader.py`를 각각 실행해 **16개 메서드 등록·생성자 호출 기록**, **proto44의 224개 명령과 25개 주요 상수·호출 위치**의 감사 구조가 모두 일치함을 확인. 원본 바이트 SHA는 서로 다르며 *바이트 동일 파일*로 주장하지 않는다. [로더 이중 복호화 교차증거](ORIGINAL_TASK_LOADER_INDEPENDENT_CROSSCHECK_20261126.json).
- 기존 64개 검사와 신규 C/JS 순회 및 로더 독립 감사 2개 포함 Node **66/66**, Python SBv3 파서 **4/4**, 레지스트리 **12스크립트/40가중치/19보스/74지급 기록** 통과.
- 연구용 실제 C 소스, C/JS 회귀, 로더 증거, 전체 실행기: 대화 패키지 `Low_Gates_Original_Function_Replay_20261126_v18.zip` SHA-256 `e0fb9b59f93765a172039a4a7444480744d8e7ce4c4e9b2c4fdfc887083fa546`. 원본 게임 바이트코드, 개인 세이브 및 원시 RNG 시드는 포함하지 않음.

**남은 검증:** 게임에 포함된 ARM64 `pairs()`의 직접 관측, `getLuaJsonFile` 실제 `require`/캐시 분기 경로 기록, 전 보상 소비·특수 드랍 상태 전달과 미래 홀드아웃. 현재 KGC에 한해 JS↔C **모델 간 복원 신뢰도**가 상승했지만 실제 게임 적중률 보증으로 확대하지 않는다. 공개 사이트·버전 및 기존 90급 관문 코드 미변경.

원본 참고: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.c/ 및 https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lj_tab.h/

## 2026-11-26 v19 — 원본 6관문 입장 jhLua/RmManyP 누락 복원

대화 패키지 Low_Gates_Original_Function_Replay_20261126_v19.zip (SHA-256 2372f160b624a6f44db1913c7b3e3657f9eb2bc62fa5a20a590415e3e15ccf95)에서 **관문 입장 초기 상태 갱신이 누락됐던 실제 버그**를 수정했다.

- 원본에서 앞서 SHA를 확정한 6개 60014 관문 이벤트 생산자 SBv3를 다시 직접 파싱. 최상위 원본 jhLua 블록 11개, RmP 초기화 **31개**, NPC/맵 관련 비RNG 단계 **10개**를 원본 루트 명령 위치대로 추출. 새 engine/original_entry_timeline_60014.json 및 재추출 코드 reproduction_tools/derive_entry_timeline.py에 반영.
- 추가성, 혈의루, 철인문, 천일교, 고골문 입장시에 원본 RmManyP가 이전 보스 처치 기록 및 라운드/빠른 진입 플래그를 제거하지만, 기존 source_order_forward.cjs 이벤트 재생은 그 명령들을 건너뛰고 있었음. 각 연산을 순서대로 재생하도록 engine/original_entry_prelude.cjs와 원본 KGC 재생 경로를 수정.
- 취선채 원본의 round_jxz 및 quick_fuben RmP, 모든 관문의 fuben_* SetP 및 num_fuben AddP(-1)를 출처 기반으로 적용. num_fuben이 입력에 없을 때는 **임의 0/음수를 만들지 않고 미관측 상태를 기록**해 실제 세이브의 계정 카운터를 가정하지 않음.
- 원본 최상위 조건식·40개 SeedKeyRoll의 상대적 실행 순서 보존; 혈의루의 맨 앞 조건문이 뒤따르는 jhLua 초기화보다 먼저 실행되는 것도 보존. 기존 first/last/absent 가설 경로와 공개 사이트는 변경하지 않음.
- 모든 6관문 합성 원본 KGC 입장 실행 및 초기화 확인. JavaScript **67/67 테스트 통과**, Python SBv3 **4/4**, 소스 레지스트리 **12스크립트/40단계/19보스/74지급 기록** 검사 통과.
- 비RNG NPC/맵 변경 자체, 관문 전체 특수 보상 소비자 후처리, 묵문유적 일반 장비, 실제 ARM64 pairs 순회 및 새로운 미래 실게임 홀드아웃은 아직 미복원·미검증. **게임 원본 바이트코드·개인 세이브·원시 시드 ZIP/GitHub 미포함.**

## 2026-11-26 v20 — 원본 전투 보상 소비자의 80개 지급 명령 순서 복원

별도 연구 패키지: `Low_Gates_Original_Function_Replay_20261126_v20.zip` (SHA256 `07327e8e2cf12038741a88f0f88ed1dea2def68c1ce052efcd61906c0d608097`).

- v19는 45개 특수 직접 지급과 35개 동적 장비/재료 지급을 별도 함수에 분리하여, 실제 원본 전투 소비자 스크립트의 **섞인 지급 순서 및 JHRandom 인수 평가 순서**를 재현하지 못했다. `original_ordered_consumer.cjs`에서 고정 45 + 동적 35개의 **80 원본 경로**를 원본 AST 순서대로 통합, 세이브 재생기에 opt-in `confirmedOrderedConsumerBosses` 연결.
- 60014 원본 6개 fight SBv3에서 **74개 소비자 지급 경로의 상위 조건 전체를 직접 재추출**했다. 40급 묵문유적의 기존 고정 6개 경로 포함 통합 80개. 기존 직접 지급 레지스트리는 천일교 원본 전투의 `qf_temp` 상위 조건을 누락하여 일반/빠른 전투 경로가 동시에 특수 지급되고 `get_*` 카운터가 이중 증가할 수 있었다. 원본 상위 조건으로 두 분기를 배타적으로 재생.
- 원본에서 직접 특수 지급 전에 실행되는 **조건부 상점 카운터 증가 7개**를 추출: 철인문 2, 천일교 3, 고골문 2. 각 원본 부가 조건 만족 시 보상 지급 및 `get_*` 상태 갱신 전에 실행.
- 원본 소비자 스크립트에 나타난 `JHRandom` 호출의 **정적 발생 87개**를 원본 위치/분기와 함께 분류: 적 배치 54, 승리 보상 27, 보상 아이템 선택 인수 2, 기타 전투 스크립트 4. 이 숫자는 **한 클리어에서 모두 호출되는 횟수가 아니라 조건분기 포함 원본 명령 발생 개수**이며, 이들을 무조건 원본 `SeedKeyRoll`과 같은 난수 레인으로 합산하지 않는다.
- 보상 선택용 JHRandom 2개는 `observedJHRandomRolls`의 정확한 관문/원본 경로/인수 범위/값을 요구하고 **임의 RNG 추정을 하지 않는다**. 원본 인수 평가에서는 수량 0이어도 JHRandom이 호출된다는 순서를 보존. 추가성의 드랍 대상 `3`과 실제 보스 `33888`의 차이를 원본대로 분리.
- 두 신규 테스트 포함 Node.js **69/69**, Python SBv3 **4/4**, 원본 지급 레지스트리 **12스크립트/40단계/19보스/74기록** 감사 통과. `repeat_session` 원본 KGC 연속 재생 통합 검사 포함.

**미완료:** 실제 ARM64 LuaJIT `pairs()`의 독립 실행 검증, JHRandom의 정확한 RNG 레인과 전투 단계 도달성, 모든 지급 후처리 및 미래 실게임 홀드아웃. 공개 사이트/버전과 기존 90급 4관문 모델은 변경하지 않음. 원본 바이너리·사용자 세이브·개인 시드 파일은 연구 ZIP/GitHub 미포함.

## 2026-11-26 v21 — 원본 6관문 JHRandom 호출 87개 도달성·순서·범위 검증

독립 연구 패키지: Low_Gates_Original_Function_Replay_20261126_v21.zip (SHA256 1e2864b0061703995a0e8ba0a31fb069dcb9172f8df4e6b17a771d455b784c7c).

- 신규 engine/original_jhrandom_call_timeline.cjs는 원본 전투 6개 SBv3에서 추출한 87개 JHRandom 위치를 **원본 명령 순서**로 검증. 취선채 20, 추가성 17, 혈의루 19, 철인문 15, 천일교 10, 고골문 6개. 적 배치 54·승리 보상 27·아이템 선택 인수 2·기타 4개.
- 원본 전투 명령은 NpcExist 및 다른 조건부 전투 상태에 따라 실행되므로 87개를 무조건 소비하지 않는다. 독립 확인된 실행 명령 경로와 인수 경계·결과값·호출 순서가 모두 있어야 검증. 해당 기록이 없으면 **차단**.
- 취선채 및 추가성 원본 전투 아이템 난수 2개가 v20 통합 80개 지급 트리의 경로와 정확히 일치하는지 교차 검증. engine/repeat_session.cjs에 선택적 observedJHRandomTimeline 연결; 기존 보상용 observedJHRandomRolls와 동시에 제공하면 모순 차단. 실패 시 기존 상태 및 시드 불변.
- Node.js **70/70 테스트**, Python SBv3 파서 **4/4**, 원본 지급 레지스트리 **12스크립트/40가중치/19보스/74지급 기록** 통과.
- 이는 **실행 경로/관측 난수의 검증 인터페이스**다. 원본 game VM의 실행 분기 도달 자체나 JHRandom의 math.jhrandom/math.random 레인·원시 상태를 복구한 것이 아니며, 네이티브 ARM64 런타임 검증이나 미래 게임 드랍 홀드아웃도 미완료.
- 실제 게임 SBv3 바이트, 개인 세이브 및 원시 RNG 시드는 공개 ZIP 및 GitHub에 포함하지 않음. 공개 사이트/버전 및 출시 90급 관문 엔진 변경 없음.

## 2026-11-26 v22 — 60014 JHExtern.JHRandom 원본 분기 직접 복호화

- 사용자 보존 `gameversion(1).json`과 `src_whale64(3).zip` 내 `wapp__core.whale` 레코드 15(암호화 크기 14,401바이트)를 선택 복호화. 매니페스트 `v=1649ba9a014593d771560bcc4f25ab6f` 확인.
- 총 80개 프로토타입, 전역 `JHRandom` 등록 위치 proto79 PC19, 본체 proto8 **32명령** 직접 확인. 인수 조건 분기 PC0/1, `math.jhrandom` 조회 PC3/7/17/21(4회), `math.random` 조회 PC12/27(2회), 런타임 존재 조건 PC4/18, 반환 PC31. 독립 증거: [JHRandom 원본 PC 감사](original_jhrandom_dispatch_v22.json).
- 기존 구현은 두 숫자 인수 형태만 지원. 별도 `original_jhrandom_dispatch.cjs`에서 **인수 한 개 `JHRandom(max)` 및 두 개 `JHRandom(min,max)` 모두 타입·범위 및 인수 개수를 검증**, 런타임 `math.jhrandom` 존재 여부와 실제 RNG 오라클가 관측되지 않으면 계산 차단. 현재 기존 세이브 RNG 실행을 가상 시드로 대체하지 않음.
- 이전 보존 원본 `JHExtern` SHA `12906de159ffb7441e8651ae4dec5e610a9943dd8cf67680f421980905c4038e`와 이번 직접 복호화 SHA `195da532afaa3b9221bb335dedf1efe8eee892be6d3b78d6198b1286d244179c`는 다르다. **이전 원본과 파일 자체 동일이라고 주장하지 않으며**, 차이 및 독자 VM 분기 방향의 최종 판정은 다음 후속 작업.
- 전체 JS 테스트 **71/71**, 원본 SBv3 파서 4/4, 원본 레지스트리 12스크립트/40단계/19보스/74지급 기록 검증 통과.
- 전체 엔진·원본 감사 스크립트(게임 바이너리 제외) 독립 대화 패키지: `Low_Gates_Original_Function_Replay_20261126_v22.zip` SHA256 `4106a5f6c42bf7cff29d35104c73604077641b9a51b19c9b5dcfd3ea8430faa7`.
- 네이티브 `math.jhrandom` 실제 RNG 내부 상태/시드 및 전체 87개 호출 도달성, 게임 원본 ARM64 `pairs` 관측, 미래 드랍 독립 검증은 **여전히 미완료**. 공개 시뮬레이터와 버전, 출시 90급 4관문 엔진 미변경.

## 2026-11-26 v23 — 60014 원본 JHRandom 네 실행 경로의 실제 CFG 및 호출 PC 검증

v22에서는 JHExtern.JHRandom의 `math.jhrandom`/ `math.random` 참조와 분기 위치만 확인했지만 어느 CALL에 실제 도달하는지 PC 수준으로 결합하지 않았다. v23에서는 **원본 SBv3 proto8, 32개 명령을 직접 디코딩해 PC 상대 점프를 계산**했다.

- 원본 무조건 점프: **PC1→16, 5→11, 10→31, 15→31, 19→26, 25→31**. 네 경로는 각각 **정확히 한 번의 CALL**을 실행하고 PC31의 반환으로 합류.
- 1인수 네이티브 **PC9**, 1인수 fallback **PC14**, 2인수 네이티브 **PC24**, 2인수 fallback **PC30**. 원본 GC 상수 `math.jhrandom` / `math.random` 이름 및 TGETS 위치와 교차검사. 공개 가능한 메타증거: [JHRandom CFG v23](original_jhrandom_cfg_v23.json).
- `reproduction_tools/prove_jhrandom_cfg.py`: 사용자가 소유한 원본 SBv3를 로컬에서만 읽는 재현 검사. `engine/original_jhrandom_dispatch.cjs`: 별도 런타임 난수 오라클이 확인된 호출에 한해 원본 PC/분기명을 추적 기록. 잘못된 범위, 미관측 경로에서는 차단.
- 기존 포함 Node.js **72/72 검사**, Python SBv3 파서 **4/4**, 원본 12스크립트/40가중치/19보스/74지급 기록 구조 검사 모두 통과.
- 독립 패키지 `Low_Gates_Original_Function_Replay_20261126_v23.zip` SHA256 `c567f7919077d94d2385773670f85acf0362e14c7c66b6bb4d23e0d07203d920` 에 전체 실행기, 원본 검증 도구, 테스트 보존. 원본 바이너리, 사용자 세이브 및 실제 원시 시드 **미포함**.

중요한 한계: **PC0의 인수 분기 opcode 의미/방향의 독립 네이티브 확인과 math.jhrandom 내부 RNG 생성·시드 갱신/게임 런타임 실행은 아직 미확정**이다. 인수 1/2 경로 표기는 원본 레지스터 구성에 따른 현재 가설이며 정식 VM 분석 후 확정해야 한다. 위 성과는 원본 CFG 증명이지 실게임 미래 드랍 적중의 증명이 아님. 공개 사이트/버전 및 출시 90급 4관문 엔진 미수정.

## 2026-11-26 v24 — JHRandom 두 번째 형식 매개변수 nil 분기 오류 수정

60014 원본 JHExtern.lua JHRandom(proto8)의 **함수 헤더 `00050200`(형식 매개변수 2개)** 와 PC0 opcode7 A1/D0, PC1 상대 점프 PC16을 사용자 보존 복호화 원본에서 직접 검증. PC4/18은 native math.jhrandom 사용 분기, PC9/14/24/30은 네 경로 호출 위치. [원본 형식 매개변수·PC 증거](original_jhrandom_nil_register_v24.json).

- v23까지 JS `original_jhrandom_dispatch.cjs`는 **호출 인수 길이**를 기준으로 한 인수/두 인수 분기. `JHRandom(10, undefined)` 또는 `JHRandom(10, null)`은 Lua VM의 형식 매개변수 R1이 **nil**인 상태이므로 한 인수 경로여야 하지만 v23에서는 두 인수 경로로 처리하거나 차단했다.
- v24는 명시적인 JS undefined/null를 Lua nil로 정규화하고, JHRandom(10,nil) 호출을 한 인수 형태로 실제 관측 난수 오라클에 전달. 두 번째 숫자 인수는 두 인수 경로를 유지. **숫자 0은 nil이 아니다**(범위상 유효하지 않으면 차단). 네 경로 PC9/14/24/30을 테스트하고 임의 시드 생성 금지 유지.
- 원본을 로컬에서만 읽는 `prove_jhrandom_nil_branch.py` 와 분기/조건 검사 추가. Node.js **73/73**, Python SBv3 파서 **4/4**, 원본 12스크립트·40가중치·19보스·74기록 검사 통과.
- 전체 실행기와 신규 테스트 독립 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v24.zip`, SHA256 `bd3509cf0ea39d4c0076a96705fab542184d5394bdb95cc26b47737682e2a596`. 게임 원본 코드/바이너리·개인 세이브·시드 미포함.
- **원본 게임 전용 opcode7/41의 독립 ARM64 opcode 매핑과 math.jhrandom 시드·PRNG 내부 동작, 런타임 실행 도달 및 미래 드랍은 아직 미확정**. 이번 성과는 형식 매개변수 레지스터/조건 복원과 명시적 nil 전달 오류 수정. 공개 사이트·버전·기존 90급 관문 미변경.

## 2026-11-26 v25 — 실제 60014 ARM64 math.random 진입 및 전투 JHRandom 조건 도달성

**이번에는 기존 추정/소스 요약이 아니라 직접 소유한 60014 네이티브 바이너리를 검사했다.** 사용자 Library에서 `split_config.arm64_v8a(3).apk`를 선택 추출하여 원본 `libcocos2dlua.so` SHA256이 이전 90급 연구 V137 증거인 `53398b3460ecc678d8be1ad62b8afd89e370d7ca7a77d65396c00c0706443154`와 일치함을 확인했다.

- ARM64 실제 BL 목적지 디코딩: `0x828bf4 → 0x80b914`(표준 LuaJIT `math.random`의 난수 double 단계), `0x828d60 → 0x80b874`(`math.randomseed`의 TW223 상태 갱신). 원본 네이티브 함수가 바이너리에 존재함을 입증하며, **현재 게임의 실제 RNG 상태나 선택 분기는 아직 미확정**.
- APK 내 ARM64 공유 라이브러리 13개 모두에서 대소문자 무시 ASCII `jhrandom` 평문 0건. 이것으로 런타임 등록 부재를 증명할 수 없으므로 `math.jhrandom` 비활성/항상 fallback이라는 결론은 **내리지 않음**. [원본 네이티브 증거](ORIGINAL_NATIVE_JHRANDOM_AND_MATH_RANDOM_AUDIT_20261126.json).
- 신규 `original_jhrandom_reachability.cjs`: 6관문 **원본 87개 JHRandom 호출 위치**의 `NpcExist`, 천일교 `qf_temp`, 불투명 조건을 원본 가드에 따라 평가하되 **직접 관측된 시점별 NPC/조건 기록**만 사용. 미관측 조건은 중단, 임의 도달 경로가 원본 가드 관측과 충돌하면 중단. v21의 `observedJHRandomTimeline` 통로에 연결.
- 혈의루 원본 KGC 세이브 기반 연속 재생과 통합 검사: 가드 관측·난수 호출 기록·정적 보상 상태 갱신 결합. 가상 관측 전투 난수값을 바꿔도 `SeedKeyRoll` 명명 관문 시드가 뒤섞이지 않는 내부 불변성 확인. **이는 실제 게임 두 RNG 레인이 영원히 분리된다는 독립 증거가 아님.**
- Node.js 회귀 **75/75**, Python SBv3 파서 **4/4**, Python 원본 ELF 검사 모듈 자체의 합성 검사 **7/7**, 원본 레지스트리 **12스크립트/40가중치/19보스/74기록** 통과.
- 엔진 전체·Python 원본 ELF 선택 감사(바이너리 제외) 및 연구 문서: 대화 다운로드 `Low_Gates_Original_Function_Replay_20261126_v25.zip` SHA256 `345b814a355343d31145c6153c476f456c471c9727663106ad56b35179be7899`. 게임 바이너리·세이브·원시 난수 시드 미포함.

**여전히 남음:** `math.jhrandom`의 실제 등록 상태/네이티브 구현·시드, 표준 `math.random`의 게임 시작/현재 상태, 실행 시 게임 세계의 NPC 조건 기록, 실제 ARM64 게임 관문 미래 홀드아웃. 공개 사이트/버전 및 기존 출시 90급 4관문 엔진 불변.

## 2026-11-26 v26 — 표준 LuaJIT math.random TW223 생성기 및 6관문 조건부 호출 상태 전진

이번 연구에서는 v25에서 확인한 한국판 60014 ARM64 원본의 **표준 math.random 폴백** 경로를 실제 계산 가능한 독립 구현으로 보완했다. **math.jhrandom 자체의 구현/시드 복원이 아니며 실제 게임이 폴백 분기를 사용했다는 증명도 아니다.**

- `engine/original_luajit_math_random.cjs`: LuaJIT beta3 `lib_math.c`의 4개 64비트 TW223 상태, 시드 생성 시 10회 초기 워밍업, 하나/둘 인수 시의 정수 결과 변환. BigInt 64비트 연산과 float64 bit-cast 사용.
- `reproduction_tools/luajit_math_oracle.c`: 별도 C 참조 구현. **합성 시드 8 × 상한 5 × 100회 = 4,000 호출**을 JavaScript/C에서 비교해 난수 double 4,000개·정수 결과 4,000개와 최종 4-word 내부 상태 40세트 모두 일치.
- `engine/original_jhrandom_fallback_timeline.cjs`: v21~v25의 원본 전투 JHRandom 87개 호출 경로와 연결. 독립 관측한 **전역 math.random 상태와 런타임 fallback 경로 선택**, 실제 도달한 원본 호출 경로가 모두 제공된 경우에만 난수 및 최종 상태를 계산. 외부 게임 transcript가 있으면 별도로 일치 여부를 검사. 단지 합성 계산 자체를 실게임 관측이라고 표시하지 않음.
- 관련 신규 회귀 두 개 포함 **Node 77/77 통과**; Python SBv3 4/4, ARM64 감사 로직 7/7, 보존 원본 소스 레지스트리 12스크립트·40테이블·19보스·74지급 기록 통과.
- 실행 코드·C 원본·테스트 및 보고서 전체는 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v26.zip` (SHA256 `be90ac83040148ee64beb0f6c1545ac6a3976c4d6b351f2a7d05e222e55f1df3`)에 보존. 게임 바이너리·사용자 세이브·실제 원시 시드 미포함.

**미완료:** math.jhrandom 런타임 존재/구현, 실제 게임 전역 PRNG 상태 및 모든 간섭 호출, 실제 관문 JHRandom 조건 도달성, 실게임 미래 드랍 홀드아웃, 묵문유적 일반 장비. 완전 예측 확정 금지. 공개 사이트와 버전 및 출시 90급 엔진 불변.

LuaJIT 원본 참조: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lib_math.c/

## 2026-11-26 v27 — 공유 전역 LuaJIT math.random 간섭 누락 차단 + 6관문 혼합 세션 재생

실제 원본 `lib_math.c`(LuaJIT 2.1 beta3)에서 `math.random`은 동일한 PRNG 상태(upvalue `RandomState`)를 사용하고 `math.randomseed`가 그 상태를 재설정함을 대조했다. **v26 `original_jhrandom_fallback_timeline.cjs`는 관문 JHRandom 호출만 연속 소비하므로**, 정확한 시작 상태가 주어져도 다른 스크립트가 중간에 전역 함수를 호출하면 추첨 상태를 잘못 전진시키는 결함이 있었다.

- `engine/original_global_math_timeline.cjs`: 원본 관문 호출·원본 외부 `math.random`·관측된 `math.randomseed` 경계를 하나의 **완전 전역 호출 원장**으로 조건부 재생. 실제 관측 경로/전체 타임라인 증거 누락 시 차단. 사용자 제출 '완전' 플래그는 **독립적인 게임 실행 증거가 아님**을 명시.
- 기존 `replayFallback`에서 외부 호출 기록을 암묵적으로 생략하던 v26 동작 차단. `observedGuardEvidence` 원본 조건 교차 검증 유지.
- `engine/original_global_math_session.cjs`: 취선채·추가성·혈의루·철인문·천일교·고골문의 임의 혼합/반복 일정을 **하나의 공유 전역 PRNG 상태**로 재생. 회차/원본 호출 PC 순서, 외부 스크립트 호출, 관측 후 `math.randomseed` 재설정 상태 지원. **합성 혼합 160/160건**에서 별도로 계산한 상태 전진과 결과 일치.
- `math.random`의 정수 인수를 LuaJIT `lj_num2int`이 안전한 **signed int32** 범위로 제한, 너무 큰 구간이나 잘못된 입력은 상태 소모 전에 차단.
- 기존 연구 `independentlyVerifiedGameplay` 표기 오류 수정: 사용자 임의·합성 transcript가 일치했다고 독립 실게임 검증으로 표시하지 않음. `providedTranscriptMatches`만 별도로 기록.
- **Node.js 검사 81/81**, Python SBv3 파서 **4/4**, 네이티브 감사 테스트 **7/7**, 보존 원본 12개 스크립트·40가중치·19보스·74지급 기록 검사 통과.
- 대화 산출물 `Low_Gates_Original_Function_Replay_20261126_v27.zip`, SHA256 `9e8b48d28b7c5ae65867c88f3817d5b9971e13a0fb29c0aada1b2715284baf37`. **코드와 테스트는 ZIP에 보존**했고 GitHub에는 연구 체크포인트만 기록. 개인 세이브·실제 RNG 시드·게임 원본 바이너리 포함하지 않음.

미완료: 게임에서 `math.jhrandom`의 실제 등록/상태, 실게임 전역 PRNG 상태와 **모든** 다른 스크립트의 외부 호출, ARM64 게임 실측 및 미래 드랍 독립 검증. 공개 시뮬레이터 사이트/버전과 90급 출시 관문 구현 변경 없음.

참고: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lib_math.c/

## 2026-11-26 v28 — 원본 가드 관측 검증 오류 / 글로벌 math.randomseed 인수 재생

별도 실행 코드 전체 패키지: `Low_Gates_Original_Function_Replay_20261126_v28.zip`; SHA256 `fc3e90f4aed82cbf272094a9e1fb3fa95935125ef0edb3ee34157dea17aa93ed`.

- **실제 오류 수정**: `original_global_math_timeline.cjs`가 `observedGuardEvidence`로 얻은 `reachedPaths`를 `verifyTimeline`에 전달하지 않고 옵션 입력(미지정이면 undefined)을 그대로 전달해, 정상 전투 관측값까지 차단하던 오류 수정. 잘못된 PC 순서/결과/도달하지 않은 호출은 계속 차단한다.
- **혼합 관문 관측 검증**: `original_global_math_session.cjs`의 각 `clears[]`에 선택적인 `observedNativeCalls`를 추가. 원본 조건으로 확정한 실행 도달 경로 및 공유 LuaJIT PRNG 재생값을 개별 관측과 대조. 불일치 시 최종 상태를 확정하지 않음. 단 사용자가 제출한 관측 기록 자체는 독립 실게임 검증 증거가 아님.
- **원본 numeric randomseed 인수 지원**: 두 모듈 모두 `external-math-randomseed`에서 `observationProof:'captured-original-randomseed-argument'`와 검증된 유한 숫자 `seed`를 수신하면 소스 기반 `LuaJitMathRandom.seed`로 재설정 직후 4-word 상태 계산. 기존 `captured-exact-post-randomseed-state`도 지원. 추측/NaN/무한/문자열·조합이 모호한 기록은 차단.
- 새 소스 가드/전역 관측 검증, 원본 randomseed 인수의 중간 재설정 회귀 2개 포함 **Node.js 83/83**, Python SBv3 parser 4/4, 원본 네이티브 감사 테스트 7/7, 원본 가중치 레지스트리 12스크립트/40테이블/19보스/74지급 기록 검사 통과.
- **남은 병목**: 게임의 `math.jhrandom` 런타임 등록 및 초기 상태, 실제 전역 PRNG 전체 호출 기록, ARM64 게임 직접 실행, 묵문유적 일반 장비, 미래 관문 장비 홀드아웃. 본 작업은 추측 기반 RNG 정확성을 주장하지 않는다. 공개 사이트·버전·90급 출시 관문 구현 미변경; 원본 게임 바이너리, 사용자 세이브/원시 RNG 시드는 ZIP/GitHub 미포함.

## 2026-11-26 v29 — 64-bit 원본 TW223 관측 정밀도 차단 및 중간 PRNG 상태 대조

독립 대화 산출물: `Low_Gates_Original_Function_Replay_20261126_v29.zip` SHA256 `302c3e030eedfc2e209a9163ca46307c847f7da856aeb541477673a251964daa`. 전체 엔진·신규 코드·테스트 및 보고서 포함.

- **실제 구현 오류 수정:** 기존 `original_luajit_math_random.cjs`의 `LuaJitMathRandom.fromObservedState`가 64비트 상태 워드를 JS Number로 받아 BigInt로 전환하던 경우, 2^53 이상에서는 입력 Number가 이미 반올림되어 잘못된 PRNG 상태를 승인할 수 있었음. v29는 4개 정확한 unsigned 64-bit BigInt/16진·10진 문자열 또는 안전 정수 Number만 허용. 크거나 비정상적인 Number/문자열은 계산 전 차단.
- **새 교차검증:** 단일 및 혼합 관문 공유 `math.random` 실행기에 `checkpoint-global-math-state` 이벤트 추가. 원본 호출 사이의 정확한 4-word 상태를 비교하며 난수 상태를 추가 소비하지 않음. 불일치시 중단해 누락 전역 호출/재시드 경계를 탐지하고, 정상 관측 재시드는 계속 지원. 사용자가 제출하는 체크포인트는 독립 실게임 실행 증거로 자동 인정하지 않음.
- 전역 상태 검증의 실패 시 결과 상태를 반환하지 않는 방침 유지. 기존 원본 6관문 RNG/보상 및 90급 출시 4관문, 공개 사이트·버전 변경 없음.
- JS 회귀 **85/85**, Python 네이티브 감사 **7/7**, 원본 레지스트리 **12스크립트/40가중치/19보스/74지급 기록** 통과. 회귀 검증은 합성 상태 기반이며 **원본 게임 내부 PRNG 상태를 독립 관측한 것은 아님**.
- 미완료: 런타임 `math.jhrandom` 등록 여부 및 고유 시드, 실제 글로벌 PRNG 원장·실게임 ARM64 실행, 묵문유적 일반 장비, 미래 드랍 독립 홀드아웃. 비공개 세이브/게임 바이너리/원시 시드를 본 ZIP/GitHub에 포함하지 않음.

## 2026-11-26 v30 — 원본 Whale 3,565개 모듈에서 math.jhrandom 정적 등록 경로 재감사 + 두 인수 음수 범위 오류 교정

이번 연구는 공개 사이트가 아니라 별도 20~80급 관문 원본 엔진에만 적용. 전체 실행 코드와 88개 테스트는 대화 다운로드 `Low_Gates_Original_Function_Replay_20261126_v30.zip` (SHA-256 `f4ecc9cd1c4ca2843012958daf758258cfa3052d27af6b9637f2a30c7299f4d5`)에 보존. **원본 게임 바이너리/복호화된 스크립트·사용자 세이브·시드 미포함.**

- **실제 원본 선택 복호화 전수검사:** 게임 Whale `71개 그룹 / 3,565개 스크립트`를 각각 정상 복호화·파싱(실패 0). 이 범위에는 기존 core/data/task/main/battle/AI뿐 아니라 `wapp__story__fun.whale` 관문 소비자 2,355개와 branchtrigger/excelutils 그룹도 포함. [공개 가능한 원본 소스 PC·범위 증거](ORIGINAL_JHRANDOM_STATIC_SCAN_V30_20261126.json).
- 대소문자를 구별한 원본 키 `math.jhrandom`의 소문자 `jhrandom` 필드 접근은 **JHExtern proto8 PC3/7/17/21, JHNetServer proto23 PC974/978**에서만 발견. 전부 **TGETS(조회)**. 이 범위 내에 원본 소문자 키를 직접 TSETS하는 명령은 **0개**, 다른 GC 상수 문자열 내부의 소문자 `jhrandom` 부분 문자열도 **0개**. 다른 스크립트의 전역 대문자 `JHRandom` 래퍼 참조는 별도로 구별.
- **해석 제한:** `wapp__story.whale`, `wapp__story__branch.whale`, `wapp__story__event.whale`, `wapp__excel.whale` 및 다른 네이티브/리소스는 아직 전수 정적 검사하지 않았다. 동적 문자열·런타임 등록도 가능하므로 **게임에서 math.jhrandom이 없다는 증명이나 표준 math.random fallback 활성화 확인은 아니다.**
- **실제 계산 오류 수정:** 기존 `original_jhrandom_dispatch.cjs`는 `JHRandom(최솟값, 최댓값)`의 최솟값에 **0·음수를 허용하지 않아** 원본 LuaJIT `lib_math.c`의 `math.random(r1,r2)` 범위와 불일치했다. 두 인수 경로는 유효한 signed 32-bit 범위에서 0/음수를 허용; 한 인수 경로는 양의 상한만 허용. 범위 오버플로는 안전하게 차단하고 네 가지 원본 JHExtern call PC9/14/24/30은 유지.
- 새로운 **읽기 전용 Lua 런타임 관측기** `reproduction_tools/probe_runtime_math_jhrandom.lua`는 `rawget(math, 'jhrandom')`의 형식만 조사. **난수를 호출하거나 상태·세이브를 변경하지 않는다. 실제 게임에서 실행한 적은 없으므로 관측 기록이 존재한다고 주장하지 않는다.** `original_math_runtime_capability.cjs`는 전달받은 관측 결과의 스키마를 엄격 검증하되 실게임 독립 검증으로 표시하지 않는다.
- **Node.js 회귀 88/88**, Python 원본 관련 감사 7/7, 원본 12스크립트·40가중치·19보스·74지급 경로 구조 검사 통과. 정적 검사만으로 자동 미래 드랍 예측이나 math.jhrandom 시드 복원 완성은 불가.

**다음 최우선:** 실제 게임 런타임 시작/관문 입장/전투 보상 시점의 `type(math.jhrandom)` 독립 관측 → 사용 경로 확정 → 해당 PRNG의 시작 상태·외부 소비 복원 → 일반 장비 ID/색상 홀드아웃 검증. 공개 사이트·버전·기존 출시 90급 4관문 코드 불변.

LuaJIT 2.1 beta3 표준 근거: https://sources.debian.org/src/luajit/2.1.0~beta3%2Bdfsg-5.1/src/lib_math.c/

## 2026-11-26 v31 — JHNetServer 원본 직접 math.random(17) 외부 소비 복원

기존 v30에서 정적 조회만 확인했던 `JHNetServer` 60014 Whale `wapp__net.whale` (원본 레코드 3)의 **원본 proto23 / 총 1,655개 명령**을 직접 복호화하여 LuaJIT 호출 프레임을 재검증했다. 이는 기존 6관문 전투 스크립트의 **87개 `JHRandom` 호출**과 다른 **직접 math 호출**이며, 실행 시 공유 글로벌 RNG 상태에 영향을 줄 수 있다.

- 원본 PC973–975: `math.jhrandom` 조회와 조건 검사. PC977–980: 상한 17의 네이티브 함수 호출 `PC980`; PC983–986: 상한 17의 `math.random` 폴백 직접 호출 `PC986`. 두 CALL 모두 B=2/C=2, 직전 KSHORT D=17.
- 새 `engine/original_netserver_direct_random.cjs`: 실제 도달 PC986이 **별도 관측된 때에만** 한 번 `math.random(17)` 소비. 네이티브 활성 상태에서는 폴백을 가정하지 않는다. 범위/PC/관측 출처 오류 차단.
- 기존 단일 관문 `original_global_math_timeline.cjs` 및 혼합 관문 `original_global_math_session.cjs` 모두 이 이벤트 처리. 호출 사이 상태 전진과 최종 상태를 별도 TW223 참조 계산과 비교.
- 재현 도구 `reproduction_tools/prove_netserver_direct_random.py`: 사용자가 보존한 60014 Whale을 선택 복호화하고 원본 상수/PC/레지스터를 검사. **복호화 게임 바이너리는 ZIP/GitHub에 포함하지 않는다.**
- JS 회귀 **89/89**, Python SBv3 파서 **4/4**, 원본 등록 구조 12스크립트/40테이블/19보스/74지급 기록 통과. 남은 `wapp__excel.whale` 141/141 기록은 이번에 별도 검사했으며 `jhrandom` 직접 문자열 참조가 없었다. 대형 `wapp__story`/branch/event 그룹 전체 재검사는 제한시간 내 미완료로 유지.
- **완성 아님:** 런타임 `math.jhrandom` 등록/시드·게임 전역 PRNG 전체 원장·JHNetServer PC986의 게임 내 실제 도달 여부·미래 보스별 일반 장비 ID/색상 검증은 아직 없다. 공개 사이트/버전과 출시 90급 4관문 엔진 미수정.

대화용 전체 실행기 및 감사 코드 ZIP: `Low_Gates_Original_Function_Replay_20261126_v31.zip` SHA256 `e40b77a43e1c48a7daeffd12bb51ec940c13e67bec9ea25b2cd4ff97933759a9`.
