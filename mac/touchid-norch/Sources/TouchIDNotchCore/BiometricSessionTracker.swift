/// 把原始 log 事件收斂成單一驗證流程的語意事件。
///
/// 負責三件事：
/// 1. 依 mechanism id 分組，只追蹤第一個開始的流程 —— 瀏海只有一個，不做併發顯示
/// 2. 去除重複的終止事件（log 會先後印出 `has finished with` 與 `dropped`）
/// 3. 把「成功」與「未成功結束」分開，讓 UI 各自決定收起時機
public struct BiometricSessionTracker {
    private enum Phase {
        case idle
        case waiting
        case scanning
        case succeeded
    }

    private var activeID: Int?
    private var phase: Phase = .idle

    public init() {}

    /// 回傳空陣列代表這個事件不造成語意變化。
    public mutating func handle(_ event: BiometricEvent) -> [BiometricSession] {
        if case let .matching(id) = event {
            guard activeID == nil else { return [] } // 忽略併發的第二組
            activeID = id
            phase = .waiting
            return [.began]
        }

        // 沒有進行中的流程時，finger-on 也能認養一個新流程。
        // App 在驗證開始後才啟動時，`will start matching` 已經錯過了，
        // 但手指碰上去的當下仍應該有反應。
        if case let .fingerOn(id) = event, activeID == nil {
            activeID = id
            phase = .scanning
            return [.began, .fingerOn]
        }

        guard event.id == activeID else { return [] }

        switch event {
        case .matching:
            return [] // 已在上面處理

        case .fingerOn:
            guard phase == .waiting else { return [] }
            phase = .scanning
            return [.fingerOn]

        case .fingerOff:
            guard phase == .scanning else { return [] }
            phase = .waiting
            return [.fingerOff]

        case .matched:
            guard phase != .succeeded else { return [] }
            phase = .succeeded
            return [.succeeded]

        case .finished:
            let succeeded = phase == .succeeded
            activeID = nil
            phase = .idle
            // 成功時不發 .ended —— matched 與 finished 只差幾毫秒，
            // 直接收會讓成功動畫來不及播。交給動畫層用時間驅動。
            return succeeded ? [] : [.ended]
        }
    }
}
