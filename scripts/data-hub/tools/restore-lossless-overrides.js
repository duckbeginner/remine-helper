// scripts/data-hub/tools/restore-lossless-overrides.js
// 과거 분실된 184건의 일정 수정 내역(키움 시구, 유성온천축제, 입크 페스티벌 등) 무손실 복원 도구
// ⚠️ [ARCHITECTURAL CONSTRAINT - SEC-HYDR-02]:
// 본 도구는 과거 유실 데이터의 재난 복구를 위한 1회성(One-Off) 전용 CLI 복원 도구입니다.
// 관리자의 의도적인 언링크(Unlink) 보장 원칙(DEF-03)을 보호하기 위해, 본 도구는 CI/CD 워크플로우
// (data-hub-sync.yml 등)나 정기 파이프라인에 영구 등록되어서는 안 됩니다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

const GIST_BCBD_FILE = path.join(ROOT_DIR, '.cache/gist-commit-bcbd6cb4.json');
const REBUILD_FILE = path.join(ROOT_DIR, '.cache/rebuild/schedule-overrides.json');
const CURRENT_FILE = path.join(ROOT_DIR, '.cache/schedule-overrides.json');
const MASTER_FILE = path.join(ROOT_DIR, 'docs/api/v1/master-schedules.json');
const SEEDS_STREAMS_FILE = path.join(ROOT_DIR, 'scripts/data-hub/seeds/official-streams.json');

/**
 * 무손실 오버라이드 합성 순수 함수
 * @param {Object} options
 * @param {Object} options.rebuildData .cache/rebuild/schedule-overrides.json 데이터
 * @param {Object} options.currentData 현재 .cache/schedule-overrides.json 데이터
 * @param {Array} options.masterItems docs/api/v1/master-schedules.json items 배열
 * @param {Array} options.officialStreams scripts/data-hub/seeds/official-streams.json 배열
 * @returns {Object} { restoredOverrides, stats }
 */
