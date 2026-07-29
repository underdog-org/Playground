import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // globals 開著，測試檔不必逐一 import describe/it/expect。
    // tsconfig 的 types 要對應加上 "vitest/globals"，否則型別找不到。
    globals: true,
    include: ["src/**/*.test.ts"],
    // Stage 0 還沒有測試檔，不讓 `pnpm test` 因此變紅。
    // Stage 3 寫進第一個交集測試後就移除這行——那之後「沒有測試」應該是錯誤。
    passWithNoTests: true,
  },
});
