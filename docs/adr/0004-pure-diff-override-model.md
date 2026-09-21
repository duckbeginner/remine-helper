# ADR-0004: 최소 차분(Pure Diff) 오버라이드 모델

- **상태 (Status)**: `ACCEPTED`
- **결정 일자**: 2026-09-18
- **영향 범위**: `schedule-overrides.json`, Ops 포털 저장 엔진, `mergeSchedulesV2`

---

## 1. 컨텍스트 (Context)
- 관리자가 일정 1건의 제목이나 링크 하나만 수정했을 때, 해당 일정의 모든 필드(시작시간, 종료시간, 장소, 채널, 참석자 등)를 통째로 오버라이드에 덤프하면 다음과 같은 심각한 문제가 발생합니다:
  - 외부 원본 API(Blip/Mnet)에서 시간이나 장소가 공식 변경되었을 때, 오버라이드가 이전 값을 덮어써 최신 정보가 반영되지 않음.
  - `schedule-overrides.json`의 용량이 비대해져 동시성 충돌 빈도가 급증함.

## 2. 최종 결정 사항 (Decision)
1. **최소 차분(Pure Diff) 저장 원칙**:
   - `schedule-overrides.json`의 `sourceOverrides[id]`에는 **원본과 실제로 달라진 속성(Key)만 선별 저장**한다.
   - 예: 제목만 바뀐 경우 `{ "title": "수정된 제목" }`만 저장하고, `startTime`, `location` 등 변경되지 않은 필드는 절대 저장하지 않는다.
2. **사전 정규화 후 Diff 판정**:
   - 단순 문자열 공백, `undefined` vs `""`, 시간대 오프셋(`Z` vs `+00:00`) 차이로 인한 허위 차분(False Positive)을 방지하기 위해, 비교 전 정규화(Normalization)를 거쳐 실제 내용 변경 여부를 엄격히 판정한다.
3. **원본 복구(Revert) 메커니즘**:
   - 수정 사항을 모두 취소할 경우 해당 키를 오버라이드에서 완전히 `delete`하여 원본 수집 데이터로 즉시 회귀할 수 있도록 보장한다.
