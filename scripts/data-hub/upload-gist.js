// scripts/data-hub/upload-gist.js
// 생성된 data.json을 GitHub Gist에 덮어쓰기 업데이트하는 업로더

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../docs/api/v1/data.json');

const GIST_ID = process.env.GIST_ID || "44b49b328233ef6157499debe03f165c";
const GIST_TOKEN = process.env.GIST_TOKEN || process.env.GH_TOKEN;

async function updateGist() {
  console.log("==================================================");
  console.log("📤 [Gist Uploader] GitHub Gist 덮어쓰기 업데이트 시작");
  console.log(`🆔 Gist ID: ${GIST_ID}`);
  console.log("==================================================\n");

  if (!GIST_TOKEN) {
    console.error("❌ 실패: GIST_TOKEN 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ 실패: data.json 파일이 존재하지 않습니다 (${DATA_FILE})`);
    process.exit(1);
  }

  const content = fs.readFileSync(DATA_FILE, 'utf8');

  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        "Authorization": `Bearer ${GIST_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RESCENE-Data-Hub-Gist-Uploader"
      },
      body: JSON.stringify({
        description: `RESCENE Remine Helper Central Data Hub (Updated: ${new Date().toISOString()})`,
        files: {
          "data.json": {
            content: content
          }
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub Gist API 오류 HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    console.log("🎉 [Gist Uploader] Gist 덮어쓰기 업데이트 성공!");
    console.log(`🔗 Gist Raw URL: https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/data.json`);
    console.log(`⏰ 업데이트 시각: ${json.updated_at}`);
  } catch (error) {
    console.error("❌ [Gist Uploader] 업데이트 실패:", error.message);
    process.exit(1);
  }
}

updateGist();
