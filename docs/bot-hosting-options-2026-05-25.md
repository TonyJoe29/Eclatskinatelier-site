# Bot hosting options

Render free is tight if the account already uses the free service for the site. I should not create or own a third-party account for the project, because the bot token, affiliate workflow, billing, recovery email and production control need to stay under your ownership.

## Best options

### Option A: Cloudflare Worker + KV/D1

Best free path for the Telegram bot.

- Uses Telegram webhook, not long polling.
- No always-on server needed.
- Cloudflare Workers Free allows 100,000 requests/day, which is far above this bot's expected volume.
- KV or D1 can store pending offers.
- Good for a small approval bot.

Tradeoff: I need to adapt the current Node polling bot into a Worker webhook version.

### Option B: One Render service for both site and bot

Use your existing Render free slot by converting the static site into a small Node web service:

- `/` serves the current static `index.html`.
- `/telegram/webhook` receives Telegram updates.
- Same Render service handles website + bot.

Tradeoff: Render free web services can sleep. Webhooks usually wake them, but the first response may be slower. Local JSON storage is also not durable, so this should use a persistent store if we keep it longer than testing.

### Option C: Keep local for testing

- Run the bot on your PC while testing content flow.
- Cost: free.
- Tradeoff: if the PC sleeps or shuts down, the bot stops.

### Option D: Always-free VPS

Oracle Cloud Always Free or similar can run the current bot as-is.

Tradeoff: more setup, SSH, server updates and security basics.

## Recommendation

Use Cloudflare Worker + D1/KV for the bot, and keep Render only for the website. It avoids the one-service Render limit, avoids a second paid account, and fits the bot's webhook-style workload better than a long-running worker.

## Implementation added

The Cloudflare Worker project now lives in `cloudflare-bot/`.

- Worker entry: `cloudflare-bot/src/worker.js`
- Config: `cloudflare-bot/wrangler.toml`
- Local secrets example: `cloudflare-bot/.dev.vars.example`
- Deploy guide: `cloudflare-bot/README.md`
- Live Worker URL: `https://eclatskinatelier-telegram-bot.eclatskinatelier.workers.dev`
