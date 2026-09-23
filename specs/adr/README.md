# 아키텍처 결정 기록부 (Architecture Decision Records, ADR)

본 디렉터리는 **RESCENE Remine Helper** 프로젝트의 중요한 아키텍처 및 데이터 엔지니어링 결정 사항을 영구 보존하기 위한 불변 기록부입니다.

## 1. 목적 (Purpose)
- **컨텍스트 엔트로피 방지**: 대화 세션이나 개발 기간이 길어짐에 따라 발생하는 과거 설계 제약조건 및 합의 사항의 망각을 방지합니다.
- **AI 및 엔지니어 필수 참조 (SSOT)**: 새로운 기능 추가, 리팩토링, 데이터 정규화 작업 시 본 디렉터리의 ADR 문서를 최우선 기준으로 준수해야 합니다.

## 2. ADR 작성 규칙 (Conventions)
- **파일명 규칙**: `NNNN-kebab-case-title.md` (4자리 일련번호 + 영문 케밥케이스)
- **상태 정의 (Status)**:
  - `PROPOSED` (제안됨)
  - `ACCEPTED` (채택 및 적용됨)
  - `SUPERSEDED` (더 최신의 ADR에 의해 대체됨)
  - `DEPRECATED` (폐기됨)
- **기본 구조**:
  1. 제목 및 메타데이터 (날짜, 상태, 결정자)
  2. 컨텍스트 및 문제 정의 (Context)
  3. 고려된 대안들 (Alternatives Considered)
  4. 최종 결정 사항 및 핵심 규칙 (Decision & Rules)
  5. 기대 효과 및 불변 제약 (Consequences & Invariants)

## 3. ADR 색인 (Index)
| 번호 | 제목 | 상태 | 핵심 제약 요약 |
| :--- | :--- | :---: | :--- |
| **0001** | [2계층 데이터 허브 및 Gist 1MB 제한 제약](./0001-two-tier-data-hub-and-gist-limits.md) | `ACCEPTED` | core.json(초경량), schedules.json(1MB 초과 truncate 방지) |
| **0002** | [Canonical Key 네이밍 규칙 및 ID 불변 원칙](./0002-canonical-key-naming-convention.md) | `ACCEPTED` | blip_, mnet_, yt_, custom_ 고정 prefix 및 raw hex 금지 |
| **0003** | [Full URL 및 mediaIds 배열 분리 보존 원칙](./0003-url-and-mediaids-separation.md) | `ACCEPTED` | 배포본 url은 항상 Full URL 유지, 미디어 ID는 mediaIds 배열로 분리 |
| **0004** | [최소 차분(Pure Diff) 오버라이드 모델](./0004-pure-diff-override-model.md) | `ACCEPTED` | 오버라이드 시 전체 덤프 금지, 수정된 속성만 최소 저장 |
| **0005** | [무손실 마스터 Gist Hydration 및 데일리 풀 스냅샷](./0005-lossless-master-hydration-and-daily-snapshot.md) | `ACCEPTED` | Gist 마스터 우선 로드, 데일리 새벽 자동 풀 스냅샷 커밋, 건수 역행 차단 가드 |
| **0006** | [순수 원본 마스터(Pure Raw Master) 아키텍처 및 순환 오염 방지](./0006-pure-raw-master-architecture.md) | `ACCEPTED` | 마스터 내 linkedScheduleIds/isDeleted 0건 강제, 수집기/Ops 오염 피드백 루프 차단 |

