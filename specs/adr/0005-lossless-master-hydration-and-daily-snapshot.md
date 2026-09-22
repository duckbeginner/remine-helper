# ADR-0005: 무손실 마스터 Gist Hydration 및 데일리 풀 스냅샷 파이프라인

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-22
- **결정자 (Deciders)**: 프로젝트 아키텍트 (@duckbeginner) & AI 페어 프로그래머
- **영향 범위**: `scripts/data-hub/`, `.github/workflows/data-hub-sync.yml`, GitHub Gist, Git 저장소(`docs/api/v1/`)

---

## 1. 컨텍스트 및 문제 정의 (Context)
- ADR-0001(2계층 데이터 허브) 및 2트랙 마스터 아키텍처에 따라:
  - **GitHub Gist**: 1순위 실시간 배포 CDN이자 실시간 동적 상태 원장.
  - **`docs/api/v1/`**: 2순위 안정 정적 폴백(GitHub Pages 호스팅) 및 백업 스냅샷.
- 그러나 GitHub Actions 러너 가상머신이 매 15분마다 클론받는 Git의 낡은 파일(587건)만 읽고, Gist의 최신 마스터(1,372건)를 다시 읽어오지(Hydration) 않는 설계 간극으로 인해:
  - 러너가 587건을 읽어 604건을 생성한 뒤,
  - **Gist의 1,372건 마스터를 604건으로 덮어써버려 과거 데이터가 대량 유실되는 사고**가 발생함.
- 또한 Git 저장소의 `docs/api/v1/`는 자동 갱신되지 않고 방치되어 1순위와 2순위 간의 데이터 괴리가 고착화됨.

---

## 2. 고려된 대안들 (Alternatives Considered)
1. **대안 A: 15분 크롤러 실행 시마다 Git에 Auto-Commit & Push**
   - *장점*: Git 저장소가 항상 실시간으로 최신화됨.
   - *기각 사유*: 하루 96개의 커밋이 누적되어 Git 저장소 용량과 히스토리가 심각하게 오염됨.
2. **대안 B: 개발자 로컬 PC에서 주기적으로 수동 수집하여 Git Push**
   - *장점*: Git 커밋 빈도를 조절 가능.
   - *기각 사유*: 자동화 엔지니어링 원칙 위반, 휴먼 에러 의존, 지속 불가능.
3. **대안 C (선택): Gist-First Hydration + 매일 새벽 1회 자동 풀 스냅샷 + High-Water Mark 가드**
   - *장점*: 
     - 가상머신이 언제 켜져도 Gist의 최신 마스터(1,370여 건)를 다운로드받아 베이스로 삼으므로 데이터 쪼그라듦 방지.
     - 매일 새벽 1회(KST 04:00) 자동으로 `--full`을 돌려 Git 저장소에 하루 딱 1개의 깔끔한 데일리 스냅샷을 남김.
     - 비정상 데이터 급감 시 Gist 업로드를 차단하는 안전 가드로 2중 보호.

---

## 3. 최종 결정 사항 및 핵심 규칙 (Decision & Rules)

1. **Gist-First Hydration (수집 시작 시 최신 원장 채택)**:
   - `schedule.js`의 `loadBaseMasterSchedules`는 수집 시작 시 원격 Gist의 최신 `master-schedules.json`을 Fastly CDN 300초 캐시 무효화 쿼리(`?t=${Date.now()}`)와 함께 조회한다.
   - 단순 `length` 비교의 오염 취약성을 방지하기 위해 필수 필드(`id`, `title`, `startTime`)가 완비된 정상 레코드 건수(`validCount`)를 비교하며, 원격 유효율이 90% 이상일 때만 원격을 채택한다.
   - `getMonthsToFetch`는 한국 시각(KST, UTC + 9시간)을 기준으로 월을 계산하여 매월 말일 9시간 시차 불일치를 원천 해소한다.
   - 수집 대상 5개월을 제외한 과거/미래 비수집 기간 일정은 100% 누락 없이 누적 보존한다.
2. **Fail-Closed High-Water Mark 역행(Shrink) 방지 가드**:
   - `upload-gist.js`는 Gist 업로드 직전 원격 Gist의 기존 건수를 비동기 병렬 검사한다.
   - `master-schedules.json`은 절대 하한선(500건) 및 기존 대비 20% 급감 방지 가드를 적용한다.
   - `schedules.json` 배포본 역시 절대 하한선(400건) 및 기존 대비 20% 급감 방지 가드를 독립적으로 동일하게 적용한다.
   - 원격 마스터 상태 확인 불가(HTTP 오류/타임아웃 등) 시에도 새 마스터 건수가 안전 기준(1,000건) 미만이면 즉시 업로드를 중단(`Exit 1`)하는 **완전한 Fail-Closed** 방식을 강제한다.
3. **전용 데일리 풀 수집 & Git 스냅샷 워크플로우 분리**:
   - 15분 워크플로우 내에서 불안정한 셸 시간 계산을 하지 않고, 전용 워크플로우(`.github/workflows/data-hub-daily-snapshot.yml`)로 완전 분리한다.
   - 매일 UTC 19:10 (한국시간 새벽 04:10, `cron: '10 19 * * *'`) 네이티브 트리거로 `--full` 전체 수집을 실행하여 15분 주기 실행과의 충돌을 방지한다.
   - 두 파이프라인 모두 `concurrency: group: data-hub-pipeline`을 적용하여 동시 실행을 원천 차단한다.
   - Git 푸시 시 `PUSH_SUCCESS` 플래그 및 `git pull --rebase origin main` 재시도(최대 3회) 루프를 거치며, 3회 실패 시 명시적으로 `exit 1` 실패 처리한다.
4. **평시 15분 패스트트랙 무공해 원칙**:
   - `data-hub-sync.yml`은 순수한 15분 패스트트랙 전용으로 운영되며, Git 커밋을 일절 생성하지 않고 오직 Gist에만 실시간 스마트 업데이트한다.

---

## 4. 기대 효과 및 불변 제약 (Consequences & Invariants)

- **기대 효과**:
  - Gist 1,370여 건 풀 마스터가 604건으로 쪼그라드는 덮어쓰기 사고 원천 박멸.
  - GitHub Actions cron 딜레이나 일시 네트워크 에러 시에도 안전선(Fail-Closed)에 의해 무결성 완벽 보장.
  - Git 저장소 오염 없이 하루 1개의 깔끔한 데일리 백업 스냅샷 자동 유지.
- **불변 제약 (Invariants)**:
  - CI 러너 및 수집기는 로컬 디스크 파일만 맹신해서는 안 되며, 반드시 원격 Gist 백업과의 크기/유효성 대조를 거쳐 최대 건수의 마스터를 로드해야 한다.
  - 기존 정상 마스터 대비 20% 이상 급감한 데이터나 절대 하한선 미만의 데이터는 어떠한 경우에도 Gist에 덮어써져서는 안 된다.
