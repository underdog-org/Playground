# Learning Notes


## Docker Compose & Images

1. 用 ${VAR:?訊息} 而不是 ${VAR:-預設值}

```yaml
POSTGRES_DB: ${DB_NAME:?DB_NAME 未設定，請從 .env.example 複製一份 .env}
```

差別是「沒設變數時早死還是晚死」。給預設值的話，忘了建 .env 會安靜地起一個名字不對的 DB

2. healthcheck 帶了 -U root -d ims

pg_isready 不帶參數會用執行者身分查同名資料庫（root/root），那個庫不存在，於是永遠 unhealthy。0.4 的 server 要 depends_on: service_healthy，這個檢查必須是真的才有意義。

3. Mailpit 不掛 volume

開發用信箱沒有保存價值，MP_MAX_MESSAGES: 500 讓它自己滾動就夠，省一個 volume。