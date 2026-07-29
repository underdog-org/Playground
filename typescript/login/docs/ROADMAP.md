# ROADMAP

實作順序與各階段的驗收標準。

設計全景與決策理由見 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 原則

**設計一次畫完，實作切成獨立可驗收的階段。**

每個階段都要能單獨跑起來、單獨驗收。不追求功能數量——本專案的成功標準是「**能講清楚每一個決策**」，所以前 4 個階段做透，勝過 8 項全做但每項都淺。

---

## 給 Agent：如何維護本文件的進度

本文件同時是**規格**與**進度看板**。checkbox 是唯一的進度來源，不要另外開一份。

規則：

1. **勾選的時機是驗收通過之後，不是程式寫完之後。** 每個 checkbox 後面若有 `→ 驗證：<指令>`，就是實際跑過那個指令、看到它綠了才勾。沒跑過不准勾。
2. **一次只推進一個子階段**（0.1 → 0.2 → …）。上一個沒全綠就不要動下一個。
3. **範圍變了就改文字，不要偷偷跳過。** 若某項做不到或決定不做，把該行改成 `- [~]` 並在同一行後面加 `——（不做的理由）`，不要直接刪掉。刪掉等於湮滅決策紀錄，違反本專案的目的。
4. **臨時長出來的工作要補進清單**，補在對應子階段底下，用同樣的格式。
5. **決策一旦拍板就寫回文件**：影響「為什麼這樣設計」的寫進 ARCHITECTURE，影響「怎麼做、什麼時候做」的寫進本文件。R1 的結論固定寫回 ARCHITECTURE §8。

圖例：`- [ ]` 未開始／進行中｜`- [x]` 已驗收｜`- [~]` 刻意不做（後面必須寫理由）

---

## 目前狀態

**進度：Stage 0.4 已完成，下一步 0.5。**

| 階段                     | 狀態      |
| ------------------------ | --------- |
| 0.1 Scaffold 重構        | ✅ 已驗收 |
| 0.2 Docker Postgres      | ✅ 已驗收 |
| 0.3 `@ims/db`            | ✅ 已驗收 |
| 0.4 Better Auth 最小可用 | ✅ 已驗收 |
| 0.5 R1 Spike             | ⬜ 未開始 |
| Stage 1–6+               | ⬜ 未開始 |

Scaffold 原由 counter 專案沿用而來，經 0.1–0.3 之後的現況：

- pnpm workspace + catalog（單一版本來源），scope 為 `@ims/*`
- `apps/{web,mobile,server}` — Vite React / Expo / Fastify，counter UI 已清為最小外殼
- `packages/{db,policy,contract,design}` — `db` 有 drizzle 連線但 schema 仍空；`policy` / `contract` 是骨架；`design` 沿用既有 token
- `docker-compose.yml` — Postgres 17 + Mailpit，變數全走根目錄 `.env`
- Fastify + `fastify-type-provider-zod` + Swagger + Scalar 可運作，目前只有 `/health`（含 DB 檢查）
- oxlint / oxfmt / mise / vitest / drizzle-kit

**尚缺**：Better Auth 與任何一張資料表——也就是 0.4 之後的內容。

---

## 階段總覽

| 階段                   | 內容                                                                  | 完成的標誌                                      |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| **0. 骨架 + 風險驗證** | Docker Postgres / Drizzle / Better Auth email+password / **R1 spike** | 能註冊登入，且 R1 有明確結論                    |
| **1. OIDC Provider**   | `oidcProvider` plugin、一個 trusted client、authorization code flow   | web 透過 OIDC 登入並取得 id_token               |
| **2. Tenancy**         | `organization` plugin、`member` additionalFields、邀請流程、切換 org  | token 帶 `org_id`，切 org 會重發                |
| **3. RBAC**            | product / permission / role / role_permission / member_role           | token 帶 `permissions[]`，API 能擋              |
| **4. Entitlement**     | plan / plan_permission / subscription / seat + 交集運算               | 「有 role 但沒 seat」被擋，且三種拒絕語意可區分 |
| **5. 可觀測性**        | audit_log、login_attempt、rate limit / lockout                        | 能查「誰在何時對什麼做了什麼」                  |
| **6+. 認證方式擴充**   | Google OAuth → Passkey / 2FA → 真 Email adapter →（Apple，可選）      | 同一 identity 多種入口                          |

