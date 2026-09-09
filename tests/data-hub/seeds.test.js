// tests/data-hub/seeds.test.js
// 데이터 허브 오프라인 시드 파일 무결성 단위 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEEDS_DIR = path.resolve(__dirname, '../../scripts/data-hub/seeds');

export async function run() {
  const runner = new TestRunner('Data Hub - Offline Seeds Integrity');
  runner.run();

  const streamsFile = path.join(SEEDS_DIR, 'official-streams.json');
  const tiktokFile = path.join(SEEDS_DIR, 'tiktok-official.json');

  runner.test('official-streams.json: 파일 존재 및 필수 필드(id, title) 검증', () => {
    assert(fs.existsSync(streamsFile), 'official-streams.json 파일이 존재해야 합니다.');
    const streams = JSON.parse(fs.readFileSync(streamsFile, 'utf8'));
    assert(Array.isArray(streams), 'streams 데이터는 배열이어야 합니다.');
    assert(streams.length > 0, '최소 1개 이상의 시드 스트림이 있어야 합니다.');

    streams.forEach(s => {
      assert(typeof s.id === 'string' && s.id.length > 0, '스트림 id가 유효해야 합니다.');
      assert(typeof s.title === 'string' && s.title.length > 0, '스트림 title이 유효해야 합니다.');
      assert(typeof s.url === 'string' && s.url.startsWith('https://'), '스트림 url이 올바른 HTTPS여야 합니다.');
    });
  });

  runner.test('tiktok-official.json: 파일 존재 및 틱톡 비디오 ID 문자열 배열 검증', () => {
    assert(fs.existsSync(tiktokFile), 'tiktok-official.json 파일이 존재해야 합니다.');
    const feeds = JSON.parse(fs.readFileSync(tiktokFile, 'utf8'));
    assert(Array.isArray(feeds), 'feeds 데이터는 배열이어야 합니다.');
    assert(feeds.length > 0, '최소 1개 이상의 시드 비디오 ID가 있어야 합니다.');

    feeds.forEach(f => {
      const id = typeof f === 'object' ? f.id : f;
      assert(typeof id === 'string' && id.length > 0, '비디오 ID 문자열이 유효해야 합니다.');
    });
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('seeds.test.js')) {
  run();
}
