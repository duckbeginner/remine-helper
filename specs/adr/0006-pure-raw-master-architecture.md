# ADR-0006: 순수 원본 마스터(Pure Raw Master) 아키텍처 및 순환 오염 방지

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-23
- **결정자 (Deciders)**: 프로젝트 아키텍트 (@duckbeginner) & AI 페어 프로그래머
- **영향 범위**: `master-schedules.json`, `scripts/data-hub/collectors/schedule.js`, Ops 포털 저장 엔진(`docs/ops.js`), 데이터 수집 및 배포 파이프라인

---

## 1. 컨텍스트 및 문제 정의 (Context)

- **순환 오염과 링크 증발 참사**:
  - 기존 수집기(`scripts/data-hub/collectors/schedule.js`)의 `mergeSchedulesV2`는 배포본(`activeItems`) 생성을 위해 오버라이드(`ov`)를 덮어쓴 `baseItem`을 Ops 검수용 마스터 아카이브(`masterItems`)에도 그대로 수록하는 심각한 설계 결함이 존재했습니다.
  - 이로 인해 `master-schedules.json`에 관리자 편집본인 `linkedScheduleIds`(115건), `isDeleted: true`(154건), `custom_` 일정이 영구 구워져(Bake-in) Gist에 업로드되었습니다.
  - 마스터에 이미 링크가 포함되어 있으므로, Ops 포털이 이 마스터를 로드하여 현재 편집본과 1:1 diff(`computePureDiff`)할 때 **"마스터와 편집본이 동일하므로 차분이 아니다"**라고 판단하여 오버라이드에서 `linkedScheduleIds`를 누락/제거해 버리는 연쇄 사고가 반복 발생했습니다.
- **대리 환경 테스트의 함정 (Anti-Proxy Fallacy)**:
  - 과거 리빌드 파이프라인(`rebuild-pipeline.js`)이 임시 캐시 디렉터리(`.cache/rebuild/`)에만 순수 마스터를 생성하고 검증을 통과하여, 실제 프로덕션 크롤러와 운영 파일이 정제된 것으로 잘못 간주되었습니다.

---

## 2. 고려된 대안들 (Alternatives Considered)

1. **대안 A: 마스터 영구 병합 (Squash Model 유지)**
   - *장점*: 마스터와 오버라이드를 합치므로 파일 수가 적음.
   - *기각 사유*: 공식 수집처(Blip, Mnet Plus)의 신규 업데이트를 영구 차단하며, 차분(Diff) 기반 관리자 편집 상태의 무결성을 파괴함.
2. **대안 B: Ops 포털에서만 로컬 diff 캐시 관리**
   - *장점*: 수집기 코드를 건드리지 않음.
   - *기각 사유*: Gist와 로컬 파일의 데이터 오염이 방치되어 근본적인 SSOT가 불일치함.
3. **대안 C (선택): 순수 원본 마스터(Pure Raw Master SSOT) + 프로덕션 전 구간 오염 차단**
   - *장점*: 마스터의 순수성을 100% 보장하여 Ops 포털 diff가 언제나 마스터 원본 대비 완벽한 차분을 산출하며, 순환 피드백 루프를 영구 차단.

---

## 3. 최종 결정 사항 및 핵심 규칙 (Decision & Rules)

1. **순수 마스터의 절대적 불변성 (Pure Raw Master SSOT)**:
   - `master-schedules.json`은 외부 공식 크롤러(Blip, Mnet Plus, YouTube)가 수집한 **순수 공식 일정만 수록**한다.
   - 마스터 내 `linkedScheduleIds`, `isDeleted`, `_isDeleted`, `_isModified`, `custom_` 일정은 **정확히 0건(Zero-Tolerance)**이어야 한다.
   - 오직 Ops 검수 편의를 위한 읽기 전용 메타데이터인 `_filterReason`과 `_isPendingReview`만 조건부 첨부를 허용한다.

2. **수집기 2트랙 분기 완전 격리 (`mergeSchedulesV2`)**:
   - `activeItems` (배포본): 오버라이드 합성 ➔ 필터링 ➔ 삭제 배제 ➔ 연관 일정 클러스터링 합성 순서로 처리.
   - `masterItems` (전수 마스터): 오버라이드가 일체 섞이지 않은 순수 원본 `item`을 슬림화하여 수록.

3. **Gist Hydration 진입 단계 순수화 (`loadBaseMasterSchedules`)**:
   - Gist 또는 로컬에서 마스터를 다운로드받을 때, 과거 오염된 파일이 유입되더라도 메모리 로드 즉시 오버라이드 속성을 스트립(Strip)하여 순환 오염 증폭을 원천 차단한다.

4. **Ops 포털 단일 SSOT diff 및 방어적 이중 안전망**:
   - Ops 포털은 `rawBaseSchedules`를 순수 원본으로 로드하며, `computePureDiff(liveItem, baseItem)` 수행 시 순수 원본과 1:1 대조한다.
   - 방어적 이중 안전망: `liveItem.linkedScheduleIds`가 1개 이상 존재할 경우, 마스터의 상태와 무관하게 무조건 `sourceOverrides`에 차분으로 보존한다.

5. **프로덕션 경로 일치성 (Production Parity) 강제**:
   - 단위 테스트(`tests/data-hub/pure-raw-master.test.js`)는 임시 캐시 디렉터리가 아닌 실제 프로덕션 엔트리포인트 파일(`docs/api/v1/master-schedules.json`)을 직접 검증한다.

---

## 4. 기대 효과 및 불변 제약 (Consequences & Invariants)

- **기대 효과**:
  - 마스터 오염으로 인한 Ops 포털 연관 일정 링크 증발 버그 원천 박멸.
  - 마스터와 오버라이드의 역할 분리가 명확해져 유지보수성 및 안정성 극대화.
- **불변 제약 (Invariants)**:
  - 프로덕션 `docs/api/v1/master-schedules.json` 내 `linkedScheduleIds` 및 `isDeleted`는 영구히 0건이어야 한다.
  - CI 파이프라인(`tests/run-all.js`)에서 `pure-raw-master.test.js`가 단 1건이라도 실패할 경우 빌드 및 배포를 즉각 중단(Exit 1)한다.
