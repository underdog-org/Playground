import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { injectTokens } from "@counter/design/css";
import { QueryClient } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
// sync 版整包已廢棄；async 版的 storage 型別用 MaybePromise，同步的 localStorage 也吃
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

injectTokens();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // gcTime 必須 >= persister 的 maxAge，否則快取先被回收、還原不出東西
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

const persister = createAsyncStoragePersister({ storage: window.localStorage });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
);