### 兩個排序上的刻意選擇

**Stage 0 先做 spike，不先做 schema。**
整個設計掛在「簽發 token 時能否知道當前 tenant」這個接縫上（見 ARCHITECTURE §8）。如果不行，Stage 2–4 全部要改形狀。花半小時驗證，比畫完六張表才發現要重來划算得多。

**OAuth / Passkey 排到最後，而不是最前。**
直覺會想先接 Google 登入（有成就感），但那些是「同一 identity 的不同入口」，不動資料模型地基。先把地基做穩，之後加入口是純加法；反過來則是改造。Google 登入的學習含量也遠低於 RBAC ∩ Entitlement。

---

## Stage 0：骨架 + 風險驗證

**目標**：把基礎設施補齊，並在投入資料模型之前驗證 R1。

### 0.1 Scaffold 重構

Scaffold 是 counter 專案的複製品。**先清乾淨再往上蓋**——現在做最便宜，等 Better Auth 和資料表進來之後再改，成本會高得多。

**a. 移除 counter 的領域程式碼**

| 位置                                              | 處理                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/server/src/store.ts`、`data/counter.json`   | 刪除                                                                     |
| `apps/server/src/index.ts` 的 `/api/counter` 路由 | 刪除路由，**保留** Fastify + zod provider + Swagger/Scalar + CORS 的骨架 |
| `apps/server/api/counter`（Bruno collection）     | 刪除                                                                     |
| `packages/contract/src/counter.ts`、`client.ts`   | 刪除                                                                     |
| `packages/design/src/tokens.ts`                   | 保留（見 d）                                                             |
| `apps/web`、`apps/mobile` 的 counter UI           | 清空為最小可跑的殼                                                       |

`apps/server/src/index.ts` 裡關於註冊順序、CORS methods、`0.0.0.0` 綁定的註解要保留——那些是踩過的坑，與 counter 無關。

**a-2. 一併移除腳手架模板與無關檔案**

counter 之外，scaffold 也留下一批 `create-vite` / `create-expo` 的模板產物，同樣沒有保留價值：

| 位置                                                          | 處理                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/README.md`、`apps/mobile/README.md`                 | 刪除——是模板的說明文，不是本專案的文件                      |
| `apps/web/src/assets/`（`react.svg`、`vite.svg`、`hero.png`） | 刪除——無任何引用                                            |
| `apps/web/public/icons.svg`                                   | 刪除——無任何引用（`favicon.svg` 保留，`index.html` 有引用） |
| `apps/web/dist/`、`apps/mobile/.expo/`                        | 刪除，並補進 `.gitignore`                                   |
| `apps/web/.gitignore`                                         | 刪除——create-vite 的樣板，內容已被根 `.gitignore` 涵蓋      |

根 `.gitignore` 原本只有 `node_modules/`。補上建置產物、`.env` 與編輯器檔案——這類檔案一旦被提交，之後要清就是改寫歷史。

`apps/mobile/.gitignore` **保留**：它不只是樣板，還擋掉 RN 專屬且真的敏感的東西（`*.jks`、`*.p8`、`*.p12`、`*.key`、`*.mobileprovision` 這些簽章金鑰）。這種清單交給 Expo 維護比自己重寫安全。

**a-3. 移除 query 持久化層**

