import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fetchPage } from './crawler.js';
import { extract } from './extract.js';
import { store } from './store.js';

async function main() {
  const url = await resolveUrl();
  if (!url) {
    console.error('未提供有效的 URL，結束。');
    process.exit(1);
  }

  console.log(`\n🌐 正在爬取: ${url}`);
  const page = await fetchPage(url);

  console.log('🔎 解析內容中…');
  const { markdown, json } = extract(page);

  const dir = await store({ ...page, markdown, json });
  console.log(`\n✅ 完成！輸出位置: ${dir}/`);
  console.log(`   • page.md  (${json.metadata.wordCount} 字，給 AI 讀)`);
  console.log(`   • page.json (${json.links.length} 個連結)`);
  console.log(`   • page.html / screenshot.png`);
  if (json.dataSources.length) {
    console.log(`\n🔗 偵測到 ${json.dataSources.length} 個背後資料源（page.json.dataSources）：`);
    for (const d of json.dataSources.slice(0, 5)) {
      console.log(`   • ${d.url}  [${d.contentType.split(';')[0]}, ${d.size}B]`);
    }
  }
}

/** 優先用命令列參數，否則互動輸入 */
async function resolveUrl() {
  const arg = process.argv[2];
  if (arg) return normalize(arg);

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question('請輸入 URL: ');
    return normalize(answer.trim());
  } finally {
    rl.close();
  }
}

function normalize(u) {
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

main().catch((err) => {
  console.error('\n❌ 錯誤:', err.message);
  process.exit(1);
});
