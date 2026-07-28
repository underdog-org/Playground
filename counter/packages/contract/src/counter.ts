import { z } from "zod";

//注意 min(0) 只寫了一次。 server 拿它做執行期驗證（擋掉惡意請求）
// web 和 mobile 拿 Counter 這個型別做編譯期檢查。
export const CounterSchema = z.object({
  count: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});

export const UpdateCounterSchema = z.object({
  count: z.number().int().min(0),
});

export type Counter = z.infer<typeof CounterSchema>;
export type UpdateCounter = z.infer<typeof UpdateCounterSchema>;
