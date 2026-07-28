import Foundation

/// 把任意切割的位元組區塊重組成完整的行。
public struct LineBuffer {
    /// 單行上限。超過就丟棄，避免異常輸入把記憶體吃光。
    private static let maxPendingBytes = 1 << 20 // 1 MB

    private var pending = Data()

    public init() {}

    /// 餵入一塊資料，回傳其中所有已完整的行（不含換行字元）。
    public mutating func append(_ chunk: Data) -> [String] {
        pending.append(chunk)

        var lines: [String] = []
        while let newline = pending.firstIndex(of: 0x0A) {
            let lineData = pending[pending.startIndex ..< newline]
            pending.removeSubrange(pending.startIndex ... newline)
            if let line = String(data: lineData, encoding: .utf8) {
                lines.append(line)
            }
        }

        if pending.count > Self.maxPendingBytes {
            pending.removeAll()
        }

        return lines
    }
}
