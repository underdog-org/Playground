import Lottie

/// `touchid.json` 的時間軸切點與播放參數。
///
/// 這些數值鏡射素材裡的 markers（`scan` / `success` / `end`）。
/// 改素材時兩邊都要更新 —— `LottieScrubber` 可以用來重新量測。
enum TouchIDAnimation {

    static let name = "touchid"

    /// 素材幀率，用來把 frame 數換算成時間。
    static let fps: Double = 60

    /// 指紋開始描繪。
    static let scanStart: AnimationFrameTime = 0

    /// `Click Outlines` 圖層的 in-point —— 成功漣漪從這裡開始，
    /// 同時也是掃描段的終點。
    static let successStart: AnimationFrameTime = 97

    /// 時間軸結束。
    static let end: AnimationFrameTime = 152

    /// `breathing` 狀態定格的位置。若靜止畫面看起來不對，用 scrubber 重新挑一格。
    static let restFrame: AnimationFrameTime = 0

    /// 原速 2.53 秒對一次驗證太長，加速到約 0.54 秒。
    static let scanSpeed: Double = 3

    /// 成功段維持原速，讓漣漪看得清楚。
    static let successSpeed: Double = 1

    /// 成功動畫播完後額外停留的時間。
    ///
    /// 沒有這段留白的話，最後一格播完的瞬間膠囊就開始收起，
    /// 觀感上像是「還沒看清楚就沒了」。想讓成功狀態停久一點就調這裡。
    static let successLinger: Duration = .milliseconds(800)

    /// 成功段的播放時間。
    static var successDuration: Duration {
        let seconds = Double(end - successStart) / fps / successSpeed
        return .milliseconds(Int(seconds * 1000))
    }

    /// 膠囊在成功狀態維持的總時間 ＝ 動畫長度 ＋ 留白。
    static var successHold: Duration { successDuration + successLinger }
}
