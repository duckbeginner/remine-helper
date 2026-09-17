// scripts/check-chrome-store-version.mjs
// Chrome Web Store 공식 CRX 업데이트 서버를 통한 라이브 버전 Polling 검사기

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const CHROME_EXTENSION_ID = 'jnbkdhfgedcfjolimahhbjdglpliindf';

export async function fetchLiveChromeVersion(extensionId = CHROME_EXTENSION_ID) {
  const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx3&x=id%3D${extensionId}%26uc`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      const location = res.headers.location || '';
      // 예: .../JNBKDHFGEDCFJOLIMAHHBJDGLPLIINDF_1_0_3_0.crx
      const match = location.match(/_(\d+)_(\d+)_(\d+)_(\d+)\.crx/i);
      if (match) {
        const liveVersion = `${match[1]}.${match[2]}.${match[3]}`;
        resolve({
          version: liveVersion,
          fullBuild: `${match[1]}.${match[2]}.${match[3]}.${match[4]}`,
          location
        });
      } else {
        // 리다이렉트 위치에서 정규식을 찾지 못한 경우 (HTTP 200 등)
        resolve({
          version: 'unknown',
          location
        });
      }
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('CRX check timeout (10s)'));
    });
    req.end();
  });
}

export function isAlreadyReleased(targetVersion) {
  const docsIndexPath = path.join(ROOT_DIR, 'docs/index.html');
  if (!fs.existsSync(docsIndexPath)) return false;
  const html = fs.readFileSync(docsIndexPath, 'utf8');
  return html.includes(`v${targetVersion}`) && html.includes(`v${targetVersion} 업데이트 내역`);
}

export async function main() {
  const targetVersionArg = process.argv[2];
  const manifestPath = path.join(ROOT_DIR, 'remine-helper/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const targetVersion = targetVersionArg || manifest.version;

  console.log(`[CWS Polling] Checking Chrome Web Store live status for ${CHROME_EXTENSION_ID}...`);
  console.log(`[CWS Polling] Target Version to detect: v${targetVersion}`);

  if (isAlreadyReleased(targetVersion)) {
    console.log(`ℹ️ [CWS Polling] Version v${targetVersion} is already fully deployed to docs/index.html.`);
  }

  try {
    const liveInfo = await fetchLiveChromeVersion(CHROME_EXTENSION_ID);
    console.log(`[CWS Polling] Current Live Version on Web Store: v${liveInfo.version}`);

    if (liveInfo.version === targetVersion) {
      console.log(`🎉 [CWS Polling] Target Version v${targetVersion} is now LIVE on Chrome Web Store!`);
      process.exit(0);
    } else {
      console.log(`⏳ [CWS Polling] Still under review or pending (Current: v${liveInfo.version}, Target: v${targetVersion}).`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ [CWS Polling] Error checking store version:`, err.message);
    process.exit(2);
  }
}

if (process.argv[1] && process.argv[1].endsWith('check-chrome-store-version.mjs')) {
  main();
}
