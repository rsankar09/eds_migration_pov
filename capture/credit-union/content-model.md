# Content Model — Credit union page (`feature`, `product-cards`, `icon-feature`)

Input: human-approved `mapping.json` (3 × `new`, 4 × `none`, 2 × `defer`).
Output consumed by: `eds-block-authoring` (field lists) and `eds-import-transform` (cell contract).

All three models are verified against `eslint-plugin-xwalk`'s real `max-cells` algorithm
(field collapsing on `Alt`/`Text`/`Title`/`Type`/`MimeType`, element grouping on `group_property`):

| Model | Fields | Cells | Limit |
|---|---|---|---|
| `feature` | 9 | 3 — `image`, `copy`, `classes` | 4 ✅ |
| `product-card` | 11 | 4 — `image`, `copy`, `links`, `classes` | 4 ✅ |
| `icon-feature-item` | 6 | 2 — `icon`, `copy` | 4 ✅ |

> `classes` is **not** exempt from `max-cells` — `getFieldNames` does not filter it. Budget is
> effectively 3 content cells + variants.

---

## Cross-cutting decisions

### D-A: Band backgrounds are **section styles**, not block variants — ⚠️ PENDING CONFIRMATION

This **diverges from `analysis.md` §3.1**, which specifies `white`/`grey`/`tan`/`gradient` as block
`classes`. Recommending section styles because:

- `main > .section` is already the full-width wrapper; `.section > div` is the constrained column. A
  background on the section is full-bleed for free. A block-owned background needs
  `margin-inline: calc(50% - 50vw)`, which breaks with visible scrollbars (`100vw` includes them).
- The page needs section styles regardless — `cmp-002` (hero band), `cmp-007` (full-width image),
  `cmp-009`/`cmp-012` (disclosure) are all `verdict: none` and depend on them. Block variants would
  duplicate the same four brand colours in two mechanisms.
- It fixes the source's authoring bug: the gradient's white text is hand-applied per element as
  `span.text__color--primary-white` (and 1 of 5 headings is missing it entirely). As a section style,
  `.section.brand-gradient .feature { color: #fff }` makes it impossible to get wrong.

**Trade-off accepted:** the blocks are less portable — dropping `feature` into another project means
porting section styles too. Choose block variants instead if per-project portability outranks
full-bleed correctness.

### D-B: Headings are `text` fields; footnote markers in headings are Unicode

`copy_heading` + `copy_headingType` collapse to a real `<h2>`/`<h3>`, which is what the heading
hierarchy AC needs — but a `text` field cannot carry `<sup>` markup. The source puts `<sup>` inside
3 headings: `award-winning<sup>1</sup>`, `Elite Access Suite<sup>®</sup>`,
`Jackson Market Link Pro<sup>®</sup> Suite`.

All three are expressible as literal Unicode (`¹`, `®`) which already render raised, so nothing is
lost visually. Real `<sup>` stays available in the body richtext, where the `*`/`†`/`‡`/`§`/`**`
markers actually need it. **`eds-import-transform` must map heading-level `<sup>®</sup>` → `®` and
`<sup>1</sup>` → `¹` rather than flattening to `1`.**

### D-C: `aria-label` is derived, never authored

The source hand-writes aria-labels (`"learn more about perspective family"`). Three product cards
share the link text `Learn more`, which is a real ambiguous-link-text failure. No field is offered:
`decorate()` composes `aria-label` from the card heading + link text. Zero author input, and authors
cannot desynchronise it from the visible label. (`ctaTitle` would emit `title=`, not `aria-label`.)

---

## 1. `feature` — Standalone (5 instances)

### Document form

```
| Feature (image-left) |
|---|
| ![Alt text](image.jpg) | ## Heading<br>Body paragraphs, footnote markers, lists<br>[CTA label](/path) |
```

### Rendered cell contract

```html
<div class="feature image-left">
  <div>
    <div><picture><img src="…" alt="…"></picture></div>
    <div>
      <h2>Heading</h2>
      <p>Rich body…<sup>*</sup></p>
      <ul><li>…</li></ul>
      <p class="button-container"><a href="/path" class="button">CTA label</a></p>
    </div>
  </div>
</div>
```

