# Summer Journal Affiliate Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the EclatSkinAtelier homepage as the approved warm-pastel Summer Journal, connect every editorial gateway to working product filters, and publish a measurable 14-day content plan using only verified affiliate products.

**Architecture:** Keep the site static and compatible with its current Render/GitHub workflow. Use `index.html` as the rendered experience, a small standalone browser-filter module for testable interaction logic, the existing CSV product database as the affiliate source of truth, and Node-based validation scripts for HTML, links, product integrity, and content-plan coverage.

**Tech Stack:** Static HTML/CSS, vanilla JavaScript ES modules, Node.js standard library, CSV/JSON source files, Paper MCP design reference, Browser plugin, Git, Render.

---

## File Structure

- Modify: `index.html`
  - Homepage markup, warm-pastel design system, editorial sections, product browser, accessible controls and responsive styles.
- Create: `assets/js/product-browser.mjs`
  - URL-aware product filtering, search, counts, empty state and category shortcut behavior.
- Create: `tools/validate-summer-journal.mjs`
  - Structural, affiliate-link, image, disclosure, category and content-plan validation.
- Modify: `data/analytics/products.csv`
  - Add verification and editorial fields without changing existing affiliate URLs.
- Modify: `data/analytics/social-posts.csv`
  - Record current Pinterest assets when exact products can be matched.
- Create: `data/product-focus-2026-06-07-to-06-20.csv`
  - Product priority, editorial lane, verification state and expected funnel role.
- Create: `data/content-plan-2026-06-07-to-06-20.csv`
  - Daily five-Pin/two-Reel schedule for 14 days.
- Create: `docs/analysis-summer-product-focus-2026-06-06.md`
  - Decision-ready analysis, assumptions, product tiers, benchmarks and review rules.
- Modify: `README.md`
  - Updated local QA, data and deployment instructions.

## Task 1: Lock The Current Baseline With Validation

**Files:**
- Create: `tools/validate-summer-journal.mjs`
- Read: `index.html`
- Read: `data/analytics/products.csv`

- [ ] **Step 1: Write the failing structural validator**

Create a Node script that loads `index.html` and fails until the new experience exists:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const requiredIds = [
  "summer-journal",
  "summer-categories",
  "featured-guide",
  "trending-products",
  "routine-of-the-week",
  "journal-stories",
  "product-browser",
  "product-empty-state",
];

const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) {
  throw new Error(`Missing required sections: ${missingIds.join(", ")}`);
}
```

- [ ] **Step 2: Add affiliate and accessibility assertions**

The validator must also check:

```js
const amazonLinks = [...html.matchAll(/<a\b[^>]*href="([^"]*(?:amzn\.to|amazon\.com)[^"]*)"[^>]*>/gi)];

for (const [tag, href] of amazonLinks) {
  if (!/rel="[^"]*\bnofollow\b[^"]*\bsponsored\b[^"]*\bnoopener\b[^"]*"/i.test(tag)) {
    throw new Error(`Affiliate link missing rel attributes: ${href}`);
  }
}

if (!/As an Amazon Associate/i.test(html)) {
  throw new Error("Amazon Associates disclosure is missing");
}

