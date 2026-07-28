#!/bin/bash

# git push 過程中，git 會對本地 .git/ 內的某些檔案上鎖以避免 concurrent 操作破壞資料：
# 1. pack 檔案鎖 — 如果兩邊同時執行 pack-objects，會競爭寫入 .git/objects/pack/。git 內部有 pack-refs.lock 之類的機制，但極端情況下可能產生衝突或暫時性的 .lock 殘留。
# 2. reflog 鎖 — 雖然 git push 預設不更新本地 reflog（只有 fetch 會），但某些 git 版本或 hook 可能會觸發本地寫入，導致競爭。
# 3. ref 讀取不一致 — 兩個 push 同時讀取 refs/heads/main 的 commit SHA，如果一個先完成且某個 hook 修改了本地狀態（例如 post-push hook 觸發了 git gc），另一個在處理時可能讀到不一致的狀態。
# 4. git gc / auto-repack — 最常見的雷：git 背景自動壓縮物件時若剛好撞上另一個 push，可能壞掉。

for r in github gitlab; do git push "$r" main || echo "FAILED: $r"; done