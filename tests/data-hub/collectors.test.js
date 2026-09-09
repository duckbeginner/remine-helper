// tests/data-hub/collectors.test.js
// 데이터 허브 개별 수집기 단위 알고리즘 테스트

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Collectors Engine');
  runner.run();

  // 1. YouTube 수집기: XML 파싱 및 쇼츠 키워드 판별 로직
  runner.test('YouTube Collector: RSS XML 엔트리 파싱 및 엔티티 디코딩', () => {
    function decodeXml(str) {
      if (!str) return "";
      return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    const xml = `<entry>
      <yt:videoId>v_test_01</yt:videoId>
      <title>&lt;RESCENE&gt; 뮤직뱅크 비하인드</title>
      <published>2026-09-05T10:00:00+00:00</published>
    </entry>`;

    const idMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const pubMatch = xml.match(/<published>([^<]+)<\/published>/);

    assert.strictEqual(idMatch[1], 'v_test_01');
    assert.strictEqual(decodeXml(titleMatch[1]), '<RESCENE> 뮤직뱅크 비하인드');
    assert.strictEqual(pubMatch[1], '2026-09-05T10:00:00+00:00');
  });

  // 2. SNS 수집기: Instagram 피드 shortcode 및 ID 정제 로직
  runner.test('SNS Collector: Instagram 피드 shortcode 추출 및 중복 방지 키 생성', () => {
    function getInstaKey(item) {
      if (!item) return '';
      if (item.shortcode) return item.shortcode;
      const link = item.link || item.permalink || item.url || '';
      const m = link.match(/\/(?:p|reel|reels)\/([^/?#]+)/i);
      if (m) return m[1];
      return String(item.id || '');
    }

    const itemWithShortcode = { shortcode: 'ABC123xyz' };
    const itemWithUrl = { link: 'https://www.instagram.com/reel/XYZ987abc/?utm_source=ig_web' };
    const itemWithIdOnly = { id: 'insta_101' };

    assert.strictEqual(getInstaKey(itemWithShortcode), 'ABC123xyz');
    assert.strictEqual(getInstaKey(itemWithUrl), 'XYZ987abc');
    assert.strictEqual(getInstaKey(itemWithIdOnly), 'insta_101');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('collectors.test.js')) {
  run();
}
