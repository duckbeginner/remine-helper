// tests/cross/manifest.test.js
// Chrome & Firefox Manifest V3 스키마 및 버전 일치성 검증

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Cross - Manifest V3 Specs');
  runner.run();

  const chromeManifestPath = path.join(BASE_DIR, 'remine-helper/manifest.json');
  const firefoxManifestPath = path.join(BASE_DIR, 'manifests/manifest.firefox.json');

  assert(fs.existsSync(chromeManifestPath), 'Chrome manifest.json이 존재해야 합니다.');
  assert(fs.existsSync(firefoxManifestPath), 'Firefox manifest.json이 존재해야 합니다.');

  const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
  const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

  runner.test('Manifest Version: Chrome은 MV3, Firefox는 안정 호환 MV2 규격 검증', () => {
    assert.strictEqual(chromeManifest.manifest_version, 3, 'Chrome은 Manifest V3이어야 합니다.');
    assert.strictEqual(firefoxManifest.manifest_version, 2, 'Firefox는 Manifest V2이어야 합니다.');
  });

  runner.test('Version Sync: Chrome과 Firefox 매니페스트 버전 번호 완전 일치', () => {
    assert.strictEqual(chromeManifest.version, firefoxManifest.version, `버전 불일치: Chrome(${chromeManifest.version}) vs Firefox(${firefoxManifest.version})`);
  });

  runner.test('Permissions & Structure: 필수 권한(storage, alarms, notifications) 완비', () => {
    const requiredPermissions = ['storage', 'alarms', 'notifications'];
    requiredPermissions.forEach(p => {
      assert(chromeManifest.permissions.includes(p), `Chrome에 ${p} 권한이 누락되었습니다.`);
      assert(firefoxManifest.permissions.includes(p), `Firefox에 ${p} 권한이 누락되었습니다.`);
    });
  });

  runner.test('Host Permissions: YouTube 및 API 원격 도메인 CORS 허용 완비 검증', () => {
    // Chrome MV3는 host_permissions에 등록
    assert(chromeManifest.host_permissions.includes('https://*.youtube.com/*'), 'Chrome host_permissions에 YouTube 권한 누락');
    assert(chromeManifest.host_permissions.includes('https://gist.githubusercontent.com/*'), 'Chrome host_permissions에 Gist 권한 누락');
    assert(chromeManifest.host_permissions.includes('https://duckbeginner.github.io/*'), 'Chrome host_permissions에 GitHub Pages 권한 누락');

    // Firefox MV2는 permissions에 등록
    assert(firefoxManifest.permissions.includes('https://*.youtube.com/*'), 'Firefox permissions에 YouTube 권한 누락');
    assert(firefoxManifest.permissions.includes('https://gist.githubusercontent.com/*'), 'Firefox permissions에 Gist 권한 누락');
    assert(firefoxManifest.permissions.includes('https://duckbeginner.github.io/*'), 'Firefox permissions에 GitHub Pages 권한 누락');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('manifest.test.js')) {
  run();
}
