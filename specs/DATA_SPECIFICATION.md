# Remine Helper 데이터 명세 기준 (Data Specification Contract v1.0)

본 문서는 **Remine Helper**의 클라이언트(Chrome/Firefox 확장 프로그램 및 GitHub Pages 웹 앱)와 데이터 파이프라인(`scripts/data-hub/`) 간의 **공식 데이터 계약(Data Contract)**을 정의합니다.

데이터 파이프라인과 클라이언트의 개발 및 배포 주기를 독립적으로 분리하고, 스토어에 이미 배포된 구버전 클라이언트의 **하위 호환성을 100% 보장(Expand-Contract 패턴)**하는 것을 최우선 원칙으로 합니다.

---

## 1. 기본 원칙 및 하위 호환성 정책

### 1.1 하위 호환성 보장 기준 (Expand-Contract 패턴)
1. **스토어 배포 기준 (`v1.0.3`) 호환**:
   - 현재 사용자가 설치하여 사용 중인 확장 프로그램(`v1.0.3`)이 읽고 있는 필드는 절대 임의로 제거하거나 타입을 변경하지 않습니다.
2. **필드 추가 (Expand)**:
   - 신규 필드(예: `starAttendees`, 최상위 `channel`/`location`)는 자유롭게 추가할 수 있으며, 구버전 클라이언트는 모르는 필드를 무시합니다.
3. **레거시 필드 지원 중단 (Contract & Grace Period)**:
   - `extField`는 향후 폐기 예정(Deprecated)이지만, 구버전 클라이언트의 원활한 동작을 위해 **v1.x 전체 수명 주기 동안 최상위 필드와 병행하여 생성·유지**합니다.
   - 클라이언트 전수 업데이트가 확인된 후 다음 메이저 버전(v2.0)에서 최종 제거됩니다.

---

## 2. API 엔드포인트 구성

배포 베이스 URL: `https://duckbeginner.github.io/remine-helper/api/v1/`

| 파일명 | 역할 및 용도 | 갱신 주기 | 용량 예산 (Budget) |
| :--- | :--- | :---: | :---: |
| **`core.json`** | 초기 구동용 초경량 헤드 데이터 (최신 영상, 라이브 상태, X 피드, 최근 1~2개월 스케줄) | 매 20분 | **<= 120 KB** (최대 160 KB) |
| **`schedules.json`** | 마스터 스케줄 전수 아카이브 (데뷔 전부터 현재까지의 모든 스케줄) | 매 20분 | **<= 500 KB** (최대 600 KB) |

---

## 3. 스케줄 데이터 스키마 (`ScheduleItem`)

### 3.1 필드 정의 테이블

| 필드명 | 타입 | 필수 여부 | 설명 및 규격 | 예시 |
| :--- | :--- | :---: | :--- | :--- |
| **`id`** | string | **필수** | 일정 고유 식별자. Mnet, Blip, YouTube ID 등 불변 고유값. | `"blip_23485"`, `"mnet_678a1b"` |
| **`title`** | string | **필수** | 스케줄 명칭/제목 (앞뒤 공백 제거). | `"[방송] MBC 쇼! 음악중심"` |
| **`startTime`** | string | **필수** | 시작 일시 (ISO-8601, KST `+09:00` 권장). | `"2026-09-15T15:15:00+09:00"` |
| **`endTime`** | string | 선택 | 종료 일시 (ISO-8601). 미지정 시 시작 시간과 동일하게 취급. | `"2026-09-15T16:30:00+09:00"` |
| **`isAllday`** | boolean | 선택 | 종일 일정 여부 (기본값: `false`). | `false`, `true` |
| **`typeId`** | number | 선택 | 표준 카테고리 ID (1:방송, 2:릴리즈, 3:영상, 4:기념일, 5:행사, 6:팬이벤트, 7:일정). | `1` |
| **`typeText`** | string | 선택 | 한글 분류 라벨 ('방송', '행사', '공연', '영상', '팬이벤트', '기념일', '릴리즈' 등). | `"방송"` |
| **`channel`** | string | 선택 | 방송사/플랫폼 채널명 (최상위 표준 필드). | `"MBC"`, `"KBS2"`, `"SBS"` |
| **`location`** | string | 선택 | 오프라인 장소/공연장/홀 명칭 (최상위 표준 필드). | `"상암 MBC 신사옥 공개홀"` |
| **`url`** | string | 선택 | 공식 상세 페이지 또는 예매/시청 외부 링크. | `"https://..."` |
| **`thumbnail`** | string | 선택 | 대표 썸네일/포스터 이미지 URL. | `"https://..."` |
| **`source`** | string | 선택 | 데이터 출처 식별자 (`"blip"`, `"mnet"`, `"youtube"`, `"ops"`). | `"blip"` |
| **`isOfficialYoutube`** | boolean | 선택 | RESCENE 공식 유튜브 채널 직접 업로드 여부. | `true` |
| **`message`** | string | 선택 | 본문 상세 안내 (무의미한 `\n` 공백 트림 필수). | `"리센느가 출연하는 쇼! 음악중심 생방송입니다."` |
| **`starAttendees`** | array | 선택 | 참석 멤버 객체 배열 (하단 3.2 참조). | `[ { "id": "...", "name": "원이" } ]` |
| **`linkedScheduleIds`** | array | 선택 | Ops 도구 등에서 동일 이벤트로 묶은 연관 일정 ID 배열. | `["mnet_123", "blip_456"]` |
| **`extField`** | object | **권장 제외 / 하위 호환 유지** | `{ key: "채널"\|"장소", value: string }` 형태. v1.x 동안 하위 호환을 위해 최상위 필드와 동기화 유지. | `{ "key": "채널", "value": "MBC" }` |

