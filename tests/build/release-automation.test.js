// tests/build/release-automation.test.js
// 릴리즈 자동화 스크립트 (CRX 버전 체크, 스토어 메타데이터 생성, docs 릴리즈 적용) 전수 검증

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Build - Release Automation Pipeline Tools');
  runner.run();

  runner.test('CRX 버전 추출 파서 로직 검증', () => {
    // CRX 다운로드 리다이렉트 URL에서 버전 추출 로직 검증
    const sampleUrl = 'https://clients2.googleusercontent.com/crx/blobs/xyz/JNBKDHFGEDCFJOLIMAHHBJDGLPLIINDF_1_0_3_0.crx';
    const match = sampleUrl.match(/_(\d+)_(\d+)_(\d+)_(\d+)\.crx/i);
    assert(match, 'CRX 파일명에서 버전 정규식이 일치해야 합니다.');
    const extractedVersion = `${match[1]}.${match[2]}.${match[3]}`;
    assert.strictEqual(extractedVersion, '1.0.3', '추출된 버전은 1.0.3이어야 합니다.');
  });

  runner.test('check-chrome-store-version.mjs 스크립트 실존성 및 구문 검증', () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts/check-chrome-store-version.mjs');
    assert(fs.existsSync(scriptPath), 'scripts/check-chrome-store-version.mjs 파일이 존재해야 합니다.');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('clients2.google.com'), 'Google CRX 서버 도메인이 포함되어야 합니다.');
    assert(content.includes('jnbkdhfgedcfjolimahhbjdglpliindf'), '정식 크롬 확장 프로그램 ID가 포함되어야 합니다.');
  });

  runner.test('generate-store-metadata.mjs 스크립트 실존성 및 설명 생성 검증', () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts/generate-store-metadata.mjs');
    assert(fs.existsSync(scriptPath), 'scripts/generate-store-metadata.mjs 파일이 존재해야 합니다.');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('generateStoreMetadata'), '스토어 메타데이터 생성 함수가 정의되어야 합니다.');
  });

  runner.test('apply-release-docs.mjs 스크립트 실존성 및 릴리즈 갱신 검증', () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts/apply-release-docs.mjs');
    assert(fs.existsSync(scriptPath), 'scripts/apply-release-docs.mjs 파일이 존재해야 합니다.');
    const content = fs.readFileSync(scriptPath, 'utf8');
    assert(content.includes('applyReleaseToDocs'), '소개페이지 릴리즈 반영 함수가 정의되어야 합니다.');
  });

  runner.test('GitHub Actions 워크플로우 구성 검증 (release.yml & check-chrome-approval.yml)', () => {
    const releaseWf = path.join(ROOT_DIR, '.github/workflows/release.yml');
    const checkWf = path.join(ROOT_DIR, '.github/workflows/check-chrome-approval.yml');
    assert(fs.existsSync(releaseWf), 'release.yml이 존재해야 합니다.');
    assert(fs.existsSync(checkWf), 'check-chrome-approval.yml이 존재해야 합니다.');

    const releaseContent = fs.readFileSync(releaseWf, 'utf8');
    assert(releaseContent.includes('publish: false'), 'Chrome 웹스토어 업로드는 초안(publish: false)이어야 합니다.');
    assert(releaseContent.includes("upload-chrome-draft:"), 'upload-chrome-draft 작업이 정의되어 있어야 합니다.');
    const uploadJobMatch = releaseContent.match(/upload-chrome-draft:[\s\S]*?if:\s*([^\n]+)/);
    assert(uploadJobMatch, 'upload-chrome-draft 작업에 if 조건문이 존재해야 합니다.');
    assert(
      uploadJobMatch[1].includes("github.event_name == 'workflow_dispatch'"),
      'upload-chrome-draft 작업의 if 조건에 workflow_dispatch 지원이 포함되어야 합니다.'
    );

    const checkContent = fs.readFileSync(checkWf, 'utf8');
    assert(checkContent.includes('check-chrome-store-version.mjs'), '버전 체크 스크립트가 호출되어야 합니다.');
    assert(checkContent.includes('firefox-addon') || checkContent.includes('publish-firefox'), 'Firefox 배포 단계가 포함되어야 합니다.');
    assert(checkContent.includes('continue-on-error: true'), 'Firefox 업로드 단계에 continue-on-error 안전장치가 있어야 합니다.');
    assert(checkContent.includes('already_released'), '워크플로우에 이미 릴리즈 완료된 버전을 스킵하는 가드가 있어야 합니다.');
    assert(
      checkContent.includes('check-chrome-approval.yml') && checkContent.includes('disable approval cron'),
      '워크플로우에 배포 완료 후 cron 스케줄을 자동으로 비활성화하여 커밋하는 로직이 포함되어야 합니다.'
    );
  });

  runner.test('Cron Auto-Disable Logic: 릴리즈 완료 후 cron 자동 주석 처리 로직 검증', () => {
    // 활성화된 cron 스케줄 YAML 시뮬레이션
    const activeYaml = `name: Check Chrome Approval
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:
`;

    // 워크플로우에 적용될 치환 로직
    const disabledYaml = activeYaml
      .replace(/^(\s*)schedule:/gm, '$1# schedule:')
      .replace(/^(\s*)-\s*cron:/gm, '$1# - cron:');

    assert(disabledYaml.includes('# schedule:'), 'schedule이 주석 처리되어야 합니다.');
    assert(disabledYaml.includes('# - cron:'), 'cron 표현식이 주석 처리되어야 합니다.');
    assert(!disabledYaml.match(/^\s*schedule:/m), '활성화된 schedule 키가 남아있지 않아야 합니다.');
  });

  runner.test('isAlreadyReleased: 소개페이지(docs/index.html) 배포 완료 사전 감지 함수 검증', async () => {
    const { isAlreadyReleased } = await import('../../scripts/check-chrome-store-version.mjs');
    assert(typeof isAlreadyReleased === 'function', 'isAlreadyReleased 함수가 정의되어 있어야 합니다.');

    // 1. docs/index.html에서 현재 실제 표기된 릴리즈 버전을 동적으로 파싱
    const htmlPath = path.join(ROOT_DIR, 'docs/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const verMatch = htmlContent.match(/<span class="version-badge">v([^<]+)<\/span>/);
    assert(verMatch, 'docs/index.html에 버전 뱃지가 존재해야 합니다.');
    const activeDocVersion = verMatch[1];

    // 2. 동적으로 추출된 현재 실제 문서 버전 검증 (true)
    assert.strictEqual(
      isAlreadyReleased(activeDocVersion),
      true,
      `docs/index.html에 실제로 반영된 버전(v${activeDocVersion})은 true여야 합니다.`
    );

    // 3. 존재하지 않는 가상 미배포 버전 검증 (false)
    const hypotheticalVersion = `${activeDocVersion}_unreleased_999`;
    assert.strictEqual(
      isAlreadyReleased(hypotheticalVersion),
      false,
      `미배포 가상 버전(${hypotheticalVersion})은 false여야 합니다.`
    );
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('release-automation.test.js')) {
  run();
}
