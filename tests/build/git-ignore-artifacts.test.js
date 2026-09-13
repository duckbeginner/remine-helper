// tests/build/git-ignore-artifacts.test.js
// 개발 중간 산출물(임시 스크립트, 테스트 리포트, 로그, 계획/초안 문서 등) Git 배제 정책 전수 검증

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

function isGitIgnored(relPath) {
  try {
    execSync(`git check-ignore -q "${relPath}"`, {
      cwd: ROOT_DIR,
      stdio: 'pipe'
    });
    return true;
  } catch (e) {
    // exit code 1 means NOT ignored
    return false;
  }
}

export async function run() {
  const runner = new TestRunner('Build - Git Ignore Intermediate Artifacts Policy');
  runner.run();

  runner.test('임시 및 디버그 스크립트 배제 검증', () => {
    assert(isGitIgnored('scratch/temp.js'), 'scratch/ 내부 파일은 무시되어야 합니다.');
    assert(isGitIgnored('temp/test.js'), 'temp/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('debug_test.js'), 'debug_*.js 파일은 무시되어야 합니다.');
    assert(isGitIgnored('debug_test.mjs'), 'debug_*.mjs 파일은 무시되어야 합니다.');
    assert(isGitIgnored('verify_test.js'), 'verify_*.js 파일은 무시되어야 합니다.');
    assert(isGitIgnored('verify_test.mjs'), 'verify_*.mjs 파일은 무시되어야 합니다.');
    assert(isGitIgnored('temp_sample.js'), 'temp_*.js 파일은 무시되어야 합니다.');
  });

  runner.test('테스트 리포트 및 커버리지 산출물 배제 검증', () => {
    assert(isGitIgnored('test-results/report.html'), 'test-results/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('playwright-report/index.html'), 'playwright-report/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('coverage/lcov.info'), 'coverage/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('.nyc_output/test.json'), '.nyc_output/ 디렉터리는 무시되어야 합니다.');
  });

  runner.test('로그 및 프로파일러 덤프 배제 검증', () => {
    assert(isGitIgnored('debug.log'), '*.log 파일은 무시되어야 합니다.');
    assert(isGitIgnored('npm-debug.log'), 'npm-debug.log는 무시되어야 합니다.');
    assert(isGitIgnored('memory.heapsnapshot'), '*.heapsnapshot 파일은 무시되어야 합니다.');
    assert(isGitIgnored('.tempmediaStorage/sample.png'), '.tempmediaStorage/ 디렉터리는 무시되어야 합니다.');
  });

  runner.test('계획, 초안 및 메모 문서 배제 검증', () => {
    assert(isGitIgnored('RELEASE_AUTOMATION_PLAN.md'), 'RELEASE_AUTOMATION_PLAN.md는 무시되어야 합니다.');
    assert(isGitIgnored('RELEASE_GUIDE_v1.0.4.md'), 'RELEASE_GUIDE_*.md는 무시되어야 합니다.');
    assert(isGitIgnored('TODO.md'), 'TODO*.md는 무시되어야 합니다.');
    assert(isGitIgnored('DRAFT_FEATURE.md'), 'DRAFT*.md는 무시되어야 합니다.');
    assert(isGitIgnored('NOTES.md'), 'NOTES*.md는 무시되어야 합니다.');
    assert(isGitIgnored('docs/store-assets/store_description_v1.0.5.txt'), '스토어 설명 텍스트 가이드는 무시되어야 합니다.');
  });

  runner.test('아카이브(archive) 디렉터리 일체 배제 검증', () => {
    assert(isGitIgnored('archive/docs/geombang/index.html'), 'archive/ 디렉터리 내 모든 파일은 예외 없이 무시되어야 합니다.');
    assert(isGitIgnored('archive/legacy.js'), 'archive/legacy.js는 무시되어야 합니다.');
  });

  runner.test('루트 디렉토리 임시 스크린샷 덤프 배제 검증', () => {
    assert(isGitIgnored('screenshot_01.png'), '루트의 screenshot*.png는 무시되어야 합니다.');
    assert(isGitIgnored('capture_test.png'), '루트의 capture*.png는 무시되어야 합니다.');
  });

  runner.test('빌드 및 패키징 산출물 배제 검증', () => {
    assert(isGitIgnored('build/bundle.js'), 'build/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('publish/package.zip'), 'publish/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('dist/app.js'), 'dist/ 디렉터리는 무시되어야 합니다.');
    assert(isGitIgnored('extension.zip'), '*.zip 파일은 무시되어야 합니다.');
    assert(isGitIgnored('docs/store-assets/small_promo_440x280.png'), 'docs/store-assets/는 무시되어야 합니다.');
    assert(isGitIgnored('store-assets/screenshot_01.png'), 'store-assets/는 무시되어야 합니다.');
  });

  runner.test('필수 운영 및 명세 파일은 무시되지 않음(화이트리스트) 검증', () => {
    assert(!isGitIgnored('specs/DATA_SPECIFICATION.md'), 'specs/DATA_SPECIFICATION.md는 추적되어야 합니다.');
    assert(!isGitIgnored('docs/index.html'), 'docs/index.html은 추적되어야 합니다.');
    assert(!isGitIgnored('remine-helper/manifest.json'), 'remine-helper/manifest.json은 추적되어야 합니다.');
    assert(!isGitIgnored('docs/screenshots/sidepanel_01_light.png'), 'docs/screenshots/의 이미지는 추적되어야 합니다.');
    assert(!isGitIgnored('docs/assets/banner.png'), 'docs/assets/의 이미지는 추적되어야 합니다.');
    assert(!isGitIgnored('tests/build/git-ignore-artifacts.test.js'), 'tests/build/ 테스트 코드는 무시되면 안 됩니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('git-ignore-artifacts.test.js')) {
  run();
}
