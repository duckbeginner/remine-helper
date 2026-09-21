# ADR-0002: Canonical Key 명명 규칙 및 ID 불변 원칙

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-20
- **영향 범위**: `scripts/data-hub/collectors/schedule.js`, `scripts/data-hub/utils/schedule-normalizer.js`, `docs/ops.js`

---

## 1. 컨텍스트 (Context)
- 과거 v1 파이프라인은 날짜_제목(예: `2026-09-15_POP-UP`)을 기본 키로 사용했으나, 제목 수정이나 시간 변경 시 키가 변경되어 오버라이드가 유실되는 문제가 있었습니다.
- 수집기에서 Mnet Plus API 응답의 24자리 hex ObjectId(`682e02bd...`)가 접두사 없이 그대로 저장되거나, 임시 해시(`mod_*`)가 유입되어 65건의 연관 일정이 고아(Orphan) 링크로 깨지는 대규모 장애가 발생했습니다.

## 2. 최종 결정 사항 (Decision)
1. **표준 정규식 규격 강제**:
   - 모든 일정 ID는 반드시 정규식 `^(blip_|mnet_|youtube_|custom_)[a-zA-Z0-9_-]+$`을 100% 충족해야 한다.
2. **소스별 Prefix 고정**:
   - **Blip**: `blip_${scheduleId}`
   - **Mnet Plus**: `mnet_${eventId}` (24자리 raw hex 감지 시 반드시 `mnet_`를 강제 부여)
   - **YouTube**: `yt_${videoId}` 또는 `youtube_${id}`
   - **Custom (관리자 수동/크롤러 외)**: `custom_${YYMMDD}_${rand}`
3. **금지 대상 (Forbidden Patterns)**:
   - 접두사 없는 24자리 raw hex (`^[a-f0-9]{24}$`) 금지.
   - 가상 임시 해시 키 (`mod_*`) 금지.
   - 레거시 날짜 키 (`^\d{4}-\d{2}-\d{2}_`) 금지.
4. **연관 링크(`linkedScheduleIds`) 정제 규칙**:
   - 자기 자신의 ID(`selfId`)를 참조하는 순환 링크 원천 배제.
   - 금지된 비표준 키(`mod_*`, 레거시 키)는 배열에서 자동 필터링.
   - 24자리 hex는 자동으로 `mnet_` 접두사를 붙여 정규화.