if (/<img\b(?![^>]*\balt=)/i.test(html)) {
  throw new Error("At least one image is missing alt text");
}
```

- [ ] **Step 3: Run the validator and confirm the expected failure**

Run:

```powershell
node tools/validate-summer-journal.mjs
```

Expected: FAIL listing the new section IDs that do not exist yet.

- [ ] **Step 4: Record the existing working-tree boundaries**

Run:

```powershell
git status --short
git diff -- docs/plan-semana-2026-05-25.md
```

Expected: preserve the user's existing modification in `docs/plan-semana-2026-05-25.md`; do not stage or rewrite it.

- [ ] **Step 5: Commit the validator**

```powershell
git add tools/validate-summer-journal.mjs
git commit -m "Add Summer Journal validation"
```

## Task 2: Normalize Product Data For Editorial Use

**Files:**
- Modify: `data/analytics/products.csv`
- Create: `data/product-focus-2026-06-07-to-06-20.csv`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Extend the product CSV schema**

Append these columns:

```csv
editorial_lane,priority_tier,best_for,skip_if,last_verified
```

Populate every existing row. Do not alter any non-empty `affiliate_link`.

- [ ] **Step 2: Add product-data validation**

Parse CSV with a quoted-field-aware parser and assert:

```js
const requiredProductFields = [
  "product_id",
  "product_name",
  "category",
  "current_status",
  "official_image_source",
  "editorial_lane",
  "priority_tier",
  "best_for",
  "skip_if",
  "last_verified",
];
```

Rules:

- Active products require an affiliate URL.
- Active products require an official or approved local fallback image.
- `last_verified` must use `YYYY-MM-DD`.
- Watchlist/bank products may not be rendered with shop buttons.
- Existing affiliate URLs must match a frozen pre-edit snapshot.

- [ ] **Step 3: Create the two-week product-focus table**

Use this schema:

```csv
product_id,product_name,editorial_lane,tier,verification_state,funnel_role,planned_pins,planned_reels,scale_rule,notes
```

Initial allocation:

- Sun + Skin: Neutrogena Purescreen+, La Roche-Posay Anthelios, Round Lab watchlist.
- Body Rituals: eos Vanilla Cashmere, Sol de Janeiro 62, Aquaphor.
- Gloss + Glow: LANEIGE Bouncy & Firm, Maybelline Sky High, NYX watchlist.
- K-Beauty Summer: Biodance, Medicube Zero Pore Pad, CLIO watchlist.
- Easy Routines: Clean Skin Club, CeraVe Daily Lotion, The Ordinary Niacinamide, Hero Mighty Patch.

- [ ] **Step 4: Run product validation**

```powershell
node tools/validate-summer-journal.mjs --products-only
```

Expected: PASS with the number of active, bank and watchlist products.

- [ ] **Step 5: Commit normalized product data**

```powershell
git add data/analytics/products.csv data/product-focus-2026-06-07-to-06-20.csv tools/validate-summer-journal.mjs
git commit -m "Structure Summer Journal product data"
```

## Task 3: Build A Testable Product Browser

**Files:**
- Create: `assets/js/product-browser.mjs`
- Modify: `index.html`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Write failing filter assertions**

Expose pure functions:

```js
export function normalizeFilter(value) {
  return String(value || "all").trim().toLowerCase();
}

export function productMatches({ categories, text }, filter, query) {
  const activeFilter = normalizeFilter(filter);
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const categoryMatch = activeFilter === "all" || categories.includes(activeFilter);
  const searchMatch = !normalizedQuery || text.includes(normalizedQuery) || categories.join(" ").includes(normalizedQuery);
  return categoryMatch && searchMatch;
}
```

Add validator tests covering:

- `spf` matches SPF cards.
- `bodycare` excludes mascara.
- Search and filter combine.
- Invalid filter falls back to `all`.

- [ ] **Step 2: Run tests and verify failure**

```powershell
node tools/validate-summer-journal.mjs --browser-unit
```

Expected: FAIL because `assets/js/product-browser.mjs` does not exist.

- [ ] **Step 3: Implement browser state**

The module must:

- Read `category` and `q` from `URLSearchParams`.
- Update URL with `history.replaceState`.
- Apply `.active` and `aria-pressed` to filter controls.
- Hide/show `.product-card`.
- Update `#result-count`.
- Toggle `#product-empty-state`.
- Scroll to and focus `#product-browser-heading` after category shortcuts.
- Handle `popstate`.

- [ ] **Step 4: Replace the existing inline filter code**

In `index.html`:

```html
<script type="module" src="assets/js/product-browser.mjs"></script>
```

Keep mobile navigation and reveal behavior in a separate short inline script or module initialization block.

- [ ] **Step 5: Run unit and structural validation**

```powershell
node tools/validate-summer-journal.mjs --browser-unit
node tools/validate-summer-journal.mjs
```

Expected: browser unit tests PASS; structural test still fails only for unfinished Summer Journal sections.

- [ ] **Step 6: Commit browser logic**

```powershell
git add assets/js/product-browser.mjs index.html tools/validate-summer-journal.mjs
git commit -m "Fix category and search navigation"
```

## Task 4: Implement The Warm-Pastel Editorial Shell

**Files:**
- Modify: `index.html`
- Reference: approved Paper artboard
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Read exact Paper values**

Before editing, use Paper MCP:

