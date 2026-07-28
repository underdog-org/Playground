import AppKit
import SwiftUI
import TouchIDNotchCore

/// 蓋在瀏海下緣的無邊框視窗。
@MainActor
final class NotchWindow {

    /// 膠囊左右各外擴的寬度
    private static let shoulder: CGFloat = 12
    /// 膠囊往瀏海下方延伸的高度
    private static let drop: CGFloat = 36
    /// 成功動畫停留時間，之後自動收起
    static let successHold: Duration = .milliseconds(900)

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
        let frame = metrics.capsuleFrame(shoulder: Self.shoulder, drop: Self.drop)

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