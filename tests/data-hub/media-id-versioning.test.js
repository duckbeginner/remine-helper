// tests/data-hub/media-id-versioning.test.js
// 미디어 콘텐츠 ID 단일화(mediaIds), 분 단위 타임스탬프 최적화 및 v1.0.6 버전별 스케줄 분리 검증 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';
import {
  parseMediaId,
  parseMediaIds,
  formatMediaUrl,
  formatMinuteIso
} from '../../scripts/data-hub/tools/rebuild-pipeline.js';
import { cleanTextUrls } from '../../scripts/data-hub/utils/url-cleaner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const REBUILD_DIR = path.join(ROOT_DIR, '.cache/rebuild');

export async function run() {
  const runner = new TestRunner('Data Hub - 미디어 ID 단일화(mediaIds) 및 v1.0.6 분 단위 스케줄 분리 검증');
  runner.run();

  // 1. parseMediaId 단위 테스트
  runner.test('parseMediaId: YouTube 다양한 URL에서 ID 및 타임스탬프 정확 추출', () => {
    assert.strictEqual(parseMediaId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'yt:dQw4w9WgXcQ');
    assert.strictEqual(parseMediaId('https://youtu.be/dQw4w9WgXcQ'), 'yt:dQw4w9WgXcQ');
    assert.strictEqual(parseMediaId('https://www.youtube.com/shorts/e2hvPz7R1YQ'), 'yt:e2hvPz7R1YQ');
    assert.strictEqual(parseMediaId('https://www.youtube.com/live/UAVL6qhNeG4'), 'yt:UAVL6qhNeG4');
    assert.strictEqual(parseMediaId('https://youtu.be/dQw4w9WgXcQ?t=120s'), 'yt:dQw4w9WgXcQ?t=120s');
    assert.strictEqual(parseMediaId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=45'), 'yt:dQw4w9WgXcQ?t=45');
    assert.strictEqual(parseMediaId('yt:dQw4w9WgXcQ'), 'yt:dQw4w9WgXcQ');
  });

  runner.test('parseMediaId: Instagram 포스트 및 릴스 shortcode 추출', () => {
    assert.strictEqual(parseMediaId('https://www.instagram.com/p/DcyH0jMH0c1/'), 'ig:DcyH0jMH0c1');
    assert.strictEqual(parseMediaId('https://www.instagram.com/reel/DEuEBZoz11d/'), 'ig:DEuEBZoz11d');
    assert.strictEqual(parseMediaId('ig:DcyH0jMH0c1'), 'ig:DcyH0jMH0c1');
  });

  runner.test('parseMediaId: X / Twitter 트윗 ID 추출', () => {
    assert.strictEqual(parseMediaId('https://x.com/rescene_official/status/183624021234567890'), 'x:183624021234567890');
    assert.strictEqual(parseMediaId('https://twitter.com/Makestarcorp/status/1875784296189063181'), 'x:1875784296189063181');
    assert.strictEqual(parseMediaId('x:183624021234567890'), 'x:183624021234567890');
  });

  runner.test('parseMediaId: 일반 웹사이트 및 SNS 프로필 계정은 null 반환', () => {
    assert.strictEqual(parseMediaId('https://programs.sbs.co.kr/radio/ten/main'), null);
    assert.strictEqual(parseMediaId('https://mudfestival.or.kr'), null);
    assert.strictEqual(parseMediaId('https://www.instagram.com/apec_memorialfesta_2026/'), null);
    assert.strictEqual(parseMediaId('https://x.com/rescene_official'), null);
    assert.strictEqual(parseMediaId('https://www.youtube.com/@rescene_official'), null);
    assert.strictEqual(parseMediaId(''), null);
    assert.strictEqual(parseMediaId(null), null);
  });

  // 2. parseMediaIds 단위 테스트 (다중화 지원)
  runner.test('parseMediaIds: 단일 또는 복수 URL/미디어ID에서 중복 없는 mediaIds 배열 생성', () => {
    assert.deepStrictEqual(parseMediaIds('https://youtu.be/dQw4w9WgXcQ'), ['yt:dQw4w9WgXcQ']);
    assert.deepStrictEqual(
      parseMediaIds(['https://youtu.be/dQw4w9WgXcQ', 'ig:DcyH0jMH0c1', 'https://youtu.be/dQw4w9WgXcQ']),
      ['yt:dQw4w9WgXcQ', 'ig:DcyH0jMH0c1']
    );
    assert.deepStrictEqual(parseMediaIds('https://mudfestival.or.kr'), []);
  });

  // 3. formatMediaUrl 단위 테스트
  runner.test('formatMediaUrl: 미디어 ID에서 Canonical Full URL로 복원', () => {
    assert.strictEqual(formatMediaUrl('yt:dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.strictEqual(formatMediaUrl('yt:dQw4w9WgXcQ?t=120s'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s');
    assert.strictEqual(formatMediaUrl('ig:DcyH0jMH0c1'), 'https://www.instagram.com/p/DcyH0jMH0c1/');
    assert.strictEqual(formatMediaUrl('x:183624021234567890'), 'https://x.com/i/status/183624021234567890');
    assert.strictEqual(formatMediaUrl('https://programs.sbs.co.kr/radio/ten/main'), 'https://programs.sbs.co.kr/radio/ten/main');
  });

  // 4. formatMinuteIso 단위 테스트 (분 단위 축약 및 UTC Z 단일 표준화)
  runner.test('formatMinuteIso: 초(:ss) 및 밀리초 제거 및 UTC Z 표준 ISO 8601 포맷으로 100% 일원화', () => {
    assert.strictEqual(formatMinuteIso('2026-09-18T10:30:00.000Z'), '2026-09-18T10:30Z');
    assert.strictEqual(formatMinuteIso('2026-09-18T10:30:00Z'), '2026-09-18T10:30Z');
    assert.strictEqual(formatMinuteIso('2026-09-18T00:00:00Z'), '2026-09-18T00:00Z');
    assert.strictEqual(formatMinuteIso('2026-09-18T19:30:00+09:00'), '2026-09-18T10:30Z'); // KST 19:30 -> UTC 10:30Z
    assert.strictEqual(formatMinuteIso('2026-04-15T06:52:00-07:00'), '2026-04-15T13:52Z'); // PDT 06:52 -> UTC 13:52Z
    assert.strictEqual(formatMinuteIso('2026-09-18T10:30:45Z'), '2026-09-18T10:30Z');
    assert.strictEqual(formatMinuteIso('2025-04-07T04:11:11.000Z'), '2025-04-07T04:11Z');
    assert.strictEqual(formatMinuteIso('2026-09-18'), '2026-09-18');
    assert.strictEqual(formatMinuteIso(''), '');
  });

  // 5. message 본문 내 URL 처리 정책 단위 테스트
  runner.test('message 본문 내 URL: ID로 변환하지 않고 불필요한 트래킹 파라미터만 정제하여 보존', () => {
    const rawMessage = '공식 유튜브: https://youtu.be/dQw4w9WgXcQ?si=abcdef12345&t=30s 안내입니다.';
    const cleaned = cleanTextUrls(rawMessage);
    assert.strictEqual(cleaned, '공식 유튜브: https://youtu.be/dQw4w9WgXcQ?t=30s 안내입니다.');
  });

  const masterPath = path.join(REBUILD_DIR, 'master-schedules.json');
  const overridesPath = path.join(REBUILD_DIR, 'schedule-overrides.json');
  const v1Path = path.join(REBUILD_DIR, 'v1/schedules.json');
  const v106Path = path.join(REBUILD_DIR, 'v1.0.6/schedules.json');
  const rootSchedulesPath = path.join(REBUILD_DIR, 'schedules.json');

  runner.test('Real Data: master-schedules.json 내 모든 일정은 100% UTC Z 포맷이어야 함 (오프셋 0건, 초 잔존 0건)', () => {
    assert(fs.existsSync(masterPath), 'master-schedules.json 파일 존재');
    const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

    let nonUtcCount = 0;
    let secondsFound = 0;
    for (const item of master.items) {
      if (item.startTime) {
        if (!item.startTime.endsWith('Z')) nonUtcCount++;
        if (/:\d{2}:\d{2}/.test(item.startTime)) secondsFound++;
      }
      if (item.endTime) {
        if (!item.endTime.endsWith('Z')) nonUtcCount++;
        if (/:\d{2}:\d{2}/.test(item.endTime)) secondsFound++;
      }
    }
    assert.strictEqual(nonUtcCount, 0, `master-schedules.json의 모든 시각은 UTC Z로 끝나야 합니다. (비UTC 잔존: ${nonUtcCount}건)`);
    assert.strictEqual(secondsFound, 0, `master-schedules.json의 startTime에는 초(:ss)가 없어야 합니다. (초 잔존: ${secondsFound}건)`);
  });

  runner.test('Real Data: schedule-overrides.json 내 모든 시각도 100% UTC Z 포맷이어야 함 (오프셋 0건)', () => {
    assert(fs.existsSync(overridesPath), 'schedule-overrides.json 파일 존재');
    const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

    let nonUtcCount = 0;
    const checkItem = (item) => {
      if (!item) return;
      if (item.startTime && !item.startTime.endsWith('Z')) nonUtcCount++;
      if (item.endTime && !item.endTime.endsWith('Z')) nonUtcCount++;
    };

    Object.values(overrides.sourceOverrides || {}).forEach(checkItem);
    Object.values(overrides.customSchedules || {}).forEach(checkItem);

    assert.strictEqual(nonUtcCount, 0, `schedule-overrides.json의 모든 시각은 UTC Z로 끝나야 합니다. (비UTC 잔존: ${nonUtcCount}건)`);
  });

  runner.test('Real Data: schedule-overrides.json 내 모든 단일 콘텐츠 SNS URL은 ID(yt:, ig:, x:)로만 저장되어야 함', () => {
    assert(fs.existsSync(overridesPath), 'schedule-overrides.json 파일 존재');
    const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

    let fullSnsUrlCount = 0;
    const violations = [];

    for (const [id, ov] of Object.entries(overrides.sourceOverrides || {})) {
      if (ov.url) {
        if (/^(https?:\/\/)?(www\.)?(youtube\.com\/(?:watch|shorts|live)|youtu\.be|instagram\.com\/(?:p|reel)|(?:twitter\.com|x\.com)\/[^/]+\/status)/i.test(ov.url)) {
          fullSnsUrlCount++;
          if (violations.length < 5) violations.push({ id, url: ov.url });
        }
      }
    }

    if (violations.length > 0) {
      console.error('  ❌ 오버라이드에 Full URL로 남아있는 SNS 콘텐츠 링크 예시:', violations);
    }
    assert.strictEqual(fullSnsUrlCount, 0, `오버라이드 내 SNS 단일 콘텐츠 URL은 ID로 저장되어야 합니다. (Full URL 잔존: ${fullSnsUrlCount}건)`);
  });

  runner.test('Real Data: customSchedules의 단일 콘텐츠 SNS 링크는 ID로 저장되고 계정 프로필 URL은 Full URL로 보존되어야 함', () => {
    assert(fs.existsSync(overridesPath), 'schedule-overrides.json 파일 존재');
    const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));

    const customApec = overrides.customSchedules?.['custom_261031_18e363'];
    assert(customApec, 'custom_261031_18e363 일정 존재');
    assert.strictEqual(
      customApec.url,
      'https://www.instagram.com/apec_memorialfesta_2026/',
      '행사 공식 계정 프로필 링크는 임베드 오류 방지를 위해 Full URL로 보존되어야 함'
    );

    // 나머지 단일 콘텐츠 SNS URL은 100% ID여야 함
    let fullContentSnsCount = 0;
    for (const [id, cItem] of Object.entries(overrides.customSchedules || {})) {
      if (id === 'custom_261031_18e363') continue;
      if (cItem.url && /^(https?:\/\/)?(www\.)?(youtube\.com\/(?:watch|shorts|live)|youtu\.be|instagram\.com\/(?:p|reel)|(?:twitter\.com|x\.com)\/[^/]+\/status)/i.test(cItem.url)) {
        fullContentSnsCount++;
      }
    }
    assert.strictEqual(fullContentSnsCount, 0, `customSchedules의 단일 콘텐츠 SNS URL은 ID로 저장되어야 합니다. (Full URL 잔존: ${fullContentSnsCount}건)`);
  });

  runner.test('Real Data: schedules.json 배포본은 중복 mediaId 없이 mediaIds 단일 배열만 제공해야 함', () => {
    assert(fs.existsSync(rootSchedulesPath), 'schedules.json 파일 존재');
    const schedules = JSON.parse(fs.readFileSync(rootSchedulesPath, 'utf8'));

    let withMediaCount = 0;
    let duplicateMediaIdCount = 0;
    let invalidUrlCount = 0;

    for (const item of schedules.items) {
      // 1. url 필드가 존재하면 항상 http(s):// 시작이어야 함
      if (item.url) {
        if (!item.url.startsWith('http://') && !item.url.startsWith('https://')) {
          invalidUrlCount++;
        }
      }

      // 2. 단수형 mediaId 필드는 일체 존재하지 않아야 함 (중복 배제 피드백 반영)
      if ('mediaId' in item) {
        duplicateMediaIdCount++;
      }

      // 3. mediaIds 단일 배열 검증
      if (item.mediaIds) {
        assert(Array.isArray(item.mediaIds), `${item.id}의 mediaIds는 배열이어야 함`);
        assert(item.mediaIds.length > 0, `${item.id}의 mediaIds는 비어있지 않아야 함`);

        for (const mId of item.mediaIds) {
          assert(/^(yt|ig|x):/.test(mId), `${item.id}의 mediaId [${mId}]는 유효한 접두사를 가져야 함`);
        }
        withMediaCount++;
      }
    }

    assert.strictEqual(duplicateMediaIdCount, 0, `중복 필드 mediaId가 배포본에 0건이어야 합니다. (발견: ${duplicateMediaIdCount}건)`);
    assert.strictEqual(invalidUrlCount, 0, `모든 item.url은 Full URL이어야 합니다. (위반: ${invalidUrlCount}건)`);
    assert(withMediaCount >= 300, `미디어 ID를 보유한 일정이 300건 이상이어야 합니다. (실제: ${withMediaCount}건)`);
  });

  runner.test('Real Data: v1.0.6 배포본은 분 단위 타임스탬프(:00 초 제거)를 적용해야 함', () => {
    assert(fs.existsSync(v106Path), 'v1.0.6/schedules.json 실존해야 함');
    const v106 = JSON.parse(fs.readFileSync(v106Path, 'utf8'));

    let secondsFound = 0;
    for (const item of v106.items) {
      if (item.startTime && /:\d{2}:\d{2}/.test(item.startTime)) {
        secondsFound++;
      }
    }
    assert.strictEqual(secondsFound, 0, `v1.0.6의 startTime에는 초(:00)가 없어야 합니다. (초 잔존: ${secondsFound}건)`);
  });

  runner.test('Real Data: v1 배포본은 기존 하위 호환을 위해 초단위(:00Z)를 유지해야 함', () => {
    assert(fs.existsSync(v1Path), 'v1/schedules.json 실존해야 함');
    const v1 = JSON.parse(fs.readFileSync(v1Path, 'utf8'));

    let secondsPresent = 0;
    for (const item of v1.items) {
      if (item.startTime && /:\d{2}:\d{2}/.test(item.startTime)) {
        secondsPresent++;
      }
    }
    assert(secondsPresent > 500, `v1 배포본은 레거시 호환용 초(:00)를 유지해야 합니다. (실제: ${secondsPresent}건)`);
  });

  runner.test('Real Data: 버전별 분리 파일(v1, v1.0.6) 실존성 및 버전 메타 검증', () => {
    assert(fs.existsSync(v1Path), 'v1/schedules.json 실존해야 함');
    assert(fs.existsSync(v106Path), 'v1.0.6/schedules.json 실존해야 함');

    const v1Data = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
    const v106Data = JSON.parse(fs.readFileSync(v106Path, 'utf8'));
    const rootData = JSON.parse(fs.readFileSync(rootSchedulesPath, 'utf8'));

    assert.strictEqual(v1Data.version, '1.0.0', 'v1 배포본 버전은 1.0.0이어야 함');
    assert.strictEqual(v106Data.version, '1.0.6', 'v1.0.6 배포본 버전은 1.0.6이어야 함');
    assert.strictEqual(rootData.version, '1.0.6', 'root 배포본 버전은 1.0.6이어야 함');

    assert.strictEqual(v1Data.totalCount, v106Data.totalCount, 'v1과 v1.0.6의 일정 건수는 동일해야 함');
  });

  runner.test('Real Data: v1.0.6 및 최신 배포본은 버전 분리 원칙에 따라 extField가 완전히 배제되어야 함 (0건)', () => {
    assert(fs.existsSync(v106Path), 'v1.0.6/schedules.json 실존해야 함');
    assert(fs.existsSync(rootSchedulesPath), 'schedules.json 실존해야 함');

    const v106 = JSON.parse(fs.readFileSync(v106Path, 'utf8'));
    const root = JSON.parse(fs.readFileSync(rootSchedulesPath, 'utf8'));

    let extFieldCountV106 = 0;
    let extFieldCountRoot = 0;

    for (const item of v106.items) {
      if ('extField' in item && item.extField !== undefined) extFieldCountV106++;
    }
    for (const item of root.items) {
      if ('extField' in item && item.extField !== undefined) extFieldCountRoot++;
    }

    assert.strictEqual(extFieldCountV106, 0, `v1.0.6 배포본에 extField가 0건이어야 합니다. (잔존: ${extFieldCountV106}건)`);
    assert.strictEqual(extFieldCountRoot, 0, `root 배포본에 extField가 0건이어야 합니다. (잔존: ${extFieldCountRoot}건)`);
  });

  const summary = runner.summary();
  if (summary.failed > 0) {
    throw new Error(`[Data Hub - 미디어 ID 및 v1.0.6 버전 분리 검증] ${summary.failed}개 테스트 실패`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
