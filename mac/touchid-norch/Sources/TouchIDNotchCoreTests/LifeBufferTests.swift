import Foundation
import Testing
@testable import TouchIDNotchCore

@Suite("LineBuffer")
struct LineBufferTests {
    @Test("單一完整行")
    func singleLine() {
        var buffer = LineBuffer()
        #expect(buffer.append(Data("hello\n".utf8)) == ["hello"])
    }

    @Test("一次餵入多行")
    func multipleLines() {
        var buffer = LineBuffer()
        #expect(buffer.append(Data("a\nb\nc\n".utf8)) == ["a", "b", "c"])
    }

    @Test("半行會留到下一塊才吐出")
    func partialLineAcrossChunks() {
        var buffer = LineBuffer()
        #expect(buffer.append(Data("hel".utf8)).isEmpty)
        #expect(buffer.append(Data("lo\n".utf8)) == ["hello"])
    }

    @Test("結尾沒有換行就不算完整")
    func trailingPartialIsHeld() {
        var buffer = LineBuffer()
        #expect(buffer.append(Data("done\nincomplete".utf8)) == ["done"])
        #expect(buffer.append(Data("\n".utf8)) == ["incomplete"])
    }

    @Test("切在 UTF-8 多位元組字元中間不會壞掉")
    func splitInsideMultibyteCharacter() {
        var buffer = LineBuffer()
        let full = Data("瀏海\n".utf8)
        // 「瀏」佔 3 bytes，故意切在第 2 個 byte
        #expect(buffer.append(full.prefix(2)).isEmpty)
        #expect(buffer.append(full.dropFirst(2)) == ["瀏海"])
    }

    @Test("空資料不產生行")
    func emptyChunk() {
        var buffer = LineBuffer()
        #expect(buffer.append(Data()).isEmpty)
    }
}
