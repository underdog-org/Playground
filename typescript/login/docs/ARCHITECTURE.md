# ARCHITECTURE

企業級身份認證平台的設計全景與決策紀錄。

本文件回答「**為什麼這樣設計**」。實作順序見 [ROADMAP.md](./ROADMAP.md)。

---

## 1. 系統定位

這個系統是一個 **OIDC Provider（IdP）**，不是「某個 app 的登入功能」。

`apps/web`、`apps/mobile` 是它的 OIDC client，未來任何新產品接上去就自動具備 SSO。參考對象是 Adobe IMS：單一身份、多產品、組織化授權。

這個定位是所有後續設計的前提。如果只是「一個 app 的登入」，底下的資料模型有一半不需要存在。

---

## 2. 核心決策紀錄

| #   | 決策               | 選擇                                    | 理由                                                                                          | 代價                                             |
| --- | ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| D1  | SSO 邊界           | 真・OIDC Provider                       | 唯一能支撐「多產品單一登入」的做法；也最能練到 token 思維                                     | 需理解 OIDC 流程、consent、client 註冊           |
| D2  | Tenancy 模型       | 全域 User + Membership                  | 一個 email 一個全域帳號，透過 membership 加入多個 org。這才是「單一登入」                     | user 是共享資源，資料隔離須靠應用層把關          |
| D3  | Membership 形狀    | A 的形狀、C 的心態                      | `member` 有自己的 `id`、`status`、`joined_at`，但**現在不建** per-org profile 表              | 無。未來要加 `member_profile.member_id` 是純加法 |
| D4  | Token 與 tenant    | Token 綁 tenant                         | **`access_token`** 內含 `org_id` 與已解析的權限（id_token 不行，見 §8）。API 層簡單、審計清楚 | 切換組織需要 re-authorize 流程                   |
| D5  | Better Auth 的邊界 | 流程交給它，資料模型自己做              | 見 §3                                                                                         | 需摸清它的 schema 才能乾淨接合                   |
| D6  | Tenancy 實作       | 用 `organization` plugin 當骨架         | 借它的 organization/member/invitation 與 `activeOrganizationId` 機制                          | 受限於它的欄位；靠 `additionalFields` 擴充       |
| D7  | Entitlement 模型   | Seat 指派制                             | org 買 N 張席次，admin 指派給特定成員。最貼近真實企業情境                                     | 多一張 `seat` 表與指派 UI                        |
| D8  | Role 作用域        | 綁單一 product                          | 與 seat/plan 的 per-product 粒度一致，交集運算單純                                            | 「所有產品的 viewer」要指派多次                  |
| D9  | Email 寄送         | 先定義 `MailPort` 介面                  | verification / reset / invitation / 2FA 四個流程都要用，介面要早定                            | 初期只有 console adapter，看不到真實信件         |
| D10 | 認證方式擴充順序   | 排到最後                                | OAuth / Passkey 是「同一 identity 的不同入口」，不動地基                                      | 較晚才有 Google 登入的成就感                     |
| D11 | 權限演算的位置     | 獨立 `packages/policy`                  | 純函式、不碰 DB 與 Fastify，可用純 unit test 把交集邏輯與三種拒絕語意測到透                   | 多一層間接；資料要先讀好再傳進去                 |
| D12 | Package 邊界       | `db` / `policy` / `contract` / `design` | 見 §10                                                                                        | 需把 counter 的領域程式碼整批移除                |

### D2 補充：為什麼不是 Tenant-scoped User

Tenant-scoped user（同一 email 在不同 org 是不同帳號）隔離最乾淨、合規好講，但那樣就**不是單一登入**了，與本專案前提矛盾。

### D3 補充：A 與 C 的差別

C（全域 Identity + 租戶內 Profile）其實是 A 的超集——`member` 一旦長出屬性欄位就變成 C。真正的問題不是選哪個，而是「**member 是純 join table，還是有自己身份的實體**」。

我們選後者，但**不預先建 profile 表**。所以：

