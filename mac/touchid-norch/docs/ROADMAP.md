# touchid-norch

在 MacBook 瀏海顯示 TouchID 微動畫的 macOS App。Alcove 風格 UI，動畫用 Lottie，
偵測時機用 Unified log 串流。

## 已確定的決策

| 項目 | 決定 |
|---|---|
| 觸發方案 | **A — Unified log 串流**（不做 PAM module，不做 Accessibility） |
| 動畫 | Lottie，**單一 `touchid.json` + markers** |
| 動畫顆粒度 | 跟手指走：待命呼吸 → finger-on 掃描 → matched 成功 → 收起 |
| 展開形態 | 瀏海下方長出黑色圓角膠囊（Alcove 式），spring 展開 |
| 觸發範圍 | 全部來源，鎖定畫面期間靜音 |
| 專案形式 | **SPM executable，CLI 建立，不開 Xcode** |
| Deployment target | **macOS 26.0** |
| 外接螢幕 | 不支援，只在內建瀏海螢幕 |
| 無瀏海機器 | 不支援，啟動偵測後提示退出 |
| 設定 UI | 無。選單列只有「測試動畫」與「結束」 |
| 滑鼠事件 | 不接，`ignoresMouseEvents = true` |

## 已驗證的事實（2026-07-28 於本機 macOS 26.5.2 實測）

- unified log 以一般帳號即可讀取，不需 root、不需 entitlement
- `log stream` 以非 root 啟動成功
- 觸發來源涵蓋 `loginwindow`（螢幕解鎖）與一般 App，代表系統層驗證都看得到
- 關鍵事件（subsystem `com.apple.LocalAuthentication`，category `Server,Interactive,Biometry`）
  構成完整狀態機，**不只 start/stop**：

  | log 字串 | 語意 |
  |---|---|
  | `MechanismTouchId[N] starting` | 感測器待命 |
  | `MechanismTouchId[N](run) will start matching user <uid>` | 開始等手指 |
  | `MechanismTouchId[N](run) has received finger-on` | 手指碰上去 |
  | `MechanismTouchId[N](run) has matched by <private> (unlocked:1` | 比對成功 |
  | `MechanismTouchId[N](run) has received finger-off` | 手指移開 |
  | `MechanismTouchId[N](run) has finished with Error ... Code=-9` | 取消 |
  | `MechanismTouchId[N](run)> dropped (mechanism finished)` | 收尾 |

- 解析注意：同一時間會有多個 `MechanismTouchId[N]` 併發（來自不同 coreauthd instance，
  例如 pid 591 與 697），需以 `[N]` 分組追蹤，不能只看字串出現
- `MechanismTouchId` 各行由 `coreauthd` 印出，**不含發起者 PID**（PID 只出現在
  `LAAssertions` category）→ 因此不用 PID 過濾，改用鎖定狀態靜音

## 已知限制

- 螢幕鎖定解鎖：**訊號拿得到，但畫不出來**（lock screen shield 在所有 window level 之上）
- 開機登入畫面：App 沒在跑，完全無解
- log 字串未文件化，macOS 大版本更新可能失效 → 需要 self-test 預警
- 不可能上架 App Store（sandbox 不能 spawn `log`）

## 實作步驟

### Step 0 — 延遲實測（阻斷性）✅ 通過
- [x] 量測 log 事件從產生到抵達串流的延遲
- [x] **結果：n=12，平均 2.2ms，最大 8.1ms** —— 比 80ms 門檻低一個數量級，
      感知上等於零延遲。方案可行，無需 fallback。
- 量測工具保留於 `tools/measure-latency.py`，macOS 大版本更新後可重跑驗證

### Step 1 — 專案骨架
- [ ] `swift package init --type executable`
- [ ] Package.swift 設定 macOS 26 平台 + Lottie 依賴
- [ ] 最小 NSApplication + `setActivationPolicy(.accessory)`，確認能跑

### Step 2 — BiometricEventStream（無 UI，可測）
- [ ] 錄製 ndjson fixture
- [ ] LineBuffer 跨 chunk 半行處理
- [ ] regex parser → `BiometricEvent`
- [ ] 依 `[N]` 分組追蹤
- [ ] 單元測試（不需按指紋）

### Step 3 — NotchWindow
- [ ] NSScreen 瀏海幾何計算
- [ ] borderless window + level / collectionBehavior
- [ ] 靜態黑色膠囊，先不接動畫

### Step 4 — AnimationController
- [ ] Lottie 整合，markers 播放控制
- [ ] 狀態機 + 單元測試

### Step 5 — 串接與韌性
- [ ] NotchCoordinator 串三者
- [ ] 鎖定狀態靜音（`com.apple.screenIsLocked` / `screenIsUnlocked`）
- [ ] log process 重連（指數退避 1s → 30s）
- [ ] 啟動 self-test + 選單列警告
- [ ] 15s watchdog

## 參考

- 開源瀏海 App：boring.notch（SwiftUI, MIT）、NotchNook、DynamicLake
- `NSScreen.safeAreaInsets` / `auxiliaryTopLeftArea` / `auxiliaryTopRightArea`（macOS 12+）
