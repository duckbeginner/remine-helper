// tests/docs/ops-cross-browser-datetime.test.js
// iOS Safari, macOS Safari, Chrome, Firefox 등 멀티 브라우저 환경에서
// 날짜(date) 및 시간(time) 입력창의 SVG 아이콘 표시 및 텍스트 렌더링 일관성을 검증하는 TDD 단위 테스트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool Cross-Browser Date/Time UI] TDD 테스트 실행');
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

  // 1. input[type="date"]와 input[type="time"]에 background-image SVG 아이콘이 직접 지정되어 있는지 검증 (iOS Safari 필수)
  test('ops-m7k2x9.html: input[type="date"], input[type="time"]에 background-image SVG 아이콘 직접 지정 확인 (iOS WebKit 호환)', () => {
    const styleSection = opsHtml.slice(opsHtml.indexOf('<style>'), opsHtml.indexOf('</style>'));

    // date 및 time 인풋 자체의 background-image SVG 확인
    const hasDateBg = styleSection.includes('.form-input[type="date"]') &&
                      styleSection.includes('%2338bdf8') &&
                      styleSection.includes('rect x=\'3\' y=\'4\'');
    const hasTimeBg = styleSection.includes('.form-input[type="time"]') &&
                      styleSection.includes('circle cx=\'12\' cy=\'12\'');
    assert(hasDateBg, 'form-input[type="date"]에 background-image SVG(달력)가 직접 지정되어야 합니다.');
    assert(hasTimeBg, 'form-input[type="time"]에 background-image SVG(시계)가 직접 지정되어야 합니다.');
  });

  // 2. iOS Safari 전용 ::-webkit-date-and-time-value 정렬 및 렌더링 보정 검증
  test('ops-m7k2x9.html: iOS Safari 가상 요소(::-webkit-date-and-time-value) 텍스트 정렬 보정 확인', () => {
    const styleSection = opsHtml.slice(opsHtml.indexOf('<style>'), opsHtml.indexOf('</style>'));

    assert(styleSection.includes('::-webkit-date-and-time-value'), '::-webkit-date-and-time-value 스타일 규칙이 존재해야 합니다.');
    assert(styleSection.includes('text-align: left') || styleSection.includes('text-align: start'),
      'iOS Safari 날짜/시간 텍스트가 좌측 정렬로 단정하게 보정되어야 합니다.');
  });

  // 3. 데스크톱 크롬 등에서 picker-indicator가 이중으로 겹치지 않도록 투명 처리 확인
  test('ops-m7k2x9.html: ::-webkit-calendar-picker-indicator 이중 노출 방지(투명 오버레이) 확인', () => {
    const styleSection = opsHtml.slice(opsHtml.indexOf('<style>'), opsHtml.indexOf('</style>'));

    const hasTransparentIndicator = styleSection.includes('::-webkit-calendar-picker-indicator') &&
                                    (styleSection.includes('opacity: 0') || styleSection.includes('opacity:0'));
    assert(hasTransparentIndicator, 'calendar-picker-indicator가 background-image와 겹치지 않게 투명 처리되어야 합니다.');
  });

  // 4. Firefox(Gecko) 자체 내장 picker 아이콘과 background-image 이중 노출 방지 확인
  test('ops-m7k2x9.html: Firefox(@supports (-moz-appearance: none)) 아이콘 중복 방지 규칙 확인', () => {
    const styleSection = opsHtml.slice(opsHtml.indexOf('<style>'), opsHtml.indexOf('</style>'));

    const hasFirefoxFix = styleSection.includes('@supports (-moz-appearance: none)') &&
                          styleSection.includes('background-image: none');
    assert(hasFirefoxFix, 'Firefox에서 내장 아이콘과 배경 SVG가 이중 노출되지 않도록 처리되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
