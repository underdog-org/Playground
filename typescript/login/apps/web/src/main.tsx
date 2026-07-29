import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { injectTokens } from "@ims/design/css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

injectTokens();

// 刻意不做 query 持久化：cache 會裝使用者與組織資料，落到 localStorage 等於明文儲存，
// 登出時還得記得清乾淨。counter 時期為了離線體驗才裝 persist-client，本專案不需要。
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
