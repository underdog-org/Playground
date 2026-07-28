import { View, Text, StyleSheet, Pressable } from "react-native";
import { color, space } from "@counter/design";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.ts";

import type { Counter } from "@counter/contract";

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
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => mutate(current() + 1)}>
          <Text style={styles.buttonText}>Increment</Text>
        </Pressable>
        <Text style={styles.count}>{count}</Text>
        <Pressable
          style={styles.button}
          // 夾在 0：server 的 schema 是 min(0)，送負數會 400 然後回退，畫面會閃
          onPress={() => mutate(Math.max(0, current() - 1))}
        >
          <Text style={styles.buttonText}>Decrement</Text>
        </Pressable>
      </View>
      <Pressable style={styles.resetButton} onPress={() => mutate(0)}>
        <Text style={styles.buttonText}>Reset</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: space.md, // 順便解決按鈕貼在一起
    backgroundColor: color.bgPage,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  button: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 8,
    backgroundColor: color.bgAccent,
  },
  resetButton: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: 8,
    backgroundColor: color.btnAccent,
  },
  buttonText: { color: color.textOnAccent },
  // 數字不在 accent 底色上，用白字會看不見
  count: { color: color.textPrimary },
});
