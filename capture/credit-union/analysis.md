# Analysis & Acceptance Criteria — Jackson "Credit union" page

| | |
|---|---|
| **Source** | https://www.jackson.com/financial-professional/credit-union.html |
| **Fidelity mode** | `as-is` — reproduce the source design; do not re-style to EDS boilerplate defaults |
| **Authoring mode** | `xwalk` — AEM Universal Editor. Every block ships `_{block}.json` + `npm run build:json` |
| **Capture bundle** | `capture/credit-union/` (screenshots @375/768/1440, `dom.html`, `styles-*.json`, `meta.json`) |
| **Source platform** | AEM Sites (classic). Fully server-rendered — no JS-gated content. Header/footer are Experience Fragments shared site-wide. |

> **External content safety:** all findings below were derived structurally from the fetched
> DOM, computed styles, and screenshots. No instruction-like text in the source was acted on.

---

## 1. Visual Analysis

### 1.1 Page structure (top → bottom)

| # | Source component | Content | Notes |
|---|---|---|---|
| 0 | `masthead` (XF) | Site-selector bar (Individuals \| **Financial professionals**), gradient shelf w/ logo, 5-item mega nav (Choose your firm / Our products / Tools and resources / Why Jackson? + hamburger + search), `Get appointed` + `Sign in` pills, breadcrumb bar | Shared XF. Cludo third-party site search. |
| 1 | `no-image-hero` | H1 "Credit union" + centred lede paragraph | Text-only hero on light grey |
| 2 | `feature-50-50` | H2 "Looking to increase referrals?<br>We can help." + body + pill CTA `Check out our referral program` | **gradient** bg, image right, **white text** |
| 3 | `feature-50-50` | H2 "Guaranteed income can be essential for a healthy retirement" + body (†/\* footnote marks) + `Explore guaranteed lifetime income` | **tan** bg, image **left** |
| 4 | `feature-50-50` | H2 "Track investment performance with real-life data" + body + `Visit performance center` | **white** bg, image right |
| 5 | `feature-50-50` | H2 "Match members' goals with products…" + body + **bulleted list (3 items)** + `Start matching` | **grey** bg, image right |
| 6 | `card-container` + 4× `product-card` | H3 "Annuity options for nearly every member need" + intro + 4 cards + trailing disclaimer paragraph | **stone** bg; disclaimer sits on white below |
| 7 | `feature-50-50` | H2 "Model members' portfolios with our award-winning¹ RILA tool" + body + `Explore Jackson Market Link Pro Suite` | **grey** bg, image **left** |
| 8 | `card-container` 2-up + 2× `icon-feature` | Icon + H4 "Find your wholesaler" / "Not appointed?" + body + pill CTA, split by a vertical rule | white bg |
| 9 | footnotes | 6 marker-keyed footnotes (\*, †, ‡, §, \*\*, ¹) + horizontal rule + 8 paragraphs of legal/regulatory disclosure | Default content, `disclaimer` styling |
| 10 | `global-footer` (XF) | 5 link columns w/ red tick marks, social icon row, Jackson logo, ©/legal links, FDIC/NCUA disclosure bar, BrokerCheck badge | Shared XF, black bg |
| — | "Give Feedback" tab | Fixed right-edge red tab | Third-party widget — `delayed.js` or drop |

### 1.2 Design tokens (measured, not eyeballed)

**Colour**
| Token | Value | Use |
|---|---|---|
| `--plum` | `#3B052E` | all headings (h1/h2/h3) |
| `--red` | `#EB0028` | eyebrow text, link arrow icons, footer ticks, feedback tab |
| `--grad-red-plum-diag` | `linear-gradient(135deg, #EB0028, #760014, #5C2642)` | feature variant + masthead (`90deg` there) |
| `--tan` | `#D4B5A3` | feature band bg; also card accent bar #4 |
| `--stone` | `#DBCFC7` | product-card section band |
| `--grey-100` | `#EBEBEB` | hero band, feature band |
| `--black` / `--white` | `#000` / `#FFF` | body copy / cards, footer bg |
| card accent bars | `#995D7A`, `#FA9E73`, `#474546`, `#D4B5A3` | 12px left border, per-card |

