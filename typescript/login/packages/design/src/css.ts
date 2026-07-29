import { color } from "./tokens";

// Object.entries(color) = 把 Object (color) 轉換成： Array
// { bgAccent: "#6366f1", textPrimary: "#111827" }
//   ↓
// [ ["bgAccent", "#6366f1"], ["textPrimary", "#111827"] ]
export function injectTokens() {
  Object.entries(color).forEach(([k, v]) =>
    // 先獲取html, 然後再設定style `<html style="--color-bgAccent: #6366f1">\
    // k = key (變數名稱), v = value (實際Hex Code)
    document.documentElement.style.setProperty(`--color-${k}`, v),
  );
}
