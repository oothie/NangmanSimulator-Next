# 한국 서버 출시 4관문 — 사전 봉인 예측·사후 검증

목표는 **일반 90급 장비의 장비명(ID), 색상, 등장 순서**를 향후 실제 클리어 전에 예측하고, 원래 예측을 고치지 않은 상태에서 사후 검증하는 것입니다. 특수 보상은 일반 장비나 시드에 영향을 미치는 조건만 사용합니다. 미출시 5개 모드는 지원하지 않습니다.

## 사전 봉인 (실제 관문 클리어 전에 실행)

`python sealed_equipment_holdout.py seal --before PRE.json --source-root /path/to/v30 --registry /path/to/gate-60-source-registry.json --schedule 벽유교,창옥,연왕부,유씨별원 --private-record PRIVATE_SEAL.json --public-commitment PUBLIC_COMMIT.json`

- `PRIVATE_SEAL.json`: **로컬에만 보관**. 시작 세이브 SHA-256, 보유 장비 객체 ID, 예측 장비 ID/색상, 종료 시드, 승리 횟수, 256-bit nonce 포함. 절대 공개 저장소에 업로드하지 않습니다.
- `PUBLIC_COMMIT.json`: 원시 시드, 계정/세이브 정보, 장비 객체 ID, 장비 예측 목록 없이 SHA-256 커밋만 수록. 시뮬레이터 공개 사이트에 자동 반영하지 않습니다.
- 원본 모델과 정확한 예상 관문 순서를 확인한 다음 봉인하고, 클리어가 끝나기 전에는 다시 예측하지 않습니다.

## 사후 실측 대조

`python sealed_equipment_holdout.py verify --after POST.json --private-record PRIVATE_SEAL.json --public-commitment PUBLIC_COMMIT.json --out LOCAL_AUDIT.json`

- 기본 `PASS` 조건: **예측 신규 일반 90급 장비 전체의 ID/색상/생성 순서 완전 일치 + 해당 관문 RNG 종료 시드 전부 일치 + 관문 승리 카운터 전부 일치 + 사전 존재 장비 전체 보존**.
- 관문 외 추가 드랍 장비가 끼거나 예전 장비가 처분된 경우 **엄격한 성공을 주장하지 않습니다**. 모든 장비가 남아 있을 경우에만 완전 대조가 가능합니다.
- 이전 1123 입장 전→1124 기록은 **예측 대상 13개가 추가 장비 16개 중 처음 13개와 일치**하나, 기존 장비 삭제 및 설명되지 않은 신규 장비 3개가 존재하므로 엄격한 신규 홀드아웃 성공으로 판정하지 않습니다. `--diagnose-extra`는 이 기존 사례의 보조 판정용으로만 사용하며 성공 판정으로 승격하지 않습니다.
- 공개 해시 값은 모델을 독립 검증하는 것이 아니라 **미래 결과를 보기 전에 예측 내용이 고정됐음을 입증하는 수단**입니다.

## 검증

`python -m unittest discover -s forward_holdout -p 'test_*.py' -v`

새 테스트 10개: 봉인 변경 감지, 공개 파일 개인정보 최소화, 4관문 외 차단, 보유 장비 삭제·추가 장비 감지, 장비 색상 및 시드 불일치 탐지, synthetic strict PASS/FAIL, 과거 1123→1124 자료의 불완전 판정 등.

연구 브랜치에 코드와 문서만 포함합니다. **사용자의 실제 세이브, 시작/종료 난수값, 비공개 봉인 파일은 GitHub에 넣지 않습니다.** 현 사이트, V82 및 미출시 관문은 변경하지 않습니다.