import Testing
@testable import TouchIDNotchCore

@Suite("BiometricSessionTracker")
struct BiometricSessionTrackerTests {
    /// 餵入事件序列，只收集有語意變化的結果。
    private func run(_ events: [BiometricEvent]) -> [BiometricSession] {
        var tracker = BiometricSessionTracker()
        return events.flatMap { tracker.handle($0) }
    }

    @Test("一次成功的驗證（實測序列 id=103）")
    func successfulSession() {
        let result = run([
            .matching(id: 103),
            .fingerOn(id: 103),
            .matched(id: 103),
            .finished(id: 103),
            .finished(id: 103), // log 會重複印
        ])
        #expect(result == [.began, .fingerOn, .succeeded])
    }

    @Test("按錯手指後重試（實測序列 id=106）")
    func retryAfterWrongFinger() {
        let result = run([
            .matching(id: 106),
            .fingerOn(id: 106),
            .fingerOff(id: 106),
            .fingerOn(id: 106),
            .matched(id: 106),
            .finished(id: 106),
            .finished(id: 106),
        ])
        #expect(result == [.began, .fingerOn, .fingerOff, .fingerOn, .succeeded])
    }

    @Test("重複的 finished 只作用一次")
    func duplicateFinishedIsIgnored() {
        let result = run([
            .matching(id: 1),
            .finished(id: 1),
            .finished(id: 1),
        ])
        #expect(result == [.began, .ended])
    }

    @Test("成功後不發 ended，收起交給動畫層")
    func successDoesNotEmitEnded() {
        let result = run([
            .matching(id: 1),
            .fingerOn(id: 1),
            .matched(id: 1),
            .finished(id: 1),
        ])
        #expect(!result.contains(.ended))
    }

    @Test("未碰手指就取消")
    func cancelledBeforeTouch() {
        let result = run([
            .matching(id: 1),
            .finished(id: 1),
        ])
        #expect(result == [.began, .ended])
    }

    @Test("併發的第二組流程被忽略")
    func concurrentSessionIgnored() {
        let result = run([
            .matching(id: 1),
            .matching(id: 2), // 另一個 coreauthd instance
            .fingerOn(id: 2), // 不屬於追蹤中的流程
            .fingerOn(id: 1),
            .matched(id: 1),
            .finished(id: 1),
        ])
        #expect(result == [.began, .fingerOn, .succeeded])
    }

    @Test("結束後可以開始新的流程")
    func sessionsAreSequential() {
        var tracker = BiometricSessionTracker()
        _ = tracker.handle(.matching(id: 1))
        _ = tracker.handle(.finished(id: 1))
        #expect(tracker.handle(.matching(id: 2)) == [.began])
    }

    @Test("流程外的事件不產生輸出")
    func eventsOutsideSessionAreIgnored() {
        let result = run([
            .fingerOff(id: 9),
            .matched(id: 9),
            .finished(id: 9),
        ])
        #expect(result.isEmpty)
    }
}
