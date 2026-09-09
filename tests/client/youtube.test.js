// tests/client/youtube.test.js
// 유튜브 모듈 단위 테스트 (Shorts 동영상 자동 판별 및 풀 정렬)

import { TestRunner, assert } from '../test-helper.js';
import { extractAllShortsVideos } from '../../remine-helper/common/modules/youtube.js';

export async function run() {
  const runner = new TestRunner('Client - YouTube Module');
  runner.run();

  runner.test('extractAllShortsVideos: 해시태그, URL, isShorts 속성 기반 Shorts 식별', () => {
    const mockData = {
      latestVideos: [
        { id: 'v1', title: '정규 MV', url: 'https://youtube.com/watch?v=v1', publishedAt: '2026-09-01T00:00:00Z' },
        { id: 'v2', title: '챌린지 #shorts', url: 'https://youtube.com/watch?v=v2', publishedAt: '2026-09-02T00:00:00Z' }
      ],
      officialPlaylistVideos: [
        { id: 'v3', title: '쇼츠 영상', url: 'https://youtube.com/shorts/v3', publishedAt: '2026-09-03T00:00:00Z' }
      ],
      woniVideos: [
        { id: 'v4', title: '원이 브이로그 [Shorts]', isShorts: true, publishedAt: '2026-09-04T00:00:00Z' },
        { id: 'v2', title: '중복 챌린지 #shorts', publishedAt: '2026-09-02T00:00:00Z' } // v2 중복
      ]
    };

    const shorts = extractAllShortsVideos(mockData);

    // v2, v3, v4만 포함되어야 함 (총 3건, 중복 v2는 1건만 유지)
    assert.strictEqual(shorts.length, 3);
    const ids = shorts.map(s => s.id);
    assert(ids.includes('v2'));
    assert(ids.includes('v3'));
    assert(ids.includes('v4'));
    assert(!ids.includes('v1'));

    // 최신순 정렬 검증 (v4(4일) -> v3(3일) -> v2(2일))
    assert.strictEqual(shorts[0].id, 'v4');
    assert.strictEqual(shorts[1].id, 'v3');
    assert.strictEqual(shorts[2].id, 'v2');
  });

  runner.test('extractAllShortsVideos: 빈 데이터 입력 안전 처리', () => {
    assert.deepStrictEqual(extractAllShortsVideos({}), []);
    assert.deepStrictEqual(extractAllShortsVideos(null), []);
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('youtube.test.js')) {
  run();
}
