import SwiftUI

/// 瀏海膠囊的外形。
///
/// 上緣兩側是**內凹**的弧線（往螢幕邊緣外翻），下緣是一般的凸圓角。
/// 內凹的用意是讓膠囊看起來像從瀏海「長」出來，而不是「貼」上去 ——
/// 直角接縫會讓兩者看起來是兩個不同的物件。
///
/// 座標系為 SwiftUI 的左上原點、y 軸向下。
struct NotchShape: Shape {

    /// 上緣往外翻的弧線半徑。0 代表直角（收起狀態）。
    var topFlare: CGFloat

    /// 下緣圓角半徑。
    var bottomRadius: CGFloat

    /// 讓兩個半徑參與 SwiftUI 的動畫插值，展開收合時弧線才會跟著變形。
    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(topFlare, bottomRadius) }
        set {
            topFlare = newValue.first
            bottomRadius = newValue.second
        }
    }

    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height

        // 夾住半徑，避免尺寸過小時路徑自我交錯。
        let flare = max(0, min(topFlare, w / 2, h))
        let corner = max(0, min(bottomRadius, (w - flare * 2) / 2, h - flare))

        var path = Path()

        // 左上：從螢幕邊緣內凹進膠囊本體
        path.move(to: CGPoint(x: 0, y: 0))
        path.addQuadCurve(
            to: CGPoint(x: flare, y: flare),
            control: CGPoint(x: flare, y: 0)
        )

        // 左側下行 → 左下圓角
        path.addLine(to: CGPoint(x: flare, y: h - corner))
        path.addQuadCurve(
            to: CGPoint(x: flare + corner, y: h),
            control: CGPoint(x: flare, y: h)
        )

        // 底邊 → 右下圓角
        path.addLine(to: CGPoint(x: w - flare - corner, y: h))
        path.addQuadCurve(
            to: CGPoint(x: w - flare, y: h - corner),
            control: CGPoint(x: w - flare, y: h)
        )

        // 右側上行 → 右上內凹回螢幕邊緣
        path.addLine(to: CGPoint(x: w - flare, y: flare))
        path.addQuadCurve(
            to: CGPoint(x: w, y: 0),
            control: CGPoint(x: w - flare, y: 0)
        )

        path.closeSubpath()
        return path
    }
}
