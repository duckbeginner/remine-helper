// tests/docs/ops-tool.test.js
// 운영자 도구 (docs/ops-m7k2x9.html) 무결성 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPS_FILE = path.resolve(__dirname, '../../docs/ops-m7k2x9.html');

export async function run() {
  const runner = new TestRunner('Docs - Ops Management Tool');
  runner.run();

  runner.test('ops-m7k2x9.html: 파일 실존성 및 필수 연동 키워드 검증', () => {
    assert(fs.existsSync(OPS_FILE), '운영자 페이지 docs/ops-m7k2x9.html이 존재해야 합니다.');
    const content = fs.readFileSync(OPS_FILE, 'utf8');

    assert(content.includes('Gist') || content.includes('gist'), 'Gist 동기화 로직이 포함되어야 합니다.');
    assert(content.includes('schedule-overrides.json'), '오버라이드 파일명이 명시되어야 합니다.');
    assert(content.includes('sourceOverrides') || content.includes('customItems') || content.includes('customSchedules'), 'v2/v1 스케줄 수정 구조가 포함되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-tool.test.js')) {
  run();
}
