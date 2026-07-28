/// Touch ID 感測器上的狀態事件（透過Unified Log解析）
public enum BiometricEvent: Equatable, Sendable {
    /// 感測器開始等待手指
    case matching(id: Int)
    /// 手指碰上感測器
    case fingerOn(id: Int)
    /// 手指離開感測器
    case fingerOff(id: Int)
    /// 比對成功
    case matched(id: Int)
    /// 本次驗證結束（成功收尾、取消、或錯誤）
    case finished(id: Int)

    /// coreauthd 的 mechanism 編號，用來分辨併發的驗證流程。
    public var id: Int {
        switch self {
        case let .matching(id), let .fingerOn(id), let .fingerOff(id),
             let .matched(id), let .finished(id):
            return id
        }
    }
}
