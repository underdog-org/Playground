/// 把驗證流程的語意事件轉成瀏海的顯示狀態。
///
/// 成功後不會自動收起 —— 必須由呼叫端在成功動畫播完後呼叫
/// `successAnimationDidFinish()`。這是刻意的：log 裡 `matched` 與 `finished`
/// 只差幾毫秒，若由事件驅動收起，成功動畫根本來不及播。
public struct NotchAnimationStateMachine {

    public private(set) var state: NotchAnimationState = .hidden

    public init() {}

    /// 回傳 nil 代表狀態沒有變化。
    public mutating func handle(_ session: BiometricSession) -> NotchAnimationState? {
        let next: NotchAnimationState

        switch session {
        case .began:
            next = .breathing
        case .fingerOn:
            next = .scanning
        case .fingerOff:
            next = .breathing
        case .succeeded:
            next = .success
        case .ended:
            next = .hidden
        }

        return transition(to: next)
    }

    /// 成功動畫播完，收起膠囊。
    public mutating func successAnimationDidFinish() -> NotchAnimationState? {
        guard state == .success else { return nil }
        return transition(to: .hidden)
    }

    /// watchdog 逾時，強制收起。
    public mutating func timedOut() -> NotchAnimationState? {
        transition(to: .hidden)
    }

    private mutating func transition(to next: NotchAnimationState) -> NotchAnimationState? {
        guard next != state else { return nil }
        state = next
        return next
    }
}