// App 的組裝：註冊所有 plugin 與路由，但**不 listen**。
//
// 從 index.ts 抽出來的原因：產生 OpenAPI spec（scripts/openapi.ts）需要一個
// ready 的 app 實例來呼叫 app.swagger()。如果組裝與啟動綁在同一支檔案的
// top-level，import 它就會真的把 server 開起來——CI 裡沒有 DB、也沒有可綁的 port。
//
// 附帶好處：之後要寫 route 測試時，可以 buildApp() + app.inject()，不必開真的 port。

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
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";

import { auth } from "./auth.ts";
import { sql } from "./db.ts";

export const PORT = Number(process.env.PORT ?? 3000);

export async function buildApp({ logger = true }: { logger?: boolean } = {}) {
  // 初始化App
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();

  // 少了這兩行，schema 會被完全忽略 —— 不會報錯，只是驗證靜默失效
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // 註冊 App (非同步）
  // 註冊順序是最容易踩的坑: Swagger -> UI -> CORS -> Better Auth -> 自有路由
  // Better Auth 一定要排在 CORS 之後：它的請求都帶 cookie，preflight 沒被 CORS
  // 接掉的話瀏覽器端會直接失敗，而伺服器這邊什麼錯都看不到。
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

  // ── Better Auth ─────────────────────────────────────────────
  // Better Auth 的 handler 吃的是 Web 標準的 Request、吐 Response，Fastify 用的是
  // Node 的 req/res，所以這一段是兩套介面的轉接層。三個容易踩到的點：
  //
  // 1. body 不能讓 Fastify 先解析。Fastify 預設把 JSON 解成物件，再 stringify 回去
  //    就多繞一圈；更麻煩的是 sign-out 這種沒有 body 的 POST 會被
  //    FST_ERR_CTP_EMPTY_JSON_BODY 直接擋掉。這裡用一個獨立的 register scope 把
  //    content type parser 換成「原封不動收成 Buffer」——parser 是被 encapsulate 的，
  //    只影響這個 scope，/health 那邊照常解析 JSON。
  // 2. set-cookie 要一條一條搬。Headers.forEach 會把多筆 set-cookie 併成一個
  //    逗號分隔的字串，瀏覽器只會認得第一條。getSetCookie() 才拿得到完整陣列，
  //    而 Fastify 的 reply.header("set-cookie", …) 呼叫多次會自己累積成陣列。
  // 3. schema.hide：這是 catch-all 路由，讓它進 OpenAPI 只會變成一條 /api/auth/* 的
  //    假文件。真正的 API 說明由 Better Auth 的 openAPI() plugin 產生，見
  //    /api/auth/reference；Bruno collection 那份也是從同一個來源合併進來的
  //    （scripts/openapi.ts）。
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });

    scope.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      schema: { hide: true },
      async handler(request, reply) {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const body = request.method === "GET" ? undefined : (request.body as Buffer | undefined);

        const response = await auth.handler(
          new Request(url, {
            method: request.method,
            headers: fromNodeHeaders(request.headers),
            ...(body?.length ? { body } : {}),
          }),
        );

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          // content-length 交給 Fastify 依實際送出的內容重算，避免對不上
          if (key === "set-cookie" || key === "content-length") return;
          reply.header(key, value);
        });
        for (const cookie of response.headers.getSetCookie()) {
          reply.header("set-cookie", cookie);
        }

        return reply.send(response.body ? await response.text() : null);
      },
    });
  });

  // 唯一的自有路由：讓「server 起得來、DB 連得上、docs 打得開」有東西可驗。
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

  return app;
}