`@tanstack/react-query-persist-client` 與 `@tanstack/query-async-storage-persister` 是為了 counter 的離線行為而裝的，本專案不需要，且對認證系統來說是負面的：把 query cache 寫進 `localStorage` / `AsyncStorage` 等於把使用者與組織資料落到明文儲存，登出時還得記得清乾淨。

`@tanstack/react-query` 本身保留——Stage 2+ 的自有管理 API（org / role / seat）會用到。catalog 中對應的兩個 persist 套件一併移除。

`apps/mobile` 的 `@react-native-async-storage/async-storage` 保留：它是 native 依賴，移除後重裝的成本高於留著的成本，Stage 6 的 token 儲存也可能用到。

**b. 重新命名為 `@ims/*`**

root `package.json`（`name`、scripts 的 `--filter`）、各 workspace 的 `name` 與相互依賴、所有 import。一次改完，之後不再動。

理由見 ARCHITECTURE §9：不用 `@auth/*` 是因為那是 Auth.js 的真實 npm scope，與 `better-auth` 並存會混淆。

**c. 建立新的 package 邊界**

```
packages/
  db/        新建 —— schema 與連線（見 0.3）
  policy/    新建 —— 權限演算，純函式（Stage 3/4 才有內容，Stage 0 先立骨架與測試設定）
  contract/  保留但清空 —— 只放自有管理 API 的 schema
  design/    保留 —— 設計 token（決策見 d）
```

`policy` 在 Stage 0 只需要建立 package、tsconfig 與測試設定，不寫實際邏輯。先立好位置，讓 Stage 3/4 有地方放。

測試 runner 選 **Vitest**：`apps/web` 已經是 Vite，共用同一套 config 語意與 transform pipeline，不必為了測一個純函式 package 另外養一套工具鏈。`@ims/policy` 是純函式、無 DB 無 HTTP，任何 runner 都能跑，所以選擇成本低——挑跟現有工具鏈同源的那個。

**d. `packages/design` 沿用（已決定）**

保留 `packages/design` 與現有 token。理由：token 本身（`space` / `palette` / `color`）與 counter 這個領域無關，是 web / mobile 共用的樣式來源；就算 Stage 1 決定採用 `better-auth-ui`，也仍然需要一組 token 去對齊它的主題。

因此 Stage 0 不動 `design`，只把**使用它的 counter UI** 清掉。若 Stage 1 選了現成 UI 元件庫，屆時再調整 token 的值，不影響 package 的存在。

#### 0.1 Checklist

- [x] 刪除 `apps/server/src/store.ts`、`apps/server/data/`
- [x] 刪除 `/api/counter` 路由，保留 Fastify + zod provider + Swagger/Scalar + CORS 骨架與既有註解
- [x] 刪除 Bruno collection `apps/server/api/counter/`，`opencollection.yml` 改名為 IMS API
- [x] 刪除 `packages/contract/src/{counter,client}.ts`，`index.ts` 清空為說明用的空模組
- [x] `apps/web`、`apps/mobile` 的 counter UI 清為最小外殼，刪除兩邊的 `api.ts`
- [x] 刪除模板檔案：兩個 `README.md`、`apps/web/src/assets/`、`public/icons.svg`、`apps/web/.gitignore`
- [x] 刪除建置產物 `apps/web/dist/`、`apps/mobile/.expo/`，補進根 `.gitignore`（含 `.env`、logs、編輯器）
- [x] 移除 `react-query-persist-client` + `query-async-storage-persister`（含 catalog 條目），保留 `@tanstack/react-query`
- [x] 全面改名 `@counter/*` → `@ims/*`：root `name` 與 `--filter`、各 workspace `name`、相互依賴、所有 import
- [x] 新建 `packages/db` 骨架（`src/index.ts`、`src/schema/index.ts`、tsconfig）
- [x] 新建 `packages/policy` 骨架（package、tsconfig、`vitest.config.ts`）
- [x] catalog 補上 drizzle-orm / drizzle-kit / postgres / better-auth / vitest（僅版本來源，未安裝）
- [x] 全專案零 counter 殘留 → 驗證：`grep -rni counter --exclude-dir=node_modules .`（只剩 docs 敘述）
- [x] 型別與 lint 全綠 → 驗證：`pnpm typecheck && pnpm lint && pnpm format:check`
- [x] 測試指令可跑 → 驗證：`pnpm test`
- [x] server 起得來 → 驗證：`pnpm server` 後 `curl localhost:3000/health` 回 `{"status":"ok"}`
- [x] web 建得起來 → 驗證：`pnpm --filter @ims/web build`

