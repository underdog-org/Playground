# TODO

- [x] pnpm workspace + packages.json
- [x] Oslint (Linter + Formatter)
- [x] localStorage
- [x] Styles (tailwindcss + css)
- [~] ~~Storybook~~
- [x] zod
- [x] Fastify + API
- [x] Bruno API Docs

* 了解pnpm workspace的架構與原理以及優勢
* Oxlint 已經支援 Type-aware safety, 可以使用Oxlint + Oxfmt過渡
* 用 useState 的 lazy initializer（只在首次 render 執行一次，在任何 effect 之前）
* localStorage.getItem 回傳的是 string | null
* RN 跑在 JS 引擎裡，沒有瀏覽器的 window，
  - Android —— 一個 SQLite 資料庫（RKStorage），路徑在 /data/data/<你的package>/databases/。裡面就是一張 key/value 表。
  - iOS —— 檔案系統。在 app 沙盒的 Library/Application Support/ 底下有個 RCTAsyncLocalStorage_V1 目錄。小的值集中寫在一個 manifest JSON 裡，超過大小門檻的值會被拆成獨立檔案存。
  - App 解除安裝就消失。iOS 上 iCloud 備份可能會帶走它（除非明確排除）。
  - 完全沒有加密，就是純文字。所以 token、密碼、任何機敏資料不能放這裡
* 學習標準的Monorepo 結構 = apps + packages
* React-Native 和 React 如果要共用元件，必須使用 React-Native-web 但是會失去很多CSS, Media等功能
* Zod 作為型別的契約
* Fastify 需要搭配 Zod-Provider 中的 `setSerializerCompiler`, `setValidatorCompiler` 來讀取
* Mobile 並無法像是Web直接讀取Localhost
* barrel 的 import 要寫副檔名
* tsx 確實能吃 workspace 內的未編譯 TS。
* Bruno API
