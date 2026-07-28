import AppKit
import TouchIDNotchCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let eventStream = BiometricEventStream()
    private var streamTask: Task<Void, Never>?

    func applicationDidFinishLaunching(_: Notification) {
        for screen in NSScreen.screens {
            print("screen: \(screen.localizedName)")
            print("  frame:       \(screen.frame)")
            print("  safeAreaTop: \(screen.safeAreaInsets.top)")
            print("  auxTopLeft:  \(String(describing: screen.auxiliaryTopLeftArea))")
            print("  auxTopRight: \(String(describing: screen.auxiliaryTopRightArea))")
        }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "◉"

        let menu = NSMenu()
        menu.addItem(
            NSMenuItem(
                title: "結束",
                action: #selector(NSApplication.terminate(_:)),
                keyEquivalent: "q"
            )
        )
        statusItem.menu = menu

        streamTask = Task { [eventStream] in
            var tracker = BiometricSessionTracker()
            for await event in eventStream.start() {
                for session in tracker.handle(event) {
                    print("[session] \(session)")
                }
            }
        }
    }

    func applicationWillTerminate(_: Notification) {
        streamTask?.cancel()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // 設為 .accessory 讓 app 不顯示在 Dock、也不顯示選單列

let delegate = AppDelegate() // 必須用具名變數持有，否則會被立即釋放
app.delegate = delegate

app.run()