已知未解、不擋 0.2：Expo 的 `@expo/require-utils` 要求 `typescript@^5`，catalog 是 `~6.0.3`，`pnpm install` 會出 peer 警告。typecheck 全綠故暫不處理，Stage 6 之前要收掉。

### 0.2 Docker Postgres

`docker-compose.yml`（開發用，非生產設定）：

- Postgres，固定 port 與 volume
- 一併帶 Mailpit（Stage 2 的 `MailPort` 會用到，先備好省得之後再改 compose）
- `.env.example` 補上 `DATABASE_URL`

**實際版本**：`postgres:17-alpine`、`axllent/mailpit:v1.30`。兩個都釘版本——compose 用 `latest` 的話，換台機器起出來的可能是不同版本的 DB，這種差異最難查。

**變數全部走 `.env`**，且用 `${VAR:?訊息}` 而非 `${VAR:-預設值}`：

```yaml
POSTGRES_DB: ${DB_NAME:?DB_NAME 未設定，請從 .env.example 複製一份 .env}
```

差別在於**沒設變數時要早死還是晚死**。給預設值的話，忘了建 `.env` 會安靜地起一個名字不對的資料庫，等到 Drizzle migrate 失敗才發現；`:?` 則是 `docker compose up` 當場報錯並指出該做什麼。port 這種「不影響正確性、只是避免撞port」的才用 `:-` 給預設值。

**開發憑證**：`ims` / `root` / `password123`。刻意簡單，只在本機用。`.env` 已被 `.gitignore` 擋掉，提交的只有 `.env.example`。

**`DATABASE_URL` 是手動同步的**：compose 沒辦法從那四個變數幫你組出連線字串，所以 `.env` 裡它是獨立一行，改帳密時兩邊都要改。這是這份設定唯一的重複，記在 `.env.example` 的註解裡。

**healthcheck 的 `-U` / `-d` 不能省**：`pg_isready` 不帶參數時會用執行者身分去查同名資料庫（`root` / `root`），那個庫不存在，於是永遠 unhealthy。0.4 的 server 要 `depends_on: service_healthy`，這個 healthcheck 必須是真的。

**Mailpit 不掛 volume**：開發用信箱沒有保存價值，`MP_MAX_MESSAGES: 500` 讓它自己滾動就夠。

#### 0.2 Checklist

- [x] 建立 `docker-compose.yml`：Postgres 服務（`postgres:17-alpine`），`DB_PORT` 可調，具名 volume `postgres-data`
- [x] 同一份 compose 加入 Mailpit（`v1.30`，SMTP 1025 + Web UI 8025）
- [x] 根目錄 `.env.example` 補 `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_PORT` / `DATABASE_URL` / Mailpit ports / `PORT`
- [x] 變數缺漏會擋下來 → 驗證：`docker compose --env-file /dev/null config` 報 `required variable DB_NAME is missing a value`
- [x] 容器起得來 → 驗證：`docker compose up -d && docker compose ps` 兩者皆 healthy
- [x] DB 連得上 → 驗證：`docker compose exec postgres psql -U root -d ims -c 'select 1'`
- [x] Mailpit UI 打得開 → 驗證：`curl -o /dev/null -w '%{http_code}' localhost:8025` 回 200；SMTP 1025 可連
- [x] 資料有持久性 → 驗證：建表寫入 → `docker compose restart` → 資料仍在

