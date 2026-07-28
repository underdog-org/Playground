import AppKit
import TouchIDNotchCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let eventStream = BiometricEventStream()
    private var streamTask: Task<Void, Never>?
    private var notchWindow: NotchWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NotchWindow.notchedScreen(),
            let notch = NotchWindow(screen: screen) else {
                let alert = NSAlert()
                alert.messageText = "找不到瀏海"
                alert.informativeText = "這個 App 只支援有瀏海的內建螢幕"
                alert.runModal()
                NSApp.terminate(nil)
                return
            }

        notchWindow = notch
        notch.show()
        
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "◉"

        let menu = NSMenu()
        menu.items = [
            NSMenuItem(title: "結束", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"),
            NSMenuItem(title: "測試動畫", action: #selector(testAnimation), keyEquivalent: "t"),
        ]

        statusItem.menu = menu

        streamTask = Task { [eventStream] in
            var tracker = BiometricSessionTracker()
            var machine = NotchAnimationStateMachine()

            for await event in eventStream.start() {
                for session in tracker.handle(event) {
                    guard let state = machine.handle(session) else { continue }
                    notchWindow?.apply(state)

                    if state == .success {
                        Task {
                            try? await Task.sleep(for: NotchWindow.successHold)
                            if let hidden = machine.successAnimationDidFinish() {
                                notchWindow?.apply(hidden)
                            }
                        }
                    }
                }
            }
        }
    }

    func applicationWillTerminate(_: Notification) {
        streamTask?.cancel()
    }

    @objc private func testAnimation() {
        let window = notchWindow
        Task { @MainActor in
            for state in [NotchAnimationState.breathing, .scanning, .success] {
                window?.apply(state)
                try? await Task.sleep(for: .milliseconds(800))
            }
            window?.apply(.hidden)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // 設為 .accessory 讓 app 不顯示在 Dock、也不顯示選單列

let delegate = AppDelegate() // 必須用具名變數持有，否則會被立即釋放
app.delegate = delegate

app.run()