- `get_jsx` for the full approved artboard.
- `get_computed_styles` for the announcement bar, masthead, hero, category gateway, featured guide and newsletter.
- Use those values instead of estimating from screenshots.

- [ ] **Step 2: Define CSS tokens**

Add:

```css
:root {
  --paper-white: #ffffff;
  --powder-rose: #f1e3e1;
  --soft-sage: #e8ebdd;
  --light-peach: #f4e6e3;
  --deep-plum: #563b43;
  --editorial-burgundy: #6b2d35;
  --warm-coral: #d98f7c;
  --ink: #202020;
  --muted-ink: #526268;
  --rule: #d9d9d9;
}
```

- [ ] **Step 3: Replace announcement, header and hero**

Required structure:

```html
<div class="announcement-bar">The Summer Beauty Edit - New stories every week</div>
<header class="journal-header">...</header>
<section class="summer-hero" id="summer-journal">...</section>
```

Preserve:

- English-only copy.
- Centered EclatSkinAtelier brand.
- Journal, Routines, About, Summer Edit and Shop navigation.
- Affiliate disclosure accessible from header/footer.
- Image-led hero with next-section content visible on desktop and mobile.

- [ ] **Step 4: Implement responsive shell**

Desktop: asymmetric 47/53 hero.

Mobile:

- Stack text and image.
- Keep the product/skin subject visible.
- Keep headline below 48px.
- Use full-width CTA buttons.
- Prevent text from overlaying the image.

- [ ] **Step 5: Validate HTML**

```powershell
node tools/validate-summer-journal.mjs
```

Expected: no disclosure, image-alt or header failures; remaining failures identify unfinished content sections.

- [ ] **Step 6: Browser checkpoint**

Start a local server:

```powershell
python -m http.server 8765
```

Use Browser to inspect:

- `1440x900`.
- `390x844`.

Compare the rendered header/hero against Paper. Fix typography, first-viewport balance, palette and clipping before continuing.

- [ ] **Step 7: Commit the editorial shell**

```powershell
git add index.html
git commit -m "Build Summer Journal editorial shell"
```

## Task 5: Implement Categories And Featured SPF Guide

**Files:**
- Modify: `index.html`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Add category gateways**

Create `#summer-categories` with five gateway controls:

```html
<a href="?category=spf#product-browser" data-filter-link="spf">Sun + Skin</a>
<a href="?category=bodycare#product-browser" data-filter-link="bodycare">Body Rituals</a>
<a href="?category=lip-care#product-browser" data-filter-link="lip-care">Gloss + Glow</a>
<a href="?category=k-beauty#product-browser" data-filter-link="k-beauty">K-Beauty</a>
<a href="?category=beginner-friendly#product-browser" data-filter-link="beginner-friendly">Easy Routines</a>
```

- [ ] **Step 2: Add featured SPF guide**

Create `#featured-guide` with:

- Official La Roche-Posay image and local fallback.
- Neutrogena and La Roche active comparisons.
- Round Lab marked `Watchlist - affiliate link pending`.
- No Amazon button for Round Lab.
- Link to a dedicated comparison anchor or article.

- [ ] **Step 3: Extend validator for gateway integrity**

Assert:

- Every `data-filter-link` value exists on at least one active product card, except documented watchlist-only filters.
- Every gateway targets `#product-browser`.
- Watchlist labels are present where a non-active product is named.

- [ ] **Step 4: Run validation and browser interaction checks**

```powershell
node tools/validate-summer-journal.mjs
```

In Browser click all five gateways and verify:

- Correct filter.
- Correct count.
- Visible results.
- URL state.
- Keyboard focus.

- [ ] **Step 5: Commit categories and SPF guide**

```powershell
git add index.html tools/validate-summer-journal.mjs
git commit -m "Add Summer categories and SPF guide"
```

## Task 6: Implement Trending Products And Routine Of The Week

**Files:**
- Modify: `index.html`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Add the trending rail**

Create `#trending-products` with:

- Neutrogena Purescreen+.
- eos Vanilla Cashmere.
- Maybelline Sky High.

Each product includes:

- Official image with local fallback.
- Editorial signal label.
- Best-use note.
- Internal notes/comparison link.
- Verified Amazon link.
- Nearby disclosure.

