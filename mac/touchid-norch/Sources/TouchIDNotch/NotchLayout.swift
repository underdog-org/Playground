import SwiftUI

/// 膠囊的尺寸與動態參數。想調整外觀就改這裡。
enum NotchLayout {

    /// 膠囊左右各往外擴的寬度。
    /// 這是「比瀏海寬多少」的觀感來源 —— 太小會像瀏海長了一層邊，
    /// 夠大才有 Dynamic Island 那種獨立元件的感覺。
    static let shoulder: CGFloat = 36

    /// 膠囊往瀏海下方延伸的高度。指標的可用空間由它決定。
    static let drop: CGFloat = 100

    /// 展開時的下緣圓角。約為 drop 的 0.3 倍時看起來最像膠囊。
    static let cornerRadius: CGFloat = 24

    /// 上緣兩側往外翻的內凹弧線半徑。
    /// 讓膠囊看起來像從瀏海長出來而非貼上去；收起時會歸零，避免露出黑邊。
    static let topFlare: CGFloat = 11

    /// 指標在 drop 區域內的上下留白。
    static let indicatorInset: CGFloat = 9

    /// 指標邊長 —— 填滿 drop 區域並置中。
    static var indicatorSize: CGFloat { drop - indicatorInset * 2 }

    /// 展開收合的彈性。低阻尼帶一點回彈，接近 Dynamic Island 的手感。
    static let expansion: Animation = .spring(response: 0.42, dampingFraction: 0.62)
}
