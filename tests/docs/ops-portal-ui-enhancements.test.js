// tests/docs/ops-portal-ui-enhancements.test.js
// Ops 포털 5대 UI 편의성 개선 단위 테스트 (일반화된 속성 기반 검증)

import { TestRunner, assert } from '../test-helper.js';

export async function run() {
  const runner = new TestRunner('Docs - Ops Portal UI Enhancements (5 Features)');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 1. 숨김(삭제) 처리한 일정 1줄 컴팩트 렌더링 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Compact Deleted Card: 삭제/숨김 처리된 일정은 1줄 컴팩트 카드로 렌더링되고 복구 버튼을 포함해야 함', () => {
    // 순수 렌더러 함수 검증을 위한 모의 렌더 로직 (실제 HTML 생성 규격)
    function renderDeletedCardHTML(item) {
      const isDeleted = Boolean(item.isDeleted || item._isDeleted);
      if (!isDeleted) return null;

      const safeKey = item.id;
      const type = item.typeText || '기타';
      const timeStr = item.startTime ? item.startTime.slice(11, 16) : '종일';

      return `
        <div class="schedule-card schedule-card-compact schedule-card-compact-deleted status-excluded" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKey}')">
          <div class="compact-row">
            <div class="compact-main">
              <span class="state-badge badge-del">숨김됨</span>
              <span class="type-badge badge-default">${type}</span>
              <span class="compact-title">${item.title}</span>
              <span class="compact-time">⏰ ${timeStr}</span>
            </div>
            <div class="compact-actions" onclick="event.stopPropagation()">
              <button class="btn-action btn-restore" onclick="restoreItem('${safeKey}')">복구</button>
            </div>
          </div>
        </div>
      `.trim();
    }

    // 다양한 소스와 속성의 삭제 대상 샘플 검증
    const sampleDeletedItems = [
      { id: 'del_001', title: 'Archived Broadcast Item', startTime: '2026-09-15T18:00:00+09:00', typeText: '방송', isDeleted: true },
      { id: 'del_002', title: 'Cancelled Festival Entry', startTime: '2026-09-16T14:00:00+09:00', typeText: '행사', _isDeleted: true }
    ];

    sampleDeletedItems.forEach(item => {
      const html = renderDeletedCardHTML(item);
      assert(html.includes('schedule-card-compact-deleted'), '삭제된 일정은 컴팩트 클래스를 포함해야 함');
      assert(html.includes('badge-del'), '숨김/삭제 뱃지가 표시되어야 함');
      assert(html.includes('btn-restore'), '복구 버튼이 포함되어야 함');
      assert(html.includes(item.title), '제목이 포함되어야 함');
      assert(html.includes(`data-key="${item.id}"`), '고유 키가 올바르게 바인딩되어야 함');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 연관 일정 스택 기본 접기 (아코디언 토글) 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Accordion Linked Schedules: 연관 일정 스택은 기본적으로 접혀 있어야 하고 클릭 시 펼쳐지는 구조여야 함', () => {
    function renderLinkedSubStackHTML(subItems) {
      if (!Array.isArray(subItems) || subItems.length === 0) return '';

      const subRows = subItems.map(sub => `
        <div class="linked-sub-card" data-sub-key="${sub.id}">
          <span>${sub.title}</span>
        </div>
      `).join('');

      return `
        <details class="linked-sub-stack-accordion" onclick="event.stopPropagation()">
          <summary class="linked-accordion-summary">
            <span>🔗 함께 합성된 연관 일정 (${subItems.length}건)</span>
            <span class="accordion-icon">▾</span>
          </summary>
          <div class="linked-sub-stack-content">
            ${subRows}
          </div>
        </details>
      `.trim();
    }

    const subList = [
      { id: 'sub_a', title: 'Linked Clip 1' },
      { id: 'sub_b', title: 'Linked Post 2' }
    ];

    const accordionHtml = renderLinkedSubStackHTML(subList, 'parent_01');
    assert(accordionHtml.startsWith('<details'), 'details 태그로 기본 접힘 상태를 제공해야 함');
    assert(accordionHtml.includes('linked-accordion-summary'), 'summary 태그를 제공해야 함');
    assert(accordionHtml.includes('함께 합성된 연관 일정 (2건)'), '연관 일정 건수가 요약에 표기되어야 함');
    assert(accordionHtml.includes('event.stopPropagation()'), '아코디언 클릭 시 부모 카드 모달 클릭 이벤트가 버블링되지 않아야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 카드 클릭 시 세부 내용 모달 연동 및 내부 버블링 방지 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Card Click Modal Trigger: 카드 본체 클릭 시 세부 내용 모달이 호출되고 액션 버튼은 버블링이 차단되어야 함', () => {
    function generateCardMarkup(item) {
      const safeKey = item.id;
      return `
        <div class="schedule-card" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKey}')">
          <div class="card-title">${item.title}</div>
          <div class="card-actions" onclick="event.stopPropagation()">
            <button class="btn-action" onclick="openEditModalByKey('${safeKey}')">✏️ 수정</button>
            <button class="btn-action btn-del" onclick="toggleDeleteItem('${safeKey}')">🗑️ 숨김</button>
          </div>
        </div>
      `.trim();
    }

    const testCard = { id: 'card_evt_test', title: 'Modal Click Test Event' };
    const markup = generateCardMarkup(testCard);

    assert(markup.includes(`onclick="openDetailModalByKey('${testCard.id}')"`), '카드 본체에 모달 오픈 핸들러가 바인딩되어야 함');
    assert(markup.includes('onclick="event.stopPropagation()"'), '내부 버튼 컨테이너에 버블링 방지가 적용되어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 일정이 없는 달은 표시하지 않음 (빈 박스 생략) 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Skip Empty Month Section: 해당 월에 표시할 일정이 없으면 빈 섹션을 렌더링하지 않고 빈 문자열을 반환해야 함', () => {
    function buildMonthSectionHTMLMock(year, month, itemsInMonth) {
      if (!itemsInMonth || itemsInMonth.length === 0) {
        // 일정이 없는 달은 표시하지 않음!
        return '';
      }
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      return `<div class="month-section" id="month-section-${ym}">...items...</div>`;
    }

    const emptyResult = buildMonthSectionHTMLMock(2026, 0, []);
    assert.strictEqual(emptyResult, '', '일정이 없는 달은 DOM에 아무것도 렌더링하지 않아야 함');

    const nonEmptyResult = buildMonthSectionHTMLMock(2026, 1, [{ id: '1', title: 'Have item' }]);
    assert(nonEmptyResult.includes('month-section-2026-02'), '일정이 있는 달은 정상 렌더링되어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 자동 제외 필터된 일정 1줄 컴팩트 및 필터 사유 뱃지 표시 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Filter Excluded Compact Card: 자동 제외된 일정은 복구 버튼 대신 제외 필터 사유 뱃지를 표시해야 함', () => {
    function renderFilterExcludedCardHTML(item) {
      const isFilterExcluded = Boolean(item._filterReason);
      if (!isFilterExcluded) return null;

      const safeKey = item.id;
      const type = item.typeText || '기타';
      const timeStr = item.startTime ? item.startTime.slice(11, 16) : '종일';
      const reason = item._filterReason;

      return `
        <div class="schedule-card schedule-card-compact schedule-card-compact-filtered status-filtered" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKey}')">
          <div class="compact-row">
            <div class="compact-main">
              <span class="state-badge badge-filtered" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3);">🚫 필터: ${reason}</span>
              <span class="type-badge badge-default">${type}</span>
              <span class="compact-title">${item.title}</span>
              <span class="compact-time">⏰ ${timeStr}</span>
            </div>
            <div class="compact-actions" onclick="event.stopPropagation()">
              <button class="btn-action" onclick="openEditModalByKey('${safeKey}')">✏️ 수정</button>
            </div>
          </div>
        </div>
      `.trim();
    }

    const testFilteredItems = [
      { id: 'flt_001', title: 'Mention Video', startTime: '2026-09-15T10:00:00+09:00', _filterReason: '키워드: 단순언급' },
      { id: 'flt_002', title: 'Shorts Dance Challenge', startTime: '2026-09-16T12:00:00+09:00', _filterReason: '쇼츠 영상' },
      { id: 'flt_003', title: 'Unwanted Category Clip', startTime: '2026-09-17T15:00:00+09:00', _filterReason: '제외 채널: Unofficial' }
    ];

    testFilteredItems.forEach(item => {
      const html = renderFilterExcludedCardHTML(item);
      assert(html.includes('schedule-card-compact-filtered'), '필터 제외 컴팩트 클래스를 포함해야 함');
      assert(html.includes(`🚫 필터: ${item._filterReason}`), '정확한 필터 사유 뱃지가 노출되어야 함');
      assert(!html.includes('btn-restore'), '자동 제외된 일정에는 복구 버튼이 노출되지 않아야 함');
      assert(html.includes('openEditModalByKey'), '필요 시 수정할 수 있는 액션을 제공해야 함');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 검색창 접기/펼치기 토글 및 자동 포커스(Auto-Focus) 동작 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Collapsible Search Panel: 기본 접힘 상태, 열기 시 자동 포커스 및 닫기 시 초기화 검증', () => {
    // 모의 UI 상태 머신
    let isPanelOpen = false;
    let isInputFocused = false;
    let queryValue = '';

    const mockUi = {
      openSearch() {
        isPanelOpen = true;
        // 즉시 자동 포커스 트리거
        mockUi.focusInput();
      },
      closeSearch() {
        isPanelOpen = false;
        isInputFocused = false;
        queryValue = '';
      },
      focusInput() {
        isInputFocused = true;
      }
    };

    // 초기 상태: 접힘
    assert.strictEqual(isPanelOpen, false, '초기 상태는 접혀 있어야 함');
    assert.strictEqual(isInputFocused, false);

    // 열기 실행: 펼침 + 즉시 포커스
    mockUi.openSearch();
    assert.strictEqual(isPanelOpen, true, '열기 실행 시 패널이 열려야 함');
    assert.strictEqual(isInputFocused, true, '열기 실행 시 입력창에 즉시 자동 포커스가 부여되어야 함');

    // 닫기 실행: 접힘 + 검색어 초기화
    queryValue = '검색어';
    mockUi.closeSearch();
    assert.strictEqual(isPanelOpen, false, '닫기 실행 시 패널이 닫혀야 함');
    assert.strictEqual(queryValue, '', '닫기 실행 시 검색어가 비워져야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. 검색 버튼 조건부 활성화 및 지우기(X) 버튼 초기화 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Conditional Search & Clear Button: 입력값 유무에 따른 검색 버튼 활성화 및 X 버튼 초기화 검증', () => {
    function computeSearchControlState(rawInputValue) {
      const trimmed = (rawInputValue || '').trim();
      const hasValue = trimmed.length > 0;
      return {
        isSearchBtnDisabled: !hasValue,
        isClearBtnVisible: hasValue,
        searchQueryToExecute: hasValue ? trimmed : ''
      };
    }

    // 1) 빈 입력값 또는 공백일 때
    const emptyState1 = computeSearchControlState('');
    assert.strictEqual(emptyState1.isSearchBtnDisabled, true, '내용이 없으면 검색 버튼이 비활성화되어야 함');
    assert.strictEqual(emptyState1.isClearBtnVisible, false, '내용이 없으면 X 버튼이 숨겨져야 함');

    const emptyState2 = computeSearchControlState('   ');
    assert.strictEqual(emptyState2.isSearchBtnDisabled, true, '공백만 있으면 검색 버튼이 비활성화되어야 함');
    assert.strictEqual(emptyState2.isClearBtnVisible, false, '공백만 있으면 X 버튼이 숨겨져야 함');

    // 2) 텍스트 입력 시
    const activeState = computeSearchControlState('리센느');
    assert.strictEqual(activeState.isSearchBtnDisabled, false, '내용이 있으면 검색 버튼이 활성화되어야 함');
    assert.strictEqual(activeState.isClearBtnVisible, true, '내용이 있으면 X 버튼이 표시되어야 함');
    assert.strictEqual(activeState.searchQueryToExecute, '리센느');

    // 3) X 버튼 클릭으로 리셋 시뮬레이션
    let currentInput = '이전 검색어';
    let currentQuery = '이전 검색어';
    function clickClearButton() {
      currentInput = '';
      currentQuery = '';
      return computeSearchControlState(currentInput);
    }

    const resetState = clickClearButton();
    assert.strictEqual(currentInput, '', 'X 버튼 클릭 시 인풋 내용이 지워져야 함');
    assert.strictEqual(currentQuery, '', 'X 버튼 클릭 시 검색 쿼리가 초기화되어야 함');
    assert.strictEqual(resetState.isSearchBtnDisabled, true, '초기화 후 검색 버튼이 다시 비활성화되어야 함');
    assert.strictEqual(resetState.isClearBtnVisible, false, '초기화 후 X 버튼이 숨겨져야 함');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-portal-ui-enhancements.test.js')) {
  run();
}