- [ ] **Step 2: Add the weekly routine**

Create `#routine-of-the-week`:

1. Clean Skin Club Towels.
2. The Ordinary Niacinamide, explicitly optional.
3. CeraVe Daily Lotion, explicitly conditional.
4. Neutrogena Purescreen+, final protection step.

Repeated rows must use fixed-width slots for step number, image and trailing note.

- [ ] **Step 3: Validate product references**

The validator must compare every `data-product-id` in these sections with `products.csv` and fail when:

- Product ID is unknown.
- Active affiliate link differs from CSV.
- Official image differs without an explicit fallback.
- Required disclosure is absent.

- [ ] **Step 4: Browser checkpoint**

Inspect product rail and routine at desktop/mobile widths. Verify:

- No clipped product names.
- Images fit without distortion.
- Routine columns align.
- Mobile rows become readable stacked blocks.

- [ ] **Step 5: Commit product and routine sections**

```powershell
git add index.html tools/validate-summer-journal.mjs
git commit -m "Add trending products and summer routine"
```

## Task 7: Implement Journal Stories, Newsletter And Trust Footer

**Files:**
- Modify: `index.html`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Add journal story composition**

Create `#journal-stories` with:

- Light after-shower ritual.
- Vanilla/pistachio scent diary.
- Summer lip guide.
- Glass-skin weekend reset.

Use one large editorial image and three aligned story rows, matching Paper.

- [ ] **Step 2: Add newsletter visual state**

Create an accessible form shell:

```html
<form class="journal-signup" aria-describedby="signup-note">
  <label for="journal-email">Email address</label>
  <input id="journal-email" type="email" autocomplete="email">
  <button type="button">Join the edit</button>
</form>
<p id="signup-note">Email signup is coming soon.</p>
```

Do not submit data until a provider is selected.

- [ ] **Step 3: Rebuild footer**

Include:

- Explore.
- About.
- Editorial policy.
- Affiliate disclosure.
- Pinterest, Instagram and Linktree.
- Full Amazon disclosure.

- [ ] **Step 4: Validate trust and form behavior**

Assert:

- Newsletter button is not `type="submit"`.
- Social links use `noopener`.
- Affiliate disclosure exists in main content or footer.
- Footer year is 2026.

- [ ] **Step 5: Browser checkpoint and commit**

Verify section rhythm, warm-pastel color balance and mobile form layout.

```powershell
git add index.html tools/validate-summer-journal.mjs
git commit -m "Complete Summer Journal editorial sections"
```

## Task 8: Reposition And Finish The Product Browser

**Files:**
- Modify: `index.html`
- Modify: `assets/js/product-browser.mjs`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Rename and reposition browser**

Use:

```html
<section id="product-browser" aria-labelledby="product-browser-heading">
  <h2 id="product-browser-heading" tabindex="-1">Shop the researched edit</h2>
  ...
  <div id="product-empty-state" hidden>No matching picks yet. Try another category or clear search.</div>
</section>
```

Remove obsolete duplicate category/shop sections only when their useful content has been incorporated into the new editorial page.

- [ ] **Step 2: Make filter controls accessible**

Use buttons or links with:

- `aria-pressed`.
- Visible focus state.
- Clear active state.
- `Clear filters` command.

- [ ] **Step 3: Add reduced-motion support**

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run complete local validation**

```powershell
node tools/validate-summer-journal.mjs
```

Expected:

```text
PASS sections=8 active_products=<count> affiliate_links=<count> gateways=5
```

- [ ] **Step 5: Commit browser integration**

```powershell
git add index.html assets/js/product-browser.mjs tools/validate-summer-journal.mjs
git commit -m "Integrate editorial product browser"
```

## Task 9: Produce The 14-Day Content And Measurement Plan

**Files:**
- Create: `data/content-plan-2026-06-07-to-06-20.csv`
- Modify: `data/analytics/social-posts.csv`
- Create: `docs/analysis-summer-product-focus-2026-06-06.md`
- Test: `tools/validate-summer-journal.mjs`

- [ ] **Step 1: Build the daily content-plan CSV**

Use:

```csv
date,platform,format,product_id,editorial_lane,creative_type,hook,destination,cta,verification_state,status
```

Coverage requirements:

