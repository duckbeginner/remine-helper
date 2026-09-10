import fs from 'fs';
import { execSync } from 'child_process';

const GIST_ID = "44b49b328233ef6157499debe03f165c";

async function run() {
  console.log("▶ 1~4단계 스케줄 오버라이드 고도화 시작...");

  // 1. 최신 오버라이드 파일 로드 (로컬 캐시 우선)
  let overrides;
  if (fs.existsSync(".cache/schedule-overrides.json")) {
    overrides = JSON.parse(fs.readFileSync(".cache/schedule-overrides.json", "utf8"));
  } else {
    const res = await fetch(`https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedule-overrides.json?t=${Date.now()}`);
    overrides = await res.json();
  }

  if (!overrides.sourceOverrides) overrides.sourceOverrides = {};
  if (!overrides.customSchedules) overrides.customSchedules = {};

  // =========================================================================
  // 1. 2025-02-17 아이돌 라디오 시즌4 중복 연결 & 대표 풀버전 영상 링크
  // =========================================================================
  const idolMnet = "682e044b6517824a134411c3";
  const idolBlip = "blip_750789";
  const idolRadioUrl = "https://www.youtube.com/watch?v=FTFRUqq81CU"; // [FULL] EP#98 리센느의 성장일지

  overrides.sourceOverrides[idolMnet] = {
    ...(overrides.sourceOverrides[idolMnet] || {}),
    id: idolMnet,
    url: idolRadioUrl,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[idolMnet]?.linkedScheduleIds || []), idolBlip]))
  };

  overrides.sourceOverrides[idolBlip] = {
    ...(overrides.sourceOverrides[idolBlip] || {}),
    id: idolBlip,
    url: idolRadioUrl,
    linkedScheduleIds: Array.from(new Set([...(overrides.sourceOverrides[idolBlip]?.linkedScheduleIds || []), idolMnet]))
  };
  console.log("✓ 1. 2025-02-17 아이돌 라디오 시즌4 상호 연결 및 대표 영상 매칭 완료");

  // =========================================================================
  // 2. 대학 축제 / 시구 / 페스티벌 '기타' 일정 20건 카테고리(typeText) 재분류
  // =========================================================================
  const concertIds = [
    // 대학 축제 (공연)
    "custom_240926_c75121", // 계명대
    "custom_240927_aa761a", // 서일대
    "custom_241001_509faa", // 숭실대
    "custom_241010_8a7719", // 고려대
    "custom_241029_516fcc", // 조선이공대
    "custom_241031_df8a09", // 혜전대
    "custom_241107_99ccc0", // 목포해양대
    "custom_241113_a3f88b", // 목원대
    "blip_815811",           // 군산대
    "blip_823287",           // 부산대
    "custom_251023_37f610", // 동서울대
    "blip_1091442",          // 순천대
    // 페스티벌 / 어워즈 (공연)
    "custom_240511_c042dc", // 청소년 자원봉사 페스티벌
    "custom_240531_3051ac", // 어린이 청소년 인권 페스티벌
    "custom_241109_cf7ea4", // 구룡포 해양미식축제
    "blip_1107273"          // 2026 SPOTV K-POP AWARDS
  ];

  const eventIds = [
    // 시구 / 시투 / 시축 스포츠 행사 (행사)
    "custom_240803_837833", // 삼성 라이온즈 시구/공연
    "custom_241124_fac0ad", // 광주 FC 시축/하프타임 공연
    "custom_241203_4aa06a", // 대구 한국가스공사 페가수스 시투/공연
    "custom_260721_88df20"  // kt wiz 시구
  ];

  concertIds.forEach(id => {
    if (overrides.customSchedules[id]) {
      overrides.customSchedules[id].typeText = "공연";
    } else {
      overrides.sourceOverrides[id] = {
        ...(overrides.sourceOverrides[id] || {}),
        id,
        typeText: "공연"
      };
    }
  });

  eventIds.forEach(id => {
    if (overrides.customSchedules[id]) {
      overrides.customSchedules[id].typeText = "행사";
    } else {
      overrides.sourceOverrides[id] = {
        ...(overrides.sourceOverrides[id] || {}),
        id,
        typeText: "행사"
      };
    }
  });
  console.log(`✓ 2. 축제/시구/페스티벌 20건 재분류 완료 (공연 ${concertIds.length}건, 행사 ${eventIds.length}건)`);

  // =========================================================================
  // 3. 과거 주요 라디오 본방송 대표 유튜브 다시보기(VOD) 링크 1개씩 매칭
  // =========================================================================
  const radioVods = [
    { id: "blip_731658", title: "SBS 파워FM <배성재의 텐>", url: "https://www.youtube.com/watch?v=QI4o-1Z9p_s", channel: "코빨간배춘기 [배성재의 텐]" },
    { id: "blip_748938", title: "SBS 파워FM <배성재의 텐>", url: "https://www.youtube.com/watch?v=smE4VwcGDTE", channel: "코빨간배춘기 [배성재의 텐]" },
    { id: "blip_979140", title: "SBS 파워FM <배성재의 텐>", url: "https://www.youtube.com/watch?v=yrXb2R3ii1U", channel: "코빨간배춘기 [배성재의 텐]" },
    { id: "blip_1064881", title: "SBS 파워FM <배성재의 텐>", url: "https://www.youtube.com/watch?v=rrbTNmIVKmc", channel: "코빨간배춘기 [배성재의 텐]" },
    { id: "blip_1105822", title: "SBS 파워FM <배성재의 텐>", url: "https://www.youtube.com/watch?v=4KDX8QhknBY", channel: "코빨간배춘기 [배성재의 텐]" },
    { id: "682e03dbbe9ed07eb239b32f", title: "SBS 파워FM <박소현의 러브게임>", url: "https://www.youtube.com/watch?v=x92ofaGYFhU", channel: "SBS Radio 에라오" }
  ];

  radioVods.forEach(r => {
    overrides.sourceOverrides[r.id] = {
      ...(overrides.sourceOverrides[r.id] || {}),
      id: r.id,
      url: r.url,
      channel: r.channel
    };
  });
  console.log(`✓ 3. 주요 라디오 과거 일정 ${radioVods.length}건 대표 VOD 링크 매칭 완료`);

  // =========================================================================
  // 4. 블립 앱 전용 지난 스포라이브 4건 숨김 처리
  // =========================================================================
  const blipLiveIds = ["blip_736214", "blip_740340", "blip_742970", "blip_747406"];
  blipLiveIds.forEach(id => {
    overrides.sourceOverrides[id] = {
      ...(overrides.sourceOverrides[id] || {}),
      id,
      isDeleted: true
    };
  });
  console.log(`✓ 4. 블립 전용 지난 스포라이브 ${blipLiveIds.length}건 숨김 처리 완료`);

  overrides.updatedAt = new Date().toISOString();
  fs.writeFileSync(".cache/schedule-overrides.json", JSON.stringify(overrides, null, 2));

  // Gist 동기화
  try {
    const token = execSync("gh auth token").toString().trim();
    const patchRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RESCENE-Data-Hub-Gist-Uploader"
      },
      body: JSON.stringify({
        description: `RESCENE Remine Helper 2-Tier Data Hub (Updated: ${new Date().toISOString()})`,
        files: {
          "schedule-overrides.json": { content: JSON.stringify(overrides, null, 2) }
        }
      })
    });
    if (patchRes.ok) {
      console.log("✓ GitHub Gist에 schedule-overrides.json 동기화 완료!");
    } else {
      console.warn("⚠️ Gist 동기화 실패 (HTTP " + patchRes.status + ")");
    }
  } catch (err) {
    console.warn("⚠️ Gist 동기화 중 에러 발생:", err.message);
  }
}

run();
