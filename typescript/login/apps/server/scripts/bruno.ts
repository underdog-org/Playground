// docs/openapi.json → Bruno collection（api/）。
//
// 三個 bru import 的行為決定了這支為什麼不是一行 shell：
//
// 1. 輸出目錄「已存在」時，bru 不會就地覆蓋，而是在裡面建一個以 collection 名稱
//    命名的子目錄（api/IMS API/…）。所以一定要先 import 到一個全新的暫存目錄。
// 2. bru 會從 spec 的 servers[] 產生 environments/，蓋掉 api/environments/。
//    lan.yml 的區網 IP 是手填的，不能被產生器碰——所以只搬 tag 資料夾。
// 3. tag 改名時，舊資料夾不會自己消失。用 manifest 記住上次產了哪些資料夾，
//    下次先刪掉，才不會留下孤兒。

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const serverDir = path.join(import.meta.dirname, "..");
const spec = path.join(serverDir, "docs/openapi.json");
const collection = path.join(serverDir, "api");
const manifestPath = path.join(serverDir, "docs/bruno-generated.json");

if (!existsSync(spec)) {
  throw new Error(`找不到 ${spec}——請先執行 pnpm --filter @ims/server api:openapi`);
}

// -o 指到一個尚不存在的路徑，避開上面第 1 點的巢狀行為
const tmp = path.join(mkdtempSync(path.join(os.tmpdir(), "ims-bruno-")), "collection");

const result = spawnSync(
  "bru",
  ["import", "openapi", "-s", spec, "-o", tmp, "-n", "IMS API", "-g", "tags"],
  { stdio: "inherit", shell: false, cwd: serverDir },
);
if (result.status !== 0) {
  throw new Error(`bru import 失敗（exit ${result.status}）`);
}

// 上次產生的資料夾先清掉（處理 tag 改名）
const previous: string[] = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8")).folders
  : [];
for (const name of previous) {
  rmSync(path.join(collection, name), { recursive: true, force: true });
}

// 只搬 tag 資料夾：environments/ 與 opencollection.yml 是手寫領土
const folders = readdirSync(tmp, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "environments")
  .map((e) => e.name);

for (const name of folders) {
  cpSync(path.join(tmp, name), path.join(collection, name), { recursive: true });
}

writeFileSync(manifestPath, `${JSON.stringify({ folders: folders.sort() }, null, 2)}\n`);
rmSync(path.dirname(tmp), { recursive: true, force: true });

console.log(`[bruno] synced ${folders.length} folder(s): ${folders.join(", ")}`);
