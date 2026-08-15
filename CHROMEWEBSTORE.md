# Chrome Web Store 등록 정보 (Remine Helper)

Chrome 웹 스토어 개발자 콘솔([Google Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole))에 입력할 내용입니다.

---

## 1. 기본 정보 (Store Listing)

### 확장 프로그램 이름 (Name)
```text
Remine Helper
```

### 간단한 설명 (Short Description / Summary) - 최대 132자
```text
걸그룹 리센느(RESCENE) 팬들을 위한 공식 SNS 바로가기, 스케줄 캘린더, 영상 피드 및 사이드패널 통합 헬퍼
```

### 자세한 설명 (Detailed Description)
```text
🌸 걸그룹 리센느(RESCENE) 팬들을 위한 올인원 브라우저 확장 프로그램, Remine Helper!

공식 SNS 피드, 스케줄 캘린더, 바로가기 및 영상을 브라우저 사이드패널과 대시보드에서 가장 빠르고 편리하게 확인하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 주요 기능 (Key Features)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 1. 스마트 스케줄 캘린더 & 타임라인
• 캘린더 뷰 & 리스트 뷰로 음악방송, 팬사인회, 행사 등 모든 일정 한눈에 확인
• '오늘' 및 '지금' 빠른 이동 버튼으로 현재 시간대 스케줄 즉시 확인
• 방송/행사에 참석하는 출연 멤버(원이, 리브, 미나미, 메이, 제나) 프로필 뱃지 표시

📱 2. 공식 SNS & 팬 커뮤니티 통합
• YouTube, X(Twitter), Instagram, TikTok, Mnet Plus, Blip, 네이버 클립, b.stage 등 공식 피드 바로가기
• 사이드패널과 대시보드에서 최신 숏폼 영상 및 공식 포스트 바로 확인

🖥️ 3. 유연한 화면 모드
• 사이드패널(Side Panel) 모드: 웹 서핑을 하면서 우측 창에서 가볍게 확인
• 대시보드(Dashboard) 모드: 넓은 전체 화면으로 한눈에 모아보기

⚙️ 4. 강력한 커스터마이징 & 편의 기능
• 다크 모드 & 라이트 모드 글래스모피즘(Glassmorphism) 테마 지원
• 탭 및 바로가기 드래그 앤 드롭(Drag & Drop) 순서 변경
• 영상 자동 일시정지(다른 탭 이동 시 자동 정지) 및 음소거 설정
• 알림 On/Off 및 자동 새로고침 주기 설정

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 v1.0.2 업데이트 내역 (What's New)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 통합 설정 모달 추가 (알림, 테마, 사이드바 위치, 탭 순서 한곳에서 관리)
• 상단 탭 & 바로가기 마우스 드래그 앤 드롭 순서 변경 지원
• 스케줄 캘린더 '오늘' 및 목록 '지금' 시간대 빠른 점프 버튼 추가
• 스케줄 카드에 참석 멤버 프로필 사진 뱃지 표시
• 영상 탭 전환 시 자동 일시정지 및 백그라운드 리소스 최적화
• 다크/라이트 모드 글래스 스타일 및 고해상도 벡터 아이콘 시인성 개선

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 안내 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 본 확장 프로그램은 리센느(RESCENE) 팬들을 위해 제작된 비공식 팬메이드 편의 도구입니다.
• 공식 소개 페이지: https://duckbeginner.github.io/remine-helper/
• 문의 및 피드백: GitHub 저장소 이슈 또는 개발자 이메일
```

---

## 2. 버전별 변경사항 (What's New in this Version - v1.0.2)

Chrome Web Store 대시보드의 **버전 정보 / 출시 노트(Release Notes)** 란에 입력할 내용:

```text
[v1.0.2 업데이트 안내]
- 통합 설정 창(모달) 추가: 알림, 사이드바 위치, 자동 새로고침, 탭 순서를 한곳에서 설정 가능
- 드래그 앤 드롭 지원: 자주 보는 탭과 바로가기 순서를 자유롭게 배치
- 캘린더 빠른 이동: '오늘' 날짜 및 '지금' 시간대로 즉시 이동하는 버튼 추가
- 멤버 뱃지: 스케줄 카드에 출연 멤버(원이, 리브, 미나미, 메이, 제나) 프로필 뱃지 표시
- 영상 자동 일시정지 및 확장 프로그램 초기 로딩 성능 최적화
- 다크/라이트 테마 글래스모피즘 디자인 및 벡터 아이콘 시인성 개선
```

---

## 3. 권한 정당성 (Permission Justifications)

Chrome Web Store **개인정보 보호(Privacy)** 탭에서 각 권한의 사용 목적을 물어볼 때 입력할 영문/한글 설명:

### 1) `storage`
- **한글**: 사용자의 테마 설정(다크/라이트), 탭 순서, 알림 On/Off 설정 값을 로컬에 저장하기 위해 사용합니다.
- **영문**: Used to store user preferences locally, including dark/light theme, tab order, and notification settings.

### 2) `sidePanel`
- **한글**: 사용자가 브라우징 중 사이드바에서 리센느의 스케줄 및 SNS 피드를 편리하게 볼 수 있도록 사이드패널 UI를 제공합니다.
- **영문**: Used to display the extension UI (schedules, feeds, shortcuts) inside Chrome's side panel.

### 3) `tabs`
- **한글**: 공식 SNS 링크나 팬 커뮤니티 페이지 클릭 시 새 브라우저 탭으로 안전하게 열기 위해 사용합니다.
- **영문**: Used to open official social media and community links in new browser tabs.

### 4) `alarms`
- **한글**: 공식 일정 및 최신 피드를 주기적으로 백그라운드에서 동기화하기 위해 사용합니다.
- **영문**: Used to periodically check and sync official schedule and feed updates in the background.

### 5) `notifications`
- **한글**: 새로운 스케줄이나 공식 공지가 등록되었을 때 브라우저 알림을 표시하기 위해 사용합니다.
- **영문**: Used to deliver browser notifications when new schedules or official announcements are published.

### 6) `declarativeNetRequest`
- **한글**: 공식 SNS(유튜브, 인스타그램, 틱톡, 엠넷플러스 등)의 임베드 피드 및 영상을 사이드패널 내에서 안전하게 표시하기 위해 사용합니다.
- **영문**: Used to safely load official social media feeds and embed widgets within the extension views.
