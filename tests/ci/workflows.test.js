// tests/ci/workflows.test.js
// CI/CD 워크플로우 파일 및 파이프라인 유효성 검증

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOWS_DIR = path.resolve(__dirname, '../../.github/workflows');

export async function run() {
  const runner = new TestRunner('CI/CD - GitHub Actions Workflows');
  runner.run();

  const releaseWorkflow = path.join(WORKFLOWS_DIR, 'release.yml');
  const syncWorkflow = path.join(WORKFLOWS_DIR, 'data-hub-sync.yml');

  runner.test('release.yml: 태그 릴리스 및 웹스토어 배포 워크플로우 검증', () => {
    assert(fs.existsSync(releaseWorkflow), '.github/workflows/release.yml 파일이 존재해야 합니다.');
    const content = fs.readFileSync(releaseWorkflow, 'utf8');

    assert(content.includes('name:'), '워크플로우 이름이 정의되어야 합니다.');
    assert(content.includes('tags:'), '태그 트리거가 선언되어야 합니다.');
    assert(content.includes('actions/checkout@v4'), '최신 checkout 액션(v4)이 사용되어야 합니다.');
    assert(content.includes('scripts/package.sh'), '패키징 스크립트 실행 단계가 포함되어야 합니다.');
  });

  runner.test('data-hub-sync.yml: 데이터 허브 정기 동기화 및 cron 표현식 검증', () => {
    assert(fs.existsSync(syncWorkflow), '.github/workflows/data-hub-sync.yml 파일이 존재해야 합니다.');
    const content = fs.readFileSync(syncWorkflow, 'utf8');

    assert(content.includes('schedule:'), '정기 스케줄 트리거가 선언되어야 합니다.');
    assert(content.includes('cron:'), 'cron 스케줄이 선언되어야 합니다.');
    assert(content.includes('fetch-all.js') || content.includes('fetch-data'), '데이터 수집 스크립트가 호출되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('workflows.test.js')) {
  run();
}
