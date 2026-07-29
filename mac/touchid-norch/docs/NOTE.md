# Norch for Touch ID — 學習筆記

在 MacBook 瀏海顯示 TouchID 微動畫。這份筆記記錄**為什麼這樣做**，
決策過程與待辦見 [ROADMAP](ROADMAP.md)。

---

# 1. 架構

## 1.1 為什麼是 Unified log

系統層的 TouchID 沒有公開通知 API。三條路：

| | A. Unified log | B. 自訂 PAM module | C. LAContext |
|---|---|---|---|
| 觸發層代碼量 | ~150–250 行 Swift | ~80 行 C + ~30 行 Swift | ~10 行 Swift |
| 需要權限 | 無 | root 安裝一次 | 無 |
| 覆蓋度 | 系統全部 | 只有 sudo | 只有自己 App |
| 長期穩定性 | 差（未文件化字串） | 好（PAM ABI 穩定） | 最好（公開 API） |
| 失敗風險 | 動畫不觸發 | **可能鎖死 sudo** | 無 |
| 可上架 App Store | ❌ | ❌ | ✅ |

**選 A**，因為只有它單獨就有意義。B 覆蓋太窄（只有 sudo）不足以獨立成產品，
C 只能管自己 App 的驗證，等於沒解決問題。

代價是接受「未文件化字串可能隨 macOS 更新失效」，用啟動 self-test 兜底。

## 1.2 能做到什麼、做不到什麼

| 情境 | 偵測得到 | 畫得出來 |
|---|---|---|
| sudo | ✅ | ✅ |
| 系統設定 / Keychain / App Store 解鎖 | ✅ | ✅ |
| 一般 App（1Password 等） | ✅ | ✅ |
| **螢幕鎖定後解鎖** | ✅ | ❌ |
| 開機登入畫面 | ❌ | ❌ |

螢幕解鎖那格是硬限制：訊號拿得到，但鎖定畫面的 shield window
（log 裡的 `MechanismAssertionLoginWindowShield`）在**所有** window level 之上，
瀏海視窗畫不上去。沒有繞法，只能在鎖定期間靜音。

## 1.3 四個單元

| 單元 | 職責 | 依賴 | 可測性 |
|---|---|---|---|
| `BiometricEventStream` | 跑 `log stream`、解析 ndjson、吐事件 | Foundation only | ✅ 純單元測試 |
| `BiometricSessionTracker` | 分組、去重、收斂成語意事件 | 無 | ✅ |
| `NotchAnimationStateMachine` | 語意事件 → 顯示狀態 | 無 | ✅ |
| `NotchWindow` / `NotchView` | 瀏海幾何、Lottie 播放 | AppKit + Lottie | ⚠️ 手動 |
| `AppDelegate` | 串接、時間協調 | 以上 | ⚠️ 手動 |

**關鍵邊界**：前三個放在 `TouchIDNotchCore`，**完全不碰 AppKit**。
這是整包最容易寫錯的部分，抽出來後可以餵錄好的字串做無頭測試，
不用真的按指紋 —— 目前 38 個測試全部離線跑。

> SPM 的 `executableTarget` 有 `main` 符號，測試 target 無法 import。
> 拆 library 不只是為了整潔，是**測試的必要條件**。

## 1.4 資料流

```
/usr/bin/log stream --style ndjson --predicate '...'
      │ stdout (Pipe.readabilityHandler)
      ▼
LineBuffer                 跨 chunk 的半行緩衝
      │ 完整 JSON 行
      ▼
BiometricLogParser         regex → BiometricEvent(.matching/.fingerOn/…)
      │
      ▼
BiometricSessionTracker    依 [N] 分組、去重、認養 → BiometricSession
      │
      ▼
NotchAnimationStateMachine → NotchAnimationState(.breathing/.scanning/…)
      │
      ▼
AppDelegate                時間協調（等動畫播完、留白、收起）
      │
      ▼
NotchViewModel → NotchView → Lottie
```

每一層只做一件事，且**時間性的判斷全部集中在最後一層**。
狀態機是純同步的 —— 這讓它可測，也讓「等多久」這種會變的東西集中在一處。

---

# 2. 核心程式碼與解說

## 2.1 把視窗蓋在瀏海上

```swift
window.styleMask = .borderless
window.level = .statusBar
window.backgroundColor = .clear
window.isOpaque = false
window.hasShadow = false
window.ignoresMouseEvents = true
window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
window.orderFrontRegardless()
```

