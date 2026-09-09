// tests/client/templates.test.js
// HTML 템플릿 렌더러 및 XSS 방어 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  escapeHtml,
  createVideoCardHTML,
  createLiveBannerHTML,
  getTimeAgo,
  createFanpageLinkCardHTML,
  createTabButtonHTML
} from '../../remine-helper/common/templates.js';

export async function run() {
  const runner = new TestRunner('Client - Templates & XSS Guard Module');
  runner.run();

  // 1. escapeHtml
  runner.test('escapeHtml: 악성 스크립트 및 특수 태그 이스케이프', () => {
    const malicious = '<script>alert("XSS")</script>&"\'';
    const escaped = escapeHtml(malicious);
    assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;&amp;&quot;&#39;');
    assert(!escaped.includes('<script>'));
  });

  runner.test('escapeHtml: 빈 값 및 타입 방어', () => {
    assert.strictEqual(escapeHtml(''), '');
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
  });

  // 2. createVideoCardHTML
  runner.test('createVideoCardHTML: 비디오 카드 HTML 구조 및 필수 속성 검증', () => {
    const video = {
      id: 'vid123',
      title: '리센느 뮤직비디오',
      thumbnail: 'https://img.youtube.com/vi/vid123/hqdefault.jpg',
      published: '2026-09-01T00:00:00Z',
      url: 'https://youtu.be/vid123'
    };
    const html = createVideoCardHTML(video);
    assert(html.includes('class="video-card"'));
    assert(html.includes('href="https://youtu.be/vid123"'));
    assert(html.includes('리센느 뮤직비디오'));
  });

  // 3. createLiveBannerHTML
  runner.test('createLiveBannerHTML: 라이브 스트림 배너 HTML 검증', () => {
    const html = createLiveBannerHTML();
    assert(html.includes('id="liveBanner"'));
    assert(html.includes('[LIVE] 리센느 실시간 라이브 중!'));
    assert(html.includes('class="live-pulse-dot"'));
  });

  // 4. getTimeAgo
  runner.test('getTimeAgo: 상대 시간 포맷팅 계산 및 빈 값 방어', () => {
    assert.strictEqual(getTimeAgo(''), '');
    const now = new Date();
    // 30초 전
    const recent = new Date(now.getTime() - 30 * 1000).toISOString();
    assert.strictEqual(getTimeAgo(recent), '방금 전');

    // 10분 전
    const minsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    assert.strictEqual(getTimeAgo(minsAgo), '10분 전');

    // 3시간 전
    const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(getTimeAgo(hoursAgo), '3시간 전');

    // 2일 전
    const daysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(getTimeAgo(daysAgo), '2일 전');
  });

  // 5. createFanpageLinkCardHTML
  runner.test('createFanpageLinkCardHTML: 팬페이지 링크 카드 렌더링 검증', () => {
    const fp = {
      name: '리센느 갤러리',
      url: 'https://gall.dcinside.com/rescene',
      icon: '🏛️'
    };
    const html = createFanpageLinkCardHTML(fp);
    assert(html.includes('class="fanpage-link-card"'));
    assert(html.includes('href="https://gall.dcinside.com/rescene"'));
    assert(html.includes('리센느 갤러리'));
    assert(html.includes('🏛️'));
  });

  // 6. createTabButtonHTML
  runner.test('createTabButtonHTML: 탭 버튼 마크업 및 라벨 렌더링 검증', () => {
    const tab = {
      id: 'tabHome',
      label: '홈',
      defaultActive: true
    };
    const html = createTabButtonHTML(tab);
    assert(html.includes('data-target="tabHome"'));
    assert(html.includes('active'));
    assert(html.includes('홈'));
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('templates.test.js')) {
  run();
}
