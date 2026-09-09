// tests/build/package-zip.test.js
// 배포 패키징 zip 산출물 파일 완비 및 불순물 배제 전수 검증

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');
const PUBLISH_DIR = path.join(BASE_DIR, 'publish');

export async function run() {
  const runner = new TestRunner('Build - Package Zip Output Integrity');
  runner.run();

  // 패키지 디렉토리가 없거나 파일이 없으면 1회 패키징 실행
  if (!fs.existsSync(PUBLISH_DIR) || fs.readdirSync(PUBLISH_DIR).filter(f => f.endsWith('.zip')).length === 0) {
    execSync('bash scripts/package.sh', { cwd: BASE_DIR, stdio: 'pipe' });
  }

  const manifestPath = path.join(BASE_DIR, 'remine-helper/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const currentVersion = manifest.version;

  const chromeZip = `remine-helper-chrome-v${currentVersion}.zip`;
  const firefoxZip = `remine-helper-firefox-v${currentVersion}.zip`;

  assert(fs.existsSync(path.join(PUBLISH_DIR, chromeZip)), `현재 버전 Chrome zip 파일(${chromeZip})이 존재해야 합니다.`);
  assert(fs.existsSync(path.join(PUBLISH_DIR, firefoxZip)), `현재 버전 Firefox zip 파일(${firefoxZip})이 존재해야 합니다.`);

  [chromeZip, firefoxZip].forEach(zipName => {
    const fullPath = path.join(PUBLISH_DIR, zipName);
    const listing = execSync(`unzip -l "${fullPath}"`, { encoding: 'utf8' });

    runner.test(`[${zipName}] 필수 확장 프로그램 파일 포함 검증`, () => {
      assert(listing.includes('manifest.json'), 'manifest.json 누락');
      assert(listing.includes('background.js'), 'background.js 누락');
      assert(listing.includes('sidepanel.html'), 'sidepanel.html 누락');
      assert(listing.includes('dashboard.html'), 'dashboard.html 누락');
      assert(listing.includes('constants.js'), 'constants.js 누락');
      assert(listing.includes('icons/logo128.png'), 'icons/logo128.png 누락');
    });

    runner.test(`[${zipName}] .git, .github, .DS_Store 등 불순물 배제 검증`, () => {
      assert(!listing.includes('.git/'), '.git 폴더가 포함되면 안 됩니다.');
      assert(!listing.includes('.github'), '.github 폴더가 포함되면 안 됩니다.');
      assert(!listing.includes('.DS_Store'), '.DS_Store가 포함되면 안 됩니다.');
      assert(!listing.includes('_metadata/'), '_metadata가 포함되면 안 됩니다.');
    });
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('package-zip.test.js')) {
  run();
}
