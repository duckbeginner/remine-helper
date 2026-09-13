# Remine Helper v1.0.4 배포 가이드 & 스토어 심사 제출 안내서

이 문서는 Remine Helper `v1.0.4` 버전 릴리스 시, 개발자(사용자)가 **직접 수행해야 하는 작업 단계**와 **스토어 심사 제출 시 복사해서 바로 사용할 수 있는 텍스트**를 정리한 문서입니다.

---

## 📌 배포 전체 흐름 요약

1. **GitHub 태그 푸시 (`git push origin v1.0.4`)**
   - GitHub Actions 워크플로우(`release.yml`) 자동 실행
   - Chrome & Firefox 확장 프로그램 zip 빌드
   - GitHub Release `v1.0.4` 자동 생성 및 zip 파일 첨부
   - **Firefox AMO**: 패키지 자동 업로드 및 자동 서명/심사 제출 완료 (자동)
   - **Chrome Web Store**: 패키지 자동 업로드 완료 (초안 상태, 수동 심사 제출 필요)
2. **Chrome 개발자 대시보드 접속 후 최종 [심사 제출] 클릭 (수동 작업)**

---

## 🛠️ [수동 작업 1] Chrome Web Store 심사 제출 가이드

현재 GitHub Actions가 Chrome Web Store에 새 zip 패키지(`v1.0.4`)를 **자동 업로드(Draft 등록)**까지 완료하므로, 대시보드에서 검토 후 최종 제출 버튼만 클릭하시면 됩니다.

