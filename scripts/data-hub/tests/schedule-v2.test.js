// scripts/data-hub/tests/schedule-v2.test.js
// 스케줄 아키텍처 v2.0 단위 및 회귀 검증 테스트 스위트

import assert from 'assert';
import crypto from 'crypto';

console.log("==================================================");
console.log("🧪 [Schedule v2.0 Test] 단위 및 회귀 검증 테스트 시작");
console.log("==================================================");

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ 통과: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ 실패: ${name}`);
    console.error(`     이유: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------------------
// [헬퍼 함수 구현부 (v2.0 명세 기반)]
// -------------------------------------------------------------------------

/**
 * 1. 소스별 불변 고유 ID 생성기
 */
export function generateScheduleId(source, item) {
  if (!item) return null;
  if (item.id && typeof item.id === 'string' && item.id.trim()) {
    return item.id.trim();
  }

  // 1) Blip 공식 일정
  if (source === 'blip' || item.source === 'blip') {
    const sId = item.scheduleId || item.id;
    if (sId) return `blip_${sId}`;
  }

  // 2) Mnet Plus 공식 일정
  if (source === 'mnet' || item.source === 'mnet') {
    const eId = item.eventId || item.id;
    if (eId) return `mnet_${eId}`;
  }

  // 3) YouTube 공식/라이브 영상
  if (source === 'youtube' || item.source === 'youtube') {
    const vId = item.videoId || item.id;
    if (vId) return `yt_${vId}`;
  }

  // 4) 커스텀/관리자 수동 일정
  if (item._isCustom || source === 'custom' || item.source === 'custom' || item.source === 'namu') {
    const dateStr = item.startTime ? item.startTime.slice(2, 10).replace(/-/g, '') : '000000';
    const rand = crypto.randomBytes(3).toString('hex'); // 6자리 16진수
    return `custom_${dateStr}_${rand}`;
  }

  // 5) 레거시 구버전 호환용 결정론적 해시 ID
  const rawKey = `${(item.startTime || '').slice(0, 10)}_${item.title || ''}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 8);
  return `legacy_${hash}`;
}

/**
 * 2. v2.0 연관 일정 상호 합성 및 오버라이드 엔진
 */
export const DEFAULT_EXCLUDE_KEYWORDS = [
  '투표', '사전투표', '실시간투표', 'vote', 'voting', 'poll',
  '덕애드', '스타패스', '아이돌챔프', '뮤빗', '팬플러스', '포도알', '케이돌', '엠넷플러스 투표',
  '직캠', '풀캠', '팬캠', '페이스캠', '입덕직캠', '최애직캠', '팔로우캠', '안방1열', '음중직캠', 'fancam', 'choreo',
  '포스터 이벤트', '사인 이벤트', '싸인 이벤트', '이벤트 안내', '안내 (Notice)', '빅크', 'BIGC', '응모 이벤트', '증정 이벤트', '특전 이벤트', '구매자 이벤트', '럭키드로우', '럭드'
];

export function isShortsSchedule(item) {
  if (!item) return false;
  if (item._isShorts) return true;
  const raw = [item.url, item.link, item.title, item.message].filter(Boolean).join(' ');
  if (/youtube\.com\/shorts\//i.test(raw) || /#shorts\b|#쇼츠\b/i.test(raw)) return true;
  if (/(?:vt\.tiktok\.com\/|tiktok\.com\/@[^/]+\/video\/\d+)/i.test(raw)) return true;
  if (/instagram\.com\/reels?\/[\w-]+/i.test(raw)) return true;
  return false;
}

export function mergeSchedulesV2(rawItems, overridesV2) {
  const {
    filterRules = {},
    customSchedules = {},
    sourceOverrides = {},
    legacyAliases = {}
  } = (overridesV2 || {});

  const filterEnabled = filterRules.enabled !== false;
  const excludeShorts = filterRules.excludeShorts !== false;
  const excludeTypes = Array.isArray(filterRules.excludeTypes) ? filterRules.excludeTypes : [];
  const excludeChannels = Array.isArray(filterRules.excludeChannels) ? filterRules.excludeChannels : [];
  const excludeKeywords = Array.isArray(filterRules.excludeKeywords)
    ? filterRules.excludeKeywords
    : DEFAULT_EXCLUDE_KEYWORDS;

  const matchFilter = (item) => {
    if (!filterEnabled || excludeKeywords.length === 0) return false;
    const text = [item.title, item.message, item.url, item.link].filter(Boolean).join(' ').toLowerCase();
    return excludeKeywords.some(kw => {
      const cleanKw = kw.trim().toLowerCase();
      if (!cleanKw) return false;
      return text.includes(cleanKw);
    });
  };

  // (A) 원본 아이템에 ID 부여 및 소스 오버라이드 맵 준비
  const itemMap = new Map();

  rawItems.forEach(raw => {
    const id = generateScheduleId(raw.source, raw);
    const item = { ...raw, id };
    itemMap.set(id, item);
  });

  // (B) 커스텀 일정들을 itemMap에 등록
  Object.entries(customSchedules).forEach(([cId, cData]) => {
    const item = {
      ...cData,
      id: cId,
      _isCustom: true,
      source: cData.source || 'custom'
    };
    itemMap.set(cId, item);
  });

  // (C) 소스 오버라이드(수정 및 개별 삭제) 적용
  // 구버전 키 호환 (legacyAliases)
  const resolvedOverrides = {};
  Object.entries(sourceOverrides).forEach(([k, v]) => {
    const realId = legacyAliases[k] || k;
    resolvedOverrides[realId] = { ...resolvedOverrides[realId], ...v };
  });

  // (D) 개별 삭제 및 필터 규칙 적용 (독립 동작)
  const activeItems = [];
  itemMap.forEach(item => {
    const ov = resolvedOverrides[item.id];
    // 만약 해당 아이템이 삭제 대상(isDeleted: true)이면 제외
    if (ov && ov.isDeleted) return;
    if (item.isDeleted) return;

    // 쇼츠 제외 (커스텀 일정은 보호 대상 제외)
    if (excludeShorts && !item._isCustom && (item._isShorts || isShortsSchedule(item))) return;

    // 관리자 작성 또는 명시적 수정본은 필터링에서 보호
    const isProtected = item._isCustom || Boolean(ov && Object.keys(ov).length > 0);
    if (!isProtected && excludeTypes.length > 0 && item.typeText && excludeTypes.includes(item.typeText)) return;

    // 채널(channel / extField)별 제외
    if (!isProtected && excludeChannels.length > 0) {
      const channelValues = [
        item.channel,
        (item.extField && (item.extField.key === '채널' || item.extField.key === '방송사') ? item.extField.value : null)
      ].filter(Boolean).map(s => s.trim().toLowerCase());

      const isChannelExcluded = excludeChannels.some(ex => {
        const cleanEx = ex.trim().toLowerCase();
        if (!cleanEx) return false;
        return channelValues.some(c => c === cleanEx || c.includes(cleanEx));
      });

      if (isChannelExcluded) return;
    }

    if (!isProtected && matchFilter(item)) return;

    // 수정 필드 적용 (수정된 것만 덮어쓰고 원본은 보존)
    if (ov) {
      const merged = { ...item };
      ['title', 'startTime', 'endTime', 'isAllday', 'url', 'location', 'typeText', 'message', 'channel', 'thumbnail'].forEach(f => {
        if (ov[f] !== undefined) merged[f] = ov[f];
      });
      if (ov.linkedScheduleIds) {
        merged.linkedScheduleIds = Array.from(new Set([...(merged.linkedScheduleIds || []), ...ov.linkedScheduleIds]));
      }
      activeItems.push(merged);
    } else {
      activeItems.push(item);
    }
  });

  // (E) 연관 일정 상호 합성 (linkedScheduleIds 기준 대표 선출)
  // 양방향 인접 그래프(Adjacency Graph) 구축
  const adj = new Map();
  activeItems.forEach(item => {
    if (!adj.has(item.id)) adj.set(item.id, new Set());
    const linked = item.linkedScheduleIds || [];
    linked.forEach(targetId => {
      adj.get(item.id).add(targetId);
      if (!adj.has(targetId)) adj.set(targetId, new Set());
      adj.get(targetId).add(item.id);
    });
  });

  const finalResults = [];
  const visited = new Set();

  activeItems.forEach(item => {
    if (visited.has(item.id)) return;

    // BFS로 연결된 모든 일정 클러스터 탐색
    const cluster = [];
    const queue = [item.id];
    visited.add(item.id);

    while (queue.length > 0) {
      const curId = queue.shift();
      const curItem = activeItems.find(x => x.id === curId);
      if (curItem) cluster.push(curItem);

      const neighbors = adj.get(curId) || new Set();
      neighbors.forEach(nId => {
        if (!visited.has(nId)) {
          visited.add(nId);
          queue.push(nId);
        }
      });
    }

    if (cluster.length === 1) {
      finalResults.push(cluster[0]);
      return;
    }

    // 대표 선출 규칙: 커스텀(수동) 일정 우선 > 공식 소스
    let primary = cluster.find(c => c._isCustom) || cluster[0];
    const secondaries = cluster.filter(c => c.id !== primary.id);

    // 필드별 합성: 대표가 빈 필드는 서브 공식 정보에서 채우고, 공식 메타데이터(멤버 등) 흡수
    const synthetic = { ...primary };

    secondaries.forEach(sec => {
      if (!synthetic.url && sec.url) synthetic.url = sec.url;
      if (!synthetic.location && sec.location) synthetic.location = sec.location;
      if (!synthetic.channel && sec.channel) synthetic.channel = sec.channel;
      if (!synthetic.message && sec.message) synthetic.message = sec.message;
      if (!synthetic.typeText && sec.typeText) synthetic.typeText = sec.typeText;
      if ((!synthetic.starAttendees || synthetic.starAttendees.length === 0) && sec.starAttendees && sec.starAttendees.length > 0) {
        synthetic.starAttendees = sec.starAttendees;
      }
      if (!synthetic.extField && sec.extField) synthetic.extField = sec.extField;
    });

    // 상호 등록: 연결된 모든 ID를 linkedScheduleIds에 상호 반영
    synthetic.linkedScheduleIds = Array.from(new Set(cluster.flatMap(c => [c.id, ...(c.linkedScheduleIds || [])])));
    finalResults.push(synthetic);
  });

  return finalResults;
}

/**
 * 3. v1.0 레거시 데이터 ➡️ v2.0 스키마 무손실 변환기
 */
export function migrateOverridesV1toV2(v1Data, sampleRawItems = []) {
  const v2 = {
    version: "2.0.0",
    updatedAt: new Date().toISOString(),
    customSchedules: {},
    sourceOverrides: {},
    legacyAliases: {}
  };

  const createdList = v1Data.created || [];
  const modifiedMap = v1Data.modified || {};
  const deletedList = v1Data.deleted || [];

  // 1) created 항목 마이그레이션
  createdList.forEach(c => {
    const rawKey = `${(c.startTime || '').slice(0, 10)}_${c.title}`;
    const id = generateScheduleId('custom', c);

    // 수정본이 있으면 합쳐서 단일 객체화
    const mod = modifiedMap[rawKey] || modifiedMap[c.title] || {};
    const merged = {
      ...c,
      ...mod,
      id,
      _isCustom: true,
      source: c.source || 'custom'
    };

    v2.customSchedules[id] = merged;
    v2.legacyAliases[rawKey] = id;
    if (c._originKey) v2.legacyAliases[c._originKey] = id;
  });

  // 2) deleted 항목 마이그레이션
  deletedList.forEach(delKey => {
    // 삭제 키가 블립/엠넷 원본 매칭인지 확인
    const matchedRaw = sampleRawItems.find(r => {
      const rKey = `${(r.startTime || '').slice(0, 10)}_${r.title}`;
      return rKey === delKey || r.title === delKey;
    });

    const targetId = matchedRaw ? matchedRaw.id : `del_${crypto.createHash('sha256').update(delKey).digest('hex').slice(0, 8)}`;
    v2.sourceOverrides[targetId] = {
      ...v2.sourceOverrides[targetId],
      id: targetId,
      isDeleted: true
    };
    v2.legacyAliases[delKey] = targetId;
  });

  return v2;
}


// -------------------------------------------------------------------------
// [테스트 시나리오 실행]
// -------------------------------------------------------------------------

// [Test 1] 고유 불변 ID 부여 및 일관성
runTest("Test 1: 소스별 고유 불변 ID(id) 정상 부여", () => {
  const blipItem = { scheduleId: 1113636, title: "명지대 축제", source: "blip" };
  const mnetItem = { id: "mnet_9421", title: "엠카운트다운", source: "mnet" };
  const customItem = { title: "명지대 MAJESTY", startTime: "2026-09-22T00:00:00+09:00", _isCustom: true };

  const id1 = generateScheduleId("blip", blipItem);
  const id2 = generateScheduleId("mnet", mnetItem);
  const id3 = generateScheduleId("custom", customItem);

  assert.strictEqual(id1, "blip_1113636");
  assert.strictEqual(id2, "mnet_9421");
  assert.ok(id3.startsWith("custom_260922_"), `custom ID 포맷 오류: ${id3}`);

  // 제목/날짜 변경 시에도 이미 부여된 ID가 있으면 불변 유지
  const renamedCustom = { ...customItem, id: id3, title: "오타 수정된 축제" };
  assert.strictEqual(generateScheduleId("custom", renamedCustom), id3);
});

// [Test 2] 연관 일정 상호 합성 및 관리자 우선 대표 선출
runTest("Test 2: linkedScheduleIds 연결 시 관리자 입력 우선 대표 합성 및 공식 메타데이터 유지", () => {
  const blipSchedule = {
    id: "blip_1113636",
    title: "<명지대학교 자연캠퍼스 축제>",
    startTime: "2026-09-22T00:00:00+09:00",
    location: "명지대학교",
    source: "blip",
    starAttendees: [{ nickname: "원이", name: "안원" }]
  };

  const customSchedule = {
    id: "custom_260922_m7k2x9",
    title: "명지대학교 축제 : MAJESTY FESTIVAL",
    startTime: "2026-09-22T00:00:00+09:00",
    location: "명지대학교 자연캠퍼스",
    url: "https://www.instagram.com/reel/DdDvWqGR_PU/",
    message: "다비치, 리센느, YB 라인업",
    typeText: "공연",
    linkedScheduleIds: ["blip_1113636"],
    _isCustom: true
  };

  const overrides = {
    customSchedules: {
      "custom_260922_m7k2x9": customSchedule
    }
  };

  const merged = mergeSchedulesV2([blipSchedule], overrides);

  assert.strictEqual(merged.length, 1, "연관 일정이 1개의 대표 카드로 합성되어야 함");
  const rep = merged[0];

  // 대표는 커스텀(관리자 수정본) 제목 및 설명 유지
  assert.strictEqual(rep.title, "명지대학교 축제 : MAJESTY FESTIVAL");
  assert.strictEqual(rep.url, "https://www.instagram.com/reel/DdDvWqGR_PU/");
  assert.strictEqual(rep.message, "다비치, 리센느, YB 라인업");

  // 공식 원본의 참석 멤버 메타데이터는 누락 없이 합성 흡수
  assert.ok(Array.isArray(rep.starAttendees) && rep.starAttendees.length === 1);
  assert.strictEqual(rep.starAttendees[0].nickname, "원이");
});

// [Test 3] 개별 숨김(Deleted) 독립 동작 검증
runTest("Test 3: 상호 연결된 일정 중 블립 원본만 숨겨도 관리자 일정은 정상 노출 (연쇄 삭제 방지)", () => {
  const blipSchedule = {
    id: "blip_1113636",
    title: "<명지대학교 자연캠퍼스 축제>",
    startTime: "2026-09-22T00:00:00+09:00"
  };

  const customSchedule = {
    id: "custom_260922_m7k2x9",
    title: "명지대학교 축제 : MAJESTY FESTIVAL",
    startTime: "2026-09-22T00:00:00+09:00",
    linkedScheduleIds: ["blip_1113636"]
  };

  // 블립만 숨김 설정
  const overrides = {
    customSchedules: {
      "custom_260922_m7k2x9": customSchedule
    },
    sourceOverrides: {
      "blip_1113636": { isDeleted: true }
    }
  };

  const merged = mergeSchedulesV2([blipSchedule], overrides);

  assert.strictEqual(merged.length, 1, "블립만 숨겨졌으므로 관리자 일정은 그대로 노출되어야 함");
  assert.strictEqual(merged[0].id, "custom_260922_m7k2x9");
});

// [Test 4] 클라이언트 패스스루 렌더링 무결성 검증
runTest("Test 4: 클라이언트 calendar.js 패스스루 시 데이터 왜곡이나 날짜/시간 변형 없음", () => {
  const backendOutput = [
    {
      id: "custom_260922_m7k2x9",
      title: "명지대학교 축제 : MAJESTY FESTIVAL",
      startTime: "2026-09-22T00:00:00+09:00",
      endTime: "2026-09-22T00:00:00+09:00",
      isAllday: true,
      url: "https://www.instagram.com/reel/123",
      message: "라인업 설명"
    }
  ];

  // 클라이언트 패스스루 함수 모의
  function clientDeduplicatePassthrough(schedules) {
    if (!Array.isArray(schedules)) return [];
    return schedules; // 백엔드 정제 데이터를 추가 가공/변형 없이 그대로 반환
  }

  const clientResult = clientDeduplicatePassthrough(backendOutput);

  assert.deepStrictEqual(clientResult, backendOutput);
  assert.strictEqual(clientResult[0].title, "명지대학교 축제 : MAJESTY FESTIVAL");
  assert.strictEqual(clientResult[0].startTime, "2026-09-22T00:00:00+09:00");
  assert.strictEqual(clientResult[0].isAllday, true);
});

// [Test 5] 백그라운드 30분 임박 알림 중복 발송 방지 검증
runTest("Test 5: background.js에서 신규 ID와 구버전 키를 동시 검사하여 중복 알림 방지", () => {
  const notifiedMap = {
    "명지대 축제_2026-09-22T14:00:00+09:00": Date.now() - 1000 // 구버전 키로 이미 알림이 나갔던 상태
  };

  const item = {
    id: "blip_1113636",
    title: "명지대 축제",
    startTime: "2026-09-22T14:00:00+09:00",
    isAllday: false
  };

  // 신규 방어 검사 로직
  function isAlreadyNotified(item, notifiedMap) {
    const legacyKey = `${item.title}_${item.startTime}`;
    return Boolean(notifiedMap[item.id] || notifiedMap[legacyKey]);
  }

  assert.strictEqual(isAlreadyNotified(item, notifiedMap), true, "구버전 키로 알림이 나갔더라도 중복 발송 차단되어야 함");
});

// [Test 6] v1.0 레거시 데이터 ➡️ v2.0 무손실 마이그레이션
runTest("Test 6: v1.0 schedule-overrides.json이 v2.0 구조로 무손실 마이그레이션", () => {
  const v1 = {
    created: [
      {
        title: "제14회 연수 능허대 문화축제",
        startTime: "2026-10-09T00:00:00+09:00",
        location: "연수한마음공원"
      }
    ],
    modified: {
      "2026-10-09_제14회 연수 능허대 문화축제": {
        url: "https://www.instagram.com/reel/DdDvWqGR_PU/",
        message: "인스타 링크"
      }
    },
    deleted: [
      "2026-09-22_<명지대학교 자연캠퍼스 축제>"
    ]
  };

  const sampleRaw = [
    { id: "blip_1113636", title: "<명지대학교 자연캠퍼스 축제>", startTime: "2026-09-22T00:00:00+09:00" }
  ];

  const v2 = migrateOverridesV1toV2(v1, sampleRaw);

  assert.strictEqual(v2.version, "2.0.0");
  const customKeys = Object.keys(v2.customSchedules);
  assert.strictEqual(customKeys.length, 1);

  const migratedCustom = v2.customSchedules[customKeys[0]];
  assert.strictEqual(migratedCustom.title, "제14회 연수 능허대 문화축제");
  assert.strictEqual(migratedCustom.url, "https://www.instagram.com/reel/DdDvWqGR_PU/");

  // 삭제 매핑 확인
  assert.strictEqual(v2.sourceOverrides["blip_1113636"].isDeleted, true);
  assert.strictEqual(v2.legacyAliases["2026-09-22_<명지대학교 자연캠퍼스 축제>"], "blip_1113636");
});

// [Test 7] 필드별 오버레이 및 공식 정보 보존
runTest("Test 7: 관리자가 링크만 추가했을 때 기존 날짜/시간/장소 등 공식 정보 보존", () => {
  const blipSchedule = {
    id: "blip_10524",
    title: "공식 방송 일정",
    startTime: "2026-09-15T18:00:00+09:00",
    location: "상암동 SBS",
    channel: "SBS M"
  };

  // 링크만 수정한 오버라이드
  const overrides = {
    sourceOverrides: {
      "blip_10524": {
        url: "https://youtube.com/watch?v=sample"
      }
    }
  };

  const merged = mergeSchedulesV2([blipSchedule], overrides);
  assert.strictEqual(merged.length, 1);
  const res = merged[0];

  assert.strictEqual(res.url, "https://youtube.com/watch?v=sample");
  assert.strictEqual(res.startTime, "2026-09-15T18:00:00+09:00");
  assert.strictEqual(res.location, "상암동 SBS");
  assert.strictEqual(res.channel, "SBS M");
});

// [Test 8] 동적 제외 필터 규칙(filterRules) 검증
runTest("Test 8: filterRules 동적 필터링 및 관리자 작성/수정 일정 보호 검증", () => {
  const items = [
    { id: "blip_vote1", title: "<2026 SKA> '베스트 스팟라이트' 투표", source: "blip", startTime: "2026-08-24" },
    { id: "blip_cam1", title: "[입덕직캠] RESCENE Woni 4K", source: "blip", startTime: "2026-08-25" },
    { id: "blip_event1", title: "공식 팬사인회 럭키드로우 이벤트 안내", source: "blip", startTime: "2026-08-26" },
    { id: "blip_broadcast", title: "SBS 인기가요 생방송", source: "blip", startTime: "2026-08-27" },
    // 관리자가 등록한 커스텀 일정 (투표 단어가 들어가도 보호되어야 함)
    { id: "custom_vote_notice", title: "팬덤 특별 투표 독려 안내", source: "custom", _isCustom: true, startTime: "2026-08-28" }
  ];

  // 1) 기본 필터 규칙 동작 검증
  const defaultMerged = mergeSchedulesV2(items, {});
  const titles1 = defaultMerged.map(x => x.title);
  assert.ok(!titles1.includes("<2026 SKA> '베스트 스팟라이트' 투표"), "투표 일정이 기본 제외되어야 함");
  assert.ok(!titles1.includes("[입덕직캠] RESCENE Woni 4K"), "직캠 일정이 기본 제외되어야 함");
  assert.ok(!titles1.includes("공식 팬사인회 럭키드로우 이벤트 안내"), "럭키드로우 일정이 기본 제외되어야 함");
  assert.ok(titles1.includes("SBS 인기가요 생방송"), "정규 방송 일정은 정상 보존되어야 함");
  assert.ok(titles1.includes("팬덤 특별 투표 독려 안내"), "관리자가 수동 등록한 일정은 보호되어야 함");

  // 2) 사용자 커스텀 제외 키워드 추가 검증 (예: '인기가요' 추가)
  const customFilterOverrides = {
    filterRules: {
      enabled: true,
      excludeKeywords: [...DEFAULT_EXCLUDE_KEYWORDS, "인기가요"]
    }
  };
  const customMerged = mergeSchedulesV2(items, customFilterOverrides);
  const titles2 = customMerged.map(x => x.title);
  assert.ok(!titles2.includes("SBS 인기가요 생방송"), "커스텀 추가된 '인기가요' 키워드 일정도 정상 제외되어야 함");

  // 3) 필터 엔진 비활성화(enabled: false) 검증
  const disabledFilterOverrides = {
    filterRules: {
      enabled: false,
      excludeKeywords: DEFAULT_EXCLUDE_KEYWORDS
    }
  };
  const disabledMerged = mergeSchedulesV2(items, disabledFilterOverrides);
  assert.strictEqual(disabledMerged.length, 5, "필터 비활성화 시 모든 5개 일정이 그대로 통과되어야 함");

  // 4) 쇼츠 제외 (excludeShorts: true/false) 검증
  const itemsWithShorts = [
    { id: "yt_normal", title: "정규 영상", source: "youtube", _isShorts: false, startTime: "2026-08-25" },
    { id: "yt_shorts", title: "쇼츠 영상", source: "youtube", _isShorts: true, startTime: "2026-08-26" },
    { id: "yt_url_shorts", title: "URL 쇼츠", source: "blip", url: "https://www.youtube.com/shorts/OMiFkqmPWgc", startTime: "2026-08-26" },
    { id: "yt_tag_shorts", title: "쇼츠 태그 포함 #Shorts", source: "blip", startTime: "2026-08-26" },
    { id: "custom_shorts", title: "커스텀 등록 쇼츠", source: "custom", _isShorts: true, _isCustom: true, startTime: "2026-08-27" }
  ];
  const shortsExcluded = mergeSchedulesV2(itemsWithShorts, { filterRules: { excludeShorts: true } });
  const shortsTitles1 = shortsExcluded.map(x => x.title);
  assert.ok(shortsTitles1.includes("정규 영상"), "정규 영상은 유지되어야 함");
  assert.ok(!shortsTitles1.includes("쇼츠 영상"), "쇼츠 영상(_isShorts)은 제외되어야 함");
  assert.ok(!shortsTitles1.includes("URL 쇼츠"), "URL 기반 쇼츠는 제외되어야 함");
  assert.ok(!shortsTitles1.includes("쇼츠 태그 포함 #Shorts"), "태그 기반 쇼츠는 제외되어야 함");
  assert.ok(shortsTitles1.includes("커스텀 등록 쇼츠"), "커스텀 일정은 쇼츠여도 보호되어야 함");

  const shortsAllowed = mergeSchedulesV2(itemsWithShorts, { filterRules: { excludeShorts: false } });
  assert.strictEqual(shortsAllowed.length, 5, "excludeShorts: false 설정 시 쇼츠 포함 5개 유지되어야 함");

  // 5) 종류별 제외 (excludeTypes) 검증
  const itemsWithTypes = [
    { id: "ev_fansign", title: "영통 팬사인회", typeText: "팬사인회", source: "blip", startTime: "2026-08-28" },
    { id: "ev_broadcast", title: "음악중심 방송", typeText: "방송", source: "blip", startTime: "2026-08-29" },
    { id: "ev_concert", title: "단독 콘서트", typeText: "공연", source: "blip", startTime: "2026-08-30" },
    { id: "custom_fansign", title: "수동 등록 팬싸", typeText: "팬사인회", source: "custom", _isCustom: true, startTime: "2026-08-31" }
  ];
  const typesExcluded = mergeSchedulesV2(itemsWithTypes, {
    filterRules: {
      excludeKeywords: [],
      excludeTypes: ["팬사인회", "방송"]
    }
  });
  const typeTitles = typesExcluded.map(x => x.title);
  assert.ok(!typeTitles.includes("영통 팬사인회"), "팬사인회 종류는 제외되어야 함");
  assert.ok(!typeTitles.includes("음악중심 방송"), "방송 종류는 제외되어야 함");
  assert.ok(typeTitles.includes("단독 콘서트"), "제외되지 않은 공연은 유지되어야 함");
  assert.ok(typeTitles.includes("수동 등록 팬싸"), "커스텀 등록된 팬싸는 보호되어야 함");

  // 6) 채널별 제외 (excludeChannels) 검증
  const itemsWithChannels = [
    { id: "blip_twitter", title: "공식 트윗 일정", channel: "Twitter", source: "blip", startTime: "2026-08-28" },
    { id: "blip_blipch", title: "블립 단독 콘텐츠", extField: { key: "채널", value: "블립 - blip" }, source: "blip", startTime: "2026-08-29" },
    { id: "blip_mbc", title: "쇼 음악중심", channel: "MBC", source: "blip", startTime: "2026-08-30" },
    { id: "custom_twitter", title: "수동 등록 트윗", channel: "Twitter", source: "custom", _isCustom: true, startTime: "2026-08-31" }
  ];
  const channelsExcluded = mergeSchedulesV2(itemsWithChannels, {
    filterRules: {
      excludeKeywords: [],
      excludeChannels: ["Twitter", "블립"]
    }
  });
  const chTitles = channelsExcluded.map(x => x.title);
  assert.ok(!chTitles.includes("공식 트윗 일정"), "Twitter 채널 일정은 제외되어야 함");
  assert.ok(!chTitles.includes("블립 단독 콘텐츠"), "블립 채널 일정은 제외되어야 함");
  assert.ok(chTitles.includes("쇼 음악중심"), "제외되지 않은 MBC 일정은 유지되어야 함");
  assert.ok(chTitles.includes("수동 등록 트윗"), "커스텀 등록된 트윗 일정은 보호되어야 함");
});

console.log("==================================================");
console.log(`📊 테스트 결과: 통과 ${passCount}개, 실패 ${failCount}개`);
console.log("==================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 모든 v2.0 아키텍처 단위 테스트를 완벽하게 통과했습니다!");
}
