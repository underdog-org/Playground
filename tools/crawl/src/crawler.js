import { chromium } from 'playwright';

/**
 * 開啟頁面、智慧等待內容穩定，回傳原始 HTML、所有 iframe 內容、
 * 偵測到的資料源（XHR/fetch）、以及截圖。
 *
 * 通用等待策略（不寫死任何選擇器）：
 *   1. domcontentloaded 先讓 DOM 就緒
 *   2. networkidle 盡量等 SPA 的非同步請求（容錯，逾時不致命）
 *   3. 輪詢「所有 frame 的文字量」是否穩定（對付動態渲染 + iframe）
 *
 * @param {string} url
 * @param {object} opts
 * @returns {Promise<{
 *   html:string, url:string, title:string, screenshot:Buffer,
 *   frames:Array<{url:string, html:string}>,
 *   dataSources:Array<{url:string, status:number, contentType:string, size:number, preview:string}>
 * }>}
 */
export async function fetchPage(url, opts = {}) {
  const { headless = true, timeout = 30000 } = opts;
  const browser = await chromium.launch({ headless });
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    });

    // Tier 1：嗅探所有 XHR/fetch 回應，找出「像資料源」的請求
    const sniffed = [];
    page.on('response', (res) => {
      const type = res.request().resourceType();
      if (type !== 'xhr' && type !== 'fetch') return;
      sniffed.push(captureResponse(res));
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
    // 子 frame 常有自己的非同步載入（SPA-in-iframe），各別等它們閒置
    await Promise.all(
      page.frames().map((f) => f.waitForLoadState('networkidle', { timeout }).catch(() => {}))
    );
    await waitForStableContent(page);

    const finalUrl = page.url();
    const title = await page.title();
    const html = await page.content();

    // Tier 2：遍歷所有 iframe，收集子文件內容
    const frames = await collectFrames(page, finalUrl);

    const screenshot = await page.screenshot({ fullPage: true });
    const dataSources = (await Promise.all(sniffed))
      .filter((d) => d && isDataLike(d))
      .filter((d, i, arr) => arr.findIndex((x) => x.url === d.url) === i);

    return { html, url: finalUrl, title, screenshot, frames, dataSources };
  } finally {
    await browser.close();
  }
}

/** 在瀏覽器關閉前抓下回應的 metadata 與內容預覽 */
async function captureResponse(res) {
  try {
    const headers = res.headers();
    const contentType = headers['content-type'] ?? '';
    const path = new URL(res.url()).pathname.toLowerCase();
    // 文字型 content-type，或副檔名看起來是資料檔（有些站把 .md 標成 octet-stream）
    const textLike = /json|text|markdown|xml|javascript/i.test(contentType);
    const dataExt = /\.(md|markdown|json|txt|xml|csv|yaml|yml)$/.test(path);
    let body = '';
    if (textLike || dataExt) {
      body = await res.text().catch(() => '');
    }
    return {
      url: res.url(),
      status: res.status(),
      contentType,
      size: body.length,
      preview: body.slice(0, 2000),
    };
  } catch {
    return null;
  }
}

/**
 * 判斷一個回應是否「像內容資料源」：
 *   - JSON / markdown / 純文字
 *   - 有實際內容量（濾掉空回應與追蹤 beacon）
 */
function isDataLike(d) {
  if (d.status >= 400) return false;
  if (d.size < 40) return false;
  // 有讀到內容（body 非空）就算資料源——涵蓋被標成 octet-stream 的 .md/.json
  return d.size > 0;
}

/** 收集主文件與所有子 frame 的 HTML（濾掉空白/about:blank frame） */
async function collectFrames(page, mainUrl) {
  const out = [];
  for (const frame of page.frames()) {
    const fUrl = frame.url();
    if (!fUrl || fUrl === 'about:blank' || fUrl === mainUrl) continue;
    const html = await frame.content().catch(() => '');
    const textLen = await frame
      .evaluate(() => document.body?.innerText?.trim().length ?? 0)
      .catch(() => 0);
    if (html && textLen > 0) out.push({ url: fUrl, html });
  }
  return out;
}

/**
 * 輪詢「主文件 + 所有 frame」的文字總長度，連續數次不再增長即穩定。
 * 比只看 body 更可靠——SPA 內容常在 iframe 或延遲渲染。
 */
async function waitForStableContent(page, { maxWaits = 20, interval = 400 } = {}) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < maxWaits; i++) {
    let total = 0;
    for (const frame of page.frames()) {
      total += await frame
        .evaluate(() => document.body?.innerText?.length ?? 0)
        .catch(() => 0);
    }
    if (total > 0 && total === last) {
      if (++stable >= 3) return; // 連續 3 次不變才算穩定
    } else {
      stable = 0;
    }
    last = total;
    await page.waitForTimeout(interval);
  }
}
