import AppKit
import SwiftUI
import TouchIDNotchCore

/// 蓋在瀏海下緣的無邊框視窗。
@MainActor
final class NotchWindow {

    private static let shoulder = NotchLayout.shoulder
    private static let drop = NotchLayout.drop
    /// 成功狀態的維持時間，之後自動收起。
    /// 由素材的成功段長度加上留白推算，改動畫速度時會自動跟著變。
    static var successHold: Duration { TouchIDAnimation.successHold }

    private let window: NSWindow
    private let model = NotchViewModel()

    /// 找出有瀏海的內建螢幕。外接螢幕不支援。
    static func notchedScreen() -> NSScreen? {
        NSScreen.screens.first {
            $0.safeAreaInsets.top > 0 && $0.auxiliaryTopLeftArea != nil
        }
    }

    /// 螢幕沒有瀏海時回傳 nil。
    init?(screen: NSScreen) {
        guard let metrics = NotchMetrics.compute(
            topLeftArea: screen.auxiliaryTopLeftArea,
            topRightArea: screen.auxiliaryTopRightArea,
            safeAreaTop: screen.safeAreaInsets.top
        ) else { return nil }

        // 視窗固定為展開後的最大尺寸，展開收合在內部畫。
        // 寬度要多留內凹弧線的部分，否則膠囊本體會被視窗邊界裁掉。
        let frame = metrics.capsuleFrame(
            shoulder: Self.shoulder + NotchLayout.topFlare,
            drop: Self.drop
        )

        window = NSWindow(
            contentRect: frame,
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.level = .statusBar
        window.ignoresMouseEvents = true
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        window.contentView = NSHostingView(
            rootView: NotchView(
                metrics: metrics,
                shoulder: Self.shoulder,
                drop: Self.drop,
                model: model
            )
        )
        window.setFrame(frame, display: false)
        window.orderFrontRegardless()
    }

    func show() { window.orderFrontRegardless() }
    func hide() { window.orderOut(nil) }
    func apply(_ state: NotchAnimationState) {
        model.state = state
    }
}