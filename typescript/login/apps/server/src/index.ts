// 程序進入點：只負責啟動與關閉。App 的組裝在 app.ts（那邊也被 scripts/openapi.ts 用）。

import { buildApp, PORT } from "./app.ts";
import { sql } from "./db.ts";

const app = await buildApp();

// 0.0.0.0 而非預設的 127.0.0.1，否則實體手機從區網連不進來
await app.listen({ port: PORT, host: "0.0.0.0" });

// 收到 SIGINT/SIGTERM 時要把連線池關掉，否則 tsx watch 每次重載都留一批
// 連線給 Postgres，開發幾十次之後會撞到 max_connections。
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await app.close();
      await sql.end();
      process.exit(0);
    })();
  });
}