### Model fields

| Field | Component | Cell | Required | Notes |
|---|---|---|---|---|
| `image` | reference | `image` | no | No image → copy pane spans full width |
| `imageAlt` | text | `image` | no | Source ships `alt=""` on all 5; authors must supply real alt |
| `copy_heading` | text | `copy` | **yes** | Only required field |
| `copy_headingType` | select `h2`/`h3` | `copy` | no | Default `h2` |
| `copy_description` | richtext | `copy` | no | Must allow `p`, `br`, `sup`, `ul`/`li` |
| `copy_cta` | aem-content | `copy` | no | |
| `copy_ctaText` | text | `copy` | no | |
| `copy_ctaType` | select `primary`/`secondary` | `copy` | no | Default `primary` |
| `classes` | select | `classes` | no | `image-left` \| `image-right` (default) |

### Source-verified variability

- Layout: `image-right` ×3, `image-left` ×2.
- **Exactly one CTA in all 5 instances** — one slot is sufficient, not a guess.
- Body element types observed: `p`, `br`, `sup` (×2 in one instance), `ul`/`li` (instance 4 only),
  and a bare `div` instead of `p` (instance 5) — richtext covers all.
- Backgrounds: gradient, tan `#d4b5a3`, white, grey `#ebebeb` ×2 → see D-A.
- No eyebrow on any instance. No secondary link. No inline `<a>` in body.

### Edge cases the model must tolerate

Missing image; missing body; missing CTA; body that is only a list; heading containing `¹`;
unknown/absent variant → fall back to `image-right`.

---

## 2. `product-cards` — Collection (4 cards)

### Heading placement — D-D: default content, ⚠️ PENDING CONFIRMATION

Diverges from `analysis.md` §3.2 (container fields). The decisive evidence: the page's **second**
`card-container` (`cmp-011`) leaves the heading and intro slots **completely blank** — so they are
genuinely optional, and as container fields they would sit permanently empty in one of two uses.
Authoring them as default content keeps the block a pure Collection and puts the H3 in the document
outline naturally. Cost: a `centered` section style is needed to centre them, since a heading outside
the block cannot be scoped to `.product-cards` per AGENTS.md.

### Document form

```
Annuity options for nearly every member need     <- H3, default content
Every retirement is unique. …                    <- intro, default content

| Product Cards |
|---|
| ![](card1.jpg) | Variable annuity<br>#### Perspective Family<br>Description…<sup>‡</sup> | [Learn more](/va) | plum |
| ![](card2.jpg) | Variable annuity<br>#### Elite Access Suite®<br>Description…<sup>§</sup> | [Learn more](/va) | coral |
| ![](card3.jpg) | Registered index-linked annuity<br>#### Jackson Market Link Pro® Suite<br>Description… | [Learn more](/rila) | charcoal |
| ![](card4.jpg) | #### Spread-based products<br>Description… | [Jackson RateProtector®](/fixed)<br>[MarketProtector® Suite](/fia) | tan |
```

One row = one card. Note row 4: **no eyebrow, two links** — both are real source cases, not
hypotheticals.

### Rendered cell contract

```html
<div class="product-cards">
  <div>
    <div><picture><img src="…" alt="…"></picture></div>
    <div>
      <p>Variable annuity</p>
      <h4>Perspective&nbsp;Family</h4>
      <p>Description…<sup>‡</sup></p>
    </div>
    <div><p><a href="/va">Learn more</a></p></div>
    <div>plum</div>
  </div>
  …
</div>
```

The 4th cell is the item-level `classes` value list (xwalk renders item variants as a cell, not a
header). `decorate()` must **read it, apply the accent, and remove the cell.**

### Item model fields (`product-card`)

