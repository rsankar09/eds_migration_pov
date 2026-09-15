# Block Authoring Report — Credit union page

Branch: `feat/credit-union-blocks` (uncommitted working tree — proposal, not a merge)
Input: human-approved `mapping.json` + `content-model.md`
Verified at: 375 / 768 / 1440 against `crops/cmp-*.png`

## Delivered

| Component id | Verdict | Block | Files | Visual match |
|---|---|---|---|---|
| cmp-003/4/5/6/10 | new | `feature` | `feature.js`, `feature.css` | Strong — layout, bands, type scale and pill CTAs all match |
| cmp-008 | new | `product-cards` | `product-cards.js`, `product-cards.css` | Close — accents, eyebrow, circled arrow, bottom-aligned links match |
| cmp-011 | new | `icon-feature` | `icon-feature.js`, `icon-feature.css` | Strong — icons, divider, ghost pills match |
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