- 70 Pinterest rows: five per day.
- 28 Instagram rows: two per day.
- June 7 through June 20 inclusive.
- 40% Sun + Skin.
- 20% Body Rituals.
- 15% Gloss + Glow.
- 15% K-Beauty Summer.
- 10% Easy Routines.

- [ ] **Step 2: Use creative variance**

For each Tier 1 product, rotate:

- Search Pin.
- Save/checklist Pin.
- Comparison Pin.
- Routine Pin.
- Close-up Reel.
- Educational Reel.

Do not schedule identical copy or visuals on consecutive days.

- [ ] **Step 3: Write the decision-ready analysis**

Include:

- Current first-party baseline.
- Source dates.
- Product tiers.
- Why SPF/tint, gloss/lip treatment, body rituals and K-beauty are prioritized.
- Conservative/base/stretch expectations.
- 72-hour scale/pause rules.
- Missing-data caveat: product-level Amazon conversion cannot be proven until clicks/orders are tracked by product.

- [ ] **Step 4: Add plan validation**

Assert:

- Exactly 98 rows.
- Every date has five Pins and two Reels.
- Every product ID exists.
- Watchlist products use educational destinations and no affiliate CTA.
- Every active shopping destination matches the product CSV.

- [ ] **Step 5: Run validation and commit**

```powershell
node tools/validate-summer-journal.mjs --content-plan
```

```powershell
git add data/content-plan-2026-06-07-to-06-20.csv data/analytics/social-posts.csv docs/analysis-summer-product-focus-2026-06-06.md tools/validate-summer-journal.mjs
git commit -m "Add two-week Summer Beauty content plan"
```

## Task 10: Full Visual QA, Paper Fidelity And Deployment

**Files:**
- Modify as needed: `index.html`
- Modify as needed: `assets/js/product-browser.mjs`
- Modify: `README.md`

- [ ] **Step 1: Run all automated checks**

```powershell
node tools/validate-summer-journal.mjs
node tools/validate-summer-journal.mjs --browser-unit
node tools/validate-summer-journal.mjs --products-only
node tools/validate-summer-journal.mjs --content-plan
git diff --check
```

All commands must pass.

- [ ] **Step 2: Run Browser functional QA**

Verify:

- Desktop `1440x900`.
- Laptop `1280x800`.
- Mobile `390x844`.
- Menu.
- All five gateways.
- Search + filter combinations.
- Empty state.
- Clear filters.
- Affiliate links.
- Social links.
- Keyboard focus.
- Reduced motion.

- [ ] **Step 3: Compare with Paper**

Capture implementation screenshots and inspect them alongside the approved Paper artboard.

Check at least:

- Hero composition.
- Warm-pastel palette.
- Masthead hierarchy.
- Category gateway anatomy.
- Featured guide contrast.
- Product rail image treatment.
- Routine-row alignment.
- Journal story rhythm.
- Newsletter/footer spacing.

Fix all material mismatches.

- [ ] **Step 4: Update README**

Document:

```powershell
python -m http.server 8765
node tools/validate-summer-journal.mjs
```

Also document the product CSV as the affiliate source of truth and the two-week content-plan location.

- [ ] **Step 5: Verify clean scope**

```powershell
git status --short
git diff --stat HEAD
```

Do not include the user's unrelated `docs/plan-semana-2026-05-25.md` edit.

- [ ] **Step 6: Commit and push**

```powershell
git add index.html assets/js/product-browser.mjs tools/validate-summer-journal.mjs data/analytics/products.csv data/analytics/social-posts.csv data/product-focus-2026-06-07-to-06-20.csv data/content-plan-2026-06-07-to-06-20.csv docs/analysis-summer-product-focus-2026-06-06.md README.md
git commit -m "Launch Summer Journal affiliate experience"
git push origin main
```

- [ ] **Step 7: Deploy and verify Render**

In Render:

- Confirm latest commit is selected.
- Trigger deployment if auto-deploy does not start.
- Wait for `Live`.
- Open the public URL.
- Verify headline, categories, official images, filters and affiliate disclosure.

- [ ] **Step 8: Final evidence**

Report:

- Public URL.
- Commit SHA.
- Validation results.
- Desktop/mobile Browser checks.
- Paper fidelity outcome.
- Any watchlist products still awaiting affiliate URLs.

