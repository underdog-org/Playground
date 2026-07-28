import AppKit
import SwiftUI
import TouchIDNotchCore

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusItem: NSStatusItem!
    private var notchWindow: NotchWindow?
    private var scrubberWindow: NSWindow?

    private let eventStream = BiometricEventStream()
    private var streamTask: Task<Void, Never>?

    // 狀態必須是屬性而非 local var —— 延遲的 Task 要能改到同一份。
    private var tracker = BiometricSessionTracker()
    private var machine = NotchAnimationStateMachine()

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let screen = NotchWindow.notchedScreen(),
              let notch = NotchWindow(screen: screen)
        else {
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
        // template 模式讓圖示自動適應淺色／深色選單列
        let icon = NSImage(systemSymbolName: "touchid", accessibilityDescription: "Touch ID")
        icon?.isTemplate = true
        statusItem.button?.image = icon

        let menu = NSMenu()
        menu.items = [
            NSMenuItem(title: "測試動畫", action: #selector(testAnimation), keyEquivalent: "t"),
            NSMenuItem(title: "Lottie Scrubber", action: #selector(openScrubber), keyEquivalent: "s"),
            .separator(),
            NSMenuItem(title: "結束", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"),
        ]
        // action 走 responder chain，AppDelegate 不在鏈上，要明確指定 target。
        for item in menu.items where item.action != #selector(NSApplication.terminate(_:)) {
            item.target = self
        }
        statusItem.menu = menu

        streamTask = Task { [weak self] in
            guard let self else { return }
            for await event in eventStream.start() {
                handle(event)
            }
        }
    }

    func applicationWillTerminate(_: Notification) {
        streamTask?.cancel()
    }

    private func handle(_ event: BiometricEvent) {
        for session in tracker.handle(event) {
            guard let state = machine.handle(session) else { continue }
            notchWindow?.apply(state)

            if state == .success {
                Task { [weak self] in
                    try? await Task.sleep(for: NotchWindow.successHold)
                    guard let self, let hidden = machine.successAnimationDidFinish() else { return }
                    notchWindow?.apply(hidden)
                }
            }
        }
    }

    @objc private func testAnimation() {
        Task { [weak self] in
            for state in [NotchAnimationState.breathing, .scanning, .success] {
                self?.notchWindow?.apply(state)
                try? await Task.sleep(for: .milliseconds(800))
            }
            self?.notchWindow?.apply(.hidden)
        }
    }

    @objc private func openScrubber() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 900),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Lottie Scrubber"
        window.contentView = NSHostingView(rootView: LottieScrubber())
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()          // .accessory 政策下要主動搶焦點才看得到視窗
        scrubberWindow = window   // 屬性持有，否則視窗會被立即釋放
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)   // 不顯示在 Dock

let delegate = AppDelegate()           // 必須具名持有，delegate 是 weak reference
app.delegate = delegate

app.run()