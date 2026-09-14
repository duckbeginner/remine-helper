# RESCENE Remine Helper 개발 작업 가이드 (Development Guide)

본 문서는 **RESCENE Remine Helper** 프로젝트의 데이터 무결성, 모바일/PWA 사용성, 동시성 안정성 및 회귀 버그 방지를 위한 **핵심 아키텍처 원칙과 개발 체크리스트**를 정의합니다. 모든 기능 추가, 수정 및 버그 픽스 시 본 가이드라인을 반드시 준수해야 합니다.

---

## 1. 동시성 제어 및 3-Way 병합 원칙 (3-Way Merge & Concurrency)

Ops 운영 포털(`docs/ops-m7k2x9.html`)은 여러 기기(PC 브라우저, 스마트폰 홈 화면 PWA 등)에서 동시에 접근하여 일정을 수정할 수 있습니다. 단순 2자 비교(Local vs Remote)는 원격에 이미 존재하는 데이터를 수정할 때 무조건 충돌로 오판(False Positive)하거나, 타 기기의 최신 저장을 덮어쓰는 문제가 발생합니다.

### 1-1. 3자 상태 정의
- **`Base` (`baseOverridesSnapshot`)**: 현재 세션에서 최초 조회(GET)하거나 직전 저장 성공 시 메모리에 캡처해 둔 초기 스냅샷.
- **`Local` (`pendingOverrides`)**: 현재 기기/창에서 사용자가 편집 대기열에 추가한 수정본.
- **`Remote` (`latestGist.files['schedule-overrides.json']`)**: 저장(PATCH) 버튼을 누른 바로 그 시점에 원격 Gist에서 실시간 GET으로 조회한 최신 데이터.

### 1-2. 충돌 판별 공식 (Conflict Detection Rule)
반드시 다음 조건이 **모두 충족될 때만** 충돌(Conflict)로 판별해야 합니다:
```javascript
const isRemoteChanged = JSON.stringify(remoteVal) !== JSON.stringify(baseVal);
const isLocalDifferent = JSON.stringify(localVal) !== JSON.stringify(remoteVal);

if (isRemoteChanged && isLocalDifferent) {
  // 진정한 동시 수정 충돌 발생!
}
```
- **`isRemoteChanged` (Remote !== Base)**: 내가 로드한 이후 원격에서 다른 사람/기기가 실제로 값을 변경했는가?
- **`isLocalDifferent` (Local !== Remote)**: 내가 바꾸려는 값이 원격의 최신 값과 다른가?
- 둘 중 하나라도 만족하지 않으면(예: 원격은 그대로인데 로컬만 수정된 정상 수정 케이스) 절대 충돌 알림을 띄우지 않고 정상 저장되어야 합니다.

### 1-3. 충돌 시 사용자 선택 및 롤백 규칙 (Rollback on Cancel)
충돌 대화창에서 사용자가 `[취소]`를 선택한 경우:
1. 해당 일정의 로컬 수정 키를 `pendingOverrides`에서 즉시 제거(`delete pendingOverrides[k]`).
2. 화면 롤백을 위해 `loadSchedules()`를 즉시 호출하여 최신 원격본 상태로 UI 복원.
3. 저장 버튼 상태를 원복(`저장 적용 (N건)`)하고 **`return;`으로 저장을 즉시 중단**.

### 1-4. Base Snapshot 생명주기 갱신
`updateBaseOverridesSnapshot(appliedOverrides)`는 다음 두 시점에 반드시 호출되어야 합니다:
- `loadSchedules()` 완료 시점 (초기 로드 또는 수동 새로고침)
- `onSaveToGistClick()` 성공 시점 (원격 반영 완료 후 현재 상태를 새로운 Base로 확정)

---

## 2. 모바일 / PWA Safe Area 대응 규칙 (Safe Area Guidelines)

Remine Helper Ops 포털은 iOS Safari의 "홈 화면에 추가" (Standalone PWA) 환경에서도 완벽히 동작해야 합니다. 노치(Notch), 다이나믹 아일랜드(Dynamic Island), 하단 홈 인디케이터 바와의 겹침을 방지하기 위해 다음 CSS 규칙을 준수합니다.