瀏海幾何由 `NSScreen` 推導（macOS 12+）：

```swift
let width = topRightArea.minX - topLeftArea.maxX   // 兩塊輔助區之間的空缺
let centerX = (topLeftArea.maxX + topRightArea.minX) / 2
let topY = topLeftArea.maxY
```

- `safeAreaInsets.top` — 瀏海高度（＝選單列高度）
- `auxiliaryTopLeftArea` / `auxiliaryTopRightArea` — 瀏海左右的可用區域
- 沒瀏海的機器這些是 nil / 0

抽成 `NotchMetrics.compute(topLeftArea:topRightArea:safeAreaTop:)` 這個純函式，
只吃 `CGRect` 和數字 —— `NSScreen` 無法 mock，但把它的原始數值抽出來就可以測。

## 2.2 log 串流的併發模型

```swift
pipe.fileHandleForReading.readabilityHandler = { [self] handle in
    let chunk = handle.availableData
    guard !chunk.isEmpty else { return }
    queue.async { [self] in                    // ← 序列佇列，不是 Task
        for line in buffer.append(chunk) {
            if let event = parser.parse(line: line) {
                continuation.yield(event)
            }
        }
    }
}
```

**這裡刻意不用 `Task { await … }`。** 用 Task 的話每塊資料變成獨立的非同步工作，
執行順序不保證 —— `fingerOn` 可能排在 `matched` 後面，動畫就會亂掉。
序列佇列才有保序。`AsyncStream.Continuation.yield` 本身執行緒安全且保序。

類別標 `@unchecked Sendable`，成立的前提是**所有可變狀態只在 `queue` 上存取**。
這個不變量寫在類別的文件註解裡，改動時必須維持。

## 2.3 半行緩衝

```swift
public mutating func append(_ chunk: Data) -> [String] {
    pending.append(chunk)
    var lines: [String] = []
    while let newline = pending.firstIndex(of: 0x0A) {
        let lineData = pending[pending.startIndex..<newline]
        pending.removeSubrange(pending.startIndex...newline)
        if let line = String(data: lineData, encoding: .utf8) {
            lines.append(line)
        }
    }
    return lines
}
```

pipe 一次 read 可能切在任何位置。**只在遇到換行時才解碼 UTF-8** ——
這樣就算 chunk 切在中文字的位元組中間也不會壞。

## 2.4 事件分組與去重

```swift
public mutating func handle(_ event: BiometricEvent) -> [BiometricSession] {
    if case .matching(let id) = event {
        guard activeID == nil else { return [] }      // 忽略併發的第二組
        activeID = id; phase = .waiting
        return [.began]
    }

    // App 在驗證進行中啟動時，開頭已經錯過了，由 finger-on 認養。
    if case .fingerOn(let id) = event, activeID == nil {
        activeID = id; phase = .scanning
        return [.began, .fingerOn]
    }

    guard event.id == activeID else { return [] }
    …
    case .finished:
        let succeeded = phase == .succeeded
        activeID = nil; phase = .idle
        return succeeded ? [] : [.ended]
}
```

三件事都靠同一個狀態機自然達成：

- **去重**：log 會先後印出兩行終止事件，第一次就把 `activeID` 清成 nil，
  第二次在 `guard event.id == activeID` 被擋掉。不需要額外的去重邏輯。
- **分組**：同時可能有多組 `MechanismTouchId[N]`，只追蹤第一個。瀏海只有一個。
- **認養**：只認養 `fingerOn`。`fingerOff` / `matched` / `finished` 若沒看到開頭，
  補一個動畫出來只會是突兀的閃現。

回傳陣列而非 optional，因為認養時一個 log 事件要對應**兩個**語意事件。

## 2.5 動畫與事件的時間落差

這是真實資料才暴露的問題：**log 事件比動畫快**。

`fingerOn → matched` 常常只有 100–300ms，但掃描動畫要 456ms。
成功時指紋還沒畫完就被切掉了。

加快動畫沒用 —— 要壓進 100ms 得放到 16 倍速，會變一團模糊。
正確做法是**延後成功動畫**：

```swift
if state == .success {
    await waitForScanToFinish()      // 掃描沒播完就先等
}
notchWindow?.apply(state)
```

