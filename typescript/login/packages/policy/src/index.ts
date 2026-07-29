// @ims/policy —— 有效權限的演算：RBAC ∩ Entitlement。
//
// 這個 package 是純函式，刻意不依賴 DB / HTTP / Fastify（見 ARCHITECTURE §9）。
// 呼叫端負責把資料讀好再傳進來，換來的是交集邏輯與三種拒絕語意
// （permission_denied / seat_required / plan_upgrade_required）
// 可以用純 unit test 窮舉，不必拉起 DB。
//
// Stage 3（RBAC）與 Stage 4（Entitlement）才會有內容。這裡先立好位置。

export {};
