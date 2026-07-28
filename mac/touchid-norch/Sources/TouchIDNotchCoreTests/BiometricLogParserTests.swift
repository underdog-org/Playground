
import Testing
@testable import TouchIDNotchCore

@Suite("BiometricLogParser")
struct BiometricLogParserTests {
    let parser = BiometricLogParser()

    /// 去測試各種不同的手勢與情境
    @Test("辨識開始等待手指")
    func matching() {
        let msg = "MechanismTouchId[52](run) will start matching user 501"
        #expect(parser.parse(eventMessage: msg) == .matching(id: 52))
    }

    @Test("辨識手指碰上與離開")
    func fingerOnOff() {
        let on = "MechanismTouchId[52](run) has received finger-on from <BKMatchTouchIDOperation: 0xa58c56680>"
        let off = "MechanismTouchId[52](run) has received finger-off from <BKMatchTouchIDOperation: 0xa58c56680>"
        #expect(parser.parse(eventMessage: on) == .fingerOn(id: 52))
        #expect(parser.parse(eventMessage: off) == .fingerOff(id: 52))
    }

    @Test("辨識比對成功")
    func matched() {
        let msg = "MechanismTouchId[52](run) has matched by <private> (unlocked:1"
        #expect(parser.parse(eventMessage: msg) == .matched(id: 52))
    }

    @Test("取消與收尾都算 finished")
    func finished() {
        let cancelled = #"MechanismTouchId[52](run) has finished with Error Domain=com.apple.LocalAuthentication Code=-9 "Invalidated by client.""#
        let dropped = "MechanismTouchId[52](run)> dropped (mechanism finished)"
        #expect(parser.parse(eventMessage: cancelled) == .finished(id: 52))
        #expect(parser.parse(eventMessage: dropped) == .finished(id: 52))
    }

    @Test("保留 mechanism 編號以區分併發流程")
    func distinctIDs() {
        let a = "MechanismTouchId[50](run) will start matching user 501"
        let b = "MechanismTouchId[985](run) will start matching user 501"
        #expect(parser.parse(eventMessage: a)?.id == 50)
        #expect(parser.parse(eventMessage: b)?.id == 985)
    }

    /// 以下是誤判防線 —— 這些行都含 MechanismTouchId[N]，但都不是狀態轉換。
    @Test("assertion 記錄不該被當成事件")
    func assertionLineIsNotAnEvent() {
        let msg = "LW assertion acquisition for 'MechanismTouchId[52] for PID:413 since 4:55:29 PM' successful (0)"
        #expect(parser.parse(eventMessage: msg) == nil)
    }

    @Test("shield 記錄不該被當成事件")
    func shieldLineIsNotAnEvent() {
        let msg = "<MechanismAssertionLoginWindowShield on MechanismTouchId[52]> confirmed (successful acquisition for mechanism starting)"
        #expect(parser.parse(eventMessage: msg) == nil)
    }

    @Test("與 TouchID 無關的行回傳 nil")
    func unrelatedLine() {
        let msg = "AgentProxy for coreauthd[697] (agent for user 501) has registered uuid ee7feac"
        #expect(parser.parse(eventMessage: msg) == nil)
    }

    @Test("非 JSON 的行不會讓解析器爆掉")
    func nonJSONLine() {
        #expect(parser.parse(line: "Filtering the log data using \"subsystem == ...\"") == nil)
    }

    @Test("完整 ndjson 行可解析")
    func ndjsonLine() {
        let line = #"{"timestamp":"2026-07-28 16:55:29.119109+0800","eventMessage":"MechanismTouchId[52](run) will start matching user 501","subsystem":"com.apple.LocalAuthentication"}"#
        #expect(parser.parse(line: line) == .matching(id: 52))
    }
}
