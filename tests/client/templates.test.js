// tests/client/templates.test.js
// HTML 템플릿 렌더러 및 XSS 방어 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  escapeHtml,
  createVideoCardHTML,
  createLiveBannerHTML
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

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('templates.test.js')) {
  run();
}