---

### 3.2 참석 멤버 스키마 (`AttendeeItem`)

`starAttendees` 배열에 포함되는 개별 멤버 객체 규격입니다.

```json
{
  "id": "67a5924253c0ed13ba18b38a",
  "name": "리브",
  "nickname": "올리브🫒",
  "profileImg": "icons/member_liv.jpeg"
}
```

| 필드명 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :---: | :--- |
| **`name`** | string | **필수** | 실제 멤버 활동명 (`"원이"`, `"리브"`, `"미나미"`, `"메이"`, `"제나"` 중 하나). |
| **`id`** | string | 권장 | 플랫폼 고유 불변 ID (Mnet Plus 24자리 hex ObjectId 등). |
| **`nickname`** | string | 선택 | 수집 당시 플랫폼 내 닉네임. |
| **`profileImg`** | string | 선택 | 프로필 이미지 경로 또는 URL. |

---

## 4. `core.json` 최상위 구조 명세

`core.json`은 초기 확장 프로그램 팝업 및 사이드패널 오픈 시 0ms 체감 렌더링을 위한 파일입니다.

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-09-12 02:00:00 KST",
  "updatedAtTimestamp": 1789232400000,
  "youtube": {
    "isLive": false,
    "isLiveStreaming": false,
    "liveVideoInfo": null,
    "officialVideos": [ /* YouTubeVideoItem (최신 10건) */ ],
    "playlistVideos": [ /* YouTubeVideoItem (최신 10건) */ ],
    "woniVideos": [ /* YouTubeVideoItem (최신 5건) */ ]
  },
  "sns": {
    "x": [ /* SNSFeedItem (최신 10건) */ ],
    "instagram": [ /* SNSFeedItem (최신 10건) */ ]
  },
  "schedules": {
    "activeCount": 50,
    "totalMasterCount": 624,
    "masterUpdatedAt": "2026-09-12 02:00:00 KST",
    "activeItems": [ /* ScheduleItem (최근 1개월 ~ 향후 1개월 일정, 약 50건) */ ]
  }
}
```

---

## 5. `schedules.json` 최상위 구조 명세

`schedules.json`은 캘린더 전체 뷰 및 과거 히스토리 검색을 위한 전수 아카이브 파일입니다.

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-09-12 02:00:00 KST",
  "updatedAtTimestamp": 1789232400000,
  "totalCount": 624,
  "items": [
    /* ScheduleItem 전체 배열 (오름차순 정렬) */
  ]
}
```

---

## 6. 품질 및 유효성 검증 규칙 (Validation Rules)

1. **배열 무결성**:
   - `core.schedules.activeItems` 및 `schedules.items`의 모든 요소는 유효한 `id`, `title`, `startTime`을 가져야 합니다.
2. **날짜 유효성**:
   - `startTime`은 `new Date(startTime).getTime()`이 `NaN`이 아닌 유효한 날짜여야 합니다.
3. **용량 상한선**:
   - `core.json`은 160 KB를 초과할 수 없습니다. (초과 시 SNS 피드 또는 영상 슬라이스 개수 축소)
   - `schedules.json`은 600 KB를 초과할 수 없습니다. (불필요한 공백/중복 필드 제거 유지)
4. **멤버 매핑 표준**:
   - `starAttendees`의 `name`은 반드시 공인된 5인 멤버 활동명(`"원이"`, `"리브"`, `"미나미"`, `"메이"`, `"제나"`)으로 정규화되어야 합니다.
