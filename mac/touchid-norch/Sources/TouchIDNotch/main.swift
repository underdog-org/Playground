import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
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
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // 設為 .accessory 讓 app 不顯示在 Dock、也不顯示選單列

let delegate = AppDelegate()           // 必須用具名變數持有，否則會被立即釋放
app.delegate = delegate

app.run()