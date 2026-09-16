# Block Authoring Report — Credit union page

Branch: `feat/credit-union-blocks` (uncommitted working tree — proposal, not a merge)
Input: human-approved `mapping.json` + `content-model.md`
Verified at: 375 / 768 / 1440 against `crops/cmp-*.png`

## Delivered

| Component id | Verdict | Block | Files | Visual match |
|---|---|---|---|---|
| cmp-003/4/5/6/10 | new | `feature` | `feature.js`, `feature.css` | **Superseded — see Amendment 1** |
| cmp-008 | new | `product-cards` | `product-cards.js`, `product-cards.css` | **Superseded — see Amendment 1** |
| cmp-011 | new | `icon-feature` | `icon-feature.js`, `icon-feature.css` | **Superseded — see Amendment 1** |
| cmp-002 | none | section style `grey, centered` | `styles/styles.css` | Match — band and centred 72px plum H1 |
| cmp-007 | none | section style `full-width-image` | `styles/styles.css` | Match |
| cmp-009 / cmp-012 | none | section style `disclosure` | `styles/styles.css` | Match — 14/21 under the Jackson theme |

Also resolved, from `content-model.md`'s open items:

- **Item 3 — section-style naming conflict.** Renormalised the draft onto the
  measured names: `light`→`grey` (×3, incl. the hero band), `blush`→`tan`,
  `sand`→`stone`, plus `centered` on the hero and product-card bands. `grey`
  is kept distinct from `light` because the source band is `#EBEBEB` and
  `--light-color` is `#F4F4F4`.
- **Item 4 — missing icons.** Added `icons/map-marker.svg`, `icons/user-plus.svg`
  (24px, stroke outline, ~300 bytes each). Stroke colour is baked in because
  `decorateIcons()` injects an `<img>`, so `currentColor` cannot reach it.
- **Item 5 — the icon-feature divider.** Absent from the capture bundle as
  flagged, so re-derived from `crops/cmp-011.png` and matched to the gradient's
  mid stop (`#760014`). Declared as `--divider-color` on the block so it is
  one edit to correct if re-inspected live.
- **D-A / D-D** were left as `content-model.md` recommends (section-level bands,
  product-card heading as default content) — the committed model partials
  already assumed both.

Decisions worth review:

- `centered` is scoped to `> .default-content-wrapper`, not the whole section.
  Centring the section would also centre the cards' own copy.
- The gradient band owns its text colour, so the source's hand-applied
  `span.text__color--primary-white` (missing on 1 of 5 headings) is unauthorable.
- Repeated link labels only: three cards share "Learn more" and get a derived
  `aria-label`; card 4's two links are already unique and are left alone, since
  "MarketProtector® Suite about Spread-based products" reads worse than the
  problem it solves. Derived names keep the visible label as a prefix (WCAG 2.5.3).
- `decorateCta()` was added to `scripts.js` rather than duplicated into two
  blocks. The repo's global `decorateButtons()` only buttonizes links wrapped in
  `strong`/`em`, which Universal Editor's `*_cta` fields never emit.
- `product-cards` uses `auto-fit`, which avoids the source's 3+1 orphan row at
  ~1200px (open decision D3).

## Brand theming

The source is a 16px-base Jackson design (H1 72/80, H2 48/58, H3 40/54,
content column 1344px, gutters 24/48). This repo's globals came from the
Commonwealth homepage migration: 12px base, H1 21px, 965px column. Rescaling
`:root` would have silently restyled Commonwealth, so the Jackson scale is a
**scoped, opt-in theme** instead.

- Pages opt in with `theme: jackson-brand` in page metadata. `aem.js`'s
  `decorateTemplateAndTheme()` already puts that value on `<body>` and is
  already called from `loadEager`, so this needs **no JavaScript**.
- `body.jackson-brand main` redeclares tokens only. The blocks read
  exclusively from tokens (`--band-heading-size`, `--card-title-size`,
  `--eyebrow-size`, `--pill-*`), so they rescale with no theme-specific block
  selectors anywhere.
