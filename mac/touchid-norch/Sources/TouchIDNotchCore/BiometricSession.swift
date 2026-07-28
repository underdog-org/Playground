/// 單一驗證流程的語意事件，已去重、已分組。
public enum BiometricSession: Equatable, Sendable {
    /// 感測器開始等待手指
    case began
    /// 手指碰上感測器
    case fingerOn
    /// 手指離開，回到等待
    case fingerOff
    /// 比對成功
    case succeeded
    /// 未成功就結束（取消、逾時）
    case ended
}