export function restoreLosslessOverrides({
  rebuildData = {},
  currentData = {},
  masterItems = [],
  officialStreams = []
}) {
  const rebuildSO = rebuildData.sourceOverrides || {};
  const currentSO = currentData.sourceOverrides || {};

  // [SEC-HYDR-01]: 단락 평가 결함 차단 -> Rebuild와 Current의 customSchedules 무손실 병합
  const customSchedules = {};
  for (const [id, item] of Object.entries(rebuildData.customSchedules || {})) {
    if (item && item.id) customSchedules[id] = { ...item };
  }
  for (const [id, item] of Object.entries(currentData.customSchedules || {})) {
    if (item && item.id) {
      customSchedules[id] = { ...customSchedules[id], ...item };
    }
  }

  // [SEC-HYDR-03]: sourceOverrides에 잔존하던 custom_ 키의 링크를 customSchedules로 완전 흡수 통합
  const absorbCustomLinks = (soMap) => {
    for (const [k, v] of Object.entries(soMap)) {
      if (k.startsWith('custom_') && Array.isArray(v.linkedScheduleIds) && customSchedules[k]) {
        customSchedules[k].linkedScheduleIds = [
          ...(customSchedules[k].linkedScheduleIds || []),
          ...v.linkedScheduleIds
        ];
      }
    }
  };
  absorbCustomLinks(rebuildSO);
  absorbCustomLinks(currentSO);

  // 1. 유효 ID 풀 구축 (마스터 + 커스텀 + 공식 유튜브 시드)
  const validIdSet = new Set(masterItems.map(i => i.id).filter(Boolean));
  for (const cid of Object.keys(customSchedules)) {
    validIdSet.add(cid);
  }
  for (const stream of officialStreams) {
    if (stream && stream.id) {
      validIdSet.add(`yt_${stream.id}`);
    }
  }

  // 2. 대상 키 전수 집합 (Rebuild + Current)
  const allCandidateKeys = new Set([...Object.keys(rebuildSO), ...Object.keys(currentSO)]);

  // Canonical 정규식 (ADR-0002: blip_, mnet_, yt_, del_)
  // [SEC-HYDR-03]: custom_ 일정은 customSchedules가 단일 SSOT이므로 sourceOverrides 등록 원천 차단!
  const canonicalKeyRegex = /^(blip_|mnet_|yt_|del_)[a-zA-Z0-9_-]+$/;

  const validKeys = [];
  const droppedKeys = [];

  for (const k of allCandidateKeys) {
    if (k.startsWith('custom_')) {
      // custom_ 키는 customSchedules로 통합되었으므로 sourceOverrides에서는 제외
      droppedKeys.push({ key: k, reason: 'Custom schedule absorbed into customSchedules (SEC-HYDR-03)' });
      continue;
    }
    if (!canonicalKeyRegex.test(k)) {
      droppedKeys.push({ key: k, reason: 'Non-canonical format (ADR-0002)' });
      continue;
    }
    // 마스터, 유튜브 시드 풀에 존재하거나 tombstone인 경우 유효
    if (validIdSet.has(k) || k.startsWith('del_') || currentSO[k]?.isDeleted || rebuildSO[k]?.isDeleted) {
      validKeys.push(k);
    } else {
      droppedKeys.push({ key: k, reason: 'Orphan key not found in master/yt pool' });
    }
  }

  const restoredSO = {};
  let restoredPropertyCount = 0;
  let currentPrecedenceCount = 0;

  // 3. 속성 단위 정밀 무손실 합성 (Rebuild Base + Current Precedence)
  for (const k of validKeys) {
    const r = rebuildSO[k] || {};
    const c = currentSO[k] || {};
    const merged = {};

    // 3-1. Rebuild의 모든 속성 복사 (무손실 베이스)
    for (const [field, val] of Object.entries(r)) {
      if (val !== undefined && val !== null) {
        merged[field] = val;
        restoredPropertyCount++;
      }
    }

    // 3-2. Current의 속성이 존재하는 경우 최우선 덮어쓰기 (Current Precedence)
    for (const [field, val] of Object.entries(c)) {
      if (val !== undefined && val !== null) {
        if (field === 'linkedScheduleIds') {
          // 링크는 아래 4단계에서 양방향 결합 및 정제
          continue;
        }
        if (field === 'url' && typeof val === 'string' && typeof r.url === 'string') {
          // c의 url이 x:123 등 단축형이고 r의 url이 https://... 일 때 동일 타겟이면 온전한 full URL 보존
          if (val.startsWith('x:') && r.url.includes(val.slice(2))) {
            continue;
          }
          if (val.startsWith('yt:') && r.url.includes(val.slice(3))) {
            continue;
          }
        }
        merged[field] = val;
        currentPrecedenceCount++;
      }
    }

    // 3-3. 삭제 상태 최우선 고정 (좀비 부활 원천 차단)
    if (c.isDeleted || r.isDeleted) {
      merged.isDeleted = true;
    }

    // 3-4. 링크 초기 결합
    const rawLinks = new Set([
      ...(Array.isArray(r.linkedScheduleIds) ? r.linkedScheduleIds : []),
      ...(Array.isArray(c.linkedScheduleIds) ? c.linkedScheduleIds : [])
    ]);

    // 구버전 가상키 (${date}_${title}) 및 임시 mod_ ID 필터링
    const cleanedLinks = [...rawLinks].filter(tid => {
      if (!tid || typeof tid !== 'string') return false;
      if (tid.includes('_<') || /^\d{4}-\d{2}-\d{2}_/.test(tid)) return false; // 날짜+제목 가상키 차단
      if (tid.startsWith('mod_')) return false; // 과거 임시 해시 차단
      return validIdSet.has(tid); // 실존 ID 검증
    });

    if (cleanedLinks.length > 0) {
      merged.linkedScheduleIds = cleanedLinks;
    } else {
      delete merged.linkedScheduleIds;
    }

    if (Object.keys(merged).length > 0) {
      restoredSO[k] = merged;
    }
  }

  // 4. 완전 양방향 대칭 보정 (Bidirectional Symmetry Guarantee)
  // A -> B 링크가 있으면 B -> A 링크도 반드시 존재해야 함
  let autoSymmetrizedCount = 0;

  // 4-1. restoredSO 순회
  for (const [hostId, obj] of Object.entries(restoredSO)) {
    if (Array.isArray(obj.linkedScheduleIds)) {
      for (const targetId of obj.linkedScheduleIds) {
        if (restoredSO[targetId]) {
          restoredSO[targetId].linkedScheduleIds = restoredSO[targetId].linkedScheduleIds || [];
          if (!restoredSO[targetId].linkedScheduleIds.includes(hostId)) {
            restoredSO[targetId].linkedScheduleIds.push(hostId);
            autoSymmetrizedCount++;
          }
        } else if (customSchedules[targetId]) {
          customSchedules[targetId].linkedScheduleIds = customSchedules[targetId].linkedScheduleIds || [];
          if (!customSchedules[targetId].linkedScheduleIds.includes(hostId)) {
            customSchedules[targetId].linkedScheduleIds.push(hostId);
            autoSymmetrizedCount++;
          }
        } else if (validIdSet.has(targetId)) {
          // 마스터에 실존하는 일정이지만 아직 오버라이드가 없던 경우, 신규 오버라이드로 양방향 대칭 링크 등록!
          restoredSO[targetId] = { linkedScheduleIds: [hostId] };
          autoSymmetrizedCount++;
        }
      }
    }
  }

  // 4-2. customSchedules 순회 ([SEC-HYDR-04]: 타깃이 customSchedules일 때의 분기 완전성 보장)
  for (const [cId, cObj] of Object.entries(customSchedules)) {
    if (Array.isArray(cObj.linkedScheduleIds)) {
      for (const targetId of cObj.linkedScheduleIds) {
        if (restoredSO[targetId]) {
          restoredSO[targetId].linkedScheduleIds = restoredSO[targetId].linkedScheduleIds || [];
          if (!restoredSO[targetId].linkedScheduleIds.includes(cId)) {
            restoredSO[targetId].linkedScheduleIds.push(cId);
            autoSymmetrizedCount++;
          }
        } else if (customSchedules[targetId]) {
          // [SEC-HYDR-04]: 커스텀 간 대칭 링크를 customSchedules 내부에서 완결 (sourceOverrides 유출 차단)
          customSchedules[targetId].linkedScheduleIds = customSchedules[targetId].linkedScheduleIds || [];
          if (!customSchedules[targetId].linkedScheduleIds.includes(cId)) {
            customSchedules[targetId].linkedScheduleIds.push(cId);
            autoSymmetrizedCount++;
          }
        } else if (validIdSet.has(targetId)) {
          restoredSO[targetId] = { linkedScheduleIds: [cId] };
          autoSymmetrizedCount++;
        }
      }
    }
  }

  // 5. 링크 정렬 및 중복 제거 ([SEC-HYDR-06]: customSchedules도 정제 포함)
  for (const obj of Object.values(restoredSO)) {
    if (Array.isArray(obj.linkedScheduleIds)) {
      obj.linkedScheduleIds = [...new Set(obj.linkedScheduleIds)].sort();
      if (obj.linkedScheduleIds.length === 0) delete obj.linkedScheduleIds;
    }
  }
  for (const obj of Object.values(customSchedules)) {
    if (Array.isArray(obj.linkedScheduleIds)) {
      obj.linkedScheduleIds = [...new Set(obj.linkedScheduleIds)].sort();
      if (obj.linkedScheduleIds.length === 0) delete obj.linkedScheduleIds;
    }
  }

  // 6. 통계 집계
  const fieldStats = {};
  let deletedCount = 0;
  let linkedCount = 0;
  for (const v of Object.values(restoredSO)) {
    if (v.isDeleted) deletedCount++;
    if (v.linkedScheduleIds && v.linkedScheduleIds.length > 0) linkedCount++;
    for (const f of Object.keys(v)) {
      fieldStats[f] = (fieldStats[f] || 0) + 1;
    }
  }

  const restoredOverrides = {
    version: currentData.version || '2.0.0',
    updatedAt: new Date().toISOString(),
    pipelineConfig: currentData.pipelineConfig || { mode: 'auto', approvedScheduleIds: [] },
    filterRules: currentData.filterRules || { enabled: true, excludeShorts: true },
    customSchedules,
    sourceOverrides: restoredSO
  };

  const stats = {
    totalSourceOverrides: Object.keys(restoredSO).length,
    deletedCount,
    linkedCount,
    fieldStats,
    droppedKeysCount: droppedKeys.length,
    droppedKeys,
    autoSymmetrizedCount,
    restoredPropertyCount,
    currentPrecedenceCount
  };

  return { restoredOverrides, stats };
}

