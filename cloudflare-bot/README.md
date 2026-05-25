# Cloudflare Telegram bot

Webhook version of the EclatSkinAtelier Telegram approval bot.

Cloudflare Workers is a better free fit than a Render background worker because Telegram calls the Worker only when there is an update. No always-on process is needed.

## What it does

1. Receives Telegram updates through `/telegram/webhook`.
2. Lets only `TELEGRAM_ADMIN_CHAT_ID` create or approve offers.
3. Stores pending offers in Workers KV.
4. Sends you a private preview with `Aprobar` / `Rechazar`.
5. Publishes approved offers to `TELEGRAM_GROUP_CHAT_ID`.

## Setup

Install dependencies:

```bash
npm install
```

Log in to Cloudflare:

```bash
npx wrangler login
```

Create the KV namespace:

```bash
npm run kv:create
```

Copy the returned namespace ID into `wrangler.toml`, replacing:

```toml
id = "REPLACE_WITH_KV_NAMESPACE_ID"
```

Create local dev vars:

```bash
cp .dev.vars.example .dev.vars
```

Fill:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_GROUP_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
```

`TELEGRAM_WEBHOOK_SECRET` can be any long random string. Telegram sends it back in the `X-Telegram-Bot-Api-Secret-Token` header.

## Deploy

Set production secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
npx wrangler secret put TELEGRAM_GROUP_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Deploy:

```bash
npm run deploy
```

Wrangler will print a URL like:

```text
https://eclatskinatelier-telegram-bot.<your-subdomain>.workers.dev
```

Register Telegram webhook:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\":\"https://eclatskinatelier-telegram-bot.<your-subdomain>.workers.dev/telegram/webhook\",\"secret_token\":\"<TELEGRAM_WEBHOOK_SECRET>\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
```

On PowerShell, use:

```powershell
$token = "TELEGRAM_BOT_TOKEN"
$secret = "TELEGRAM_WEBHOOK_SECRET"
$url = "https://eclatskinatelier-telegram-bot.<your-subdomain>.workers.dev/telegram/webhook"
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body (@{
  url = $url
  secret_token = $secret
  allowed_updates = @("message", "callback_query")
} | ConvertTo-Json)
```

Important: stop the local polling bot before enabling the webhook.

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^node(\\.exe)?$' -and $_.CommandLine -match 'telegram-bot|src\\\\bot\\.mjs|src/bot\\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## Test

Open:

```text
https://eclatskinatelier-telegram-bot.<your-subdomain>.workers.dev/
```

Expected response:

```json
{"ok":true,"service":"eclatskinatelier-telegram-bot"}
```

Then send `/status` to the bot privately.