- `id_token` 的 `name` / `picture` claim，現階段來自全域 `user`
- 未來若需要 per-org 顯示名（例如客戶要求 org 內必須用 `firstname.lastname`，或 SCIM 同步 `department` / `employeeId`），加一張 `member_profile` 掛在 `member.id` 上即可，零 migration 痛苦
- `audit_log` 直接指向 `member_id`，語意精確：「某人**以某 org 成員身份**做了某事」

---

## 3. 領土劃分

資料庫裡有兩塊領土，規則不同。

```
┌─ Better Auth 領土（CLI 產生，不手改，只用 additionalFields 擴充）──┐
│                                                                    │
│  core        : user, session, account, verification                │
│  organization: organization, member, invitation                    │
│  oauthProvider: oauthClient, oauthConsent, oauthAccessToken,       │
│                 oauthRefreshToken                                  │
│  jwt         : jwks（oauthProvider 硬性依賴，見 §8 結論四）        │
│  (Stage 6+)  : twoFactor, passkey                                  │
└────────────────────────────────────────────────────────────────────┘
                              │
                  member.id / user.id / organization.id
                              │  FK 只從我這邊指過去，不反向
                              ▼
┌─ 自有領土（完全自己設計）──────────────────────────────────────────┐
│                                                                    │
│  產品與權限 : product, permission, role, role_permission,          │
│               member_role                                          │
│  授權       : plan, plan_permission, subscription, seat            │
│  可觀測性   : audit_log, login_attempt                             │
└────────────────────────────────────────────────────────────────────┘
```

「自己設計 schema」的具體含義：**設計第二塊領土，並明確定義它與第一塊的接合方式**——而不是連 `session` 表都自己畫。第二塊才是有思考含量的部分。

### Better Auth 表的關鍵事實

摸清這些才能接得乾淨：

- `member` 有自己的 `id`（不是 `(org_id, user_id)` 複合主鍵）→ 可安全地被 FK 指向
- `member.role` 是單純的 `string` 欄位，沒有 role 表 → 這就是自有 RBAC 接進去的縫
- `session.activeOrganizationId` 由 organization plugin 自動加到 session 表 → 這是把「當前 tenant」帶進 token 簽發流程的管道
- `invitation` 已含 `email` / `role` / `status` / `expiresAt` / `inviterId` → 邀請流程不必重造，只需接上 `MailPort`

---

## 4. 兩層 Role

`member.role` 保留給 Better Auth 自己用，不去搶它。自有 RBAC 另建一層。

| 層級       | 存在哪                            | 語意                 | 例子                                   |
| ---------- | --------------------------------- | -------------------- | -------------------------------------- |
| **組織層** | `member.role`（Better Auth 擁有） | 你能不能管這個 org   | `owner` / `admin` / `member`           |
| **產品層** | `member_role`（自有）             | 你在某產品內能做什麼 | `photoshop:editor`、`analytics:viewer` |

這不是為了遷就 library 的妥協——Adobe 本身就是 System Admin / Product Admin / User 三層。組織層管「誰能邀人、誰能買 license」，產品層管「誰能匯出檔案」，兩者的生命週期與管理者都不同。

這個分法也讓 D8（role 綁單一 product）沒有副作用：`billing.manage`、`audit.read` 這類平台級權限本來就屬於組織層，由 `member.role` 表達，不會變成沒有歸屬的孤兒權限。

---

## 5. 自有資料模型

```
-- 產品與權限（RBAC）
product          id, key('photoshop'), name
permission       id, product_id, key('document.export'), description

role             id, org_id(nullable = 系統預設), product_id, key, name
role_permission  role_id, permission_id
member_role      member_id, role_id, granted_by, granted_at

-- 授權（Entitlement）
plan             id, product_id, key('free'|'pro'|'enterprise'), name
plan_permission  plan_id, permission_id
subscription     id, org_id, plan_id, seats_total, status,
                 valid_from, valid_until
seat             id, subscription_id, member_id, assigned_at, revoked_at

-- 可觀測性
audit_log        id, org_id, actor_user_id, actor_member_id, action,
                 resource_type, resource_id, ip, user_agent,
                 request_id, metadata(jsonb), created_at
login_attempt    id, email, user_id(nullable), ip, user_agent,
                 outcome, failure_reason, created_at
```