尚未接上：`apps/server` 目前不讀根目錄的 `.env`（`PORT` / `DATABASE_URL` 都還沒有人消費）。這件事屬於 0.3 —— 建立 drizzle 連線時一併決定載入方式（`node --env-file` 或 dotenv），現在先不動。

### 0.3 @ims/db

新建 workspace package，職責是**唯一的 schema 與連線來源**。

```
packages/db/
  src/
    schema/
      auth.ts      # Better Auth CLI 產生（不手改）
      index.ts
    client.ts      # drizzle 連線
    index.ts
  drizzle.config.ts
```

`apps/server` 依賴它；未來自有領土的表（Stage 2+）也放這裡，與 `auth.ts` 分檔存放，讓兩塊領土在檔案層級就分得清楚。

catalog 補上以下項目（**已決定**，版本為 Stage 0 起始基準）：

| 套件          | 版本       | 用途                        | 進場階段 |
| ------------- | ---------- | --------------------------- | -------- |
| `drizzle-orm` | `^0.45.2`  | ORM 與 schema DSL           | 0.3      |
| `drizzle-kit` | `^0.31.10` | migration 產生與執行        | 0.3      |
| `postgres`    | `^3.4.9`   | driver                      | 0.3      |
| `better-auth` | `^1.6.25`  | 認證流程與 CLI              | 0.4      |
| `vitest`      | `^4.1.10`  | `@ims/policy` 的測試 runner | 0.1      |

driver 選 `postgres`（postgres.js）而非 `pg`：Drizzle 官方對兩者都有 adapter，但 `postgres` 是原生 ESM、自帶型別、不需要 `@types/pg`，與本專案全 ESM 的設定較合。若之後需要連線池的細部控制再換 `pg`——Drizzle 的 query API 不會變，換的只有 `client.ts` 那一層。

catalog 只是版本的單一來源，**加進 catalog 不等於安裝**。實際 `dependencies` 要到各自的進場階段才加。

#### 誰負責載入 `.env`

`@ims/db` **不自己載 `.env`**，只讀 `process.env.DATABASE_URL`，缺了就丟一個講清楚該做什麼的錯誤（`src/env.ts`）。誰把變數放進 `process.env` 是呼叫端的事：

| 呼叫端        | 載入方式                                                     |
| ------------- | ------------------------------------------------------------ |
| `apps/server` | dev script 的 `tsx --env-file-if-exists=../../.env`          |
| `drizzle-kit` | `drizzle.config.ts` 裡的 `process.loadEnvFile("../../.env")` |

兩邊都用 Node 內建能力，不裝 `dotenv`（Node 20.12+ 就有 `--env-file` 與 `loadEnvFile`）。

之所以不讓 db 自己載：那樣測試或 CI 想換連線字串時會發現改不動——package 會固執地去讀那個檔案。`-if-exists` 變體則是為了 CI：那裡的變數由環境注入，沒有 `.env` 檔，不該因此啟動失敗。

#### 兩個連線設定

`postgres(url, { prepare: false })` —— postgres.js 預設開 prepared statement，日後擺在 PgBouncer 的 transaction pooling 後面會直接壞掉。開發階段的查詢量吃不到 prepared 的好處，先關著，省得上了 pooler 才發現。

`drizzle(sql, { schema })` —— 傳 schema 進去才有 `db.query.<table>` 這種 relational query API，少了它只剩 `db.select()`。0.4 之後 schema 有內容時差別才看得出來。

#### generate + migrate，不用 push

`drizzle-kit push` 直接改資料庫、不留檔案，適合玩 schema；`generate` 產出可 review、可進版控的 migration 檔。認證系統的 schema 變更需要能回答「什麼時候改了什麼」，所以走後者。config 開 `strict: true` + `verbose: true`，破壞性變更會先問過再執行。

