// tests/docs/ops-member-badges.test.js
// Ops 관리 도구 참석 멤버(starAttendees) 뱃지 연동 TDD 단위 테스트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool starAttendees Badges] 테스트 실행');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ 통과: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     이유: ${e.message}`);
      failed++;
    }
  }

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, 'utf8');

  // 1. 멤버 상수 및 아바타 매핑 검증
  test('ops-m7k2x9.html: RESCENE 5명 멤버 매핑 및 아바타 상수 정의 실존', () => {
    assert(opsHtml.includes('RESCENE_MEMBERS') || opsHtml.includes('MEMBER_AVATAR_MAP'), 'RESCENE 멤버 정의 상수가 존재해야 합니다.');
    assert(opsHtml.includes('member_woni') && opsHtml.includes('member_liv'), '멤버 아바타 이미지 경로가 포함되어야 합니다.');
  });

  // 2. getMemberAttendeeBadgesHTML 헬퍼 검증
  test('ops-m7k2x9.html: getMemberAttendeeBadgesHTML 헬퍼 함수 구현 확인', () => {
    assert(opsHtml.includes('function getMemberAttendeeBadgesHTML'), 'getMemberAttendeeBadgesHTML 함수가 정의되어야 합니다.');
  });

  // 3. 카드 목록 렌더링 연동 검증
  test('ops-m7k2x9.html: 일정 카드 렌더링에 starAttendees 뱃지 HTML 노출 확인', () => {
    assert(opsHtml.includes('starAttendees') && opsHtml.includes('attendee-mini-avatar'), '카드 렌더링 시 attendee-mini-avatar 뱃지가 연동되어야 합니다.');
  });

  // 4. 수정 모달 내 참석 멤버 선택기 UI 검증
  test('ops-m7k2x9.html: 수정 모달 내 참석 멤버(starAttendees) 선택 폼 UI 실존', () => {
    assert(opsHtml.includes('attendeesSelector') || opsHtml.includes('attendee-cb'), '수정 모달에 멤버 선택 UI가 존재해야 합니다.');
  });

  // 5. 사용자 미리보기 모달 연동 검증
  test('ops-m7k2x9.html: 사용자 미리보기 모달(renderUserPreviewSchedules)에 멤버 뱃지 노출 확인', () => {
    assert(opsHtml.includes('renderUserPreviewSchedules') && opsHtml.includes('user-sp-line'), '미리보기 모달 렌더러가 존재해야 합니다.');
    const previewSection = opsHtml.slice(opsHtml.indexOf('function renderUserPreviewSchedules'));
    assert(previewSection.includes('getMemberAttendeeBadgesHTML') || previewSection.includes('attendee-mini-avatar'), '미리보기 모달에도 멤버 뱃지가 연동되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
