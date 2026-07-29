// @ims/contract —— 自有管理 API 的 zod schema 與 typed client。
//
// 範圍刻意很小（見 ARCHITECTURE §9）：認證相關的 client 由 better-auth/client 提供，
// OIDC 流程走標準協定，兩者都不需要在這裡定義。
// 這裡只放自有領土的管理 API：org 管理、role 指派、seat 指派、audit 查詢。
// Stage 2 之後才會有內容。

export {};
