import Lottie

/// `touchid.json` 的時間軸切點與播放參數。
///
/// 這裡是切點的**唯一來源** —— 素材本身不帶 markers，播放一律用 `.fromFrame`。
/// 換素材或想調整分段時，用 `LottieScrubber` 量出 frame 編號後改這裡即可，
/// 所有時長與等待邏輯都由這些常數推導。
enum TouchIDAnimation {

    static let name = "touchid"

    /// 素材幀率，用來把 frame 數換算成時間。
    static let fps: Double = 60

    /// 指紋開始描繪。
    static let scanStart: AnimationFrameTime = 0

    /// 成功漣漪的起點，同時也是掃描段的終點 —— 兩段共用一個切點，中間不留空隙。
    /// 素材裡 `Click Outlines` 圖層的 in-point 在 frame 97，可當作下限參考。
    static let successStart: AnimationFrameTime = 72

    /// 時間軸結束。
    static let end: AnimationFrameTime = 152

    /// `breathing` 狀態定格的位置。若靜止畫面看起來不對，用 scrubber 重新挑一格。
    static let restFrame: AnimationFrameTime = 0

    /// 素材原速對一次驗證太長，加速播放。實際時長見 `scanDuration`。
    static let scanSpeed: Double = 3

    /// 成功段維持原速，讓漣漪看得清楚。
    static let successSpeed: Double = 1

    /// 成功動畫播完後額外停留的時間。
    ///
    /// 沒有這段留白的話，最後一格播完的瞬間膠囊就開始收起，
    /// 觀感上像是「還沒看清楚就沒了」。想讓成功狀態停久一點就調這裡。
    static let successLinger: Duration = .milliseconds(800)

    /// 掃描段的播放時間。
    ///
    /// 真實的 `fingerOn → matched` 常常只有 100–300ms，比這段動畫還短，
    /// 所以成功動畫必須等這段播完才能接上，否則指紋會畫到一半就被切掉。
    static var scanDuration: Duration {
        let seconds = Double(successStart - scanStart) / fps / scanSpeed
        return .milliseconds(Int(seconds * 1000))
    }

    /// 成功段的播放時間。
    static var successDuration: Duration {
        let seconds = Double(end - successStart) / fps / successSpeed
        return .milliseconds(Int(seconds * 1000))
    }

    /// 膠囊在成功狀態維持的總時間 ＝ 動畫長度 ＋ 留白。
    static var successHold: Duration { successDuration + successLinger }
}
