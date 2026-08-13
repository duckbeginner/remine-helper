// ==UserScript==
// @name         dcmobile - CSS 통합형
// @version      11.9.0
// @description  미리보기 높이 제한, 내부 스크롤, 물리 제스처, 간편 추천 및 이중 고정 제어기 탑재형 통합 모듈
// @author       User
// @match        https://m.dcinside.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
	'use strict';

	// ==========================================================================
	// [1] CSS 스타일 강제 주입 및 플래닝 완료 버전
	// ==========================================================================
	const cssStyles = `
		/* 1. 글로벌 격리 테마 변수 */
		:root {
			--dcms-bg: #ffffff;
			--dcms-border: #e5e5e5;
			--dcms-text: #333333;
			--dcms-accent: #3b82f6;
			--dcms-subtext: #888888;
			--dcms-recom: #ff0000;
			--dcms-panel-bg: #f9fafb;
			--dcms-read-bg: #f5f6f7;
		}

		html.darkmode, body.darkmode {
			--dcms-bg: #1c1d1e;
			--dcms-border: #2d2f31;
			--dcms-text: #d1d5db;
			--dcms-accent: #60a5fa;
			--dcms-subtext: #9ca3af;
			--dcms-recom: #f87171;
			--dcms-panel-bg: #121212;
			--dcms-read-bg: #18191a;
		}

		/* 2. [상단고정 보장] 조상 노드 스크롤 격리 해제 */
		html, body {
			overflow-x: clip !important;
			overflow-y: visible !important;
		}

		#wrap, #container, .container, .dc-wrap, .gall-listwrap, .gall-detail-lst, .gall-list, .sec-wrap-sub, .brick-wid {
			overflow: visible !important;
		}

		/* 3. 옵션 필터 상단 고정 */
		.dcms-sticky-header {
			position: -webkit-sticky !important;
			position: sticky !important;
			top: 0 !important;
			z-index: 1000 !important;
			background-color: var(--dcms-bg) !important;
			border-bottom: 1px solid var(--dcms-border) !important;
			box-shadow: 0 2px 5px rgba(0,0,0,0.05) !important;
		}

		/* 4. 하단 고정 바 */
		.dcms-sticky-bottom {
			position: fixed !important;
			bottom: 0 !important;
			left: 0 !important;
			right: 0 !important;
			z-index: 1000 !important;
			background-color: var(--dcms-bg) !important;
			border-top: 1px solid var(--dcms-border) !important;
			box-shadow: 0 -2px 10px rgba(0,0,0,0.05) !important;
			padding-bottom: env(safe-area-inset-bottom) !important;
		}

		/* 상단 고정 헤더 축소 스타일 (네스팅 수동 평탄화 처리) */
		.dcms-sticky-header.collapsed .mal-sw-wrap,
		.dcms-sticky-header.collapsed .detail-top-lst,
		.dcms-sticky-header.collapsed .detail-top-concept {
			display: none !important;
		}
		.dcms-sticky-header::after {
			content: "▼ 카테고리 필터 펼치기" !important;
			display: none;
			text-align: center;
			padding: 4px 0;
			font-size: 11px;
			color: var(--dcms-subtext);
			cursor: pointer;
			background-color: var(--dcms-panel-bg);
		}
		.dcms-sticky-header.collapsed::after {
			display: block !important;
			content: "▼ 카테고리 필터 펼치기" !important;
		}
		.dcms-sticky-header.expanded::after {
			display: block !important;
			content: "▲ 카테고리 필터 접기" !important;
			border-top: 1px solid var(--dcms-border);
		}

		/* 하단 고정 영역 축소 스타일 (네스팅 수동 평탄화 처리) */
		.dcms-sticky-bottom.collapsed .con-search-box,
		.dcms-sticky-bottom.collapsed .btn-justify-area {
			display: none !important;
		}
		.dcms-sticky-bottom::before {
			content: "▲ 검색 및 조작 펼치기" !important;
			display: none;
			text-align: center;
			padding: 6px 0;
			font-size: 11px;
			color: var(--dcms-subtext);
			cursor: pointer;
			border-bottom: 1px solid var(--dcms-border);
			background-color: var(--dcms-panel-bg);
		}
		.dcms-sticky-bottom.collapsed::before {
			display: block !important;
			content: "▲ 검색 및 조작 펼치기" !important;
		}
		.dcms-sticky-bottom.expanded::before {
			display: block !important;
			content: "▼ 검색 및 조작 접기" !important;
		}

		/* 5. 더블 스티키 프레임 */
		.dcms-list-item.sticky-top-active {
			position: -webkit-sticky !important;
			position: sticky !important;
			z-index: 990 !important;
			background-color: var(--dcms-bg) !important;
			border-bottom: 1px dashed var(--dcms-border) !important;
			box-shadow: 0 4px 6px -2px rgba(0,0,0,0.05) !important;
			top: var(--dcms-header-height, 0px) !important;
		}

		.dcms-list-item.sticky-bottom-active {
			position: -webkit-sticky !important;
			position: sticky !important;
			z-index: 990 !important;
			background-color: var(--dcms-bg) !important;
			border-top: 1px dashed var(--dcms-border) !important;
			box-shadow: 0 -4px 6px -2px rgba(0,0,0,0.05) !important;
			bottom: var(--dcms-bottom-height, 0px) !important;
		}

		/* 6. 미리보기 드로어 구조 */
		.dcms-preview-row {
			display: block !important;
			width: 100% !important;
			background-color: var(--dcms-bg) !important;
			box-sizing: border-box !important;
			padding: 0 !important;
		}

		.dcms-preview-container {
			width: 100% !important;
			box-sizing: border-box !important;
			padding: 15px 15px 10px 15px !important;
			overflow-y: auto !important;
			-webkit-overflow-scrolling: touch !important;
		}

		.dcms-preview-body {
			font-size: 14px !important;
			line-height: 1.6 !important;
			word-break: break-all !important;
		}

		.dcms-preview-body img,
		.dcms-preview-body video {
			max-width: 100% !important;
			height: auto !important;
			display: block !important;
			margin: 8px 0 !important;
		}

		.dcms-preview-body a {
			text-decoration: underline !important;
		}

		/* 7. 댓글 아코디언 및 기본 접힘 보장 처리 */
		.dcms-preview-comments {
			margin-top: 15px !important;
			/*border-top: 1px solid var(--dcms-border) !important;
			padding-top: 10px !important;*/
			position: sticky;
			bottom: 0;
		}

		.dcms-preview-comments .all-comment {
			display: flex !important;
			flex-direction: column !important;
			max-height: 40vh !important;
			border: 1px solid var(--dcms-border) !important;
			border-radius: 8px !important;
			overflow: hidden !important;
			background-color: var(--dcms-bg) !important;
		}

		.dcms-preview-comments .all-comment-tit {
			position: -webkit-sticky !important;
			position: sticky !important;
			top: 0 !important;
			z-index: 100 !important;
			flex-shrink: 0 !important;
			background-color: var(--dcms-panel-bg) !important;
			.sp-reload {
				cursor: pointer;
			}
		}
		.dcms-preview-comments .all-comment-tit.opened {
			background-color: var(--dcms-bg) !important;
		}

		.dcms-preview-comments .comment_wrap,
		.dcms-preview-comments .comment_lst,
		.dcms-preview-comments .comment_wrap_box,
		.dcms-preview-comments .all-comment-lst,
		.dcms-preview-comments .update-re {
			display: none !important;
		}

		.dcms-preview-comments .all-comment-lst.dcms-opened,
		.dcms-preview-comments .comment_wrap.dcms-opened,
		.dcms-preview-comments .comment_lst.dcms-opened,
		.dcms-preview-comments .comment_wrap_box.dcms-opened {
			display: block !important;
			overflow-y: auto !important;
			-webkit-overflow-scrolling: touch !important;
			flex-grow: 1 !important;
		}

		.dcms-preview-comments .all-comment-tit .rt .sel-box,
		.dcms-preview-comments .all-comment-tit .rt .btn-comment-write,
		.dcms-preview-comments .update-re .update-re {
			display: none !important;
		}

		/* 8. 간편 추천 버튼 가상 마커 리셋 */
		.dcms-recom-li {
			display: inline-flex !important;
			align-items: center !important;
			margin-left: 8px !important;
		}

		.dcms-preview-comments .all-comment-tit .rt {
			background-color: transparent !important;
			display: flex !important;
			align-items: center !important;
			justify-content: flex-end !important;
			flex-wrap: nowrap !important;
			gap: 8px !important;
			white-space: nowrap !important;
		}
		.dcms-preview-comments .all-comment-tit .rt .custom-preview-recom-btn {
			align-items: center !important;
			margin-left: 6px !important;
			padding: 4px 8px !important;
			font-size: 13px !important;
			color: var(--dcms-text) !important;
			background-color: transparent !important;
			border-radius: 4px !important;
			height: auto !important;
			cursor: pointer !important;
		}
		.dcms-preview-comments .all-comment-tit .rt > *::before {
			display: none !important;
		}

		.custom-list-recom-btn.recom-done {
			opacity: 0.5 !important;
			pointer-events: none !important;
			border-color: transparent !important;
		}

		.custom-list-recom-btn .recom-mark {
			color: var(--dcms-recom) !important;
			font-weight: bold !important;
			margin-left: 2px !important;
		}

		/* 9. 읽은 게시글 시각적 톤 다운 (투명도 전면 제거) */
		body.opt-dim-read .dcms-list-item.custom-read-post {
			opacity: 1.0 !important;
			background-color: var(--dcms-read-bg) !important;
			transition: background-color 0.2s ease-in-out !important;
		}

		body.opt-dim-read .dcms-list-item.custom-read-post .subjectin {
			color: var(--dcms-subtext) !important;
		}

		body.opt-dim-read .dcms-list-item.custom-read-post .ginfo li,
		body.opt-dim-read .dcms-list-item.custom-read-post .list-nick {
			color: var(--dcms-subtext) !important;
		}

		body.opt-dim-read .dcms-list-item.custom-read-post .sp-lst {
			filter: grayscale(100%) opacity(0.4) !important;
		}

		.dcms-list-item.dcms-preview-active {
			background-color: var(--dcms-bg) !important;
		}
		.dcms-list-item.dcms-preview-active .subjectin {
			color: var(--dcms-text) !important;
		}
		.dcms-list-item.dcms-preview-active .ginfo li,
		.dcms-list-item.dcms-preview-active .list-nick {
			color: inherit !important;
		}
		.dcms-list-item.dcms-preview-active .sp-lst {
			filter: none !important;
		}

		/* 10. 상하단 숨기기 가중치 강화 */
		body.opt-hide-header .header,
		body.opt-hide-header header,
		body.opt-hide-header #header,
		body.opt-hide-header .nav,
		body.opt-hide-header .fx-depthmenu,
		body.opt-hide-header .gnb,
		body.opt-hide-header .snbtab,
		body.opt-hide-header .dc-header,
		body.opt-hide-header .blind-top,
		body.opt-hide-header .gall-top-banner,
		body.opt-hide-header .app-down-banner,
		body.opt-hide-header .dc-app-banner,
		body.opt-hide-header .ft-btm,
		body.opt-hide-header .footer,
		body.opt-hide-header footer,
		body.opt-hide-header #footer {
			display: none !important;
		}

		/* 11. 제어판 체크박스 렌더링 강제화 */
		#dcms-floating-config {
			position: fixed !important;
			bottom: calc(env(safe-area-inset-bottom) + 40px) !important;
			right: 15px !important;
			width: 44px !important;
			height: 44px !important;
			border-radius: 50% !important;
			background-color: var(--dcms-bg) !important;
			color: #ffffff !important;
			border: none !important;
			box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
			font-size: 20px !important;
			z-index: 9999 !important;
			cursor: pointer;
			opacity: 0.8;
		}

		#dcms-config-modal {
			position: fixed !important;
			top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
			background-color: rgba(0, 0, 0, 0.5) !important;
			z-index: 10000 !important;
			display: none;
			align-items: center !important;
			justify-content: center !important;
			padding: 15px !important;
		}

		#dcms-config-modal.active {
			display: flex !important;
		}

		#dcms-config-modal .modal-content {
			background-color: var(--dcms-bg) !important;
			border-radius: 14px !important;
			width: 100% !important;
			max-width: 320px !important;
			box-sizing: border-box !important;
			padding: 20px !important;
			box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
		}

		#dcms-config-modal h4 {
			margin: 0 0 15px 0 !important;
			font-size: 16px !important;
			color: var(--dcms-text) !important;
			text-align: center !important;
			border-bottom: 1px solid var(--dcms-border) !important;
			padding-bottom: 8px !important;
		}

		#dcms-config-modal label {
			display: flex !important;
			align-items: center !important;
			font-size: 13px !important;
			color: var(--dcms-text) !important;
			margin: 10px 0 !important;
			cursor: pointer !important;
			pointer-events: auto;
		}

		#dcms-config-modal input[type="checkbox"] {
			display: inline-block !important;
			width: 18px !important;
			height: 18px !important;
			margin-right: 10px !important;
			-webkit-appearance: checkbox !important;
			appearance: checkbox !important;
			opacity: 1 !important;
			visibility: visible !important;
			position: static !important;
			pointer-events: auto !important;
			accent-color: var(--dcms-accent) !important;
		}

		#dcms-config-modal .modal-buttons {
			display: flex !important;
			gap: 10px !important;
			margin-top: 15px !important;
		}

		#dcms-config-modal button {
			flex: 1 !important;
			padding: 8px !important;
			font-size: 13px !important;
			font-weight: bold !important;
			border: none !important;
			border-radius: 6px !important;
			cursor: pointer;
		}

		#dcms-config-modal .btn-cancel {
			background-color: var(--dcms-border) !important;
			color: var(--dcms-text) !important;
		}

		#dcms-config-modal .btn-save {
			background-color: var(--dcms-accent) !important;
			color: #ffffff !important;
		}

		/* 12. 무한 스크롤 당기기 인디케이터 */
		#custom-infinite-loader {
			width: 100% !important;
			padding: 12px 0 !important;
			text-align: center !important;
			color: var(--dcms-subtext) !important;
			font-size: 12px !important;
			display: none;
			transition: transform 0.1s ease-out !important;
		}

		/* [추가] 당겨서 로드 전용 플로팅 토스트 알림 */
		#dcms-pull-toast {
			position: fixed !important;
			bottom: 120px !important;
			left: 50% !important;
			transform: translateX(-50%) translateY(15px) !important;
			background-color: rgba(0, 0, 0, 0.8) !important;
			color: #ffffff !important;
			padding: 6px 14px !important;
			border-radius: 20px !important;
			font-size: 12px !important;
			z-index: 10001 !important;
			pointer-events: none !important;
			opacity: 0;
			transition: opacity 0.15s, transform 0.15s !important;
			box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
		}

		#dcms-pull-toast.dcms-active {
			opacity: 1 !important;
			transform: translateX(-50%) translateY(0) !important;
		}
		.gall-lst-group:has(div[class*="paging"]) {
			position: sticky;
			bottom: 30px;
			border-top: 1px solid rgb(68, 68, 68);
		}
		/*광고 제거*/
    .pwlink,
    [class^="adv"],
    li:has(span[class*="ntc-line-ad"]),
    li:has(div[class*="dori-box"]),
    section:has(div[class*="view-btm-con"]),
    section:has(div[class*="outside-search-box"]) {
      display: none !important;
    }
	`;

	// 비침습적 CSS 동적 인젝터 가동
	// const styleNode = document.createElement('style');
	// styleNode.type = 'text/css';
	// styleNode.innerHTML = cssStyles;
	// document.head.appendChild(styleNode);

	// ==========================================================================
	// [2] 자바스크립트 동작 및 구조 제어 엔진
	// ==========================================================================
	const READ_HISTORY_KEY = 'dcm_read_history_set';
	const RECOM_HISTORY_KEY = 'dcm_recom_history_set';
	const SETTINGS_KEY = 'dcm_suite_settings';
	const MAX_HISTORY = 1000;

	const processedPosts = new Set();
	let globalActionLock = false;

	// --- [1. 기본 설정 구성 및 적용] ---
	const defaultSettings = {
		hideHeader: true,
		stickyTop: true,
		stickyBottom: true,
		pullToLoad: true,
		inlinePreview: true,
		quickRecommend: true,
		filterDuplicates: true,
		dimRead: true,
	};

	let settings = Object.assign({}, defaultSettings);
	try {
		const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
		if (saved) settings = Object.assign(settings, saved);
	} catch (e) {}

	if (settings.hideHeader) document.body.classList.add('opt-hide-header');
	if (settings.dimRead) document.body.classList.add('opt-dim-read');

	// --- [2. 설정 제어 모달 생성] ---
	function initConfigPanel() {
		if (document.getElementById('dcms-floating-config')) return;

		const floatBtn = document.createElement('button');
		floatBtn.id = 'dcms-floating-config';
		floatBtn.innerHTML = '⚙️';
		document.body.appendChild(floatBtn);

		const modal = document.createElement('div');
		modal.id = 'dcms-config-modal';
		modal.innerHTML = `
            <div class="modal-content">
                <h4>⚙️ 모바일 통합 향상 도구</h4>
                <label><input type="checkbox" id="sc-hideHeader"> 기본 헤더/네비게이션 숨김</label>
                <label><input type="checkbox" id="sc-stickyTop"> 필터/옵션 상단 고정</label>
                <label><input type="checkbox" id="sc-stickyBottom"> 글쓰기/검색 박스 하단 고정</label>
                <label><input type="checkbox" id="sc-pullToLoad"> 자동 무한 스크롤 전환</label>
                <label><input type="checkbox" id="sc-inlinePreview"> 본문 미리보기 (더블 스티키)</label>
                <label><input type="checkbox" id="sc-quickRecommend"> 목록 내 원클릭 추천 버튼</label>
                <label><input type="checkbox" id="sc-filterDuplicates"> 중복 수집 게시글 숨김</label>
                <label><input type="checkbox" id="sc-dimRead"> 조회 완료 글 흐리게 표시</label>
                <div class="modal-buttons">
                    <button class="btn-cancel">취소</button>
                    <button class="btn-save">적용 및 저장</button>
                </div>
            </div>
        `;
		document.body.appendChild(modal);

		Object.keys(settings).forEach((key) => {
			const chk = document.getElementById(`sc-${key}`);
			if (chk) chk.checked = settings[key];
		});

		floatBtn.addEventListener('click', () => {
			floatBtn.style.display = 'none';
			modal.classList.add('active');
		});

		const close = () => {
			modal.classList.remove('active');
			floatBtn.style.display = 'block';
		};
		modal.querySelector('.btn-cancel').addEventListener('click', close);
		modal.addEventListener('click', (e) => {
			if (e.target === modal) close();
		});

		modal.querySelector('.btn-save').addEventListener('click', () => {
			Object.keys(settings).forEach((key) => {
				const chk = document.getElementById(`sc-${key}`);
				if (chk) settings[key] = chk.checked;
			});
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			location.reload();
		});
	}

	// 상단 고정 필터 래핑 가동기
	function setupStickyHeader() {
		if (!settings.stickyTop) return;
		const target = document.querySelector('.mal-sw-wrap');
		if (!target || target.parentNode.classList.contains('dcms-sticky-header'))
			return;

		const headerWrap = document.createElement('div');
		headerWrap.className = 'dcms-sticky-header';
		target.parentNode.insertBefore(headerWrap, target);

		let el = target;
		while (el) {
			const next = el.nextElementSibling;
			headerWrap.appendChild(el);

			if (el.id === 'recom_box2' || el.classList.contains('con-child-box')) {
				break;
			}
			if (
				next &&
				(next.classList.contains('gall-detail-lst') ||
					next.classList.contains('gall-lst-group'))
			) {
				break;
			}
			el = next;
		}

		updateHeaderHeightVar();
	}

	function setupStickyBottom() {
		if (!settings.stickyBottom) return;
		if (document.querySelector('.dcms-sticky-bottom')) return;

		const actionArea = document.querySelector('.btn-justify-area');
		const searchArea =
			document.querySelector('.con-search-box') ||
			document.querySelector('.con-search-inner')?.parentNode;

		if (actionArea && searchArea) {
			const bottomWrap = document.createElement('div');
			bottomWrap.className = 'dcms-sticky-bottom';
			actionArea.parentNode.insertBefore(bottomWrap, actionArea);
			bottomWrap.appendChild(actionArea);
			bottomWrap.appendChild(searchArea);

			const container = document.querySelector('.container') || document.body;
			setTimeout(() => {
				container.style.paddingBottom = `${bottomWrap.offsetHeight}px`;
			}, 150);
		}
	}

	// --- [4. 로컬 히스토리 가공 유틸] ---
	function getReadHistory() {
		try {
			return JSON.parse(localStorage.getItem(READ_HISTORY_KEY)) || [];
		} catch (e) {
			return [];
		}
	}
	function saveReadHistory(url) {
		const clean = url.split('?')[0];
		let h = getReadHistory();
		if (!h.includes(clean)) {
			h.push(clean);
			if (h.length > MAX_HISTORY) h.shift();
			localStorage.setItem(READ_HISTORY_KEY, JSON.stringify(h));
		}
	}
	function isPostRead(url) {
		return getReadHistory().includes(url.split('?')[0]);
	}

	function getRecomHistory() {
		try {
			return JSON.parse(localStorage.getItem(RECOM_HISTORY_KEY)) || [];
		} catch (e) {
			return [];
		}
	}
	function saveRecomHistory(id, no) {
		const k = `${id}_${no}`;
		let h = getRecomHistory();
		if (!h.includes(k)) {
			h.push(k);
			if (h.length > MAX_HISTORY) h.shift();
			localStorage.setItem(RECOM_HISTORY_KEY, JSON.stringify(h));
		}
	}
	function isRecommended(id, no) {
		return getRecomHistory().includes(`${id}_${no}`);
	}

	// --- [5. 추천 비동기 요청] ---
	function runRecommend(id, no, csrfToken) {
		if (!csrfToken) return alert('보안 토큰을 식별하지 못했습니다.');
		const fakeReferer = `https://m.dcinside.com/board/${id}/${no}`;

		fetch('https://m.dcinside.com/ajax/recommend', {
			method: 'POST',
			referrer: fakeReferer,
			headers: {
				Accept: 'application/json, text/javascript, */*; q=0.01',
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'X-Requested-With': 'XMLHttpRequest',
				'X-CSRF-TOKEN': csrfToken,
			},
			credentials: 'include',
			body: `type=recommend_join&id=${id}&no=${no}`,
		})
			.then((res) => {
				if (res.status === 429) throw new Error('TOO_MANY_REQUESTS');
				if (!res.ok) throw new Error('NET_ERR');
				return res.json();
			})
			.then((data) => {
				const success =
					data.result === true ||
					data.result === 'true' ||
					(data.cause &&
						(data.cause.includes('이미') || data.cause.includes('1일 1회')));
				if (success) saveRecomHistory(id, no);
				updateRecommendUI(id, no, success ? '✔' : '❌');
			})
			.catch((err) => {
				updateRecommendUI(
					id,
					no,
					err.message === 'TOO_MANY_REQUESTS' ? '⏳' : '❌'
				);
			});
	}

	function updateRecommendUI(id, no, mark) {
		document
			.querySelectorAll(`[data-recom-key="${id}_${no}"]`)
			.forEach((btn) => {
				btn.classList.add('recom-done');
				btn.innerHTML = `👍<span class="recom-mark">${mark}</span>`;
			});
	}

	// 비동기 드로어 미디어 프록시 및 iframe 수직 해상도 인라인 렌더러 (사용자 정의 최적화)
	function processInjectedMedia(container) {
		if (!container) return;
		container
			.querySelectorAll(
				'img, video, iframe, .webp-mp4, .gifarea, .written_dccon'
			)
			.forEach((media) => {
				const mp4 = media.getAttribute('data-mp4');
				const gif = media.getAttribute('data-gif');
				const src =
					media.getAttribute('ori-data') ||
					media.getAttribute('data-original') ||
					media.getAttribute('data-src') ||
					media.getAttribute('src');

				if (media.tagName?.toLowerCase() === 'iframe') {
					media.style.width = '100%';

					if (media.src.includes('dcinside.com/movie/player')) {
						media.addEventListener('load', () => {
							const innerHeight = media.contentWindow.document.body.scrollHeight;
							media.style.height = innerHeight + 'px';
						});
					}
					media.style.border = 'none';
					return;
				}

				const isMp4Valid =
					mp4 &&
					!mp4.includes('m_webp.png') &&
					!mp4.includes('dccon_loading') &&
					!mp4.includes('loading');
				const isGifValid =
					gif &&
					!gif.includes('m_webp.png') &&
					!gif.includes('dccon_loading') &&
					!gif.includes('loading');

				if (isMp4Valid) {
					const v = document.createElement('video');
					v.src = mp4.replace(/&amp;/g, '&');
					v.autoplay = true;
					v.loop = true;
					v.muted = true;
					v.playsInline = true;
					media.parentNode.replaceChild(v, media);
				} else if (isGifValid) {
					const img = document.createElement('img');
					img.src = gif.replace(/&amp;/g, '&');
					media.parentNode.replaceChild(img, media);
				} else if (
					src &&
					!src.includes('dccon_loading') &&
					!src.includes('m_webp.png')
				) {
					const img = document.createElement('img');
					img.src = src.replace(/&amp;/g, '&');
					media.parentNode.replaceChild(img, media);
				}
			});
	}

	// 소셜 임베드 전용 제어 (사용자 정의 최적화)
	function loadSocialWidgets(container) {
		if (container.querySelector('.twitter-tweet')) {
			const script = document.createElement('script');
			script.src = 'https://platform.twitter.com/widgets.js';
			script.async = true;
			document.head.appendChild(script);
		}
		if (container.querySelector('.instagram-media')) {
			const script = document.createElement('script');
			script.src = 'https://www.instagram.com/embed.js';
			script.async = true;
			document.head.appendChild(script);
		}
	}

	// --- [7. 글 목록 가공 및 노드 할당] ---
	function prepareGallList() {
		const csrfToken =
			document
				.querySelector('meta[name="csrf-token"]')
				?.getAttribute('content') || '';

		document.querySelectorAll('.gall-detail-lst > li').forEach((li) => {
			if (
				li.getAttribute('data-suite-mapped') === 'true' ||
				li.classList.contains('adv-inner') ||
				li.classList.contains('survey')
			)
				return;

			const mainLink = li.querySelector('a.lt');
			if (!mainLink) return;

			const href = mainLink.getAttribute('href');
			if (!href || href.startsWith('javascript:')) return;

			const match = href.match(/board\/([^/?]+)\/([0-9]+)/);
			if (!match) return;

			const gallId = match[1];
			const postNo = match[2];

			if (settings.filterDuplicates) {
				const uniq = `${gallId}_${postNo}`;
				if (processedPosts.has(uniq)) {
					li.remove();
					return;
				}
				processedPosts.add(uniq);
			}

			li.classList.add('dcms-list-item');
			li.setAttribute('data-suite-mapped', 'true');
			if (isPostRead(href)) li.classList.add('custom-read-post');

			if (settings.quickRecommend) {
				const ginfo = li.querySelector('.ginfo');
				if (ginfo && !ginfo.querySelector('.custom-list-recom-btn')) {
					const recomLi = document.createElement('li');
					recomLi.className = 'dcms-recom-li';

					const recomBtn = document.createElement('button');
					recomBtn.className = 'custom-list-recom-btn';
					recomBtn.setAttribute('data-recom-key', `${gallId}_${postNo}`);

					if (isRecommended(gallId, postNo)) {
						recomBtn.classList.add('recom-done');
						recomBtn.innerHTML = '👍<span class="recom-mark">✔</span>';
					} else {
						recomBtn.innerHTML = '👍';
						recomBtn.addEventListener('click', (e) => {
							e.preventDefault();
							e.stopPropagation();
							recomBtn.classList.add('recom-done');
							runRecommend(gallId, postNo, csrfToken);
						});
					}
					recomLi.appendChild(recomBtn);
					ginfo.appendChild(recomLi);
				}
			}

			if (settings.inlinePreview) {
				mainLink.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					if (globalActionLock) return;
					toggleDrawer(li, href, gallId, postNo);
				});
			}
		});
	}

	// --- [8. 더블 스티키 기반 본문 미리보기 핵심 엔진] ---
	function toggleDrawer(parentLi, postUrl, gallId, postNo) {
		const isCurrentActive = parentLi.classList.contains('dcms-preview-active');

		document.querySelectorAll('.dcms-list-item').forEach((item) => {
			item.classList.remove('dcms-preview-active');
			item.classList.remove('sticky-top-active');
			item.classList.remove('sticky-bottom-active');
			item.style.top = '';
			item.style.bottom = '';
		});
		document
			.querySelectorAll('.dcms-preview-row')
			.forEach((row) => row.remove());

		if (isCurrentActive) return;

		saveReadHistory(postUrl);
		parentLi.classList.add('custom-read-post');
		parentLi.classList.add('dcms-preview-active');

		const stickyHeader = document.querySelector('.dcms-sticky-header');
		const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 0;
		parentLi.classList.add('sticky-top-active');

		const drawerRow = document.createElement('li');
		drawerRow.className = 'dcms-preview-row';

		const container = document.createElement('div');
		container.className = 'dcms-preview-container';
		container.innerHTML =
			'<div style="text-align:center; padding:15px; color:#888;">미리보기 데이터 로딩중...</div>';

		drawerRow.appendChild(container);
		parentLi.parentNode.insertBefore(drawerRow, parentLi.nextSibling);

		let nextLi = drawerRow.nextSibling;
		while (nextLi) {
			if (
				nextLi.nodeType === 1 &&
				nextLi.classList.contains('dcms-list-item') &&
				!nextLi.classList.contains('dcms-preview-row')
			) {
				break;
			}
			nextLi = nextLi.nextSibling;
		}

		const bottomBar = document.querySelector('.dcms-sticky-bottom');
		const bottomHeight = bottomBar ? bottomBar.offsetHeight : 0;

		if (nextLi) {
			nextLi.classList.add('sticky-bottom-active');
		}

		const nextLiHeight = nextLi ? nextLi.offsetHeight : 0;
		const topOffset = headerHeight + parentLi.offsetHeight;
		const bottomOffset = bottomHeight + nextLiHeight;
		const maxPreviewHeight = window.innerHeight - topOffset - bottomOffset;

		container.style.maxHeight = `${maxPreviewHeight}px`;

		// 미리보기 내부 개별 스크롤 시에도 상/하단 바 자동 숨김 및 복원 연동 수신기 추가
		// container.addEventListener(
		// 	'scroll',
		// 	() => {
		// 		const header = document.querySelector('.dcms-sticky-header');
		// 		const bottom = document.querySelector('.dcms-sticky-bottom');
		// 		const innerScrollY = container.scrollTop;

		// 		if (innerScrollY > 0) {
		// 			if (header && !header.classList.contains('collapsed')) {
		// 				header.classList.add('collapsed');
		// 				header.classList.remove('expanded');
		// 				updateHeaderHeightVar();
		// 			}
		// 			if (bottom && !bottom.classList.contains('collapsed')) {
		// 				bottom.classList.add('collapsed');
		// 				bottom.classList.remove('expanded');
		// 				updateHeaderHeightVar();
		// 			}
		// 		} else {
		// 			if (header && header.classList.contains('collapsed')) {
		// 				header.classList.remove('collapsed');
		// 				header.classList.add('expanded');
		// 				updateHeaderHeightVar();
		// 			}
		// 			if (bottom && bottom.classList.contains('collapsed')) {
		// 				bottom.classList.remove('collapsed');
		// 				bottom.classList.add('expanded');
		// 				updateHeaderHeightVar();
		// 			}
		// 		}
		// 	},
		// 	{ passive: true }
		// );

		drawerRow.style.scrollMarginTop = `${topOffset}px`;
		drawerRow.style.scrollMarginBottom = `${bottomOffset}px`;
		setTimeout(
			() => drawerRow.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			50
		);

		fetch(postUrl, {
			method: 'GET',
			headers: {
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
				'User-Agent': navigator.userAgent,
			},
		})
			.then((res) => {
				if (!res.ok) throw new Error('수집 오류');
				return res.text();
			})
			.then((html) => {
				const doc = new DOMParser().parseFromString(html, 'text/html');
				const mainBody =
					doc.querySelector('.write_div') ||
					doc.querySelector('.thum-txt') ||
					doc.querySelector('.thum-txtin') ||
					doc.querySelector('.gall-thum-btm');
				const cmtArea =
					doc.querySelector('.all-comment') ||
					doc.querySelector('.view-comment');

				container.innerHTML = '';

				if (mainBody) {
					const bodyWrap = document.createElement('div');
					bodyWrap.className = 'dcms-preview-body';
					bodyWrap.classList.add('gall-thum-btm');

					processInjectedMedia(mainBody);

					mainBody
						.querySelectorAll('[onclick]')
						.forEach((el) => el.removeAttribute('onclick'));
					while (mainBody.firstChild) bodyWrap.appendChild(mainBody.firstChild);

					bodyWrap.addEventListener('click', (e) => {
						if (!e.target.closest('img, video, a, button, iframe, .dccon')) {
							globalActionLock = true;
							setTimeout(() => (globalActionLock = false), 400);

							parentLi.classList.remove('dcms-preview-active');
							parentLi.classList.remove('sticky-top-active');
							if (nextLi) {
								nextLi.classList.remove('sticky-bottom-active');
							}
							drawerRow.remove();
						}
					});
					bodyWrap.querySelectorAll('a').forEach((a) => a.classList.add('lnk'));

					container.appendChild(bodyWrap);
					setTimeout(() => {
						loadSocialWidgets(bodyWrap);
					}, 50);

					if (cmtArea) {
						const cmtWrap = document.createElement('div');
						cmtWrap.className = 'dcms-preview-comments';
						cmtWrap.appendChild(cmtArea);

						const titBar = cmtArea.querySelector('.all-comment-tit');
						titBar.querySelector('a').removeAttribute('href');

						const lstBox =
							cmtArea.querySelector('.all-comment-lst') ||
							cmtArea.querySelector('.comment_wrap') ||
							cmtArea.querySelector('.comment_lst');
						const updateRe = cmtArea.querySelector('.update-re');

						if (titBar && lstBox) {
							lstBox.classList.remove('dcms-opened');
							if (updateRe) updateRe.classList.remove('dcms-opened');

							processInjectedMedia(lstBox);

							const rtNode = titBar.querySelector('.rt');
							if (rtNode) {
								const topLnk =
									rtNode.querySelector('.veiw-top') ||
									rtNode.querySelector('a');
								if (topLnk) {
									topLnk.removeAttribute('onclick');
									topLnk.removeAttribute('href');
									// topLnk.setAttribute('href', postUrl);
									topLnk.addEventListener('click', (e) => {
										e.stopPropagation();
										location.href = postUrl;
									});
								}
								if (
									settings.quickRecommend &&
									!rtNode.querySelector('.custom-preview-recom-btn')
								) {
									const recBtn = document.createElement('button');
									recBtn.className =
										'custom-list-recom-btn custom-preview-recom-btn';
									recBtn.setAttribute('data-recom-key', `${gallId}_${postNo}`);
									if (isRecommended(gallId, postNo)) {
										recBtn.classList.add('recom-done');
										recBtn.innerHTML = '👍<span class="recom-mark">✔</span>';
									} else {
										recBtn.innerHTML = '👍';
										recBtn.addEventListener('click', (e) => {
											e.stopPropagation();
											if (recBtn.classList.contains('recom-done')) return;
											recBtn.classList.add('recom-done');
											runRecommend(
												gallId,
												postNo,
												document
													.querySelector('meta[name="csrf-token"]')
													?.getAttribute('content') || ''
											);
										});
									}
									rtNode.appendChild(recBtn);
								}
							}

							titBar.addEventListener('click', (e) => {
								const rld = e.target.closest('.sp-reload');
								if (rld) {
									e.stopPropagation();
									rld.classList.add('loading-fade');

									fetch(postUrl, {
										method: 'GET',
										headers: {
											Accept:
												'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
											'User-Agent': navigator.userAgent,
										},
									})
										.then((r) => r.text())
										.then((htmlData) => {
											const nextDoc = new DOMParser().parseFromString(
												htmlData,
												'text/html'
											);
											const nextLst =
												nextDoc.querySelector('.all-comment-lst') ||
												nextDoc.querySelector('.comment_wrap') ||
												nextDoc.querySelector('.comment_lst');
											if (nextLst && lstBox) {
												lstBox.innerHTML = nextLst.innerHTML;
												processInjectedMedia(lstBox);
												lstBox.classList.add('dcms-opened');
												// if (updateRe) updateRe.classList.add('dcms-opened');
												titBar.classList.add('opened');
											}
											rld.classList.remove('loading-fade');
										})
										.catch(() => rld.classList.remove('loading-fade'));
									return;
								}

								if (lstBox.classList.contains('dcms-opened')) {
									lstBox.classList.remove('dcms-opened');
									if (updateRe) updateRe.classList.remove('dcms-opened');
									titBar.classList.remove('opened');
								} else {
									lstBox.classList.add('dcms-opened');
									if (updateRe) updateRe.classList.add('dcms-opened');
									titBar.classList.add('opened');

									setTimeout(() => {
										const cmtWrap = container.querySelector(
											'.dcms-preview-comments'
										);
										if (cmtWrap) {
											cmtWrap.scrollIntoView({
												behavior: 'smooth',
												block: 'center',
											});
										}
									}, 120);
								}
							});
						}

						container.appendChild(cmtWrap);
					}
							loadSocialWidgets(bodyWrap);

					setTimeout(
						() => {
							updateHeaderHeightVar();
							drawerRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
						},
						100
					);
				} else {
					container.innerHTML =
						'<div class="preview-error" style="color:red; text-align:center;">본문을 파싱하지 못했습니다.</div>';
				}
			})
			.catch((err) => {
				container.innerHTML = `<div class="preview-error" style="color:red; text-align:center;">데이터 적재 실패: ${err.message}</div>`;
			});
	}

	// 10. 의도적 당겨서 로드 제스처 모듈
	function setupPullToLoad() {
		if (!settings.pullToLoad) return;

		let pullStartY = 0;
		let isAtBottom = false;
		let pullDistance = 0;
		let hapticTriggered = false;
		const THRESHOLD = 65;

		const loaderBar = document.createElement('div');
		loaderBar.id = 'custom-infinite-loader';
		loaderBar.innerText = '↑ 더 위로 당겨서 다음 페이지 로드';

		const pullToast = document.createElement('div');
		pullToast.id = 'dcms-pull-toast';
		document.body.appendChild(pullToast);

		const listContainer =
			document.querySelector('.gall-detail-lst') || document.body;
		listContainer.parentNode.insertBefore(loaderBar, listContainer.nextSibling);

		window.addEventListener(
			'touchstart',
			(e) => {
				const scrollY = window.scrollY || document.documentElement.scrollTop;
				const maxScroll =
					document.documentElement.scrollHeight - window.innerHeight;

				isAtBottom = scrollY >= maxScroll - 15;

				if (isAtBottom && e.touches.length === 1) {
					pullStartY = e.touches[0].clientY;
					pullDistance = 0;
					hapticTriggered = false;
				}
			},
			{ passive: true }
		);

		window.addEventListener(
			'touchmove',
			(e) => {
				if (!isAtBottom || e.touches.length !== 1) return;
				const currentY = e.touches[0].clientY;
				pullDistance = pullStartY - currentY;

				if (pullDistance > 0) {
					loaderBar.style.display = 'block';
					pullToast.classList.add('dcms-active');

					if (pullDistance >= THRESHOLD) {
						loaderBar.innerText = '🚀 놓아서 추가 로드 실행';
						loaderBar.style.color = 'var(--dcms-accent)';
						loaderBar.style.fontWeight = 'bold';
						pullToast.innerText = '🚀 손을 놓으시면 불러옵니다!';

						if (!hapticTriggered) {
							if (navigator.vibrate) navigator.vibrate(15);
							hapticTriggered = true;
						}
					} else {
						loaderBar.innerText = '↑ 더 위로 당겨서 다음 페이지 로드';
						loaderBar.style.color = 'var(--dcms-subtext)';
						loaderBar.style.fontWeight = 'normal';
						pullToast.innerText = `↑ 조금만 더 당겨주세요 (${Math.floor(pullDistance)}px / ${THRESHOLD}px)`;
						hapticTriggered = false;
					}

					loaderBar.style.transform = `translateY(-${Math.min(pullDistance / 2, THRESHOLD / 2)}px)`;
				}
			},
			{ passive: true }
		);

		window.addEventListener(
			'touchend',
			() => {
				if (!isAtBottom) return;

				pullToast.classList.remove('dcms-active');

				if (pullDistance >= THRESHOLD) {
					loaderBar.innerText = '⏳ 불러오는 중...';
					loaderBar.style.color = 'var(--dcms-accent)';

					const loadBtn = document.querySelector(
						'#listMore, .onemore, .btn_gall_more'
					);
					if (loadBtn) {
						loadBtn.click();
					} else {
						loaderBar.innerText = '더 이상 항목이 없습니다.';
					}
				}

				setTimeout(() => {
					loaderBar.style.display = 'none';
					loaderBar.style.transform = '';
					loaderBar.innerText = '↑ 더 위로 당겨서 다음 페이지 로드';
					loaderBar.style.color = 'var(--dcms-subtext)';
					loaderBar.style.fontWeight = 'normal';
				}, 600);

				isAtBottom = false;
				pullDistance = 0;
			},
			{ passive: true }
		);
	}

	// 10. 상하단 고정 영역 터치 토글 바인딩 함수 (하단 토글 동기화 보완)
	function initStickyToggle() {
		const header = document.querySelector('.dcms-sticky-header');
		if (header && !header.hasAttribute('data-toggle-bound')) {
			header.setAttribute('data-toggle-bound', 'true');
			header.classList.add('collapsed');
			header.addEventListener('click', (e) => {
				if (e.target === header) {
					header.classList.toggle('collapsed');
					header.classList.toggle('expanded');
					updateHeaderHeightVar();
				}
			});
		}

		const bottom = document.querySelector('.dcms-sticky-bottom');
		if (bottom && !bottom.hasAttribute('data-toggle-bound')) {
			bottom.setAttribute('data-toggle-bound', 'true');
			bottom.classList.add('collapsed');
			bottom.addEventListener('click', (e) => {
				if (e.target === bottom) {
					bottom.classList.toggle('collapsed');
					bottom.classList.toggle('expanded');

					setTimeout(() => {
						updateHeaderHeightVar();
					}, 50);
				}
			});
		}
	}

	// 스크롤 흐름 연동 자동 상태 변환 제어기
	let wasScrolled = false;
	function setupScrollAdaptiveToggle() {
		window.addEventListener(
			'scroll',
			() => {
				const scrollY = window.scrollY || document.documentElement.scrollTop;
				const isScrolled = scrollY > 0;

				if (isScrolled === wasScrolled) return;
				wasScrolled = isScrolled;

				const header = document.querySelector('.dcms-sticky-header');
				const bottom = document.querySelector('.dcms-sticky-bottom');

				if (isScrolled) {
					if (header) {
						header.classList.add('collapsed');
						header.classList.remove('expanded');
					}
					if (bottom) {
						bottom.classList.add('collapsed');
						bottom.classList.remove('expanded');
						const container =
							document.querySelector('.container') || document.body;
						container.style.paddingBottom = `${bottom.offsetHeight}px`;
					}
				} else {
					if (header) {
						header.classList.remove('collapsed');
						header.classList.add('expanded');
					}
					if (bottom) {
						bottom.classList.remove('collapsed');
						bottom.classList.add('expanded');
						const container =
							document.querySelector('.container') || document.body;
						container.style.paddingBottom = `${bottom.offsetHeight}px`;
					}
				}

				updateHeaderHeightVar();
			},
			{ passive: true }
		);
	}

	// 고정 헤더 및 바닥 가변 높이 통합 실시간 재계산기
	function updateHeaderHeightVar() {
		const header = document.querySelector('.dcms-sticky-header');
		if (header) {
			document.documentElement.style.setProperty(
				'--dcms-header-height',
				`${header.offsetHeight - 1}px`
			);
		}

		const bottom = document.querySelector('.dcms-sticky-bottom');
		const bottomHeight = bottom ? bottom.offsetHeight : 0;
		if (bottom) {
			document.documentElement.style.setProperty(
				'--dcms-bottom-height',
				`${bottomHeight - 1}px`
			);

			const container = document.querySelector('.container') || document.body;
			container.style.paddingBottom = `${bottomHeight - 1}px`;
		}

		const activePreview = document.querySelector(
			'.dcms-preview-row .dcms-preview-container'
		);
		const activeLi = document.querySelector(
			'.dcms-list-item.dcms-preview-active'
		);

		if (activePreview && activeLi) {
			const headerHeight = header ? header.offsetHeight : 0;

			const nextLi = document.querySelector(
				'.dcms-list-item.sticky-bottom-active'
			);
			const drawerRow = document.querySelector('.dcms-preview-row');

			const nextLiHeight = nextLi ? nextLi.offsetHeight : 0;

			const topOffset = headerHeight + activeLi.offsetHeight;
			const bottomOffset = bottomHeight + nextLiHeight;
			const maxPreviewHeight = window.innerHeight - topOffset - bottomOffset;

			drawerRow.style.scrollMarginTop = `${topOffset}px`;
			drawerRow.style.scrollMarginBottom = `${bottomOffset}px`;
			activePreview.style.maxHeight = `${maxPreviewHeight}px`;
		}
	}

	// --- [11. 통합 감시자 관찰] ---
	initConfigPanel();
	setupStickyHeader();
	setupStickyBottom();
	initStickyToggle();
	setupScrollAdaptiveToggle();
	prepareGallList();
	setupPullToLoad();

	// let mutationDebounce = null;
	// const observer = new MutationObserver(() => {
	// 	if (mutationDebounce) clearTimeout(mutationDebounce);
	// 	mutationDebounce = setTimeout(() => {
	// 		setupStickyHeader();
	// 		setupStickyBottom();
	// 		prepareGallList();
	// 	}, 80);
	// });
	// observer.observe(document.body, { childList: true, subtree: true });
})();
