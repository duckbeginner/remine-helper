    // 토스트 알림 헬퍼
    function showToast(msg, duration = 2400) {
      let container = document.getElementById('opsToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'opsToastContainer';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = 'ops-toast';
      toast.textContent = msg;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 250);
      }, duration);
    }

    // 일정 키 클립보드 복사 헬퍼
    function copyScheduleId(key, event) {
      if (event) {
        event.stopPropagation();
      }
      if (!key) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(key).then(() => {
          showToast(`🔑 키 복사됨: ${key}`);
        }).catch(() => {
          showToast(`키: ${key}`);
        });
      } else {
        showToast(`키: ${key}`);
      }
    }
    window.copyScheduleId = copyScheduleId;

    // RESCENE 멤버 및 아바타 매핑 (Single Source of Truth)
    const RESCENE_MEMBERS = [
      { id: '6a85595d92c2d65318a474de', name: '원이', avatar: 'icons/member_woni.jpeg' },
      { id: '67a5924253c0ed13ba18b38a', name: '리브', avatar: 'icons/member_liv.jpeg' },
      { id: '67a5925e0425fa520d4fbf81', name: '미나미', avatar: 'icons/member_minami.jpeg' },
      { id: '67a4ddac2248254b7dd6d9a7', name: '메이', avatar: 'icons/member_may.jpeg' },
      { id: '67a5927866121779ad93d317', name: '제나', avatar: 'icons/member_zena.jpeg' }
    ];

    const MEMBER_ID_MAP = {
      '67a59215db2769150bfbf5df': '원이',
      '6a85595d92c2d65318a474de': '원이',
      '67a5924253c0ed13ba18b38a': '리브',
      '67a5927866121779ad93d317': '제나',
      '67a4ddac2248254b7dd6d9a7': '메이',
      '67a5925e0425fa520d4fbf81': '미나미'
    };

    const MEMBER_NICKNAME_MAP = {
      '별이빛나는맘': '원이',
      '원이입니다': '원이',
      '올리브🫒': '리브',
      '올리브': '리브',
      '김깨구리제로천사': '제나',
      '메2': '메이',
      '𝕞𝕚𝕟𝕒𝕞𝕚': '미나미',
      'minami': '미나미'
    };

    const MEMBER_AVATAR_MAP = {
      '원이': 'icons/member_woni.jpeg',
      '리브': 'icons/member_liv.jpeg',
      '제나': 'icons/member_zena.jpeg',
      '메이': 'icons/member_may.jpeg',
      '미나미': 'icons/member_minami.jpeg'
    };

    // 마스터 대비 순수 차이점(Pure Diff) 추출 헬퍼 (no-op 배제, 1일정 1수정본)
    function computePureDiff(baseItem, editedItem) {
      if (!editedItem) return null;
      if (editedItem.isDeleted) return { isDeleted: true };

      const diff = {};
      let hasDiff = false;
      const compareFields = [
        'title', 'startTime', 'endTime', 'isAllday', 'typeId', 'typeText',
        'channel', 'location', 'url', 'thumbnail', 'isOfficialYoutube', 'message',
        'isPrimary'
      ];

      for (const field of compareFields) {
        const editVal = editedItem[field];
        const baseVal = baseItem ? baseItem[field] : undefined;

        if (editVal === undefined || editVal === null) continue;

        if (field === 'isPrimary') {
          const editPrimary = Boolean(editVal);
          const basePrimary = Boolean(baseVal);
          if (editPrimary !== basePrimary) {
            diff.isPrimary = editPrimary;
            hasDiff = true;
          }
          continue;
        }

        const isBaseEmpty = baseVal === undefined || baseVal === null || baseVal === '' || baseVal === false;
        const isEditEmpty = editVal === '' || editVal === false;
        if (isBaseEmpty && isEditEmpty) continue;

        if (field === 'endTime') {
          const effectiveStart = editedItem.startTime || (baseItem && baseItem.startTime);
          if (editVal === effectiveStart) continue;
        }

        if (JSON.stringify(editVal) !== JSON.stringify(baseVal)) {
          diff[field] = editVal;
          hasDiff = true;
        }
      }

      if (editedItem.starAttendees !== undefined) {
        const editAttendees = Array.isArray(editedItem.starAttendees) ? editedItem.starAttendees : [];
        const baseAttendees = (baseItem && Array.isArray(baseItem.starAttendees)) ? baseItem.starAttendees : [];
        if (JSON.stringify(editAttendees) !== JSON.stringify(baseAttendees)) {
          diff.starAttendees = editAttendees;
          hasDiff = true;
        }
      }

      if (editedItem.linkedScheduleIds !== undefined) {
        const editLinked = Array.isArray(editedItem.linkedScheduleIds) ? editedItem.linkedScheduleIds.filter(Boolean) : [];
        const baseLinked = (baseItem && Array.isArray(baseItem.linkedScheduleIds)) ? baseItem.linkedScheduleIds.filter(Boolean) : [];
        const s1 = [...editLinked].sort();
        const s2 = [...baseLinked].sort();
        // ⚠️ 방어적 2중 안전망: 편집본에 1개 이상의 링크가 존재하면 마스터 상태와 무관하게 무조건 오버라이드에 보존!
        if (editLinked.length > 0 || JSON.stringify(s1) !== JSON.stringify(s2) || (editLinked.length === 0 && baseLinked.length > 0)) {
          diff.linkedScheduleIds = [...editLinked];
          hasDiff = true;
        }
      }

      return hasDiff ? diff : null;
    }

    function getMemberAttendeeBadgesHTML(attendees) {
      if (!Array.isArray(attendees) || attendees.length === 0) return '';

      const badges = attendees.map(a => {
        if (!a) return '';
        let realName = '멤버';
        if (typeof a === 'object' && a !== null) {
          if (a.id && MEMBER_ID_MAP[a.id]) {
            realName = MEMBER_ID_MAP[a.id];
          } else {
            const raw = (a.nickname || a.name || '').trim();
            if (MEMBER_NICKNAME_MAP[raw]) {
              realName = MEMBER_NICKNAME_MAP[raw];
            } else {
              let found = false;
              for (const [nick, name] of Object.entries(MEMBER_NICKNAME_MAP)) {
                if (raw.includes(nick) || nick.includes(raw)) {
                  realName = name;
                  found = true;
                  break;
                }
              }
              if (!found) realName = raw || '멤버';
            }
          }
        } else if (typeof a === 'string') {
          const raw = a.trim();
          realName = MEMBER_ID_MAP[raw] || MEMBER_NICKNAME_MAP[raw] || raw;
        }

        const avatarUrl = MEMBER_AVATAR_MAP[realName] || (a && (a.profileImage || a.profileImg)) || '';
        if (avatarUrl) {
          return `<img src="${escapeHtml(avatarUrl)}" class="attendee-mini-avatar" style="width:14px; height:14px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,105,180,0.6); vertical-align:-2px; flex-shrink:0;" alt="${escapeHtml(realName)}" title="${escapeHtml(realName)}">`;
        }
        return `<span class="attendee-mini-badge" style="display:inline-block; width:14px; height:14px; line-height:14px; border-radius:50%; background:#ff4081; color:#fff; font-size:9px; text-align:center; font-weight:bold; vertical-align:-2px;" title="${escapeHtml(realName)}">${escapeHtml(realName.slice(0, 1))}</span>`;
      }).filter(Boolean);

      if (badges.length === 0) return '';
      return `<span class="schedule-attendees-badges" style="display:inline-flex; align-items:center; gap:2px; margin-left:4px; vertical-align:middle;">${badges.join('')}</span>`;
    }

    function normalizeLinkedScheduleIds(ids) {
      if (!Array.isArray(ids)) return [];
      return Array.from(new Set(ids.map(id => {
        if (!id || typeof id !== 'string') return '';
        const trimmed = id.trim();
        if (/^(blip_|mnet_|yt_|custom_)/.test(trimmed)) return trimmed;
        return '';
      }).filter(Boolean)));
    }

    // 상태 관리
    let allSchedules = [];
    let rawBaseSchedules = [];
    let currentViewDate = new Date();
    let activeCategory = 'all';
    let searchQuery = '';

    // 기본 제외 필터 규칙
    const DEFAULT_EXCLUDE_KEYWORDS = [
      '투표', '사전투표', '실시간투표', 'vote', 'voting', 'poll',
      '덕애드', '스타패스', '아이돌챔프', '뮤빗', '팬플러스', '포도알', '케이돌', '엠넷플러스 투표',
      '직캠', '풀캠', '팬캠', '페이스캠', '입덕직캠', '최애직캠', '팔로우캠', '안방1열', '음중직캠', 'fancam', 'choreo',
      '포스터 이벤트', '사인 이벤트', '싸인 이벤트', '이벤트 안내', '안내 (Notice)', '빅크', 'BIGC', '응모 이벤트', '증정 이벤트', '특전 이벤트', '구매자 이벤트', '럭키드로우', '럭드'
    ];

    let currentFilterRules = {
      enabled: true,
      excludeShorts: true,
      excludeTypes: [],
      excludeChannels: [],
      excludeKeywords: [...DEFAULT_EXCLUDE_KEYWORDS]
    };
    let pendingFilterRules = null;

    // Gist에 이미 영구 저장된 오버라이드 데이터 (서버 상태)
    let appliedOverrides = {
      modified: {},
      deleted: new Set(),
      created: []
    };

    // 현재 화면에서 사용자가 변경하여 [저장 적용]을 눌러야 할 스테이징 데이터
    let pendingOverrides = {
      modified: {},
      deleted: new Set(),
      created: [],
      restoredModified: new Set()
    };

    // 3-Way 병합 충돌 판별을 위한 초기 로드 시점의 기준 스냅샷 (Base State)
    let baseOverridesSnapshot = null;

    function updateBaseOverridesSnapshot(source) {
      if (!source) {
        baseOverridesSnapshot = { modified: {}, deleted: new Set(), created: [] };
        return;
      }
      baseOverridesSnapshot = {
        modified: JSON.parse(JSON.stringify(source.modified || {})),
        deleted: new Set(source.deleted || []),
        created: JSON.parse(JSON.stringify(source.created || []))
      };
    }

    // 파이프라인 수집기 운영 모드 설정 ('auto' | 'review')
    let currentPipelineConfig = {
      mode: 'auto',
      approvedScheduleIds: []
    };
    let basePipelineConfigSnapshot = {
      mode: 'auto',
      approvedScheduleIds: []
    };

    function updateBasePipelineConfigSnapshot(source) {
      if (!source) {
        basePipelineConfigSnapshot = { mode: 'auto', approvedScheduleIds: [] };
        return;
      }
      basePipelineConfigSnapshot = {
        mode: source.mode || 'auto',
        approvedScheduleIds: Array.isArray(source.approvedScheduleIds) ? [...source.approvedScheduleIds] : []
      };
    }

    const GIST_ID = '44b49b328233ef6157499debe03f165c';
    const GIST_RAW_URL = `https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedules.json`;
    const GIST_MASTER_RAW_URL = `https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/master-schedules.json`;
    const GIST_OVERRIDES_RAW_URL = `https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedule-overrides.json`;

    // 토큰 관리
    function getStoredToken() {
      return localStorage.getItem('RESCENE_OPS_TOKEN') || sessionStorage.getItem('RESCENE_OPS_TOKEN') || '';
    }

    function setStoredToken(token, remember = true) {
      if (token) {
        if (remember) {
          localStorage.setItem('RESCENE_OPS_TOKEN', token);
          sessionStorage.removeItem('RESCENE_OPS_TOKEN');
        } else {
          sessionStorage.setItem('RESCENE_OPS_TOKEN', token);
          localStorage.removeItem('RESCENE_OPS_TOKEN');
        }
      } else {
        localStorage.removeItem('RESCENE_OPS_TOKEN');
        sessionStorage.removeItem('RESCENE_OPS_TOKEN');
      }
    }

    function showApp() {
      document.getElementById('gatekeeperScreen').style.display = 'none';
      document.getElementById('appHeader').style.display = 'block';
      document.getElementById('mainContent').style.display = 'block';
    }
    window.showApp = showApp;

    // 새로 수집된 일정 상태 관리 (localStorage 기반)
    let filterOnlyNewCollected = false;

    function getKnownScheduleIds() {
      try {
        const raw = localStorage.getItem('ops_known_schedule_ids');
        if (raw) return new Set(JSON.parse(raw));
      } catch (e) {}
      return new Set();
    }

    function saveKnownScheduleIds(setOrArr) {
      try {
        const arr = Array.from(setOrArr);
        localStorage.setItem('ops_known_schedule_ids', JSON.stringify(arr));
      } catch (e) {}
    }

    function isItemNewCollected(item) {
      if (!item || item._isCustom) return false;
      const stableId = item.id || item._originKey || getScheduleKey(item);
      const rawKnown = localStorage.getItem('ops_known_schedule_ids');
      if (!rawKnown) {
        // 최초 실행 시(저장된 알려진 ID가 없는 경우): 최근 3일 이내에 등록/진행된 일정을 new로 지정
        const now = Date.now();
        const time = item.startTime ? new Date(item.startTime).getTime() : 0;
        return Math.abs(now - time) <= 3 * 24 * 60 * 60 * 1000;
      }
      const knownSet = getKnownScheduleIds();
      return !knownSet.has(stableId);
    }
    window.isItemNewCollected = isItemNewCollected;

    function markNewScheduleAsRead(key, event) {
      if (event) event.stopPropagation();
      const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      if (!item) return;
      const stableId = item.id || item._originKey || getScheduleKey(item);
      const knownSet = getKnownScheduleIds();
      knownSet.add(stableId);
      if (Array.isArray(item.linkedScheduleIds)) {
        item.linkedScheduleIds.forEach(id => knownSet.add(id));
      }
      saveKnownScheduleIds(knownSet);
      renderSchedules();
    }
    window.markNewScheduleAsRead = markNewScheduleAsRead;

    function markAllNewSchedulesAsRead() {
      const knownSet = getKnownScheduleIds();
      allSchedules.forEach(item => {
        if (!item._isCustom) {
          const stableId = item.id || item._originKey || getScheduleKey(item);
          knownSet.add(stableId);
        }
      });
      saveKnownScheduleIds(knownSet);
      filterOnlyNewCollected = false;
      renderSchedules();
      if (typeof showToast === 'function') {
        showToast('새로 수집된 모든 일정을 확인 완료 처리했습니다.', 'success');
      }
    }
    window.markAllNewSchedulesAsRead = markAllNewSchedulesAsRead;

    function toggleFilterOnlyNewCollected() {
      filterOnlyNewCollected = !filterOnlyNewCollected;
      renderSchedules();
    }
    window.toggleFilterOnlyNewCollected = toggleFilterOnlyNewCollected;

    function updateNewScheduleBanner() {
      const bannerEl = document.getElementById('newScheduleBanner');
      if (!bannerEl) return;
      const newItems = allSchedules.filter(isItemNewCollected);
      if (newItems.length === 0) {
        bannerEl.style.display = 'none';
        bannerEl.innerHTML = '';
        return;
      }
      bannerEl.style.display = 'flex';
      bannerEl.innerHTML = `
        <div class="new-schedule-info">
          <span class="new-pulse-dot"></span>
          <span>새로 수집된 일정 <strong>${newItems.length}건</strong>이 있습니다.</span>
        </div>
        <div class="new-schedule-actions">
          <button type="button" class="btn-filter-new ${filterOnlyNewCollected ? 'active' : ''}" id="btnFilterNewCollected" onclick="toggleFilterOnlyNewCollected()">
            ${filterOnlyNewCollected ? '전체 일정 보기' : '모아보기'}
          </button>
          <button type="button" class="btn-mark-all-read" id="btnMarkAllNewAsRead" onclick="markAllNewSchedulesAsRead()">
            모두 확인 완료
          </button>
        </div>
      `;
    }
    window.updateNewScheduleBanner = updateNewScheduleBanner;

    function showGatekeeper() {
      document.getElementById('gatekeeperScreen').style.display = 'flex';
      document.getElementById('appHeader').style.display = 'none';
      document.getElementById('mainContent').style.display = 'none';
      document.getElementById('stagingBar').classList.remove('visible');
      // 404 스텔스 폼 초기화
      const form = document.getElementById('gatekeeperForm');
      const homeBtn = document.getElementById('btnFakeHome');
      if (form) form.style.display = 'none';
      if (homeBtn) homeBtn.style.display = 'inline-block';
      const tokenInput = document.getElementById('gateTokenInput');
      if (tokenInput) tokenInput.value = '';
      const errorMsg = document.getElementById('gateErrorMsg');
      if (errorMsg) errorMsg.style.display = 'none';
    }

    // 날짜 헬퍼
    function getKstDate(dateStr) {
      if (!dateStr) return new Date();
      const d = new Date(dateStr);
      return new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 60000);
    }

    function formatDateYMD(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatDisplayDate(d) {
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`;
    }

    function normalizeTitle(title) {
      if (!title) return '';
      return String(title)
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
        .replace(/[<>[\]{}()_!?,.~`'"•\-/:;|+=]/g, ' ')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim();
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getScheduleKey(item) {
      if (!item) return '';
      const source = item.source || '';
      let id = item.id || item._originKey;
      if (id) {
        id = String(id).trim();
        if (source === 'mnet' && !id.startsWith('mnet_')) return `mnet_${id}`;
        if (source === 'blip' && !id.startsWith('blip_')) return `blip_${id}`;
        if (source === 'youtube' && !id.startsWith('yt_')) return `yt_${id}`;
        return id;
      }
      return '';
    }

    // 연쇄 수정 체인 추적 및 최신 속성 통합 (A -> B -> C)
    function resolveModifiedChain(modifiedMap) {
      if (!modifiedMap || typeof modifiedMap !== 'object') return {};
      const resolved = {};
      Object.keys(modifiedMap).forEach(k => {
        resolved[k] = { ...modifiedMap[k] };
      });
      return resolved;
    }

    // [스키마 유효성 검증기] 유령/껍데기 일정 진입 원천 차단 (최소 필수 3대 속성 검증)
    function isValidScheduleItem(item) {
      if (!item || typeof item !== 'object') return false;
      if (!item.id || typeof item.id !== 'string') return false;
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) return false;
      if (!item.startTime || isNaN(new Date(item.startTime).getTime())) return false;
      return true;
    }

    // 고유 ID 불일치 방어 가드: mod에 지정된 ID가 다른 소스의 고유 ID인 경우 매칭 차단
    const isIdMismatch = (mod, item) => {
      if (!mod || !mod.id || !item || !item.id) return false;
      return mod.id !== item.id && /^(blip_|mnet_|yt_|custom_)/.test(String(mod.id));
    };

    // 아이템과 일치하는 오버라이드 객체 검색 (Canonical ID 단일화 매칭)
    function findMatchingOverride(item, modifiedMap) {
      if (!item || !modifiedMap) return null;
      if (item.id && modifiedMap[item.id] && !isIdMismatch(modifiedMap[item.id], item)) {
        return modifiedMap[item.id];
      }
      if (item._originKey && modifiedMap[item._originKey] && !isIdMismatch(modifiedMap[item._originKey], item)) {
        return modifiedMap[item._originKey];
      }
      const sKey = getScheduleKey(item);
      if (sKey && modifiedMap[sKey] && !isIdMismatch(modifiedMap[sKey], item)) {
        return modifiedMap[sKey];
      }
      return null;
    }

    // v2.0 Gist 오버라이드 JSON 데이터를 브라우저 메모리(appliedOverrides) 구조로 단일 정규화 파싱
    function parseOverridesV2IntoMemory(overridesJson) {
      const memory = { modified: {}, deleted: new Set(), created: [] };
      if (!overridesJson || typeof overridesJson !== 'object') return memory;

      // 1. filterRules 파싱
      if (overridesJson.filterRules && Array.isArray(overridesJson.filterRules.excludeKeywords)) {
        currentFilterRules = {
          enabled: overridesJson.filterRules.enabled !== false,
          excludeShorts: overridesJson.filterRules.excludeShorts !== false,
          excludeTypes: Array.isArray(overridesJson.filterRules.excludeTypes) ? [...overridesJson.filterRules.excludeTypes] : [],
          excludeChannels: Array.isArray(overridesJson.filterRules.excludeChannels) ? [...overridesJson.filterRules.excludeChannels] : [],
          excludeKeywords: [...overridesJson.filterRules.excludeKeywords]
        };
      }

      // 2. v2.0 customSchedules 로드 (고유 id 최우선 식별 및 필수 스키마 검증)
      if (overridesJson.customSchedules && typeof overridesJson.customSchedules === 'object') {
        Object.values(overridesJson.customSchedules).forEach(c => {
          if (!c || !isValidScheduleItem(c)) return;
          const isDel = Boolean(c.isDeleted);
          const cId = c.id || getScheduleKey(c);
          if (isDel) {
            memory.deleted.add(cId);
            if (c.id) memory.deleted.add(c.id);
          }
          if (!memory.created.some(x => (x.id && c.id && x.id === c.id) || (x.title === c.title && x.startTime === c.startTime))) {
            memory.created.push({ ...c, id: cId, _isCustom: true, _isDeleted: isDel });
          }
        });
      }

      // 3. v2.0 sourceOverrides 로드
      if (overridesJson.sourceOverrides && typeof overridesJson.sourceOverrides === 'object') {
        Object.entries(overridesJson.sourceOverrides).forEach(([sId, sVal]) => {
          if (!sVal) return;
          if (sVal.isDeleted) {
            memory.deleted.add(sId);
            if (sVal.id) memory.deleted.add(sVal.id);
          } else {
            memory.modified[sId] = sVal;
          }
        });
      }

      // 4. v1.0 레거시 호환 deleted 로드
      if (Array.isArray(overridesJson.deleted)) {
        overridesJson.deleted.forEach(k => memory.deleted.add(k));
      }

      // 5. v1.0 레거시 호환 modified 로드
      if (overridesJson.modified && typeof overridesJson.modified === 'object') {
        const resolved = resolveModifiedChain(overridesJson.modified);
        memory.modified = { ...resolved, ...memory.modified };
        // modified 내 _isCustom 격리 항목 자동 구출 -> created로 편입
        Object.entries(memory.modified).forEach(([mKey, mVal]) => {
          if (mVal && mVal._isCustom) {
            if (!memory.created.some(c => (c.id && c.id === mKey) || getScheduleKey(c) === mKey || c.title === mVal.title)) {
              memory.created.push({ ...mVal, id: mVal.id || mKey, _originKey: mKey, _isCustom: true });
            }
          }
        });
      }

      // 6. v1.0 레거시 호환 created 로드
      if (Array.isArray(overridesJson.created)) {
        overridesJson.created.forEach(c => {
          if (!c) return;
          const isDel = Boolean(c.isDeleted);
          const cId = c.id || getScheduleKey(c);
          if (isDel) {
            memory.deleted.add(cId);
            if (c.id) memory.deleted.add(c.id);
          }
          if (!memory.created.some(x => (x.id && c.id && x.id === c.id) || (x.title === c.title && x.startTime === c.startTime))) {
            memory.created.push({ ...c, id: cId, _isCustom: true, _isDeleted: isDel });
          }
        });
      }

      return memory;
    }

    // 데이터 로드 (기본 스케줄 + 기존 Gist 오버라이드 실시간 병합)
    async function loadSchedules() {
      const container = document.getElementById('scheduleListContainer');
      container.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>최신 일정 및 보정 규칙 동기화 중...</span>
        </div>
      `;

      try {
        const token = getStoredToken();

        // 1. master-schedules.json 우선 로드 (없으면 기본 schedules.json 폴백)
        let data = null;
        try {
          const masterRes = await fetch(`${GIST_MASTER_RAW_URL}?t=${Date.now()}`);
          if (masterRes.ok) {
            data = await masterRes.json();
          }
        } catch (e) { }

        if (!data || !Array.isArray(data.items)) {
          try {
            const localMasterRes = await fetch(`./api/v1/master-schedules.json?t=${Date.now()}`);
            if (localMasterRes.ok) {
              data = await localMasterRes.json();
            }
          } catch (e) { }
        }

        if (!data || !Array.isArray(data.items)) {
          const res = await fetch(`${GIST_RAW_URL}?t=${Date.now()}`);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          data = await res.json();
        }

        const baseItems = (data.items || []).filter(isValidScheduleItem).map(item => {
          const pure = { ...item };
          if (pure && pure.id && String(pure.id).startsWith('custom_')) {
            pure._isCustom = true;
          } else {
            // 공식 크롤링 원본 일정: 오버라이드 잔류 필드 일체 박멸 (Pure Raw Master SSOT)
            delete pure.linkedScheduleIds;
            delete pure.isDeleted;
            delete pure._isDeleted;
            delete pure._isModified;
          }
          return pure;
        });
        rawBaseSchedules = JSON.parse(JSON.stringify(baseItems));
        window.rawBaseSchedules = rawBaseSchedules;

        // 2. schedule-overrides.json 로드 (Gist API 우선 조회로 CDN 캐시 0% 실시간 최신본 획득)
        appliedOverrides = { modified: {}, deleted: new Set(), created: [] };

        let overridesJson = null;
        if (token) {
          try {
            const apiRes = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
              },
              cache: 'no-store'
            });
            if (apiRes.ok) {
              const gistData = await apiRes.json();
              const coreFile = gistData.files && gistData.files['core.json'];
              if (coreFile) {
                if (coreFile.content) {
                  try {
                    window.latestGistCoreData = JSON.parse(coreFile.content);
                  } catch (ce) { }
                } else if (coreFile.raw_url) {
                  try {
                    const cRes = await fetch(`${coreFile.raw_url}${coreFile.raw_url.includes('?') ? '&' : '?'}t=${Date.now()}`);
                    if (cRes.ok) window.latestGistCoreData = await cRes.json();
                  } catch (ce) { }
                }
              }
              const overFile = gistData.files && gistData.files['schedule-overrides.json'];
              if (overFile) {
                if (overFile.content) {
                  try {
                    overridesJson = JSON.parse(overFile.content);
                  } catch (pe) { }
                } else if (overFile.raw_url) {
                  try {
                    const rawRes = await fetch(`${overFile.raw_url}${overFile.raw_url.includes('?') ? '&' : '?'}t=${Date.now()}`);
                    if (rawRes.ok) {
                      overridesJson = await rawRes.json();
                    }
                  } catch (re) { }
                }
              }
            }
          } catch (e) { }
        }

        if (!overridesJson) {
          try {
            const rawRes = await fetch(`${GIST_OVERRIDES_RAW_URL}?t=${Date.now()}`);
            if (rawRes.ok) {
              overridesJson = await rawRes.json();
            }
          } catch (e) { }
        }

        // 2-1. v2.0 통합 파서로 appliedOverrides 확정 및 기준 스냅샷 갱신
        appliedOverrides = parseOverridesV2IntoMemory(overridesJson);
        updateBaseOverridesSnapshot(appliedOverrides);

        // 2-2. pipelineConfig 동기화 및 기준 스냅샷 갱신
        if (overridesJson && overridesJson.pipelineConfig && typeof overridesJson.pipelineConfig === 'object') {
          currentPipelineConfig = {
            mode: overridesJson.pipelineConfig.mode || 'auto',
            approvedScheduleIds: Array.isArray(overridesJson.pipelineConfig.approvedScheduleIds)
              ? [...overridesJson.pipelineConfig.approvedScheduleIds]
              : []
          };
        } else {
          currentPipelineConfig = { mode: 'auto', approvedScheduleIds: [] };
        }
        updateBasePipelineConfigSnapshot(currentPipelineConfig);
        updatePipelineModeUI();

        // 삭제 판별 헬퍼 (Canonical ID 단일화 검사)
        const checkIsDeleted = (item) => {
          if (!item) return false;
          if (item.id && appliedOverrides.deleted.has(item.id)) return true;
          if (item._originKey && appliedOverrides.deleted.has(item._originKey)) return true;
          const sKey = getScheduleKey(item);
          if (sKey && appliedOverrides.deleted.has(sKey)) return true;
          return false;
        };

        // 3. baseItems에 appliedOverrides 병합 (안전 필드만 덮어쓰고 ID/Source 불변성 보장!)
        const SAFE_OVERRIDE_FIELDS = ['title', 'startTime', 'endTime', 'isAllday', 'url', 'location', 'typeText', 'typeId', 'message', 'channel', 'thumbnail', 'isOfficialYoutube', 'starAttendees', 'isPrimary'];
        allSchedules = baseItems.map(item => {
          const itemCopy = { ...item };
          const origSource = item.source;
          let origId = item.id;
          if (origId) {
            origId = String(origId).trim();
            if (origSource === 'mnet' && !origId.startsWith('mnet_')) {
              origId = `mnet_${origId}`;
            } else if (origSource === 'blip' && !origId.startsWith('blip_')) {
              origId = `blip_${origId}`;
            } else if (origSource === 'youtube' && !origId.startsWith('yt_')) {
              origId = `yt_${origId}`;
            }
          }
          itemCopy.id = origId;
          itemCopy.source = origSource;
          itemCopy._originKey = origId || getScheduleKey(itemCopy);

          // Gist에 저장된 수정본이 있으면 실제 속성 덮어쓰기! (체인 반영 최신본 매칭)
          const mod = findMatchingOverride(itemCopy, appliedOverrides.modified);
          if (mod) {
            SAFE_OVERRIDE_FIELDS.forEach(f => {
              if (mod[f] !== undefined) {
                if (f === 'starAttendees') itemCopy[f] = Array.isArray(mod[f]) ? [...mod[f]] : [];
                else if (f === 'isPrimary') itemCopy[f] = Boolean(mod[f]);
                else itemCopy[f] = mod[f];
              }
            });
            if (mod.linkedScheduleIds !== undefined) {
              itemCopy.linkedScheduleIds = normalizeLinkedScheduleIds(mod.linkedScheduleIds);
            }
            itemCopy._isModified = true;
          }
          if (itemCopy.linkedScheduleIds) {
            itemCopy.linkedScheduleIds = normalizeLinkedScheduleIds(itemCopy.linkedScheduleIds);
          }

          // ID 및 Source 불변성 영구 보존
          if (origId) itemCopy.id = origId;
          if (origSource) itemCopy.source = origSource;
          itemCopy._originKey = origId || getScheduleKey(itemCopy);

          if (checkIsDeleted(itemCopy)) {
            itemCopy._isDeleted = true;
          }

          return itemCopy;
        });

        // 4. Gist에 저장된 생성 항목 추가 (격리 구출 항목 포함)
        appliedOverrides.created.forEach(c => {
          const cCopy = { ...c, _isCustom: true };
          const cKey = getScheduleKey(cCopy);
          cCopy._originKey = cKey;
          if (checkIsDeleted(cCopy)) {
            cCopy._isDeleted = true;
          }
          if (!allSchedules.some(s => getScheduleKey(s) === cKey || (s.title === cCopy.title && s.startTime === cCopy.startTime))) {
            allSchedules.unshift(cCopy);
          }
        });

        // 4-1. Gist sourceOverrides에 등록되어 있으나 schedules.json에 누락된 서브 일정 및 숨김 일정 복원
        if (overridesJson && overridesJson.sourceOverrides && typeof overridesJson.sourceOverrides === 'object') {
          Object.entries(overridesJson.sourceOverrides).forEach(([k, v]) => {
            if (!v) return;
            if (!k || typeof k !== 'string' || !k.trim()) return;
            // ⚠️ [가상키 유입 원천 차단] Canonical prefix 규격을 만족하지 않는 키(예: YYYY-MM-DD_제목)는 복원 차단
            if (!/^(mnet_|blip_|yt_|custom_)/.test(k)) return;
            const alreadyExists = allSchedules.some(s => (s.id && (s.id === k || s.id === v.id)) || (s._originKey && (s._originKey === k || s._originKey === v.id)) || getScheduleKey(s) === k);
            if (!alreadyExists) {
              // ⚠️ [스키마 유효성 검증] 유효한 제목과 시작일시가 없는 불완전 껍데기 조각(URL/채널만 있는 데이터)은 유령 일정 생성을 막기 위해 복원 제외!
              const vCandidate = { ...v, id: v.id || k };
              if (!isValidScheduleItem(vCandidate)) return;

              // 동일 날짜 + 정규화 제목 일치 기존 일정이 이미 allSchedules에 존재하는지 확인 (동일 일정 중복 복원 차단)
              const vDate = v.startTime ? formatDateYMD(new Date(v.startTime)) : '';
              const vNorm = normalizeTitle(v.title || '');
              const existingDuplicate = allSchedules.find(s => {
                if (!s.startTime || !s.title) return false;
                const sDate = formatDateYMD(new Date(s.startTime));
                if (sDate !== vDate) return false;
                const sNorm = normalizeTitle(s.title || '');
                return sNorm === vNorm || (sNorm && vNorm && (sNorm.includes(vNorm) || vNorm.includes(sNorm)) && Math.min(sNorm.length, vNorm.length) >= 4);
              });

              if (existingDuplicate) {
                if (v.isDeleted || appliedOverrides.deleted.has(k) || (v.id && appliedOverrides.deleted.has(v.id))) {
                  existingDuplicate._isDeleted = true;
                }
                if (Array.isArray(v.linkedScheduleIds)) {
                  existingDuplicate.linkedScheduleIds = Array.from(new Set([...(existingDuplicate.linkedScheduleIds || []), ...v.linkedScheduleIds]));
                }
                return;
              }

              const isBlip = String(k).startsWith('blip_') || (v.id && String(v.id).startsWith('blip_'));
              const isMnet = String(k).startsWith('mnet_') || (v.id && String(v.id).startsWith('mnet_'));
              const isYoutube = String(k).startsWith('yt_') || (v.id && String(v.id).startsWith('yt_'));
              const sourceVal = v.source || (isBlip ? 'blip' : (isMnet ? 'mnet' : (isYoutube ? 'youtube' : 'custom')));

              const resItem = {
                ...v,
                id: v.id || k,
                _originKey: k,
                title: v.title,
                source: sourceVal,
                _isDeleted: Boolean(v.isDeleted || appliedOverrides.deleted.has(k) || (v.id && appliedOverrides.deleted.has(v.id)))
              };
              if (!isValidScheduleItem(resItem)) return;
              if (checkIsDeleted(resItem)) resItem._isDeleted = true;
              allSchedules.push(resItem);
            }
          });
        }

        // 4-2. deleted 키 목록 중 YYYY-MM-DD_제목 형식으로 남아있는 숨김 일정 복원
        appliedOverrides.deleted.forEach(dKey => {
          const m = String(dKey).match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
          if (m) {
            const dateStr = m[1];
            const titleStr = m[2];
            const alreadyExists = allSchedules.some(s => (s.title === titleStr && s.startTime && s.startTime.startsWith(dateStr)) || (s.id && s.id === dKey));
            if (!alreadyExists) {
              allSchedules.push({
                id: dKey,
                _originKey: dKey,
                title: titleStr,
                startTime: `${dateStr}T00:00:00+09:00`,
                endTime: `${dateStr}T00:00:00+09:00`,
                isAllday: true,
                typeText: '기타',
                _isDeleted: true
              });
            }
          }
        });

        // 4-3. 연관 일정(linkedScheduleIds) 상대방 서브 아이템 지능형 복원 및 메타데이터 상속
        ensureLinkedSubItemsRestored();

        // 5. 사용자가 현재 세션에서 아직 [저장 적용] 안 한 pendingOverrides도 화면에 임시 합성
        Object.entries(pendingOverrides.modified).forEach(([pKey, pMod]) => {
          const target = allSchedules.find(s => getScheduleKey(s) === pKey);
          if (target) {
            Object.assign(target, pMod);
            target._isModified = true;
          }
        });
        pendingOverrides.created.forEach(c => {
          const cKey = getScheduleKey(c);
          if (!allSchedules.some(s => getScheduleKey(s) === cKey)) {
            allSchedules.unshift({ ...c, _originKey: cKey, _isCustom: true });
          }
        });

        renderSchedules();
        updateStagingBar();
      } catch (err) {
        container.innerHTML = `
          <div style="text-align:center; padding: 40px 0; color: #fb7185;">
            <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
            <div>원격 일정을 불러오지 못했습니다.</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">${err.message}</div>
          </div>
        `;
      }
    }

    // 파이프라인 모드 UI 갱신 헬퍼
    function updatePipelineModeUI() {
      const btn = document.getElementById('btnTogglePipelineMode');
      const icon = document.getElementById('pipelineModeIcon');
      const text = document.getElementById('pipelineModeText');
      if (!btn) return;

      const mode = currentPipelineConfig.mode || 'auto';
      if (mode === 'review') {
        if (icon) icon.textContent = '🛡️';
        if (text) text.textContent = '관리자 검수';
        btn.style.background = 'rgba(245, 158, 11, 0.15)';
        btn.style.color = '#fbbf24';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.35)';
        btn.title = '현재 관리자 검수 모드 (수집 일정 승인 후 배포) - 클릭 시 빠른 반영 모드로 전환';
      } else {
        if (icon) icon.textContent = '⚡';
        if (text) text.textContent = '빠른 반영';
        btn.style.background = 'rgba(16, 185, 129, 0.15)';
        btn.style.color = '#6ee7b7';
        btn.style.borderColor = 'rgba(16, 185, 129, 0.35)';
        btn.title = '현재 빠른 반영 모드 (수집 일정 즉시 배포) - 클릭 시 관리자 검수 모드로 전환';
      }
    }

    // 관리자 검수 대기 일정 승인 처리
    function approveScheduleItem(key) {
      const item = allSchedules.find(s => getScheduleKey(s) === key || (s.id && s.id === key) || s._originKey === key);
      if (!item) return;

      currentPipelineConfig.approvedScheduleIds = currentPipelineConfig.approvedScheduleIds || [];
      const targetId = item.id || key;
      if (!currentPipelineConfig.approvedScheduleIds.includes(targetId)) {
        currentPipelineConfig.approvedScheduleIds.push(targetId);
      }
      item._isPendingReview = false;
      updatePipelineModeUI();
      updateStagingBar();
      renderSchedules();
      showToast(`'${item.title}' 일정이 배포 승인되었습니다. [저장 적용] 시 사용자 앱에 반영됩니다.`);
    }

    // 일정 분류 결정 헬퍼 (Mnet, Blip, YouTube 1:1 표준 매핑)
    function resolveScheduleType(item) {
      if (item.typeText && item.typeText.trim()) return item.typeText.trim();
      const text = ((item.title || '') + ' ' + (item.message || '') + ' ' + (item.channel || '') + ' ' + (item.location || '') + ' ' + ((item.extField && item.extField.value) || '')).toLowerCase();
      if (/라디오|파워fm|fm4u|sbs 파워|정오의 희망곡|가요광장|영스트리트|친한친구|별이 빛나는 밤에|두시탈출|컬투쇼|아이돌 라디오|러브게임/i.test(text)) return '라디오';
      if (/팬사인|팬싸|영통|대면\s*사인|fansign/i.test(text)) return '팬사인회';
      if (/콘서트|concert|쇼케이스|showcase|단독\s*공연/i.test(text)) return '공연';
      if (/페스티벌|festival|축제|대동제|청랑제|시구|시타|행사/i.test(text)) return '행사';
      if (/화보|nylon/i.test(text)) return '화보';
      if (/생일|birthday|기념일|day!|데뷔/i.test(text)) return '기념일';
      if (/공지|notice|응모|이벤트 안내|안내/i.test(text)) return '공지';
      if (/릴리즈|concept photo|track list|teaser|발매|album/i.test(text)) return '릴리즈';
      if (item.source === 'youtube' || /자컨|비하인드|vlog|브이로그/i.test(text)) return '영상';

      if (item.typeId === 1) return '방송';
      if (item.typeId === 2) return '릴리즈';
      if (item.typeId === 3) return '공지';
      if (item.typeId === 4) return '기념일';
      if (item.typeId === 5) return '행사';
      if (item.typeId === 6) return '화보';
      if (item.typeId === 8) return '공지';
      if (item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사'))) return '방송';
      if (item.location || (item.extField && item.extField.key === '장소')) return '행사';
      return '기타';
    }

    // 연속 멀티 먼스 스크롤 & 필터링 렌더러
    let loadedMonths = []; // 예: ['2026-08', '2026-09']
    let isScrollLoading = false;

    // 스케줄 필터링 헬퍼
    function filterScheduleItems(items, options = {}) {
      const { monthStart, monthEnd, isSearching } = options;
      const activeRules = pendingFilterRules || currentFilterRules;
      const filterEnabled = activeRules.enabled !== false;
      const excludeShorts = activeRules.excludeShorts !== false;
      const excludeTypes = Array.isArray(activeRules.excludeTypes) ? activeRules.excludeTypes : [];
      const excludeChannels = Array.isArray(activeRules.excludeChannels) ? activeRules.excludeChannels : [];
      const excludeKeywords = Array.isArray(activeRules.excludeKeywords) ? activeRules.excludeKeywords : DEFAULT_EXCLUDE_KEYWORDS;

      return items.filter(item => {
        if (!item.startTime) return false;
        const d = new Date(item.startTime);
        const startT = d.getTime();
        const endT = item.endTime ? new Date(item.endTime).getTime() : startT;

        // 1. 월 필터 (검색 모드가 아닐 때)
        if (!isSearching && monthStart != null && monthEnd != null) {
          const overlapsMonth = (startT <= monthEnd && endT >= monthStart);
          if (!overlapsMonth) return false;
        }

        // 1-1. 신규 수집 일정 모아보기 필터
        if (filterOnlyNewCollected && !isItemNewCollected(item)) {
          return false;
        }

        // 2. 카테고리 필터
        const itemKey = getScheduleKey(item);
        const isItemDeleted = Boolean(
          item._isDeleted ||
          (pendingOverrides && (pendingOverrides.deleted.has(itemKey) || (item.id && pendingOverrides.deleted.has(item.id)) || (item._originKey && pendingOverrides.deleted.has(item._originKey)))) ||
          (appliedOverrides && (appliedOverrides.deleted.has(itemKey) || (item.id && appliedOverrides.deleted.has(item.id)) || (item._originKey && appliedOverrides.deleted.has(item._originKey))))
        );

        const isCorrupted = !item.startTime || !item.title || isNaN(new Date(item.startTime).getTime()) || Boolean(item._isCorrupted);

        if (activeCategory === 'deleted') {
          if (!isItemDeleted) return false;
        } else if (activeCategory === 'needs-review') {
          if (!isCorrupted) return false;
        } else if (activeCategory !== 'all') {
          const itemCat = resolveScheduleType(item);
          if (itemCat !== activeCategory) return false;
        }

        // 3. 검색 필터
        if (isSearching && searchQuery) {
          const q = searchQuery.toLowerCase();
          const targetText = [item.title, item.channel, item.location, item.message].filter(Boolean).join(' ').toLowerCase();
          if (!targetText.includes(q)) return false;
        }

        // 4. 제외 필터 규칙 적용 (수정 중, 커스텀 일정, 삭제/숨김된 일정은 보호)
        const isProtected = isItemDeleted || item._isCustom || (pendingOverrides && pendingOverrides.modified && (pendingOverrides.modified[item.id] || pendingOverrides.modified[itemKey])) || (appliedOverrides && appliedOverrides.modified && (appliedOverrides.modified[item.id] || appliedOverrides.modified[itemKey]));

        item._filterReason = null;
        if (!isProtected) {
          // 4-1. 쇼츠 제외
          if (excludeShorts) {
            const raw = [item.url, item.link, item.title, item.message].filter(Boolean).join(' ');
            if (item._isShorts || /youtube\.com\/shorts\//i.test(raw) || /#shorts\b|#쇼츠\b/i.test(raw) || /(?:vt\.tiktok\.com\/|tiktok\.com\/@[^/]+\/video\/\d+)/i.test(raw)) {
              item._filterReason = '쇼츠/숏폼 영상';
            }
          }

          // 4-2. 종류별 제외
          if (!item._filterReason && excludeTypes.length > 0) {
            const resolvedType = resolveScheduleType(item);
            if (excludeTypes.includes(resolvedType) || (item.typeText && excludeTypes.includes(item.typeText))) {
              item._filterReason = `카테고리 제외 (${resolvedType || item.typeText})`;
            }
          }

          // 4-3. 채널별 제외
          if (!item._filterReason && excludeChannels.length > 0) {
            const channelValues = [
              item.channel,
              (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null)
            ].filter(Boolean).map(s => s.trim().toLowerCase());

            const matchedCh = excludeChannels.find(ex => {
              const cleanEx = ex.trim().toLowerCase();
              return cleanEx && channelValues.some(c => c === cleanEx || c.includes(cleanEx));
            });
            if (matchedCh) {
              item._filterReason = `제외 채널: ${matchedCh}`;
            }
          }

          // 4-4. 키워드 제외
          if (!item._filterReason && filterEnabled && excludeKeywords.length > 0) {
            const fullText = [item.title, item.message, item.url, item.link, item.channel, item.location, (item.extField && item.extField.value)].filter(Boolean).join(' ').toLowerCase();
            const matchedKw = excludeKeywords.find(kw => {
              const cleanKw = kw.trim().toLowerCase();
              return cleanKw && fullText.includes(cleanKw);
            });
            if (matchedKw) {
              item._filterReason = `키워드: ${matchedKw}`;
            }
          }
        }

        return true;
      });
    }

    // [클러스터 대표 일정 선출 알고리즘] Ops 포털 및 데이터 허브 공통 통일 규칙
    function determineClusterPrimary(cluster) {
      if (!cluster || cluster.length === 0) return null;
      if (cluster.length === 1) return cluster[0];

      // 1순위: 관리자 명시 대표 지정 (isPrimary: true)
      const explicitList = cluster.filter(c => c && c.isPrimary);
      if (explicitList.length > 0) {
        return explicitList.sort((a, b) => String(a.id || a._originKey || '').localeCompare(String(b.id || b._originKey || '')))[0];
      }

      // 2순위: 수동 커스텀 등록 일정 (_isCustom)
      const customList = cluster.filter(c => c && c._isCustom);
      if (customList.length > 0) {
        return customList.sort((a, b) => String(a.id || a._originKey || '').localeCompare(String(b.id || b._originKey || '')))[0];
      }

      // 3순위: 관리자 수정 일정 (_isModified)
      const modifiedList = cluster.filter(c => c && (c._isModified || (pendingOverrides.modified && pendingOverrides.modified[getScheduleKey(c)])));
      if (modifiedList.length > 0) {
        return modifiedList.sort((a, b) => String(a.id || a._originKey || '').localeCompare(String(b.id || b._originKey || '')))[0];
      }

      // 4순위: 소스 우선순위 (blip > mnet > 기타) 및 세부 정보 충실도
      const sourceScore = (src) => src === 'blip' ? 30 : src === 'mnet' ? 20 : 10;
      const detailScore = (item) => {
        let s = 0;
        if (item.channel) s += 5;
        if (item.location) s += 5;
        if (item.url) s += 3;
        if (item.thumbnail) s += 3;
        if (item.starAttendees && item.starAttendees.length > 0) s += 4;
        return s;
      };

      const sorted = [...cluster].sort((a, b) => {
        const scoreA = (sourceScore(a.source) || 0) + detailScore(a);
        const scoreB = (sourceScore(b.source) || 0) + detailScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        // 5순위: 고유 ID 결정론적 정렬
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

      return sorted[0];
    }
    window.determineClusterPrimary = determineClusterPrimary;

    // [연관 일정 BFS 전이적 폐포(Transitive Closure) 클러스터링 알고리즘]
    // 상호 양방향 및 N-hop으로 연결된 모든 일정을 단일 무방향 그래프 연결 요소로 완전 수집
    function buildScheduleClusterTransitive(startItem, allList) {
      if (!startItem) return [];
      const list = (Array.isArray(allList) && allList.length > 0) ? allList : (Array.isArray(allSchedules) ? allSchedules : []);
      const cluster = [];
      const visitedKeys = new Set();
      const queue = [startItem];

      const getKeys = (item) => {
        const keys = [];
        if (item.id) keys.push(item.id);
        if (item._originKey) keys.push(item._originKey);
        const sk = getScheduleKey(item);
        if (sk) keys.push(sk);
        return Array.from(new Set(keys.filter(Boolean)));
      };

      const startKeys = getKeys(startItem);
      startKeys.forEach(k => visitedKeys.add(k));

      while (queue.length > 0) {
        const cur = queue.shift();
        if (!cluster.includes(cur)) {
          cluster.push(cur);
        }

        const curKeys = getKeys(cur);
        curKeys.forEach(k => visitedKeys.add(k));

        // 1. 순방향 탐색: cur.linkedScheduleIds 에 지정된 모든 대상
        const linkedIds = Array.isArray(cur.linkedScheduleIds) ? cur.linkedScheduleIds : [];
        linkedIds.forEach(tId => {
          if (!tId) return;
          const matched = list.find(cand => {
            return (cand.id && cand.id === tId) || cand._originKey === tId || getScheduleKey(cand) === tId;
          });
          if (matched) {
            const mKeys = getKeys(matched);
            const isAlreadyVisited = mKeys.some(k => visitedKeys.has(k)) || cluster.includes(matched);
            if (!isAlreadyVisited) {
              mKeys.forEach(k => visitedKeys.add(k));
              queue.push(matched);
            }
          }
        });

        // 2. 역방향 탐색: list 내 다른 일정이 curKeys 중 하나라도 linkedScheduleIds에 포함하고 있는 경우
        list.forEach(cand => {
          if (cand === cur || cluster.includes(cand)) return;
          const candKeys = getKeys(cand);
          if (candKeys.some(k => visitedKeys.has(k))) return;

          const cLinked = Array.isArray(cand.linkedScheduleIds) ? cand.linkedScheduleIds : [];
          const hasLink = curKeys.some(k => cLinked.includes(k));
          if (hasLink) {
            candKeys.forEach(k => visitedKeys.add(k));
            queue.push(cand);
          }
        });
      }

      return cluster;
    }
    window.buildScheduleClusterTransitive = buildScheduleClusterTransitive;

    // 날짜별 그룹 HTML 생성기
    function renderScheduleGroupsHTML(filteredItems) {
      if (!filteredItems || filteredItems.length === 0) return '';

      const renderedGlobalScheduleIds = new Set();
      const renderedPrimaryKeys = new Set();
      const groups = {};
      filteredItems.forEach((item, index) => {
        const d = new Date(item.startTime);
        const ymd = formatDateYMD(d);
        if (!groups[ymd]) groups[ymd] = [];
        groups[ymd].push({ item, originalIndex: index });
      });

      const todayYMD = formatDateYMD(new Date());
      let html = '';

      Object.keys(groups).sort().forEach(ymd => {
        const groupItems = groups[ymd];
        const dateObj = new Date(ymd + 'T00:00:00');
        const isToday = ymd === todayYMD;

        html += `
          <div class="date-group">
            <div class="date-header ${isToday ? 'today' : ''}">
              ${formatDisplayDate(dateObj)} ${isToday ? '• 오늘' : ''}
            </div>
        `;

        groupItems.sort((a, b) => {
          const tA = a.item.startTime ? new Date(a.item.startTime).getTime() : 0;
          const tB = b.item.startTime ? new Date(b.item.startTime).getTime() : 0;
          return tA - tB;
        });

        groupItems.forEach(({ item }) => {
          if (item.id && renderedGlobalScheduleIds.has(item.id)) return;
          const fallbackKey = item._originKey || getScheduleKey(item);
          if (fallbackKey && renderedGlobalScheduleIds.has(fallbackKey)) return;

          // 연관 연결된 클러스터 BFS 전이적 완전 탐색 (allSchedules 전체에서 탐색)
          const allList = (Array.isArray(allSchedules) && allSchedules.length > 0) ? allSchedules : (window.allSchedules || filteredItems);
          const cluster = buildScheduleClusterTransitive(item, allList);

          cluster.forEach(c => {
            if (c.id) renderedGlobalScheduleIds.add(c.id);
            if (c._originKey) renderedGlobalScheduleIds.add(c._originKey);
            const sk = getScheduleKey(c);
            if (sk) renderedGlobalScheduleIds.add(sk);
          });

          let primaryItem = determineClusterPrimary(cluster);
          if (!primaryItem) return;

          const primaryKey = primaryItem.id || primaryItem._originKey || getScheduleKey(primaryItem);
          // Fail-Safe: 동일한 대표 일정이 2개 이상의 카드로 중복 배출되는 것을 원천 차단
          if (primaryKey) {
            if (renderedPrimaryKeys.has(primaryKey)) {
              return;
            }
            renderedPrimaryKeys.add(primaryKey);
          }

          let subItems = cluster.filter(c => c !== primaryItem);

          const key = getScheduleKey(primaryItem);
          const isDeleted = pendingOverrides.deleted.has(key) || primaryItem._isDeleted;
          const isPendingMod = Boolean(pendingOverrides.modified[key]);
          const isSavedMod = Boolean(primaryItem._isModified);
          const isCustom = Boolean(primaryItem._isCustom);
          const rawListForCard = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);
          const hasRawOriginal = !isCustom && Array.isArray(rawListForCard) && rawListForCard.some(b =>
            (b.id && (b.id === key || b.id === primaryItem.id || b.id === primaryItem._originKey)) ||
            (b._originKey && (b._originKey === key || b._originKey === primaryItem.id || b._originKey === primaryItem._originKey)) ||
            getScheduleKey(b) === key
          );

          let statusClass = '';
          let stateBadge = '';
          if (isDeleted) {
            statusClass = 'status-excluded';
            stateBadge = '<span class="state-badge badge-del">삭제됨</span>';
          } else if (isPendingMod) {
            statusClass = 'status-modified';
            stateBadge = '<span class="state-badge badge-pending">수정 대기</span>';
          } else if (isSavedMod) {
            statusClass = 'status-modified';
            stateBadge = '<span class="state-badge badge-confirmed">수정됨</span>';
          } else if (isCustom) {
            statusClass = 'status-custom';
            stateBadge = '<span class="state-badge badge-new">수동 등록</span>';
          }

          const isCardCorrupted = !primaryItem.startTime || !primaryItem.title || isNaN(new Date(primaryItem.startTime).getTime()) || Boolean(primaryItem._isCorrupted);
          if (isCardCorrupted) {
            stateBadge += '<span class="state-badge badge-warning" style="background:rgba(245, 158, 11, 0.2); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.4); margin-left:4px;">⚠️ 검토 필요 (결측치)</span>';
          }

          const isNewCollected = !isDeleted && (isItemNewCollected(primaryItem) || subItems.some(isItemNewCollected));
          if (isNewCollected) {
            statusClass += ' status-new-collected';
            stateBadge = '<span class="state-badge badge-new-collected" title="새로 수집된 일정">✨ NEW</span> ' + stateBadge;
          }

          const isApproved = (currentPipelineConfig.approvedScheduleIds || []).includes(primaryItem.id || key);
          const isPendingReview = !isDeleted && !isApproved && (Boolean(primaryItem._isPendingReview) || (currentPipelineConfig.mode === 'review' && !primaryItem._isCustom && !isSavedMod && !isPendingMod));
          if (isPendingReview) {
            statusClass += ' status-pending-review';
            stateBadge = '<span class="state-badge badge-pending-review" style="background:rgba(245, 158, 11, 0.2); color:#fbbf24; border:1px solid rgba(245, 158, 11, 0.4); margin-right:4px;" title="관리자 검수 모드: 승인 전까지 사용자에게 배포되지 않습니다">🛡️ 검수 대기</span>' + stateBadge;
          }

          const type = resolveScheduleType(primaryItem);
          let typeBadgeClass = 'badge-default';
          let placeholderIcon = '📅';
          if (type === '영상') {
            typeBadgeClass = 'badge-video';
            placeholderIcon = '🎬';
          } else if (type === '방송') {
            typeBadgeClass = 'badge-broadcast';
            placeholderIcon = '📺';
          } else if (type === '라디오') {
            typeBadgeClass = 'badge-radio';
            placeholderIcon = '📻';
          } else if (type === '공연') {
            typeBadgeClass = 'badge-concert';
            placeholderIcon = '🎤';
          } else if (type === '팬사인회') {
            typeBadgeClass = 'badge-fansign';
            placeholderIcon = '✍️';
          } else if (type === '행사') {
            typeBadgeClass = 'badge-event';
            placeholderIcon = '🎪';
          } else if (type === '기념일') {
            typeBadgeClass = 'badge-special';
            placeholderIcon = '🎂';
          } else if (type === '화보') {
            typeBadgeClass = 'badge-pictorial';
            placeholderIcon = '📸';
          } else if (type === '릴리즈') {
            typeBadgeClass = 'badge-release';
            placeholderIcon = '💿';
          } else if (type === '공지') {
            typeBadgeClass = 'badge-notice';
            placeholderIcon = '📢';
          }

          let timeStr = '종일';
          if (!primaryItem.isAllday && primaryItem.startTime) {
            const timeD = new Date(primaryItem.startTime);
            if (!isNaN(timeD.getTime())) {
              const hours = String(timeD.getHours()).padStart(2, '0');
              const mins = String(timeD.getMinutes()).padStart(2, '0');
              timeStr = `${hours}:${mins}`;
            }
          }

          const safeKey = escapeHtml(key);
          const safeKeyJs = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

          // ① [UI 개선 1] 숨김(삭제) 처리된 일정: 1줄 얇은 컴팩트 카드로 표시
          if (isDeleted) {
            html += `
              <div class="schedule-card schedule-card-compact schedule-card-compact-deleted status-excluded" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKeyJs}')" style="cursor: pointer; padding: 6px 12px; margin-bottom: 6px;">
                <div class="compact-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                  <div class="compact-main" style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; overflow: hidden;">
                    <span class="state-badge badge-del" style="flex-shrink: 0;">숨김됨</span>
                    <span class="type-badge ${typeBadgeClass}" style="flex-shrink: 0; font-size: 10px; padding: 1px 6px;">${escapeHtml(type)}</span>
                    <span class="key-badge" onclick="copyScheduleId('${safeKeyJs}', event)" title="클릭하여 키 복사" style="font-family: monospace; font-size: 9.5px; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.08); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); cursor: pointer; flex-shrink: 0;">🔑 ${escapeHtml(key)}</span>
                    <span class="compact-title" style="font-size: 12.5px; font-weight: 500; color: var(--text-muted); text-decoration: line-through; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(primaryItem.title)}</span>
                    ${primaryItem.location ? `<span style="font-size: 10px; color: var(--text-muted); flex-shrink: 0;">📍 ${escapeHtml(primaryItem.location)}</span>` : ''}
                    <span style="font-size: 10px; color: var(--text-muted); flex-shrink: 0;">⏰ ${timeStr}</span>
                  </div>
                  <div class="compact-actions" style="flex-shrink: 0; display: flex; align-items: center; gap: 4px;" onclick="event.stopPropagation()">
                    ${primaryItem.url ? `<a href="${escapeHtml(primaryItem.url)}" target="_blank" class="btn-action" style="padding: 2px 6px; font-size: 10.5px; text-decoration: none;">🔗 링크</a>` : ''}
                    <button class="btn-action btn-restore" style="padding: 2px 8px; font-size: 11px;" onclick="restoreItem('${safeKeyJs}')">복구</button>
                  </div>
                </div>
              </div>
            `;
            return;
          }

          // ⑤ [UI 개선 5] 자동 제외 필터된 일정: 숨김 일정처럼 1줄 컴팩트 표시 + [🚫 필터: 사유] 뱃지 (복구 대신 사유 표시)
          if (primaryItem._filterReason) {
            html += `
              <div class="schedule-card schedule-card-compact schedule-card-compact-filtered status-filtered" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKeyJs}')" style="cursor: pointer; padding: 6px 12px; margin-bottom: 6px; opacity: 0.85;">
                <div class="compact-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px;">
                  <div class="compact-main" style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; overflow: hidden;">
                    <span class="state-badge badge-filtered" style="flex-shrink: 0; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">🚫 필터: ${escapeHtml(primaryItem._filterReason)}</span>
                    <span class="type-badge ${typeBadgeClass}" style="flex-shrink: 0; font-size: 10px; padding: 1px 6px;">${escapeHtml(type)}</span>
                    <span class="key-badge" onclick="copyScheduleId('${safeKeyJs}', event)" title="클릭하여 키 복사" style="font-family: monospace; font-size: 9.5px; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.08); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); cursor: pointer; flex-shrink: 0;">🔑 ${escapeHtml(key)}</span>
                    <span class="compact-title" style="font-size: 12.5px; font-weight: 500; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(primaryItem.title)}</span>
                    <span style="font-size: 10px; color: var(--text-muted); flex-shrink: 0;">⏰ ${timeStr}</span>
                  </div>
                  <div class="compact-actions" style="flex-shrink: 0; display: flex; align-items: center; gap: 4px;" onclick="event.stopPropagation()">
                    ${primaryItem.url ? `<a href="${escapeHtml(primaryItem.url)}" target="_blank" class="btn-action" style="padding: 2px 6px; font-size: 10.5px; text-decoration: none;">🔗 링크</a>` : ''}
                    <button class="btn-action" style="padding: 2px 8px; font-size: 11px;" onclick="openEditModalByKey('${safeKeyJs}')">✏️ 수정</button>
                  </div>
                </div>
              </div>
            `;
            return;
          }

          let subStackHtml = '';
          if (subItems.length > 0) {
            let subRowsHtml = '';
            subItems.forEach(sub => {
              const subKey = getScheduleKey(sub);
              const subKeyJs = subKey.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              const subType = resolveScheduleType(sub) || '기타';
              const subSource = sub.source || (sub._isCustom ? 'custom' : 'blip');
              let sourceBadgeBg = 'rgba(255,255,255,0.08)';
              let sourceBadgeColor = 'var(--text-muted)';
              let sourceName = '기타';
              if (subSource === 'mnet') {
                sourceBadgeBg = 'rgba(236,72,153,0.15)';
                sourceBadgeColor = '#ec4899';
                sourceName = 'Mnet';
              } else if (subSource === 'blip') {
                sourceBadgeBg = 'rgba(59,130,246,0.15)';
                sourceBadgeColor = '#3b82f6';
                sourceName = 'Blip';
              } else if (sub._isCustom) {
                sourceBadgeBg = 'rgba(168,85,247,0.15)';
                sourceBadgeColor = '#a855f7';
                sourceName = '수동';
              }

              let subTime = '종일';
              if (!sub.isAllday && sub.startTime) {
                const subD = new Date(sub.startTime);
                if (!isNaN(subD.getTime())) {
                  subTime = `${String(subD.getHours()).padStart(2, '0')}:${String(subD.getMinutes()).padStart(2, '0')}`;
                }
              }

              subRowsHtml += `
                <div class="linked-sub-card" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; font-size: 11px;">
                  <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; overflow: hidden;">
                    <span style="font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; background: ${sourceBadgeBg}; color: ${sourceBadgeColor}; flex-shrink: 0;">${sourceName}</span>
                    <span class="key-badge sub-key-badge" onclick="copyScheduleId('${subKeyJs}', event)" title="클릭하여 키 복사" style="font-family: monospace; font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(56,189,248,0.1); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); cursor: pointer; flex-shrink: 0;">🔑 ${escapeHtml(subKey)}</span>
                    <span style="font-size: 9.5px; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.05); color: var(--text-muted); flex-shrink: 0;">${escapeHtml(subType)}</span>
                    <span style="font-weight: 500; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(sub.title)}</span>
                    ${getMemberAttendeeBadgesHTML(sub.starAttendees)}
                    <span style="font-size: 10px; color: var(--text-muted); flex-shrink: 0;">⏰ ${subTime}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; margin-left: 8px; flex-shrink: 0;">
                    <button type="button" class="btn-action set-primary-btn" style="padding: 2px 6px; font-size: 10.5px; background: rgba(234,179,8,0.15); border: 1px solid rgba(234,179,8,0.3); color: #eab308; border-radius: 4px;" title="이 일정을 대표 일정으로 지정" onclick="setClusterPrimary('${subKeyJs}', '${safeKeyJs}')">⭐ 대표 지정</button>
                    ${sub.url ? `<a href="${escapeHtml(sub.url)}" target="_blank" class="btn-action" style="padding: 2px 6px; font-size: 10.5px; text-decoration: none;">🔗 링크</a>` : ''}
                    ${(sub._isModified || (pendingOverrides.modified && pendingOverrides.modified[subKey])) && !sub._isCustom && Array.isArray(rawBaseSchedules) && rawBaseSchedules.some(b => (b.id && (b.id === subKey || b.id === sub.id)) || (b._originKey && (b._originKey === subKey || b._originKey === sub._originKey)) || getScheduleKey(b) === subKey) ? `<button type="button" class="btn-action btn-restore-mod" style="padding: 2px 6px; font-size: 10.5px;" onclick="restoreModifiedItem('${subKeyJs}')" title="수정 취소 및 공식 원본으로 복구">↩️ 원본 복구</button>` : ''}
                    <button class="btn-action" style="padding: 2px 6px; font-size: 10.5px;" onclick="openEditModalByKey('${subKeyJs}')">✏️ 수정</button>
                    <button class="btn-action btn-del" style="padding: 2px 6px; font-size: 10.5px;" title="연결 해제" onclick="unlinkSchedulePair('${safeKeyJs}', '${subKeyJs}')">🔗 해제</button>
                  </div>
                </div>
              `;
            });

            // ② [UI 개선 2] 연관 일정 접어두기 (기본 접힌 아코디언 토글)
            subStackHtml = `
              <details class="linked-sub-stack-accordion" style="margin-top: 10px;" onclick="event.stopPropagation()">
                <summary class="linked-accordion-summary" style="cursor: pointer; font-size: 11px; font-weight: 600; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(56, 189, 248, 0.06); border: 1px dashed rgba(56, 189, 248, 0.3); border-radius: 6px; user-select: none;">
                  <span>🔗 함께 합성된 연관 일정 (${subItems.length}건)</span>
                  <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">클릭하여 접기/펼치기 ▾</span>
                </summary>
                <div class="linked-sub-stack-content" style="padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                  ${subRowsHtml}
                </div>
              </details>
            `;
          }

          // ③ [UI 개선 3] 카드 본체 클릭 시 세부 모달 열기 (onclick="openDetailModalByKey")
          html += `
            <div class="schedule-card ${statusClass}" data-key="${safeKey}" onclick="openDetailModalByKey('${safeKeyJs}')" style="cursor: pointer;">
              <div class="card-top">
                <div class="thumb-box">
                  ${primaryItem.thumbnail ? `<img src="${escapeHtml(primaryItem.thumbnail)}" class="thumb-img" alt="">` : `<div class="thumb-placeholder">${placeholderIcon}</div>`}
                </div>
                <div class="card-meta">
                  <div class="meta-badges">
                    <span class="type-badge ${typeBadgeClass}">${escapeHtml(type)}</span>
                    <span class="key-badge" onclick="copyScheduleId('${safeKeyJs}', event)" title="클릭하여 키 복사" style="font-family: monospace; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.08); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); cursor: pointer; vertical-align: middle; display: inline-flex; align-items: center; gap: 3px;">🔑 ${escapeHtml(key)}</span>
                    ${primaryItem.channel ? `<span style="font-size:10px; color:var(--text-muted); font-weight:600;">${escapeHtml(primaryItem.channel)}</span>` : ''}
                    ${stateBadge}
                    ${subItems.length > 0 ? `<span class="state-badge" style="background:rgba(56,189,248,0.2); color:#38bdf8; font-weight:600;" title="연관 일정 ${subItems.length}건과 1개로 합성됨">🔗 연관 ${subItems.length}건 합성</span>` : ''}
                    ${getMemberAttendeeBadgesHTML(primaryItem.starAttendees)}
                  </div>
                  <div class="card-title">${escapeHtml(primaryItem.title)}</div>
                  ${primaryItem.location ? `<div class="card-subtext">📍 ${escapeHtml(primaryItem.location)}</div>` : ''}
                </div>
              </div>

              <div class="card-bottom">
                <div class="card-time">⏰ ${timeStr}</div>
                <div class="card-actions" onclick="event.stopPropagation()">
                  ${isPendingReview ? `<button type="button" class="btn-action btn-approve" style="background:rgba(16, 185, 129, 0.2); color:#6ee7b7; border:1px solid rgba(16, 185, 129, 0.4); font-weight:600;" onclick="approveScheduleItem('${safeKeyJs}')" title="이 일정을 승인하여 사용자 앱에 배포">✅ 승인</button>` : ''}
                  ${isNewCollected ? `<button type="button" class="btn-action btn-confirm-new" onclick="markNewScheduleAsRead('${safeKeyJs}', event)" title="확인 완료 처리">✓ 확인</button>` : ''}
                  ${primaryItem.url ? `<a href="${escapeHtml(primaryItem.url)}" target="_blank" class="btn-action" style="text-decoration:none;">🔗 링크</a>` : ''}
                  ${(isPendingMod || isSavedMod) && hasRawOriginal ? `<button type="button" class="btn-action btn-restore-mod" onclick="restoreModifiedItem('${safeKeyJs}')" title="수정 취소 및 공식 원본으로 복구">↩️ 원본 복구</button>` : ''}
                  <button class="btn-action" onclick="openEditModalByKey('${safeKeyJs}')">✏️ 수정</button>
                  <button class="btn-action btn-del" onclick="toggleDeleteItem('${safeKeyJs}')">🗑️ 숨김</button>
                </div>
              </div>
              ${subStackHtml}
            </div>
          `;
        });

        html += `</div>`;
      });

      return html;
    }

    // 개별 월 섹션 HTML 생성
    function buildMonthSectionHTML(year, month) {
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthStart = new Date(year, month, 1, 0, 0, 0).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

      const itemsInMonth = filterScheduleItems(allSchedules, { monthStart, monthEnd, isSearching: false });

      // ④ [UI 개선 4] 일정이 없는 달은 표시하지 않음 (빈 박스/플레이스홀더 생략으로 스크롤 낭비 제거)
      if (itemsInMonth.length === 0) {
        return '';
      }

      const contentHtml = renderScheduleGroupsHTML(itemsInMonth);
      if (!contentHtml || !contentHtml.trim()) return '';

      return `
        <div class="month-section" id="month-section-${ym}" data-month="${ym}">
          <div class="month-divider">
            <span class="month-badge">📅 ${year}년 ${month + 1}월</span>
          </div>
          ${contentHtml}
        </div>
      `;
    }

    // 다음 달 덧붙이기
    function appendNextMonth(targetDate) {
      if (searchQuery && searchQuery.trim()) return;
      if (loadedMonths.length === 0) return;

      let nextYear, nextMonth, nextYm;
      if (targetDate) {
        nextYear = targetDate.getFullYear();
        nextMonth = targetDate.getMonth();
        nextYm = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
      } else {
        const lastYm = loadedMonths[loadedMonths.length - 1];
        const [y, m] = lastYm.split('-').map(Number);
        const d = new Date(y, m, 1);
        nextYear = d.getFullYear();
        nextMonth = d.getMonth();
        nextYm = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
      }

      if (loadedMonths.includes(nextYm)) return;

      loadedMonths.push(nextYm);
      const wrapper = document.getElementById('monthSectionsWrapper');
      if (wrapper) {
        const temp = document.createElement('div');
        temp.innerHTML = buildMonthSectionHTML(nextYear, nextMonth);
        if (temp.firstElementChild) {
          wrapper.appendChild(temp.firstElementChild);
        }
      }
    }

    // 이전 달 위에 덧붙이기 (스크롤 위치 보정)
    function prependPrevMonth(targetDate) {
      if (searchQuery && searchQuery.trim()) return;
      if (loadedMonths.length === 0) return;

      let prevYear, prevMonth, prevYm;
      if (targetDate) {
        prevYear = targetDate.getFullYear();
        prevMonth = targetDate.getMonth();
        prevYm = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
      } else {
        const firstYm = loadedMonths[0];
        const [y, m] = firstYm.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        prevYear = d.getFullYear();
        prevMonth = d.getMonth();
        prevYm = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
      }

      if (loadedMonths.includes(prevYm)) return;

      loadedMonths.unshift(prevYm);
      const wrapper = document.getElementById('monthSectionsWrapper');
      if (wrapper) {
        const oldScrollHeight = document.documentElement.scrollHeight;
        const oldScrollTop = window.scrollY;

        const temp = document.createElement('div');
        temp.innerHTML = buildMonthSectionHTML(prevYear, prevMonth);
        if (temp.firstElementChild) {
          wrapper.insertBefore(temp.firstElementChild, wrapper.firstChild);
          const newScrollHeight = document.documentElement.scrollHeight;
          const diff = newScrollHeight - oldScrollHeight;
          if (diff > 0) {
            window.scrollTo({ top: oldScrollTop + diff, behavior: 'instant' });
          }
        }
      }
    }

    let isNavigatingLock = false;
    let navigatingLockTimer = null;

    // 현재 화면에 보이는 월 감지하여 상단 currentMonthText 갱신
    function updateCurrentVisibleMonth() {
      if (isNavigatingLock) return;
      if (searchQuery && searchQuery.trim()) {
        document.getElementById('currentMonthText').textContent = '전체 기간 검색';
        return;
      }

      const sections = Array.from(document.querySelectorAll('.month-section'));
      if (sections.length === 0) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      let currentSection = sections[0];

      // 스크롤이 페이지 하단에 완전히 도달한 경우 마지막 섹션 활성화
      if (scrollY + windowHeight >= docHeight - 30 && sections.length > 1) {
        currentSection = sections[sections.length - 1];
      } else {
        const checkPointY = Math.min(260, Math.floor(windowHeight * 0.4));
        let bestSection = null;
        let maxOverlap = -1;

        for (let i = 0; i < sections.length; i++) {
          const rect = sections[i].getBoundingClientRect();
          // 체크포인트(260px 부근)에 걸쳐있는 섹션 우선 선택
          if (rect.top <= checkPointY && rect.bottom > checkPointY) {
            bestSection = sections[i];
            break;
          }
          // 차선책: 뷰포트 내 가시 영역이 가장 큰 섹션
          const visibleTop = Math.max(140, rect.top);
          const visibleBottom = Math.min(windowHeight, rect.bottom);
          const overlap = Math.max(0, visibleBottom - visibleTop);
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            bestSection = sections[i];
          }
        }
        if (bestSection) {
          currentSection = bestSection;
        }
      }

      const ym = currentSection.getAttribute('data-month');
      if (ym) {
        const [y, m] = ym.split('-');
        document.getElementById('currentMonthText').textContent = `${y}. ${m}`;
        currentViewDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        window.currentViewDate = currentViewDate;
      }
    }

    let hasUserScrolledDown = false;

    // 스크롤 이벤트 핸들러
    function handleContinuousScroll() {
      if (searchQuery && searchQuery.trim()) return;
      if (isScrollLoading) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollY > 150) {
        hasUserScrolledDown = true;
      }

      // 1. 하단 도달 시 다음 달 자동 로드
      if (scrollY + windowHeight >= docHeight - 350) {
        isScrollLoading = true;
        appendNextMonth();
        setTimeout(() => { isScrollLoading = false; }, 150);
      }

      // 2. 상단 도달 시 이전 달 자동 로드 (사용자가 아래로 스크롤한 후 다시 맨 위로 스크롤했을 때만)
      if (hasUserScrolledDown && scrollY <= 10 && loadedMonths.length > 0) {
        isScrollLoading = true;
        prependPrevMonth();
        setTimeout(() => { isScrollLoading = false; }, 150);
      }

      // 3. 현재 뷰포트에 보이는 월 감지하여 상단 텍스트 갱신
      updateCurrentVisibleMonth();
    }

    // 전역 스크롤 리스너 바인딩
    window.removeEventListener('scroll', handleContinuousScroll);
    window.addEventListener('scroll', handleContinuousScroll, { passive: true });

    // 외부 연동 및 전역 참조 노출
    window.appendNextMonth = appendNextMonth;
    window.prependPrevMonth = prependPrevMonth;
    window.updateCurrentVisibleMonth = updateCurrentVisibleMonth;

    // 연관 일정(linkedScheduleIds) 서브 아이템 누락 방지 및 메타데이터 상속 헬퍼
    function ensureLinkedSubItemsRestored() {
      if (!Array.isArray(allSchedules)) return;
      const newSubItems = [];
      allSchedules.forEach(item => {
        const linkedIds = normalizeLinkedScheduleIds(Array.isArray(item.linkedScheduleIds) ? item.linkedScheduleIds : []);
        linkedIds.forEach(tId => {
          if (tId === item.id) return;
          if (!tId.startsWith('blip_') && !tId.startsWith('mnet_')) return;
          let target = allSchedules.find(s => 
            (s.id && s.id === tId) || (s._originKey && s._originKey === tId) || getScheduleKey(s) === tId
          );
          if (!target) {
            target = newSubItems.find(s => 
              (s.id && s.id === tId) || (s._originKey && s._originKey === tId) || getScheduleKey(s) === tId
            );
          }
          const isBlip = String(tId).startsWith('blip_');
          const isMnet = String(tId).startsWith('mnet_');
          const sourceName = isBlip ? '블립' : (isMnet ? 'Mnet' : '연관');
          const sourceVal = isBlip ? 'blip' : (isMnet ? 'mnet' : 'custom');

          if (!target) {
            target = {
              id: tId,
              _originKey: tId,
              source: sourceVal,
              title: item.title ? `${item.title} (${sourceName} 연계)` : `연계 일정 (${tId})`,
              startTime: item.startTime,
              endTime: item.endTime || item.startTime,
              isAllday: Boolean(item.isAllday),
              typeText: item.typeText || '기타',
              location: item.location || '',
              channel: item.channel || '',
              url: isBlip ? `https://blip.kr/schedule/${String(tId).replace('blip_', '')}` : (item.url || ''),
              linkedScheduleIds: [item.id || item._originKey],
              _isRestoredSub: true
            };
            newSubItems.push(target);
          } else {
            if (!target.title || target.title.startsWith('undefined') || target.title.includes('수집 일정 (')) {
              target.title = `${item.title} (${sourceName} 연계)`;
            }
            if (!target.startTime) target.startTime = item.startTime;
            if (!target.endTime) target.endTime = item.endTime || item.startTime;
            if (!target.typeText) target.typeText = item.typeText || '기타';
            if (!target.source) target.source = sourceVal;
            if (!target.url && isBlip) target.url = `https://blip.kr/schedule/${String(tId).replace('blip_', '')}`;
          }
        });
      });
      if (newSubItems.length > 0) {
        allSchedules.push(...newSubItems);
      }
      window.allSchedules = allSchedules;
    }
    window.ensureLinkedSubItemsRestored = ensureLinkedSubItemsRestored;

    // 메인 렌더링 진입점
    function renderSchedules() {
      const container = document.getElementById('scheduleListContainer');
      const isSearching = Boolean(searchQuery && searchQuery.trim());

      // 외부(테스트 등)에서 window.allSchedules, window.rawBaseSchedules, window.currentViewDate를 주입한 경우 동기화
      if (window.allSchedules && Array.isArray(window.allSchedules) && window.allSchedules !== allSchedules) {
        allSchedules = window.allSchedules;
      }
      if (window.rawBaseSchedules && Array.isArray(window.rawBaseSchedules) && window.rawBaseSchedules !== rawBaseSchedules) {
        rawBaseSchedules = window.rawBaseSchedules;
      }
      if (window.currentViewDate && window.currentViewDate instanceof Date && window.currentViewDate !== currentViewDate) {
        currentViewDate = window.currentViewDate;
      }
      if (window.loadedMonths && Array.isArray(window.loadedMonths) && window.loadedMonths !== loadedMonths) {
        loadedMonths = [...window.loadedMonths];
      }

      // 연관 서브 아이템 존재 보장
      ensureLinkedSubItemsRestored();

      // 상단 신규 일정 배너 갱신
      updateNewScheduleBanner();

      // 신규 수집 일정 모아보기 모드
      if (filterOnlyNewCollected) {
        document.getElementById('currentMonthText').textContent = '새로 수집된 일정';
        const filtered = filterScheduleItems(allSchedules, { isSearching: true });

        if (filtered.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding: 50px 0; color: var(--text-muted);">
              <div style="font-size:32px; margin-bottom:8px;">✨</div>
              <div>새로 수집된 미확인 일정이 없습니다.</div>
              <button onclick="filterOnlyNewCollected=false; renderSchedules();" class="btn-action" style="margin-top:12px; cursor:pointer;">전체 일정으로 돌아가기</button>
            </div>
          `;
          return;
        }

        const newBanner = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #a7f3d0; display:flex; justify-content:space-between; align-items:center;">
            <span>✨ 새로 수집된 일정 모아보기: <strong>${filtered.length}건</strong></span>
            <button onclick="filterOnlyNewCollected=false; renderSchedules();" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px;">✕ 모아보기 닫기</button>
          </div>
        `;

        container.innerHTML = newBanner + renderScheduleGroupsHTML(filtered);
        return;
      }

      if (isSearching) {
        document.getElementById('currentMonthText').textContent = '전체 기간 검색';
        const filtered = filterScheduleItems(allSchedules, { isSearching: true });

        if (filtered.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding: 50px 0; color: var(--text-muted);">
              <div style="font-size:32px; margin-bottom:8px;">🔍</div>
              <div>검색어 "<strong style="color:var(--text-main);">${escapeHtml(searchQuery)}</strong>"와 일치하는 일정이 전체 기간에 없습니다.</div>
            </div>
          `;
          return;
        }

        const searchBanner = `
          <div style="background: rgba(124, 92, 252, 0.15); border: 1px solid rgba(124, 92, 252, 0.3); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #c4b5fd; display:flex; justify-content:space-between; align-items:center;">
            <span>🔍 전체 기간 검색 결과: <strong>${filtered.length}건</strong> (검색어: "${escapeHtml(searchQuery)}")</span>
            <button onclick="if(window.clearSearchState) window.clearSearchState(false); if(window.toggleSearchPanel) window.toggleSearchPanel(false);" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:12px;">✕ 검색 닫기</button>
          </div>
        `;

        container.innerHTML = searchBanner + renderScheduleGroupsHTML(filtered);
        return;
      }

      // 일반 모드: 연속 멀티 먼스 피드
      const year = currentViewDate.getFullYear();
      const month = currentViewDate.getMonth();
      const currentYm = `${year}-${String(month + 1).padStart(2, '0')}`;

      // 이미 로드된 월 목록이 있으면 유지하고 currentYm도 포함되도록 보장
      let monthsToRender = (Array.isArray(loadedMonths) && loadedMonths.length > 0) ? [...loadedMonths] : [currentYm];
      if (!monthsToRender.includes(currentYm)) {
        monthsToRender.push(currentYm);
        monthsToRender.sort();
      }
      loadedMonths = monthsToRender;
      window.loadedMonths = loadedMonths;

      let sectionsHtml = '';
      loadedMonths.forEach(ym => {
        const [y, m] = ym.split('-').map(Number);
        sectionsHtml += buildMonthSectionHTML(y, m - 1);
      });

      container.innerHTML = `
        <div style="display: flex; justify-content: center; padding: 10px 0 6px 0;">
          <button type="button" class="btn-action feed-month-loader-btn" onclick="prependPrevMonth()" title="이전 달 추가 불러오기">⬆️ 이전 달 더 불러오기</button>
        </div>
        <div id="monthSectionsWrapper">
          ${sectionsHtml}
        </div>
        <div style="display: flex; justify-content: center; padding: 14px 0 24px 0;">
          <button type="button" class="btn-action feed-month-loader-btn" onclick="appendNextMonth()" title="다음 달 추가 불러오기">⬇️ 다음 달 더 불러오기</button>
        </div>
      `;

      // 상단 현재 월 표시를 currentViewDate 기준으로 명시 동기화
      document.getElementById('currentMonthText').textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;

      // 초기 렌더링 높이가 낮아 스크롤이 불가능한 경우, 자연스러운 스크롤을 위해 다음 달 자동 프리로드
      setTimeout(() => {
        if (!searchQuery && document.documentElement.scrollHeight <= window.innerHeight + 150) {
          appendNextMonth();
        }
      }, 80);
    }
    window.renderSchedules = renderSchedules;

    // ③ [UI 개선 3] 카드 본체 클릭 시 세부 내용 모달 표시 헬퍼
    function openDetailModalByKey(key) {
      if (!key) return;
      const allList = (Array.isArray(allSchedules) && allSchedules.length > 0) ? allSchedules : (window.allSchedules || []);
      const item = allList.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      if (item && typeof showUserPreviewDetail === 'function') {
        showUserPreviewDetail(item);
      }
    }
    window.openDetailModalByKey = openDetailModalByKey;


    // 모달 열기
    function openEditModalByKey(key) {
      const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      if (!item) return;

      const stableKey = item.id || item._originKey || getScheduleKey(item);
      item._originKey = stableKey;
      document.getElementById('modalHeaderTitle').textContent = item._isCustom ? '수동 등록 일정 세부 수정' : '일정 세부 수정 (공식 원본 보존)';
      document.getElementById('editItemIndex').value = stableKey;
      document.getElementById('editIsNew').value = '0';

      // 공식 원본 placeholder 안내
      const rawList = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);
      const rawItem = rawList.find(b => (b.id && b.id === stableKey) || (b._originKey && b._originKey === stableKey) || getScheduleKey(b) === stableKey);
      if (rawItem && !item._isCustom) {
        document.getElementById('formTitle').placeholder = `공식 원본: ${rawItem.title || ''}`;
        document.getElementById('formLocation').placeholder = rawItem.location ? `공식 원본: ${rawItem.location}` : '장소';
        document.getElementById('formUrl').placeholder = rawItem.url ? `공식 원본: ${rawItem.url}` : 'https://...';
        document.getElementById('formMessage').placeholder = rawItem.message ? `공식 원본: ${rawItem.message}` : '';
      } else {
        document.getElementById('formTitle').placeholder = '일정 제목';
        document.getElementById('formLocation').placeholder = '장소 (선택)';
        document.getElementById('formUrl').placeholder = 'https://...';
        document.getElementById('formMessage').placeholder = '메모 또는 비고 (선택)';
      }

      document.getElementById('formTitle').value = item.title || '';
      if (item.startTime) {
        const d = new Date(item.startTime);
        document.getElementById('formDate').value = formatDateYMD(d);
        if (!item.isAllday) {
          const h = String(d.getHours()).padStart(2, '0');
          const m = String(d.getMinutes()).padStart(2, '0');
          document.getElementById('formTime').value = `${h}:${m}`;
        } else {
          document.getElementById('formTime').value = '';
        }
      }

      const resolvedType = resolveScheduleType(item);
      document.getElementById('formType').value = item.typeText || resolvedType || '기타';
      document.getElementById('formChannel').value = item.channel || '';
      document.getElementById('formUrl').value = item.url || item.link || '';
      clearUrlMetaPreview();
      updateUrlMetaBtnState();
      document.getElementById('formLocation').value = item.location || '';
      document.getElementById('formMessage').value = item.message || '';

      // 참석 멤버 셀렉터 렌더링
      const attendeesContainer = document.getElementById('attendeesSelector');
      if (attendeesContainer) {
        attendeesContainer.innerHTML = '';
        const currentAttendees = Array.isArray(item.starAttendees) ? item.starAttendees : [];
        const currentNames = currentAttendees.map(a => {
          if (typeof a === 'string') return MEMBER_ID_MAP[a] || MEMBER_NICKNAME_MAP[a] || a;
          if (a && a.name) return a.name;
          if (a && a.id && MEMBER_ID_MAP[a.id]) return MEMBER_ID_MAP[a.id];
          if (a && a.nickname && MEMBER_NICKNAME_MAP[a.nickname]) return MEMBER_NICKNAME_MAP[a.nickname];
          return '';
        }).filter(Boolean);

        RESCENE_MEMBERS.forEach(m => {
          const isChecked = currentNames.includes(m.name);
          const chip = document.createElement('label');
          chip.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); user-select: none; transition: all 0.2s;';
          chip.innerHTML = `
            <input type="checkbox" class="attendee-cb" value="${escapeHtml(m.name)}" data-id="${escapeHtml(m.id)}" data-avatar="${escapeHtml(m.avatar)}" ${isChecked ? 'checked' : ''} style="margin: 0; cursor: pointer;">
            <img src="${escapeHtml(m.avatar)}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,105,180,0.5);">
            <span style="font-weight: 600;">${escapeHtml(m.name)}</span>
          `;
          attendeesContainer.appendChild(chip);
        });
      }

      // 연관 일정 연결 후보 렌더링 (KST 기준 동일 날짜 및 인접 날짜 ±1일)
      const linkContainer = document.getElementById('linkedSchedulesContainer');
      if (linkContainer) {
        linkContainer.innerHTML = '';
        const itemKstDate = getKstDate(item.startTime);
        const itemDateStr = formatDateYMD(itemKstDate);
        const currentLinked = Array.isArray(item.linkedScheduleIds) ? item.linkedScheduleIds : [];
        const currentId = item.id || stableKey;

        // 다른 일정 탐색 (자신 및 삭제된 일정 제외)
        const candidates = allSchedules.filter(other => {
          if (!other || other === item) return false;
          const otherId = other.id || other._originKey || getScheduleKey(other);
          if (otherId === currentId) return false;
          if (other._isDeleted) return false;

          const otherKstDate = getKstDate(other.startTime);
          const otherDateStr = formatDateYMD(otherKstDate);

          // 동일 날짜이거나 이미 연결되어 있는 경우
          if (otherDateStr === itemDateStr || currentLinked.includes(otherId)) return true;

          // 인접 ±1일 (시차 또는 겹치는 일정 지원)
          const diffDays = Math.abs((itemKstDate.getTime() - otherKstDate.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 1.5;
        });

        if (candidates.length === 0) {
          linkContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 4px 0;">동일/인접 날짜에 등록된 다른 일정이 없습니다.</div>';
        } else {
          // 동일 날짜 우선, 시작 시간 순 정렬
          candidates.sort((a, b) => {
            const dateA = formatDateYMD(getKstDate(a.startTime));
            const dateB = formatDateYMD(getKstDate(b.startTime));
            const isSameA = dateA === itemDateStr ? 0 : 1;
            const isSameB = dateB === itemDateStr ? 0 : 1;
            if (isSameA !== isSameB) return isSameA - isSameB;
            return (new Date(a.startTime || 0).getTime()) - (new Date(b.startTime || 0).getTime());
          });

          candidates.forEach(cand => {
            const candId = cand.id || cand._originKey || getScheduleKey(cand);
            const isChecked = currentLinked.includes(candId) || (Array.isArray(cand.linkedScheduleIds) && cand.linkedScheduleIds.includes(currentId));
            const candType = cand.typeText || resolveScheduleType(cand) || '기타';
            const candKst = getKstDate(cand.startTime);
            const candDateStr = formatDateYMD(candKst);
            const isSameDay = candDateStr === itemDateStr;
            const candTime = cand.startTime ? (cand.isAllday ? '종일' : `${String(candKst.getHours()).padStart(2, '0')}:${String(candKst.getMinutes()).padStart(2, '0')}`) : '';
            const dayTag = isSameDay ? '' : `<span style="font-size: 9.5px; padding: 1px 4px; border-radius: 3px; background: rgba(234,179,8,0.15); color: #eab308; margin-right: 4px;">${candDateStr.slice(5)}</span>`;

            const row = document.createElement('label');
            row.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; padding: 6px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; transition: background 0.2s;';
            row.innerHTML = `
              <input type="checkbox" class="linked-cand-cb" value="${escapeHtml(candId)}" ${isChecked ? 'checked' : ''} style="cursor: pointer; accent-color: #38bdf8;" onchange="updateLinkedScheduleSuggestions()">
              <span style="display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 600; border-radius: 4px; background: rgba(255,255,255,0.1); color: var(--text-muted);">${escapeHtml(candType)}</span>
              ${dayTag}
              <span style="font-weight: 500; color: var(--text-main); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(cand.title)}</span>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(candTime)}</span>
              <button type="button" class="btn-action fill-linked-btn" style="padding: 2px 6px; font-size: 10.5px; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; border-radius: 4px; margin-left: 6px; flex-shrink: 0; cursor: pointer;" onclick="fillFromLinkedSchedule('${escapeHtml(candId)}', event)" title="이 일정의 정보로 양식 자동 채우기">📥 채우기</button>
            `;
            linkContainer.appendChild(row);
          });
        }
      }

      // 공식 원본 복원 버튼 표시 여부 제어
      const btnModalRestoreOriginal = document.getElementById('btnModalRestoreOriginal');
      const isItemModified = Boolean(item._isModified || (pendingOverrides.modified && pendingOverrides.modified[stableKey]));
      if (btnModalRestoreOriginal) {
        if (rawItem && !item._isCustom && isItemModified) {
          btnModalRestoreOriginal.style.display = 'block';
          btnModalRestoreOriginal.onclick = () => {
            document.getElementById('formTitle').value = rawItem.title || '';
            if (rawItem.startTime) {
              const d = new Date(rawItem.startTime);
              document.getElementById('formDate').value = formatDateYMD(d);
              if (!rawItem.isAllday) {
                const h = String(d.getHours()).padStart(2, '0');
                const m = String(d.getMinutes()).padStart(2, '0');
                document.getElementById('formTime').value = `${h}:${m}`;
              } else {
                document.getElementById('formTime').value = '';
              }
            } else {
              document.getElementById('formDate').value = '';
              document.getElementById('formTime').value = '';
            }
            const rawResolvedType = rawItem.typeText || resolveScheduleType(rawItem) || '기타';
            document.getElementById('formType').value = rawResolvedType;
            document.getElementById('formChannel').value = rawItem.channel || '';
            document.getElementById('formUrl').value = rawItem.url || rawItem.link || '';
            document.getElementById('formLocation').value = rawItem.location || '';
            document.getElementById('formMessage').value = rawItem.message || '';
            clearUrlMetaPreview();
            updateUrlMetaBtnState();
            updateFormLivePreview();
            showToast('공식 원본 내용이 폼에 채워졌습니다.');
          };
        } else {
          btnModalRestoreOriginal.style.display = 'none';
          btnModalRestoreOriginal.onclick = null;
        }
      }

      document.getElementById('btnModalDelete').style.display = 'block';
      updateFormLivePreview();
      updateLinkedScheduleSuggestions();
      document.getElementById('editModalOverlay').classList.add('active');
    }

    function openAddModal() {
      document.getElementById('modalHeaderTitle').textContent = '새 일정 등록';
      document.getElementById('editItemIndex').value = '';
      document.getElementById('editIsNew').value = '1';

      document.getElementById('scheduleEditForm').reset();
      document.getElementById('formType').value = '방송';
      document.getElementById('formTitle').placeholder = '일정 제목';
      document.getElementById('formLocation').placeholder = '장소 (선택)';
      document.getElementById('formUrl').placeholder = 'https://...';
      document.getElementById('formMessage').placeholder = '메모 또는 비고 (선택)';
      document.getElementById('formDate').value = formatDateYMD(new Date());
      clearUrlMetaPreview();
      updateUrlMetaBtnState();

      const attendeesContainer = document.getElementById('attendeesSelector');
      if (attendeesContainer) {
        attendeesContainer.innerHTML = '';
        RESCENE_MEMBERS.forEach(m => {
          const chip = document.createElement('label');
          chip.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); user-select: none; transition: all 0.2s;';
          chip.innerHTML = `
            <input type="checkbox" class="attendee-cb" value="${escapeHtml(m.name)}" data-id="${escapeHtml(m.id)}" data-avatar="${escapeHtml(m.avatar)}" style="margin: 0; cursor: pointer;">
            <img src="${escapeHtml(m.avatar)}" style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,105,180,0.5);">
            <span style="font-weight: 600;">${escapeHtml(m.name)}</span>
          `;
          attendeesContainer.appendChild(chip);
        });
      }

      const linkContainer = document.getElementById('linkedSchedulesContainer');
      if (linkContainer) {
        linkContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 4px 0;">일정 등록 후 세부 수정에서 다른 일정과 연결할 수 있습니다.</div>';
      }

      const btnModalRestoreOriginal = document.getElementById('btnModalRestoreOriginal');
      if (btnModalRestoreOriginal) {
        btnModalRestoreOriginal.style.display = 'none';
        btnModalRestoreOriginal.onclick = null;
      }

      document.getElementById('btnModalDelete').style.display = 'none';
      updateFormLivePreview();
      document.getElementById('editModalOverlay').classList.add('active');
    }

    function closeModal() {
      clearUrlMetaPreview();
      const form = document.getElementById('scheduleEditForm');
      if (form) form.reset();
      const previewCard = document.getElementById('formLivePreviewCard');
      if (previewCard) previewCard.innerHTML = '';
      document.getElementById('editModalOverlay').classList.remove('active');
    }

    // 아이템 숨김/삭제 토글
    function toggleDeleteItem(key) {
      const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      const stableKey = item ? (item.id || item._originKey || key) : key;
      const keysToToggle = new Set([stableKey, key]);
      if (item && item.id) keysToToggle.add(item.id);
      if (item && item._originKey) keysToToggle.add(item._originKey);
      if (item && item.title) keysToToggle.add(item.title);

      // 조작 중인 카드가 위치한 월을 currentViewDate 및 loadedMonths에 보존하여 화면 점프 방지
      if (item && item.startTime) {
        const itemD = new Date(item.startTime);
        if (!isNaN(itemD.getTime())) {
          currentViewDate = new Date(itemD.getFullYear(), itemD.getMonth(), 1);
          window.currentViewDate = currentViewDate;
          const targetYm = `${itemD.getFullYear()}-${String(itemD.getMonth() + 1).padStart(2, '0')}`;
          if (!loadedMonths.includes(targetYm)) {
            loadedMonths.push(targetYm);
            loadedMonths.sort();
            window.loadedMonths = loadedMonths;
          }
        }
      }

      if (item && item._isDeleted) {
        keysToToggle.forEach(k => {
          appliedOverrides.deleted.delete(k);
          pendingOverrides.deleted.delete(k);
        });
        item._isDeleted = false;
        item.isDeleted = false;
      } else {
        const isCurrentlyPendingDel = Array.from(keysToToggle).some(k => pendingOverrides.deleted.has(k));
        if (isCurrentlyPendingDel) {
          keysToToggle.forEach(k => pendingOverrides.deleted.delete(k));
          if (item) {
            item._isDeleted = false;
            item.isDeleted = false;
          }
        } else {
          keysToToggle.forEach(k => {
            pendingOverrides.deleted.add(k);
            delete pendingOverrides.modified[k];
            delete appliedOverrides.modified[k];
          });
          if (item) {
            item._isDeleted = true;
            item.isDeleted = true;
          }
        }
      }
      updateStagingBar();
      renderSchedules();
    }

    function restoreItem(key) {
      const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      const stableKey = item ? (item.id || item._originKey || key) : key;
      const keysToRestore = new Set([stableKey, key]);
      if (item && item.id) keysToRestore.add(item.id);
      if (item && item._originKey) keysToRestore.add(item._originKey);
      if (item && item.title) keysToRestore.add(item.title);

      if (item) {
        item._isDeleted = false;
        item.isDeleted = false;
      }
      keysToRestore.forEach(k => {
        appliedOverrides.deleted.delete(k);
        pendingOverrides.deleted.delete(k);
        delete pendingOverrides.modified[k];
      });

      updateStagingBar();
      renderSchedules();
    }

    // 수정한 일정을 공식 원본(rawBaseSchedules) 데이터로 복구
    function restoreModifiedItem(key) {
      const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
      const stableKey = item ? (item.id || item._originKey || key) : key;
      const keysToRestore = new Set([stableKey, key]);
      if (item && item.id) keysToRestore.add(item.id);
      if (item && item._originKey) keysToRestore.add(item._originKey);
      if (item && item.title) keysToRestore.add(item.title);

      // rawBaseSchedules에서 원본 찾기
      const rawList = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);
      const rawItem = rawList.find(b =>
        (b.id && (b.id === key || b.id === stableKey || (item && b.id === item.id))) ||
        (b._originKey && (b._originKey === key || b._originKey === stableKey)) ||
        getScheduleKey(b) === key || getScheduleKey(b) === stableKey
      );

      if (!rawItem) {
        showToast('공식 원본 데이터를 찾을 수 없습니다.', 'warning');
        return;
      }

      keysToRestore.forEach(k => {
        if (pendingOverrides.modified) delete pendingOverrides.modified[k];
        if (appliedOverrides.modified) delete appliedOverrides.modified[k];
      });

      if (!pendingOverrides.restoredModified) {
        pendingOverrides.restoredModified = new Set();
      }
      keysToRestore.forEach(k => pendingOverrides.restoredModified.add(k));

      if (item) {
        item.title = rawItem.title;
        item.startTime = rawItem.startTime;
        item.endTime = rawItem.endTime || rawItem.startTime;
        item.isAllday = Boolean(rawItem.isAllday);
        item.typeText = rawItem.typeText || resolveScheduleType(rawItem) || '기타';
        item.channel = rawItem.channel || '';
        item.url = rawItem.url || rawItem.link || '';
        item.location = rawItem.location || '';
        item.message = rawItem.message || '';
        item.thumbnail = rawItem.thumbnail;
        item.isOfficialYoutube = rawItem.isOfficialYoutube;
        item.linkedScheduleIds = Array.isArray(rawItem.linkedScheduleIds) ? [...rawItem.linkedScheduleIds] : [];
        item.starAttendees = rawItem.starAttendees;
        item.isPrimary = false;
        item._isModified = false;
        item._isCustom = false;
      }

      updateStagingBar();
      renderSchedules();
      showToast('공식 원본 내용으로 복구되었습니다.');
    }
    window.restoreModifiedItem = restoreModifiedItem;

    // 연관 일정 연결 해제 (상호 양방향 분리)
    function unlinkSchedulePair(keyA, keyB) {
      if (!confirm('이 일정과의 연관 연결을 해제하시겠습니까? (서로 독립된 일정으로 분리됩니다)')) return;

      const itemA = allSchedules.find(s => (s.id && s.id === keyA) || s._originKey === keyA || getScheduleKey(s) === keyA);
      const itemB = allSchedules.find(s => (s.id && s.id === keyB) || s._originKey === keyB || getScheduleKey(s) === keyB);

      if (!itemA || !itemB) return;

      const idA = itemA.id || itemA._originKey || getScheduleKey(itemA);
      const idB = itemB.id || itemB._originKey || getScheduleKey(itemB);

      const applyUnlink = (target, unlinkId) => {
        if (!target) return;
        let links = Array.isArray(target.linkedScheduleIds) ? [...target.linkedScheduleIds] : [];
        target.linkedScheduleIds = links.filter(id => id !== unlinkId && id !== keyA && id !== keyB);
        target._isModified = true;

        const targetKey = target.id || target._originKey || getScheduleKey(target);
        const modObj = {
          title: target.title,
          startTime: target.startTime,
          endTime: target.endTime,
          isAllday: target.isAllday,
          typeText: target.typeText,
          channel: target.channel,
          url: target.url,
          location: target.location,
          message: target.message,
          thumbnail: target.thumbnail,
          isOfficialYoutube: target.isOfficialYoutube,
          starAttendees: target.starAttendees,
          linkedScheduleIds: target.linkedScheduleIds,
          isPrimary: Boolean(target.isPrimary)
        };

        if (target._isCustom) {
          const cIdx = pendingOverrides.created.findIndex(c => (c.id && c.id === targetKey) || c._originKey === targetKey || getScheduleKey(c) === targetKey);
          if (cIdx >= 0) pendingOverrides.created[cIdx] = { ...target, ...modObj };
          else pendingOverrides.created.push({ ...target, ...modObj });
        } else {
          pendingOverrides.modified[targetKey] = modObj;
        }
      };

      applyUnlink(itemA, idB);
      applyUnlink(itemB, idA);

      updateStagingBar();
      renderSchedules();
      showToast('연관 일정 연결이 해제되었습니다.');
    }
    window.unlinkSchedulePair = unlinkSchedulePair;

    // 연관 일정 클러스터 대표 일정 지정
    function setClusterPrimary(targetSubKey, formerPrimaryKey) {
      const targetItem = allSchedules.find(s => (s.id && s.id === targetSubKey) || s._originKey === targetSubKey || getScheduleKey(s) === targetSubKey);
      const formerItem = allSchedules.find(s => (s.id && s.id === formerPrimaryKey) || s._originKey === formerPrimaryKey || getScheduleKey(s) === formerPrimaryKey);

      if (!targetItem) return;

      // 1. targetItem을 isPrimary = true로 설정
      targetItem.isPrimary = true;
      targetItem._isModified = true;

      const targetKey = targetItem.id || targetItem._originKey || getScheduleKey(targetItem);
      const targetModObj = {
        title: targetItem.title,
        startTime: targetItem.startTime,
        endTime: targetItem.endTime,
        isAllday: targetItem.isAllday,
        typeText: targetItem.typeText,
        channel: targetItem.channel,
        url: targetItem.url,
        location: targetItem.location,
        message: targetItem.message,
        thumbnail: targetItem.thumbnail,
        isOfficialYoutube: targetItem.isOfficialYoutube,
        starAttendees: targetItem.starAttendees,
        linkedScheduleIds: Array.isArray(targetItem.linkedScheduleIds) ? [...targetItem.linkedScheduleIds] : [],
        isPrimary: true
      };

      if (targetItem._isCustom) {
        const cIdx = pendingOverrides.created.findIndex(c => (c.id && c.id === targetKey) || c._originKey === targetKey || getScheduleKey(c) === targetKey);
        if (cIdx >= 0) pendingOverrides.created[cIdx] = { ...targetItem, ...targetModObj };
        else pendingOverrides.created.push({ ...targetItem, ...targetModObj });
      } else {
        pendingOverrides.modified[targetKey] = { ...pendingOverrides.modified[targetKey], ...targetModObj };
      }

      // 2. formerItem (및 클러스터 내 다른 항목)의 isPrimary 해제
      if (formerItem && formerItem !== targetItem) {
        delete formerItem.isPrimary;
        formerItem._isModified = true;
        const formerKey = formerItem.id || formerItem._originKey || getScheduleKey(formerItem);
        const formerModObj = {
          title: formerItem.title,
          startTime: formerItem.startTime,
          endTime: formerItem.endTime,
          isAllday: formerItem.isAllday,
          typeText: formerItem.typeText,
          channel: formerItem.channel,
          url: formerItem.url,
          location: formerItem.location,
          message: formerItem.message,
          thumbnail: formerItem.thumbnail,
          isOfficialYoutube: formerItem.isOfficialYoutube,
          starAttendees: formerItem.starAttendees,
          linkedScheduleIds: Array.isArray(formerItem.linkedScheduleIds) ? [...formerItem.linkedScheduleIds] : [],
          isPrimary: false
        };

        if (formerItem._isCustom) {
          const cIdx = pendingOverrides.created.findIndex(c => (c.id && c.id === formerKey) || c._originKey === formerKey || getScheduleKey(c) === formerKey);
          if (cIdx >= 0) pendingOverrides.created[cIdx] = { ...formerItem, ...formerModObj };
          else pendingOverrides.created.push({ ...formerItem, ...formerModObj });
        } else {
          pendingOverrides.modified[formerKey] = { ...pendingOverrides.modified[formerKey], ...formerModObj };
        }
      }

      updateStagingBar();
      renderSchedules();
      showToast(`'${targetItem.title}' 일정이 대표 일정으로 지정되었습니다.`);
    }
    window.setClusterPrimary = setClusterPrimary;

    // === 제외 필터 설정 모달 제어 ===
    let tempFilterKeywords = [];
    let tempFilterEnabled = true;
    let tempExcludeShorts = true;
    let tempExcludeTypes = [];
    let tempExcludeChannels = [];

    function openFilterModal() {
      const activeRules = pendingFilterRules || currentFilterRules;
      tempFilterEnabled = activeRules.enabled !== false;
      tempExcludeShorts = activeRules.excludeShorts !== false;
      tempExcludeTypes = Array.isArray(activeRules.excludeTypes) ? [...activeRules.excludeTypes] : [];
      tempExcludeChannels = Array.isArray(activeRules.excludeChannels) ? [...activeRules.excludeChannels] : [];
      tempFilterKeywords = [...(activeRules.excludeKeywords || DEFAULT_EXCLUDE_KEYWORDS)];

      document.getElementById('filterEngineToggle').checked = tempFilterEnabled;
      document.getElementById('filterExcludeShorts').checked = tempExcludeShorts;
      // excludeTypes 체크박스 상태 동기화
      document.querySelectorAll('#excludeTypesContainer input[type=checkbox]').forEach(cb => {
        cb.checked = tempExcludeTypes.includes(cb.value);
      });
      document.getElementById('inputNewKeyword').value = '';
      const inputCh = document.getElementById('inputNewChannel');
      if (inputCh) inputCh.value = '';
      renderFilterChips();
      renderChannelChips();
      document.getElementById('filterModalOverlay').classList.add('active');
    }

    function closeFilterModal() {
      document.getElementById('filterModalOverlay').classList.remove('active');
    }

    function renderFilterChips() {
      const container = document.getElementById('filterKeywordsContainer');
      document.getElementById('keywordCount').textContent = tempFilterKeywords.length;
      if (tempFilterKeywords.length === 0) {
        container.innerHTML = '<span style="font-size:12px; color:var(--text-muted); padding:4px;">등록된 제외 키워드가 없습니다.</span>';
        return;
      }
      let html = '';
      tempFilterKeywords.forEach((kw, idx) => {
        html += `
          <span class="filter-chip-tag">
            <span>${escapeHtml(kw)}</span>
            <span class="filter-chip-del" onclick="window.removeFilterKeyword(${idx})" title="삭제">✕</span>
          </span>
        `;
      });
      container.innerHTML = html;
    }

    window.removeFilterKeyword = function (idx) {
      if (idx >= 0 && idx < tempFilterKeywords.length) {
        tempFilterKeywords.splice(idx, 1);
        renderFilterChips();
      }
    };

    function addFilterKeyword() {
      const input = document.getElementById('inputNewKeyword');
      const val = input.value.trim();
      if (!val) return;
      if (!tempFilterKeywords.includes(val)) {
        tempFilterKeywords.push(val);
        renderFilterChips();
      }
      input.value = '';
      input.focus();
    }

    function renderChannelChips() {
      const container = document.getElementById('filterChannelsContainer');
      const badge = document.getElementById('channelCount');
      if (badge) badge.textContent = tempExcludeChannels.length;
      if (!container) return;
      if (tempExcludeChannels.length === 0) {
        container.innerHTML = '<span style="font-size:12px; color:var(--text-muted); padding:4px;">등록된 제외 채널이 없습니다.</span>';
        return;
      }
      let html = '';
      tempExcludeChannels.forEach((ch, idx) => {
        html += `
          <span class="filter-chip-tag" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;">
            <span>${escapeHtml(ch)}</span>
            <span class="filter-chip-del" onclick="window.removeFilterChannel(${idx})" title="삭제">✕</span>
          </span>
        `;
      });
      container.innerHTML = html;
    }

    window.removeFilterChannel = function (idx) {
      if (idx >= 0 && idx < tempExcludeChannels.length) {
        tempExcludeChannels.splice(idx, 1);
        renderChannelChips();
      }
    };

    function addFilterChannel(val) {
      const input = document.getElementById('inputNewChannel');
      const channelName = (val !== undefined ? val : (input ? input.value : '')).trim();
      if (!channelName) return;
      if (!tempExcludeChannels.includes(channelName)) {
        tempExcludeChannels.push(channelName);
        renderChannelChips();
      }
      if (val === undefined && input) {
        input.value = '';
        input.focus();
      }
    }

    const btnTogglePipelineMode = document.getElementById('btnTogglePipelineMode');
    if (btnTogglePipelineMode) {
      btnTogglePipelineMode.addEventListener('click', () => {
        const prevMode = currentPipelineConfig.mode || 'auto';
        const newMode = prevMode === 'auto' ? 'review' : 'auto';
        currentPipelineConfig.mode = newMode;
        updatePipelineModeUI();
        updateStagingBar();
        renderSchedules();
        if (newMode === 'review') {
          showToast('🛡️ 관리자 검수 모드로 전환되었습니다. [저장 적용] 시 반영됩니다.');
        } else {
          showToast('⚡ 빠른 반영 모드로 전환되었습니다. [저장 적용] 시 반영됩니다.');
        }
      });
    }

    document.getElementById('btnOpenFilterModal').addEventListener('click', openFilterModal);
    document.getElementById('btnCloseFilterModal').addEventListener('click', closeFilterModal);
    document.getElementById('btnCancelFilterModal').addEventListener('click', closeFilterModal);

    document.getElementById('btnAddKeyword').addEventListener('click', addFilterKeyword);
    document.getElementById('inputNewKeyword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFilterKeyword();
      }
    });

    const btnAddCh = document.getElementById('btnAddChannel');
    if (btnAddCh) btnAddCh.addEventListener('click', () => addFilterChannel());
    const inputNewCh = document.getElementById('inputNewChannel');
    if (inputNewCh) {
      inputNewCh.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addFilterChannel();
        }
      });
    }

    document.querySelectorAll('.btn-quick-channel').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = btn.getAttribute('data-channel');
        if (ch) addFilterChannel(ch);
      });
    });

    document.getElementById('btnResetDefaultKeywords').addEventListener('click', () => {
      if (confirm('기본 필터 세트(투표/직캠/이벤트 36개 키워드)로 복원하시겠습니까?')) {
        tempFilterKeywords = [...DEFAULT_EXCLUDE_KEYWORDS];
        tempFilterEnabled = true;
        tempExcludeShorts = true;
        tempExcludeTypes = [];
        tempExcludeChannels = [];
        document.getElementById('filterEngineToggle').checked = true;
        document.getElementById('filterExcludeShorts').checked = true;
        document.querySelectorAll('#excludeTypesContainer input[type=checkbox]').forEach(cb => { cb.checked = false; });
        renderFilterChips();
        renderChannelChips();
      }
    });

    document.getElementById('btnApplyFilterModal').addEventListener('click', () => {
      const enabled = document.getElementById('filterEngineToggle').checked;
      const excludeShorts = document.getElementById('filterExcludeShorts').checked;
      const excludeTypes = [];
      document.querySelectorAll('#excludeTypesContainer input[type=checkbox]').forEach(cb => {
        if (cb.checked) excludeTypes.push(cb.value);
      });
      pendingFilterRules = {
        enabled,
        excludeShorts,
        excludeTypes,
        excludeChannels: [...tempExcludeChannels],
        excludeKeywords: [...tempFilterKeywords]
      };
      closeFilterModal();
      updateStagingBar();
      renderSchedules();
    });

    // === URL 메타데이터 및 참고 정보 수집/표시/복사 엔진 ===
    function decodeHtmlEntities(str) {
      if (!str) return '';
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    }

    function getUrlPlatformType(url) {
      if (!url || typeof url !== 'string') return null;
      const clean = url.trim();
      if (/youtu\.be\/|youtube\.com\/(?:watch|shorts|live)/i.test(clean)) return 'youtube';
      if (/(?:twitter\.com|x\.com)\/[^/]+\/status\/\d+/i.test(clean)) return 'twitter';
      if (/tiktok\.com\/(@[^/]+\/video\/\d+|v\/|t\/)/i.test(clean) || /vt\.tiktok\.com\/[\w-]+/i.test(clean)) return 'tiktok';
      if (/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i.test(clean)) return 'instagram';
      if (/^https?:\/\//i.test(clean)) return 'web';
      return null;
    }

    function updateUrlMetaBtnState() {
      const urlInput = document.getElementById('formUrl');
      const btn = document.getElementById('btnFetchUrlMeta');
      if (!urlInput || !btn) return;

      const type = getUrlPlatformType(urlInput.value);
      if (!type) {
        btn.style.display = 'none';
        return;
      }

      let label = '⚡ 정보 가져오기';
      let bg = 'rgba(56, 189, 248, 0.15)';
      let color = '#38bdf8';
      let border = 'rgba(56, 189, 248, 0.35)';

      if (type === 'youtube') {
        label = '▶️ 유튜브 자동입력';
        bg = 'rgba(239, 68, 68, 0.15)';
        color = '#f87171';
        border = 'rgba(239, 68, 68, 0.35)';
      } else if (type === 'twitter') {
        label = '𝕏 본문 가져오기';
        bg = 'rgba(148, 163, 184, 0.15)';
        color = '#e2e8f0';
        border = 'rgba(148, 163, 184, 0.35)';
      } else if (type === 'instagram') {
        label = '📸 인스타 가져오기';
        bg = 'rgba(236, 72, 153, 0.15)';
        color = '#f472b6';
        border = 'rgba(236, 72, 153, 0.35)';
      } else if (type === 'tiktok') {
        label = '🎵 틱톡 가져오기';
        bg = 'rgba(45, 212, 191, 0.15)';
        color = '#2dd4bf';
        border = 'rgba(45, 212, 191, 0.35)';
      } else if (type === 'web') {
        label = '🌐 참고정보 조회';
        bg = 'rgba(124, 92, 252, 0.15)';
        color = '#a78bfa';
        border = 'rgba(124, 92, 252, 0.35)';
      }

      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.innerHTML = label;
      btn.style.background = bg;
      btn.style.color = color;
      btn.style.borderColor = border;
    }

    function clearUrlMetaPreview() {
      const panel = document.getElementById('urlMetaPreviewPanel');
      if (panel) {
        panel.style.display = 'none';
        panel.innerHTML = '';
      }
      clearFieldSuggestions();
    }

    function copyToClipboard(text, btnElement) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        if (btnElement) {
          const orig = btnElement.innerHTML;
          btnElement.innerHTML = '✅ 복사됨!';
          setTimeout(() => { btnElement.innerHTML = orig; }, 1500);
        }
        showToast('클립보드에 복사되었습니다.');
      }).catch(() => {
        showToast('복사에 실패했습니다.');
      });
    }

    function applyValueToFormField(fieldId, val, btnElement) {
      const el = document.getElementById(fieldId);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        if (btnElement) {
          const orig = btnElement.innerHTML;
          btnElement.innerHTML = '✅ 적용됨';
          setTimeout(() => { btnElement.innerHTML = orig; }, 1500);
        }
        showToast(`${fieldId === 'formTitle' ? '제목' : fieldId === 'formChannel' ? '채널' : '메모'}란에 적용되었습니다.`);
      }
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 3800) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(tid);
        return response;
      } catch (err) {
        clearTimeout(tid);
        throw err;
      }
    }

    async function fetchUrlMetadata() {
      const urlInput = document.getElementById('formUrl');
      const panel = document.getElementById('urlMetaPreviewPanel');
      const btn = document.getElementById('btnFetchUrlMeta');
      if (!urlInput || !panel) return;

      const rawUrl = urlInput.value.trim();
      const type = getUrlPlatformType(rawUrl);
      if (!type) {
        showToast('올바른 URL을 입력해주세요.');
        return;
      }

      const setButtonsLoading = (loading) => {
        if (btn) {
          btn.disabled = loading;
          btn.innerHTML = loading ? '⏳ 조회 중...' : btn.innerHTML;
        }
      };

      setButtonsLoading(true);
      panel.style.display = 'block';
      panel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); padding: 8px 0;">
          <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
          <span>정보를 불러오는 중입니다...</span>
        </div>
      `;

      try {
        let meta = null;

        // 1. YouTube
        if (type === 'youtube') {
          const res = await fetchWithTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`);
          if (!res.ok) throw new Error('유튜브 정보를 가져올 수 없습니다.');
          const yt = await res.json();
          meta = {
            platform: 'youtube',
            platformName: 'YouTube',
            title: yt.title || '',
            author: yt.author_name || '',
            thumbnail: yt.thumbnail_url || '',
            description: yt.title || '',
            isSns: true
          };
        }
        // 2. Twitter / X
        else if (type === 'twitter') {
          const res = await fetchWithTimeout(`https://publish.twitter.com/oembed?url=${encodeURIComponent(rawUrl)}&omit_script=true`);
          if (!res.ok) throw new Error('트위터 oEmbed 조회 실패');
          const tw = await res.json();
          let tweetText = '';
          if (tw.html) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = tw.html;
            const p = tempDiv.querySelector('p');
            tweetText = p ? p.innerText.trim() : tempDiv.innerText.trim();
          }
          meta = {
            platform: 'twitter',
            platformName: 'X (Twitter)',
            title: tweetText.split('\n')[0].slice(0, 60),
            author: tw.author_name || '',
            description: tweetText,
            isSns: true
          };
        }
        // 3. TikTok
        else if (type === 'tiktok') {
          const res = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`);
          if (!res.ok) throw new Error('틱톡 oEmbed 조회 실패');
          const tk = await res.json();
          meta = {
            platform: 'tiktok',
            platformName: 'TikTok',
            title: tk.title || '',
            author: tk.author_name || '',
            thumbnail: tk.thumbnail_url || '',
            description: tk.title || '',
            isSns: true
          };
        }
        // 4. Instagram
        else if (type === 'instagram') {
          const m = rawUrl.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/i);
          const shortcode = m ? m[1] : '';
          let igCaption = '';
          let igAuthor = '';
          let igThumb = '';
          let igLocation = '';

          // 1순위: Microlink API (인스타그램 릴스/포스트 정밀 메타데이터 수집기)
          try {
            const microRes = await fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(rawUrl)}`, {}, 4000);
            if (microRes.ok) {
              const microData = await microRes.json();
              if (microData?.status === 'success' && microData?.data) {
                const d = microData.data;
                let desc = d.description || '';
                // 인스타그램 메타 접두사 ("hufsdorm on September 9, 2026: \"..." 또는 "xxx: ”") 제거
                desc = desc.replace(/^[^:]+on[^:]+:\s*["”]?/i, '').replace(/["”]?\s*\.?\s*$/, '').trim();
                igCaption = desc;
                igAuthor = d.author || '';
                igThumb = d.image?.url || '';

                // 본문 속 장소 패턴 자동 감지 (예: 📍장소: 기숙사 잔디광장, 장소: ...)
                const locMatch = desc.match(/(?:📍\s*장소|장소)\s*[:：]\s*([^\n\r]+)/i);
                if (locMatch) {
                  igLocation = locMatch[1].trim();
                }
              }
            }
          } catch (eMicro) { }

          // 2순위: 캐시 확인
          if (!igCaption) {
            const foundInCache = allSchedules.find(s => (s.url && s.url.includes(shortcode)) || (s.link && s.link.includes(shortcode)) || (s.id && s.id.includes(shortcode)));
            if (foundInCache) {
              igCaption = foundInCache.message || foundInCache.title || '';
              igAuthor = foundInCache.channel || igAuthor;
              igThumb = foundInCache.thumbnail || '';
              igLocation = foundInCache.location || '';
            }
          }

          // 3순위: embed 프록시 폴백
          let htmlStr = '';
          if (!igCaption && shortcode) {
            try {
              const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
              const proxyRes = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(embedUrl)}`, {}, 3000);
              if (proxyRes.ok) {
                const pRes1 = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(rawUrl)}`, {}, 3200);
                if (pRes1.ok) {
                  const pd1 = await pRes1.json();
                  htmlStr = pd1?.contents || '';
                  if (htmlStr && !igCaption) {
                    const m = htmlStr.match(/<title>([^<]+)<\/title>/i);
                    if (m && m[1]) igCaption = m[1].replace(/Instagram.*$/i, '').trim();
                  }
                }
              }
            } catch (e1) { }
          }

          // 제목 도출: 캡션의 첫 번째 대괄호 태그 우선, 없으면 첫 줄/첫 문장
          let title = '';
          if (igCaption) {
            const bracketMatch = igCaption.match(/^(\[[^\]]+\])/);
            if (bracketMatch) {
              title = bracketMatch[1].trim();
            } else {
              const firstLine = igCaption.split('\n')[0].trim();
              const sentMatch = firstLine.match(/^[^.!?~]+/);
              title = (sentMatch ? sentMatch[0].trim() : firstLine).slice(0, 60);
            }
          }
          if (!title) {
            title = rawUrl.includes('/reel/') ? 'RESCENE Instagram Reel' : 'RESCENE Instagram';
          }

          meta = {
            platform: 'instagram',
            platformName: 'Instagram',
            title: title,
            author: igAuthor || 'rescene_official',
            thumbnail: igThumb,
            description: igCaption,
            location: igLocation,
            isSns: true
          };
        }
        // 5. General Web (Open Graph 메타 파싱)
        else {
          let ogTitle = '';
          let ogDesc = '';
          let ogSite = '';
          let ogImage = '';

          try {
            const urlObj = new URL(rawUrl);
            ogSite = urlObj.hostname.replace(/^www\./, '');
            if (ogSite.includes('naver.com')) ogSite = '네이버 뉴스';
            else if (ogSite.includes('interpark.com')) ogSite = '인터파크 티켓';
            else if (ogSite.includes('yes24.com')) ogSite = 'YES24 티켓';
            else if (ogSite.includes('melon.com')) ogSite = '멜론 티켓';
            else if (ogSite.includes('weverse.io')) ogSite = '위버스';
            else if (ogSite.includes('daum.net')) ogSite = '다음 팬카페';
          } catch (e) { }

          try {
            let htmlStr = '';
            try {
              const pRes1 = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(rawUrl)}`, {}, 3200);
              if (pRes1.ok) {
                const pd1 = await pRes1.json();
                htmlStr = pd1?.contents || '';
              }
            } catch (e1) {
              try {
                const pRes2 = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(rawUrl)}`, {}, 3200);
                if (pRes2.ok) htmlStr = await pRes2.text();
              } catch (e2) { }
            }

            if (htmlStr) {
              const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
              ogTitle = doc.querySelector('meta[property="og:title"]')?.content || doc.querySelector('title')?.innerText || '';
              ogDesc = doc.querySelector('meta[property="og:description"]')?.content || doc.querySelector('meta[name="description"]')?.content || '';
              ogSite = doc.querySelector('meta[property="og:site_name"]')?.content || ogSite;
              ogImage = doc.querySelector('meta[property="og:image"]')?.content || '';
            }
          } catch (e) { }

          meta = {
            platform: 'web',
            platformName: ogSite || '일반 웹페이지',
            title: ogTitle.trim(),
            author: ogSite.trim(),
            thumbnail: ogImage.trim(),
            description: ogDesc.trim(),
            isSns: false // 일반 웹페이지는 자동 입력 절대 안 함!
          };
        }

        renderMetaPreviewPanel(meta);

      } catch (err) {
        panel.innerHTML = `
          <div style="color: #ef4444; display: flex; align-items: center; justify-content: space-between; padding: 4px 0;">
            <span>⚠️ 정보 조회에 실패했습니다. (${escapeHtml(err.message || '네트워크 오류')})</span>
            <button type="button" class="btn-action" style="padding: 2px 6px; font-size: 10.5px;" onclick="clearUrlMetaPreview()">닫기</button>
          </div>
        `;
      } finally {
        setButtonsLoading(false);
        updateUrlMetaBtnState();
      }
    }

    // ---------- 필드 제안 UI ----------
    function renderFieldSuggestions(meta) {
      clearFieldSuggestions();
      const map = {
        title:    {field: 'formTitle',    container: 'suggestTitle'},
        date:     {field: 'formDate',    container: 'suggestDate'},
        type:     {field: 'formType',    container: 'suggestType'},
        channel:  {field: 'formChannel', container: 'suggestChannel'},
        location: {field: 'formLocation',container: 'suggestLocation'},
        message:  {field: 'formMessage', container: 'suggestMessage'}
      };
      Object.entries(map).forEach(([key, {field, container}]) => {
        const val = meta[key];
        if (!val) return;
        const cnt = document.getElementById(container);
        if (!cnt) return;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggest-chip';
        chip.textContent = val;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          applyFieldSuggestion(field, val);
        });
        cnt.appendChild(chip);
        cnt.style.display = '';  // display:none 해제하여 칩이 보이도록
      });
    }
    function clearFieldSuggestions() {
      ['suggestTitle','suggestDate','suggestTime','suggestType','suggestChannel','suggestUrl','suggestLocation','suggestMessage']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.innerHTML = ''; el.style.display = 'none'; }
        });
    }
    function applyFieldSuggestion(fieldId, value) {
      const input = document.getElementById(fieldId);
      if (input) input.value = value;
      updateFormLivePreview();
      showToast(`${fieldId.replace('form','')}에 적용되었습니다.`);
    }
    function applyAllFieldSuggestions() {
      const fields = ['formTitle','formDate','formTime','formType','formChannel','formUrl','formLocation','formMessage'];
      fields.forEach(f => {
        const input = document.getElementById(f);
        if (input && !input.value) {
          const container = document.getElementById('suggest' + f.replace('form',''));
          const chip = container?.querySelector('.suggest-chip');
          if (chip) applyFieldSuggestion(f, chip.dataset.val || chip.textContent);
        }
      });
    }

    // ---------- 연관 일정 추천 칩 및 정보 채우기 UI ----------
    function updateLinkedScheduleSuggestions() {
      const checkedCbs = Array.from(document.querySelectorAll('.linked-cand-cb:checked'));
      // 기존 연관 추천 칩 제거
      document.querySelectorAll('.linked-suggest-chip').forEach(el => el.remove());

      if (checkedCbs.length === 0) {
        ['suggestTitle','suggestDate','suggestTime','suggestType','suggestChannel','suggestUrl','suggestLocation','suggestMessage'].forEach(id => {
          const c = document.getElementById(id);
          if (c && c.querySelectorAll('.suggest-chip').length === 0) c.style.display = 'none';
        });
        return;
      }

      const map = {
        title:    {field: 'formTitle',    container: 'suggestTitle'},
        date:     {field: 'formDate',     container: 'suggestDate'},
        time:     {field: 'formTime',     container: 'suggestTime'},
        type:     {field: 'formType',     container: 'suggestType'},
        channel:  {field: 'formChannel',  container: 'suggestChannel'},
        url:      {field: 'formUrl',      container: 'suggestUrl'},
        location: {field: 'formLocation', container: 'suggestLocation'},
        message:  {field: 'formMessage',  container: 'suggestMessage'}
      };

      checkedCbs.forEach(cb => {
        const candId = cb.value;
        const cand = allSchedules.find(s => (s.id && s.id === candId) || s._originKey === candId || getScheduleKey(s) === candId);
        if (!cand) return;

        const srcName = cand.source === 'mnet' ? 'Mnet' : (cand.source === 'blip' ? 'Blip' : (cand._isCustom ? '수동' : '연관'));

        const candData = {
          title: cand.title,
          date: cand.startTime ? formatDateYMD(getKstDate(cand.startTime)) : '',
          time: (!cand.isAllday && cand.startTime) ? `${String(getKstDate(cand.startTime).getHours()).padStart(2, '0')}:${String(getKstDate(cand.startTime).getMinutes()).padStart(2, '0')}` : '',
          type: cand.typeText || resolveScheduleType(cand) || '',
          channel: cand.channel || '',
          url: cand.url || cand.link || '',
          location: cand.location || '',
          message: cand.message || ''
        };

        Object.entries(map).forEach(([key, {field, container}]) => {
          const val = candData[key];
          if (!val) return;
          const cnt = document.getElementById(container);
          if (!cnt) return;

          // 동일한 값이 이미 칩으로 있으면 중복 생성 방지
          const existingChips = Array.from(cnt.querySelectorAll('.suggest-chip'));
          if (existingChips.some(c => (c.dataset.val === val || c.textContent.includes(val)))) return;

          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'suggest-chip linked-suggest-chip';
          chip.dataset.val = val;
          chip.style.cssText = 'background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8;';
          chip.innerHTML = `<span style="font-size: 9.5px; opacity: 0.8; margin-right: 4px;">🔗[${srcName}]</span><span>${escapeHtml(val)}</span>`;
          chip.addEventListener('click', (e) => {
            e.preventDefault();
            applyFieldSuggestion(field, val);
          });
          cnt.appendChild(chip);
          cnt.style.display = '';
        });
      });
    }
    window.updateLinkedScheduleSuggestions = updateLinkedScheduleSuggestions;

    function fillFromLinkedSchedule(candId, event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const cand = allSchedules.find(s => (s.id && s.id === candId) || s._originKey === candId || getScheduleKey(s) === candId);
      if (!cand) return;

      if (cand.title) document.getElementById('formTitle').value = cand.title;
      if (cand.startTime) {
        const d = getKstDate(cand.startTime);
        document.getElementById('formDate').value = formatDateYMD(d);
        if (!cand.isAllday) {
          const h = String(d.getHours()).padStart(2, '0');
          const m = String(d.getMinutes()).padStart(2, '0');
          document.getElementById('formTime').value = `${h}:${m}`;
        } else {
          document.getElementById('formTime').value = '';
        }
      }
      const candType = cand.typeText || resolveScheduleType(cand);
      if (candType) document.getElementById('formType').value = candType;
      if (cand.channel) document.getElementById('formChannel').value = cand.channel;
      if (cand.url || cand.link) document.getElementById('formUrl').value = cand.url || cand.link;
      if (cand.location) document.getElementById('formLocation').value = cand.location;
      if (cand.message) document.getElementById('formMessage').value = cand.message;

      // 참석 멤버 동기화
      if (Array.isArray(cand.starAttendees) && cand.starAttendees.length > 0) {
        const names = cand.starAttendees.map(a => typeof a === 'string' ? a : a.name).filter(Boolean);
        document.querySelectorAll('.attendee-cb').forEach(cb => {
          cb.checked = names.includes(cb.value);
        });
      }

      // 해당 후보 체크박스 자동 체크
      const cb = document.querySelector(`.linked-cand-cb[value="${candId}"]`);
      if (cb) cb.checked = true;

      updateUrlMetaBtnState();
      updateFormLivePreview();
      updateLinkedScheduleSuggestions();
      showToast(`'${cand.title}' 일정의 정보로 양식이 채워졌습니다.`);
    }
    window.fillFromLinkedSchedule = fillFromLinkedSchedule;

    function renderMetaPreviewPanel(meta) {
      const panel = document.getElementById('urlMetaPreviewPanel');
      if (!panel || !meta) return;
      panel.innerHTML = '';
      panel.style.display = '';  // display:none 해제

      // 메타데이터 정규화 (모든 추천 칩이 정상 노출되도록 보정)
      meta.channel = meta.channel || meta.author || '';
      meta.message = meta.message || meta.description || '';

      if (!meta.date) {
        const textToSearch = `${meta.title || ''} ${meta.message || ''}`;
        let dateMatch = textToSearch.match(/(?:📍\s*일시|일시|날짜)\s*[:：]?\s*(?:20)?(2[4-9])[-./년\s]+(1[0-2]|0?[1-9])[-./월\s]+([12][0-9]|3[01]|0?[1-9])일?/i);
        if (!dateMatch) {
          dateMatch = textToSearch.match(/(?:20)?(2[4-9])[-./년\s]+(1[0-2]|0?[1-9])[-./월\s]+([12][0-9]|3[01]|0?[1-9])일?/);
        }
        if (dateMatch) {
          const y = '20' + dateMatch[1];
          const m = dateMatch[2].padStart(2, '0');
          const d = dateMatch[3].padStart(2, '0');
          meta.date = `${y}-${m}-${d}`;
        }
      }

      if (!meta.type) {
        const autoType = resolveScheduleType({ title: meta.title, message: meta.message, channel: meta.channel, source: meta.platform });
        if (autoType && autoType !== '기타') {
          meta.type = autoType;
        } else if (meta.platform === 'youtube' || meta.platform === 'tiktok') {
          meta.type = '영상';
        }
      }

      // 항상 추천 칩 UI 표시 (SNS 여부와 무관)
      renderFieldSuggestions(meta);

      const createHeaderActions = () => {
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; align-items: center; gap: 6px; margin: 0; padding: 0;';

        const applyAllBtn = document.createElement('button');
        applyAllBtn.type = 'button';
        applyAllBtn.className = 'apply-all-btn';
        applyAllBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; font-weight: 600; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px; box-sizing: border-box; margin: 0; border: 1px solid rgba(56, 189, 248, 0.45); background: rgba(56, 189, 248, 0.2); color: #38bdf8; line-height: 1;';
        applyAllBtn.innerHTML = '✨ 전체 적용';
        applyAllBtn.addEventListener('click', (e) => {
          e.preventDefault();
          applyAllFieldSuggestions();
        });
        actionsDiv.appendChild(applyAllBtn);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-action';
        closeBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; font-weight: 600; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; color: var(--text-muted); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); line-height: 1;';
        closeBtn.textContent = '✕ 닫기';
        closeBtn.addEventListener('click', clearUrlMetaPreview);
        actionsDiv.appendChild(closeBtn);

        return actionsDiv;
      };

      if (meta.isSns) {
        // SNS인 경우: 헤더 및 본문 미리보기 표시 (폼 자동채우기는 제거됨)
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;';
        header.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; align-items: center; height: 22px; padding: 0 6px; font-size: 10px; font-weight: 700; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; box-sizing: border-box;">${escapeHtml(meta.platformName || '')}</span>
            <span style="font-weight: 600; color: var(--text-main); font-size: 12px; line-height: 22px;">SNS 참고 정보</span>
          </div>
        `;
        header.appendChild(createHeaderActions());
        container.appendChild(header);

        if (meta.description) {
          const descBox = document.createElement('div');
          descBox.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px; max-height: 120px; overflow-y: auto; color: var(--text-main); font-size: 11px; white-space: pre-wrap; word-break: break-word; line-height: 1.5;';
          descBox.textContent = meta.description;
          container.appendChild(descBox);

          const btnRow = document.createElement('div');
          btnRow.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px;';

          const copyDescBtn = document.createElement('button');
          copyDescBtn.type = 'button';
          copyDescBtn.className = 'btn-action';
          copyDescBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 4px;';
          copyDescBtn.textContent = '📋 본문 전체 복사';
          copyDescBtn.addEventListener('click', () => copyToClipboard(meta.description, copyDescBtn));
          btnRow.appendChild(copyDescBtn);

          const applyMemoBtn = document.createElement('button');
          applyMemoBtn.type = 'button';
          applyMemoBtn.className = 'btn-action';
          applyMemoBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 4px;';
          applyMemoBtn.textContent = '📝 메모란에 넣기';
          applyMemoBtn.addEventListener('click', () => applyValueToFormField('formMessage', meta.description, applyMemoBtn));
          btnRow.appendChild(applyMemoBtn);

          if (meta.title) {
            const applyTitleBtn = document.createElement('button');
            applyTitleBtn.type = 'button';
            applyTitleBtn.className = 'btn-action';
            applyTitleBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 4px;';
            applyTitleBtn.textContent = '✏️ 제목란에 넣기';
            applyTitleBtn.addEventListener('click', () => applyValueToFormField('formTitle', meta.title, applyTitleBtn));
            btnRow.appendChild(applyTitleBtn);
          }

          container.appendChild(btnRow);
        } else if (meta.title) {
          const titleRow = document.createElement('div');
          titleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted);';
          titleRow.innerHTML = `<span>제목: <strong style="color:var(--text-main);">${escapeHtml(meta.title)}</strong></span>`;
          const copyTitleBtn = document.createElement('button');
          copyTitleBtn.type = 'button';
          copyTitleBtn.className = 'btn-action';
          copyTitleBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 4px;';
          copyTitleBtn.textContent = '📋 제목 복사';
          copyTitleBtn.addEventListener('click', () => copyToClipboard(meta.title, copyTitleBtn));
          titleRow.appendChild(copyTitleBtn);
          container.appendChild(titleRow);
        }

        panel.appendChild(container);
        showToast('SNS 참고 정보를 표시했습니다.');
      }
      // 2) 일반 웹페이지인 경우: 폼 변경 없이 참고 정보만 표시!
      else {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;';
        header.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; align-items: center; height: 22px; padding: 0 6px; font-size: 10px; font-weight: 700; border-radius: 4px; background: rgba(124, 92, 252, 0.2); color: #c4b5fd; box-sizing: border-box;">💡 웹페이지 참고 정보</span>
            <span style="font-size: 10.5px; color: var(--text-muted); line-height: 22px;">(자동 입력 안 함 • 클릭하여 개별 적용)</span>
          </div>
        `;
        header.appendChild(createHeaderActions());
        container.appendChild(header);

        // 출처/사이트명
        if (meta.author) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;';
          row.innerHTML = `
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
              <span style="color: var(--text-muted);">출처/사이트:</span> <strong style="color: var(--text-main);">${escapeHtml(meta.author)}</strong>
            </div>
          `;
          const act = document.createElement('div');
          act.style.cssText = 'display: flex; gap: 4px; flex-shrink: 0; align-items: center;';
          const cpBtn = document.createElement('button');
          cpBtn.type = 'button';
          cpBtn.className = 'btn-action';
          cpBtn.style.cssText = 'height: 22px; padding: 0 6px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          cpBtn.textContent = '📋 복사';
          cpBtn.addEventListener('click', () => copyToClipboard(meta.author, cpBtn));
          act.appendChild(cpBtn);

          const apBtn = document.createElement('button');
          apBtn.type = 'button';
          apBtn.className = 'btn-action';
          apBtn.style.cssText = 'height: 22px; padding: 0 6px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          apBtn.textContent = '⬇️ 채널에 적용';
          apBtn.addEventListener('click', () => applyValueToFormField('formChannel', meta.author, apBtn));
          act.appendChild(apBtn);
          row.appendChild(act);
          container.appendChild(row);
        }

        // 제목
        if (meta.title) {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: rgba(255,255,255,0.02); border-radius: 4px;';
          row.innerHTML = `
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
              <span style="color: var(--text-muted);">제목:</span> <strong style="color: var(--text-main);">${escapeHtml(meta.title)}</strong>
            </div>
          `;
          const act = document.createElement('div');
          act.style.cssText = 'display: flex; gap: 4px; flex-shrink: 0; align-items: center;';
          const cpBtn = document.createElement('button');
          cpBtn.type = 'button';
          cpBtn.className = 'btn-action';
          cpBtn.style.cssText = 'height: 22px; padding: 0 6px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          cpBtn.textContent = '📋 복사';
          cpBtn.addEventListener('click', () => copyToClipboard(meta.title, cpBtn));
          act.appendChild(cpBtn);

          const apBtn = document.createElement('button');
          apBtn.type = 'button';
          apBtn.className = 'btn-action';
          apBtn.style.cssText = 'height: 22px; padding: 0 6px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          apBtn.textContent = '⬇️ 제목에 적용';
          apBtn.addEventListener('click', () => applyValueToFormField('formTitle', meta.title, apBtn));
          act.appendChild(apBtn);
          row.appendChild(act);
          container.appendChild(row);
        }

        // 본문 요약 / 설명
        if (meta.description) {
          const descBox = document.createElement('div');
          descBox.style.cssText = 'padding: 6px 8px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;';
          descBox.innerHTML = `
            <div style="color: var(--text-muted); margin-bottom: 4px; font-size: 10.5px;">본문 요약 / 설명:</div>
            <div style="color: var(--text-main); font-size: 11px; max-height: 80px; overflow-y: auto; line-height: 1.4; word-break: break-word; margin-bottom: 6px; white-space: pre-wrap;">${escapeHtml(meta.description)}</div>
          `;
          const act = document.createElement('div');
          act.style.cssText = 'display: flex; gap: 6px; align-items: center;';
          const cpBtn = document.createElement('button');
          cpBtn.type = 'button';
          cpBtn.className = 'btn-action';
          cpBtn.style.cssText = 'height: 22px; padding: 0 8px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          cpBtn.textContent = '📋 요약 복사';
          cpBtn.addEventListener('click', () => copyToClipboard(meta.description, cpBtn));
          act.appendChild(cpBtn);

          const apBtn = document.createElement('button');
          apBtn.type = 'button';
          apBtn.className = 'btn-action';
          apBtn.style.cssText = 'height: 22px; padding: 0 8px; font-size: 10.5px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 4px; gap: 3px;';
          apBtn.textContent = '⬇️ 메모에 적용';
          apBtn.addEventListener('click', () => applyValueToFormField('formMessage', meta.description, apBtn));
          act.appendChild(apBtn);
          descBox.appendChild(act);
          container.appendChild(descBox);
        }

        panel.appendChild(container);
        showToast('웹페이지 참고 정보를 패널에 표시했습니다.');
      }
    }

    // URL 이벤트 리스너 바인딩
    document.getElementById('formUrl').addEventListener('input', updateUrlMetaBtnState);
    document.getElementById('formUrl').addEventListener('change', updateUrlMetaBtnState);
    document.getElementById('btnFetchUrlMeta').addEventListener('click', fetchUrlMetadata);

    // 폼 저장
    document.getElementById('scheduleEditForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const isNew = document.getElementById('editIsNew').value === '1';
      const key = document.getElementById('editItemIndex').value;

      const title = document.getElementById('formTitle').value.trim();
      const dateStr = document.getElementById('formDate').value;
      const timeRaw = document.getElementById('formTime').value;
      const typeText = document.getElementById('formType').value;
      const channel = document.getElementById('formChannel').value.trim();
      const url = document.getElementById('formUrl').value.trim();
      const location = document.getElementById('formLocation').value.trim();
      const message = document.getElementById('formMessage').value.trim();

      let timeFormatted = '';
      if (timeRaw && timeRaw.trim()) {
        const parts = timeRaw.trim().split(':');
        if (parts.length >= 2) {
          timeFormatted = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
        }
      }
      const startTime = timeFormatted ? `${dateStr}T${timeFormatted}:00+09:00` : `${dateStr}T00:00:00+09:00`;
      const isAllday = !timeFormatted;

      // 유튜브 썸네일 자동 감지
      let thumbnail = undefined;
      let isOfficialYoutube = undefined;
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|live\/))([\w-]{11})/);
      if (ytMatch) {
        thumbnail = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
        // RESCENE 공식 유튜브 채널 또는 공식 계정일 때만 isOfficialYoutube = true
        const isOfficialChannel = channel === 'RESCENE' || channel === '공식 유튜브' || /rescene\s*공식/i.test(channel);
        isOfficialYoutube = isOfficialChannel;
      } else if (url) {
        isOfficialYoutube = false;
      }

      // 선택된 참석 멤버 수집
      const allAttendeeCbs = document.querySelectorAll('.attendee-cb');
      const attendeeCbs = document.querySelectorAll('.attendee-cb:checked');
      let starAttendees = undefined;
      if (allAttendeeCbs.length > 0) {
        // 모달에 멤버 선택 UI가 존재하는 경우: 체크된 것이 없으면 빈 배열 []로 명시하여 전체 해제 반영
        starAttendees = Array.from(attendeeCbs).map(cb => ({
          name: cb.value,
          id: cb.dataset.id || undefined,
          profileImage: cb.dataset.avatar || undefined
        }));
      }

      if (isNew) {
        const datePart = startTime ? startTime.slice(2, 10).replace(/-/g, '') : '000000';
        const rand = Math.random().toString(36).slice(2, 8);
        const id = `custom_${datePart}_${rand}`;

        const newItem = {
          id,
          title,
          startTime,
          endTime: startTime,
          isAllday,
          typeText,
          channel,
          url,
          location,
          message,
          thumbnail,
          isOfficialYoutube,
          starAttendees,
          _isCustom: true
        };
        newItem._originKey = id;
        allSchedules.unshift(newItem);
        pendingOverrides.created.push(newItem);
      } else {
        const item = allSchedules.find(s => (s.id && s.id === key) || (s._originKey && s._originKey === key) || getScheduleKey(s) === key);
        if (item) {
          const stableKey = item.id || item._originKey || key;
          item._originKey = stableKey;

          item.title = title;
          item.startTime = startTime;
          item.endTime = startTime;
          item.isAllday = isAllday;
          item.typeText = typeText;
          item.channel = channel;
          item.url = url;
          item.location = location;
          item.message = message;
          if (thumbnail) item.thumbnail = thumbnail;
          if (isOfficialYoutube !== undefined) item.isOfficialYoutube = isOfficialYoutube;
          item.starAttendees = starAttendees;
          item._isModified = true;

          // 연관 일정 연결 처리 (상호 양방향 동기화)
          const candCbs = document.querySelectorAll('.linked-cand-cb');
          if (candCbs.length > 0) {
            const currentId = item.id || stableKey;
            const checkedLinkIds = [];

            candCbs.forEach(cb => {
              const targetId = cb.value;
              const isChecked = cb.checked;
              if (isChecked) checkedLinkIds.push(targetId);

              const targetItem = allSchedules.find(s => (s.id && s.id === targetId) || s._originKey === targetId || getScheduleKey(s) === targetId);
              if (targetItem) {
                const origLinked = Array.isArray(targetItem.linkedScheduleIds) ? [...targetItem.linkedScheduleIds] : [];
                const wasLinked = origLinked.includes(currentId) || origLinked.includes(stableKey);
                const linkStateChanged = wasLinked !== isChecked;

                // 연결 상태가 실제로 변하지 않은 무관한 후보는 수정 대기열에 절대 등록하지 않음!
                if (!linkStateChanged) {
                  return;
                }

                let tLinked = [...origLinked];
                if (isChecked) {
                  if (!tLinked.includes(currentId)) tLinked.push(currentId);
                } else {
                  tLinked = tLinked.filter(id => id !== currentId && id !== stableKey);
                }
                targetItem.linkedScheduleIds = tLinked;
                targetItem._isModified = true;

                const targetKey = targetItem.id || targetItem._originKey || getScheduleKey(targetItem);
                const targetModObj = {
                  title: targetItem.title,
                  startTime: targetItem.startTime,
                  endTime: targetItem.endTime,
                  isAllday: targetItem.isAllday,
                  typeText: targetItem.typeText,
                  channel: targetItem.channel,
                  url: targetItem.url,
                  location: targetItem.location,
                  message: targetItem.message,
                  thumbnail: targetItem.thumbnail,
                  isOfficialYoutube: targetItem.isOfficialYoutube,
                  starAttendees: targetItem.starAttendees,
                  linkedScheduleIds: tLinked,
                  isPrimary: Boolean(targetItem.isPrimary)
                };
                if (targetItem._isCustom) {
                  const cIdx = pendingOverrides.created.findIndex(c => (c.id && c.id === targetKey) || c._originKey === targetKey || getScheduleKey(c) === targetKey);
                  if (cIdx >= 0) pendingOverrides.created[cIdx] = { ...targetItem, ...targetModObj };
                  else pendingOverrides.created.push({ ...targetItem, ...targetModObj });
                } else {
                  pendingOverrides.modified[targetKey] = targetModObj;
                }
              }
            });

            item.linkedScheduleIds = checkedLinkIds;
          }

          // 수동 등록(custom) 아이템인 경우: created 목록에서 직접 갱신 (modified로 이탈 방지!)
          if (item._isCustom) {
            const customObj = {
              id: item.id || stableKey,
              title,
              startTime,
              endTime: startTime,
              isAllday,
              typeText,
              channel,
              url,
              location,
              message,
              thumbnail,
              isOfficialYoutube,
              starAttendees,
              _isCustom: true,
              _originKey: stableKey,
              linkedScheduleIds: item.linkedScheduleIds || [],
              isPrimary: Boolean(item.isPrimary)
            };
            const cIdx = pendingOverrides.created.findIndex(c => (c.id && c.id === stableKey) || c._originKey === stableKey || getScheduleKey(c) === stableKey);
            if (cIdx >= 0) {
              pendingOverrides.created[cIdx] = customObj;
            } else {
              pendingOverrides.created.push(customObj);
            }
          } else {
            // 공식 원본과 완전히 동일한지 체크 (모달에서 원본 복원 후 저장한 경우)
            const rawListForSubmit = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);
            const rawItem = Array.isArray(rawListForSubmit) ? rawListForSubmit.find(b =>
              (b.id && (b.id === key || b.id === stableKey || b.id === item.id)) ||
              (b._originKey && (b._originKey === key || b._originKey === stableKey)) ||
              getScheduleKey(b) === key || getScheduleKey(b) === stableKey
            ) : null;

            let isIdenticalToRaw = false;
            if (rawItem) {
              const rawDateStr = rawItem.startTime ? formatDateYMD(new Date(rawItem.startTime)) : '';
              let rawTimeRaw = '';
              if (!rawItem.isAllday && rawItem.startTime) {
                const rd = new Date(rawItem.startTime);
                const kstH = (rd.getUTCHours() + 9) % 24;
                const kstM = rd.getUTCMinutes();
                rawTimeRaw = `${String(kstH).padStart(2, '0')}:${String(kstM).padStart(2, '0')}`;
              }
              const rawType = rawItem.typeText || resolveScheduleType(rawItem) || '기타';
              const isLinksSame = JSON.stringify(item.linkedScheduleIds || []) === JSON.stringify(rawItem.linkedScheduleIds || []);

              // 참석 멤버 동등성 검증 (순서 독립적 비교 및 빈 배열 정밀 검사)
              const curAttendees = Array.isArray(starAttendees) ? starAttendees.map(a => a?.name || '').filter(Boolean).sort() : [];
              const rawAttendees = Array.isArray(rawItem.starAttendees) ? rawItem.starAttendees.map(a => a?.name || '').filter(Boolean).sort() : [];
              const isAttendeesSame = JSON.stringify(curAttendees) === JSON.stringify(rawAttendees);
              const isPrimarySame = Boolean(item.isPrimary) === Boolean(rawItem.isPrimary);
              const isTypeIdSame = (item.typeId ?? '') === (rawItem.typeId ?? '');

              if (title === (rawItem.title || '') &&
                  dateStr === rawDateStr &&
                  timeRaw === rawTimeRaw &&
                  typeText === rawType &&
                  isTypeIdSame &&
                  channel === (rawItem.channel || '') &&
                  url === (rawItem.url || rawItem.link || '') &&
                  location === (rawItem.location || '') &&
                  message === (rawItem.message || '') &&
                  isLinksSame &&
                  isAttendeesSame &&
                  isPrimarySame) {
                isIdenticalToRaw = true;
              }
            }

            if (isIdenticalToRaw) {
              restoreModifiedItem(stableKey);
              closeModal();
              return;
            }

            const modObj = {
              title,
              startTime,
              endTime: startTime,
              isAllday,
              typeText,
              channel,
              url,
              location,
              message,
              thumbnail,
              isOfficialYoutube,
              starAttendees,
              linkedScheduleIds: item.linkedScheduleIds || [],
              isPrimary: Boolean(item.isPrimary)
            };

            // 원본 불변 Canonical ID 키로 저장 (가상키 일체 배제)
            pendingOverrides.modified[stableKey] = modObj;
          }
        }
      }

      closeModal();
      updateStagingBar();
      renderSchedules();
    });

    // 바텀시트 내 삭제 버튼 클릭
    document.getElementById('btnModalDelete').addEventListener('click', (e) => {
      e.preventDefault();
      const key = document.getElementById('editItemIndex').value;
      if (key) {
        toggleDeleteItem(key);
        closeModal();
      }
    });

    // 변경사항 스테이징 바 업데이트
    function updateStagingBar() {
      const filterRulesChanged = Boolean(pendingFilterRules);
      const restoredCount = (pendingOverrides.restoredModified ? pendingOverrides.restoredModified.size : 0);

      const uniqueDeleted = new Set();
      const handledDelKeys = new Set();
      (pendingOverrides.deleted || new Set()).forEach(dKey => {
        if (handledDelKeys.has(dKey)) return;
        const item = allSchedules.find(s => (s.id && s.id === dKey) || (s._originKey && s._originKey === dKey) || getScheduleKey(s) === dKey);
        const itemDedupKey = item ? (item.id || item._originKey || getScheduleKey(item)) : dKey;
        uniqueDeleted.add(itemDedupKey);
        if (item) {
          if (item.id) handledDelKeys.add(item.id);
          if (item._originKey) handledDelKeys.add(item._originKey);
          handledDelKeys.add(getScheduleKey(item));
          if (item.title) handledDelKeys.add(item.title);
        }
        handledDelKeys.add(dKey);
      });
      const delCount = uniqueDeleted.size;

      const uniqueModified = new Set();
      const handledModKeys = new Set();
      Object.keys(pendingOverrides.modified || {}).forEach(mKey => {
        if (handledModKeys.has(mKey)) return;
        const item = allSchedules.find(s => (s.id && s.id === mKey) || (s._originKey && s._originKey === mKey) || getScheduleKey(s) === mKey);
        const itemDedupKey = item ? (item.id || item._originKey || getScheduleKey(item)) : mKey;
        uniqueModified.add(itemDedupKey);
        if (item) {
          if (item.id) handledModKeys.add(item.id);
          if (item._originKey) handledModKeys.add(item._originKey);
          handledModKeys.add(getScheduleKey(item));
          if (item.title) handledModKeys.add(item.title);
        }
        handledModKeys.add(mKey);
      });
      const modCount = uniqueModified.size;

      const isModeChanged = Boolean(basePipelineConfigSnapshot && basePipelineConfigSnapshot.mode !== currentPipelineConfig.mode);
      const newlyApprovedIds = (currentPipelineConfig.approvedScheduleIds || []).filter(id => !(basePipelineConfigSnapshot && (basePipelineConfigSnapshot.approvedScheduleIds || []).includes(id)));
      const pipelineConfigChanged = isModeChanged || newlyApprovedIds.length > 0;

      const count = modCount + delCount + pendingOverrides.created.length + restoredCount + (filterRulesChanged ? 1 : 0) + (pipelineConfigChanged ? 1 : 0);
      const bar = document.getElementById('stagingBar');
      const badge = document.getElementById('stagingCountBadge');

      if (badge) badge.textContent = `${count}건${filterRulesChanged ? ' (필터포함)' : ''}${pipelineConfigChanged ? ' (운영모드포함)' : ''}`;
      if (count > 0) {
        bar.style.display = 'flex';
        void bar.offsetHeight;
        bar.classList.add('visible');
      } else {
        bar.classList.remove('visible');
        setTimeout(() => {
          if (!bar.classList.contains('visible')) {
            bar.style.display = 'none';
          }
        }, 300);
      }
    }

    // 하단 스테이징 바 원래 마크업 복원
    function restoreStagingBarMarkup() {
      const bar = document.getElementById('stagingBar');
      bar.style.borderColor = 'var(--accent-purple)';
      bar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.6), var(--shadow-glow)';
      bar.style.background = 'rgba(22, 26, 36, 0.95)';
      bar.innerHTML = `
        <div class="staging-info">
          <span>수정 대기</span>
          <span class="staging-badge" id="stagingCountBadge">0건</span>
        </div>
        <div class="staging-actions">
          <button class="btn-reset" id="btnResetStaging">초기화</button>
          <button class="btn-commit" id="btnSaveToGist">
            <span>🔍</span> 사용자 뷰 검수 및 적용
          </button>
        </div>
      `;
      document.getElementById('btnResetStaging').addEventListener('click', onResetStagingClick);
      document.getElementById('btnSaveToGist').addEventListener('click', openUserPreviewModal);
      updateStagingBar();
    }

    // 스텔스 트리거 (404 글자 3회 연속 탭 시 시크릿 입력창 토글)
    let stealthTapCount = 0;
    let stealthTapTimer = null;
    document.getElementById('stealthTrigger').addEventListener('click', () => {
      stealthTapCount++;
      clearTimeout(stealthTapTimer);
      stealthTapTimer = setTimeout(() => {
        stealthTapCount = 0;
      }, 1000);

      if (stealthTapCount >= 3) {
        stealthTapCount = 0;
        const form = document.getElementById('gatekeeperForm');
        const homeBtn = document.getElementById('btnFakeHome');
        if (form.style.display === 'none' || !form.style.display) {
          form.style.display = 'block';
          homeBtn.style.display = 'none';
          document.getElementById('gateTokenInput').focus();
        } else {
          form.style.display = 'none';
          homeBtn.style.display = 'inline-block';
        }
      }
    });

    // 도어락 인증 처리 (스텔스)
    document.getElementById('gatekeeperForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('gateTokenInput').value.trim();
      const remember = document.getElementById('chkRememberDevice').checked;
      const errorDiv = document.getElementById('gateErrorMsg');
      const unlockBtn = document.getElementById('btnGateUnlock');

      if (!token) return;

      unlockBtn.textContent = 'Verifying...';
      unlockBtn.disabled = true;
      errorDiv.style.display = 'none';

      try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });
        if (!res.ok) {
          throw new Error('Access Denied');
        }
        setStoredToken(token, remember);
        showApp();
        loadSchedules();
      } catch (err) {
        errorDiv.textContent = 'Access Denied';
        errorDiv.style.display = 'inline';
      } finally {
        unlockBtn.textContent = 'Confirm';
        unlockBtn.disabled = false;
      }
    });

    // 로그아웃 (다시 잠금)
    document.getElementById('btnLogout').addEventListener('click', () => {
      if (confirm('로그아웃하고 도어락 잠금 화면으로 돌아가시겠습니까?')) {
        setStoredToken('');
        document.getElementById('gateTokenInput').value = '';
        showGatekeeper();
      }
    });

    // 변경 대기 내역 세부 항목 리스트 추출
    function buildDetailedChangesList() {
      const items = [];
      const rawList = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);

      // 1. 수정 항목 (modified)
      const handledModifiedKeys = new Set();
      Object.entries(pendingOverrides.modified || {}).forEach(([mKey, mod]) => {
        if (!mod) return;
        const rawItem = rawList.find(b => (b.id && b.id === mKey) || (b._originKey && b._originKey === mKey) || getScheduleKey(b) === mKey);
        const itemObj = allSchedules.find(s => (s.id && s.id === mKey) || (s._originKey && s._originKey === mKey) || getScheduleKey(s) === mKey) || mod;

        const itemDedupKey = itemObj ? (itemObj.id || itemObj._originKey || getScheduleKey(itemObj)) : mKey;
        if (handledModifiedKeys.has(itemDedupKey)) return;
        handledModifiedKeys.add(itemDedupKey);

        let dateStr = '';
        if (mod.startTime) {
          const d = new Date(mod.startTime);
          if (!isNaN(d.getTime())) dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        } else if (rawItem && rawItem.startTime) {
          const d = new Date(rawItem.startTime);
          if (!isNaN(d.getTime())) dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        }

        const titleStr = mod.title || (rawItem ? rawItem.title : (itemObj ? itemObj.title : mKey));
        const diffs = [];
        if (rawItem) {
          if (mod.title && mod.title !== rawItem.title) {
            diffs.push(`제목: "${escapeHtml(rawItem.title)}" ➔ <span class="confirm-diff-highlight">"${escapeHtml(mod.title)}"</span>`);
          }
          if (mod.startTime && mod.startTime !== rawItem.startTime) {
            const oldT = rawItem.startTime.slice(11, 16);
            const newT = mod.startTime.slice(11, 16);
            if (oldT && newT && oldT !== newT) diffs.push(`시간: ${oldT} ➔ <span class="confirm-diff-highlight">${newT}</span>`);
          }
          if (mod.location && mod.location !== rawItem.location) {
            diffs.push(`장소: "${escapeHtml(rawItem.location || '없음')}" ➔ <span class="confirm-diff-highlight">"${escapeHtml(mod.location)}"</span>`);
          }
          if (mod.typeText && mod.typeText !== rawItem.typeText) {
            diffs.push(`종류: ${rawItem.typeText || '기타'} ➔ <span class="confirm-diff-highlight">${mod.typeText}</span>`);
          }
        }
        if (Array.isArray(mod.linkedScheduleIds) && mod.linkedScheduleIds.length > 0) {
          diffs.push(`연관 일정 ${mod.linkedScheduleIds.length}건 연결 합성`);
        }
        if (diffs.length === 0) {
          diffs.push('세부 정보(채널/메모/링크 등) 보정');
        }

        items.push({
          badgeText: '✏️ 수정',
          badgeClass: 'badge-pending',
          date: dateStr || '지정일',
          title: titleStr,
          detailHtml: diffs.join(' · ')
        });
      });

      // 2. 숨김 항목 (deleted)
      const handledDeletedKeys = new Set();
      (pendingOverrides.deleted || new Set()).forEach(dKey => {
        if (handledDeletedKeys.has(dKey)) return;
        const item = allSchedules.find(s => (s.id && s.id === dKey) || (s._originKey && s._originKey === dKey) || getScheduleKey(s) === dKey || s.title === dKey);
        const itemDedupKey = item ? (item.id || item._originKey || getScheduleKey(item)) : dKey;
        if (handledDeletedKeys.has(itemDedupKey)) return;
        handledDeletedKeys.add(itemDedupKey);
        if (item) {
          if (item.id) handledDeletedKeys.add(item.id);
          if (item._originKey) handledDeletedKeys.add(item._originKey);
          handledDeletedKeys.add(getScheduleKey(item));
          if (item.title) handledDeletedKeys.add(item.title);
        }
        handledDeletedKeys.add(dKey);

        let dateStr = '';
        if (item && item.startTime) {
          const d = new Date(item.startTime);
          if (!isNaN(d.getTime())) dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        } else if (dKey.includes('_')) {
          const part = dKey.split('_')[0];
          if (part.length >= 10) dateStr = part.slice(5).replace('-', '.');
        }

        const titleStr = item ? item.title : (dKey.includes('_') ? dKey.split('_').slice(1).join('_') : dKey);
        items.push({
          badgeText: '🗑️ 숨김',
          badgeClass: 'badge-del',
          date: dateStr || '지정일',
          title: titleStr,
          detailHtml: '<span style="color: #f87171;">일정 비활성화 및 사용자 캘린더 제외</span>'
        });
      });

      // 3. 신규 등록 항목 (created)
      (pendingOverrides.created || []).forEach(c => {
        let dateStr = '';
        if (c.startTime) {
          const d = new Date(c.startTime);
          if (!isNaN(d.getTime())) dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        }
        items.push({
          badgeText: '✨ 등록',
          badgeClass: 'badge-new',
          date: dateStr || '지정일',
          title: c.title,
          detailHtml: `<span style="color: #6ee7b7;">신규 일정 추가 (${escapeHtml(c.typeText || '기타')}${c.location ? ' · 📍 ' + escapeHtml(c.location) : ''})</span>`
        });
      });

      // 4. 공식 원본 복구 항목 (restoredModified)
      const handledRestoredKeys = new Set();
      (pendingOverrides.restoredModified || new Set()).forEach(rKey => {
        const item = allSchedules.find(s => (s.id && s.id === rKey) || (s._originKey && s._originKey === rKey) || getScheduleKey(s) === rKey);
        const itemDedupKey = item ? (item.id || item._originKey || getScheduleKey(item)) : rKey;
        if (handledRestoredKeys.has(itemDedupKey)) return;
        handledRestoredKeys.add(itemDedupKey);

        let dateStr = '';
        if (item && item.startTime) {
          const d = new Date(item.startTime);
          if (!isNaN(d.getTime())) dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
        }
        const titleStr = item ? item.title : rKey;
        items.push({
          badgeText: '↩️ 복구',
          badgeClass: 'badge-confirmed',
          date: dateStr || '지정일',
          title: titleStr,
          detailHtml: '<span style="color: #c4b5fd;">수정 내역 취소 및 공식 원본 데이터 복원</span>'
        });
      });

      // 5. 필터 규칙
      if (pendingFilterRules) {
        items.push({
          badgeText: '⚙️ 필터',
          badgeClass: 'badge-special',
          date: '규칙',
          title: '자동 제외 필터 규칙 변경',
          detailHtml: '제외 키워드 및 쇼츠 필터 설정 업데이트'
        });
      }

      // 6. 파이프라인 수집기 운영 모드 및 승인 일정 변경
      const isModeChanged = Boolean(basePipelineConfigSnapshot && basePipelineConfigSnapshot.mode !== currentPipelineConfig.mode);
      const newlyApprovedIds = (currentPipelineConfig.approvedScheduleIds || []).filter(id => !(basePipelineConfigSnapshot && (basePipelineConfigSnapshot.approvedScheduleIds || []).includes(id)));

      if (isModeChanged) {
        items.push({
          badgeText: '⚙️ 모드',
          badgeClass: currentPipelineConfig.mode === 'auto' ? 'badge-new' : 'badge-special',
          date: '운영',
          title: `수집기 운영 모드 변경: ${currentPipelineConfig.mode === 'auto' ? '⚡ 빠른 반영 (자동 배포)' : '🛡️ 관리자 검수 (승인 후 배포)'}`,
          detailHtml: `<span style="color: ${currentPipelineConfig.mode === 'auto' ? '#6ee7b7' : '#fbbf24'};">수집 일정의 배포 방식이 ${currentPipelineConfig.mode === 'auto' ? '즉시 배포' : '검수 승인 배포'}로 전환됩니다.</span>`
        });
      }
      if (newlyApprovedIds.length > 0) {
        items.push({
          badgeText: '✅ 승인',
          badgeClass: 'badge-new',
          date: '검수',
          title: `검수 대기 일정 ${newlyApprovedIds.length}건 배포 승인`,
          detailHtml: `<span style="color: #6ee7b7;">선택한 ${newlyApprovedIds.length}건의 일정이 승인되어 사용자 앱에 공개 배포됩니다.</span>`
        });
      }

      return items;
    }

    // Gist에 최종 저장 및 반영 검증 (단일 진입 검수기 연동)
    async function onSaveToGistClick(options = {}) {
      const isPublish = Boolean(options && options.isPublish);
      const token = getStoredToken();
      if (!token) {
        showGatekeeper();
        alert('Gist에 저장하려면 먼저 관리자 인증이 필요합니다.');
        return;
      }

      const detailedItems = buildDetailedChangesList();
      const count = detailedItems.length;
      if (count === 0) {
        showToast('저장할 변경사항이 없습니다.');
        return;
      }

      const commitBtn = document.getElementById('btnSaveToGist');
      if (commitBtn) {
        commitBtn.innerHTML = '<span>⏳</span> Gist 전송 중...';
        commitBtn.disabled = true;
      }

      try {
        // 0. [원격 동시성 보호] 저장 직전 원격 Gist 최신본 실시간 조회 및 3-way 사전 병합
        let remoteOverrides = null;
        try {
          const latestRes = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json'
            },
            cache: 'no-store'
          });
          if (latestRes.ok) {
            const latestGist = await latestRes.json();
            const f = latestGist.files && latestGist.files['schedule-overrides.json'];
            if (f) {
              if (f.content) {
                try {
                  remoteOverrides = JSON.parse(f.content);
                } catch (pe) { }
              } else if (f.raw_url) {
                try {
                  const rawRes = await fetch(`${f.raw_url}${f.raw_url.includes('?') ? '&' : '?'}t=${Date.now()}`);
                  if (rawRes.ok) {
                    remoteOverrides = await rawRes.json();
                  }
                } catch (re) { }
              }
            }
          }
        } catch (fetchErr) {
          console.warn('원격 최신본 실시간 조회 실패(오프라인/네트워크 일시 지연): 현재 메모리 기준으로 진행', fetchErr);
        }

        // 원격 최신본이 확인되면 appliedOverrides와 3-way 병합
        if (remoteOverrides) {
          const remoteMem = parseOverridesV2IntoMemory(remoteOverrides);

          // [정책 5] 3-Way 지능형 충돌 해결: 내가 현재 수정한 내역(pendingOverrides.modified)과 원격 갱신 내역(remoteMem.modified)이 충돌할 때
          // (진짜 동시 편집 충돌: 내가 작업하는 동안 원격이 실제로 변경되었고, 동시에 내 수정본과도 다를 때만 핀포인트 감지!)
          const pendingKeys = Object.keys(pendingOverrides.modified || {});
          const conflictingKeys = pendingKeys.filter(k => {
            const remoteVal = remoteMem.modified[k];
            const localVal = pendingOverrides.modified[k];
            const baseVal = (baseOverridesSnapshot && baseOverridesSnapshot.modified) ? baseOverridesSnapshot.modified[k] : undefined;

            const isRemoteChanged = JSON.stringify(remoteVal) !== JSON.stringify(baseVal);
            const isLocalDifferent = JSON.stringify(localVal) !== JSON.stringify(remoteVal);
            return isRemoteChanged && isLocalDifferent;
          });

          if (conflictingKeys.length > 0) {
            const msg = `⚠️ [3-Way 편집 충돌 감지]\n원격에서 최근 수정된 ${conflictingKeys.length}건의 일정과 현재 편집 내역이 충돌합니다.\n\n[확인]: 내가 수정한 내역을 유지하여 Gist에 반영합니다.\n[취소]: 원격 최신본을 유지하고 내 수정본을 롤백합니다.`;
            const keepLocal = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(msg) : true;
            if (!keepLocal) {
              // 관리자가 원격 최신본을 선택한 경우:
              // 1) 로컬 충돌 수정본 폐기
              conflictingKeys.forEach(k => {
                delete pendingOverrides.modified[k];
              });

              // 2) 원격 최신본으로 appliedOverrides 동기화 및 롤백 반영
              appliedOverrides = remoteMem;
              updateStagingBar();
              await loadSchedules();

              // 3) 버튼 복원 및 저장 프로세스 즉시 중단
              if (commitBtn) {
                commitBtn.innerHTML = '<span>💾</span> 저장 적용';
                commitBtn.disabled = false;
              }
              showToast('원격 최신본으로 동기화되어 충돌 내역이 롤백되었습니다.');
              return; // ⚠️ Gist 저장 중단!
            }
          }

          remoteMem.deleted.forEach(d => appliedOverrides.deleted.add(d));
          appliedOverrides.modified = { ...appliedOverrides.modified, ...remoteMem.modified };
          remoteMem.created.forEach(rc => {
            const rcId = rc.id || getScheduleKey(rc);
            if (!appliedOverrides.created.some(ac => (ac.id && ac.id === rcId) || getScheduleKey(ac) === rcId)) {
              appliedOverrides.created.push(rc);
            }
          });

          if (remoteOverrides.pipelineConfig && typeof remoteOverrides.pipelineConfig === 'object') {
            const remoteApproved = Array.isArray(remoteOverrides.pipelineConfig.approvedScheduleIds) ? remoteOverrides.pipelineConfig.approvedScheduleIds : [];
            const localApproved = Array.isArray(currentPipelineConfig.approvedScheduleIds) ? currentPipelineConfig.approvedScheduleIds : [];
            currentPipelineConfig.approvedScheduleIds = Array.from(new Set([...localApproved, ...remoteApproved]));
          }
        }

        // 1. 기존 Gist에 있던 appliedOverrides와 새로 수정한 pendingOverrides를 스마트 병합 (1일정 1수정본)
        const mergedDeleted = new Set([...appliedOverrides.deleted, ...pendingOverrides.deleted]);
        const mergedModified = { ...appliedOverrides.modified, ...pendingOverrides.modified };

        // modified 안에 남아있던 _isCustom 격리 항목을 created로 승격 및 modified에서 제거
        const mergedCreatedMap = new Map();
        [...appliedOverrides.created, ...pendingOverrides.created].forEach(c => {
          const cKey = c.id || getScheduleKey(c);
          mergedCreatedMap.set(cKey, { ...c, _isCustom: true });
        });

        Object.entries(mergedModified).forEach(([mKey, mVal]) => {
          if (mVal && (mVal._isCustom || (mKey && String(mKey).startsWith('custom_')))) {
            mergedCreatedMap.set(mKey, { ...mVal, _originKey: mKey, _isCustom: true });
            delete mergedModified[mKey];
          }
        });

        // 삭제 대상에 포함된 키는 mergedModified에서 완전 제거
        mergedDeleted.forEach(dKey => {
          delete mergedModified[dKey];
        });

        // 원본으로 복구된 항목들은 mergedModified에서 완전 제거
        if (pendingOverrides.restoredModified && pendingOverrides.restoredModified.size > 0) {
          pendingOverrides.restoredModified.forEach(rKey => {
            delete mergedModified[rKey];
          });
        }

        // created 항목 처리 (custom_ prefix 고정 및 isDeleted 상태 반영)
        const finalCreated = Array.from(mergedCreatedMap.values()).map(c => {
          const isDel = Boolean(
            (c.id && mergedDeleted.has(c.id)) ||
            c.isDeleted ||
            c._isDeleted
          );
          return {
            ...c,
            isDeleted: isDel
          };
        });

        // v2.0 정규 형식 빌드 (Single Source of Truth, 순수 Diff만 보존)
        const customSchedules = {};
        finalCreated.forEach(c => {
          const id = (c.id && String(c.id).startsWith('custom_'))
            ? c.id
            : `custom_${(c.startTime || '').slice(2, 10).replace(/-/g, '') || 'manual'}_${Math.random().toString(36).slice(2, 8)}`;
          customSchedules[id] = { ...c, id, _isCustom: true, isDeleted: Boolean(c.isDeleted) };
        });

        const sourceOverrides = {};
        // 1) 삭제 일정 등록 (Canonical 접두사 검증 가드 및 Falsy 필터링 - SEC-03)
        const validIdPrefixRegex = /^(custom_|blip_|mnet_|yt_)/;
        mergedDeleted.forEach(dKey => {
          if (!dKey || typeof dKey !== 'string' || !dKey.trim()) return;
          if (!validIdPrefixRegex.test(dKey)) {
            console.warn(`[SEC-03] 비표준 삭제 키 제외: ${dKey}`);
            return;
          }
          sourceOverrides[dKey] = { isDeleted: true };
        });

        // 2) 수정 일정 등록 (공식 불변 원본과 비교하여 실제 달라진 속성만 diff로 추출)
        // ⚠️ [SSOT 원칙]: 비교 대상은 과거 오버라이드 조각이나 부분 수정 내역이 아니라,
        // 해당 일정 ID 기준 allSchedules의 현재 최종 실체(Full Entity)와 마스터 크롤링 원본(baseItem)을 1:1 대조!
        const rawList = (Array.isArray(rawBaseSchedules) && rawBaseSchedules.length > 0) ? rawBaseSchedules : (window.rawBaseSchedules || []);
        
        // mergedModified 내 각 항목을 allSchedules의 최신 실체로 온전히 채움 (파편 비교 원천 차단)
        Object.keys(mergedModified).forEach(key => {
          const liveItem = allSchedules.find(item => item && (item.id === key || item._originKey === key || getScheduleKey(item) === key));
          if (liveItem) {
            mergedModified[key] = { ...liveItem };
          }
        });

        Object.entries(mergedModified).forEach(([mKey, mVal]) => {
          if (!mKey || typeof mKey !== 'string' || !mKey.trim()) return;
          if (sourceOverrides[mKey] && sourceOverrides[mKey].isDeleted) return;

          // 기준 객체: 순수 마스터 크롤링 원본 (DEFECT-01 불변성 준수)
          const baseItem = rawList.find(s => s && (s.id === mKey || s._originKey === mKey || getScheduleKey(s) === mKey));
          // 비교 대상: allSchedules의 온전한 최종 실체
          const targetItem = mVal;

          const diff = computePureDiff(baseItem, targetItem);
          if (diff) {
            sourceOverrides[mKey] = diff;
          }
        });

        // [Circuit Breaker: 안전 차단기] 기존 원격 또는 로컬 기준선 대비 비정상 데이터/연결 급감 방어 가드 (Fail-Closed)
        const baselineSourceCount = (remoteOverrides && remoteOverrides.sourceOverrides && typeof remoteOverrides.sourceOverrides === 'object')
          ? Object.keys(remoteOverrides.sourceOverrides).length
          : (appliedOverrides && appliedOverrides.modified)
            ? (Object.keys(appliedOverrides.modified).length + (appliedOverrides.deleted ? appliedOverrides.deleted.size : 0))
            : 0;

        const baselineCustomCount = (remoteOverrides && remoteOverrides.customSchedules && typeof remoteOverrides.customSchedules === 'object')
          ? Object.keys(remoteOverrides.customSchedules).length
          : (appliedOverrides && Array.isArray(appliedOverrides.created))
            ? appliedOverrides.created.length
            : 0;

        const newSourceCount = Object.keys(sourceOverrides).length;
        const newCustomCount = Object.keys(customSchedules).length;

        // 1) 대규모 데이터셋 (100건 이상) 보호: 30% 이상 급감 차단
        if (baselineSourceCount >= 100 && newSourceCount < baselineSourceCount * 0.7) {
          throw new Error(`[안전 차단기] 비정상적 데이터 급감 감지: 기존 기준 ${baselineSourceCount}건 중 ${newSourceCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
        }
        // 2) 중소규모 데이터셋 (10~99건) 보호: 50% 이상 급감 차단
        if (baselineSourceCount >= 10 && baselineSourceCount < 100 && newSourceCount < baselineSourceCount * 0.5) {
          throw new Error(`[안전 차단기] 비정상적 데이터 급감 감지: 기존 기준 ${baselineSourceCount}건 중 ${newSourceCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
        }
        // 3) 커스텀 일정 (10건 이상) 급감 차단
        if (baselineCustomCount >= 10 && newCustomCount < baselineCustomCount * 0.5) {
          throw new Error(`[안전 차단기] 커스텀 일정 급감 감지: 기존 기준 ${baselineCustomCount}건 중 ${newCustomCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
        }

        // 4) 연결 일정(linkedScheduleIds) 보유 건수 급감 차단 (DEF-02: sourceOverrides + customSchedules 통합 집계)
        let remoteLinkCount = 0;
        if (remoteOverrides && typeof remoteOverrides === 'object') {
          if (remoteOverrides.sourceOverrides && typeof remoteOverrides.sourceOverrides === 'object') {
            Object.values(remoteOverrides.sourceOverrides).forEach(v => {
              if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) remoteLinkCount++;
            });
          }
          if (remoteOverrides.customSchedules && typeof remoteOverrides.customSchedules === 'object') {
            Object.values(remoteOverrides.customSchedules).forEach(v => {
              if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) remoteLinkCount++;
            });
          }
        }

        let localLinkCount = 0;
        if (appliedOverrides) {
          if (appliedOverrides.modified) {
            Object.values(appliedOverrides.modified).forEach(v => {
              if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) localLinkCount++;
            });
          }
          if (Array.isArray(appliedOverrides.created)) {
            appliedOverrides.created.forEach(v => {
              if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) localLinkCount++;
            });
          }
        }

        const baselineLinkCount = Math.max(remoteLinkCount, localLinkCount);

        let newLinkCount = 0;
        Object.values(sourceOverrides).forEach(v => {
          if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) newLinkCount++;
        });
        Object.values(customSchedules).forEach(v => {
          if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) newLinkCount++;
        });

        // 4) 연결 일정(linkedScheduleIds) 보유 건수 급감 차단 (SEC-02 전 구간 방어)
        if (baselineLinkCount >= 30 && newLinkCount < baselineLinkCount * 0.7) {
          throw new Error(`[안전 차단기] 연결 일정 급감 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
        }
        if (baselineLinkCount >= 10 && baselineLinkCount < 30 && newLinkCount < baselineLinkCount * 0.5) {
          throw new Error(`[안전 차단기] 연결 일정 소규모 급감 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
        }
        if (baselineLinkCount >= 5 && baselineLinkCount < 10 && newLinkCount < 3) {
          throw new Error(`[안전 차단기] 연결 일정 전멸 위험 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
        }

        const finalFilterRules = pendingFilterRules || currentFilterRules;

        // -------------------------------------------------------------
        // 오버라이드 단독 안전 저장 (사용자 배포본 schedules.json / core.json 직접 덮어쓰기 배제)
        // -------------------------------------------------------------
        const payload = {
          files: {
            "schedule-overrides.json": {
              content: JSON.stringify({
                version: "2.0.0",
                updatedAt: new Date().toISOString(),
                pipelineConfig: currentPipelineConfig,
                filterRules: finalFilterRules,
                customSchedules,
                sourceOverrides
              })
            }
          }
        };

        const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`저장 실패 (HTTP ${res.status}). 토큰 권한(gist scope)을 확인해 주세요.`);
        }

        // [중요!] Gist 서버 응답 본문에서 실제 기록된 파일 내용을 직접 확인 & 검증!
        const savedGist = await res.json();
        const savedFile = savedGist.files && savedGist.files['schedule-overrides.json'];
        if (!savedFile) {
          throw new Error('Gist에 파일이 생성되지 않았습니다.');
        }

        // GitHub Gist API는 파일 크기/수정 누적 시 truncated: true로 본문(content)을 생략할 수 있음
        // 4계층 Fail-Safe: content -> raw_url -> 확정 전송된 payload Fallback
        let confirmedOverrides = null;
        if (savedFile.content) {
          try {
            confirmedOverrides = JSON.parse(savedFile.content);
          } catch (parseErr) {
            console.warn('savedFile.content 파싱 실패, raw_url/payload 폴백 시도:', parseErr);
          }
        }

        if (!confirmedOverrides && savedFile.raw_url) {
          try {
            const rawRes = await fetch(`${savedFile.raw_url}${savedFile.raw_url.includes('?') ? '&' : '?'}t=${Date.now()}`);
            if (rawRes.ok) {
              confirmedOverrides = await rawRes.json();
            }
          } catch (rawErr) {
            console.warn('savedFile.raw_url 조회 실패, payload 폴백 시도:', rawErr);
          }
        }

        if (!confirmedOverrides) {
          try {
            confirmedOverrides = JSON.parse(payload.files['schedule-overrides.json'].content);
          } catch (payloadErr) {
            throw new Error('저장된 오버라이드 데이터를 파싱할 수 없습니다.');
          }
        }

        // 2. Gist 반영이 확인된 데이터로 appliedOverrides 확정 (v2.0 정규 파서 적용) 및 기준 스냅샷 동기화
        appliedOverrides = parseOverridesV2IntoMemory(confirmedOverrides);
        updateBaseOverridesSnapshot(appliedOverrides);

        if (confirmedOverrides.pipelineConfig && typeof confirmedOverrides.pipelineConfig === 'object') {
          currentPipelineConfig = {
            mode: confirmedOverrides.pipelineConfig.mode || 'auto',
            approvedScheduleIds: Array.isArray(confirmedOverrides.pipelineConfig.approvedScheduleIds)
              ? [...confirmedOverrides.pipelineConfig.approvedScheduleIds]
              : []
          };
        }
        updateBasePipelineConfigSnapshot(currentPipelineConfig);
        updatePipelineModeUI();

        // 3. 대기열(pendingOverrides) 비우기 & 필터 규칙 확정
        pendingOverrides = { modified: {}, deleted: new Set(), created: [], restoredModified: new Set() };
        if (pendingFilterRules) {
          currentFilterRules = { ...pendingFilterRules };
          pendingFilterRules = null;
        }

        // 4. 화면 목록에 확정 반영 덮어쓰기 & re-render (수정 대기 뱃지 -> [수정됨] 초록 뱃지로 확정)
        allSchedules = allSchedules.map(item => {
          const originKey = item._originKey || item.id || getScheduleKey(item);
          const mod = findMatchingOverride(item, appliedOverrides.modified);
          if (mod) {
            Object.assign(item, mod);
            item._originKey = originKey;
            item._isModified = true;
          }
          if ((item.id && appliedOverrides.deleted.has(item.id)) ||
              (item._originKey && appliedOverrides.deleted.has(item._originKey)) ||
              appliedOverrides.deleted.has(originKey)) {
            item._isDeleted = true;
          }
          return item;
        });

        // custom 일정이 allSchedules에 온전히 남아있는지 확인 및 보강
        appliedOverrides.created.forEach(c => {
          const cKey = c.id || getScheduleKey(c);
          const existing = allSchedules.find(s => (s.id && s.id === c.id) || getScheduleKey(s) === cKey);
          if (existing) {
            Object.assign(existing, c);
            existing._isCustom = true;
            if (c.isDeleted || (c.id && appliedOverrides.deleted.has(c.id)) || appliedOverrides.deleted.has(cKey)) {
              existing._isDeleted = true;
            }
          } else {
            allSchedules.unshift({
              ...c,
              _isCustom: true,
              _originKey: cKey,
              _isDeleted: Boolean(c.isDeleted || (c.id && appliedOverrides.deleted.has(c.id)) || appliedOverrides.deleted.has(cKey))
            });
          }
        });

        renderSchedules();

        // 5. 하단바 표시 즉시 변경: "수정 대기" -> "✅ Gist 반영 완료 (N건)"
        const stagingBar = document.getElementById('stagingBar');
        stagingBar.style.borderColor = 'var(--accent-green)';
        stagingBar.style.boxShadow = '0 0 25px rgba(16, 185, 129, 0.45)';
        stagingBar.style.background = 'rgba(16, 185, 129, 0.2)';
        stagingBar.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; color:#34d399; font-weight:700; font-size:13px; width:100%; justify-content:center; padding: 4px 0;">
            <span style="font-size:16px;">✅</span>
            <span>Gist에 총 ${count}건 정상 반영 완료!</span>
          </div>
        `;

        if (isPublish) {
          try {
            const dispatchRes = await fetch(`https://api.github.com/repos/duckbeginner/remine-helper/actions/workflows/data-hub-sync.yml/dispatches`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ ref: 'main' })
            });
            if (dispatchRes.ok) {
              showToast('🚀 사용자 배포 파이프라인(Data Hub) 즉시 가동! 잠시 후 schedules.json에 자동 배포됩니다.', 4000);
            } else {
              showToast('🚀 Gist 오버라이드 반영 완료! 중앙 Data Hub가 15분 주기 자동 실행으로 사용자 배포본에 반영합니다.', 3500);
            }
          } catch (dispatchErr) {
            showToast('🚀 Gist 오버라이드 반영 완료! 중앙 Data Hub가 15분 주기 자동 실행으로 사용자 배포본에 반영합니다.', 3500);
          }
        } else {
          showToast('💾 오버라이드 델타만 Gist에 안전하게 임시 저장되었습니다. (사용자 배포본 영향 없음)', 3000);
        }

        // 1.8초 동안 반영 완료 피드백을 보여준 뒤 자연스럽게 닫음
        setTimeout(() => {
          stagingBar.classList.remove('visible');
          setTimeout(() => {
            stagingBar.style.display = 'none';
            restoreStagingBarMarkup();
          }, 300);
        }, 1800);

      } catch (err) {
        alert('⚠️ 저장 중 오류: ' + err.message);
        if (commitBtn) {
          commitBtn.innerHTML = '<span>💾</span> 저장 적용';
          commitBtn.disabled = false;
        }
      }
    }

    function onResetStagingClick() {
      if (confirm('모든 수정 대기 내역을 초기화하시겠습니까?')) {
        pendingOverrides = { modified: {}, deleted: new Set(), created: [], restoredModified: new Set() };
        pendingFilterRules = null;
        if (basePipelineConfigSnapshot) {
          currentPipelineConfig = {
            mode: basePipelineConfigSnapshot.mode || 'auto',
            approvedScheduleIds: [...(basePipelineConfigSnapshot.approvedScheduleIds || [])]
          };
          updatePipelineModeUI();
        }
        updateStagingBar();
        loadSchedules();
      }
    }

    // 초기 이벤트 바인딩
    document.getElementById('btnSaveToGist').addEventListener('click', openUserPreviewModal);
    document.getElementById('btnResetStaging').addEventListener('click', onResetStagingClick);
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');
    if (btnOpenAddModal) {
      btnOpenAddModal.addEventListener('click', openAddModal);
    }
    window.openAddModal = openAddModal;

    // 이벤트 리스너 등록
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    document.getElementById('btnRefresh').addEventListener('click', () => {
      const detailed = buildDetailedChangesList();
      if (detailed.length > 0) {
        if (confirm(`저장 대기 중인 수정 내역이 ${detailed.length}건 있습니다.\n원격 최신본으로 새로고침하여 대기 내역을 모두 초기화(롤백)하시겠습니까?`)) {
          pendingOverrides = { modified: {}, deleted: new Set(), created: [], restoredModified: new Set() };
          pendingFilterRules = null;
          updateStagingBar();
          loadSchedules();
        }
      } else {
        loadSchedules();
      }
    });

    document.getElementById('btnPrevMonth').addEventListener('click', () => {
      if (searchQuery && searchQuery.trim()) {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
      }
      const targetDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
      const targetYm = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      let el = document.getElementById(`month-section-${targetYm}`);
      if (!el) {
        prependPrevMonth(targetDate);
        el = document.getElementById(`month-section-${targetYm}`);
      }
      isNavigatingLock = true;
      clearTimeout(navigatingLockTimer);
      navigatingLockTimer = setTimeout(() => { isNavigatingLock = false; }, 600);

      currentViewDate = targetDate;
      window.currentViewDate = currentViewDate;
      document.getElementById('currentMonthText').textContent = `${targetDate.getFullYear()}. ${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

      if (el) {
        const headerOffset = 140;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
      } else {
        renderSchedules();
      }
    });

    document.getElementById('btnNextMonth').addEventListener('click', () => {
      if (searchQuery && searchQuery.trim()) {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
      }
      const targetDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
      const targetYm = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      let el = document.getElementById(`month-section-${targetYm}`);
      if (!el) {
        appendNextMonth(targetDate);
        el = document.getElementById(`month-section-${targetYm}`);
      }
      isNavigatingLock = true;
      clearTimeout(navigatingLockTimer);
      navigatingLockTimer = setTimeout(() => { isNavigatingLock = false; }, 600);

      currentViewDate = targetDate;
      window.currentViewDate = currentViewDate;
      document.getElementById('currentMonthText').textContent = `${targetDate.getFullYear()}. ${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

      if (el) {
        const headerOffset = 140;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
      } else {
        renderSchedules();
      }
    });

    document.getElementById('btnToday').addEventListener('click', () => {
      if (searchQuery && searchQuery.trim()) {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
      }
      const now = new Date();
      const todayYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let el = document.getElementById(`month-section-${todayYm}`);
      if (!el) {
        currentViewDate = now;
        window.currentViewDate = currentViewDate;
        renderSchedules();
        el = document.getElementById(`month-section-${todayYm}`);
      }
      const todayHeader = document.querySelector('.date-header.today');
      if (todayHeader) {
        const headerOffset = 150;
        const elementPosition = todayHeader.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
      } else if (el) {
        const headerOffset = 140;
        const elementPosition = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - headerOffset, behavior: 'smooth' });
      }
      currentViewDate = now;
      window.currentViewDate = currentViewDate;
      document.getElementById('currentMonthText').textContent = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // ─────────────────────────────────────────────────────────────
    // 검색창 접기/펼치기, 자동 포커스, 조건부 검색 및 지우기(X) 핸들러
    // ─────────────────────────────────────────────────────────────
    const searchPanel = document.getElementById('searchPanel');
    const searchInput = document.getElementById('searchInput');
    const btnSearch = document.getElementById('btnSearch');
    const btnClearSearch = document.getElementById('btnClearSearch');
    const btnToggleSearch = document.getElementById('btnToggleSearch');
    const btnToggleSearchText = document.getElementById('btnToggleSearchText');
    const btnCloseSearch = document.getElementById('btnCloseSearch');

    function toggleSearchPanel(forceOpen) {
      if (!searchPanel) return;
      const isOpen = searchPanel.style.display !== 'none';
      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;

      if (shouldOpen) {
        searchPanel.style.display = 'block';
        if (btnToggleSearch) btnToggleSearch.classList.add('active');
        if (btnToggleSearchText) btnToggleSearchText.textContent = '검색 닫기';
        // 즉시 검색창 자동 포커스 (Auto-Focus)
        setTimeout(() => {
          if (searchInput) searchInput.focus();
        }, 30);
      } else {
        searchPanel.style.display = 'none';
        if (btnToggleSearch) btnToggleSearch.classList.remove('active');
        if (btnToggleSearchText) btnToggleSearchText.textContent = '검색';
        if (searchQuery || (searchInput && searchInput.value)) {
          clearSearchState(false);
        }
      }
    }

    function updateSearchButtonState() {
      if (!searchInput) return;
      const val = searchInput.value.trim();
      const hasVal = val.length > 0;
      if (btnSearch) btnSearch.disabled = !hasVal;
      if (btnClearSearch) btnClearSearch.style.display = hasVal ? 'flex' : 'none';
    }

    function executeSearch() {
      if (!searchInput) return;
      const q = searchInput.value.trim();
      if (!q) return;
      searchQuery = q;
      renderSchedules();
    }

    function clearSearchState(shouldFocus = true) {
      if (searchInput) searchInput.value = '';
      updateSearchButtonState();
      if (searchQuery) {
        searchQuery = '';
        renderSchedules();
      }
      if (shouldFocus && searchInput && searchPanel && searchPanel.style.display !== 'none') {
        searchInput.focus();
      }
    }

    if (btnToggleSearch) btnToggleSearch.addEventListener('click', () => toggleSearchPanel());
    if (btnCloseSearch) btnCloseSearch.addEventListener('click', () => toggleSearchPanel(false));
    if (btnSearch) btnSearch.addEventListener('click', executeSearch);
    if (btnClearSearch) btnClearSearch.addEventListener('click', () => clearSearchState(true));

    // 타이핑 시에는 무거운 전체 재렌더링을 일절 하지 않고 버튼 상태만 가볍게 갱신 (렉 0%)
    if (searchInput) {
      searchInput.addEventListener('input', updateSearchButtonState);
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSearch();
        } else if (e.key === 'Escape') {
          toggleSearchPanel(false);
        }
      });
    }

    // 전역 바인딩
    window.toggleSearchPanel = toggleSearchPanel;
    window.executeSearch = executeSearch;
    window.clearSearchState = clearSearchState;

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCategory = chip.getAttribute('data-type');
        renderSchedules();
      });
    });

    document.getElementById('btnResetStaging').addEventListener('click', () => {
      if (confirm('모든 수정 대기 내역을 초기화하시겠습니까?')) {
        pendingOverrides = { modified: {}, deleted: new Set(), created: [], restoredModified: new Set() };
        updateStagingBar();
        loadSchedules();
      }
    });

    // -------------------------------------------------------------
    // 실시간 폼 카드 미리보기 (사용자 사이드패널 뷰)
    // -------------------------------------------------------------
    const TYPE_BADGE_STYLES = {
      '영상': { bg: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee' },
      '방송': { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
      '라디오': { bg: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' },
      '공연': { bg: 'rgba(236, 72, 153, 0.2)', color: '#f472b6' },
      '팬사인회': { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
      '행사': { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
      '기념일': { bg: 'rgba(244, 63, 94, 0.2)', color: '#fb7185' },
      '화보': { bg: 'rgba(217, 70, 239, 0.2)', color: '#e879f9' },
      '릴리즈': { bg: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' },
      '공지': { bg: 'rgba(234, 179, 8, 0.2)', color: '#facc15' },
      '기타': { bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }
    };

    function updateFormLivePreview() {
      const container = document.getElementById('formLivePreviewCard');
      if (!container) return;

      const title = document.getElementById('formTitle')?.value?.trim() || '';
      const dateVal = document.getElementById('formDate')?.value || '';
      const timeVal = document.getElementById('formTime')?.value || '';
      const typeVal = document.getElementById('formType')?.value || '기타';
      const channelVal = document.getElementById('formChannel')?.value?.trim() || '';
      const locationVal = document.getElementById('formLocation')?.value?.trim() || '';

      let dateLabel = '일정';
      let timeStr = ' 종일';

      if (dateVal) {
        const [y, m, d] = dateVal.split('-').map(Number);
        const nowY = new Date().getFullYear();
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        dateLabel = (y !== nowY) ? `'${String(y).slice(2)}.${mm}/${dd}` : `${mm}/${dd}`;

        if (timeVal) {
          const [h, min] = timeVal.split(':').map(Number);
          const ap = h >= 12 ? '오후' : '오전';
          const displayH = h % 12 || 12;
          timeStr = ` ${ap} ${displayH}:${String(min).padStart(2, '0')}`;
        }
      }

      const badgeStyle = TYPE_BADGE_STYLES[typeVal] || TYPE_BADGE_STYLES['기타'];

      let extraText = '';
      if (channelVal) {
        extraText = ` <span style="font-size: 10.5px; color: #94a3b8; margin-left: 4px;">(${escapeHtml(channelVal)})</span>`;
      } else if (locationVal) {
        extraText = ` <span style="font-size: 10.5px; color: #94a3b8; margin-left: 4px;">📍 ${escapeHtml(locationVal)}</span>`;
      }

      const displayTitle = title ? escapeHtml(title) : '<span style="color: #64748b; font-style: italic;">(일정 제목을 입력하면 실시간 미리보기가 표시됩니다)</span>';

      container.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; overflow: hidden; white-space: nowrap; gap: 4px;">
          <span style="font-weight: 700; font-size: 11px; opacity: 0.88; flex-shrink: 0; color: #e2e8f0;">[${dateLabel}${timeStr}]</span>
          <span style="display: inline-block; padding: 1.5px 5.5px; border-radius: 4px; font-size: 10px; font-weight: 600; margin: 0 3px; flex-shrink: 0; background: ${badgeStyle.bg}; color: ${badgeStyle.color}; line-height: 1.3;">${escapeHtml(typeVal)}</span>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; font-size: 11.5px; color: #f1f5f9;">${displayTitle}${extraText}</span>
        </div>
      `;
    }

    function showCurrentFormDetailPreview() {
      const title = document.getElementById('formTitle')?.value?.trim() || '';
      const dateVal = document.getElementById('formDate')?.value || '';
      const timeVal = document.getElementById('formTime')?.value || '';
      const typeVal = document.getElementById('formType')?.value || '기타';
      const channelVal = document.getElementById('formChannel')?.value?.trim() || '';
      const locationVal = document.getElementById('formLocation')?.value?.trim() || '';
      const messageVal = document.getElementById('formMessage')?.value?.trim() || '';
      const urlVal = document.getElementById('formUrl')?.value?.trim() || '';

      let startTime = '';
      let isAllday = true;
      if (dateVal) {
        if (timeVal) {
          startTime = `${dateVal}T${timeVal}:00`;
          isAllday = false;
        } else {
          startTime = `${dateVal}T00:00:00`;
          isAllday = true;
        }
      }

      const item = {
        title: title || '제목 없음',
        startTime: startTime,
        isAllday: isAllday,
        typeText: typeVal,
        channel: channelVal,
        location: locationVal,
        message: messageVal,
        url: urlVal
      };

      showUserPreviewDetail(item);
    }
    window.showCurrentFormDetailPreview = showCurrentFormDetailPreview;

    const livePreviewCard = document.getElementById('formLivePreviewCard');
    if (livePreviewCard) {
      livePreviewCard.addEventListener('click', showCurrentFormDetailPreview);
    }

    ['formTitle', 'formDate', 'formTime', 'formType', 'formChannel', 'formLocation', 'formMessage', 'formUrl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateFormLivePreview);
        el.addEventListener('change', updateFormLivePreview);
      }
    });

    // -------------------------------------------------------------
    // 전체 사용자 뷰 검수기 및 미리보기 (User Review Inspector)
    // -------------------------------------------------------------
    let userPreviewDate = new Date();
    let isUserPreviewDark = true;
    let _currentInspectorTab = 'diff';

    function switchInspectorTab(tab) {
      _currentInspectorTab = tab;
      const diffContainer = document.getElementById('inspectorDiffContainer');
      const previewContainer = document.getElementById('inspectorPreviewContainer');
      const btnDiff = document.getElementById('btnInspectorTabDiff');
      const btnPreview = document.getElementById('btnInspectorTabPreview');

      if (tab === 'diff') {
        if (diffContainer) diffContainer.style.display = 'flex';
        if (previewContainer) previewContainer.style.display = 'none';
        if (btnDiff) btnDiff.classList.add('active');
        if (btnPreview) btnPreview.classList.remove('active');
        renderInspectorDiff();
      } else {
        if (diffContainer) diffContainer.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'flex';
        if (btnDiff) btnDiff.classList.remove('active');
        if (btnPreview) btnPreview.classList.add('active');
        renderUserPreviewSchedules();
      }
    }

    function openUserPreviewModal() {
      userPreviewDate = new Date(currentViewDate.getTime());
      const modal = document.getElementById('userReviewModalOverlay') || document.getElementById('userPreviewModalOverlay');
      if (modal) modal.classList.add('active');
      closeUpdDetail();
      switchInspectorTab('diff');
    }

    function closeUserPreviewModal() {
      const modal = document.getElementById('userReviewModalOverlay') || document.getElementById('userPreviewModalOverlay');
      if (modal) modal.classList.remove('active');
      closeUpdDetail();
    }

    function toggleUserPreviewTheme() {
      isUserPreviewDark = !isUserPreviewDark;
      const container = document.getElementById('userPreviewCardContainer');
      const btn = document.getElementById('btnToggleUserPreviewTheme');
      if (isUserPreviewDark) {
        container.className = 'user-sp-card-container dark';
        btn.textContent = '🌙 다크';
      } else {
        container.className = 'user-sp-card-container light';
        btn.textContent = '☀️ 라이트';
      }
    }

    // 변경 대조표 (Diff Engine) 렌더러
    function renderInspectorDiff() {
      const summaryEl = document.getElementById('inspectorDiffSummary');
      const listEl = document.getElementById('inspectorDiffList');
      if (!summaryEl || !listEl) return;

      const createdItems = pendingOverrides.created || [];
      const deletedKeys = Array.from(pendingOverrides.deleted || []);
      const modifiedMap = pendingOverrides.modified || {};
      const modifiedKeys = Object.keys(modifiedMap);

      // 수정 내역에서 실질적 변경 필드 분석
      const diffModItems = [];
      const handledModKeys = new Set();
      modifiedKeys.forEach(mKey => {
        if (handledModKeys.has(mKey)) return;
        const mod = modifiedMap[mKey];
        const orig = allSchedules.find(s => (s.id && s.id === mKey) || (s._originKey && s._originKey === mKey) || getScheduleKey(s) === mKey);
        const itemDedupKey = orig ? (orig.id || getScheduleKey(orig)) : mKey;
        handledModKeys.add(itemDedupKey);

        const changes = [];
        if (orig) {
          if (mod.title !== undefined && mod.title !== orig.title) {
            changes.push({ field: '제목', before: orig.title || '(없음)', after: mod.title });
          }
          if (mod.startTime !== undefined && mod.startTime !== orig.startTime) {
            changes.push({ field: '일시', before: orig.startTime || '(없음)', after: mod.startTime });
          }
          if (mod.channel !== undefined && mod.channel !== orig.channel) {
            changes.push({ field: '채널', before: orig.channel || '(없음)', after: mod.channel || '(제거됨)' });
          }
          if (mod.location !== undefined && mod.location !== orig.location) {
            changes.push({ field: '장소', before: orig.location || '(없음)', after: mod.location || '(제거됨)' });
          }
          if (mod.typeText !== undefined && mod.typeText !== orig.typeText) {
            changes.push({ field: '분류', before: orig.typeText || '(없음)', after: mod.typeText });
          }
          if (mod.message !== undefined && mod.message !== orig.message) {
            changes.push({ field: '본문', before: (orig.message || '').slice(0, 30), after: (mod.message || '').slice(0, 30) });
          }
        } else {
          changes.push({ field: '상세', before: '수정 대기', after: '값 변경됨' });
        }
        diffModItems.push({
          key: itemDedupKey,
          title: (mod && mod.title) || (orig && orig.title) || mKey,
          changes: changes
        });
      });

      // 삭제 내역 분석
      const diffDelItems = [];
      const handledDels = new Set();
      deletedKeys.forEach(dKey => {
        if (handledDels.has(dKey)) return;
        const orig = allSchedules.find(s => (s.id && s.id === dKey) || (s._originKey && s._originKey === dKey) || getScheduleKey(s) === dKey);
        const itemKey = orig ? (orig.id || getScheduleKey(orig)) : dKey;
        diffDelItems.push({
          key: itemKey,
          title: (orig && orig.title) || dKey,
          startTime: (orig && orig.startTime) || ''
        });
        handledDels.add(itemKey);
      });

      // 4) 운영 모드 및 승인 일정 변경 감지
      const isModeChanged = Boolean(basePipelineConfigSnapshot && basePipelineConfigSnapshot.mode !== currentPipelineConfig.mode);
      const newlyApprovedIds = (currentPipelineConfig.approvedScheduleIds || []).filter(id => !(basePipelineConfigSnapshot && (basePipelineConfigSnapshot.approvedScheduleIds || []).includes(id)));

      const totalCount = createdItems.length + diffModItems.length + diffDelItems.length + (isModeChanged ? 1 : 0) + newlyApprovedIds.length;

      summaryEl.innerHTML = `
        <span style="font-size: 11.5px; font-weight: 700; color: #fff;">총 변경 ${totalCount}건:</span>
        <span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-weight: 600;">➕ 추가 ${createdItems.length}건</span>
        <span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 600;">🔄 수정 ${diffModItems.length}건</span>
        <span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 600;">➖ 삭제 ${diffDelItems.length}건</span>
        ${isModeChanged ? `<span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 600;">⚙️ 모드 전환</span>` : ''}
        ${newlyApprovedIds.length > 0 ? `<span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 600;">✅ 승인 ${newlyApprovedIds.length}건</span>` : ''}
      `;

      if (totalCount === 0) {
        listEl.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.1);">
            ✨ 대기 중인 변경사항이 없습니다.<br>원격 기준선과 완벽하게 일치합니다.
          </div>
        `;
        return;
      }

      let html = '';

      // 0-1) 운영 모드 변경 카드
      if (isModeChanged) {
        html += `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10.5px; font-weight: 700; color: #fbbf24; background: rgba(245, 158, 11, 0.2); padding: 1px 6px; border-radius: 4px;">⚙️ 파이프라인 모드</span>
              <span style="font-size: 11px; color: var(--text-muted);">수집기 배포 방식</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #fff;">
              ${basePipelineConfigSnapshot?.mode === 'auto' ? '⚡ 빠른 반영' : '🛡️ 관리자 검수'} ➔ <span style="color: ${currentPipelineConfig.mode === 'auto' ? '#4ade80' : '#fbbf24'};">${currentPipelineConfig.mode === 'auto' ? '⚡ 빠른 반영' : '🛡️ 관리자 검수'}</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              ${currentPipelineConfig.mode === 'auto' ? '수집된 일정이 검수 없이 사용자 앱에 즉시 공개 배포됩니다.' : '수집된 일정이 배포 보류되며 관리자 승인 후 배포됩니다.'}
            </div>
          </div>
        `;
      }

      // 0-2) 새로 승인된 일정 카드
      if (newlyApprovedIds.length > 0) {
        newlyApprovedIds.forEach(aId => {
          const matched = allSchedules.find(s => s.id === aId || s._originKey === aId || getScheduleKey(s) === aId);
          html += `
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 10.5px; font-weight: 700; color: #6ee7b7; background: rgba(16, 185, 129, 0.2); padding: 1px 6px; border-radius: 4px;">✅ 배포 승인</span>
                <span style="font-size: 11px; color: var(--text-muted);">${matched?.startTime ? formatDateYMD(new Date(matched.startTime)) : ''}</span>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">${escapeHtml(matched?.title || aId)}</div>
              <div style="font-size: 11px; color: #6ee7b7;">검수 보류가 해제되어 사용자 앱에 정상 배포됩니다.</div>
            </div>
          `;
        });
      }

      // 1) 추가된 일정
      createdItems.forEach(c => {
        html += `
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10.5px; font-weight: 700; color: #4ade80; background: rgba(34, 197, 94, 0.2); padding: 1px 6px; border-radius: 4px;">➕ 신규 추가</span>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(c.startTime || '')}</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #fff;">${escapeHtml(c.title || '제목 없음')}</div>
            ${c.channel ? `<div style="font-size: 11px; color: #94a3b8;">📺 ${escapeHtml(c.channel)}</div>` : ''}
            ${c.location ? `<div style="font-size: 11px; color: #94a3b8;">📍 ${escapeHtml(c.location)}</div>` : ''}
          </div>
        `;
      });

      // 2) 수정된 일정 (전후 대조표)
      diffModItems.forEach(m => {
        const changesHtml = m.changes.map(ch => `
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 2px 0;">
            <span style="color: #94a3b8; width: 36px; flex-shrink: 0; font-weight: 600;">${escapeHtml(ch.field)}</span>
            <span style="color: #f87171; text-decoration: line-through; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ch.before)}</span>
            <span style="color: #64748b;">➔</span>
            <span style="color: #38bdf8; font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ch.after)}</span>
          </div>
        `).join('');

        html += `
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10.5px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.2); padding: 1px 6px; border-radius: 4px;">🔄 필드 수정</span>
              <span style="font-size: 11px; color: #94a3b8;">${escapeHtml(m.title)}</span>
            </div>
            <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 2px;">
              ${changesHtml}
            </div>
          </div>
        `;
      });

      // 3) 삭제된 일정
      diffDelItems.forEach(d => {
        html += `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 10.5px; font-weight: 700; color: #f87171; background: rgba(239, 68, 68, 0.2); padding: 1px 6px; border-radius: 4px;">➖ 제외/삭제</span>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(d.startTime || '')}</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; text-decoration: line-through; opacity: 0.85;">${escapeHtml(d.title)}</div>
          </div>
        `;
      });

      listEl.innerHTML = html;
    }

    function renderUserPreviewSchedules() {
      const listEl = document.getElementById('userPreviewScheduleList');
      const countEl = document.getElementById('userPreviewCountText');
      const monthEl = document.getElementById('userPreviewMonthText');
      if (!listEl) return;

      const year = userPreviewDate.getFullYear();
      const month = userPreviewDate.getMonth();
      monthEl.textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;

      const monthStart = new Date(year, month, 1, 0, 0, 0).getTime();
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

      // 필터 규칙
      const activeRules = pendingFilterRules || currentFilterRules;
      const filterEnabled = activeRules.enabled !== false;
      const excludeShorts = activeRules.excludeShorts !== false;
      const excludeTypes = Array.isArray(activeRules.excludeTypes) ? activeRules.excludeTypes : [];
      const excludeChannels = Array.isArray(activeRules.excludeChannels) ? activeRules.excludeChannels : [];
      const excludeKeywords = Array.isArray(activeRules.excludeKeywords) ? activeRules.excludeKeywords : DEFAULT_EXCLUDE_KEYWORDS;

      // 1. 유효 일정 추출 (삭제된 일정 완전 제외)
      const validItems = allSchedules.filter(item => {
        if (!item || !item.startTime) return false;
        const key = getScheduleKey(item);
        if (pendingOverrides.deleted.has(key) || item._isDeleted) return false;

        const d = new Date(item.startTime);
        const startT = d.getTime();
        const endT = item.endTime ? new Date(item.endTime).getTime() : startT;
        if (!(startT <= monthEnd && endT >= monthStart)) return false;

        const isProtected = item._isCustom || (item.id && String(item.id).startsWith('custom_')) || (pendingOverrides && pendingOverrides.modified && pendingOverrides.modified[item.id]) || (appliedOverrides && appliedOverrides.modified && appliedOverrides.modified[item.id]);

        // 관리자 검수 모드(review)에서는 승인되지 않은 일반 수집 일정은 사용자 뷰에서 배제
        const isApproved = (currentPipelineConfig.approvedScheduleIds || []).includes(item.id || key);
        if (currentPipelineConfig.mode === 'review' && !isProtected && !isApproved) {
          return false;
        }

        if (!isProtected && filterEnabled) {
          if (excludeShorts) {
            const raw = [item.url, item.link, item.title].filter(Boolean).join(' ');
            if (item._isShorts || /youtube\.com\/shorts\//i.test(raw) || /#shorts\b|#쇼츠\b/i.test(raw) || /(?:vt\.tiktok\.com\/|tiktok\.com\/@[^/]+\/video\/\d+)/i.test(raw)) {
              return false;
            }
          }
          if (excludeTypes.length > 0) {
            const resolvedType = resolveScheduleType(item);
            if (excludeTypes.includes(resolvedType) || (item.typeText && excludeTypes.includes(item.typeText))) return false;
          }
          if (excludeChannels.length > 0) {
            const chs = [item.channel, (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null)].filter(Boolean).map(s => s.trim().toLowerCase());
            if (excludeChannels.some(ex => chs.includes(ex.trim().toLowerCase()))) return false;
          }
          if (excludeKeywords.length > 0) {
            const searchText = [item.title, item.message, item.location, item.channel].filter(Boolean).join(' ').toLowerCase();
            if (excludeKeywords.some(kw => kw.trim() && searchText.includes(kw.trim().toLowerCase()))) return false;
          }
        }
        return true;
      });

      // 2. 연관 일정 클러스터링 (전이적 폐포 및 통일된 대표 선출 적용)
      const processed = new Set();
      const clusters = [];
      validItems.forEach(item => {
        const itemKey = item.id || item._originKey || getScheduleKey(item);
        if (processed.has(itemKey) || (item.id && processed.has(item.id))) return;

        const cluster = buildScheduleClusterTransitive(item, validItems);
        cluster.forEach(c => {
          if (c.id) processed.add(c.id);
          if (c._originKey) processed.add(c._originKey);
          const sk = getScheduleKey(c);
          if (sk) processed.add(sk);
        });
        clusters.push(cluster);
      });

      // 3. 대표 일정 선출 (determineClusterPrimary 규칙 통일)
      const userDisplayItems = clusters.map(cluster => {
        return determineClusterPrimary(cluster) || cluster[0];
      });

      // 4. 시작 시간순 정렬
      userDisplayItems.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      countEl.textContent = `${userDisplayItems.length}건`;

      if (userDisplayItems.length === 0) {
        listEl.innerHTML = '<div style="padding: 30px 10px; text-align: center; color: var(--text-muted); font-size: 12.5px;">예정된 스케줄이 없습니다.</div>';
        return;
      }

      // 오늘 또는 가장 가까운 일정 index
      const now = new Date();
      const nowTime = now.getTime();
      const todayStr = formatDateYMD(now);

      let nextIndex = userDisplayItems.findIndex(item => {
        const itemDateStr = formatDateYMD(new Date(item.startTime));
        return itemDateStr === todayStr;
      });
      if (nextIndex === -1) {
        nextIndex = userDisplayItems.findIndex(item => new Date(item.startTime).getTime() >= nowTime);
      }
      if (nextIndex === -1) {
        nextIndex = Math.max(0, userDisplayItems.length - 1);
      }

      let html = '';
      userDisplayItems.forEach((item, idx) => {
        const d = new Date(item.startTime);
        const itemYear = d.getFullYear();
        const currentYear = new Date().getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateLabel = (itemYear !== currentYear) ? `'${String(itemYear).slice(2)}.${mm}/${dd}` : `${mm}/${dd}`;

        let timeStr = ' 종일';
        if (!item.isAllday && item.startTime) {
          const h = d.getHours();
          const min = String(d.getMinutes()).padStart(2, '0');
          const ap = h >= 12 ? '오후' : '오전';
          const displayH = h % 12 || 12;
          timeStr = ` ${ap} ${displayH}:${min}`;
        }

        const type = resolveScheduleType(item);
        const badgeStyle = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES['기타'];
        const isActive = (idx === nextIndex);
        const activeClass = isActive ? ' active' : '';

        let extraInfo = '';
        const ch = item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null);
        const loc = item.location || (item.extField && item.extField.key === '장소' ? item.extField.value : null);
        if (ch) {
          extraInfo = `<span class="user-sp-extra-info">(${escapeHtml(ch)})</span>`;
        } else if (loc) {
          extraInfo = `<span class="user-sp-extra-info">📍${escapeHtml(loc)}</span>`;
        }

        const safeTitle = escapeHtml(item.title || item.message || '스케줄');

        html += `
          <div class="user-sp-item${activeClass}" data-index="${idx}">
            <div class="user-sp-line">
              <span class="user-sp-datetime">[${dateLabel}${timeStr}]</span>
              <span class="user-sp-type-badge" style="background: ${badgeStyle.bg}; color: ${badgeStyle.color};">${escapeHtml(type)}</span>
              <span class="user-sp-title-area">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeTitle}</span>
                ${extraInfo}
                ${getMemberAttendeeBadgesHTML(item.starAttendees)}
              </span>
            </div>
          </div>
        `;
      });

      listEl.innerHTML = html;

      // 클릭 시 상세 팝업 열기
      listEl.querySelectorAll('.user-sp-item').forEach((el, idx) => {
        el.addEventListener('click', () => {
          showUserPreviewDetail(userDisplayItems[idx]);
        });
      });

      // 활성 일정으로 스크롤 이동
      setTimeout(() => {
        const activeEl = listEl.querySelector('.user-sp-item.active');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }

    // 미디어 임베드 및 SNS 멀티미디어 프리뷰 카드 렌더러 (Instagram, X, TikTok, YouTube 100% 동기화)
    function renderDetailMediaCards(item) {
      if (!item) return '';
      const sources = [
        item.url,
        item.link,
        item.message,
        item.detail,
        item.description,
        ...(item.resolvedMediaUrls || [])
      ].filter(Boolean);
      return renderMediaEmbeds(sources);
    }

    function renderMediaEmbeds(sources = [], isDark = true) {
      const allText = sources.join(' ');
      if (!allText) return '';

      const themeStr = isDark ? 'dark' : 'light';
      const embedHtmls = [];
      const processed = new Set();

      // 1. YouTube (watch, youtu.be, shorts)
      const ytRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
      let ytMatch;
      while ((ytMatch = ytRegex.exec(allText)) !== null) {
        const videoId = ytMatch[1];
        if (!processed.has(videoId)) {
          processed.add(videoId);
          embedHtmls.push(`
            <div class="youtube-preview-card" data-video-id="${escapeHtml(videoId)}" onclick="window.open('https://www.youtube.com/watch?v=${escapeHtml(videoId)}', '_blank')" style="margin-bottom: 8px; border-radius: 12px; overflow: hidden; aspect-ratio: 16/9; position: relative; cursor: pointer; background: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15);">
              <img src="https://img.youtube.com/vi/${escapeHtml(videoId)}/hqdefault.jpg" style="width: 100%; height: 100%; object-fit: cover;" alt="YouTube Thumbnail">
              <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.5) 100%); display: flex; flex-direction: column; justify-content: space-between; padding: 10px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="background: #ff0000; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg> YouTube
                  </span>
                  <span style="color: rgba(255,255,255,0.9); font-size: 10.5px; font-weight: 500;">영상 바로보기 ↗</span>
                </div>
                <div style="align-self: center;">
                  <div class="yt-play-btn" style="width: 44px; height: 44px; background: rgba(255,0,0,0.95); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,0,0,0.55);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style="margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </div>
                </div>
                <div style="color: #fff; font-size: 11px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  클릭하여 YouTube에서 시청하기
                </div>
              </div>
            </div>
          `);
        }
      }

      // 2. Instagram (p, reel, tv 등 계정명 포함 URL 지원 - Spotify House Seoul 지원)
      const instaRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/g;
      let instaMatch;
      while ((instaMatch = instaRegex.exec(allText)) !== null) {
        const postId = instaMatch[1];
        if (!processed.has(postId)) {
          processed.add(postId);
          embedHtmls.push(`
            <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);">
              <iframe src="https://www.instagram.com/p/${escapeHtml(postId)}/embed/captioned/?theme=${themeStr}" style="width: 100%; height: 500px; min-height: 380px; border: none; transition: height 0.25s ease;" scrolling="no" frameborder="0"></iframe>
            </div>
          `);
        }
      }

      // 3. X (Twitter)
      const xRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/([0-9]+)/g;
      let xMatch;
      while ((xMatch = xRegex.exec(allText)) !== null) {
        const tweetId = xMatch[1];
        if (!processed.has(tweetId)) {
          processed.add(tweetId);
          embedHtmls.push(`
            <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
              <iframe src="https://platform.twitter.com/embed/Tweet.html?id=${escapeHtml(tweetId)}&theme=${themeStr}" style="width: 100%; height: 260px; border: none;" scrolling="no" frameborder="0"></iframe>
            </div>
          `);
        }
      }

      // 4. TikTok
      const ttRegex = /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/video\/([0-9]+)/g;
      let ttMatch;
      while ((ttMatch = ttRegex.exec(allText)) !== null) {
        const videoId = ttMatch[1];
        if (!processed.has(videoId)) {
          processed.add(videoId);
          embedHtmls.push(`
            <div class="modal-embed-card" style="margin-bottom: 10px; border-radius: 10px; overflow: hidden;">
              <iframe src="https://www.tiktok.com/embed/v2/${escapeHtml(videoId)}" style="width: 100%; height: 460px; border: none;" scrolling="no" frameborder="0"></iframe>
            </div>
          `);
        }
      }

      return embedHtmls.join('');
    }

    // 세부 모달 멤버 16px 프로필 아바타 뱃지 생성기
    function getMemberDetailBadgesHTML(attendees) {
      if (!Array.isArray(attendees) || attendees.length === 0) return '';
      return attendees.map(a => {
        let realName = '멤버';
        if (typeof a === 'object' && a !== null) {
          if (a.id && MEMBER_ID_MAP[a.id]) realName = MEMBER_ID_MAP[a.id];
          else {
            const raw = (a.nickname || a.name || '').trim();
            realName = MEMBER_NICKNAME_MAP[raw] || raw;
          }
        } else if (typeof a === 'string') {
          const raw = a.trim();
          realName = MEMBER_ID_MAP[raw] || MEMBER_NICKNAME_MAP[raw] || raw;
        }
        const avatarUrl = MEMBER_AVATAR_MAP[realName] || '';
        const avatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" style="width:16px; height:16px; border-radius:50%; object-fit:cover; vertical-align:-2px; margin-right:4px; border:1px solid rgba(255,105,180,0.4);" alt="${escapeHtml(realName)}">` : '';
        return `<span style="display:inline-flex; align-items:center; background:rgba(255,105,180,0.12); border:1px solid rgba(255,105,180,0.28); border-radius:12px; padding:1px 8px; font-size:11px; font-weight:600; color:#ff80ab; margin:1px 2px;">${avatar}${escapeHtml(realName)}</span>`;
      }).join(' ');
    }

    // 확장프로그램 modals.js & templates.js 규격 100% 일치 세부 모달 (듀얼 카드 렌더러)
    function showUserPreviewDetail(item) {
      if (!item) return;
      const layer = document.getElementById('userPreviewDetailLayer');
      const badgeRow = document.getElementById('updBadgeRow');
      const titleEl = document.getElementById('updTitle');
      const dateTimeEl = document.getElementById('updDateTime');
      const channelEl = document.getElementById('updChannel');
      const locationEl = document.getElementById('updLocation');
      const attendeesEl = document.getElementById('updAttendees');
      const messageEl = document.getElementById('updMessage');
      const linkContainer = document.getElementById('updLinkContainer');
      const embedCard = document.getElementById('modalEmbedCard');
      const embedBody = document.getElementById('modalEmbedBodyContent');

      const type = resolveScheduleType(item);
      const badgeStyle = TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES['기타'];

      badgeRow.innerHTML = `<span class="user-sp-type-badge" style="background: ${badgeStyle.bg}; color: ${badgeStyle.color}; font-size: 11px; padding: 2px 7px;">${escapeHtml(type)}</span>` + getMemberAttendeeBadgesHTML(item.starAttendees);
      titleEl.textContent = item.title || item.message || '제목 없음';

      let timeText = '종일';
      if (!item.isAllday && item.startTime) {
        const d = new Date(item.startTime);
        const h = d.getHours();
        const min = String(d.getMinutes()).padStart(2, '0');
        const ap = h >= 12 ? '오후' : '오전';
        timeText = `${ap} ${h % 12 || 12}:${min}`;
      }

      // 확장프로그램 공식 SVG 아이콘 (일시, 장소, 채널)
      const calSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
      const pinSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
      const tvSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:4px;"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>`;

      dateTimeEl.innerHTML = `${calSvg}일시: ${item.startTime ? item.startTime.slice(0, 10) : ''} ${timeText}`;

      const ch = item.channel || (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null);
      if (ch) {
        channelEl.innerHTML = `${tvSvg}채널: ${escapeHtml(String(ch).trim())}`;
        channelEl.style.display = 'block';
      } else {
        channelEl.style.display = 'none';
      }

      const loc = item.location || (item.extField && item.extField.key === '장소' ? item.extField.value : null);
      if (loc) {
        locationEl.innerHTML = `${pinSvg}장소: ${escapeHtml(String(loc).trim())}`;
        locationEl.style.display = 'block';
      } else {
        locationEl.style.display = 'none';
      }

      if (attendeesEl) {
        const attendeesHtml = getMemberDetailBadgesHTML(item.starAttendees);
        if (attendeesHtml) {
          attendeesEl.innerHTML = `<span style="font-size: 11px; color: #94a3b8; margin-right: 4px;">참석 멤버:</span>${attendeesHtml}`;
          attendeesEl.style.display = 'flex';
          attendeesEl.style.flexWrap = 'wrap';
          attendeesEl.style.alignItems = 'center';
        } else {
          attendeesEl.style.display = 'none';
        }
      }

      if (item.message && item.message.trim() && item.message.trim() !== item.title) {
        messageEl.textContent = item.message.trim();
        messageEl.style.display = 'block';
      } else {
        messageEl.style.display = 'none';
      }

      // SNS 멀티미디어 카드 (YouTube, Instagram Reel/Post, X, TikTok)
      const mediaHtml = renderDetailMediaCards(item);
      if (embedCard && embedBody) {
        if (mediaHtml && mediaHtml.trim()) {
          embedBody.innerHTML = mediaHtml;
          embedCard.style.display = 'flex';
        } else {
          embedBody.innerHTML = '';
          embedCard.style.display = 'none';
        }
      }

      const linkUrl = item.url || item.link;
      if (linkUrl) {
        linkContainer.innerHTML = `
          <a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" class="btn-action" style="padding: 6px 12px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 6px;">
            🔗 바로가기
          </a>
        `;
      } else {
        linkContainer.innerHTML = '';
      }

      layer.style.display = 'flex';
    }

    function closeUpdDetail() {
      const layer = document.getElementById('userPreviewDetailLayer');
      if (layer) layer.style.display = 'none';
    }
    window.closeUpdDetail = closeUpdDetail;
    window.closeUserPreviewModal = closeUserPreviewModal;

    // 2단계 배포 버튼 이벤트 바인딩
    const btnSaveOverridesOnly = document.getElementById('btnSaveOverridesOnly');
    if (btnSaveOverridesOnly) {
      btnSaveOverridesOnly.addEventListener('click', async () => {
        closeUserPreviewModal();
        await onSaveToGistClick({ isPublish: false });
      });
    }

    const btnPublishToUsers = document.getElementById('btnPublishToUsers');
    if (btnPublishToUsers) {
      btnPublishToUsers.addEventListener('click', async () => {
        const confirmMsg = '🚀 [사용자 배포 적용]\n\n검수 완료된 변경 사항을 최종 배포하시겠습니까?\n(마스터 537건 기준선과 오버라이드가 결합되어 안전하게 배포됩니다)';
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(confirmMsg)) return;
        }
        closeUserPreviewModal();
        await onSaveToGistClick({ isPublish: true });
      });
    }

    // 모달 및 탭 이벤트 바인딩
    const btnOpenUserPreview = document.getElementById('btnOpenUserPreview');
    if (btnOpenUserPreview) btnOpenUserPreview.addEventListener('click', openUserPreviewModal);

    const btnCloseUserPreviewModal = document.getElementById('btnCloseUserPreviewModal');
    if (btnCloseUserPreviewModal) btnCloseUserPreviewModal.addEventListener('click', closeUserPreviewModal);

    const btnInspectorTabDiff = document.getElementById('btnInspectorTabDiff');
    if (btnInspectorTabDiff) btnInspectorTabDiff.addEventListener('click', () => switchInspectorTab('diff'));

    const btnInspectorTabPreview = document.getElementById('btnInspectorTabPreview');
    if (btnInspectorTabPreview) btnInspectorTabPreview.addEventListener('click', () => switchInspectorTab('preview'));

    const btnToggleUserPreviewTheme = document.getElementById('btnToggleUserPreviewTheme');
    if (btnToggleUserPreviewTheme) btnToggleUserPreviewTheme.addEventListener('click', toggleUserPreviewTheme);

    const btnCloseUpdDetail = document.getElementById('btnCloseUpdDetail');
    if (btnCloseUpdDetail) btnCloseUpdDetail.addEventListener('click', closeUpdDetail);

    document.getElementById('btnUserPrevMonth').addEventListener('click', () => {
      userPreviewDate.setMonth(userPreviewDate.getMonth() - 1);
      closeUpdDetail();
      renderUserPreviewSchedules();
    });

    document.getElementById('btnUserNextMonth').addEventListener('click', () => {
      userPreviewDate.setMonth(userPreviewDate.getMonth() + 1);
      closeUpdDetail();
      renderUserPreviewSchedules();
    });

    document.getElementById('btnUserToday').addEventListener('click', () => {
      userPreviewDate = new Date();
      closeUpdDetail();
      renderUserPreviewSchedules();
    });

    // 인라인 이벤트 및 콘솔 디버깅용 함수 노출
    window.approveScheduleItem = approveScheduleItem;
    window.openEditModalByKey = openEditModalByKey;
    window.restoreItem = restoreItem;
    window.decodeHtmlEntities = decodeHtmlEntities;

    // 앱 초기화 진입점
    const initialToken = getStoredToken();
    if (initialToken) {
      showApp();
      loadSchedules();
    } else {
      showGatekeeper();
    }
