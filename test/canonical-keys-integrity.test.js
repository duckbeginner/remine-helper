import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateScheduleId,
  getCanonicalScheduleId,
  slimScheduleItem,
  formatMediaUrl,
  extractMediaIdentifier
} from '../scripts/data-hub/collectors/schedule.js';

describe('Canonical Keys & Media URL Integrity Test', () => {
  describe('1. Schedule ID Canonical Format Enforcement by Source', () => {
    it('출처(source)가 mnet이면 ID 형태(hex, 숫자, 영문 등)와 무관하게 반드시 mnet_ 접두사가 부여되어야 한다', () => {
      // 24자리 hex 케이스
      const hexItem = { id: '682e02bd6517824a134411c0', title: '팬사인회', source: 'mnet' };
      assert.equal(getCanonicalScheduleId('mnet', hexItem), 'mnet_682e02bd6517824a134411c0');
      assert.equal(generateScheduleId('mnet', hexItem), 'mnet_682e02bd6517824a134411c0');

      // 일반 숫자/문자열 ID 케이스 (hex가 아님)
      const numItem = { id: '998877', title: '음악방송', source: 'mnet' };
      assert.equal(getCanonicalScheduleId('mnet', numItem), 'mnet_998877');
      assert.equal(generateScheduleId('mnet', numItem), 'mnet_998877');

      // eventId 필드로 들어오는 케이스
      const eventItem = { eventId: 'event_abc_123', title: '스페셜 스테이지' };
      assert.equal(generateScheduleId('mnet', eventItem), 'mnet_event_abc_123');
    });

    it('출처(source)가 blip이면 scheduleId 또는 id에 blip_ 접두사가 올바르게 부여되어야 한다', () => {
      const blipItem = { scheduleId: 1116119, title: '팝업스토어', source: 'blip' };
      assert.equal(generateScheduleId('blip', blipItem), 'blip_1116119');
      assert.equal(getCanonicalScheduleId('blip', blipItem), 'blip_1116119');

      const blipRawIdItem = { id: '1116119', title: '팝업스토어', source: 'blip' };
      assert.equal(generateScheduleId('blip', blipRawIdItem), 'blip_1116119');
      assert.equal(getCanonicalScheduleId('blip', blipRawIdItem), 'blip_1116119');
    });

    it('출처(source)가 youtube이면 videoId 또는 id에 yt_ 접두사가 올바르게 부여되어야 한다', () => {
      const ytItem = { videoId: '8T0J9NrvxYs', title: '쇼케이스', source: 'youtube' };
      assert.equal(generateScheduleId('youtube', ytItem), 'yt_8T0J9NrvxYs');
      assert.equal(getCanonicalScheduleId('youtube', ytItem), 'yt_8T0J9NrvxYs');
    });

    it('이미 출처 접두사가 부여된 ID(blip_, mnet_, custom_, yt_)는 중복 없이 그대로 유지되어야 한다', () => {
      assert.equal(getCanonicalScheduleId('blip', { id: 'blip_1116119' }), 'blip_1116119');
      assert.equal(getCanonicalScheduleId('mnet', { id: 'mnet_682e02bd6517824a134411c0' }), 'mnet_682e02bd6517824a134411c0');
      assert.equal(getCanonicalScheduleId('mnet', { id: 'mnet_998877' }), 'mnet_998877');
      assert.equal(getCanonicalScheduleId('custom', { id: 'custom_240326_8tiybf' }), 'custom_240326_8tiybf');
      assert.equal(getCanonicalScheduleId('youtube', { id: 'yt_8T0J9NrvxYs' }), 'yt_8T0J9NrvxYs');
    });
  });

  describe('2. Media URL Formatting & mediaIds Generation', () => {
    it('formatMediaUrl은 미디어 ID(yt:, x:, ig:)를 완벽한 Full URL로 복원해야 한다', () => {
      assert.equal(formatMediaUrl('yt:8T0J9NrvxYs'), 'https://www.youtube.com/watch?v=8T0J9NrvxYs');
      assert.equal(formatMediaUrl('yt:uuqvKCPYvvE?t=4771'), 'https://www.youtube.com/watch?v=uuqvKCPYvvE&t=4771');
      assert.equal(formatMediaUrl('x:2096843493100708320'), 'https://x.com/i/status/2096843493100708320');
      assert.equal(formatMediaUrl('ig:DJI7pooRaRP'), 'https://www.instagram.com/p/DJI7pooRaRP/');
      assert.equal(formatMediaUrl('https://blip.kr/schedule/1116119'), 'https://blip.kr/schedule/1116119');
    });

    it('slimScheduleItem은 url에 미디어 ID가 들어있어도 Full URL로 복원하고 mediaIds 배열을 생성해야 한다', () => {
      const rawItem = {
        id: 'custom_240326_8tiybf',
        title: 'RESCENE DEBUT SHOWCASE',
        startTime: '2024-03-25T15:00Z',
        url: 'yt:8T0J9NrvxYs'
      };

      const slim = slimScheduleItem(rawItem);
      assert.equal(slim.url, 'https://www.youtube.com/watch?v=8T0J9NrvxYs', 'url must be full url');
      assert.ok(Array.isArray(slim.mediaIds), 'mediaIds must be an array');
      assert.deepEqual(slim.mediaIds, ['yt:8T0J9NrvxYs'], 'mediaIds must contain yt identifier');
    });

    it('message 본문에만 트위터 링크가 있는 경우 extractMediaIdentifier가 정상 추출해야 한다', () => {
      const msg = '📅 9/15(화) ~ 9/23(수)\n📍 더현대 서울\nhttps://x.com/Withmuu_twt/status/2096843493100708320';
      const mediaId = extractMediaIdentifier(msg);
      assert.equal(mediaId, 'x:2096843493100708320');
    });
  });

  describe('3. linkedScheduleIds Canonical Key Integrity & No Orphan Rules', () => {
    it('linkedScheduleIds 내에는 오직 표준 Canonical ID만 보존되고 비표준 키는 원천 배제되어야 한다', () => {
      const rawItem = {
        id: 'custom_260721_88df20',
        title: '테스트',
        startTime: '2026-07-21T00:00Z',
        linkedScheduleIds: ['mnet_6a3c8eb65493961cbe898c9e', 'mnet_682e02bd6517824a134411c0', 'invalid_key_without_prefix']
      };

      const slim = slimScheduleItem(rawItem);
      assert.ok(slim.linkedScheduleIds.includes('mnet_6a3c8eb65493961cbe898c9e'));
      assert.ok(slim.linkedScheduleIds.includes('mnet_682e02bd6517824a134411c0'));
      assert.ok(!slim.linkedScheduleIds.includes('invalid_key_without_prefix'));
    });

    it('linkedScheduleIds 내의 비표준 가상 해시 키(mod_*)나 레거시 키는 정제되어야 한다', () => {
      const rawItem = {
        id: 'blip_1116119',
        title: '팝업',
        startTime: '2026-09-14T15:00Z',
        linkedScheduleIds: ['mod_db9f1f5d', 'mod_09511a70', 'blip_1116951']
      };

      const slim = slimScheduleItem(rawItem);
      assert.ok(!slim.linkedScheduleIds.includes('mod_db9f1f5d'), 'mod_ keys must not remain');
      assert.ok(!slim.linkedScheduleIds.includes('mod_09511a70'), 'mod_ keys must not remain');
      assert.ok(slim.linkedScheduleIds.includes('blip_1116951'), 'valid canonical keys must remain');
    });
  });

  describe('4. Pipeline Output Transformation Integrity Assertion', () => {
    it('slimScheduleItem 변환기는 모든 수집 항목을 100% Canonical ID, Full URL, mediaIds, 정규화된 linkedScheduleIds로 변환해야 한다', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const masterFile = path.resolve('docs/api/v1/master-schedules.json');
      if (!fs.existsSync(masterFile)) return;

      const data = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
      const rawItems = data.items || data;

      // 마스터 파일의 모든 항목을 slimScheduleItem 변환기에 통과시켜 검증
      const processedItems = rawItems.map(item => slimScheduleItem(item));

      processedItems.forEach(item => {
        assert.ok(
          /^(blip_|mnet_|yt_|custom_)/.test(item.id),
          `Item ID must be canonical: ${item.id}`
        );

        if (item.url) {
          assert.ok(
            item.url.startsWith('http://') || item.url.startsWith('https://'),
            `Item url must be full http/https: ${item.url}`
          );
          assert.ok(
            !item.url.startsWith('yt:') && !item.url.startsWith('x:') && !item.url.startsWith('ig:'),
            `Item url must not be short media id: ${item.url}`
          );
        }

        if (item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be') || item.url.includes('instagram.com/p/') || item.url.includes('instagram.com/reel/') || item.url.includes('x.com') || item.url.includes('twitter.com'))) {
          assert.ok(
            Array.isArray(item.mediaIds) && item.mediaIds.length > 0,
            `Item with media URL must have mediaIds array: ${item.id} (${item.url})`
          );
        }

        if (Array.isArray(item.linkedScheduleIds)) {
          item.linkedScheduleIds.forEach(targetId => {
            assert.ok(
              /^(blip_|mnet_|yt_|custom_)/.test(targetId),
              `Linked target ID must be canonical: ${targetId} (in ${item.id})`
            );
          });
        }
      });
    });
  });
});
