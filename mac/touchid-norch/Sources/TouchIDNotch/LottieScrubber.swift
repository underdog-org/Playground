import Lottie
import SwiftUI

/// 量測時間軸切點、評估縮小後可讀性的臨時工具。切點確定後可刪。
struct LottieScrubber: View {

    @State private var frame: Double = 0
    @State private var isPlaying = false
    @State private var speed = TouchIDAnimation.scanSpeed
    @State private var segmentStart = Double(TouchIDAnimation.scanStart)
    @State private var segmentEnd = Double(TouchIDAnimation.successStart)

    private var totalFrames: Double { Double(TouchIDAnimation.end) }

    var body: some View {
        VStack(spacing: 14) {
            preview
                .frame(width: 460, height: 460)
                .background(.black, in: RoundedRectangle(cornerRadius: 10))

            actualSizeComparison

            Divider()

            Toggle("播放段落", isOn: $isPlaying)

            slider("frame", $frame, 0...totalFrames)
                .disabled(isPlaying)
            slider("速度", $speed, 0.25...6, format: "%.2fx")
            slider("段落起點", $segmentStart, 0...totalFrames)
            slider("段落終點", $segmentEnd, 0...totalFrames)

            Text(durationSummary)
                .font(.caption)
                .foregroundStyle(.secondary)

            presets
        }
        .padding(20)
        .frame(width: 520)
    }

    @ViewBuilder
    private var preview: some View {
        if isPlaying {
            lottie
                .playing(.fromFrame(segmentStart, toFrame: segmentEnd, loopMode: .loop))
                .animationSpeed(speed)
                // 參數變動時必須重建 view，播放設定才會重新套用。
                .id("\(segmentStart)-\(segmentEnd)-\(speed)")
        } else {
            lottie.currentFrame(frame)
        }
    }

    /// 瀏海裡的實際顯示尺寸。在 460pt 下好看不代表縮小後讀得出來。
    private var actualSizeComparison: some View {
        HStack(spacing: 28) {
            sizeSample(NotchLayout.indicatorSize, label: "目前設定")
            sizeSample(28, label: "參考：28pt")
        }
    }

    private func sizeSample(_ size: CGFloat, label: String) -> some View {
        VStack(spacing: 6) {
            lottie
                .currentFrame(frame)
                .frame(width: size, height: size)
                .padding(6)
                .background(.black, in: RoundedRectangle(cornerRadius: 6))
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var presets: some View {
        HStack {
            Button("掃描段") {
                segmentStart = Double(TouchIDAnimation.scanStart)
                segmentEnd = Double(TouchIDAnimation.successStart)
                speed = TouchIDAnimation.scanSpeed
            }
            Button("成功段") {
                segmentStart = Double(TouchIDAnimation.successStart)
                segmentEnd = Double(TouchIDAnimation.end)
                speed = TouchIDAnimation.successSpeed
            }
            Button("整支") {
                segmentStart = 0
                segmentEnd = totalFrames
                speed = 1
            }
        }
        .controlSize(.small)
    }

    private var durationSummary: String {
        let frames = max(0, segmentEnd - segmentStart)
        let seconds = frames / TouchIDAnimation.fps / speed
        return String(format: "%.0f frames ＝ %.2f 秒 @ %.2fx", frames, seconds, speed)
    }

    private var lottie: LottieView<EmptyView> {
        LottieView(animation: .named(TouchIDAnimation.name, bundle: .module))
    }

    private func slider(
        _ title: String,
        _ value: Binding<Double>,
        _ range: ClosedRange<Double>,
        format: String = "%.0f"
    ) -> some View {
        HStack {
            Text(title)
                .frame(width: 64, alignment: .leading)
            Slider(value: value, in: range)
            Text(String(format: format, value.wrappedValue))
                .font(.system(.caption, design: .monospaced))
                .frame(width: 54, alignment: .trailing)
        }
    }
}