#### `/health` 拆成兩個欄位

`{ status, db }`。server 活著但 DB 連不上是**不同**的故障——兩者都回 500 的話，看到的人得自己猜是哪一種。DB 掛掉時回 `503 { status: "degraded", db: "down" }`。

順帶補了 SIGINT/SIGTERM 時 `sql.end()` 的收尾：`tsx watch` 每次重載都留一批連線給 Postgres 的話，開發幾十次就會撞到 `max_connections`。

#### 0.3 Checklist

- [x] `packages/db` 加入 `drizzle-orm`、`postgres` 依賴；devDeps 加 `drizzle-kit`（皆用 `catalog:`）
- [x] 寫 `src/client.ts`：`createDb()` 回傳 `{ db, sql }`，並匯出 `Database` 型別
- [x] 寫 `src/env.ts`：`requireDatabaseUrl()` 集中缺變數時的錯誤訊息
- [x] 寫 `drizzle.config.ts`：dialect postgresql、schema 指向 `src/schema/index.ts`、out `./drizzle`
- [x] `packages/db/package.json` 加上 `db:generate` / `db:migrate` / `db:studio`
- [x] `apps/server` 加入 `@ims/db` 依賴，dev script 補 `--env-file-if-exists`
- [x] `/health` 加上 DB 連線檢查，DB 掛掉回 503
- [x] 型別全綠 → 驗證：`pnpm typecheck`（7/7）
- [x] drizzle-kit 讀得到設定與 `.env` → 驗證：`pnpm --filter @ims/db db:generate` 回 `0 tables`（schema 還是空的，符合預期）
- [x] 連線真的通 → 驗證：`curl localhost:3000/health` → `{"status":"ok","db":"up"}` 200
- [x] DB 掛掉不會假裝健康 → 驗證：`docker compose stop postgres` → `{"status":"degraded","db":"down"}` 503，start 後自動回 200
- [x] 缺 `DATABASE_URL` 會早死 → 驗證：`DATABASE_URL= tsx -e '...createDb()'` 印出中文提示而非 driver 錯誤
- [x] 關閉時不漏連線 → 驗證：SIGTERM 後 `pg_stat_activity` 的 `postgres.js` 連線數歸 0

### 0.4 Better Auth 最小可用

- `apps/server` 安裝 `better-auth`，設定 drizzle adapter
- 只開 email + password，先不開任何 plugin
- 用 Better Auth CLI 產生 schema 到 `packages/db/src/schema/auth.ts`，migrate
- 掛進 Fastify（注意與現有 CORS / Swagger 的註冊順序——現有 `index.ts` 已註明順序是易踩的坑）
- Email 驗證信先用 console 輸出，不接 provider

**驗收**：能註冊、登入、取得 session。

#### 0.4 Checklist