### 단계별 절차:
1. [Chrome 개발자 대시보드 (Chrome Web Store Developer Console)](https://chrome.google.com/webstore/devconsole)에 로그인합니다.
2. 등록된 항목 목록에서 **Remine Helper**를 클릭합니다.
3. 좌측 메뉴의 **[패키지]**로 이동하여:
   - 새 버전 `1.0.4`가 초안(Draft)으로 업로드되어 있는지 확인합니다.
4. 좌측 메뉴의 **[스토어 등록정보]** 또는 **[버전 설명 / 변경 사항]**으로 이동합니다:
   - 아래 [제출용 릴리스 노트] 섹션의 **국문(또는 영문) 문구를 복사하여 "이번 버전의 새로운 기능"란에 붙여넣습니다**.
5. 페이지 우측 상단의 **[심사 제출(Submit for review)]** 파란색 버튼을 클릭합니다.
   - 팝업이 뜨면 내용 확인 후 **[제출 확인]**을 누릅니다.
   - 보통 12시간~48시간 이내에 구글 측 심사가 완료되고 웹스토어에 정식 배포됩니다.

---

## 🦊 [확인 작업 2] Firefox Add-ons (AMO) 상태 확인

Firefox는 GitHub Actions를 통해 패키지 업로드 및 서명/제출이 **100% 자동 완료**됩니다. 별도의 제출 클릭 없이 상태만 확인하시면 됩니다.

1. [Mozilla Add-ons 개발자 허브 (AMO Developer Hub)](https://addons.mozilla.org/developers/)에 로그인합니다.
2. **Remine Helper**를 선택합니다.
3. 새 버전 `1.0.4`가 **"심사 대기 중(Awaiting Review)"** 또는 **"승인됨(Approved)"** 상태인지 확인합니다.

---

## 📋 복사해서 바로 사용하는 스토어 제출 문구

### 1. 스토어 "이번 버전의 새로운 기능" (Release Notes)

#### 🇰🇷 국문 (권장)
```text
[v1.0.4 업데이트 안내]

✨ 주요 업데이트 및 개선 사항
• 일정 캘린더 연월 이동 및 빠른 날짜 탐색 개선
  - 연/월 단위 점프 이동 선택기를 지원하며, 오늘 날짜로 즉시 복귀하는 '오늘' 버튼이 추가되었습니다.
• 스케줄 멤버 참석 뱃지 표시
  - 스케줄 카드에 참석 멤버 미니 아바타 뱃지가 표시되어 직관적으로 출연진을 확인할 수 있습니다.
• 공식 SNS 다중 계정 탭 및 클린 피드 제공
  - 인스타그램 및 X(Twitter) 공식/멤버 계정 전환 탭이 분리되고 타임라인 UI가 개선되었습니다.
• 유튜브 쇼츠(Shorts) 전용 플레이어 및 바로보기 개선
  - 숏폼 영상 전용 시청 환경과 간편 브라우저 바로가기를 지원합니다.
• 반응형 모바일/소형 화면 뷰포트 최적화
  - 좁은 사이드패널 및 소형 브라우저 창에서도 레이아웃 깨짐 없이 쾌적하게 이용하실 수 있습니다.
• 전반적인 앱 안정성 및 데이터 로딩 속도 성능 개선
```

#### 🌐 영문 (Web Store 설명란용)
```text
[v1.0.4 Release Notes]

✨ What's New & Improvements
• Enhanced Calendar Navigation: Added direct Year/Month selector and quick 'Today' reset button.
• Member Attendance Badges: Schedule cards now display mini avatar badges for attending members.
• Multi-Account SNS Feeds: Clean, dedicated tab navigation for official and member social accounts (Instagram & X).
• Dedicated Shorts Player: Improved viewing experience and quick-links for YouTube Shorts.
• Responsive Viewport Layout: Perfectly optimized for compact sidepanels and small windows.
• Overall performance optimizations and enhanced stability.
```

---

### 2. Chrome Web Store 등록정보 상세 설명 전문 (필요 시 전체 교체용)

```text
리센느(RESCENE) 팬덤(Remine)을 위한 올인원 브라우저 확장 프로그램 - Remine Helper

리센느의 모든 스케줄, 공식 유튜브 영상, 소셜 미디어 피드를 브라우저 사이드패널과 풀 대시보드에서 실시간으로 확인하세요!

💖 주요 기능 안내:
1. 스마트 스케줄 캘린더
   - 월간 달력 및 시간순 목록 보기 지원
   - 연/월 빠른 이동 점프 및 오늘 날짜 복귀 버튼
   - 방송/행사별 출연 멤버(원이, 리브, 미나미, 메이, 제나) 참석 미니 프로필 뱃지 표시
   - 예정된 일정 사전 데스크톱 브라우저 알림

2. 공식 유튜브 & 쇼츠(Shorts) 전용 뷰어
   - 공식 채널 최신 뮤직비디오, 비하인드, 자체 콘텐츠 실시간 연동
   - 쇼츠(Shorts) 영상 전용 플레이어 및 시청 최적화
   - 다른 탭 이동 시 자동 일시정지 지원

3. 공식 SNS 다중 계정 피드 허브
   - 공식 인스타그램, X(Twitter), 틱톡, 위버스 통합 피드
   - 공식/멤버별 분리 탭으로 깔끔한 타임라인 확인

4. 사용자 맞춤 설정 & 반응형 뷰포트
   - 다크 모드 / 라이트 모드 테마 원클릭 전환
   - 상단 탭 순서 드래그 앤 드롭 커스터마이징
   - 360px 좁은 사이드패널부터 풀 대시보드까지 완벽 대응
```

---

## 🔒 권한 사용 사유 안내 (스토어 심사팀 질문 시 대응용)

혹시 심사 중 권한 사용 사유에 대해 추가 소명을 요청받을 경우 아래 내용을 그대로 복사해 회신하시면 됩니다:

- `storage`: 사용자의 테마 설정(다크/라이트), 알림 On/Off, 커스텀 탭 순서를 로컬 브라우저에 안전하게 저장하기 위해 사용됩니다.
- `alarms`: 스케줄 데이터의 주기적 백그라운드 동기화 및 일정 임박 알림 타이머 동작에 사용됩니다.
- `notifications`: 새로운 공식 영상 업로드 및 다가오는 방송 일정을 사용자에게 브라우저 알림으로 안내하기 위해 사용됩니다.
- `sidePanel`: 사용자가 웹 서핑을 방해받지 않고 브라우저 옆 화면에서 상시 일정을 조회할 수 있도록 크롬 표준 사이드패널 인터페이스를 제공하기 위해 사용됩니다.
- `host_permissions` (`https://*.youtube.com/*`, `https://*.github.io/*`, `https://*.blip.kr/*` 등): 공식 유튜브 피드 및 GitHub Pages를 통해 배포되는 리센느 스케줄 공개 API 데이터를 수신하기 위해 사용됩니다.
