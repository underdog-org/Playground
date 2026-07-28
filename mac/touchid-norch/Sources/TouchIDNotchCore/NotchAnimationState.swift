/// 瀏海動畫的顯示狀態。
public enum NotchAnimationState: Equatable, Sendable {
    /// 完全收起，與瀏海無異
    case hidden
    /// 展開，等待手指（呼吸）
    case breathing
    /// 手指在感測器上（掃描）
    case scanning
    /// 比對成功
    case success
}