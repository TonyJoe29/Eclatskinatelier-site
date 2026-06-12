# EclatSkinAtelier Homepage Category Artboards

Date: June 12, 2026

## Objective

Create three standalone desktop artboards in Paper that explore future homepage sections without changing the production website:

1. Summer Categories.
2. Routine Library.
3. Celebrity Beauty With Verified Sources.

Each artboard must work as a modular band that can later be inserted into the existing long-scroll homepage.

## Shared Design System

Mood: sun-washed apothecary.

Palette:

- Blush background: `#F3E3E2`.
- Peach surface: `#F1D3C5`.
- Sage surface: `#DDE4D2`.
- Butter accent: `#F3E8B8`.
- Deep plum: `#563B43`.
- Ink: `#282323`.
- White: `#FFFFFF`.

Typography:

- Display: Cormorant Garamond, 500-600.
- Body and UI: DM Sans, 400-700.
- Section title: 56-72px.
- Product title: 24-30px.
- Body: 15-18px.
- Labels: 11-12px uppercase with open letter spacing.

Layout rules:

- Desktop reference width: 1440px.
- Open editorial bands instead of nested cards.
- Large product imagery and asymmetric compositions.
- Thin borders, square controls, minimal shadows.
- Warm pastel rhythm with one dominant color per section.
- Each artboard shows a visible hint of the next scroll module.

## Artboard 1: Summer Categories

Purpose: let readers enter through a need rather than a product list.

Structure:

1. Editorial title: `Shop summer by what your routine needs`.
2. Four visual gateways:
   - Sun + Skin.
   - Gloss + Glow.
   - Body Rituals.
   - K-Beauty Summer.
3. One featured product moment for each lane.
4. Product-count label and concise use-case note.
5. Footer rail with `Explore the full summer edit`.

Products:

- Sun + Skin: Neutrogena Purescreen+, La Roche-Posay Anthelios.
- Gloss + Glow: e.l.f. Halo Glow, LANEIGE Bouncy & Firm.
- Body Rituals: eos Vanilla Cashmere, Sol de Janeiro Cheirosa 62.
- K-Beauty Summer: Biodance mask, Medicube Zero Pore Pad.

Interaction concept:

- Clicking a gateway would later open the homepage product browser with a URL-driven category filter.
- Gateway hover would reveal one sentence describing who the lane suits.

## Artboard 2: Routine Library

Purpose: increase time on page by showing complete, understandable product sequences.

Structure:

1. Title: `Build a routine, not a crowded shelf`.
2. Primary routine feature with four numbered steps.
3. Three secondary routine tabs:
   - Simple Summer AM.
   - PM Makeup Reset.
   - After-Shower Scent.
4. Optional steps clearly marked.
5. Product thumbnails, sequence, timing and short `skip if` guidance.
6. CTA: `Open the complete routine`.

Primary routine:

- Clean Skin Club Towels.
- The Ordinary Niacinamide, optional.
- CeraVe Daily Moisturizing Lotion, optional.
- Neutrogena Purescreen+ or La Roche-Posay Anthelios as final SPF.

Secondary routines:

- PM Makeup Reset: ELEMIS, Clean Towels, CeraVe, Aquaphor.
- Acne Basics: Clean Towels, Niacinamide, Mighty Patch, CeraVe, SPF.
- After-Shower Scent: eos, Aquaphor on dry areas, Cheirosa 62.

Interaction concept:

- Tabs swap the visible routine without navigating away.
- Each product opens notes first; Amazon remains a secondary CTA.

## Artboard 3: Celebrity Beauty

Purpose: create editorial discovery while avoiding false endorsement or sponsorship claims.

Structure:

1. Title: `Products spotted in real beauty routines`.
2. One large verified feature.
3. Two smaller verified stories.
4. Evidence label on every story:
   - `Confirmed use`.
   - Source publication.
   - Publication date.
5. Separate `Inspired look` rail for aesthetic references that are not confirmed product use.
6. Visible editorial disclaimer.

Verified stories:

- Coco Gauff + CeraVe Daily Moisturizing Lotion.
  - Source: Vogue Beauty Secrets, August 27, 2025.
- Billie Eilish + Aquaphor Healing Ointment.
  - Source: Vogue Beauty Secrets, July 14, 2022.
- Chloë Grace Moretz + Clean Skin Club Clean Towels XL.
  - Source: Vogue Beauty Secrets, October 19, 2022.

Editorial rules:

- Use `Shown in her Vogue Beauty Secrets routine` rather than `celebrity-approved`.
- Do not imply sponsorship, endorsement or current use.
- Do not reuse Vogue screenshots, video frames or celebrity portraits without a license.
- Paper mockup uses abstract editorial portrait placeholders or licensed imagery.
- Product imagery can use official-source drafts, but production must follow Amazon SiteStripe or PA-API requirements.
- Source link appears before any affiliate CTA.

## Maintenance Findings To Implement Separately

The visual work does not silently change production data. A later maintenance pass must:

- Correct Aquaphor, CeraVe and Biodance variant mismatches.
- Replace broken e.l.f. Halo Glow image source.
- Replace incorrect product fallback SVG mappings.
- Recalculate product and category counts from markup/data.
- Add the five published products missing from `products.csv`.
- Remove or implement inert checklist and newsletter CTAs.
- Centralize Amazon Associate tracking IDs.

## Acceptance Criteria

- Three new 1440px Paper artboards exist.
- Each reads as a homepage section, not a standalone landing page.
- Shared typography and palette match the approved Summer Journal.
- Every product shown already exists in the published bank.
- Celebrity labels distinguish confirmed use from inspiration.
- No unsupported endorsement claim appears.
- Screenshots pass spacing, hierarchy, contrast, alignment, repetition and artboard-fit review.
- Paper working indicators are released when complete.
