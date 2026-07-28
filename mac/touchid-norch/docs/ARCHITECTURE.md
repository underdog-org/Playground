# 架構設計

## 1. 架構：四個單元

| 單元                   | 職責                                 | 依賴            | 可測性          |
| ---------------------- | ------------------------------------ | --------------- | --------------- |
| `BiometricEventStream` | 跑 `log stream`、解析 ndjson、吐事件 | Foundation only | ✅ 純單元測試   |
| `AnimationController`  | 狀態機 + Lottie 播放                 | Lottie          | ✅ 狀態轉換可測 |
| `NotchWindow`          | 瀏海幾何 + 視窗生命週期              | AppKit          | ⚠️ 手動驗證     |
| `NotchCoordinator`     | 串接三者 + 鎖定靜音                  | 以上            | ⚠️ 整合測試     |

關鍵邊界：`BiometricEventStream` **完全不碰 AppKit**，所以可以餵錄好的 ndjson fixture 做無頭測試，不用真的按指紋。這是整包最容易寫錯的部分，必須可測。

## 2. 資料流

```
/usr/bin/log stream --style ndjson --predicate '...'
      │ stdout (Pipe.readabilityHandler)
      ▼
LineBuffer            跨 chunk 的半行緩衝
      │ 完整 JSON 行
      ▼
BiometricLogParser    regex → 依 MechanismTouchId[N] 分組
      │ BiometricEvent
      ▼
NotchCoordinator      鎖定中？→ 丟棄
      │
      ├──► NotchWindow.show() / .hide()
      └──► AnimationController.transition(.scanning)
```

## 3. 事件模型

```swift
enum BiometricEvent {
    case matching(id: Int)    // "MechanismTouchId[N](run) will start matching user"
    case fingerOn(id: Int)    // "has received finger-on"
    case fingerOff(id: Int)   // "has received finger-off"
    case matched(id: Int)     // "has matched by <private> (unlocked:1"
    case finished(id: Int)    // "has finished with" / "dropped (mechanism finished)"
}
```

`id` 用來分組併發的驗證（log 裡確實會同時有多組）。Coordinator 只追蹤**第一個進入 `matching` 的 id**，其餘忽略 —— 瀏海只有一個，不需要處理併發顯示。

## 4. 動畫狀態機

```
hidden ──matching──► breathing ──fingerOn──► scanning
  ▲                      ▲                      │
  │                      └───── fingerOff ──────┤
  │                                             │ matched
  │                                             ▼
  └──────── dismiss ◄──────────────────────── success

任何狀態 + finished → dismiss
breathing 停留 > 15s → dismiss（watchdog 保險）
```

對應 Lottie markers：`breathe`（loop）/ `scan` / `success` / `dismiss`。

## 5. 瀏海視窗

```swift
window.styleMask = .borderless
window.level = .statusBar
window.backgroundColor = .clear
window.isOpaque = false
window.hasShadow = false
window.ignoresMouseEvents = true          // 純顯示，不接互動
window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
```

幾何取自內建螢幕：`auxiliaryTopLeftArea` 與 `auxiliaryTopRightArea` 之間的空缺即瀏海本體，膠囊寬度 = 瀏海寬 + 兩側各留一段。展開用 SwiftUI spring，不用 Lottie。

## 6. 錯誤處理

- `log` process 掛掉 → 指數退避重連（1s → 30s 上限）
- **啟動 self-test**：`log show --last 24h` 掃歷史事件，比對到 0 筆就在選單列顯示警告 —— 這是 macOS 更新改掉字串時唯一的預警
- 動畫卡死 → 全域 15s watchdog 強制 dismiss
- 無瀏海機器 → 啟動時偵測，提示後退出

## 7. 測試

| 對象     | 方式                                                  |
| -------- | ----------------------------------------------------- |
| Parser   | 錄一份真實 ndjson fixture，斷言事件序列。不需 TouchID |
| 狀態機   | 餵事件序列，斷言狀態與 Lottie marker 呼叫             |
| 視窗幾何 | 手動                                                  |
| 端到端   | 手動按指紋                                            |

