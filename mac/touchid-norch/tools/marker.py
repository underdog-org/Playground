#!/usr/bin/env python3
"""把 markers 寫進 Lottie JSON。frame 數字用 scrubber 量出來後填在這裡。"""
import json
import sys

PATH = "Sources/TouchIDNotch/Resources/touchid.json"

MARKERS = [
    {"cm": "scan",    "tm": 0,   "dr": 0},   # 指紋開始畫
    {"cm": "success", "tm": 97,  "dr": 0},   # ← 改成你量到的漣漪起點
    {"cm": "end",     "tm": 152, "dr": 0},   # ← 動畫結束
]

data = json.load(open(PATH))
data["markers"] = MARKERS
json.dump(data, open(PATH, "w"), separators=(",", ":"))

print(f"寫入 {len(MARKERS)} 個 markers：")
for m in MARKERS:
    print(f"  {m['cm']:<10} frame {m['tm']}")