```swift
private func waitForScanToFinish() async {
    guard let start = scanStartedAt else { return }
    let remaining = TouchIDAnimation.scanDuration - (ContinuousClock.now - start)
    guard remaining > .zero else { return }
    try? await Task.sleep(for: remaining)
}
```

iOS 的 Face ID 也是這樣 —— 動畫會播完，即使系統早就驗證通過。

事件迴圈因此改成循序 `await handle(event)`，期間到達的事件留在
`AsyncStream` 緩衝裡，順序不會亂。同樣的理由：不能用 `Task { }` 分派。

## 2.6 膠囊與指標的同步

膠囊用 spring 收合、指標用淡出，兩條不同的時間曲線 —— 對齊它們很脆。
改用**幾何約束**：

```swift
.overlay(alignment: .bottom) { indicator }
.clipShape(capsuleShape)        // 指標不可能畫到膠囊外
```

裁進去之後，就算時序不完全一致，視覺上也永遠是一起消失的。

## 2.7 內凹弧線

讓膠囊看起來像從瀏海「長」出來而非「貼」上去：

```swift
path.move(to: CGPoint(x: 0, y: 0))
path.addQuadCurve(to: CGPoint(x: flare, y: flare),
                  control: CGPoint(x: flare, y: 0))    // 左上內凹
…
var animatableData: AnimatablePair<CGFloat, CGFloat> {
    get { AnimatablePair(topFlare, bottomRadius) }
    set { topFlare = newValue.first; bottomRadius = newValue.second }
}
```

兩個要點：

- **`animatableData` 不可省** —— 沒有它 `Shape` 的參數變化不會參與插值，
  弧線會瞬間跳出來而不是跟著膠囊長
- **收起時 `topFlare` 必須歸零**，否則外翻的部分會在瀏海兩側露出黑邊

---

# 3. 核心概念與坑

## 3.1 瀏海本身沒有像素

最反直覺的一點：**瀏海是實體挖孔，畫不上去**。
所有瀏海 App 都是在瀏海**周圍**畫黑色圓角區塊，因為顏色一致，
視覺上看起來像瀏海長大了。

推論：

- 「動畫顯示在瀏海上」實際要決定的是**往哪裡長**
- 指標要置中於**瀏海下方那塊看得見的區域**，而非整個膠囊
- 收起狀態下膠囊等於瀏海尺寸 ＝ 完全隱形，不需要 `orderOut`

## 3.2 視窗尺寸固定，展開收合在內部畫

每格改 `NSWindow` 的 frame 會卡頓，spring 動畫也需要超出邊界的緩衝空間。
所以視窗固定為**展開後的最大尺寸**，SwiftUI 在裡面畫尺寸變化。

## 3.3 macOS / AppKit

- **`setActivationPolicy(.accessory)` 可取代 `LSUIElement`**，
  所以開發期不需要 .app bundle、不需要 Info.plist，`swift run` 直接就是
  無 Dock 圖示的選單列 App。要在 `app.run()` **之前**呼叫，否則 Dock 圖示會閃一下。
- **`app.delegate` 是 weak reference**。寫成 `app.delegate = AppDelegate()`
  會當場被釋放，選單列什麼都不會出現。必須用具名變數持有。
- **`orderFrontRegardless()` 而非 `makeKeyAndOrderFront(_:)`** ——
  後者會搶焦點，把使用者正在打字的視窗踢掉。
- **`NSMenuItem` 的 action 走 responder chain**，`AppDelegate` 不在鏈上，
  要明確設 `item.target = self`，否則點了沒反應。
- **`NSImage.isTemplate = true`** 讓選單列圖示自動適應淺色／深色，
  不設的話深色模式會變一團黑。
- **`.accessory` 政策下開視窗要 `NSApp.activate()`**，否則視窗出現在背後看不到。
  `activate(ignoringOtherApps:)` 在 macOS 26 已標記將棄用。

## 3.4 Swift / SPM

- **`.macOS("26.0")` 用字串形式而非 `.v26`** —— 不依賴 PackageDescription
  有沒有該版本的列舉值，比較不會因工具鏈版本卡住。
- **不要 `swift package init`**：會用目錄名當 module 名，
  而 Swift module 不能有連字號（`touchid-norch` → `touchid_norch`）。手寫乾淨得多。
