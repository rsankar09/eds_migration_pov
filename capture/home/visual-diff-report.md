# Visual diff report — PPM America homepage

Branch: `migrate/ppm-homepage` (uncommitted working tree)
Original capture: `capture/home/screenshots/` · Rendered: `capture/home/rendered/`
Verified at 375 / 768 / 1440 against `http://localhost:3000/drafts/index`.

## Geometry, original vs rendered at 1440

| Element | Original | Rendered | Status |
|---|---|---|---|
| Hero band | 1440x414 | 1440x409 | match |
| Hero card | 750x199 | 750x191 | match |
| Hero h1 | 690x129, 48px serif | 690x131, 48px serif | match |
| Intro left column | 455px | 450px | match |
| Stats band | 1440x493, full bleed | 1440x496, full bleed | match |
| Stat numeral | 112px serif | 112px serif | match |
| Stat label | 18px uppercase | 18px uppercase | match |
| Secondary numeral | 70px | 70px | match |
| Card tile | 450x606 | 450x600 | match |
| Card image | 450x450 (1:1) | 450x450 (1:1) | match |
| Card eyebrow | 20px, 3px tracking | 20px, 3px tracking | match |
| Card title | 24px bold uppercase | 24px bold uppercase | match |
| Feature media / content | 690 / 690 | 690 / 690 | match |
| CTA button | #008578, 2px radius | #008578, 2px radius | match |
| Disclaimer band | 1440 full bleed, 12px | 1440 full bleed, 12px | match |
| Page height | 2899 | 2812 | -87px, see note 3 |

## Behavioural checks

- Insights cards: exactly one anchor per tile wrapping the whole card, correct hrefs, no nested anchors.
- Stats parsing: `$95` -> prefix `$`; `53%` -> suffix `%`; footnote `<sup>` preserved.
- Header search: toggle sets `aria-expanded`, unhides the panel, moves focus to the input.
- Responsive: stats and cards go 4-up / 2-up / 1-up; feature and hero card stack below 900px.
- No console or page errors at any breakpoint.

## Bugs found and fixed during verification

1. Hero image rendered 900px tall — `height: 100%` alongside `aspect-ratio` makes the ratio inert. Changed to `height: auto`.
2. Stats and disclaimer bands did not bleed — the `.stats-wrapper` reset lost on specificity to `main > .section > div`. Re-scoped to `main .section > .stats-wrapper`.
3. Feature split 668/713 instead of 690/690 — with `flex-basis: 0` on a border-box cell the basis floors at the cell's own padding. Switched the row to a two-track grid.
4. Stat labels were 16px instead of the source's 18px.

## Known remaining gaps

1. **Fonts are substituted.** Azo Sans and Century Std are licensed and not in the repo. `styles/fonts.css` carries metric-adjusted Helvetica/Georgia fallbacks and commented-out `@font-face` blocks; drop the licensed `.woff2` files into `/fonts` and uncomment. Everything currently renders one weight lighter than the original as a result.
2. **`/nav` and `/footer` are drafts, not CMS content.** The header and footer blocks were verified against `drafts/nav.plain.html` and `drafts/footer.plain.html`. Those two documents still have to be authored in the CMS before the blocks work on a real page — that is content work, not code.
3. **Page is 87px shorter than the original.** Accumulated section-margin differences; no single section is off by more than ~15px. Left as-is rather than hand-tuning per-section margins away from the boilerplate's section rhythm.
4. **Intro paragraph measure is pinned at 620px** in the `columns.thirds` variant to match the source's line breaks, rather than filling the 930px column.
5. **Header second-level dropdowns use boilerplate behaviour**, not the source's full-width panel. Links, hover/keyboard behaviour and mobile drawer match; the panel's visual treatment is simplified.
