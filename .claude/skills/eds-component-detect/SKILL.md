---
name: eds-component-detect
description: Analyze a capture bundle (from eds-site-crawl) and produce a reviewed inventory of meaningful UI components — hero banners, card grids, tabs, accordions, carousels, tables, forms, nav, footer, CTA banners — as distinct from atomic text/image elements that don't need their own EDS block. Use this after a site has been crawled and before any EDS block mapping is attempted. Always stop for human review of the inventory before handing off to eds-block-mapping — never auto-approve component boundaries.
compatibility: requires a capture bundle produced by eds-site-crawl; image viewing capability for screenshot crops
---

# EDS component detection

Classifies a page's DOM into the *composite* components that deserve their
own EDS block, filtering out plain text/image leaves that don't.

See `references/component-taxonomy.md` for the full type list and per-type
detection heuristics before you start — read it, don't guess at the taxonomy.

## Inputs

A capture bundle: `dom.json`, `styles.json`, `screenshots/*.png`, `meta.json`.

## Process

1. **Propose candidate boundaries** from DOM structure: repeated sibling
   patterns (3+ similarly-shaped siblings → likely a grid/list component),
   semantic tags (`nav`, `header`, `footer`, `table`, `form`), ARIA roles
   (`role="tablist"`, `role="region"` with `aria-expanded` siblings →
   tabs/accordion), and known class-name fragments (`carousel`, `swiper`,
   `slider`, `testimonial`, `accordion`).
2. **Reject atomic leaves.** A single heading + paragraph, or a single image
   with a caption and no repeating/interactive structure, is not a component
   — leave it as page content, not an inventory entry. When in doubt, ask:
   would this need its own `decorate()` logic in EDS, or does it already work
   as a plain paragraph/image in the default content flow? If the latter,
   exclude it.
3. **For each candidate**, crop the screenshot using its bounding rect (from
   `styles.json`) and classify:
   - High-confidence structural matches (e.g. `role="tablist"`) can be
     auto-labeled.
   - Everything else: look at the cropped screenshot together with the HTML
     snippet and assign a type from the taxonomy, or `other` with a short
     free-text description if nothing fits.
4. **Flag ambiguity** rather than guessing silently: overlapping candidate
   boundaries, a component that could be read as two different types, or low
   visual confidence all get `"needs_review": true`.
5. **Emit `inventory.json`**:
   ```json
   [
     {
       "id": "cmp-003",
       "type_guess": "card-grid",
       "confidence": 0.82,
       "needs_review": false,
       "html_snippet": "<section class=\"...\">...</section>",
       "bounding_rect": { "x": 0, "y": 1240, "w": 1440, "h": 620 },
       "screenshot_crop": "capture/home/crops/cmp-003.png",
       "breakpoint_variants": ["375", "768", "1440"]
     }
   ]
   ```

## Human gate — do not skip

Present the inventory to the user as a list with each `screenshot_crop`
thumbnail and `type_guess`. Ask them to:
- confirm or relabel the type,
- merge entries that are really one component,
- split entries that bundle two components,
- drop false positives.

Only a confirmed inventory (all `needs_review: false`, all types confirmed)
should be passed to `eds-block-mapping`. Do not proceed on unconfirmed output
even if confidence scores look high — this is the cheapest point in the whole
pipeline to catch a mistake, and every later stage compounds it.

## Handoff

Confirmed `inventory.json` feeds `eds-block-mapping`.