async function main() {
  console.log("==================================================");
  console.log("🔄 [Data Hub] 무손실 오버라이드 정밀 복원 엔진");
  console.log("==================================================");

  const baseArgIdx = process.argv.indexOf('--base');
  const baseFile = baseArgIdx !== -1 && process.argv[baseArgIdx + 1]
    ? path.resolve(process.argv[baseArgIdx + 1])
    : (fs.existsSync(GIST_BCBD_FILE) ? GIST_BCBD_FILE : REBUILD_FILE);

  console.log(`📂 복원 베이스 원본: ${baseFile}`);
  if (!fs.existsSync(baseFile)) {
    console.error(`❌ 복원 원본 파일이 없습니다: ${baseFile}`);
    process.exit(1);
  }
  if (!fs.existsSync(CURRENT_FILE)) {
    console.error(`❌ 현재 오버라이드 파일이 없습니다: ${CURRENT_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(MASTER_FILE)) {
    console.error(`❌ 마스터 파일이 없습니다: ${MASTER_FILE}`);
    process.exit(1);
  }

  const rebuildData = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
  const currentData = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8'));
  const masterData = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
  const officialStreams = fs.existsSync(SEEDS_STREAMS_FILE) ? JSON.parse(fs.readFileSync(SEEDS_STREAMS_FILE, 'utf8')) : [];

  const isDryRun = process.argv.includes('--dry-run');

  const { restoredOverrides, stats } = restoreLosslessOverrides({
    rebuildData,
    currentData,
    masterItems: masterData.items || [],
    officialStreams
  });

  console.log(`\n📊 [복원 결과 통계]`);
  console.log(`- 복원된 총 sourceOverrides: ${stats.totalSourceOverrides}건 (기존: ${Object.keys(currentData.sourceOverrides || {}).length}건)`);
  console.log(`- 삭제 일정(tombstone): ${stats.deletedCount}건`);
  console.log(`- 링크 일정: ${stats.linkedCount}건 (자동 양방향 대칭 보정: ${stats.autoSymmetrizedCount}건)`);
  console.log(`- 배제된 부적격/가상 키 (custom_ 통합 포함): ${stats.droppedKeysCount}건`);
  console.log(`- 필드별 분포:\n${JSON.stringify(stats.fieldStats, null, 2)}`);

  // 주요 대표 일정 복원 검증
  const samples = [
    { id: 'mnet_67f75b736bf606620a6202fe', desc: '키움히어로즈 시구/시타/공연' },
    { id: 'blip_814228', desc: '2025 유성온천문화축제' },
    { id: 'blip_1108061', desc: '2026 입크 페스티벌' },
    { id: 'blip_1089139', desc: '경기과학기술대학교 축제' },
    { id: 'blip_1119770', desc: '최근 삭제 일정 (Current 우선)' },
    { id: 'yt_O_QATiHzjK4', desc: '리모와 아이들 (공식 유튜브 스트림)' },
    { id: 'mnet_6a3e7e069f69517347795cee', desc: '2026 KGMA 코리아 그랜드 뮤직 어워즈 (공연/URL/메시지)' },
    { id: 'mnet_67c311d9cf0ed30ae6a78d79', desc: '2025 한남대학교 해오름제 (인스타/메시지)' },
    { id: 'mnet_682055b654d7b41a8bad8771', desc: '2025 동양미래대학교 노들축제 (타임테이블)' }
  ];

  console.log(`\n🔍 [주요 대표 일정 무손실 복원 샘플 검증]`);
  for (const s of samples) {
    const item = restoredOverrides.sourceOverrides[s.id];
    console.log(`  • [${s.desc}] (${s.id}):`, item ? `✅ 복원 완료 (${Object.keys(item).join(', ')})` : '❌ 누락');
  }

  // [SEC-HYDR-03] custom_ 키 3건 통합 상태 확인
  console.log(`\n🔍 [SEC-HYDR-03 커스텀 일정 통합 검증]`);
  const customCheck = ['custom_260922_3d900c', 'custom_260929_vxq2cn', 'custom_261009_c18747'];
  for (const cid of customCheck) {
    const inSO = Boolean(restoredOverrides.sourceOverrides[cid]);
    const inCS = Boolean(restoredOverrides.customSchedules[cid]);
    const links = restoredOverrides.customSchedules[cid]?.linkedScheduleIds || [];
    console.log(`  • ${cid}: sourceOverrides=${inSO} (false여야 함), customSchedules=${inCS} (true), links=[${links.join(', ')}]`);
  }

  if (isDryRun) {
    console.log(`\n💡 --dry-run 모드이므로 파일에 쓰지 않고 종료합니다.`);
    return;
  }

  // 원자적 안전 쓰기
  const jsonContent = JSON.stringify(restoredOverrides, null, 2);
  const tempFile = `${CURRENT_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, jsonContent, 'utf8');
  fs.renameSync(tempFile, CURRENT_FILE);
  console.log(`\n💾 로컬 파일 갱신 완료: ${CURRENT_FILE} (${(Buffer.byteLength(jsonContent) / 1024).toFixed(2)} KB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('복원 실행 오류:', err);
    process.exit(1);
  });
}
