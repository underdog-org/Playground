import CoreGraphics

/// 瀏海的幾何量測結果。
///
/// 座標系為 AppKit 的全域座標（原點在左下）。
public struct NotchMetrics: Equatable, Sendable {
    /// 瀏海本體寬度（實體挖孔，沒有像素）
    public let notchWidth: CGFloat
    /// 瀏海本體高度，等同選單列高度
    public let notchHeight: CGFloat
    /// 瀏海中心的 x 座標
    public let centerX: CGFloat
    /// 螢幕頂緣的 y 座標
    public let topY: CGFloat

    public init(notchWidth: CGFloat, notchHeight: CGFloat, centerX: CGFloat, topY: CGFloat) {
        self.notchWidth = notchWidth
        self.notchHeight = notchHeight
        self.centerX = centerX
        self.topY = topY
    }

    /// 由 `NSScreen` 的原始數值算出瀏海幾何。沒有瀏海時回傳 nil。
    ///
    /// 左右兩塊輔助區之間的空缺就是瀏海本體。
    public static func compute(
        topLeftArea: CGRect?,
        topRightArea: CGRect?,
        safeAreaTop: CGFloat
    ) -> NotchMetrics? {
        guard let left = topLeftArea, let right = topRightArea, safeAreaTop > 0 else {
            return nil
        }

        let width = right.minX - left.maxX
        guard width > 0 else { return nil } // 兩區相接或重疊 → 沒有瀏海

        return NotchMetrics(
            notchWidth: width,
            notchHeight: safeAreaTop,
            centerX: (left.maxX + right.minX) / 2,
            topY: left.maxY
        )
    }

    /// 膠囊視窗的框架。
    /// - Parameters:
    ///   - shoulder: 左右各往外擴的寬度
    ///   - drop: 往瀏海下方延伸的高度
    public func capsuleFrame(shoulder: CGFloat, drop: CGFloat) -> CGRect {
        let width = notchWidth + shoulder * 2
        let height = notchHeight + drop
        return CGRect(
            x: centerX - width / 2,
            y: topY - height,
            width: width,
            height: height
        )
    }
}
