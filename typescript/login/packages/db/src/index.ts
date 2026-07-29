// @ims/db —— 唯一的 schema 與連線來源（見 ARCHITECTURE §9）。
//
// 這裡沒有業務邏輯。資料庫裡有兩塊領土，在檔案層級就分開放（見 ARCHITECTURE §3）：
//
//   src/schema/auth.ts   Better Auth CLI 產生，不手改，只用 additionalFields 擴充
//   src/schema/*.ts      自有領土：product / permission / role / plan / seat / audit_log
//   src/client.ts        drizzle 連線
//
// 0.4 起由 Better Auth CLI 產生 auth.ts，Stage 2+ 開始長出自有領土的表。

export { createDb, type Database } from "./client.ts";
export { requireDatabaseUrl } from "./env.ts";
export * as schema from "./schema/index.ts";
