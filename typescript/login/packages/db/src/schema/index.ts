// 兩塊領土的匯出點（見 ARCHITECTURE §3）。
//
// auth.ts 由 Better Auth CLI 產生（apps/server 的 `pnpm auth:generate`），**不手改**。
// 要加欄位就去 apps/server/src/auth.ts 寫 additionalFields，再重跑一次產生器——
// 直接改這裡的話，下次產生就被蓋掉，而且 Better Auth 的 adapter 也不知道有這個欄位。
//
// Stage 2 起：export * from "./product.ts"; … ← 自有領土

export * from "./auth.ts";
