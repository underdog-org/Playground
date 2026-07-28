// 實體手機／模擬器連不到開發機的 localhost，正式跑起來要在 apps/mobile/.env
// 設 EXPO_PUBLIC_API_URL 成開發機的區網 IP（見 .env.example）。
// 這裡的 fallback 只是讓專案在沒設定時仍能啟動，不是可用的預設值。
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
