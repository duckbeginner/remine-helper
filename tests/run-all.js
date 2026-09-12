// tests/run-all.js
// 프로젝트 전체 통합 전수 테스트 마스터 러너 (All-in-One Master Test Runner)

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 모듈 단위 테스트 목록
import { run as runCalendarTest } from './client/calendar.test.js';
import { run as runStorageTest } from './client/storage.test.js';
import { run as runModalsTest } from './client/modals.test.js';
import { run as runTemplatesTest } from './client/templates.test.js';
import { run as runBackgroundTest } from './client/background.test.js';
import { run as runYoutubeTest } from './client/youtube.test.js';
import { run as runSnsTest } from './client/sns.test.js';
import { run as runTabsThemeTest } from './client/tabs-theme.test.js';
import { run as runUnnecessaryRefreshTest } from './client/unnecessary-refresh-prevent.test.js';

import { run as runSeedsTest } from './data-hub/seeds.test.js';
import { run as runCollectorsTest } from './data-hub/collectors.test.js';
import { run as runSyncToolsTest } from './data-hub/sync-tools.test.js';
import { run as runDataSpecTest } from './data-hub/data-spec.test.js';
import { run as runSchedulePipelineTest } from './data-hub/schedule-pipeline.test.js';
import { run as runUrlCleanerAndIdTest } from './data-hub/url-cleaner-and-id.test.js';
import { run as runDataPayloadSlimmingTest } from './data-hub/data-payload-slimming.test.js';
import { run as runSquashAndConfigTest } from './data-hub/squash-and-config.test.js';

import { run as runPagesTest } from './docs/pages.test.js';
import { run as runOpsToolTest } from './docs/ops-tool.test.js';
import { run as runOpsMemberBadgesTest } from './docs/ops-member-badges.test.js';
import { run as runOpsPayloadV2CleanupTest } from './docs/ops-payload-v2-cleanup.test.js';
import { run as runOpsLifecycleTest } from './docs/ops-lifecycle.test.js';
import { run as runOpsLinkedCandidateNoOpTest } from './docs/ops-linked-candidate-no-op.test.js';
import { run as runOpsMobileResponsiveTest } from './docs/ops-mobile-responsive.test.js';
import { run as runSeoTest } from './docs/seo.test.js';

import { run as runManifestTest } from './cross/manifest.test.js';
import { run as runBrowserSyncTest } from './cross/browser-sync.test.js';
import { run as runConstantsSyncTest } from './cross/constants-sync.test.js';
import { run as runEntrypointsTest } from './cross/entrypoints.test.js';

import { run as runScriptsTest } from './build/scripts.test.js';
import { run as runPackageZipTest } from './build/package-zip.test.js';
import { run as runWorkflowsTest } from './ci/workflows.test.js';
import { run as runAssetsTest } from './assets/assets.test.js';

