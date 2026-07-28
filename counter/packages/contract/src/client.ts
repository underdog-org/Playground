import { CounterSchema, type Counter } from "./counter.ts";

export function createCounterClient(baseUrl: string) {
  const url = `${baseUrl}/api/counter`;

  async function parse(res: Response): Promise<Counter> {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return CounterSchema.parse(await res.json());
  }

  return {
    get: async () => parse(await fetch(url)),
    put: async (count: number) =>
      parse(
        await fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ count }),
        })
      ),
  };
}
