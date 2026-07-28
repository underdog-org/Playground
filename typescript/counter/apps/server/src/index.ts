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

import { CounterSchema, UpdateCounterSchema } from "@counter/contract";

import * as store from "./store.ts";

const PORT = Number(process.env.PORT ?? 3000);

// 初始化App
const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// 少了這兩行，schema 會被完全忽略 —— 不會報錯，只是驗證靜默失效
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// 註冊 App (非同步）
// 註冊順序是最容易踩的坑: Swagger -> UI -> CORS
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Counter API",
      version: "1.0.0",
    },
    // 匯入工具（Bruno、Postman）靠 servers 決定 base URL，沒有的話會出錯
    // 手機要連的話再把開發機的區網 IP 加進 LAN_URL（見 apps/mobile/.env.example）
    servers: [
      { url: `http://localhost:${PORT}`, description: "local" },
      ...(process.env.LAN_URL
        ? [{ url: process.env.LAN_URL, description: "lan (mobile)" }]
        : []),
    ],
  },
  // 重要：它把你的 zod schema 轉成 OpenAPI 的 JSON Schema。
  transform: jsonSchemaTransform,
});

//  Scalar 的選項是 routePrefix，不是 routePath。我去翻了 @scalar/fastify-api-reference@1.63.0 的型別定義確認
await app.register(ScalarApiReference, { routePrefix: "/docs" });

// @fastify/cors 的預設 methods 只有 GET,HEAD,POST —— 不寫的話 PUT 會被瀏覽器擋掉
await app.register(cors, { origin: true, methods: ["GET", "PUT"] });

app.get(
  "/api/counter",
  {
    schema: {
      operationId: "getCounter",
      summary: "讀取目前計數",
      tags: ["counter"],
      response: { 200: CounterSchema },
    },
  },
  () => store.read()
);

app.put(
  "/api/counter",
  {
    schema: {
      operationId: "updateCounter",
      summary: "修改目前計數",
      tags: ["counter"],
      body: UpdateCounterSchema,
      response: { 200: CounterSchema },
    },
  },
  // req.body 的型別由 schema 推導出來，不用手動標註
  (req) => store.write(req.body.count)
);

// 0.0.0.0 而非預設的 127.0.0.1，否則實體手機從區網連不進來
await app.listen({ port: PORT, host: "0.0.0.0" });
