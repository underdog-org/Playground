# touchid-norch

在 MacBook 瀏海顯示 TouchID 微動畫的 macOS App。Alcove 風格 UI，動畫用 Lottie，
偵測時機用 Unified log 串流。

## 已確定的決策

| 項目 | 決定 |
|---|---|
| 觸發方案 | **A — Unified log 串流**（不做 PAM module，不做 Accessibility） |
| 動畫 | Lottie，單一 `touchid.json`，切點以 frame 編號寫在 `TouchIDAnimation` |
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
- [x] ~~`swift package init --type executable`~~直接手寫
- [x] Package.swift 設定 macOS 26 平台 + ~~Lottie 依賴~~
- [x] 最小 NSApplication + `setActivationPolicy(.accessory)`，確認能跑

### Step 2 — BiometricEventStream（無 UI，可測）✅ 完成
- [x] `BiometricLogParser`：ndjson → `BiometricEvent`
- [x] `LineBuffer`：跨 chunk 半行處理，只在換行時解碼 UTF-8
- [x] `BiometricEventStream`：`log stream` 子行程 + 序列佇列保序
- [x] `BiometricSessionTracker`：依 `[N]` 分組、去重、認養
- [x] 27 個單元測試，全部離線（不需按指紋）

**實測補充（macOS 26.5.2）**

- 六種事件字串**全部**位於 category `Server,Interactive,Biometry`，故 predicate 可窄化
- log 會**先後印出兩行終止事件**（`has finished with` 與 `dropped`），必須去重
- `matched` 與 `finished` 只差幾毫秒 → 成功時不可直接收起，否則成功動畫來不及播；
  成功路徑的收起改由動畫層用時間驅動
- 按錯手指有**兩種**系統行為：同一 id 內重試（`fingerOff → fingerOn → matched`），
  或終止並退回密碼輸入（`fingerOff → finished`）。兩者皆已涵蓋
- 取消（Ctrl-C）→ `matching → finished`，對應 `began → ended`
- `will start matching` 每次都會發；App 啟動時序造成的遺漏由 `fingerOn` 認養機制兜底

**併發模型**：`BiometricEventStream` 的解析全在單一序列佇列上，
不可改用 `Task {}` 分派 —— 那會失去順序保證，導致 `fingerOn` 排到 `matched` 之後。

### Step 3 — NotchWindow
- [ ] NSScreen 瀏海幾何計算
- [ ] borderless window + level / collectionBehavior
- [ ] 靜態黑色膠囊，先不接動畫

### Step 4 — AnimationController ✅ 完成
- [x] `NotchAnimationStateMachine` + 9 個單元測試
- [x] Lottie 整合（`lottie-spm` 4.6.1）
- [x] 時間軸切點集中於 `TouchIDAnimation`

**素材實況（`touchid.json`）**

- 1000×1000、60fps、152 frames、Lottie 5.5.7，四張指紋弧線為**內嵌 base64 PNG**（無外部依賴）
- 原規格的四段 markers 用不上 —— 這是一次性描繪動畫，**沒有可無縫循環的段落**
- 改用**單一切點**：`Click Outlines` 圖層的 in-point = frame 97

| 狀態 | 做法 |
|---|---|
| `breathing` | 定格 frame 0，律動由 SwiftUI `phaseAnimator` 提供 |
| `scanning` | 播 0 → 97，3 倍速（2.53s 原速太長，加速後約 0.54s），播完停在最後一格 |
| `success` | 播 97 → 152，原速約 0.92s |

**為何 scanning 播完要定格**：掃描時間長短不固定（手指可能停 0.3s 也可能 3s），
固定長度的動畫播完後必須維持在完成狀態等待結果，不能循環也不能收起。

**膠囊與指標同步**：指標用 `.clipShape` 裁進膠囊，收合時必然一起消失 ——
比起去對齊 spring 與淡出兩條不同的動畫曲線，用幾何約束更可靠。

**尚未由真人確認**：`restFrame = 0` 的靜止畫面是否合適、28pt 下的可讀性。
`LottieScrubber` 提供尺寸對照可重新評估。

### Step 5 — 串接與韌性
- [ ] NotchCoordinator 串三者
- [ ] 鎖定狀態靜音（`com.apple.screenIsLocked` / `screenIsUnlocked`）
- [ ] log process 重連（指數退避 1s → 30s）
- [ ] 啟動 self-test + 選單列警告
- [ ] 15s watchdog

## 參考

- 開源瀏海 App：boring.notch（SwiftUI, MIT）、NotchNook、DynamicLake
- `NSScreen.safeAreaInsets` / `auxiliaryTopLeftArea` / `auxiliaryTopRightArea`（macOS 12+）
