// tests/docs/ops-user-inspector.test.js
// 마스터 537건 기준선 무결성, 클라이언트 필터 안전망 및 Ops 포털 저장 격리 검증 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');
const LOCAL_MASTER_PATH = path.join(ROOT_DIR, 'docs/api/v1/schedules.json');
const STORAGE_MODULE_PATH = path.join(ROOT_DIR, 'remine-helper/common/modules/storage.js');

export async function run() {
  const runner = new TestRunner('Ops & Client - Master Baseline & Inspector Integrity');
  runner.run();

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, 'utf8');
  const storageModule = await import(STORAGE_MODULE_PATH);
  const { filterAndDeduplicateSchedules } = storageModule;

  // ─────────────────────────────────────────────────────────────
  // 1. 마스터 스케줄 537건 기준선 무결성 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Master Baseline: 로컬/배포 마스터 데이터 파일 실존 및 537건 스케줄 보존 확인', () => {
    assert(fs.existsSync(LOCAL_MASTER_PATH), 'docs/api/v1/schedules.json이 존재해야 합니다.');
    const masterData = JSON.parse(fs.readFileSync(LOCAL_MASTER_PATH, 'utf8'));
    assert(Array.isArray(masterData.items), 'items 배열이 존재해야 합니다.');
    assert(masterData.items.length >= 500, `마스터 스케줄 항목 수가 충분해야 합니다. (현재: ${masterData.items.length})`);

    // 삼성 라이온즈 시구/공연(custom_240803_837833) 필수 보존 확인
    const lionsEvent = masterData.items.find(i => i.id === 'custom_240803_837833' || (i.title && i.title.includes('삼성 라이온즈')));
    assert(lionsEvent, '삼성 라이온즈 시구/공연 공식 일정이 마스터 데이터에 반드시 존재해야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 클라이언트 filterAndDeduplicateSchedules 안전망 및 정상 일정 보존 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Client Filter: 본문에 참고 영상/쇼츠 링크가 있어도 정상 행사가 오인 삭제되지 않음 검증', () => {
    const mockEvents = [
      {
        id: 'custom_240803_837833',
        title: '삼성 라이온즈 시구/공연',
        startTime: '2024-08-03T00:00:00+09:00',
        message: '관련 영상: https://youtu.be/e3r9TZ4WFt8, https://www.youtube.com/shorts/FOVjOMyKFPg'
      },
      {
        id: 'mock_normal_1',
        title: '인기가요 본방',
        startTime: '2026-09-20T15:30:00+09:00',
        message: '음악방송 생방송'
      },
      {
        id: 'mock_normal_1',
        title: '인기가요 본방 (중복)',
        startTime: '2026-09-20T15:30:00+09:00',
        message: '중복 아이템'
      }
    ];

    const filtered = filterAndDeduplicateSchedules(mockEvents);
    assert.strictEqual(filtered.length, 2, '중복 1건만 제거되고 삼성 라이온즈 시구/공연은 반드시 보존되어야 합니다.');
    assert(filtered.some(i => i.id === 'custom_240803_837833'), '삼성 라이온즈 시구 일정이 보존되어야 합니다.');
    assert(filtered.some(i => i.id === 'mock_normal_1'), '인기가요 일정이 보존되어야 합니다.');
  });

  runner.test('Client Filter: 빈 배열 및 비정상 입력 방어', () => {
    assert.deepStrictEqual(filterAndDeduplicateSchedules(null), []);
    assert.deepStrictEqual(filterAndDeduplicateSchedules(undefined), []);
    assert.deepStrictEqual(filterAndDeduplicateSchedules([]), []);
    assert.deepStrictEqual(filterAndDeduplicateSchedules([null, undefined]), []);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Ops 포털 Gist 저장 격리 (schedules.json / core.json 직접 덮어쓰기 배제)
  // ─────────────────────────────────────────────────────────────
  runner.test('Ops Portal Save Isolation: Gist 저장 시 schedules.json 및 core.json 직접 PATCH 배제 확인', () => {
    // onSaveToGistClick 함수 내에서 Gist files 페이로드 검사
    const saveFuncMatch = opsHtml.match(/async function onSaveToGistClick[\s\S]*?const payload = \{[\s\S]*?files:\s*\{([\s\S]*?)\}\s*\};/);
    assert(saveFuncMatch, 'onSaveToGistClick 함수 내 payload.files 선언이 존재해야 합니다.');

    const filesContent = saveFuncMatch[1];
    assert(filesContent.includes('"schedule-overrides.json"'), 'payload.files에 schedule-overrides.json이 포함되어야 합니다.');
    assert(!filesContent.includes('"schedules.json"'), 'payload.files에 사용자 배포본 schedules.json이 직접 포함되어서는 안 됩니다.');
    assert(!filesContent.includes('"core.json"'), 'payload.files에 사용자 배포본 core.json이 직접 포함되어서는 안 됩니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 확장프로그램 세부 모달 규격 100% 일치성 (듀얼 카드 & SNS 멀티미디어)
  // ─────────────────────────────────────────────────────────────
  runner.test('Detail Modal Matching: 듀얼 카드 레이아웃, 공식 SVG 아이콘, 16px 프로필 뱃지 및 SNS 멀티미디어 임베드', () => {
    // 4-1. 공식 SVG 아이콘 (일시, 장소, 채널)
    assert(opsHtml.includes('rect x="3" y="4" width="18" height="18" rx="2" ry="2"'), '일시 표시용 달력 SVG 아이콘 포함');
    assert(opsHtml.includes('path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"'), '장소 표시용 위치 핀 SVG 아이콘 포함');
    assert(opsHtml.includes('rect x="2" y="7" width="20" height="15" rx="2" ry="2"'), '채널 표시용 TV SVG 아이콘 포함');

    // 4-2. 확장 프로그램 정규 듀얼 카드 레이아웃 (.schedule-modal-card + .schedule-embed-card)
    assert(opsHtml.includes('schedule-modal-card'), '상세 정보 카드 클래스(.schedule-modal-card) 실존');
    assert(opsHtml.includes('schedule-embed-card'), '관련 미디어 카드 클래스(.schedule-embed-card) 실존');

    // 4-3. 유튜브 프리뷰 카드 및 SNS 멀티미디어(Instagram, X, TikTok) 임베드 지원 (Spotify House Seoul 인스타 릴스 등)
    assert(opsHtml.includes('youtube-preview-card'), '유튜브 썸네일/미디어 프리뷰 카드 클래스 정의');
    assert(opsHtml.includes('instagram.com'), '인스타그램 게시물 및 릴스 임베드 파서 지원');
    assert(opsHtml.includes('twitter.com') || opsHtml.includes('x.com'), 'X(트위터) 트윗 임베드 파서 지원');
    assert(opsHtml.includes('tiktok.com'), '틱톡 영상 임베드 파서 지원');

    // 4-4. 16px 참석 멤버 프로필 뱃지
    assert(opsHtml.includes('MEMBER_AVATAR_MAP'), '멤버 아바타 맵핑 포함');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 사용자 기준 사전 검수기 (Review Inspector & 단일 진입 경로 일원화)
  // ─────────────────────────────────────────────────────────────
  runner.test('Review Inspector: 하단바 단일 검수 진입 버튼, Diff 탭, 사이드패널 뷰 탭, 대조 렌더러 및 2단계 배포 버튼 검증', () => {
    // 5-1. 하단 바 단일 검수 진입 버튼 문구
    assert(opsHtml.includes('사용자 뷰 검수 및 적용'), '하단 바 버튼에 [사용자 뷰 검수 및 적용] 문구 명시');

    // 5-2. 검수기 모달 및 탭 버튼
    assert(opsHtml.includes('inspectorModalOverlay') || opsHtml.includes('userReviewModalOverlay'), '검수기 모달 오버레이 실존');
    assert(opsHtml.includes('btnInspectorTabDiff'), 'Diff 변경 내역 탭 버튼 실존');
    assert(opsHtml.includes('btnInspectorTabPreview'), '사이드패널 뷰 탭 버튼 실존');

    // 5-3. Diff 렌더러 함수
    assert(opsHtml.includes('renderInspectorDiff'), 'Diff 변경 대조표 렌더러 함수 정의');

    // 5-4. 2단계 배포 분리 버튼
    assert(opsHtml.includes('btnSaveOverridesOnly'), '오버라이드만 임시 저장 버튼 실존');
    assert(opsHtml.includes('btnPublishToUsers'), '검수 완료 및 사용자 배포 버튼 실존');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 구형 이중 팝업 제거 및 2단계 배포 액션 분리 검증 (Clean Architecture)
  // ─────────────────────────────────────────────────────────────
  runner.test('Legacy Cleanup & Action Separation: confirmModalOverlay 및 showConfirmDialog 완전 제거, 2단계 배포 옵션 분리', () => {
    // 6-1. 구형 confirmModalOverlay 마크업 부재 확인
    assert(!opsHtml.includes('id="confirmModalOverlay"'), '구형 confirmModalOverlay HTML 요소가 완전히 제거되어야 합니다.');

    // 6-2. 구형 showConfirmDialog 함수 부재 확인 (이중 팝업 원천 차단)
    assert(!opsHtml.includes('function showConfirmDialog'), '구형 showConfirmDialog 함수가 완전히 제거되어야 합니다.');
    assert(!opsHtml.includes('window.showConfirmDialog'), 'window.showConfirmDialog 전역 노출이 없어야 합니다.');

    // 6-3. onSaveToGistClick 내부에서 showConfirmDialog 호출하지 않음
    assert(!opsHtml.includes('await showConfirmDialog'), 'onSaveToGistClick 내부에서 showConfirmDialog를 호출하지 않아야 합니다.');

    // 6-4. 2단계 배포 버튼 분리 (isPublish: false vs isPublish: true)
    assert(opsHtml.includes('isPublish: false') || opsHtml.includes('publish: false'), 'btnSaveOverridesOnly는 isPublish: false 옵션을 전달해야 합니다.');
    assert(opsHtml.includes('isPublish: true') || opsHtml.includes('publish: true'), 'btnPublishToUsers는 isPublish: true 옵션을 전달해야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. 검수 모달 탭 선택 상태 시각적 구분 스타일 (.inspector-tab-btn.active)
  // ─────────────────────────────────────────────────────────────
  runner.test('Tab Active Style: 검수 모달 탭 선택 상태 시각적 구분 전용 스타일 (.inspector-tab-btn.active)', () => {
    assert(opsHtml.includes('.inspector-tab-btn'), '탭 버튼 전용 클래스 .inspector-tab-btn 정의');
    assert(opsHtml.includes('.inspector-tab-btn.active'), '탭 활성화 스타일 .inspector-tab-btn.active 정의');
    assert(opsHtml.includes('class="inspector-tab-btn active"'), '초기 HTML 마크업에 활성 탭 클래스 적용');
  });

  // ─────────────────────────────────────────────────────────────
  // 8. SNS 미디어 파서 실제 생성 실행 검증 (Spotify House Seoul 인스타 릴스 등)
  // ─────────────────────────────────────────────────────────────
  runner.test('SNS Media Parser Execution: 인스타그램 릴스, YouTube, X, TikTok 실제 HTML 임베드 생성 및 중복 방어', () => {
    // opsHtml에서 escapeHtml과 renderMediaEmbeds 추출
    const escapeFuncMatch = opsHtml.match(/function escapeHtml\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);
    const renderFuncMatch = opsHtml.match(/function renderMediaEmbeds\([^)]*\)\s*\{[\s\S]*?\n\s*return embedHtmls\.join\(''\);\s*\}/);
    assert(escapeFuncMatch, 'escapeHtml 함수 추출 가능');
    assert(renderFuncMatch, 'renderMediaEmbeds 함수 추출 가능');

    const fn = new Function(`${escapeFuncMatch[0]}; ${renderFuncMatch[0]}; return renderMediaEmbeds;`);
    const renderMediaEmbeds = fn();

    // 8-1. Spotify House Seoul 인스타 릴스
    const instaReelUrl = 'https://www.instagram.com/reel/DdBot00hKaz/?utm_source=ig_web_copy_link';
    const instaHtml = renderMediaEmbeds([instaReelUrl]);
    assert(instaHtml.includes('instagram.com/p/DdBot00hKaz/embed/captioned/'), '인스타그램 릴스 iframe embed URL이 정확히 생성되어야 합니다.');

    // 8-2. 유튜브 watch
    const ytWatchUrl = 'https://www.youtube.com/watch?v=kTe_bS6b8tE';
    const ytHtml = renderMediaEmbeds([ytWatchUrl]);
    assert(ytHtml.includes('data-video-id="kTe_bS6b8tE"'), '유튜브 비디오 ID 프리뷰 카드가 정확히 생성되어야 합니다.');

    // 8-3. X(트위터)
    const xUrl = 'https://x.com/RESCENE_twt/status/1772596956693520844';
    const xHtml = renderMediaEmbeds([xUrl]);
    assert(xHtml.includes('platform.twitter.com/embed/Tweet.html?id=1772596956693520844'), 'X(트위터) iframe embed가 정확히 생성되어야 합니다.');

    // 8-4. 틱톡
    const ttUrl = 'https://www.tiktok.com/@rescene_official/video/7350000000000000000';
    const ttHtml = renderMediaEmbeds([ttUrl]);
    assert(ttHtml.includes('tiktok.com/embed/v2/7350000000000000000'), '틱톡 iframe embed가 정확히 생성되어야 합니다.');

    // 8-5. 미디어 없는 일반 텍스트
    const emptyHtml = renderMediaEmbeds(['일반 일정 본문 내용']);
    assert.strictEqual(emptyHtml, '', '미디어 URL이 없으면 빈 문자열이어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 9. 새 일정 버튼 바인딩 & 컴팩트 타이틀바 (차트 아이콘 📊 배제 및 📝 적용)
  // ─────────────────────────────────────────────────────────────
  runner.test('New Schedule Button & Compact Titlebar: btnOpenAddModal 리스너 바인딩 및 📝 아이콘 적용 검증', () => {
    // 9-1. btnOpenAddModal 이벤트 리스너 바인딩 실존 검증
    assert(
      opsHtml.includes("document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal)") ||
      opsHtml.includes('btnOpenAddModal.addEventListener(\'click\', openAddModal)'),
      'btnOpenAddModal에 openAddModal 이벤트 리스너가 등록되어야 합니다.'
    );

    // 9-2. 차트 아이콘(📊) 배제 및 📝 아이콘 적용
    assert(!opsHtml.includes('📊 변경 내역'), '변경 내역 탭에서 차트 아이콘(📊)이 배제되어야 합니다.');
    assert(opsHtml.includes('📝') && opsHtml.includes('변경 내역'), '변경 내역 탭에 📝 아이콘이 적용되어야 합니다.');

    // 9-3. 상단 타이틀바 nowrap 적용
    assert(opsHtml.includes('white-space: nowrap') || opsHtml.includes('nowrap'), '상단 타이틀바에 줄바꿈 방지(nowrap) 스타일이 적용되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-user-inspector.test.js')) {
  run();
}