| Field | Component | Cell | Required | Notes |
|---|---|---|---|---|
| `image` | reference | `image` | no | Source is 306×94 — **do not reuse `cards`' 4/3 crop** |
| `imageAlt` | text | `image` | no | |
| `copy_eyebrow` | text | `copy` | no | **Absent on card 4** — title must sit flush when empty |
| `copy_heading` | text | `copy` | **yes** | Only required field |
| `copy_headingType` | select `h4`/`h3` | `copy` | no | Default `h4` (container H3 precedes it) |
| `copy_description` | richtext | `copy` | no | Must allow `sup` (cards 1–2 carry two each) |
| `links_cta` | aem-content | `links` | no | |
| `links_ctaText` | text | `links` | no | |
| `links_cta2` | aem-content | `links` | no | Card 4 uses it |
| `links_cta2Text` | text | `links` | no | |
| `classes` | select | `classes` | no | Accent palette, below |

### Accent colour — named palette, per card

`--accent-color` is a left border, one of four measured values. It is **not derivable** from the
eyebrow: cards 1 and 2 are both `Variable annuity` yet use `#995D7A` and `#fa9e73`. So it is a
genuine per-card author choice — but constrained to a named select, never free-text hex:

| Option | Value | Used by |
|---|---|---|
| `accent-plum` | `#995D7A` | card 1 |
| `accent-coral` | `#fa9e73` | card 2 |
| `accent-charcoal` | `#474546` | card 3 |
| `accent-tan` | `#d4b5a3` | card 4 |

### Why 2 link slots, not N

Observed max is 2. Two named slots give authors labelled fields and keep the model at exactly 4
cells. A 3-link product would require a model change — the alternative, a `multi: true` container
(counted as a single property, so unlimited links in 1 cell), is available if the team wants
open-ended links, at the cost of a less-proven rendering path.

### Edge cases

