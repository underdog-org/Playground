// 整個 process 只建一次連線池。
//
// 0.4 之前 index.ts 自己呼叫 createDb()，現在多了 auth.ts 這個消費者：
// 兩邊各叫一次的話會開出兩個連線池，Better Auth 寫進去的資料在另一個池的
// transaction 裡看不到，而且 tsx watch 重載時 sql.end() 只關得掉其中一個。
// 連線是 process 級別的資源，所以在 process 級別建一次。
//
// DATABASE_URL 沒設的話這裡就會擋下來（見 @ims/db 的 requireDatabaseUrl），
// 而不是等到第一個查詢進來才發現。process.env 由 dev script 的 --env-file 填。

import { createDb } from "@ims/db";

export const { db, sql } = createDb();