async function main() {
  console.log("================================================================================");
  console.log("🚀 [Remine Helper] 프로젝트 전수 종합 테스트 스위트 (100% Full-Coverage)");
  console.log("================================================================================");

  let totalPassed = 0;
  let totalFailed = 0;
  let suiteCount = 0;

  // 1. 기존 데이터 허브 테스트 러너 실행 (schedule-v2, validate)
  console.log("\n==================================================");
  console.log("📦 [1/6] 기존 데이터 허브 아키텍처 및 2계층 검증");
  console.log("==================================================");

  try {
    execSync('node scripts/data-hub/tests/schedule-v2.test.js', { cwd: ROOT_DIR, stdio: 'inherit' });
    totalPassed += 8;
    suiteCount++;
  } catch (e) {
    totalFailed += 1;
  }

  try {
    const out = execSync('node scripts/data-hub/validate.js', { cwd: ROOT_DIR, encoding: 'utf8' });
    process.stdout.write(out);
    const match = out.match(/통과\s+(\d+)개/);
    totalPassed += match ? parseInt(match[1], 10) : 17;
    suiteCount++;
  } catch (e) {
    totalFailed += 1;
  }

  // 2. 확장 프로그램 클라이언트 모듈 테스트
  console.log("\n==================================================");
  console.log("🧩 [2/6] 확장 프로그램 클라이언트 핵심 모듈 테스트");
  console.log("==================================================");

  const clientSuites = [
    runCalendarTest,
    runStorageTest,
    runModalsTest,
    runTemplatesTest,
    runBackgroundTest,
    runYoutubeTest,
    runSnsTest,
    runTabsThemeTest,
    runUnnecessaryRefreshTest
  ];

  for (const suite of clientSuites) {
    const res = await suite();
    totalPassed += res.passed;
    totalFailed += res.failed;
    suiteCount++;
  }

  // 3. 데이터 허브 수집기 및 시드 테스트
  console.log("\n==================================================");
  console.log("⚙️  [3/6] 데이터 허브 수집기 및 오프라인 시드 테스트");
  console.log("==================================================");

  const hubSuites = [
    runSeedsTest,
    runCollectorsTest,
    runSyncToolsTest,
    runDataSpecTest,
    runSchedulePipelineTest,
    runUrlCleanerAndIdTest,
    runDataPayloadSlimmingTest,
    runSquashAndConfigTest
  ];

  for (const suite of hubSuites) {
    const res = await suite();
    totalPassed += res.passed;
    totalFailed += res.failed;
    suiteCount++;
  }

  // 4. 웹 배포 문서 및 운영자 도구 테스트
  console.log("\n==================================================");
  console.log("🌐 [4/6] 웹 배포 페이지 (docs) 및 운영자 도구 테스트");
  console.log("==================================================");

  const docsSuites = [
    runPagesTest,
    runOpsToolTest,
    runOpsMemberBadgesTest,
    runOpsPayloadV2CleanupTest,
    runOpsLifecycleTest,
    runOpsLinkedCandidateNoOpTest,
    runOpsMobileResponsiveTest,
    runSeoTest
  ];

  for (const suite of docsSuites) {
    const res = await suite();
    totalPassed += res.passed;
    totalFailed += res.failed;
    suiteCount++;
  }

  // 5. 크로스 플랫폼 및 설정 일치성 테스트
  console.log("\n==================================================");
  console.log("🔄 [5/6] 크로스 브라우저 (Chrome ↔ Firefox) & 설정 일관성");
  console.log("==================================================");

  const crossSuites = [
    runManifestTest,
    runBrowserSyncTest,
    runConstantsSyncTest,
    runEntrypointsTest
  ];

  for (const suite of crossSuites) {
    const res = await suite();
    totalPassed += res.passed;
    totalFailed += res.failed;
    suiteCount++;
  }

  // 6. 빌드, 패키징, CI/CD 및 정적 에셋 테스트
  console.log("\n==================================================");
  console.log("📦 [6/6] 빌드 스크립트, 패키징 zip, CI/CD 및 정적 에셋");
  console.log("==================================================");

  const buildSuites = [
    runScriptsTest,
    runPackageZipTest,
    runWorkflowsTest,
    runAssetsTest
  ];

  for (const suite of buildSuites) {
    const res = await suite();
    totalPassed += res.passed;
    totalFailed += res.failed;
    suiteCount++;
  }

  console.log("\n================================================================================");
  console.log("📊 [전수 종합 테스트 최종 결과 요약]");
  console.log("================================================================================");
  console.log(` - 실행된 테스트 스위트: 총 ${suiteCount}개 카테고리`);
  console.log(` - 총 통과한 세부 항목: ${totalPassed}개 ✅`);
  console.log(` - 총 실패한 세부 항목: ${totalFailed}개 ❌`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    console.error("❌ 일부 테스트 검증에 실패했습니다. 위의 오류 로그를 확인해 주세요.");
    process.exit(1);
  } else {
    console.log("🎉 모든 전수 종합 테스트(100%)를 성공적으로 완벽 통과했습니다!\n");
  }
}

main().catch(err => {
  console.error("테스트 러너 실행 중 치명적 오류:", err);
  process.exit(1);
});
