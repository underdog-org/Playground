// 這個 package 刻意**不**自己去載 .env。
//
// 誰負責把變數放進 process.env 是呼叫端的事：
//   apps/server    → dev script 的 `tsx --env-file=../../.env`
//   drizzle-kit    → drizzle.config.ts 的 process.loadEnvFile()
// 如果 db 自己偷偷載一份，測試或 CI 想換連線字串時就會發現改不動。
//
// 這裡只做一件事：缺了就當場講清楚，而不是拿 undefined 去連線然後噴一段
// 看不懂的 driver 錯誤。

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL 未設定。\n" +
        "  1. 根目錄執行 `cp .env.example .env`\n" +
        "  2. `docker compose up -d` 起 Postgres\n" +
        "注意：改了 .env 的 DB_USER / DB_PASSWORD 之後，DATABASE_URL 要手動跟著改。",
    );
  }

  return url;
}