### 2-1. 메타 태그 선언
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

### 2-2. 상단 고정 요소 (Fixed Header / Top Navigation)
상단에 고정되는 헤더, 툴바, 탭 바는 시계 및 상태바와 겹치지 않도록 `safe-area-inset-top`을 패딩으로 반영합니다:
```css
.app-header-fixed {
  padding-top: env(safe-area-inset-top, 0px);
}
```

### 2-3. 하단 플로팅 요소 (Floating Bottom Bar / Sheet / Modal)
화면 하단에 떠 있는 버튼 바(예: `.staging-bar`), 바텀 시트(`.bottom-sheet`), 풀스크린 게이트키퍼 모달은 홈 바와 겹치지 않도록 안전 마진을 적용합니다:
```css
.staging-bar {
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
}

.bottom-sheet {
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}
```

---

## 3. 데이터 파이프라인 & 오버라이드 영구 보존 원칙 (Overrides Integrity)

중앙 데이터 허브(`scripts/data-hub/fetch-all.js`, GitHub Actions)는 15분 주기로 외부 원본 API(Blip, Mnet Plus, YouTube, SNS)에서 최신 데이터를 긁어와 2계층 데이터셋(`core.json`, `schedules.json`)을 빌드합니다.

### 3-1. 원본 덮어쓰기 방지 메커니즘
- 외부 수집기(`collectScheduleData`)는 매 배치마다 Blip/Mnet의 최신 일정을 새로 긁어옵니다.
- 따라서 **`schedules.json` 파일만 수동으로 수정하면 다음 동기화 시 덮어써져 원본 상태로 회귀**됩니다.
- 수동 보정 데이터(제목 수정, URL 연결, 일정 연관 링크, 삭제 여부)가 영구 유지되려면 **반드시 `schedule-overrides.json`에 기록**되어야 합니다:
  - `sourceOverrides`: 외부 소스(`blip_...`, `mnet_...`)의 보정 메타데이터
  - `customSchedules`: 사용자가 수동 등록한 자체 일정 (`custom_...`)
  - `deleted`: 숨김/삭제 처리된 일정 ID 목록

### 3-2. 안원잘부 영상 등 비정형 콘텐츠의 오버라이드 필수 규칙
- 블립에 `<안원잘부>`처럼 텍스트만 올라오는 방송의 경우, 유튜브 RSS 피드 장애나 스크래퍼 동작 시 `publishedAt`(게시일)이 누락되어 자동 매칭이 스킵될 수 있습니다.
- 이러한 영상 일정은 Ops 포털에서 링크를 연결하여 **`schedule-overrides.json`의 `sourceOverrides`에 등록**함으로써, 외부 API 장애 여부와 무관하게 100% 영구 보존되도록 조치해야 합니다.

---

## 4. TDD 선행 및 전수 검증 의무화 (Testing & Verification)

### 4-1. TDD 선행 원칙
- 버그를 발견하거나 새로운 비즈니스 로직을 추가할 때는, **반드시 해당 상황을 재현하는 단위 테스트 코드를 `tests/`에 먼저 작성**합니다.
- 코드를 수정한 후 해당 테스트가 정상 통과하는지 확인합니다.

### 4-2. 전수 검증 체크리스트
파일 수정 후 커밋 전 다음 명령어를 필수 실행하여 결함이 없음을 확인해야 합니다:
```bash
# 1. 파일 문법 검사 (Syntax Check)
npm run check

# 2. 정적 린터 검사 (Oxlint)
npm run lint

# 3. 단위/통합 테스트 전수 실행
npm test

# 4. E2E 테스트 실행 (Playwright)
npm run test:e2e
```

### 4-3. 커밋 및 배포 원칙
- 모든 변경 사항은 사용자 확인 및 승인을 받은 후 커밋/푸시합니다.
- 커밋 메시지는 Conventional Commits 규격을 준수합니다 (예: `fix(ops): ...`, `docs: ...`, `test: ...`).
