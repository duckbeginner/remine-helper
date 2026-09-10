// tests/docs/ops-tool.test.js
// 운영자 도구 (docs/ops-m7k2x9.html) 무결성 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPS_FILE = path.resolve(__dirname, '../../docs/ops-m7k2x9.html');

export async function run() {
  const runner = new TestRunner('Docs - Ops Management Tool');
  runner.run();

  runner.test('ops-m7k2x9.html: 파일 실존성 및 필수 연동 키워드 검증', () => {
    assert(fs.existsSync(OPS_FILE), '운영자 페이지 docs/ops-m7k2x9.html이 존재해야 합니다.');
    const content = fs.readFileSync(OPS_FILE, 'utf8');

    assert(content.includes('Gist') || content.includes('gist'), 'Gist 동기화 로직이 포함되어야 합니다.');
    assert(content.includes('schedule-overrides.json'), '오버라이드 파일명이 명시되어야 합니다.');
    assert(content.includes('showToast'), 'showToast 토스트 알림 함수가 정의되어 있어야 합니다.');
    assert(content.includes('opsToastContainer'), '토스트 컨테이너 ID opsToastContainer가 존재해야 합니다.');
    assert(content.includes('btnOpenUserPreview'), '사용자 뷰 미리보기 버튼 btnOpenUserPreview가 존재해야 합니다.');
    assert(content.includes('userPreviewModalOverlay'), '사용자 뷰 모달 userPreviewModalOverlay가 존재해야 합니다.');
    assert(content.includes('formLivePreviewCard'), '폼 내 실시간 카드 미리보기 formLivePreviewCard가 존재해야 합니다.');
    assert(content.includes('updateFormLivePreview'), '실시간 미리보기 갱신 함수 updateFormLivePreview가 정의되어야 합니다.');
    assert(content.includes('renderUserPreviewSchedules'), '사용자 뷰 렌더러 renderUserPreviewSchedules가 정의되어야 합니다.');
    assert(content.includes('renderFieldSuggestions'), '추천 정보 렌더링 함수 renderFieldSuggestions가 정의되어야 합니다.');
    assert(content.includes('clearFieldSuggestions'), '추천 정보 초기화 함수 clearFieldSuggestions가 정의되어야 합니다.');
    assert(content.includes('applyFieldSuggestion'), '개별 추천값 적용 함수 applyFieldSuggestion이 정의되어야 합니다.');
    assert(content.includes('applyAllFieldSuggestions'), '전체 추천값 일괄 적용 함수 applyAllFieldSuggestions가 정의되어야 합니다.');
    assert(content.includes('suggestTitle'), '제목 추천 컨테이너 suggestTitle이 존재해야 합니다.');
    assert(content.includes('suggestDate'), '날짜 추천 컨테이너 suggestDate가 존재해야 합니다.');
    assert(content.includes('suggestType'), '분류 추천 컨테이너 suggestType이 존재해야 합니다.');
    assert(content.includes('suggestChannel'), '채널 추천 컨테이너 suggestChannel이 존재해야 합니다.');
    assert(content.includes('suggestLocation'), '장소 추천 컨테이너 suggestLocation이 존재해야 합니다.');
    assert(content.includes('suggestMessage'), '메모 추천 컨테이너 suggestMessage가 존재해야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-tool.test.js')) {
  run();
}
