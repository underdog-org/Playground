// Better Auth 實例。這是「Better Auth 領土」的唯一設定點（見 ARCHITECTURE §3）。
//
// Stage 0.4 的範圍刻意很小：只有 email + password，**不掛任何會動到 schema 的 plugin**。
// organization / oidcProvider 是 0.5 spike 與 Stage 1+ 的事，提早掛上會讓
// 產生出來的 schema 混進還沒想清楚的表，之後要拆更麻煩。
//
// openAPI() 是這條規則的例外，因為它不屬於那個風險：它沒有 schema 欄位、
// 不新增任何表，`pnpm auth:generate` 的產出不會因為它而改變。它做兩件事——
// 掛上 /api/auth/reference 說明頁，以及提供 auth.api.generateOpenAPISchema()，

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";

import { db } from "./db.ts";

// 缺變數要早死，訊息要講清楚該做什麼——同 @ims/db 的 requireDatabaseUrl。
// 特別是 secret：Better Auth 在缺少時會自己生一組隨機值並只印個警告，
// 那會導致「每次重啟 server，所有人的 session 都失效」這種很難查的現象。
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} 未設定。請從 .env.example 複製一份 .env（產生 secret：openssl rand -base64 32）`,
    );
  }
  return value;
}

export const auth = betterAuth({
  secret: required("BETTER_AUTH_SECRET"),
  baseURL: required("BETTER_AUTH_URL"),

  // schema 由 @ims/db 提供（createDb 已經把 schema 傳給 drizzle），
  // adapter 直接從 db 身上讀得到表，這裡不必再傳一次。
  // 1.5 起 adapter 拆成獨立套件，所以是 @better-auth/drizzle-adapter 而非 better-auth/adapters/drizzle。
  database: drizzleAdapter(db, { provider: "pg" }),

  emailAndPassword: {
    enabled: true,
    // 先不要求驗證過才能登入：0.4 的驗收是「能註冊、能登入、能取得 session」，
    // 而信件現在只印在 console。Stage 2 接上真的 MailPort 之後再打開。
    requireEmailVerification: false,
  },

  emailVerification: {
    sendOnSignUp: true,
    // D9：真正的寄送走 MailPort 介面（Stage 2 的 Mailpit adapter）。
    // 現在先印出來，重點是讓「有這個流程」這件事在 0.4 就看得見。
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[mail:stub] verification → ${user.email}\n  ${url}`);
    },
  },

  // 帶 cookie 的跨 origin 請求，來源必須在這份清單裡，否則 Better Auth 會拒收。
  // 對應 index.ts 的 CORS 設定（origin: true + credentials: true）。
  trustedOrigins: [
    "http://localhost:5173", // apps/web (vite)
    "http://localhost:8081", // apps/mobile (expo)
    ...(process.env.LAN_URL ? [process.env.LAN_URL] : []),
  ],

  plugins: [openAPI()],
});