No eyebrow (card 4); two links (card 4); no image; unequal body lengths → equal row heights with
links bottom-aligned; 1/2/3/5+ cards without a broken final row (see open decision **D3**, the
source's 3+1 orphan row at ~1200px).

---

## 3. `icon-feature` — Collection (2 items)

### Document form

```
| Icon Feature |
|---|
| :map-marker: | ### Find your wholesaler<br>If you already do business with us…<br>[Start looking](/wholesaler) |
| :user-plus:  | ### Not appointed?<br>If you need new business opportunities…<br>[Get started](/get-appointed) |
```

No container heading or intro — the source's slots are empty and `.card-container__content` measures
`h: 0`. Pure collection.

### Rendered cell contract

```html
<div class="icon-feature">
  <div>
    <div><span class="icon icon-map-marker"></span></div>
    <div>
      <h3>Find your wholesaler</h3>
      <p>If you already do business with us…</p>
      <p class="button-container"><a href="/wholesaler" class="button">Start looking</a></p>
    </div>
  </div>
  …
</div>
```

### Item model fields (`icon-feature-item`)

| Field | Component | Cell | Required | Notes |
|---|---|---|---|---|
| `icon` | select | `icon` | no | Constrained list, **not** a free-text upload |
| `copy_heading` | text | `copy` | **yes** | Only required field |
| `copy_headingType` | select `h3`/`h4` | `copy` | no | Default **`h3`** — see hierarchy fix below |
| `copy_description` | richtext | `copy` | no | Source is a single plain `p` |
| `copy_cta` | aem-content | `copy` | no | Pill button |
| `copy_ctaText` | text | `copy` | no | |

2 cells — the most headroom of the three models.

### Icon source — a real migration gap

The source icon is **neither an `<img>` nor an inline `<svg>`**: it is a Line Awesome icon-font glyph,
`<span class="las la-map-marker"></span>`, rendered via a `::before` codepoint with no accessible
name. EDS has no icon font, so these become `/icons/*.svg` + `<span class="icon icon-*">`.

`icons/` currently contains **only `search.svg`**. Required before authoring:
`icons/map-marker.svg`, `icons/user-plus.svg` (optimised and size-checked per AGENTS.md).
The whole page uses only 4 glyphs — `la-bars`, `la-map-marker`, `la-search`, `la-user-plus` — so the
select's option list is small and closed.

Because the field is a `select`, the cell holds a token (`map-marker`), not `:map-marker:` markup —
`decorate()` builds the `span.icon` and then `decorateIcons()` hydrates it.

### Heading hierarchy fix

The source jumps **H2 → H4** here (the container has no H3 of its own), which fails the AC. Default
`copy_headingType` to `h3`.

### Edge cases

Single item → no dangling divider; 3 items → no half-width orphan; missing icon → heading sits at the
icon baseline with no reserved gap.

> Not a content-model concern, but flagging for `eds-block-authoring`: **the vertical divider's CSS
> declaration is not in the capture bundle.** It is not a border on `.icon-feature__block` or on the
> grid (both computed `border-top-width: 0px`, `column-gap: 0`), and no stylesheet text was captured.
> It must be re-derived from the crop or re-inspected live.

---

## 4. Section model additions (`models/_section.json`)

The three `verdict: none` components and D-A all depend on section styles. Add to the `style`
multiselect (existing `Highlight` retained):

| Option | Value | Used by |
|---|---|---|
| Grey band | `grey` | `cmp-002` hero band, `feature` ×2 (`#EBEBEB`) |
| Tan band | `tan` | `feature` ×1 (`#D4B5A3`) |
| Stone band | `stone` | `product-cards` band (`#DBCFC7`) |
| Brand gradient | `brand-gradient` | `feature` ×1 — **owns its own white text** |
| Full-width image | `full-width-image` | `cmp-007` decorative strip |
| Disclosure | `disclosure` | `cmp-009`, `cmp-012` (14/21 type) |
| Centered | `centered` | `product-cards` H3 + intro (per D-D) |

Also register the three new blocks in the `section` filter, or they are **uninsertable in Universal
Editor** regardless of how good the models are:

```
"components": ["text","image","button","title","hero","cards","columns","fragment",
               "feature","product-cards","icon-feature"]
```

`blocks/*/_*.json` is glob-merged by `build:json`, so each `_{block}.json` auto-registers — but the
section filter is a manual edit.

### Naming conflict to resolve before the import transform runs

`drafts/financial-professional/credit-union.plain.html` (first-pass page-import) already emits
**different** style names: `light`, `brand-gradient`, `blush`, `sand`, `full-width-image`,
`disclosure`. This model uses the measured token names from `analysis.md` §1.2 (`grey`/`tan`/`stone`)
because `blush`/`sand` do not describe `#D4B5A3`/`#DBCFC7`. Either the draft or this model must be
renormalised — **`eds-import-transform` must emit whichever set is chosen.**

Also note `styles.css` currently implements only `.section.light` and `.section.highlight`, both
mapped to `--light-color: #f4f4f4` — **not** the source's `#EBEBEB`. Reusing `light` for the grey band
would be a silent 4-value colour shift; hence a distinct `grey` option.

---

## 5. Validation against best practices

| Check | Result |
|---|---|
| Max 4 cells per row | ✅ 3 / 4 / 2, verified against the real rule |
| Semantic formatting carries meaning | ✅ real `h2`/`h4`, `ul`, `sup`, `a` — no richtext blob targeted by `nth-child` |
| No header rows in collections | ✅ one row = one card |
| No configuration cells | ✅ none; presentation is `classes`, content is fields |
| Smart defaults minimise input | ✅ one required field per model; `aria-label` derived (D-C); text colour derived from background (D-A) |
| Edge cases considered | ✅ every optional field traced to a real source instance |
| Reusable across authoring surfaces | ✅ document-table form and UE field form both specified above |

### Open items

1. **D-A** band background: section style vs block variant — contradicts `analysis.md` §3.1.
2. **D-D** `product-cards` heading: default content vs container fields — contradicts §3.2.
3. Section-style naming conflict with the existing draft (§4).
4. `icons/map-marker.svg` + `icons/user-plus.svg` do not exist yet.
5. `icon-feature` divider CSS is absent from the capture bundle.

`analysis.md` §3.4 (`hero` + `text-only` variant) is **not modelled here** — the approved
`mapping.json` overrode it to `verdict: none` (default content + `grey` section style).
