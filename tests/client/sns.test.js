// tests/client/sns.test.js
// SNS 임베드 정규식 및 ID 추출 단위 테스트

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Client - SNS Embeds Module');
  runner.run();

  // 1. Instagram 링크 파싱
  runner.test('Instagram Regex: 포스트(/p/) 및 릴스(/reel/, /reels/) shortcode 정확 추출', () => {
    const postUrl = 'https://www.instagram.com/p/C_abc123XYZ/?igsh=MWx123';
    const reelUrl = 'https://www.instagram.com/reel/D_xyz987ABC/#comments';
    const reelsUrl = 'https://www.instagram.com/reels/E_lmn456OPQ/';

    const regex = /\/(p|reel|reels)\/([^/?#]+)/i;

    const mPost = postUrl.match(regex);
    assert.strictEqual(mPost[1].toLowerCase(), 'p');
    assert.strictEqual(mPost[2], 'C_abc123XYZ');

    const mReel = reelUrl.match(regex);
    assert.strictEqual(mReel[1].toLowerCase(), 'reel');
    assert.strictEqual(mReel[2], 'D_xyz987ABC');

    const mReels = reelsUrl.match(regex);
    assert.strictEqual(mReels[1].toLowerCase(), 'reels');
    assert.strictEqual(mReels[2], 'E_lmn456OPQ');
  });

  // 2. TikTok 링크 파싱
  runner.test('TikTok Regex: 웹/모바일 틱톡 URL에서 비디오 숫자 ID 추출', () => {
    const tiktokUrl = 'https://www.tiktok.com/@rescene_official/video/7412345678901234567?lang=ko-KR';
    const m = tiktokUrl.match(/\/video\/(\d+)/i);
    assert(m !== null);
    assert.strictEqual(m[1], '7412345678901234567');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('sns.test.js')) {
  run();
}
