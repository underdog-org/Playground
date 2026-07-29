import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App.tsx";

// 與 web 一致：不做 query 持久化。cache 會裝使用者與組織資料，
// 落到 AsyncStorage 是明文儲存，登出時還得記得清乾淨。
const queryClient = new QueryClient();

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
