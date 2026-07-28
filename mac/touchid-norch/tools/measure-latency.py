#!/usr/bin/env python3
"""量測 unified log 事件從產生到抵達 log stream 的延遲。"""
import json
import sys
import time
from datetime import datetime

# 要關注的四個 TouchID 生命週期事件，按發生順序列出
KEYS = (
    "will start matching",
    "has received finger-on",
    "has matched",
    "has received finger-off",
)

print("等待 TouchID 事件… (Ctrl-C 結束)", file=sys.stderr)

samples = []
while True:
    # 手動 readline() 而非 for-in 迭代，避免 Python 內部 read-ahead buffer
    # 導致 time.time() 取的接收時間與實際讀取瞬間有落差
    line = sys.stdin.readline()
    if not line:
        break
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        rec = json.loads(line)
    except json.JSONDecodeError:
        continue

    msg = rec.get("eventMessage", "")
    # 找出這行屬於哪個 TouchID 階段
    label = next((k for k in KEYS if k in msg), None)
    if label is None:
        continue

    # 記錄接收到 log 的瞬間（儘量貼近 readline 之後） = 終點
    recv = time.time()
    # 從 log 的 timestamp 欄位解析事件實際發生時間 = 起點
    emitted = datetime.strptime(
        rec["timestamp"], "%Y-%m-%d %H:%M:%S.%f%z"
    ).timestamp()
    # 延遲 = 接收時間 - 事件發生時間（毫秒）
    delta_ms = (recv - emitted) * 1000
    samples.append(delta_ms)
    # stdout 輸出單筆量測結果，stderr 輸出累計統計（使用 flush 確保即時顯示）
    print(f"{delta_ms:8.1f} ms   {label}", flush=True)
    print(f"           n={len(samples)} 平均={sum(samples)/len(samples):.1f} "
          f"最大={max(samples):.1f}", file=sys.stderr, flush=True)

