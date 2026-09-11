// tests/cross/browser-sync.test.js
// Chrome ↔ Firefox 단일 소스(Single Source) 빌드 무결성 및 매니페스트 동기화 검증

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Cross - Single Source Build & Firefox Integration');
  runner.run();

  const chromeDir = path.join(BASE_DIR, 'remine-helper');
  const firefoxManifestPath = path.join(BASE_DIR, 'manifests/manifest.firefox.json');
  const tempBuildDir = path.join(BASE_DIR, 'build/test-firefox');

  // 1. manifests/manifest.firefox.json 스키마 유효성
  runner.test('Firefox Manifest: MV2 규격 및 필수 필드 유효성', () => {
    assert(fs.existsSync(firefoxManifestPath), 'manifests/manifest.firefox.json이 존재해야 합니다.');
    const ffManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

    assert.strictEqual(ffManifest.manifest_version, 2, 'Firefox는 Manifest V2 규격이어야 합니다.');
    assert(ffManifest.name, '매니페스트 name 필드 누락');
    assert(ffManifest.version, '매니페스트 version 필드 누락');
    assert(Array.isArray(ffManifest.permissions), 'permissions는 배열이어야 합니다.');
    assert(ffManifest.browser_specific_settings?.gecko?.id, 'Firefox Gecko ID가 명시되어야 합니다.');
  });

  // 2. build-firefox.sh 단일 소스 빌드 파이프라인 무결성 검증
  runner.test('Single Source Build Pipeline: scripts/build-firefox.sh 실행 및 아티팩트 일치성', () => {
    try {
      execSync(`bash scripts/build-firefox.sh "${tempBuildDir}"`, { cwd: BASE_DIR, stdio: 'pipe' });

      assert(fs.existsSync(tempBuildDir), '임시 빌드 디렉터리가 생성되어야 합니다.');

      const builtManifestPath = path.join(tempBuildDir, 'manifest.json');
      assert(fs.existsSync(builtManifestPath), '빌드 결과물에 manifest.json이 생성되어야 합니다.');

      const builtManifest = JSON.parse(fs.readFileSync(builtManifestPath, 'utf8'));
      assert.strictEqual(builtManifest.manifest_version, 2, '빌드 결과물의 매니페스트는 Firefox MV2여야 합니다.');

      // 공통 소스 파일들이 누락 없이 완벽 복사되었는지 확인
      const keyFiles = [
        'background.js',
        'sidepanel.html',
        'sidepanel.js',
        'dashboard.html',
        'dashboard.js',
        'constants.js',
        'common/common.js',
        'common/modules/calendar.js',
        'common/modules/modals.js',
        'common/modules/storage.js'
      ];

      keyFiles.forEach(rel => {
        const srcFile = path.join(chromeDir, rel);
        const builtFile = path.join(tempBuildDir, rel);

        assert(fs.existsSync(builtFile), `빌드 결과물에 필수 파일 누락: ${rel}`);

        const srcContent = fs.readFileSync(srcFile, 'utf8');
        const builtContent = fs.readFileSync(builtFile, 'utf8');
        assert.strictEqual(srcContent, builtContent, `원본과 빌드본의 소스 내용 불일치: ${rel}`);
      });
    } finally {
      if (fs.existsSync(tempBuildDir)) {
        fs.rmSync(tempBuildDir, { recursive: true, force: true });
      }
    }
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('browser-sync.test.js')) {
  run();
}
