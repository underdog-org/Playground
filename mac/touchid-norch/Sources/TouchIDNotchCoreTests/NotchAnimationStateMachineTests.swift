import Testing
@testable import TouchIDNotchCore

@Suite("NotchAnimationStateMachine")
struct NotchAnimationStateMachineTests {

    private func run(_ sessions: [BiometricSession]) -> [NotchAnimationState] {
        var machine = NotchAnimationStateMachine()
        return sessions.compactMap { machine.handle($0) }
    }

    @Test("成功流程")
    func successfulFlow() {
        #expect(run([.began, .fingerOn, .succeeded]) == [.breathing, .scanning, .success])
    }

    @Test("手指移開退回呼吸")
    func fingerOffReturnsToBreathing() {
        #expect(run([.began, .fingerOn, .fingerOff]) == [.breathing, .scanning, .breathing])
    }

    @Test("取消直接收起")
    func cancelHides() {
        #expect(run([.began, .ended]) == [.breathing, .hidden])
    }

    @Test("狀態沒變化時不重複發出")
    func noRedundantTransitions() {
        var machine = NotchAnimationStateMachine()
        _ = machine.handle(.began)
        #expect(machine.handle(.fingerOff) == nil)   // 已經在 breathing
    }

    @Test("成功後不會自己收起")
    func successDoesNotAutoDismiss() {
        var machine = NotchAnimationStateMachine()
        _ = machine.handle(.began)
        _ = machine.handle(.succeeded)
        #expect(machine.state == .success)
    }

    @Test("成功動畫播完才收起")
    func dismissAfterSuccessAnimation() {
        var machine = NotchAnimationStateMachine()
        _ = machine.handle(.began)
        _ = machine.handle(.succeeded)
        #expect(machine.successAnimationDidFinish() == .hidden)
    }

    @Test("非成功狀態下忽略成功動畫完成回呼")
    func ignoresStaleAnimationCallback() {
        var machine = NotchAnimationStateMachine()
        _ = machine.handle(.began)
        #expect(machine.successAnimationDidFinish() == nil)
        #expect(machine.state == .breathing)
    }

    @Test("watchdog 從任何狀態都能收起")
    func watchdogForcesHidden() {
        var machine = NotchAnimationStateMachine()
        _ = machine.handle(.began)
        _ = machine.handle(.fingerOn)
        #expect(machine.timedOut() == .hidden)
    }

    @Test("已經收起時 watchdog 不做事")
    func watchdogNoOpWhenHidden() {
        var machine = NotchAnimationStateMachine()
        #expect(machine.timedOut() == nil)
    }
}