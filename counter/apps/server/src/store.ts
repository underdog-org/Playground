import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type Counter, CounterSchema } from "@counter/contract";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "counter.json");

function initial(): Counter {
  return { count: 0, updatedAt: new Date().toISOString() };
}

export async function read(): Promise<Counter> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    // 檔案可能被手動改壞，或是舊版格式殘留 —— 用同一份 schema 驗證後才回傳
    return CounterSchema.parse(JSON.parse(raw));
  } catch {
    return initial();
  }
}

export async function write(count: number): Promise<Counter> {
  const next: Counter = { count, updatedAt: new Date().toISOString() };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}