### `role.org_id` 可為 null

null 代表系統預設角色（每個 org 都能用，例如 `viewer`）。非 null 代表該 org 自訂的角色。這讓「開箱即用的預設」與「企業客戶自訂」共用同一張表。

### `login_attempt.user_id` 必須可為 null

email 不存在時也要記錄失敗嘗試。同時**回應內容不能洩漏帳號是否存在**（user enumeration）——「查無此帳號」與「密碼錯誤」對外必須是同一個回應，差異只留在 `failure_reason` 裡。

---

## 6. 有效權限的演算

**RBAC 與 Entitlement 是兩件事**，這是整個系統最核心的概念：

- **Entitlement** = 你**買了**什麼（來自訂閱與席次指派）
- **RBAC** = 組織管理員**給**你什麼權限

有效權限是兩者的交集：

```
effective(member, product)
  = ⋃ role_permission[member_role[member]]                    ← 管理員給的
  ∩ ⋃ plan_permission[active_subscription_with_seat(member)]  ← 買到的
```

具體情境：org admin 給你 `photoshop:editor`（含 `document.export`），但公司買的是 `photoshop:free`（不含 `document.export`）→ **你按不下匯出**。

### 拒絕的語意必須可區分

被擋下來時，錯誤要能分辨三種情況——這本身就是設計題，不是實作細節：

| 情況      | 使用者該做什麼            | 建議回應                    |
| --------- | ------------------------- | --------------------------- |
| RBAC 沒給 | 找你的 org admin          | `403 permission_denied`     |
| 沒有 seat | 找你的 org admin 指派席次 | `403 seat_required`         |
| Plan 不含 | 找採購 / 升級方案         | `403 plan_upgrade_required` |

三種都回一樣的 403 是最省事的做法，也是最糟的使用者體驗。

---

## 7. 關鍵接縫

Better Auth 的世界與自有世界在**兩個函式**交會。分成兩個點不是設計上的妥協，而是因為兩件事發生在不同時刻：**「是哪個 tenant」在使用者還在線上時就決定了；「這個 tenant 裡他能做什麼」則要等到簽 token 時才算**。

```
/oauth2/authorize（前台，使用者的瀏覽器帶著 cookie 進來）
  → session.activeOrganizationId                        (organization plugin)
  → consentReferenceId({ user, session, scopes })       ← 邊界 ①：決定 tenant
       └─ return session.activeOrganizationId
  → 存進 oauth_consent.reference_id / oauth_access_token.reference_id

/oauth2/token（後台，client 的伺服器拿 code 來換，沒有 cookie）
  → customAccessTokenClaims({ user, referenceId, scopes })  ← 邊界 ②：算權限
       ├─ member = f(user.id, referenceId)
       ├─ 算 effective(member, client 對應的 product)   ← §6 的交集
       └─ return { org_id, org_role, permissions[], entitlements[] }
  → access_token                                        (oauth-provider plugin)
```

Better Auth 把 authorization code、consent、token 簽發全包了，但「**token 裡放什麼**」完全交給我們。分層邊界剛好落在有思考含量的地方。

```ts
oauthProvider({
  loginPage: "/sign-in",
  consentPage: "/consent",
  scopes: ["openid", "profile", "email", "read:organization"],
  postLogin: {
    page: "/select-organization",
    consentReferenceId: async ({ session, scopes }) => {
      // 邊界 ①：把「當前是哪個 org」釘在這次授權上
    },
  },
  customAccessTokenClaims: async ({ user, referenceId, scopes }) => {
    // 邊界 ②：自有世界的入口
  },
});
```

`id_token` 拿不到 `referenceId`（見 §8 結論三），所以 tenant 與權限只走 access_token。

為什麼 tenant 不能等到邊界 ② 再算：那時候是 client 後端的 back-channel 呼叫，請求裡沒有使用者的 cookie，`activeOrganizationId` 已經無從得知。這正是 R1 原本的風險，`referenceId` 就是官方用來跨過這段時間差的載體。

