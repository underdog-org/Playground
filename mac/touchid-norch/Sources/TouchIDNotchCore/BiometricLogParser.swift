import Foundation

/// 把 `log stream --style ndjson` 的單行輸出解析成 `BiometricEvent`。
///
/// 無狀態、無副作用 —— 餵字串進去、拿事件出來，所以可以完全離線測試。
public struct BiometricLogParser: Sendable {
    private struct LogRecord: Decodable {
        let eventMessage: String
    }

    private let decoder = JSONDecoder()

    public init() {}

    /// 解析一整行 ndjson。非 JSON 的行（例如 log 的開頭提示）回傳 nil。
    public func parse(line: String) -> BiometricEvent? {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("{"),
              let data = trimmed.data(using: .utf8),
              let record = try? decoder.decode(LogRecord.self, from: data)
        else { return nil }

        return parse(eventMessage: record.eventMessage)
    }

    /// 解析 log 紀錄的訊息文本
    public func parse(eventMessage message: String) -> BiometricEvent? {
        guard let match = message.firstMatch(of: /MechanismTouchId\[(\d+)\]/),
              let id = Int(match.1)
        else { return nil }

        // 順序有意義：先比對最具體的字串。
        if message.contains("will start matching") {
            return .matching(id: id)
        }
        if message.contains("has received finger-on") {
            return .fingerOn(id: id)
        }
        if message.contains("has received finger-off") {
            return .fingerOff(id: id)
        }
        if message.contains("has matched") {
            return .matched(id: id)
        }
        if message.contains("has finished with") {
            return .finished(id: id)
        }
        if message.contains("dropped (mechanism finished)") {
            return .finished(id: id)
        }

        return nil
    }
}
