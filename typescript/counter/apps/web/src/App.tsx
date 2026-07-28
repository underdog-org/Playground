import type { Counter } from "@counter/contract";
import { api } from "./api.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function App() {
  const { data } = useQuery({
    queryKey: ["counter"],
    queryFn: () => api.get(),
  });

  const count = data?.count ?? 0;
  const qc = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (n: number) => api.put(n),

    onMutate: async (n) => {
      // 取消進行中的 refetch，否則它回來會蓋掉我們的樂觀值
      await qc.cancelQueries({ queryKey: ["counter"] });
      const prev = qc.getQueryData<Counter>(["counter"]);
      qc.setQueryData<Counter>(["counter"], (old) =>
        old ? { ...old, count: n } : old
      );
      return { prev }; // 這個 return 就是回退用的快照
    },

    onError: (_err, _n, ctx) => {
      if (ctx?.prev) qc.setQueryData(["counter"], ctx.prev);
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["counter"] });
    },
  });

  // 連點時 count 這個變數會是同一批 render 的舊值；cache 才是最新的
  // （onMutate 已經把樂觀值寫進去了）
  const current = () => qc.getQueryData<Counter>(["counter"])?.count ?? 0;

  return (
    <div className="counter">
      <div className="counter_row">
        <button className="btn" onClick={() => mutate(current() + 1)}>
          Increment
        </button>
        <span className="count">{count}</span>
        <button
          className="btn"
          // 夾在 0：server 的 schema 是 min(0)，送負數會 400 然後回退，畫面會閃
          onClick={() => mutate(Math.max(0, current() - 1))}
        >
          Decrement
        </button>
      </div>
      <button className="reset_btn" onClick={() => mutate(0)}>
        Reset
      </button>
    </div>
  );
}