---

## 8. R1：已驗證，已解除

> **原本的風險**：`getAdditionalUserInfoClaim` 的簽章是 `(user, scopes, client)`，**沒有 session**。
> 但 D4（token 綁 tenant）要求簽發時必須知道 `activeOrganizationId`。

**結論：D4 成立，但接縫不在原本以為的地方。** 已於 Stage 0.5 用可跑的 authorization code flow 實測（`better-auth@1.6.25`）。

### 結論一：原本列的四個解法全部作廢，因為 plugin 本身作廢了

產生 schema 時 Better Auth CLI 直接噴出：

```
[Deprecation] The "oidc-provider" plugin is deprecated and will be removed in
the next major version. Migrate to @better-auth/oauth-provider
```

**採用 `@better-auth/oauth-provider`**（獨立套件，非 `better-auth/plugins` 之一）。

順帶確認舊 plugin 上原列解法 1（從 request context 取 session）**在原理上就不可行**，不只是 API 沒開放：那個 hook 跑在 `/oauth2/token` 裡，而 token endpoint 是 client 的**後端**帶著 authorization code 來換 token 的 back-channel 呼叫——那個 HTTP 請求裡根本沒有使用者的 cookie。就算 hook 拿得到 ctx 也讀不到 session。

### 結論二：選定解法——plugin 內建的 `referenceId` 機制

新 plugin 把「這次授權發生在哪個脈絡下」做成了一級概念：

```ts
oauthProvider({
  postLogin: {
    // 跑在 authorize / consent 階段 —— 使用者 session 還在，拿得到 activeOrganizationId
    consentReferenceId: async ({ user, session, scopes }) => {
      if (!scopes.includes("read:organization")) return undefined;
      return session.activeOrganizationId; // ← R1 缺的就是這一步
    },
  },
  // 簽發時 referenceId 被傳進來
  customAccessTokenClaims: async ({ user, referenceId, scopes }) => ({
    "https://ims.local/org": referenceId,
  }),
});
```

資料流是有落地的，不是純記憶體傳遞——`reference_id` 是四張表的一級欄位：
`oauth_consent` / `oauth_access_token` / `oauth_refresh_token` / `oauth_client`。

這**比原本列的解法 2 好**：解法 2 要自己在 authorize request 上塞自訂參數再於 consent 階段驗證，等於自己重造一套 state 傳遞；`referenceId` 是官方為同一個問題設計的路徑，且 refresh token 也帶得動（換發時 tenant 不會掉）。

實測結果（spike 輸出）：

```
org.id                                = LSzsd9vPyQCKXcOpkLFHWq5roOJLW0KH
session.activeOrganizationId          = LSzsd9vPyQCKXcOpkLFHWq5roOJLW0KH
oauth_access_token.reference_id       = LSzsd9vPyQCKXcOpkLFHWq5roOJLW0KH
access_token["https://ims.local/org"] = LSzsd9vPyQCKXcOpkLFHWq5roOJLW0KH   ✅
```

### 結論三：`org_id` 只能放 access_token，不能放 id_token

這是實測撞出來的，型別上就是這樣：

| hook                                                                         | 拿得到 `referenceId`？ |
| ---------------------------------------------------------------------------- | ---------------------- |
| `customAccessTokenClaims({ user, referenceId, scopes, resource, metadata })` | ✅                     |
| `customIdTokenClaims({ user, scopes, metadata })`                            | ❌                     |

spike 的 id_token 裡那個 claim 實際印出來是 `null`。

**這件事修正了 §7 與 D4 的描述**（原本寫「`id_token` / `access_token` 內含 `org_id`」）。而且新的分法在語意上更對：OIDC 裡 id_token 回答「**你是誰**」，access_token 回答「**你能做什麼**」。`org_id` / `permissions[]` / `entitlements[]` 本來就屬於後者。前端要顯示「目前在哪個 org」的話，走 `/userinfo` 或自有 API，不要指望 id_token。

### 結論四：三個連帶事實（都會影響 Stage 1）

