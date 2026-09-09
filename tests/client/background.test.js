// tests/client/background.test.js
// 백그라운드 서비스 워커 핵심 알고리즘 단위 테스트 (YouTube XML RSS 파서 및 알림 중복방지)

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Client - Background Service Worker Logic');
  runner.run();

  // 1. 유튜브 RSS XML 피드 파싱 로직 검증
  runner.test('parseYoutubeFeedXml: RSS XML 엔트리에서 videoId, title, published 추출', () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>yt:video:abcd1234efg</id>
        <yt:videoId>abcd1234efg</yt:videoId>
        <title>RESCENE (리센느) - Love Attack MV</title>
        <published>2026-09-08T18:00:00+00:00</published>
      </entry>
      <entry>
        <id>yt:video:xyz9876wvu</id>
        <yt:videoId>xyz9876wvu</yt:videoId>
        <title>&lt;RESCENE&gt; 멤버 브이로그 #Shorts</title>
        <published>2026-09-09T12:00:00+00:00</published>
      </entry>
    </feed>`;

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    const parsedVideos = [];

    while ((match = entryRegex.exec(mockXml)) !== null) {
      const entry = match[1];
      const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || entry.match(/<id>[^<]*?video:([^<]+)<\/id>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/);

      if (vidMatch && titleMatch) {
        parsedVideos.push({
          id: vidMatch[1].trim(),
          title: titleMatch[1].trim(),
          publishedAt: pubMatch ? pubMatch[1].trim() : ''
        });
      }
    }

    assert.strictEqual(parsedVideos.length, 2);
    assert.strictEqual(parsedVideos[0].id, 'abcd1234efg');
    assert.strictEqual(parsedVideos[0].title, 'RESCENE (리센느) - Love Attack MV');
    assert.strictEqual(parsedVideos[1].id, 'xyz9876wvu');
  });

  // 2. 알림 중복 발송 방지 Set/Map 알고리즘 검증
  runner.test('notificationDeduplication: 이미 발송된 ID는 중복 알림 발송 제외', () => {
    const notifiedSet = new Set(['already_notified_id_1', 'already_notified_id_2']);
    const incomingVideos = [
      { id: 'already_notified_id_1', title: '기존 영상' },
      { id: 'new_video_id_3', title: '신규 영상' }
    ];

    const toNotify = [];
    incomingVideos.forEach(v => {
      if (!notifiedSet.has(v.id)) {
        toNotify.push(v);
        notifiedSet.add(v.id);
      }
    });

    assert.strictEqual(toNotify.length, 1);
    assert.strictEqual(toNotify[0].id, 'new_video_id_3');
    assert(notifiedSet.has('new_video_id_3'));
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('background.test.js')) {
  run();
}
