// tests/data-hub/url-cleaner-and-id.test.js
// URL 정제기 및 YouTube/SNS ID 기반 경량화 TDD 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import { cleanUrl } from '../../scripts/data-hub/utils/url-cleaner.js';
import { createVideoCardHTML } from '../../remine-helper/common/templates.js';

export async function run() {
  const runner = new TestRunner('Data Hub - URL Cleaner & ID-based Normalization');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 1. cleanUrl: 추적 파라미터 제거 및 YouTube t 파라미터 보존
  // ─────────────────────────────────────────────────────────────
  runner.test('cleanUrl: utm_*, si, fbclid, igsh 등 마케팅 추적 파라미터 100% 제거', () => {
    const rawUrl1 = 'https://twitter.com/RESCENEofficial/status/12345?s=20&t=abcdef&utm_source=twitter&utm_medium=social';
    const cleaned1 = cleanUrl(rawUrl1);
    assert(!cleaned1.includes('utm_source'), 'utm_source 제거');
    assert(!cleaned1.includes('utm_medium'), 'utm_medium 제거');
    assert(cleaned1.includes('https://twitter.com/RESCENEofficial/status/12345'), '기본 URL 유지');

    const rawUrl2 = 'https://youtu.be/abcdefghijk?si=TrackingCode123&feature=shared';
    const cleaned2 = cleanUrl(rawUrl2);
    assert.strictEqual(cleaned2, 'https://youtu.be/abcdefghijk');

    const rawUrl3 = 'https://www.instagram.com/p/ABCDEFG/?igsh=InstagramShareTracking&utm_campaign=feed';
    const cleaned3 = cleanUrl(rawUrl3);
    assert.strictEqual(cleaned3, 'https://www.instagram.com/p/ABCDEFG/');
  });

  runner.test('cleanUrl: YouTube 재생 시점 타임스탬프(t, start) 파라미터 엄격 보존', () => {
    // 1) youtu.be 숏링크에서 si 제거 + t 파라미터 보존
    const ytShort = 'https://youtu.be/WAO9dDGcCsA?si=xyz123&t=1m30s';
    const cleanedYtShort = cleanUrl(ytShort);
    assert(!cleanedYtShort.includes('si='), 'si 파라미터 제거');
    assert(cleanedYtShort.includes('t=1m30s'), 't=1m30s 타임스탬프 보존');

    // 2) youtube.com 일반 링크에서 feature 제거 + t(초 단위 숫자) 보존
    const ytWatch = 'https://www.youtube.com/watch?v=WAO9dDGcCsA&feature=shared&t=95';
    const cleanedYtWatch = cleanUrl(ytWatch);
    assert(!cleanedYtWatch.includes('feature='), 'feature 파라미터 제거');
    assert(cleanedYtWatch.includes('t=95'), 't=95 타임스탬프 보존');
    assert(cleanedYtWatch.includes('v=WAO9dDGcCsA'), '비디오 파라미터 보존');

    // 3) start 파라미터 보존
    const ytEmbed = 'https://www.youtube.com/embed/WAO9dDGcCsA?start=120&si=abc';
    const cleanedYtEmbed = cleanUrl(ytEmbed);
    assert(!cleanedYtEmbed.includes('si='), 'si 제거');
    assert(cleanedYtEmbed.includes('start=120'), 'start 파라미터 보존');
  });

  runner.test('cleanUrl: 비정상/빈 URL 엣지 케이스 안전 처리', () => {
    assert.strictEqual(cleanUrl(''), '');
    assert.strictEqual(cleanUrl(null), '');
    assert.strictEqual(cleanUrl(undefined), '');
    assert.strictEqual(cleanUrl('not-a-valid-url'), 'not-a-valid-url');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Client 동적 복원: url, thumbnail 생략 시 video.id로 0.001ms 즉석 복원
  // ─────────────────────────────────────────────────────────────
  runner.test('Client templates: url과 thumbnail이 생략되어도 id 기반으로 완벽한 카드 HTML 생성', () => {
    // 고정 url과 thumbnail이 생략된 슬림 비디오 객체
    const slimVideo = {
      id: 'hXtUcbHIsOk',
      title: '테스트 영상',
      publishedAt: '2026-09-12T00:00:00Z',
      isShorts: false
    };

    const html = createVideoCardHTML(slimVideo);
    assert(html.includes('https://www.youtube.com/watch?v=hXtUcbHIsOk'), 'YouTube watch URL 동적 생성');
    assert(html.includes('https://i.ytimg.com/vi/hXtUcbHIsOk/hqdefault.jpg'), 'YouTube 썸네일 URL 동적 생성');
    assert(html.includes('테스트 영상'), '제목 렌더링 확인');

    // 쇼츠 영상인 경우 shorts URL 복원 검증
    const slimShorts = {
      id: 'shortsId123',
      title: '쇼츠 영상',
      publishedAt: '2026-09-12T00:00:00Z',
      isShorts: true
    };
    const shortsHtml = createVideoCardHTML(slimShorts);
    assert(shortsHtml.includes('https://www.youtube.com/shorts/shortsId123'), 'YouTube shorts URL 동적 생성');
    assert(shortsHtml.includes('https://i.ytimg.com/vi/shortsId123/hqdefault.jpg'), 'YouTube 썸네일 URL 동적 생성');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('url-cleaner-and-id.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
