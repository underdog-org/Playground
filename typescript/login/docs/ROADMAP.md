# ROADMAP

實作順序與各階段的驗收標準。

設計全景與決策理由見 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 原則

**設計一次畫完，實作切成獨立可驗收的階段。**

每個階段都要能單獨跑起來、單獨驗收。不追求功能數量——本專案的成功標準是「**能講清楚每一個決策**」，所以前 4 個階段做透，勝過 8 項全做但每項都淺。

---

## 目前狀態

Scaffold 由 counter 專案沿用而來，已具備：

- pnpm workspace + catalog（單一版本來源）
- `apps/{web,mobile,server}` — Vite React / Expo / Fastify
- `packages/{contract,design}` — zod schema + client / design tokens
- Fastify + `fastify-type-provider-zod` + Swagger + Scalar 已可運作
- oxlint / oxfmt / mise

**尚缺**：Postgres（Docker）、Drizzle、Better Auth、`packages/db`、`packages/policy`。

**且需重構**：`@counter/*` 命名、counter 的領域程式碼（API、store、契約、UI）、`packages/contract` 的內容，以及 `create-vite` / `create-expo` 留下的模板檔案。這些都是 counter 與腳手架的產物，與本專案無關。（`packages/design` 沿用，見 0.1 d）

以上都是 Stage 0 的內容。

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

`.gitignore` 現在只有 `node_modules/`。補上建置產物與 `.env`——這類檔案一旦被提交，之後要清就是改寫歷史。

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

### 0.2 Docker Postgres

`docker-compose.yml`（開發用，非生產設定）：

- Postgres，固定 port 與 volume
- 一併帶 Mailpit（Stage 2 的 `MailPort` 會用到，先備好省得之後再改 compose）
- `.env.example` 補上 `DATABASE_URL`

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

### 0.4 Better Auth 最小可用

- `apps/server` 安裝 `better-auth`，設定 drizzle adapter
- 只開 email + password，先不開任何 plugin
- 用 Better Auth CLI 產生 schema 到 `packages/db/src/schema/auth.ts`，migrate
- 掛進 Fastify（注意與現有 CORS / Swagger 的註冊順序——現有 `index.ts` 已註明順序是易踩的坑）
- Email 驗證信先用 console 輸出，不接 provider

**驗收**：能註冊、登入、取得 session。

### 0.5 R1 Spike（本階段最重要的一項）

> 驗證 `getAdditionalUserInfoClaim` 能否取得 `session.activeOrganizationId`。

做法：暫時掛上 `oidcProvider` + `organization` plugin，在 claim hook 內嘗試取得當前 session，把結果印出來。這是**拋棄式程式碼**，目的只是取得結論。

依 ARCHITECTURE §8 列的四個解法依序嘗試，**結論寫回 ARCHITECTURE §8**。

**驗收**：ARCHITECTURE §8 有明確結論與選定解法，不再是開放問題。

### Stage 0 完成的標誌

- 專案內找不到任何 counter 的殘留，全部改用 `@ims/*`
- `pnpm typecheck` 與 `pnpm lint` 全綠
- `docker compose up` 起得來，`pnpm server` 連得上 DB
- 能註冊、登入
- R1 有結論並已寫回 ARCHITECTURE §8

---

## 後續階段概要

細節等前一階段完成後再展開——避免在資訊不足時過度規劃。

**Stage 1 — OIDC Provider**
`oidcProvider` plugin、`apps/web` 註冊為 trusted client（`skipConsent`）、走通完整 authorization code flow、`allowDynamicClientRegistration: false`。此時 token 還不帶 tenant。

**Stage 2 — Tenancy**
`organization` plugin、`member` 的 `additionalFields`（`status`、`invitedBy`）、`MailPort` 介面 + Mailpit adapter、邀請與接受流程、`setActiveOrganization` 切換、token 開始帶 `org_id`。需一併決定 ARCHITECTURE §10 的「切換組織完整流程」。

**Stage 3 — RBAC**
自有領土第一批表、兩層 role 的分工落地、`@ims/policy` 開始有內容、權限進 token。需一併決定 ARCHITECTURE §10 的「權限演算層級」。

**Stage 4 — Entitlement**
plan / subscription / seat、交集運算、三種拒絕語意的區分。這是整個專案思考含量最高的一段。

**Stage 5 — 可觀測性**
audit_log 與 login_attempt、rate limit / 帳號鎖定、user enumeration 的防護。

**Stage 6+ — 認證方式擴充**
Google OAuth → Passkey / WebAuthn / 2FA → 真實 Email provider adapter →（Apple，可選）。
