# ADR-0003: Full URL 복원 및 mediaIds 배열 분리 보존 원칙

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-20
- **영향 범위**: 클라이언트 호환성, `scripts/data-hub/`, 배포 산출물(`schedules.json`, `master-schedules.json`)

---

## 1. 컨텍스트 (Context)
- 데이터 다이어트 및 리빌드 과정에서 `url` 필드에 `yt:VIDEO_ID`, `ig:CODE`, `x:ID`와 같은 축약 미디어 ID를 직접 저장하는 방식이 시도되었습니다.
- 그러나 배포본(`schedules.json`)의 `url`에 축약 ID가 그대로 들어가면, 기존 v1.0.5 클라이언트가 `<a>` 태그 링크를 열 때 `https://...`가 아닌 비정상 주소로 이동하는 하위 호환성 파괴가 발생합니다.

## 2. 최종 결정 사항 (Decision)
1. **`url` 필드의 완전한 Full URL 보장**:
   - 배포되는 모든 JSON의 `url` 필드는 `null`이거나 반드시 `https://...` 형태의 유효한 완전한 웹 URL이어야 한다.
   - 오버라이드에 `yt:xxx` 같은 축약 ID가 저장되어 있더라도, 파이프라인 배포 시점(`formatMediaUrl`)에 반드시 정규 웹 URL로 복원하여 배포한다.
2. **`mediaIds` 배열 필드 신설 및 병행 제공**:
   - 향후 버전의 고속 미디어 렌더링 및 모달 재생을 위해 `mediaIds: string[]` 배열 필드를 스케줄 아이템에 함께 생성하여 배포한다 (예: `mediaIds: ["yt:8T0J9NrvxYs"]`).
3. **외부 SNS별 URL/미디어 파싱 규칙**:
   - YouTube: `yt:VIDEO_ID(?t=...)`
   - Instagram: 게시물/릴스는 `ig:SHORTCODE`로 추출, **단 인스타그램 계정 프로필 URL은 게시물 ID가 아니므로 일반 Full URL로 원형 보존**.
   - X / Twitter: 트윗 상태 ID는 `x:TWEET_ID`로 추출, **계정 프로필 URL은 일반 Full URL로 원형 보존**.
