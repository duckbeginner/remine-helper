// tests/assets/assets.test.js
// 정적 에셋, 아이콘 및 멤버 프로필 이미지 실존성 전수 검증

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');

export async function run() {
  const runner = new TestRunner('Assets - Static Icons & Media Integrity');
  runner.run();

  const requiredIcons = [
    'logo16.png',
    'logo32.png',
    'logo48.png',
    'logo128.png',
    'rescene-logo.png',
    'rescene_official_profile.jpg',
    'hellowoni_profile.jpg',
    'member_liv.jpeg',
    'member_may.jpeg',
    'member_minami.jpeg',
    'member_woni.jpeg',
    'member_zena.jpeg'
  ];

  const requiredSvgs = [
    'svg/instagram-2016-logo-svgrepo-com.svg',
    'svg/Youtube-Symbol.svg',
    'svg/Twitter-X.svg',
    'svg/Facebook.svg',
    'svg/MnetPlus-Symbol.svg',
    'svg/tiktok.svg'
  ];

  ['remine-helper'].forEach(platform => {
    runner.test(`[${platform}] 모든 확장 프로그램 아이콘 및 멤버 프로필 이미지 파일 실존성`, () => {
      const iconsDir = path.join(BASE_DIR, platform, 'icons');
      requiredIcons.forEach(iconName => {
        const fullPath = path.join(iconsDir, iconName);
        assert(fs.existsSync(fullPath), `${platform}/icons/${iconName} 파일이 존재하지 않습니다.`);
        const stat = fs.statSync(fullPath);
        assert(stat.size > 0, `${platform}/icons/${iconName} 파일 크기가 0 바이트입니다.`);
      });
    });

    runner.test(`[${platform}] 모든 공식 채널 SVG 벡터 아이콘 파일 실존성`, () => {
      const iconsDir = path.join(BASE_DIR, platform, 'icons');
      requiredSvgs.forEach(svgName => {
        const fullPath = path.join(iconsDir, svgName);
        assert(fs.existsSync(fullPath), `${platform}/icons/${svgName} 파일이 존재하지 않습니다.`);
        const stat = fs.statSync(fullPath);
        assert(stat.size > 0, `${platform}/icons/${svgName} 파일 크기가 0 바이트입니다.`);
      });
    });
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('assets.test.js')) {
  run();
}
