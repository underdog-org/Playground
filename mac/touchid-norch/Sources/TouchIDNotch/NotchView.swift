import Lottie
import SwiftUI
import TouchIDNotchCore

@Observable
@MainActor
final class NotchViewModel {
    var state: NotchAnimationState = .hidden
}

/// 瀏海膠囊。收起時尺寸等同瀏海本體 —— 瀏海沒有像素，所以等於隱形。
struct NotchView: View {

    let metrics: NotchMetrics
    let shoulder: CGFloat
    let drop: CGFloat
    @Bindable var model: NotchViewModel

    private var isExpanded: Bool { model.state != .hidden }

    /// 收起時弧線歸零 —— 有內凹弧線的話，收起狀態會在瀏海兩側露出黑邊。
    private var topFlare: CGFloat { isExpanded ? NotchLayout.topFlare : 0 }

    /// 膠囊外形。`body` 用兩次：一次填色、一次裁切。
    private var capsuleShape: NotchShape {
        NotchShape(
            topFlare: topFlare,
            bottomRadius: isExpanded ? NotchLayout.cornerRadius : 0
        )
    }

    /// 內凹弧線只存在於最上緣，膠囊本體因此比外框窄 `topFlare * 2`。
    /// 把這段補回去，本體寬度才會維持在 `瀏海寬 + shoulder * 2`。
    private var capsuleWidth: CGFloat {
        isExpanded
            ? metrics.notchWidth + shoulder * 2 + topFlare * 2
            : metrics.notchWidth
    }

    var body: some View {
        capsuleShape
            .fill(.black)
            .frame(
                width: capsuleWidth,
                height: isExpanded ? metrics.notchHeight + drop : metrics.notchHeight
            )
            .overlay(alignment: .bottom) {
                // 置中於瀏海下方那塊看得見的區域（drop），
                // 而非整個膠囊 —— 膠囊上半部是實體挖孔，沒有像素。
                indicator
                    .frame(width: NotchLayout.indicatorSize, height: NotchLayout.indicatorSize)
                    .padding(.bottom, NotchLayout.indicatorInset)
                    .opacity(isExpanded ? 1 : 0)
            }
            // 把指標裁進膠囊裡，膠囊收合時它必然一起消失，
            // 不需要去對齊兩條動畫曲線。
            .clipShape(capsuleShape)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .animation(NotchLayout.expansion, value: model.state)
            .ignoresSafeArea()
    }

    /// 每個狀態各自建立一個 `LottieView`。
    ///
    /// 分支切換會重建 view，播放因此從段落開頭重新開始 —— 這正是需要的行為：
    /// 手指碰上去時掃描要從頭畫，比對成功時漣漪要從頭播。
    @ViewBuilder
    private var indicator: some View {
        switch model.state {
        case .hidden:
            animation.currentFrame(TouchIDAnimation.restFrame)

        case .breathing:
            // 素材是一次性的描繪動畫，沒有可無縫循環的段落，
            // 所以定格取畫面、由 SwiftUI 提供律動。
            animation
                .currentFrame(TouchIDAnimation.restFrame)
                .phaseAnimator([false, true]) { content, isUp in
                    content
                        .opacity(isUp ? 1 : 0.5)
                        .scaleEffect(isUp ? 1 : 0.9)
                } animation: { _ in
                    .easeInOut(duration: 1.1)
                }

        case .scanning:
            // 播完停在最後一格 —— 掃描時間長短不固定，
            // 動畫播完後必須維持在完成狀態等待結果。
            animation
                .playing(.fromFrame(
                    TouchIDAnimation.scanStart,
                    toFrame: TouchIDAnimation.successStart,
                    loopMode: .playOnce
                ))
                .animationSpeed(TouchIDAnimation.scanSpeed)

        case .success:
            animation
                .playing(.fromFrame(
                    TouchIDAnimation.successStart,
                    toFrame: TouchIDAnimation.end,
                    loopMode: .playOnce
                ))
                .animationSpeed(TouchIDAnimation.successSpeed)
        }
    }

    private var animation: LottieView<EmptyView> {
        LottieView(animation: .named(TouchIDAnimation.name, bundle: .module))
    }
}
