# ADR-0002: Canonical Key 명명 규칙 및 ID 불변 원칙

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-20
- **결정자 (Deciders)**: 프로젝트 아키텍트 (@duckbeginner) & AI 페어 프로그래머
- **영향 범위**: `scripts/data-hub/collectors/schedule.js`, `scripts/data-hub/utils/schedule-normalizer.js`, `scripts/data-hub/rebuild-pipeline.js`, `docs/ops.js`

---

## 1. 컨텍스트 및 문제 정의 (Context)
- 과거 v1 파이프라인은 `날짜_제목`(예: `2026-09-15_POP-UP`)을 기본 식별자 키로 사용했으나, 공식 일정 제목이 오타 수정되거나 시간이 변경될 때마다 키가 달라져 기존 오버라이드 데이터가 고아화(Orphan)되고 유실되는 문제가 발생했습니다.
- 외부 수집기에서 Mnet Plus API 응답의 24자리 hex ObjectId(`682e02bd...`)가 접두사 없이 저장되거나 클라이언트 임시 해시(`mod_*`)가 여과 없이 유입되어, 연관 일정 링크(`linkedScheduleIds`) 중 65건이 깨진 채 배포되는 데이터 무결성 훼손이 확인되었습니다.
- 프로덕션 코드(`schedule.js`, `rebuild-pipeline.js`)에서는 YouTube 영상 식별자로 일관되게 `yt_${videoId}`를 사용하고 있으므로, 모든 수집 데이터의 고유 키는 단일 불변 정규식에 의해 검증되어야 합니다.

---

## 2. 고려된 대안들 (Alternatives Considered)
1. **대안 A: 레거시 날짜_제목 복합키 유지 (`YYYY-MM-DD_TITLE`)**
   - *장점*: 키만 보고 사람이 날짜와 제목을 직관적으로 식별 가능.
   - *기각 사유*: 제목 변경/오타 수정 시 키가 바뀌어 오버라이드 맵이 깨지며, 동일 날짜 동일 제목의 복수 스케줄 발생 시 키 충돌 회피 불가.
2. **대안 B: 원본 API Raw ID 무검증 허용 (`mod_*`, Raw Hex 24자리 허용)**
   - *장점*: 수집기 가공 로직 최소화.
   - *기각 사유*: 플랫폼 간 ID 충돌(예: Blip의 숫자 ID와 Mnet의 ID 체계 간섭), 임시 키(`mod_*`) 영구 잔존으로 인한 연관 링크 고아화 위험.
3. **대안 C (선택): 표준 접두사 기반 불변 Canonical Key 체계**
   - *장점*: 출처 플랫폼이 명확히 구분되며, 원본 데이터의 불변 ID를 기반으로 하여 제목/일시 변경에도 영구 불변성 및 참조 무결성 100% 보장.

---

## 3. 최종 결정 사항 및 핵심 규칙 (Decision & Rules)
1. **표준 정규식 규격 강제**:
   - 모든 일정 ID는 반드시 정규식 `^(blip_|mnet_|yt_|custom_)[a-zA-Z0-9_-]+$`을 100% 충족해야 한다.
2. **소스별 Prefix 고정**:
   - **Blip**: `blip_${scheduleId}`
   - **Mnet Plus**: `mnet_${eventId}` (24자리 raw hex 감지 시 반드시 `mnet_`를 강제 부여)
   - **YouTube**: `yt_${videoId}`
   - **Custom (관리자 수동/크롤러 외)**: `custom_${YYMMDD}_${rand}`
3. **금지 대상 (Forbidden Patterns)**:
   - 접두사 없는 24자리 raw hex (`^[a-f0-9]{24}$`) 금지.
   - 가상 임시 해시 키 (`mod_*`) 배포 금지.
   - 레거시 날짜 키 (`^\d{4}-\d{2}-\d{2}_`) 금지.
4. **연관 링크(`linkedScheduleIds`) 정제 규칙**:
   - 자기 자신의 ID(`selfId`)를 참조하는 순환 링크 원천 배제.
   - 금지된 비표준 키(`mod_*`, 레거시 키)는 배열에서 자동 필터링.
   - 24자리 hex는 자동으로 `mnet_` 접두사를 붙여 정규화.

---

## 4. 기대 효과 및 불변 제약 (Consequences & Invariants)
- **기대 효과**:
   - 연관 일정 고아 링크 0건 달성 및 관계 무결성 보장.
   - 제목/시간 변경에도 오버라이드 데이터 100% 영구 보존.
   - 프로덕션 코드와 데이터 명세 간의 완벽한 1:1 패리티 유지.
- **불변 제약 (Invariants)**:
   - 파이프라인 검증기(`validate.js`) 및 리빌드 도구는 `^(blip_|mnet_|yt_|custom_)[a-zA-Z0-9_-]+$`를 만족하지 않는 ID가 1건이라도 발견되면 즉시 파이프라인을 중단(Exit 1)한다.
   - `linkedScheduleIds`의 모든 원소는 실제 존재하는 유효한 마스터 ID여야 하며 고아 참조를 허용하지 않는다.
