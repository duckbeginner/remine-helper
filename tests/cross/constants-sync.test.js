// tests/cross/constants-sync.test.js
// 클라이언트 상수 ↔ 데이터 허브 상수 상호 일치성 교차 검증

import { TestRunner, assert } from '../test-helper.js';
import * as clientConstants from '../../remine-helper/constants.js';
import * as hubConstants from '../../scripts/data-hub/constants.js';

export async function run() {
  const runner = new TestRunner('Cross - Client vs Data Hub Constants Sync');
  runner.run();

  runner.test('Official YouTube Channel: 데이터 허브 채널 ID 및 클라이언트 공식 핸들 URL 일치', () => {
    assert.strictEqual(hubConstants.OFFICIAL_CHANNEL_ID, 'UCtKtCiaWRz-d3EZn2xd1mdA');

    const clientYtUrl = clientConstants.CHANNEL_DATA_MAP?.youtube?.url;
    assert(clientYtUrl && clientYtUrl.includes('@RESCENE_official'), '클라이언트 유튜브 채널 URL이 올바른 핸들을 가리켜야 합니다.');
  });

  runner.test('Woni YouTube Channel: 원이 채널 ID 및 공식 핸들 URL 검증', () => {
    assert.strictEqual(hubConstants.WONI_CHANNEL_ID, 'UCWpY0eSJtyO-qNAPbKFRSSg');

    const clientWoniUrl = clientConstants.CHANNEL_DATA_MAP?.helloiamwoni?.url;
    assert(clientWoniUrl && clientWoniUrl.includes('@helloiamwoninicetomeetyou'), '클라이언트 원이 채널 URL이 올바른 핸들을 가리켜야 합니다.');
  });

  runner.test('Mnet & Blip Artist: Mnet / Blip 주소 연동 일관성', () => {
    assert.strictEqual(hubConstants.BLIP_ARTIST_ID, '152');

    const clientBlipUrl = clientConstants.CHANNEL_DATA_MAP?.blip?.url;
    assert(clientBlipUrl && clientBlipUrl.includes('RESCENE'), '클라이언트 블립 URL이 RESCENE 아티스트를 가리켜야 합니다.');

    const clientMnetUrl = clientConstants.CHANNEL_DATA_MAP?.mnet?.url;
    assert(clientMnetUrl && clientMnetUrl.includes('rescene-official'), '클라이언트 엠넷 URL이 rescene-official을 가리켜야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('constants-sync.test.js')) {
  run();
}