- **`Sources/` 底下每個目錄都是一個 target**。把資源放 `Sources/Resources/`
  會被當成一個沒有原始碼的 target 而報錯，必須放在某個 target 目錄下
  （`Sources/TouchIDNotch/Resources/`）+ `resources: [.process("Resources")]`。
- **`#expect` 是 Swift Testing 的巨集**，效果等同 `XCTAssert`，失敗時給更詳細的 diff。
  Swift 6 工具鏈內建，不用加依賴。

## 3.5 Swift 6 嚴格併發

- **可變狀態不要放 local var**。被延遲的 `Task` 捕捉後，改到的可能是另一份副本。
  改成類別屬性（`@MainActor` 的類別）就沒這問題。
- **`@unchecked Sendable` 是承諾不是豁免**。用它的前提是有一個真實的同步機制
  （這裡是序列佇列），並且把不變量寫進註解。
- **需要保序時不要用 `Task { }`**。Task 之間的執行順序不保證。

## 3.6 Lottie

- **官方建議用 `lottie-spm` 而非 `lottie-ios`**，下載快很多。
- **一次性描繪動畫沒有可無縫循環的段落**。想要呼吸效果，
  定格取畫面（`.currentFrame`）＋ SwiftUI 的 `phaseAnimator` 提供律動，
  比硬要循環好，而且不用改素材。
- **播放參數變動時要 `.id(...)` 強制重建 view**，否則新的播放設定不會套用。
- **分支切換會重建 `LottieView`，播放從段落開頭重來** —— 這正是需要的行為：
  手指碰上去時掃描要從頭畫。
- **點陣圖縮小不會糊**（縮小 ≠ 放大），但**顏色寫死無法在程式端換色**。
  向量圖層才能用 value provider 改色。
- 切點用 `.fromFrame` 加 Swift 常數，不用素材裡的 markers ——
  兩份會漂移的資料比一份糟。

## 3.7 Unified log 的實際行為

事件字串（subsystem `com.apple.LocalAuthentication`，category `Server,Interactive,Biometry`）：

| log 字串 | 語意 |
|---|---|
| `MechanismTouchId[N](run) will start matching user <uid>` | 開始等手指 |
| `MechanismTouchId[N](run) has received finger-on` | 手指碰上去 |
| `MechanismTouchId[N](run) has matched by <private> (unlocked:1` | 比對成功 |
| `MechanismTouchId[N](run) has received finger-off` | 手指移開 |
| `MechanismTouchId[N](run) has finished with Error … Code=-9` | 取消 |
| `MechanismTouchId[N](run)> dropped (mechanism finished)` | 收尾 |

- **延遲實測平均 2.2ms、最大 8.1ms**，感知上等於零。這是整個方案的可行性前提，
  在寫任何 UI 之前先量掉。
- **光是出現 `MechanismTouchId[N]` 不代表是狀態轉換**。
  `LAAssertions` 那些行也含這個編號，必須靠片語比對，否則會誤判。
- **終止事件會印兩行**（`has finished with` 與 `dropped`），必須去重。
- **`matched` 與 `finished` 只差幾毫秒**，不能由 `finished` 驅動收起。
- **按錯手指有兩種系統行為**：同一 id 內重試（`fingerOff → fingerOn → matched`），
  或終止並退回密碼輸入（`fingerOff → finished`）。
- **`MechanismTouchId` 各行由 `coreauthd` 印出，不含發起者 PID**
  （PID 只在 `LAAssertions` category）。想過濾特定來源得跨 category 關聯，很脆 ——
  改用 `DistributedNotificationCenter` 的 `com.apple.screenIsLocked` 判斷鎖定狀態，
  簡單且穩定得多。
- **in-process 的 `OSLogStore` 讀不到別的 process**，只能走 subprocess 這條路。
  也因此**不可能上架 App Store**（sandbox 不能 spawn `log`）。

## 3.8 方法論

貫穿整個專案的一條原則：**先取得證據，再決定架構**。

- 延遲未知時不寫 UI —— 那是方案的生死線
- 用真實 log 序列當測試資料，不用想像出來的
- 每個「應該會怎樣」的假設，都用實測推翻或確認過
  （`matching` 是否每次都發、取消長什麼樣、按錯手指的兩種路徑）

好幾個設計決定是被真實資料改掉的：四段 markers 改成單一切點、
PID 過濾改成鎖定狀態判斷、成功動畫從事件驅動改成時間驅動。
