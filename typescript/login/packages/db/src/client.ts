import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireDatabaseUrl } from "./env.ts";
import * as schema from "./schema/index.ts";

export function createDb(connectionString: string = requireDatabaseUrl()) {
  // prepare: false —— postgres.js 預設會用 prepared statement，
  // 之後若擺在 PgBouncer 的 transaction pooling 後面會直接壞掉。開發階段先關著，
  // 省得日後上了 pooler 才發現，而且這裡的查詢量根本吃不到 prepared 的好處。
  const sql = postgres(connectionString, { prepare: false });

  // 傳 schema 進去才有 db.query.<table> 這種 relational query API；
  // 少了它就只剩 db.select()。0.4 之後 schema 有內容時差別才看得出來。
  return { db: drizzle(sql, { schema }), sql };
}

export type Database = ReturnType<typeof createDb>["db"];
