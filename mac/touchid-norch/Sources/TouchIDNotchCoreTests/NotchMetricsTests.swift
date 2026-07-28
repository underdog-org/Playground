import CoreGraphics
import Testing
@testable import TouchIDNotchCore

@Suite("NotchMetrics")
struct NotchMetricsTests {
    @Test("由左右輔助區之間的空缺算出瀏海")
    func computesGeometry() {
        let metrics = NotchMetrics.compute(
            topLeftArea: CGRect(x: 0, y: 950, width: 600, height: 32),
            topRightArea: CGRect(x: 800, y: 950, width: 600, height: 32),
            safeAreaTop: 32
        )
        #expect(metrics?.notchWidth == 200)
        #expect(metrics?.notchHeight == 32)
        #expect(metrics?.centerX == 700)
        #expect(metrics?.topY == 982)
    }

    @Test("沒有輔助區就是沒有瀏海")
    func noAuxiliaryAreas() {
        #expect(NotchMetrics.compute(topLeftArea: nil, topRightArea: nil, safeAreaTop: 0) == nil)
    }

    @Test("只有單邊輔助區也視為沒有瀏海")
    func onlyOneSide() {
        let left = CGRect(x: 0, y: 950, width: 600, height: 32)
        #expect(NotchMetrics.compute(topLeftArea: left, topRightArea: nil, safeAreaTop: 32) == nil)
    }

    @Test("兩區相接代表中間沒有空缺")
    func degenerateNotch() {
        let metrics = NotchMetrics.compute(
            topLeftArea: CGRect(x: 0, y: 950, width: 700, height: 32),
            topRightArea: CGRect(x: 700, y: 950, width: 700, height: 32),
            safeAreaTop: 32
        )
        #expect(metrics == nil)
    }

    @Test("膠囊置中於瀏海並貼齊螢幕頂緣")
    func capsuleFrameIsCenteredAndFlush() {
        let metrics = NotchMetrics(notchWidth: 200, notchHeight: 32, centerX: 700, topY: 982)
        let frame = metrics.capsuleFrame(shoulder: 12, drop: 36)
        #expect(frame.width == 224)
        #expect(frame.height == 68)
        #expect(frame.midX == 700)
        #expect(frame.maxY == 982) // 貼齊頂緣，不能留縫
    }
}
