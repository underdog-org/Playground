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

    var body: some View {
        UnevenRoundedRectangle(
            topLeadingRadius: 0,
            bottomLeadingRadius: isExpanded ? 14 : 0,
            bottomTrailingRadius: isExpanded ? 14 : 0,
            topTrailingRadius: 0
        )
        .fill(.black)
        .frame(
            width: isExpanded ? metrics.notchWidth + shoulder * 2 : metrics.notchWidth,
            height: isExpanded ? metrics.notchHeight + drop : metrics.notchHeight
        )
        .overlay(alignment: .bottom) { indicator }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(.spring(response: 0.35, dampingFraction: 0.72), value: model.state)
        .ignoresSafeArea()
    }

    /// Lottie 素材完成前的暫時替代品。
    @ViewBuilder
    private var indicator: some View {
        switch model.state {
        case .hidden:
            EmptyView()

        case .breathing:
            Image(systemName: "touchid")
                .font(.system(size: 20, weight: .light))
                .foregroundStyle(.white.opacity(0.55))
                .symbolEffect(.pulse, options: .repeating)
                .padding(.bottom, 8)

        case .scanning:
            Image(systemName: "touchid")
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(.pink)
                .padding(.bottom, 8)

        case .success:
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(.green)
                .padding(.bottom, 8)
        }
    }
}