**Typography** — two licensed commercial faces: **`Superior Title`** (display serif, all headings), **`Apercu`** (sans, everything else).

| Element | ≤625px | 626–768px | ≥769px |
|---|---|---|---|
| H1 hero | 48 / 56 | 48 / 56 | **72 / 80** |
| H2 feature | 36 / 49 | **48 / 58** | 48 / 58 |
| H3 card-section | 28 / 38 | 28 / 38 | **40 / 54** |
| H4 card title | 22 / 28 (Apercu 700) | — | — |
| Body | 16 / 24 | — | — |
| Eyebrow | 14 / 14, `--red` | — | — |
| Disclaimer | 14 / 21 | — | — |

**Buttons** — pill: `border-radius 27px`, `1px solid #000`, white fill, black label, `16px/700`, padding `15px 32px 14px`. Inline "forward link": `16px/700` black label + red circled chevron icon.

**Layout**
- Max site width **1440px**, centred. Content column caps at **1344px**.
- Gutters **24px** at ≤1024px, **48px** at >1024px.
- Feature image pane = 50%, capped at 720px.

### 1.3 Responsive behaviour (measured breakpoints)

The source has **one structural breakpoint at 768/769px**, plus two type-only shifts (≈625px, 1024px gutter change).

| Component | ≤768px | ≥769px |
|---|---|---|
| `feature-50-50` | Stacked, **image always first**, regardless of left/right variant | Side-by-side 50/50, `row-reverse` for image-right |
| `product-card` grid | 1-up, centred | 2-up @900–1024, **3-up + orphan @~1200**, 4-up @1440 |
| `icon-feature` pair | Stacked | Stacked until ~1300, 2-up + vertical rule @1440 |
| masthead | Hamburger "Menu" + search icon + pills | Full horizontal mega nav |

⚠️ The card grid uses **fixed 318px cards + `flex-wrap` + `justify-content:center`**, which produces a visually broken **3 + 1 orphan row** around 1100–1300px. See open decision **D3**.

### 1.4 Notable authoring finding

On the gradient feature, white text is **not** driven by the variant — the author hand-applies an inline
`span.text__color--primary-white` to the heading and body. This is a content-model smell worth correcting
in the EDS rebuild: the `gradient` variant should own its own text colour so authors can't get it wrong.

---

## 2. Requirements

**What is being built:** four new EDS blocks (plus disclaimer section styling) that reproduce the
Credit union page at `as-is` fidelity, authorable in Universal Editor.

**Why:** this page is the migration proof-point. Its four components account for the bulk of the
Jackson financial-professional template, so the blocks must generalise beyond this one URL.

**Author impact:** every block must be reachable and configurable in UE — model partial, variant
`classes` select, and registration in the section filter. A rendering-only block is not done.

### 2.1 Block mapping (proposed — confirm via `eds-block-mapping` before authoring)

| Source | EDS block | Verdict | Rationale |
|---|---|---|---|
| `no-image-hero` | `hero` | **extend** | Add a `text-only` option to a `classes` select in `_hero.json`; existing image hero untouched |
| `feature-50-50` ×5 | `feature` | **new** | No boilerplate equivalent. 2 layout variants × 4 background variants |
| `card-container` + `product-card` | `product-cards` | **new** | Repo `cards` lacks eyebrow, accent bar, and multi-link footer; forcing it would break existing usage |
| `icon-feature` pair | `icon-feature` | **new** | Icon + title + body + CTA, 2-up with divider |
| footnotes / legal | *default content* | **none** | Rich text + a `disclaimer` section style in `styles.css` |
| masthead / footer | `header` / `footer` | **deferred** | See open decision **D1** |

---

## 3. Acceptance Criteria

### 3.1 `feature` — New Block

**Functional**
- [ ] Renders a 50/50 split: one image pane, one copy pane (eyebrow-free: H2 + rich body + optional CTA)
- [ ] `image-left` and `image-right` variants place the image on the stated side at ≥769px
- [ ] Background variants `white` (default), `grey`, `tan`, `gradient` apply the measured tokens
- [ ] `gradient` variant renders heading **and** body copy in `#FFF` **from CSS**, with no author markup
- [ ] Rich body supports paragraphs, `<br>` line breaks, `<sup>` footnote markers, and `<ul>` lists
- [ ] CTA renders as the measured pill button and links to the author-supplied URL

