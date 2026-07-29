import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { z } from "zod";

import { createDb } from "@ims/db";

const PORT = Number(process.env.PORT ?? 3000);

// 在 Fastify 起來之前先建連線：DATABASE_URL 沒設的話這裡就會擋下來，
// 而不是等到第一個查詢進來才發現。process.env 由 dev script 的 --env-file 填。
// db 現在還沒有人用（schema 是空的），0.4 起 Better Auth 的 adapter 會接上去。
const { db, sql } = createDb();
void db;

// 初始化App
const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// 少了這兩行，schema 會被完全忽略 —— 不會報錯，只是驗證靜默失效
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// 註冊 App (非同步）
// 註冊順序是最容易踩的坑: Swagger -> UI -> CORS
// Stage 0.4 要把 Better Auth 的 handler 也掛進來，順序同樣要當心。
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "IMS API",
      version: "0.0.0",
    },
    // 匯入工具（Bruno、Postman）靠 servers 決定 base URL，沒有的話會出錯
    // 手機要連的話再把開發機的區網 IP 加進 LAN_URL（見 apps/mobile/.env.example）
    servers: [
      { url: `http://localhost:${PORT}`, description: "local" },
      ...(process.env.LAN_URL ? [{ url: process.env.LAN_URL, description: "lan (mobile)" }] : []),
    ],
  },
  // 重要：它把你的 zod schema 轉成 OpenAPI 的 JSON Schema。
  transform: jsonSchemaTransform,
});

//  Scalar 的選項是 routePrefix，不是 routePath。我去翻了 @scalar/fastify-api-reference@1.63.0 的型別定義確認
await app.register(ScalarApiReference, { routePrefix: "/docs" });

// @fastify/cors 的預設 methods 只有 GET,HEAD,POST —— 不寫的話 PUT/DELETE 會被瀏覽器擋掉
// credentials 是認證系統需要的：session cookie 要跨 origin 帶過去。
// 且開了 credentials 就不能用 origin:"*"，只能回實際來源——origin:true 就是這個行為。
await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});

// 唯一的路由：讓「server 起得來、DB 連得上、docs 打得開」有東西可驗。
// 分成 status 與 db 兩個欄位：server 活著但 DB 連不上是**不同**的故障，
// 兩者都回 500 的話，看到的人得自己去猜是哪一種。
app.get(
  "/health",
  {
    schema: {
      operationId: "health",
      summary: "存活檢查",
      tags: ["meta"],
      response: {
        200: z.object({ status: z.literal("ok"), db: z.literal("up") }),
        503: z.object({ status: z.literal("degraded"), db: z.literal("down") }),
      },
    },
  },
  async (_req, reply) => {
    try {
      await sql`select 1`;
      return { status: "ok" as const, db: "up" as const };
    } catch (err) {
      app.log.error({ err }, "health: database unreachable");
      return reply.code(503).send({ status: "degraded" as const, db: "down" as const });
    }
  },
);

// 0.0.0.0 而非預設的 127.0.0.1，否則實體手機從區網連不進來
await app.listen({ port: PORT, host: "0.0.0.0" });

// 收到 SIGINT/SIGTERM 時要把連線池關掉，否則 tsx watch 每次重載都留一批
// 連線給 Postgres，開發幾十次之後會撞到 max_connections。
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await app.close();
      await sql.end();
      process.exit(0);
    })();
  });
}
