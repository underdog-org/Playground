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

const PORT = Number(process.env.PORT ?? 3000);

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

// 唯一的路由：讓「server 起得來、docs 打得開」有東西可驗。
// Stage 0.3 之後這裡要加上 DB 連線檢查。
app.get(
  "/health",
  {
    schema: {
      operationId: "health",
      summary: "存活檢查",
      tags: ["meta"],
      response: { 200: z.object({ status: z.literal("ok") }) },
    },
  },
  () => ({ status: "ok" as const }),
);

// 0.0.0.0 而非預設的 127.0.0.1，否則實體手機從區網連不進來
await app.listen({ port: PORT, host: "0.0.0.0" });
