// tests/docs/seo.test.js
// 사이트맵 및 robots.txt 규격 검증 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, '../../docs');

export async function run() {
  const runner = new TestRunner('Docs - SEO & Crawler Specs');
  runner.run();

  runner.test('sitemap.xml: 유효한 XML 구조 및 URL 엔트리 검증', () => {
    const sitemapPath = path.join(DOCS_DIR, 'sitemap.xml');
    assert(fs.existsSync(sitemapPath), 'docs/sitemap.xml이 존재해야 합니다.');
    const content = fs.readFileSync(sitemapPath, 'utf8');

    assert(content.includes('<?xml version="1.0"'), 'XML 헤더가 선언되어야 합니다.');
    assert(content.includes('<urlset'), '<urlset> 태그가 존재해야 합니다.');
    assert(content.includes('<loc>'), '최소 1개 이상의 <loc> URL이 명시되어야 합니다.');
  });

  runner.test('robots.txt: 검색엔진 크롤러 지침 검증', () => {
    const robotsPath = path.join(DOCS_DIR, 'robots.txt');
    assert(fs.existsSync(robotsPath), 'docs/robots.txt가 존재해야 합니다.');
    const content = fs.readFileSync(robotsPath, 'utf8');

    assert(content.includes('User-agent:'), 'User-agent 디렉티브가 선언되어야 합니다.');
    assert(content.includes('Sitemap:'), 'Sitemap 경로가 선언되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('seo.test.js')) {
  run();
}
