// tests/cross/browser-sync.test.js
// Chrome ↔ Firefox 확장 프로그램 소스 파일 동기화 완전 일치성 검증

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Cross - Browser Sync & Rules Integrity');
  runner.run();

  const chromeDir = path.join(BASE_DIR, 'remine-helper');
  const firefoxDir = path.join(BASE_DIR, 'remine-helper-firefox');

  // 1. 공통 소스 파일 일치성 검사 목록
  const sharedFiles = [
    'constants.js',
    'sidepanel.js',
    'sidepanel.css',
    'sidepanel.html',
    'dashboard.js',
    'dashboard.css',
    'dashboard.html',
    'background.js',
    'common/common.js',
    'common/common.css',
    'common/templates.js',
    'common/theme-preload.js',
    'common/modules/calendar.js',
    'common/modules/modals.js',
    'common/modules/storage.js',
    'common/modules/sns-embeds.js',
    'common/modules/tabs.js',
    'common/modules/theme.js',
    'common/modules/youtube.js'
  ];

  runner.test('Source Code Sync: Chrome과 Firefox 간의 공유 모듈 100% 일치 검증', () => {
    sharedFiles.forEach(relPath => {
      const cFile = path.join(chromeDir, relPath);
      const fFile = path.join(firefoxDir, relPath);

      assert(fs.existsSync(cFile), `Chrome 파일 누락: ${relPath}`);
      assert(fs.existsSync(fFile), `Firefox 파일 누락: ${relPath}`);

      const cContent = fs.readFileSync(cFile, 'utf8');
      const fContent = fs.readFileSync(fFile, 'utf8');

      assert.strictEqual(cContent, fContent, `Chrome과 Firefox의 소스 불일치 발견: ${relPath}`);
    });
  });

  // 2. Firefox 전용 rules.json 유효성 검사
  runner.test('Firefox rules.json: declarativeNetRequest 규칙 유효성', () => {
    const rulesPath = path.join(firefoxDir, 'rules.json');
    assert(fs.existsSync(rulesPath), 'Firefox rules.json이 존재해야 합니다.');

    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    assert(Array.isArray(rules), 'rules.json은 규칙 배열이어야 합니다.');
    assert(rules.length > 0, '최소 1개 이상의 DNR 규칙이 있어야 합니다.');

    rules.forEach(r => {
      assert(typeof r.id === 'number', '규칙 id는 숫자여야 합니다.');
      assert(r.condition && r.condition.urlFilter, '규칙에 urlFilter 조건이 있어야 합니다.');
      assert(r.action && r.action.type, '규칙에 action type이 있어야 합니다.');
    });
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('browser-sync.test.js')) {
  run();
}
