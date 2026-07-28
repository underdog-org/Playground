# Norch for Touch ID


## Norch = 把視窗蓋在瀏海上（公開 API）

> 核心就是一個無邊框、層級高於選單列的 NSWindow：

```swift
window.styleMask = .borderless
window.level = .statusBar          // 或 .mainMenu + 1，蓋過選單列
window.backgroundColor = .clear
window.isOpaque = false
window.hasShadow = false
window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
```

瀏海幾何用 NSScreen 取得（macOS 12+）：
- screen.safeAreaInsets.top — 瀏海高度
- screen.auxiliaryTopLeftArea / auxiliaryTopRightArea — 瀏海左右兩側可用區域，兩者中間的空缺就是瀏海本體
- 沒瀏海的機器這些會是 nil / 0，要有 fallback

內容用 SwiftUI + matchedGeometryEffect 做展開收合，視覺上就是動態島。已有開源可參考：boring.notch（SwiftUI，MIT）、NotchNook、DynamicLake。

需要注意的坑：
- 全螢幕 App 下瀏海會被系統遮住，得靠 .fullScreenAuxiliary + 監聽 NSApplication.didChangeScreenParametersNotification
- 擴張時要能接滑鼠事件，收起時建議 ignoresMouseEvents = true 避免擋到選單列
- App 要設 LSUIElement = true（無 Dock 圖示）

---
## TouchID

### A. Unified log 串流（覆蓋最廣）

開一個 subprocess 跑：

```bash
/usr/bin/log stream --predicate 'subsystem == "com.apple.LocalAuthentication" AND category == "Server,Interactive,Biometry"' --style ndjson
```

解析 `will start matching` / `will stop biometric operation` 當作動畫的 start/stop。

注意 in-process 的 `OSLogStore` 讀不到別的 process，得用 subprocess 這條路。

### B. 自訂 PAM module（只管 sudo，但最穩）

你的 `/etc/pam.d/sudo_local` 已經有 `pam_tid.so` 了。在它前面插一個自己寫的 module，`pam_sm_authenticate` 裡送訊號給你的 App 然後回 `PAM_IGNORE` 讓 stack 繼續：

```
auth       optional       pam_norch.so     ← 自己的
auth       sufficient     pam_tid.so
```

比 log parsing 穩定得多，但只涵蓋 sudo，且要 root 安裝。

### C. `LAContext`（你自己 App 的驗證）— 完全掌控。

**覆蓋表**

| 情境                                 | 偵測得到                     | 畫得出來 |
| ------------------------------------ | ---------------------------- | -------- |
| sudo                                 | ✅ A 或 B                    | ✅       |
| 系統設定 / Keychain / App Store 解鎖 | ✅ A                         | ✅       |
| 你自己的 App                         | ✅ C                         | ✅       |
| **螢幕鎖定後解鎖**                   | ✅ A（log 裡有 loginwindow） | ❌       |
| 開機登入畫面                         | ❌ App 沒在跑                | ❌       |

螢幕解鎖那格是關鍵限制：訊號拿得到，但鎖定畫面的 shield window（log 裡的 `MechanismAssertionLoginWindowShield`）在所有 window level 之上，你的瀏海視窗畫不上去。這個沒有繞法。


三種方式的**瀏海 UI 層是共用的**（約 300–400 行 SwiftUI + NSWindow），所以差異純粹在「觸發層」。以下比較只算觸發層。

**總覽**

|                  | A. Unified log             | B. 自訂 PAM module        | C. LAContext     |
| ---------------- | -------------------------- | ------------------------- | ---------------- |
| 觸發層代碼量     | ~150–250 行 Swift          | ~80 行 C + ~30 行 Swift   | ~10 行 Swift     |
| 技術難度         | 低–中                      | 中–高                     | 極低             |
| 語言／建置       | 純 Swift，無額外建置       | C dylib bundle + 安裝腳本 | 純 Swift         |
| 需要權限         | 無                         | root 安裝一次             | 無               |
| 覆蓋度           | 系統全部（除鎖定畫面渲染） | 只有 sudo                 | 只有自己 App     |
| 長期穩定性       | 差（未文件化字串）         | 好（PAM ABI 穩定）        | 最好（公開 API） |
| 失敗風險         | 動畫不觸發                 | **可能鎖死 sudo**         | 無               |
| 可上架 App Store | ❌                         | ❌                        | ✅               |

---
夠了，可以出設計了。先講一個我在資料裡發現、會影響架構的細節：

`MechanismTouchId` 那些行都是 `coreauthd` 印的，**不帶發起者的 PID**。PID 藏在另一個 category 的行裡（`LAAssertions`：`'MechanismTouchId[52] for PID:413'`）。要靠 PID 過濾 loginwindow 就得跨 category 關聯兩種行、再反查進程名 —— 很脆。

改用 `DistributedNotificationCenter` 監聽 `com.apple.screenIsLocked` / `screenIsUnlocked`，鎖定期間直接靜音，簡單得多也穩得多。以下設計採這個做法。

---


## Swift

- `.macOS("26.0")` 用字串形式而非 .v26 —— 字串形式不依賴 PackageDescription 有沒有該版本的列舉值，比較不會因工具鏈版本卡住。
- **IMPORTANT** `app.setActivationPolicy(.accessory)`	關鍵：設為 .accessory 讓 app 不顯示在 Dock、也不顯示選單列；但因為我們同時有 statusItem，所以選單列圖示還是會出現。效果就是「只有選單列圖示，沒有 Dock」。
- `setActivationPolicy` 要在 app.run() 之前呼叫，不然 Dock 圖示會先閃一下
- **IMPORTANT** delegate 是 weak reference，寫成 app.delegate = AppDelegate() 會當場被釋放，選單列什麼都不會出現
- `#expect` 是 Swift Testing 的巨集，效果等同 XCTAssert，但在失敗時會給更詳細的 diff 資訊。


**製作結束綁定**

```swift
menu.addItem(
    NSMenuItem(
        title: "結束",
        action: #selector(NSApplication.terminate(_:)),
        keyEquivalent: "q"
    )
)
```

**BiometricEventStream** 並發模型製作
- log stream --style ndjson 輸出的管線在核心層級是一塊一塊的（availableData）
- Buffer 隔開 producer 與 consumer 之間在速率、粒度或時序上的不匹配。

**Animation**
- finished 那段是這個檔案的重點。matched 和 finished 在 log 裡只差幾毫秒 —— 如果一收到 finished 就收起瀏海，成功動畫根本來不及播。所以成功路徑的收起交給動畫層用時間驅動，tracker 只管語意。

### UI

- orderFrontRegardless() 而非 makeKeyAndOrderFront(_:) —— 後者會搶焦點，把使用者正在打字的視窗踢掉