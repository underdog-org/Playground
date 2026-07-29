// Drizzle schema → DBML。產物 docs/schema.dbml 貼到 dbdiagram.io 就有 ER 圖。
//
// 這支是唯一真相來源：pre-commit hook 與 CI 的一致性檢查都只呼叫
// `pnpm --filter @ims/db db:dbml`，不各自複製一份邏輯。
//
// 路徑以 import.meta.dirname 為錨點而非 cwd——不管從 repo 根、packages/db
// 還是 git hook 裡呼叫，產物都落在同一個地方。

import path from "node:path";
import { pgGenerate } from "drizzle-dbml-generator";
import * as schema from "../src/schema/index.ts";

const out = path.join(import.meta.dirname, "../docs/schema.dbml");

// relational: true → 讀 relations()，user ← session / account 的關聯線才畫得出來。
pgGenerate({ schema, out, relational: true });

console.log(`[dbml] wrote ${path.relative(process.cwd(), out)}`);