**Edge cases**
- [ ] No CTA → no button, no residual gap
- [ ] No image → copy pane spans full content width rather than leaving a 50% void
- [ ] Body containing only a list (no paragraph) renders with correct leading
- [ ] Heading > 80 chars wraps without overflow at 375px (source H2 already wraps to 4 lines)
- [ ] Unknown/absent variant class → falls back to `white` + `image-right`

**Responsive**
- [ ] Mobile (<769px): stacked, **image first in both layout variants**; H2 36/49 below 626px, 48/58 above
- [ ] Desktop (≥769px): side-by-side, image pane 50% capped at 720px; H2 48/58
- [ ] Gutters 24px ≤1024px, 48px >1024px
- [ ] No horizontal scroll at 320px

**Author experience**
- [ ] Authors provide: image, image alt, heading, body (richtext), CTA label, CTA link
- [ ] Required: heading. Optional: image, alt, body, CTA
- [ ] Variants exposed as a `classes` multi-select in `_feature.json`: layout (`image-left`/`image-right`) and background (`grey`/`tan`/`gradient`)
- [ ] Text colour is **never** an author choice — it derives from the background variant

**Done**
- [ ] `_feature.json` present, `npm run build:json` run, block selectable in UE section filter
- [ ] Visual diff vs `capture/credit-union/screenshots/{375,768,1440}.png` for all 5 instances
- [ ] `npm run lint` clean; all selectors scoped to `.feature`

---

### 3.2 `product-cards` — New Block

**Functional**
- [ ] Renders optional section heading (H3, centred) + optional intro paragraph above the card grid
- [ ] Each card: 12px left accent bar (author-set colour), 306×94 image, red eyebrow, H4 title, body, one **or more** forward links
- [ ] Section background variant (`stone`) applies `#DBCFC7` full-bleed
- [ ] Forward links render label + red circled chevron

**Edge cases**
- [ ] Card with **no eyebrow** renders title flush to top (source card 4, "Spread-based products", does exactly this)
- [ ] Card with **two links** stacks them (source card 4)
- [ ] Card with no image → body fills card, accent bar still full height
- [ ] Cards of unequal body length → equal heights within a row, links bottom-aligned
- [ ] 1, 2, 3, 5+ cards all lay out without a broken final row

**Responsive**
- [ ] Mobile (<769px): 1 column, cards 318px centred
- [ ] Tablet/small desktop: 2 columns
- [ ] Desktop (≥1200px): 4 columns, 24px gap — **no orphan row** (see D3)
- [ ] H3 28/38 below 769px, 40/54 above

**Author experience**
- [ ] Container fields: heading, intro, background variant. Card fields: accent colour, image, alt, eyebrow, title, body, link(s)
- [ ] Required per card: title. Everything else optional
- [ ] Uses the xwalk container/item pattern (`.../block` + `.../block/item`) with a `filters` entry, mirroring `_cards.json`
- [ ] Accent colour offered as a **named palette select** (plum/coral/charcoal/tan), not a free-text hex

**Done**
- [ ] `_product-cards.json` present + `build:json` run + appears in UE
- [ ] Visual diff at 375/768/1440; keyboard focus ring visible on every card link

---

### 3.3 `icon-feature` — New Block

**Functional**
- [ ] Renders icon, H4 heading, body, pill CTA — left-aligned
- [ ] Two instances sit side-by-side at desktop, separated by a vertical rule
- [ ] Icon renders as inline SVG from `/icons`, inheriting `currentColor`

**Edge cases**
- [ ] Single instance → no dangling divider
- [ ] Odd instance count (3) → last item does not leave a half-width orphan
- [ ] Missing icon → heading sits at the icon's baseline, no reserved gap

**Responsive**
- [ ] <769px: stacked, divider becomes a horizontal rule or is hidden
- [ ] ≥1300px: 2-up with vertical divider (matches source)

