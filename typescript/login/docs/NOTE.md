# Learning Notes

## Docker Compose & Images

1. 用 ${VAR:?訊息} 而不是 ${VAR:-預設值}

```yaml
POSTGRES_DB: ${DB_NAME:?DB_NAME 未設定，請從 .env.example 複製一份 .env}
```

差別是「沒設變數時早死還是晚死」。給預設值的話，忘了建 .env 會安靜地起一個名字不對的 DB

2. healthcheck 帶了 -U root -d ims

pg_isready 不帶參數會用執行者身分查同名資料庫（root/root），那個庫不存在，於是永遠 unhealthy。0.4 的 server 要 depends_on: service_healthy，這個檢查必須是真的才有意義。

3. Mailpit 不掛 volume

開發用信箱沒有保存價值，MP_MAX_MESSAGES: 500 讓它自己滾動就夠，省一個 volume。

## Drizzle & DB

1. 在 Fastify 起來之前先建連線：DATABASE_URL 沒設的話這裡就會擋下來，而不是等到第一個查詢進來才發現。process.env 由 dev script 的 --env-file 填。

```ts
// apps/server/src/db.ts —— 0.4 起搬到這裡，變成 process 級單例
export const { db, sql } = createDb();
```

2. 連線池要單例

0.4 多了 auth.ts 這個消費者。兩邊各叫一次 createDb() 就是兩個池：Better Auth 寫進去的資料在另一個池的 transaction 裡看不到，而且 SIGTERM 時 sql.end() 只關得掉其中一個。連線是 process 級別的資源，就在 process 級別建一次。

## Better Auth

1. adapter 在 1.5 之後被拆成獨立套件

`better-auth/adapters/drizzle` 是舊路徑。現在是 `@better-auth/drizzle-adapter`，要另外裝。CLI 也換了 npm 名稱：`auth`（1.6.25），不是停在 1.4 的 `@better-auth/cli`。

2. CLI 需要 .env，但 pnpm 的 .bin/ 是 shell wrapper

`node --env-file=... ./node_modules/.bin/auth` 會炸 `SyntaxError: missing ) after argument list`——node 拿到的是 sh 腳本不是 JS。要指到真正的進入點：

```jsonc
// apps/server/package.json
"auth:generate": "node --env-file-if-exists=../../.env node_modules/auth/dist/index.mjs generate --config src/auth.ts --output ../../packages/db/src/schema/auth.ts -y"
```

（CLI 用 jiti 載 `src/auth.ts`，所以它會真的執行到 `createDb()`，DATABASE_URL 非有不可。）

3. 掛進 Fastify 有兩個非踩不可的坑

**body 不能讓 Fastify 先解析。** 官方範例是把解析過的 `request.body` 再 `JSON.stringify` 回去，但沒有 body 的 POST（sign-out）會先被 `FST_ERR_CTP_EMPTY_JSON_BODY` 擋掉。解法是在獨立的 `register` scope 內換掉 content type parser——parser 是被 encapsulate 的，只影響那個 scope：

```ts
scope.removeAllContentTypeParsers();
scope.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
```

**set-cookie 要逐條搬。** `Headers.forEach` 把多筆 set-cookie 併成一個逗號分隔的字串，瀏覽器只認第一條。`getSetCookie()` 才拿得到陣列，而 Fastify 的 `reply.header("set-cookie", …)` 呼叫多次會自己累積：

```ts
for (const cookie of response.headers.getSetCookie()) reply.header("set-cookie", cookie);
```

不是理論問題：`rememberMe: false` 的 sign-in 一次就會下 `session_token` 與 `dont_remember` 兩條。

4. secret 缺了不會報錯，只會很難查

Better Auth 缺 `BETTER_AUTH_SECRET` 時自己生一組隨機值、印個警告就過了。現象是「每次重啟 server 所有人的 session 都失效」。所以 auth.ts 選擇缺了就直接丟錯。

5. 它自己有 CSRF 保護

不帶 `Origin` 的 `POST /api/auth/sign-out` 回 `403 MISSING_OR_NULL_ORIGIN`；帶了 `trustedOrigins` 內的來源才過。sign-up / sign-in 不受此限。用 curl 測的時候看到 403 先確認是不是少了 `-H 'origin: ...'`。
