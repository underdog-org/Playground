import { defineConfig } from "drizzle-kit";

// drizzle-kit 是被 CLI 直接叫起來的，沒有地方掛 node 的 --env-file，
// 所以這裡自己載。Node 20.12+ 內建 loadEnvFile，不必為了這件事裝 dotenv。
// 路徑相對於 cwd（pnpm script 會把 cwd 設在 packages/db）。
process.loadEnvFile("../../.env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // 這裡不用 requireDatabaseUrl()：drizzle.config.ts 不在 tsconfig 的 src 底下，
    // 走 .ts import 會讓 drizzle-kit 的載入路徑變複雜。少一層間接換設定檔能獨立跑。
    url: process.env.DATABASE_URL!,
  },
  // migration 檔進版控、人看得懂、可 review。
  // 對照 push：push 直接改資料庫、不留檔案，適合玩 schema，但沒有歷史可追。
  // 認證系統的 schema 變更需要能講清楚「什麼時候改了什麼」，所以走 generate + migrate。
  verbose: true,
  strict: true,
});
