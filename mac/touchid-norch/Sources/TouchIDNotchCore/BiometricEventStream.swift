import Foundation

/// 啟動 `log stream` 子行程，把輸出解析成 `BiometricEvent` 串流。
///
/// 併發模型：`buffer` 與 `process` 只在 `queue` 這條序列佇列上存取，
/// 這是 `@unchecked Sendable` 得以成立的前提，改動時務必維持這個不變量。
/// `FileHandle.readabilityHandler` 本身是序列呼叫，每塊資料再依序 dispatch 到
/// `queue`，因此事件送出順序等同 log 產生順序。
public final class BiometricEventStream: @unchecked Sendable {
    /// 六種 TouchID 狀態轉換字串全部落在這個 category（macOS 26.5.2 實測確認）。
    public static let predicate = """
    subsystem == "com.apple.LocalAuthentication" \
    AND category == "Server,Interactive,Biometry"
    """

    private let queue = DispatchQueue(label: "com.touchidnotch.biometric-log")
    private let parser = BiometricLogParser()

    // 以下兩者只在 `queue` 上存取
    private var buffer = LineBuffer()
    private var process: Process?

    public init() {}

    /// 啟動串流。回傳的 sequence 結束（或被取消）時會自動終止子行程。
    public func start() -> AsyncStream<BiometricEvent> {
        AsyncStream(bufferingPolicy: .unbounded) { continuation in
            queue.async { [self] in
                launch(yieldingTo: continuation)
            }
            continuation.onTermination = { [self] _ in
                queue.async { [self] in terminate() }
            }
        }
    }

    private func launch(yieldingTo continuation: AsyncStream<BiometricEvent>.Continuation) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/log")
        process.arguments = [
            "stream",
            "--style", "ndjson",
            "--predicate", Self.predicate,
        ]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        // readabilityHandler 裡沒有直接寫 Task { await ... }。
        // 用 Task 的話每塊資料會變成獨立的非同步工作，執行順序不保證
        pipe.fileHandleForReading.readabilityHandler = { [self] handle in
            let chunk = handle.availableData
            guard !chunk.isEmpty else { return }
            queue.async { [self] in
                for line in buffer.append(chunk) {
                    if let event = parser.parse(line: line) {
                        continuation.yield(event)
                    }
                }
            }
        }

        process.terminationHandler = { _ in
            continuation.finish()
        }

        do {
            try process.run()
            self.process = process
        } catch {
            continuation.finish()
        }
    }

    private func terminate() {
        process?.terminationHandler = nil // 要避免自己觸發 finish
        process?.terminate()
        process = nil
    }
}
