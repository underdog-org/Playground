import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 將爬取結果寫入 output/<domain>-<timestamp>/
 *   page.md          -> AI 主要讀這個
 *   page.json        -> 結構化資料
 *   page.html        -> 原始 HTML（除錯用）
 *   screenshot.png   -> 全頁截圖
 */
export async function store({ url, html, screenshot, markdown, json }, outRoot = 'output') {
  const dir = join(outRoot, slug(url));
  await mkdir(dir, { recursive: true });

  await Promise.all([
    writeFile(join(dir, 'page.md'), markdown),
    writeFile(join(dir, 'page.json'), JSON.stringify(json, null, 2)),
    writeFile(join(dir, 'page.html'), html),
    screenshot ? writeFile(join(dir, 'screenshot.png'), screenshot) : Promise.resolve(),
  ]);

  return dir;
}

function slug(url) {
  let host = 'page';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${host}-${ts}`;
}
