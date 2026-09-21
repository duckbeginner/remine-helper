# ADR-0001: 2계층 데이터 허브 아키텍처 및 Gist 1MB 제한 제약

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-08-25
- **영향 범위**: `scripts/data-hub/`, `docs/api/v1/`, GitHub Gist 배포 파이프라인

---

## 1. 컨텍스트 (Context)
- Remine Helper는 클라이언트 확장 프로그램 및 웹 사이트에 데이터를 서빙하기 위해 GitHub Gist를 무비용/초고속 CDN으로 활용합니다.
- 하지만 GitHub Gist는 단일 파일의 크기가 **1MB를 초과하면 내용이 Truncate(잘림)**되는 치명적인 플랫폼 제약이 있습니다.
- 일정 및 영상 데이터가 지속적으로 누적됨에 따라 `data.json` 단일 파일 모델은 조만간 1MB를 초과하여 전체 서비스가 마비될 위험이 있었습니다.

## 2. 최종 결정 사항 (Decision)
1. **2계층(2-Tier) 데이터 아키텍처 도입**:
   - **Tier 1 (`core.json`)**: 최근 7일 영상, 공식 공지, 당월/익월 핵심 일정만 포함하는 초경량 헤드 (최대 160KB 엄격 제한). 클라이언트가 백그라운드에서 15분마다 가볍게 폴링.
   - **Tier 2 (`schedules.json`)**: 2024년 데뷔 이후의 전체 마스터 아카이브 일정 (최대 600KB 규격 내 유지). 캘린더 전체 보기 시에만 Lazy-loading.
2. **Ops 전수 검수 아카이브 (`master-schedules.json`)**:
   - 숨김/필터링된 일정까지 포함하는 전수 데이터로, 최대 800KB 이내로 관리.
3. **불변 제약 (Invariants)**:
   - `core.json`은 절대 160KB를 넘지 않는다.
   - `schedules.json`은 1MB truncate 한계에 도달하지 않도록 600KB 이하로 슬림화 정책을 강제한다.
   - 오래된 불필요한 레거시 필드(`extField`, 중복 썸네일 URL 등)는 마스터 아카이브에서 배제한다.