- [x] `apps/server` 安裝 `better-auth` 與 `@better-auth/drizzle-adapter`（皆 `catalog:`），建立 `src/auth.ts`
- [x] 新增 `src/db.ts`：連線池改成 process 級單例（原本 index.ts 自己叫 `createDb()`，多了 auth.ts 之後會開出兩個池）
- [x] 只開 `emailAndPassword`，**不掛任何 plugin**（plugin 是 0.5 spike 與 Stage 1+ 的事）
- [x] 用 Better Auth CLI 產生 schema 到 `packages/db/src/schema/auth.ts`，由 `schema/index.ts` 匯出 → 驗證：`pnpm --filter @ims/server auth:generate`
- [x] 產生並套用 migration → 驗證：`psql \dt` 看得到 `user` / `session` / `account` / `verification` 四張表
- [x] handler 掛進 Fastify（CORS 之後），在獨立 register scope 內換掉 content type parser、set-cookie 逐條搬
- [x] `sendVerificationEmail` 先用 `console.log` 輸出連結（真 adapter 是 Stage 2 的 `MailPort`）
- [x] `.env.example` 補 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`；缺了就在啟動時擋下來
- [x] 註冊可用 → 驗證：`curl -X POST /api/auth/sign-up/email` 回 200，`user` 表出現 `alice@example.com`
- [x] 登入可用 → 驗證：`curl -X POST /api/auth/sign-in/email` 回 200 並帶 `better-auth.session_token`
- [x] session 讀得到 → 驗證：帶 cookie 打 `/api/auth/get-session` 回傳該使用者與 session
- [x] 多條 set-cookie 不會被併掉 → 驗證：`rememberMe:false` 的 sign-in 回兩個獨立的 `set-cookie`（session_token + dont_remember）
- [x] 型別、lint、格式全綠 → 驗證：`pnpm typecheck && pnpm lint && pnpm format:check`

Better Auth 自己的 CSRF 保護：不帶 `Origin` 的 POST `/api/auth/sign-out` 回 `403 MISSING_OR_NULL_ORIGIN`，帶了 `trustedOrigins` 內的來源才過。sign-up / sign-in 不受此限。這是 library 行為不是接線錯誤，記在 NOTE.md。

### 0.5 R1 Spike（本階段最重要的一項）

> 驗證 `getAdditionalUserInfoClaim` 能否取得 `session.activeOrganizationId`。

做法：暫時掛上 `oidcProvider` + `organization` plugin，在 claim hook 內嘗試取得當前 session，把結果印出來。這是**拋棄式程式碼**，目的只是取得結論。

依 ARCHITECTURE §8 列的四個解法依序嘗試，**結論寫回 ARCHITECTURE §8**。

**驗收**：ARCHITECTURE §8 有明確結論與選定解法，不再是開放問題。

#### 0.5 Checklist

這一段的產出是**結論**，不是程式碼。底下的程式碼寫完就丟。

- [ ] 暫時掛上 `oidcProvider` + `organization` plugin，產生對應 schema 並 migrate
- [ ] 建一個測試用 org 與 client，讓 authorize flow 跑得起來
- [ ] 在 `getAdditionalUserInfoClaim` 內印出拿得到的東西，確認簽章實際收到什麼
- [ ] 解法 1：從 request context 取得當前 session → 記錄成功或失敗原因
- [ ] 解法 2：authorize request 帶自訂參數指定 org，consent 階段確認 → 僅在 1 失敗時嘗試
- [ ] 解法 3：以 `client` → `organization` 對應關係反推 → 僅在 1、2 皆失敗時嘗試
- [ ] 解法 4：放棄 plugin 的 claim hook，自行包一層 token 簽發 → 最後手段
- [ ] **結論寫回 ARCHITECTURE §8**：選定解法、為什麼、被否決的那幾個各卡在哪
- [ ] 若結論是解法 3 或 4，回頭檢查 Stage 2–4 的形狀是否要調整，並修正本文件
- [ ] 移除 spike 的拋棄式程式碼與暫時掛上的 plugin，讓 0.4 的狀態乾淨留存

### Stage 0 完成的標誌

- [x] 專案內找不到任何 counter 的殘留，全部改用 `@ims/*`
- [x] `pnpm typecheck` 與 `pnpm lint` 全綠
- [ ] `docker compose up` 起得來，`pnpm server` 連得上 DB
- [ ] 能註冊、登入
- [ ] R1 有結論並已寫回 ARCHITECTURE §8

---

## 後續階段概要

細節等前一階段完成後再展開——避免在資訊不足時過度規劃。

底下每個階段只列**里程碑**。真正的細項清單在該階段開工時才展開成子清單，格式比照 Stage 0（含 `→ 驗證：` 指令）。現在就把細項全寫死，等於在資訊不足時假裝已經知道答案。

**Stage 1 — OIDC Provider**
`oidcProvider` plugin、`apps/web` 註冊為 trusted client（`skipConsent`）、走通完整 authorization code flow、`allowDynamicClientRegistration: false`。此時 token 還不帶 tenant。

- [ ] `oidcProvider` plugin 掛上，schema 產生並 migrate
- [ ] `apps/web` 註冊為 trusted client
- [ ] 走通完整 authorization code flow
- [ ] 決定登入 UI 自己刻或用 `better-auth-ui`，並回頭確認 `packages/design` 的 token 值（見 0.1 d）
- [ ] **完成的標誌**：web 透過 OIDC 登入並取得 `id_token`，內容可解出來檢查

**Stage 2 — Tenancy**
`organization` plugin、`member` 的 `additionalFields`（`status`、`invitedBy`）、`MailPort` 介面 + Mailpit adapter、邀請與接受流程、`setActiveOrganization` 切換、token 開始帶 `org_id`。需一併決定 ARCHITECTURE §10 的「切換組織完整流程」。

- [ ] `organization` plugin + `member` 的 `additionalFields`
- [ ] `MailPort` 介面與 Mailpit adapter
- [ ] 邀請與接受流程
- [ ] `setActiveOrganization` 切換
- [ ] 決定「切換組織的完整流程」並寫回 ARCHITECTURE §10
- [ ] **完成的標誌**：token 帶 `org_id`，切 org 會重發

**Stage 3 — RBAC**
自有領土第一批表、兩層 role 的分工落地、`@ims/policy` 開始有內容、權限進 token。需一併決定 ARCHITECTURE §10 的「權限演算層級」。

- [ ] 自有領土第一批表：product / permission / role / role_permission / member_role
- [ ] 兩層 role 的分工落地（`member.role` 不動，自有 RBAC 另一層）
- [ ] `@ims/policy` 寫入第一批邏輯與測試，移除 `vitest.config.ts` 的 `passWithNoTests`
- [ ] 決定「權限演算的層級」並寫回 ARCHITECTURE §10
- [ ] **完成的標誌**：token 帶 `permissions[]`，API 擋得住

**Stage 4 — Entitlement**
plan / subscription / seat、交集運算、三種拒絕語意的區分。這是整個專案思考含量最高的一段。

- [ ] plan / plan_permission / subscription / seat
- [ ] RBAC ∩ Entitlement 的交集運算（純函式，在 `@ims/policy`）
- [ ] 三種拒絕語意可區分：`permission_denied` / `seat_required` / `plan_upgrade_required`
- [ ] 邊界條件的 unit test：席次用完、subscription 過期、role 撤銷但 seat 還在
- [ ] **完成的標誌**：「有 role 但沒 seat」被擋，且錯誤能分辨是哪一種

**Stage 5 — 可觀測性**
audit_log 與 login_attempt、rate limit / 帳號鎖定、user enumeration 的防護。

- [ ] `audit_log`（指向 `member_id`，語意是「某人以某 org 成員身份做了某事」）
- [ ] `login_attempt`（`user_id` 可為 null，email 不存在也要記）
- [ ] rate limit / 帳號鎖定
- [ ] user enumeration 防護：「查無此帳號」與「密碼錯誤」對外同一個回應
- [ ] **完成的標誌**：能查「誰在何時對什麼做了什麼」

**Stage 6+ — 認證方式擴充**
Google OAuth → Passkey / WebAuthn / 2FA → 真實 Email provider adapter →（Apple，可選）。

- [ ] Google OAuth
- [ ] Passkey / WebAuthn / 2FA
- [ ] 真實 Email provider adapter（換掉 Mailpit，`MailPort` 介面不變）
- [ ] 收掉 Expo 與 TypeScript 6 的 peer 版本衝突（見 0.1 checklist 末尾）
- [ ] Apple Sign In（可選，見 ARCHITECTURE §10——學習含量低、成本高）
- [ ] **完成的標誌**：同一 identity 多種入口
