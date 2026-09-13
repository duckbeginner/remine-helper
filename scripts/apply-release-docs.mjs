// scripts/apply-release-docs.mjs
// 크롬 승인 감지 즉시 소개페이지(docs/index.html) 및 테스트를 릴리즈 버전으로 자동 갱신하는 모듈

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_INDEX_PATH = path.join(ROOT_DIR, 'docs/index.html');
const PAGES_TEST_PATH = path.join(ROOT_DIR, 'tests/docs/pages.test.js');

export function applyReleaseToDocs(targetVersion = '1.0.5') {
  if (!fs.existsSync(DOCS_INDEX_PATH)) {
    throw new Error(`docs/index.html not found at ${DOCS_INDEX_PATH}`);
  }

  let html = fs.readFileSync(DOCS_INDEX_PATH, 'utf8');

  // 1. 네비게이션 버전 뱃지 및 메뉴 링크 갱신
  html = html.replace(/<span class="version-badge">v[^<]+<\/span>/g, `<span class="version-badge">v${targetVersion}</span>`);
  html = html.replace(/<a href="#updates">v[^<]+ 업데이트<\/a>/g, `<a href="#updates">v${targetVersion} 업데이트</a>`);

  // 2. 업데이트 섹션 제목 및 버전 뱃지 갱신
  html = html.replace(/<h2 class="section-title">v[^<]+ 업데이트 내역<\/h2>/g, `<h2 class="section-title">v${targetVersion} 업데이트 내역</h2>`);
  html = html.replace(/<span class="badge-ver">v[^<]+<\/span>/g, `<span class="badge-ver">v${targetVersion}</span>`);

  // 3. 타임라인 업데이트 내역 갱신 (v1.0.5 릴리즈 항목)
  const v105Timeline = `
          <!-- Update 1: Firefox Storage & Compatibility -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">파이어폭스(Firefox) 비동기 스토리지 호환 및 안정화</h4>
              <p class="timeline-desc">
                파이어폭스 MV2 런타임 환경에서 브라우저 스토리지 데이터 접근 오류를 원천 차단하고, 초기 기동 시 자동 데이터 동기화 및 네트워크 요청 가드를 강화했습니다.
              </p>
            </div>
          </div>

          <!-- Update 2: Calendar Navigation -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">캘린더 연월 이동 및 '오늘' 빠른 복귀 지원</h4>
              <p class="timeline-desc">
                연도와 월 단위 점프 선택기로 원하는 시점의 캘린더를 바로 찾아볼 수 있으며, '오늘' 버튼으로 현재 달력으로 즉시 복귀할 수 있습니다.
              </p>
            </div>
          </div>

          <!-- Update 3: Member Avatar Badges -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">스케줄 참석 멤버 아바타 뱃지 표시</h4>
              <p class="timeline-desc">
                일정 카드에 참석하는 멤버(원이, 리브, 미나미, 메이, 제나)의 14px 미니 프로필 아바타 뱃지가 표시되어 직관적으로 출연진을 파악할 수 있습니다.
              </p>
            </div>
          </div>

          <!-- Update 4: SNS Multi-Accounts -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">공식 SNS 다중 계정 탭 & 클린 피드</h4>
              <p class="timeline-desc">
                인스타그램과 X(Twitter)에서 공식 계정과 멤버별 계정 전환 탭이 분리되어 원하는 소식을 깔끔하게 모아볼 수 있습니다.
              </p>
            </div>
          </div>

          <!-- Update 5: YouTube Shorts Player -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">유튜브 쇼츠(Shorts) 전용 플레이어 & 바로보기</h4>
              <p class="timeline-desc">
                공식 쇼츠 영상 전용 플레이어와 간편 링크를 지원하여 숏폼 영상을 쾌적하고 몰입감 있게 감상할 수 있습니다.
              </p>
            </div>
          </div>

          <!-- Update 6: Responsive Layout -->
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h4 class="timeline-title">반응형 모바일 및 소형 뷰포트 레이아웃 최적화</h4>
              <p class="timeline-desc">
                360px 이하의 좁은 사이드패널이나 작은 브라우저 창에서도 레이아웃 깨짐이나 가로 스크롤 없이 유연하게 적응합니다.
              </p>
            </div>
          </div>
`;

  // updates-timeline 내부 교체
  const timelineRegex = /<div class="updates-timeline">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/section>/;
  const replacement = `<div class="updates-timeline">${v105Timeline}        </div>\n      </div>\n    </div>\n  </section>`;

  html = html.replace(timelineRegex, replacement);
  fs.writeFileSync(DOCS_INDEX_PATH, html, 'utf8');
  console.log(`✓ docs/index.html이 v${targetVersion}으로 업데이트되었습니다.`);

  // 4. tests/docs/pages.test.js 동기화
  if (fs.existsSync(PAGES_TEST_PATH)) {
    let testContent = fs.readFileSync(PAGES_TEST_PATH, 'utf8');
    testContent = testContent.replace(/runner\.test\('v[^']+\s*Updates/g, `runner.test('v${targetVersion} Updates`);
    testContent = testContent.replace(/assert\(htmlContent\.includes\('v[^']+'\),\s*'docs\/index\.html에\s*v[^']+\s*버전/g, `assert(htmlContent.includes('v${targetVersion}'), 'docs/index.html에 v${targetVersion} 버전`);
    testContent = testContent.replace(/assert\(htmlContent\.includes\('v[^']+\s*업데이트\s*내역'\)/g, `assert(htmlContent.includes('v${targetVersion} 업데이트 내역')`);
    fs.writeFileSync(PAGES_TEST_PATH, testContent, 'utf8');
    console.log(`✓ tests/docs/pages.test.js가 v${targetVersion} 검증으로 업데이트되었습니다.`);
  }

  return true;
}

if (process.argv[1] && process.argv[1].endsWith('apply-release-docs.mjs')) {
  const version = process.argv[2] || '1.0.5';
  applyReleaseToDocs(version);
}
