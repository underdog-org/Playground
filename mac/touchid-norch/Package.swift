// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TouchIDNotch",
    platforms: [.macOS("26.0")],
    dependencies: [
        // 官方建議用 lottie-spm 而非 lottie-ios，下載快很多
        .package(url: "https://github.com/airbnb/lottie-spm.git", from: "4.6.1"),
    ],
    targets: [
        .target(name: "TouchIDNotchCore"),
        .executableTarget(
            name: "TouchIDNotch",
            dependencies: [
                "TouchIDNotchCore",
                .product(name: "Lottie", package: "lottie-spm"),
            ],
            resources: [.process("Resources")]
        ),
        .testTarget(name: "TouchIDNotchCoreTests", dependencies: ["TouchIDNotchCore"]),
    ]
)