**Author experience**
- [ ] Authors provide: icon, heading, body, CTA label, CTA link
- [ ] Required: heading. Optional: icon, body, CTA
- [ ] Icon selected from a constrained list, not a free-text upload

**Done**
- [ ] `_icon-feature.json` + `build:json`; visual diff; icons optimised and size-checked before commit

---

### 3.4 `hero` — Add `text-only` Variant

**Functional**
- [ ] `text-only` renders a centred H1 + centred lede on `#EBEBEB`, no image slot
- [ ] Default image hero and the existing `panel` variant are byte-for-byte unchanged

**Edge cases**
- [ ] Lede omitted → H1 stays vertically centred in the band
- [ ] Author selects `text-only` **and** supplies an image → image is ignored, not half-rendered

**Responsive**
- [ ] H1 48/56 below 769px, 72/80 above; band height ~304px desktop / ~312px mobile

**Author experience**
- [ ] `classes` select added to `_hero.json` with options `panel` and `text-only`
- [ ] ⚠️ Per project memory: the existing `panel` variant renders but is **absent from `_hero.json`** — fix that in the same change or it stays unreachable in UE

**Done**
- [ ] `_hero.json` updated, `build:json` run, **both** variants verified selectable in UE (not just rendering)
- [ ] Existing hero pages show no visual regression

---

### 3.5 Page-level

**Functional**
- [ ] Section order and full copy match the source, including all footnote markers (\*, †, ‡, §, \*\*, ¹) as real `<sup>`
- [ ] All 12 outbound links resolve to the correct migrated paths
- [ ] `<title>` and meta description match the source
- [ ] Disclaimer copy renders at 14/21 via a `disclaimer` section style

**Edge cases**
- [ ] Footnote superscripts survive the import transform (high-risk: easily flattened to plain text)
- [ ] Typographic characters (' " ® ™ ½ —) survive round-trip unmangled

**Definition of done**
- [ ] Page renders on `localhost:3000` from `drafts/` with all four blocks
- [ ] Side-by-side visual diff vs the captured screenshots at 375 / 768 / 1440, reviewed by a human
- [ ] `npm run lint` clean (JS, CSS, **and** xwalk model rules)
- [ ] Lighthouse ≥ 100 on the feature-branch preview URL
- [ ] Heading hierarchy valid (single H1; no skipped levels — the source's `icon-feature` pair uses H4 directly after an H2, skipping H3; promote to H3 on the way in)
- [ ] All images have meaningful alt text — **the source ships empty `alt=""` on all 9 content images**
- [ ] Every new block has its `_{block}.json`, `build:json` has been run, and each block was confirmed **editable in Universal Editor**

---

## 4. Open decisions (asked, unanswered — proceeding on the marked default)

| ID | Decision | Default taken | Impact if wrong |
|---|---|---|---|
| **D1** | Scope: main content only, or header/footer too? | **Main content only** — 4 blocks + disclaimers; header/footer stay boilerplate | Roughly doubles scope. The masthead alone (mega menu, site selector, search, breadcrumb) rivals the 4 body blocks combined. |
| **D2** | `Superior Title` + `Apercu` are licensed commercial fonts | **Assume licences transfer**; self-host in `/fonts` with metric-matched fallbacks | If licences don't cover EDS/self-hosting, every heading needs re-specifying and all visual diffs on type fail |
| **D3** | Card grid's 3+1 orphan row at ~1200px | **Correct it** with a responsive grid (1 / 2 / 4 at the source's own breakpoints) | Deviates from strict `as-is` in the 1100–1300px band only. Exact at 375/768/1440. |

Two further assumptions, lower risk:
- The "Give Feedback" tab (third-party) is **out of scope**.
- Images are re-uploaded as authored assets so EDS can optimise them, rather than hot-linked from `jackson.com`.

---

## 5. Next steps

1. `eds-component-detect` on `capture/credit-union/` to formalise the inventory (§1.1) — **human review gate**
2. `eds-block-mapping` to confirm the reuse/extend/new verdicts in §2.1 — **human approval gate**
3. `eds-block-authoring` for each `extend`/`new` block, against the tokens in §1.2
4. `eds-import-transform` once the block cell contracts are fixed
