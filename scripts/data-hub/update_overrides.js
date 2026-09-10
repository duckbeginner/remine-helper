import fs from 'fs';

const GIST_ID = "44b49b328233ef6157499debe03f165c";

async function run() {
  const res = await fetch(`https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedule-overrides.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("Gist fetch failed");
  const overrides = await res.json();

  // 1. filterRules.excludeKeywords 정제 (단 한 글자짜리 오타 "크", "요", "심" 제거하고 정상 키워드로 교체)
  if (overrides.filterRules && Array.isArray(overrides.filterRules.excludeKeywords)) {
    overrides.filterRules.excludeKeywords = overrides.filterRules.excludeKeywords.filter(k => !["크", "요", "심"].includes(k.trim()));
    if (!overrides.filterRules.excludeKeywords.includes("빅크")) overrides.filterRules.excludeKeywords.push("빅크");
    if (!overrides.filterRules.excludeKeywords.includes("BIGC")) overrides.filterRules.excludeKeywords.push("BIGC");
  }

  // 2. 영상 예정 일정 11건 보완
  const videoUpdates = [
    { id: "blip_1092957", title: "[LIVE] 침착맨 초대석", url: "https://www.youtube.com/watch?v=DoefZF5J0vY", channel: "침착맨", typeText: "영상" },
    { id: "blip_1104861", title: "<집대성> 리센느 편", url: "https://www.youtube.com/watch?v=PB_LhQF56S4", channel: "집대성", typeText: "영상" },
    { id: "blip_1103773", title: "살롱드립2 EP.150 (원이 X 미나미)", url: "https://www.youtube.com/watch?v=Gf86nsW1dfh", channel: "TEO 테오", typeText: "영상" },
    { id: "blip_1088416", title: "[LIVE] 문명특급 (거제 야호 편)", url: "https://www.youtube.com/watch?v=B0iayXbeLSE", channel: "MMTG 문명특급", typeText: "영상" },
    { id: "blip_1075998", title: "돌들의 침묵 (리센느 'Runaway')", url: "https://www.youtube.com/watch?v=GGEawrTVV13", channel: "뮤플리 MUPLY", typeText: "영상" },
    { id: "blip_863585",  title: "돌들의 침묵 (리센느 'Deja Vu')", url: "https://www.youtube.com/watch?v=FLDdaJJmwS3", channel: "뮤플리 MUPLY", typeText: "영상" },
    { id: "blip_1103453", title: "먼키의 발자국 (만찬가 Live Clip)", url: "https://www.youtube.com/watch?v=IzQILNvzX8w", channel: "스튜디오 드리밍", typeText: "영상" },
    { id: "blip_1099091", title: "동네친구 강나미 <만찬가> MV", url: "https://www.youtube.com/watch?v=x46yKKXI7Ig", channel: "동네친구 강나미", typeText: "영상" },
    { id: "blip_1106020", title: "SBSKPOP 매점가요 시즌2 EP.14", url: "https://www.youtube.com/watch?v=F3a7X_u1GVs", channel: "SBSKPOP X INKIGAYO", typeText: "영상" },
    { id: "blip_1097894", title: "유병재 ON AIR (원이 X 미나미)", url: "https://www.youtube.com/watch?v=GRMj2unNos0", channel: "유병재", typeText: "영상" },
    { id: "blip_748177",  title: "it's Live (Glow Up 밴드 라이브)", url: "https://www.youtube.com/watch?v=HwIBJ8vfIOP", channel: "it's Live", typeText: "영상" }
  ];

  if (!overrides.sourceOverrides) overrides.sourceOverrides = {};

  videoUpdates.forEach(v => {
    overrides.sourceOverrides[v.id] = {
      ...(overrides.sourceOverrides[v.id] || {}),
      id: v.id,
      title: v.title,
      url: v.url,
      channel: v.channel,
      typeText: v.typeText
    };
  });

  // 3. 중복 수집 일정 상호 연결 (linkedScheduleIds)
  // 1) 키스 더 라디오
  const kissMnet = "6a48c48ac78482055163f5a9";
  const kissBlip = "blip_1102873";
  overrides.sourceOverrides[kissMnet] = {
    ...(overrides.sourceOverrides[kissMnet] || {}),
    id: kissMnet,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[kissMnet]?.linkedScheduleIds || []), kissBlip]))
  };
  overrides.sourceOverrides[kissBlip] = {
    ...(overrides.sourceOverrides[kissBlip] || {}),
    id: kissBlip,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[kissBlip]?.linkedScheduleIds || []), kissMnet]))
  };

  // 2) EBS 경청
  const listenMnet = "67f357c0c101851ccc8f4882";
  const listenBlip = "blip_785446";
  overrides.sourceOverrides[listenMnet] = {
    ...(overrides.sourceOverrides[listenMnet] || {}),
    id: listenMnet,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[listenMnet]?.linkedScheduleIds || []), listenBlip]))
  };
  overrides.sourceOverrides[listenBlip] = {
    ...(overrides.sourceOverrides[listenBlip] || {}),
    id: listenBlip,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[listenBlip]?.linkedScheduleIds || []), listenMnet]))
  };

  // 3) 복면가왕 클립 3건 상호 연결
  const maskIds = ["blip_885482", "blip_885483", "blip_885625"];
  maskIds.forEach(id => {
    overrides.sourceOverrides[id] = {
      ...(overrides.sourceOverrides[id] || {}),
      id,
      linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[id]?.linkedScheduleIds || []), ...maskIds.filter(x => x !== id)]))
    };
  });

  // 4. 트위터 더미 일정(61건) 및 블립 불필요 공지 삭제(isDeleted: true)
  const rawData = JSON.parse(fs.readFileSync("docs/api/v1/schedules.json", "utf8"));
  let deletedCount = 0;

  // 4-1. 트위터 복사 일정 중 실체 없는 더미
  rawData.items.forEach(item => {
    const msg = item.message || "";
    const isTwitterOfficial = msg.includes("아티스트 공식 채널에 올라온 콘텐츠");
    if (isTwitterOfficial) {
      // 보존할 대상(YoYo 가사영상, 시구비하인드) 외에는 삭제
      if (item.id === "blip_811161" || item.id === "blip_813007") {
        return;
      }
      // 복면가왕은 연결했으므로 보존
      if (maskIds.includes(item.id)) return;

      overrides.sourceOverrides[item.id] = {
        ...(overrides.sourceOverrides[item.id] || {}),
        id: item.id,
        isDeleted: true
      };
      deletedCount++;
    }
  });

  // 4-2. 팬사인회 단순 응모 마감 공지 등 불필요 공지 (Notice)
  const applyNoticeKeywords = ["팬사인회 응모 (Notice)", "영상통화 팬사인회 응모", "응모 안내 (Notice)"];
  rawData.items.forEach(item => {
    if (applyNoticeKeywords.some(k => item.title.includes(k))) {
      overrides.sourceOverrides[item.id] = {
        ...(overrides.sourceOverrides[item.id] || {}),
        id: item.id,
        isDeleted: true
      };
      deletedCount++;
    }
  });

  overrides.updatedAt = new Date().toISOString();
  if (!fs.existsSync(".cache")) fs.mkdirSync(".cache", { recursive: true });
  fs.writeFileSync(".cache/schedule-overrides.json", JSON.stringify(overrides, null, 2));
  console.log(`✓ 로컬 오버라이드 갱신 완료: 영상 보완 ${videoUpdates.length}건, 중복 연결 3그룹, 더미 삭제 ${deletedCount}건`);
}

run();
