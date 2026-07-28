# web-crawler

通用網頁爬蟲。給它一個 URL，輸出 **AI 可讀的 Markdown + 結構化 JSON**。

用 Playwright 執行頁面 JS，再用 Readability 去除樣板（nav / 側欄 / 頁尾 / 廣告），
轉成乾淨 Markdown。針對 SPA / PWA 這類動態渲染頁面，額外處理 **iframe 內容**
與 **背後資料源（XHR/fetch）嗅探**。

## 環境需求

透過 [mise](https://mise.jdx.dev/) 管理，不污染全局：

- Node 24
- pnpm 10
- Playwright（Chromium 裝在專案內的 `.playwright/`）

## 安裝

```bash
mise trust        # 首次信任 mise.toml
mise run setup    # = pnpm install + playwright install chromium
```

`mise.toml` 已把 `PLAYWRIGHT_BROWSERS_PATH` 指向專案內 `.playwright/`，
所以瀏覽器 binary 不會裝到全局。

## 使用

```bash
# 互動模式：跳出「請輸入 URL:」
mise run dev

# 直接帶參數（會自動補上 https://）
mise run dev https://example.com
```

> 直接用 `node src/cli.js` 也可以，但要在 mise 環境內執行，
> `PLAYWRIGHT_BROWSERS_PATH` 才會生效。

## 輸出

結果寫入 `output/<domain>-<timestamp>/`：

| 檔案 | 用途 |
|------|------|
| `page.md` | **給 AI 讀的主檔** — 去雜訊後的 Markdown（保留標題 / 清單 / 表格 / 程式碼） |
| `page.json` | 結構化資料：metadata、連結清單、偵測到的資料源 |
| `page.html` | 原始 HTML（除錯用） |
| `screenshot.png` | 全頁截圖 |

`page.json` 結構：

```jsonc
{
  "url": "...",
  "fetchedAt": "ISO 時間",
  "metadata": { "title", "description", "lang", "wordCount", ... },
  "content": { "title", "markdown", "text" },
  "links": [{ "text", "href" }],
  "dataSources": [{ "url", "contentType", "size", "preview" }]
}
```

## 動態頁面怎麼處理

面對 JS / PWA 動態渲染，採分層策略（由高到低 CP 值）：

1. **找背後資料源**（`dataSources`）：爬取時嗅探所有 XHR/fetch，
   把像 JSON / Markdown 的回應記錄下來。很多站的內容其實來自某個
   靜態 `.md` 或 `/api/...`，直接抓那個往往比爬整頁更乾淨。
2. **iframe 遍歷**：內容常渲染在子 frame，會合併所有 frame 的內容。
3. **智慧等待**：不寫死選擇器，輪詢「所有 frame 的文字量」直到穩定，
   並各別等子 frame 的網路閒置，避免動態內容還沒載入就收手。

> 範例：TickTick API 文件是 docsify SPA，主文件只有 nav；
> 爬蟲會自動抓進 iframe 內的完整文件，並在 `dataSources` 指出
> 背後的 `docs/openapi.md`。

## 專案結構

```
src/
  cli.js       # 入口：讀 URL（參數 or 互動輸入）、正規化
  crawler.js   # Playwright 開頁 + 智慧等待 + iframe/資料源蒐集
  extract.js   # Readability 去雜訊 → Turndown 轉 Markdown + 抽 metadata/連結
  store.js     # 寫入 output/<domain>-<timestamp>/
mise.toml      # node/pnpm 版本 + 任務（dev / setup）
```

## 技術棧

Playwright · @mozilla/readability · jsdom · turndown (+gfm)
