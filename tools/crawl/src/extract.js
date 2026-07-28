import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
turndown.use(gfm); // 支援表格、刪除線、任務清單

/**
 * 把原始 HTML 解析成 AI 可讀的結構化資料。
 *   - 用 Readability 萃取主內容區（去掉 nav / 側欄 / 頁尾 / 廣告）
 *   - 主內容轉成 Markdown（保留標題層級、清單、表格、程式碼）
 *   - 另外抽取 metadata 與全頁連結
 *
 * @param {{html:string, url:string, title:string, frames?:Array, dataSources?:Array}} page
 * @returns {{markdown:string, json:object}}
 */
export function extract({ html, url, title, frames = [], dataSources = [] }) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const metadata = extractMetadata(doc, { url, title });
  const links = extractLinks(doc);

  // Readability 會修改 DOM，先複製一份給它
  const article = new Readability(doc.cloneNode(true)).parse();

  let contentHtml = article?.content ?? doc.body?.innerHTML ?? '';

  // Tier 2：主文件內容太少時，改用/併入 iframe 的內容（SPA-in-iframe）
  const mainTextLen = (article?.textContent ?? doc.body?.textContent ?? '').trim().length;
  const frameArticles = extractFrames(frames);
  if (frameArticles.length) {
    const frameHtml = frameArticles.map((f) => f.content).join('\n<hr/>\n');
    // 主文件幾乎沒內容 → 直接用 frame；否則附加在後面
    contentHtml = mainTextLen < 200 ? frameHtml : `${contentHtml}\n<hr/>\n${frameHtml}`;
  }

  const markdownBody = turndown.turndown(contentHtml).trim();

  const heading = article?.title || metadata.title || title || url;
  const markdown = buildMarkdown({ heading, metadata, markdownBody });

  const json = {
    url,
    fetchedAt: new Date().toISOString(),
    metadata: {
      ...metadata,
      byline: article?.byline ?? null,
      excerpt: article?.excerpt ?? metadata.description ?? null,
      // 以最終產出的 Markdown 計字，才能反映合併 iframe 後的內容量
      wordCount: markdownBody.trim().split(/\s+/).filter(Boolean).length,
    },
    content: {
      title: heading,
      markdown: markdownBody,
      text: article?.textContent?.trim() ?? '',
    },
    links,
    // Tier 1：嗅探到的資料源（背後的 JSON/markdown API），常是最乾淨的來源
    dataSources: dataSources.map((d) => ({
      url: d.url,
      contentType: d.contentType,
      size: d.size,
      preview: d.preview,
    })),
  };

  return { markdown, json };
}

/** 對每個 iframe 跑 Readability，回傳有實質內容的主文區 */
function extractFrames(frames) {
  const out = [];
  for (const { html, url } of frames) {
    try {
      const doc = new JSDOM(html, { url }).window.document;
      const article = new Readability(doc.cloneNode(true)).parse();
      const content = article?.content ?? doc.body?.innerHTML ?? '';
      if ((article?.textContent ?? '').trim().length > 50) out.push({ url, content });
    } catch {}
  }
  return out;
}

function extractMetadata(doc, { url, title }) {
  const meta = (name) =>
    doc.querySelector(`meta[property="${name}"]`)?.content ||
    doc.querySelector(`meta[name="${name}"]`)?.content ||
    null;

  return {
    url,
    title: meta('og:title') || title || doc.title || null,
    description: meta('description') || meta('og:description') || null,
    siteName: meta('og:site_name') || null,
    lang: doc.documentElement?.getAttribute('lang') || null,
    image: meta('og:image') || null,
  };
}

function extractLinks(doc) {
  const seen = new Set();
  const links = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.href;
    const text = a.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    if (!href || !/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    links.push({ text, href });
  }
  return links;
}

function buildMarkdown({ heading, metadata, markdownBody }) {
  const front = [
    `# ${heading}`,
    '',
    `> **來源**: ${metadata.url}`,
    metadata.description ? `> **描述**: ${metadata.description}` : null,
    metadata.siteName ? `> **站點**: ${metadata.siteName}` : null,
    '',
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');

  return `${front}${markdownBody}\n`;
}
