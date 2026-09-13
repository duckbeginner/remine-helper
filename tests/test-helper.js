// tests/test-helper.js
// 경량 고속 테스트 유틸리티 (Zero-Dependency)

import assert from 'assert';

export class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.passed = 0;
    this.failed = 0;
    this.tests = [];
  }

  test(name, fn) {
    try {
      fn();
      console.log(`  ✅ 통과: ${name}`);
      this.passed++;
    } catch (err) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     └─ ${err.message || err}`);
      this.failed++;
    }
  }

  async testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ 통과: ${name}`);
      this.passed++;
    } catch (err) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     └─ ${err.message || err}`);
      this.failed++;
    }
  }

  run() {
    console.log(`\n▶ [${this.suiteName}] 테스트 실행`);
  }

  summary() {
    const isSuccess = this.failed === 0;
    console.log(`   결과: ${this.passed} 통과 / ${this.failed} 실패`);
    return { passed: this.passed, failed: this.failed, isSuccess };
  }
}

export { assert };