1. **`oauthProvider` 硬依賴 `jwt` plugin**。沒掛的話啟動時丟 `BetterAuthError: jwt_config`。會多一張 `jwks` 表。
2. **access_token 預設是 opaque token，不是 JWT**。要看內容得打 `/oauth2/introspect`。Stage 1 要決定維持 opaque（每次驗證都回 IdP，撤銷即時但多一次往返）還是改成 JWT（可離線驗證，但撤銷有延遲）——這其實就是 §10「權限演算的層級」那題的一部分。
3. **`storeClientSecret` 預設是 `"hashed"`**（SHA-256 → base64url、不補 padding）。手動塞 client 進 DB 時存明文會換不到 token。

### 對後續階段的影響

Stage 2–4 的**資料模型形狀不用改**——`member` / `role` / `seat` 那幾張表照 §5 走。要改的只有兩件事，都在 §7 的接縫上：

- Stage 1 的 plugin 換成 `@better-auth/oauth-provider` + `jwt`
- claim 注入點從「一個 `getAdditionalUserInfoClaim`」變成「`consentReferenceId` 決定 tenant + `customAccessTokenClaims` 算權限」兩個點

**驗證方式**：見 ROADMAP 0.5，spike 程式在 `apps/server/spike/`（拋棄式，驗收後刪除）。

---

## 9. Monorepo 結構

現有 scaffold 由 counter 專案沿用而來。`packages/contract` 的內容是 counter 的產物，已清空重新設計；`packages/design` 的 token 與領域無關，沿用（見 ROADMAP 0.1 d）。

### Scope 命名

採用 `@ims/*`（呼應 Adobe IMS）。

刻意**不用** `@auth/*`——那是 Auth.js 在 npm 上的真實 scope，與本專案依賴的 `better-auth` 放在一起會造成 import 時的混淆。

### Package 職責

| Package         | 職責                                         | 依賴              | 不該有什麼             |
| --------------- | -------------------------------------------- | ----------------- | ---------------------- |
| `@ims/db`       | 唯一的 schema 與連線來源                     | drizzle, postgres | 業務邏輯               |
| `@ims/policy`   | 權限演算（RBAC ∩ Entitlement）               | 無（純函式）      | DB 查詢、HTTP、Fastify |
| `@ims/contract` | 自有管理 API 的 zod schema 與 typed client   | zod               | 實作邏輯               |
| `@ims/design`   | 設計 token，給 web / mobile 共用             | 無                | 元件                   |
| `apps/server`   | Fastify、Better Auth 掛載、把資料餵給 policy | 以上皆可          | 權限演算邏輯           |

### 為什麼 policy 要獨立

RBAC ∩ Entitlement 是本專案思考含量最高的部分。把它做成**純函式**（輸入 member 的 roles / seats / plan，輸出 effective permissions），代價是資料要先讀好再傳進去，換來的是：

- 交集邏輯與三種拒絕語意（§6）可以用純 unit test 測到透，不必拉起 DB 或 HTTP
- 邊界條件（席次用完、subscription 過期、role 被撤銷但 seat 還在）能窮舉
- 邏輯不會被埋進 SQL query 裡，看得見也講得清楚

### contract 的範圍變小了

counter 時期 `contract` 承載了所有 API 的 schema 與 client。現在**認證相關的 client 由 `better-auth/client` 提供**，OIDC 流程也走標準協定，不需自己定義。

`@ims/contract` 只負責自有領土的管理 API——org 管理、role 指派、seat 指派、audit 查詢。範圍變小是好事。

---

## 10. 尚未決定

這些留到對應階段再談，先記著避免遺忘：

- **切換組織的完整流程**：舊 token 如何失效、refresh token 的語意、多分頁不同租戶
- **權限演算的層級**：token 簽發時算完、或 API gateway、或每支 API 自行判斷；牽涉快取、權限變更的生效延遲、token 大小
- **Session 撤銷策略**：裝置清單、「登出所有裝置」、被停權時既有 token 的處理
- **Apple Sign In**：private relay、只有首次回傳 email、client_secret 是需每 6 個月輪替的 ES256 JWT。學習含量低、成本高，列為可選
