// 產生 docs/openapi.json：Fastify 的 zod schema + Better Auth 的認證路由，合併成一份。
//
// 為什麼要合併：index.ts 的 /api/auth/* 是 catch-all 且 schema.hide，所以
// @fastify/swagger 完全看不到認證路由。Better Auth 自己知道它有哪些 endpoint，
// 由 openAPI() plugin 的 generateOpenAPISchema() 吐出來——它的 path 是相對於
// /api/auth 的（例如 /sign-up/email），所以合併時要補上前綴。
//
// 不需要 DB：postgres.js 的連線池是 lazy 的，buildApp() 到 ready() 都不會真的連線。
// CI 只要有 DATABASE_URL / BETTER_AUTH_* 這些變數存在（值可以是假的）就跑得動。

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { buildApp } from "../src/app.ts";
import { auth } from "../src/auth.ts";
import { sql } from "../src/db.ts";

const AUTH_PREFIX = "/api/auth";
const out = path.join(import.meta.dirname, "../docs/openapi.json");

const app = await buildApp({ logger: false });
await app.ready();

const spec = app.swagger() as Record<string, any>;
const authSpec = (await auth.api.generateOpenAPISchema()) as Record<string, any>;

// bru import 用 summary 當檔名。Better Auth 的 spec 裡 summary / operationId
// 有的有有的沒有，直接餵進去會產出「signInEmail.yml」與「Check if the API is
// working.yml」並存、甚至 fallback 成「get -api-auth-callback--id.yml」的檔名。
// 統一改成 operationId（缺的話從 path 推），原本的 summary 移到 description，
// 在 Bruno 裡仍看得到說明。只處理認證路由——自有路由的 summary 是手寫的。
function operationName(p: string, method: string, op: Record<string, any>): string {
  if (op.operationId) return op.operationId;
  const camel = p
    .split("/")
    .filter(Boolean)
    .flatMap((seg) => seg.replace(/[{}]/g, "").split("-"))
    .map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join("");
  return `${method}${camel[0]!.toUpperCase()}${camel.slice(1)}`;
}

// Better Auth 的 operation 各自帶著自己的 tag，直接沿用會讓 Bruno 產出一堆
// 語意不明的資料夾（"Default" 之類）。統一收進 auth 這個 tag，collection 裡
// 就是「meta/ 與 auth/」兩個資料夾，跟這個專案目前的規模相稱。
for (const [p, item] of Object.entries(authSpec.paths ?? {})) {
  const operations = item as Record<string, any>;
  for (const method of Object.keys(operations)) {
    const op = operations[method];
    if (!op || typeof op !== "object") continue;
    op.tags = ["auth"];
    const name = operationName(p, method, op);
    if (op.summary && op.summary !== name) op.description ??= op.summary;
    op.summary = name;
  }
  spec.paths[`${AUTH_PREFIX}${p}`] = operations;
}

// securitySchemes 是 Better Auth 那份才有的（cookie / bearer），合併時要一起帶過來，
// 否則 operation 上的 security 參照會指向不存在的定義。
spec.components ??= {};
for (const key of ["schemas", "securitySchemes"] as const) {
  if (authSpec.components?.[key]) {
    spec.components[key] = { ...spec.components[key], ...authSpec.components[key] };
  }
}

await writeFile(out, `${JSON.stringify(spec, null, 2)}\n`);
console.log(
  `[openapi] wrote ${path.relative(process.cwd(), out)} (${Object.keys(spec.paths).length} paths)`,
);

await app.close();
await sql.end();
