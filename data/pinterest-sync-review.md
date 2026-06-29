# Pinterest Sync Review Queue

Items in this file were detected in recent Pinterest activity but were not published automatically because the exact affiliate link or product identity still needs verification.

## 2026-06-29

No recent Pinterest pins were returned by `node tools/fetch-pinterest-feed.mjs --days 3 --limit 30 --write`, so no products were eligible for publication.

The public RSS feed still tops out at `2026-06-12T16:03:27.000Z`, so `Current Favs` was left unchanged rather than backfilling older pins as if they were new.

Products moved into `Current Favs` on this run:

- None. The 2026-06-26 through 2026-06-29 lookback window contained 0 pins.

## 2026-06-24

No recent Pinterest pins were returned by `node tools/fetch-pinterest-feed.mjs --days 3 --limit 30 --write`, so no products were eligible for publication.

The latest RSS pin currently available on the public profile is still dated 2026-06-12, so `Current Favs` was not refreshed with new products on this run.

Products moved into `Current Favs` on this run:

- None. The 2026-06-21 through 2026-06-24 lookback window contained 0 pins.

## 2026-06-20

No recent Pinterest pins were returned by `node tools/fetch-pinterest-feed.mjs --days 3 --limit 30 --write`, so no products were eligible for publication.

Products moved into `Current Favs` on this run:

- None. The feed contained 0 pins for the 3-day lookback window.

## 2026-06-13

| Product or content lane | Pinterest evidence | Missing requirement | Status |
|---|---|---|---|
| Generic niacinamide serum review | 2026-06-12 pin titled `Clear Skin Secrets: Niacinamide Serum Review`; thumbnail shows creator only, not the product | Exact brand/SKU match before mapping to existing niacinamide affiliate entry | Hold |
| Unlabeled serum bottle pin | 2026-06-12 pin about oily T-zone and breakouts points to `https://eclatskinatelier-site.onrender.com/?qa_test=1&utm_source=codex&utm_campaign=replay_final`; thumbnail shows a small serum bottle without readable label | Exact product identity and a clean public destination URL without QA params | Hold |
| NYX Butter Gloss review pin | 2026-06-11 pin thumbnail clearly shows `NYX Butter Gloss` in shade `Praline` | Verified affiliate URL and product record in site data | Hold |
| Butter Gloss day-one pin | 2026-06-11 pin thumbnail shows `NYX Butter Gloss`, but the exact shade/variant is not readable | Exact variant plus verified affiliate URL in site data | Hold |

Products moved into `Current Favs` on this run:

- None. The 2026-06-11 to 2026-06-12 pins did not clear identity plus affiliate validation.

## 2026-06-10

| Product or content lane | Pinterest evidence | Missing requirement | Status |
|---|---|---|---|
| CeraVe Moisturizing Cream | Pin image from 2026-06-08 shows cream tub, not current verified Daily Moisturizing Lotion | Exact affiliate URL for Moisturizing Cream | Hold |
| CeraVe Resurfacing Retinol Serum | Pin image from 2026-06-09 shows exact serum | Verified affiliate URL in site data | Hold |
| mixsoon PDRN Collagen Gel Cleanser | Three K-beauty cleanser pins from 2026-06-08 mention exact cleanser | Verified affiliate URL and official product source in site data | Hold |
| K-beauty retinal eye treatment | Eye-serum pin from 2026-06-08 suggests retinal eye care but not exact SKU in current data | Exact product identity and affiliate URL | Hold |
| Image-only CeraVe partner pin | 2026-06-09 pin shows brand but not enough readable SKU text | Exact product identity and affiliate URL | Hold |

Products moved into `Current Favs` because product identity, affiliate link and official image were all verified:

- Halo Glow Liquid Filter
- Aquaphor Healing Ointment

## 2026-06-06

| Product or content lane | Pinterest evidence | Missing requirement | Status |
|---|---|---|---|
| Round Lab Birch Juice UVLOCK Sunscreen | Recent K-beauty SPF pins from 2026-06-06 | Verified Amazon affiliate URL | Hold |
| CLIO Kill Cover cushion | Recent cushion/base pins from 2026-06-04 | Verified Amazon affiliate URL and exact shade/product variant | Hold |
| NYX Fat Oil Lip Drip | Recent lip oil pins from 2026-06-04 | Verified Amazon affiliate URL and exact shade/variant | Hold |
| Naturium Glow Getter body wash | Recent bodycare texture pin from 2026-06-05 | Verified Amazon affiliate URL and exact product match | Hold |

Products moved into `Current Favs` because their existing affiliate records were verified:

- Neutrogena Purescreen+ Mineral UV Tint
- La Roche-Posay Anthelios SPF 40
- Maybelline Sky High Mascara
- eos Vanilla Cashmere Lotion
- Sol de Janeiro Cheirosa 62 Perfume Mist
