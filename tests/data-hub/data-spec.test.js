// tests/data-hub/data-spec.test.js
// DATA_SPECIFICATION.md 기반 데이터 계약(Data Contract) 정밀 검증 단위 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SPEC_FILE = path.join(ROOT_DIR, 'docs/DATA_SPECIFICATION.md');
const API_DIR = path.join(ROOT_DIR, 'docs/api/v1');
const CORE_FILE = path.join(API_DIR, 'core.json');
const SCHEDULES_FILE = path.join(API_DIR, 'schedules.json');

export async function run() {
  const runner = new TestRunner('Data Hub - Data Specification Contract');
  runner.run();

  // 1. DATA_SPECIFICATION.md 문서 존재 및 핵심 규격 정의 확인
  runner.test('DATA_SPECIFICATION.md: 공식 데이터 계약 문서 실존성 및 규격 정의 검증', () => {
    assert(fs.existsSync(SPEC_FILE), 'docs/DATA_SPECIFICATION.md 문서가 존재해야 합니다.');
    const content = fs.readFileSync(SPEC_FILE, 'utf8');
    assert(content.includes('Data Specification Contract'), '명세서 제목이 포함되어야 합니다.');
    assert(content.includes('ScheduleItem'), 'ScheduleItem 스키마 정의가 포함되어야 합니다.');
    assert(content.includes('AttendeeItem'), 'AttendeeItem 스키마 정의가 포함되어야 합니다.');
    assert(content.includes('starAttendees'), 'starAttendees 규격이 포함되어야 합니다.');
    assert(content.includes('extField'), 'extField 유예 정책이 포함되어야 합니다.');
  });

  // 2. core.json 상위 스키마 및 용량 예산 검증
  runner.test('core.json: 초경량 헤드 스키마 및 160KB 용량 예산 준수', () => {
    assert(fs.existsSync(CORE_FILE), 'core.json 파일이 존재해야 합니다.');
    const raw = fs.readFileSync(CORE_FILE, 'utf8');
    const sizeKb = Buffer.byteLength(raw) / 1024;
    assert(sizeKb <= 160, `core.json 용량은 160KB 이하여야 합니다. (현재: ${sizeKb.toFixed(2)} KB)`);

    const core = JSON.parse(raw);
    assert.strictEqual(core.version, '1.0.0', 'API 버전은 1.0.0이어야 합니다.');
    assert(typeof core.updatedAt === 'string', 'updatedAt 문자열이 있어야 합니다.');
    assert(typeof core.updatedAtTimestamp === 'number', 'updatedAtTimestamp 숫자가 있어야 합니다.');
    assert(typeof core.youtube === 'object' && core.youtube !== null, 'youtube 객체가 있어야 합니다.');
    assert(typeof core.sns === 'object' && core.sns !== null, 'sns 객체가 있어야 합니다.');
    assert(typeof core.schedules === 'object' && core.schedules !== null, 'schedules 객체가 있어야 합니다.');
    assert(Array.isArray(core.schedules.activeItems), 'activeItems는 배열이어야 합니다.');
  });

  // 3. schedules.json 상위 스키마 및 용량 예산 검증
  runner.test('schedules.json: 마스터 아카이브 스키마 및 600KB 용량 예산 준수', () => {
    assert(fs.existsSync(SCHEDULES_FILE), 'schedules.json 파일이 존재해야 합니다.');
    const raw = fs.readFileSync(SCHEDULES_FILE, 'utf8');
    const sizeKb = Buffer.byteLength(raw) / 1024;
    assert(sizeKb <= 600, `schedules.json 용량은 600KB 이하여야 합니다. (현재: ${sizeKb.toFixed(2)} KB)`);

    const scheds = JSON.parse(raw);
    assert.strictEqual(scheds.version, '1.0.0', 'API 버전은 1.0.0이어야 합니다.');
    assert(typeof scheds.totalCount === 'number', 'totalCount 숫자가 있어야 합니다.');
    assert(Array.isArray(scheds.items), 'items는 배열이어야 합니다.');
    assert.strictEqual(scheds.items.length, scheds.totalCount, 'items 길이와 totalCount가 일치해야 합니다.');
  });

  // 4. ScheduleItem 필수 필드 및 날짜 유효성 전수 검증
  runner.test('ScheduleItem: 전수 일정 필수 필드(id, title, startTime) 및 날짜 파싱 유효성 검증', () => {
    const scheds = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
    assert(scheds.items.length > 0, '최소 1개 이상의 스케줄이 존재해야 합니다.');

    scheds.items.forEach((item, index) => {
      assert(item.id && typeof item.id === 'string' && item.id.trim().length > 0, `[idx:${index}] id는 비어있지 않은 문자열이어야 합니다.`);
      assert(item.title && typeof item.title === 'string' && item.title.trim().length > 0, `[idx:${index}] title은 비어있지 않은 문자열이어야 합니다.`);
      assert(item.startTime && typeof item.startTime === 'string', `[idx:${index}] startTime은 문자열이어야 합니다.`);

      const timeVal = new Date(item.startTime).getTime();
      assert(!isNaN(timeVal), `[idx:${index}] startTime('${item.startTime}')은 유효한 날짜여야 합니다.`);

      if (item.endTime) {
        assert(!isNaN(new Date(item.endTime).getTime()), `[idx:${index}] endTime은 유효한 날짜여야 합니다.`);
      }
    });
  });

  // 5. AttendeeItem 스키마 유효성 검증 헬퍼
  runner.test('AttendeeItem: 참석 멤버 스키마 규격 유효성 검증', () => {
    const VALID_MEMBERS = new Set(['원이', '리브', '미나미', '메이', '제나']);

    // 스키마 샘플 검증
    const sampleAttendees = [
      { id: '67a5924253c0ed13ba18b38a', name: '리브', nickname: '올리브🫒' },
      { name: '원이' }
    ];

    sampleAttendees.forEach(att => {
      assert(att.name && typeof att.name === 'string', '멤버 name은 필수 문자열이어야 합니다.');
      assert(VALID_MEMBERS.has(att.name), `멤버 name('${att.name}')은 5인 멤버 중 하나여야 합니다.`);
      if (att.id) {
        assert(typeof att.id === 'string' && att.id.length > 0, '멤버 id는 문자열이어야 합니다.');
      }
    });
  });

  // 6. 하위 호환성 정책: 최상위 필드와 extField 간의 안전성
  runner.test('하위 호환성: channel/location과 extField 유예 기간 정합성 검증', () => {
    const scheds = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));

    // 채널이나 장소가 있는 아이템 중 extField가 올바르게 보조하고 있는지 표본 검증
    let extFieldCount = 0;
    scheds.items.forEach(item => {
      if (item.extField) {
        extFieldCount++;
        assert(item.extField.key && item.extField.value, 'extField는 key와 value를 포함해야 합니다.');
      }
    });

    // 배포된 v1.0.3 기준 기존 데이터에는 extField가 안정적으로 포함되어 있어야 함
    assert(extFieldCount > 0, '하위 호환을 위한 extField가 1개 이상 유지되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('data-spec.test.js')) {
  run();
}