- **Scoped to `main`, not `body`.** The header and footer also read
  `--content-max-width` and `--body-font-size-*`, so theming the body widened
  the nav (965px → 1344px) and enlarged footer type (11px → 14px) on themed
  pages only. Since cmp-001/cmp-013 are `defer`, the shared chrome must stay
  identical site-wide. Verified by toggling the theme class at runtime: the
  header renders byte-identical with and without it.
- Default-content headings — the hero H1 and the heading introducing a card
  grid — cannot be block-scoped, so the theme styles `h1`-`h4` directly. Block
  headings still win on specificity and stay on the band tokens.
- Source breakpoints are 625/769/1024; snapped to the project's 600/900/1200
  per AGENTS.md, which the measured values tolerate.

**Regression-checked on `localhost:3000`:** the Commonwealth homepage is
pixel-identical at 1280 (md5 match against a pre-change baseline) and visually
identical at 375. On the themed page the chrome still resolves to the
Commonwealth values (nav 12px, footer 965px/11px) while `main` resolves to
Jackson (1344px, 16px, H1 72px, feature H2 48px).

## Resolved gaps

### 1. Band images are column-width, not viewport-width — FIXED

The image pane now reaches the viewport edge. Rather than the
`margin-inline: calc(50% - 50vw)` form D-A rejected, `feature.css` releases the
block's own wrapper (`main .section > .feature-wrapper { max-width: none;
padding: 0 }`) — the same mechanism `main .section.full-width-image > div`
already used. This needs no viewport units, so it cannot overflow by the
scrollbar width, which was D-A's original objection. Sibling wrappers in the
same section keep their own column, so only the band is released.

The copy then owns the gutter it used to inherit from the wrapper, and at
desktop is capped at the measured 475px column with auto margins absorbing the
remainder — which reproduces the source inset rather than stretching the copy
across the half.

Measured against `styles-rects-1440.json` (source values in brackets):

| viewport | image pane | copy content box |
| --- | --- | --- |
| 1440 image-right | x=720 w=720 [720/720] | x=123 w=475 [122/475] |
| 1440 image-left | x=0 w=720 [0/720] | x=843 w=475 [842/475] |
| 375 | x=0 w=375 (full-bleed) | x=24 w=327 [327] |

Heading resolves to 475w / 48px / 57.6lh / h=173 against the source's
475 / 48 / 58 / 174. No horizontal overflow at 1440, 1200, 900, 768 or 375.

### 2. icon-feature divider beyond 3 items — FIXED

The cause was `auto-fit`: the column count depended on container width, which
no selector can introspect. `decorate()` now fixes the count (`columnsFor`) and
writes it to `data-columns`, so CSS addresses row starts with `:nth-child()`.
3 across is preferred, dropping to 2 where that avoids a lone orphan.

Verified by driving the real `decorate()` for 1–7 items: in every case no item
at the start of a row carries the rule (n=4 → 2x2, row starts 1,3; n=7 → 3
across, row starts 1,4,7).

## Verification

- `npm run lint` — clean.
- `npm run build:json` — generated files in sync with partials.
- No console errors, no failed requests, no broken images, no leaked
  `accent-*` / `:icon:` tokens.
- Accent bars resolve to the four measured values; eyebrow absent on card 4
  with the title flush, as the source has it.
- Heading order `H1 → H2×4 → H3 → H4×4 → H2 → H3 → H3`. The source's H2→H4
  jump at cmp-011 is fixed by defaulting `icon-feature` items to H3.
- Responsive: feature stacks below 900px; cards 1→2→4 columns; the
  icon-feature rule flips from `border-top` to `border-left`. No horizontal
  overflow at 375 / 768 / 1440.

The only remaining console errors are a local-dev artifact: `--html-folder drafts`
serves nav at `/drafts/nav` while `header.js` fetches `/nav`. Not present in
preview or production.

---

## Amendment 1 — the original verification was single-axis

The "Strong/Close match" verdicts above were wrong, and the way they were
verified is why. Every measurement table in this report has `x` and `w`
columns and no `y` or `h`. Full-bleed failures, wrong image crops and stray
section padding are all purely vertical, so the checks could not see them —
and the screenshot comparison that accompanied them did not catch what the
numbers were not asked about.

Re-verified by reading `getBoundingClientRect()` back from the rendered page
against the capture's measured rects on both axes, at 375 / 768 / 900 / 1440.
`crops/cmp-011.png` was additionally measured pixel-wise for ink extents,
because the 37-selector sample in `styles-1440.json` carries that component's
item width but no `x`.

### What was actually wrong

| | source | as reported | now |
|---|---|---|---|
| feature band (1440) | 1440x607 | 1440x575 | 1440x607 |
| feature image pane | 720x607 | 720x495 | 720x607 |
| product-cards band | 1440x726 | 1440x570 | 1440x728 |
| product-cards band padding | 104px | 40px | 104px |
| card | 318 wide | 321 | 318 |
| card text | 242 wide | 269 | 242 |
| card eyebrow | 242x14 @14/14 | 269x20 @14/19.6 | 242x14 @14/14 |
| card grid gap | 24px | 20px | 24px |
| heading to cards | 40px | ~13px | 40px |
| icon-feature band | 1440x486 | 1440x223 | 1440x455 |
| icon-feature band padding | 104px | 0 | 104px |
| icon-feature content left | 163 | 287 | 163 |
| icon-feature item content | 432 | 672 | 432 |
| icon-feature rule | x=718 | — | x=720 |

Root causes, all of them vertical or structural:

1. **`aspect-ratio: 16 / 11` on the feature pane was a crop, not a ratio.**
   Every source asset is 720x600 (1.200) and the source pane measures `/1.2`
   at both stacked breakpoints. The pane came out 105px short at 1440, 112 at
   768, 55 at 375, with the photo cropped tighter than the original. The ratio
   is now read from the image itself, with the measured 6/5 as the fallback.
   `product-cards` keeps its fixed 306/94 deliberately — a grid wants one
   uniform strip, so an odd asset should be cropped to match its neighbours
   rather than set its own height.
2. **Section band padding was applied to bands that have none, and withheld
   from bands that have 104px.** The source's feature bands are flush and
   contiguous (y=503, 1110, 1717, 2324 — exactly 607 apart); its card bands
   carry 104px. The shared 40px in `styles.css` was wrong for all of them, and
   is now corrected per band by wrapper rather than changed globally, since
   those same styles carry the default-content bands.
3. **`icon-feature` filled the content column.** The source is a 432px content
   track with a 250px gutter, centred on the viewport with the rule on the
   shared track edge — not a row stretched across 1344.

### A structural defect the report could not have caught

`feature`'s `decorate()` read `block.firstElementChild` and walked only that
row. That is correct for document authoring and wrong in Universal Editor,
which renders **one row per model field group** — `image` in the first, the
`copy_*` group in the second. Row two, the entire copy pane, was never
classified, so every `.feature-copy` rule was dead and the CTA fell back to
the global square button. It now classifies cells and flattens them to one
row, verified identical on both shapes.

`hero` had the inverse: it tagged rows, which works in the editor and
collapses in a document where both cells share one row. Its `panel` variant
also depended on DOM order, so the editor's image-first field order rendered
it mirrored. Both fixed; the Commonwealth homepage is pixel-identical
(screenshot md5 match) and both shapes now measure the same.

### Still open, and not fixable in block code

- **Fonts.** The source is `"Superior Title"` (headings) and `Apercu` (body);
  the repo has Roboto and a Georgia fallback. Different metrics mean different
  wrap points — the feature heading still breaks a word earlier than the
  source. This accounts for the residual vertical deltas: card 357 against
  384, icon-feature band 455 against 486. Deliberately not compensated for,
  since any correction would have to be undone when the real fonts land.
- **768 feature band** is 900 against the source's 1093: the source steps the
  heading to 48px at 769 and the project's breakpoints are 600/900/1200.
- **Intermediate widths for `icon-feature`** are unmeasured; the fixed track
  applies from 1200 and is exact at 1440.
