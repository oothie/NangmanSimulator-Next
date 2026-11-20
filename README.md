# NangmanSimulator-Next

한국판 낭만강호 신규 통합 시뮬레이터의 독립 사이트 저장소.

현재 배포용 초기 버전: **v0.2.1** (GitHub + Cloudflare Pages).

- 기존 `oothie/NangmanSimulator` 사이트와 별도 관리합니다.
- UI/사이트 구조는 yy-sim을 참고하되, 복제 자산을 무단 배포하지 않습니다.
- 한국판 장비 계산은 기존 Roboking 및 산부진 결과를 검증한 후 연결합니다.
- 세수·도맥법은 yy-sim 로직의 한국판 세이브 매핑 검증을 거칩니다.
- 백과는 한국판 APK에서 복원한 NangmanGame 데이터를 기준으로 구축합니다.
- 항산파·전투 자동 시뮬레이션 제외.
- `内息`은 한국판 용어 '내식'을 사용합니다.

## Cloudflare Pages 설정
- GitHub 저장소: `oothie/NangmanSimulator-Next`
- Production branch: `main`
- Framework preset: `None`
- Build command: 비움
- Build output directory: `/` (repo root)
- Root directory: `/`

`index.html`이 저장소 루트에 있어 별도 빌드 없이 정적으로 배포됩니다.
Cloudflare의 Fetching repository 오류는 첫 커밋 부재 또는 GitHub App 접근 권한 설정 문제일 수 있습니다. GitHub App에 이 저장소 접근이 허용되어야 합니다.

## 현재 기능
한국어 사이드바 UI, 테마 전환, 한국판 JSON 파일 로컬 불러오기, 기본 캐릭터·세이브 확인. 그 외 계산 기능은 개발 예정이며 미검증 예측값을 제공하지 않습니다.
