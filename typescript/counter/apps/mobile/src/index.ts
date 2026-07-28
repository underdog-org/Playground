import { registerRootComponent } from "expo";

// 註冊的是 Root（外面包了 QueryClientProvider），不是裸的 App
import Root from "./root.tsx";

registerRootComponent(Root);
