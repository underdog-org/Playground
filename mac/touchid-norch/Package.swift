// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TouchIDNotch",
    platforms: [.macOS("26.0")],
    targets: [
        .target(name: "TouchIDNotchCore"),
        .executableTarget(name: "TouchIDNotch", dependencies: ["TouchIDNotchCore"]),
        .testTarget(name: "TouchIDNotchCoreTests", dependencies: ["TouchIDNotchCore"]),
    ]
)
