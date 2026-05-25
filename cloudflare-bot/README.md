# Cloudflare Telegram bot

Webhook version of the EclatSkinAtelier Telegram approval bot.

Cloudflare Workers is a better free fit than a Render background worker because Telegram calls the Worker only when there is an update. No always-on process is needed.

## What it does

1. Receives Telegram updates through `/telegram/webhook`.
2. Lets only `TELEGRAM_ADMIN_CHAT_ID` create or approve offers.
3. Stores pending offers in Workers KV.
4. Sends you a private preview with `Aprobar` / `Rechazar`.
5. Publishes approved offers to `TELEGRAM_GROUP_CHAT_ID`.
6. Runs a scheduled offer scanner every 30 minutes when a compliant feed is configured.

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
SCAN_ENABLED=true
MAX_SCAN_CANDIDATES=5
DEAL_FEED_URL=
DEAL_FEED_BEARER_TOKEN=
```

`TELEGRAM_WEBHOOK_SECRET` can be any long random string. Telegram sends it back in the `X-Telegram-Bot-Api-Secret-Token` header.

## Offer scanner

The scanner is wired for Cloudflare Cron Triggers and can also be run manually from Telegram with:

```text
/scan
```

Use `/scan 10` to process up to 10 candidates in one run. The Worker deduplicates scanned candidates for 7 days, stores valid candidates as pending offers, and sends the admin a private preview with approval buttons. The group still only receives approved offers.

The scanner expects a compliant source such as Amazon Creators API/Product Advertising API or your own normalized deal feed. It does not scrape Amazon pages.

Configure the source as Cloudflare secrets:

```bash
npx wrangler secret put DEAL_FEED_URL
npx wrangler secret put DEAL_FEED_BEARER_TOKEN
```

`DEAL_FEED_BEARER_TOKEN` is optional. `DEAL_FEED_URL` should return JSON as an array or as `offers`, `items`, `deals`, `data`, or `results`:

```json
{
  "offers": [
    {
      "title": "Maybelline Lash Sensational Sky High Mascara",
      "url": "https://www.amazon.com/dp/B08H4FSGDW",
      "image": "https://example.com/product.jpg",
      "before": 14.99,
      "after": 10.99,
      "rating": 4.5,
      "reviews": 85000,
      "category": "makeup",
      "source": "Amazon Creators API",
      "foundAt": "2026-05-25T18:00:00.000Z"
    }
  ]
}
```

The same MVP rules apply: minimum discount, review count, rating, category, Amazon US affiliate tag, and public image URL.

## Deploy

Set production secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
npx wrangler secret put TELEGRAM_GROUP_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put DEAL_FEED_URL
```

Deploy:

```bash
npm run deploy
```

Wrangler will print a URL like:

```text
https://eclatskinatelier-telegram-bot.eclatskinatelier.workers.dev
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
$url = "https://eclatskinatelier-telegram-bot.eclatskinatelier.workers.dev/telegram/webhook"
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
https://eclatskinatelier-telegram-bot.eclatskinatelier.workers.dev/
```

Expected response:

```json
{"ok":true,"service":"eclatskinatelier-telegram-bot"}
```

Then send `/status` to the bot privately. Send `/scan` to trigger a manual scan; if no `DEAL_FEED_URL` is configured yet, the bot will explain that the scanner is installed and waiting for the feed.
