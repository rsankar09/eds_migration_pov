# Visual diff report — commonwealth.globalatlantic.com homepage

Branch: `migrate/globalatlantic-homepage` (branched from clean `main`; the PPM
work on `migrate/ppm-homepage` is untouched).
Original: `capture/home/screenshots/` · Rendered: `capture/home/rendered/`

## Geometry, original vs rendered at 1440

| Element | Original | Rendered | Status |
|---|---|---|---|
| Logo | 345x90 @y14 | 345x90 @y14 | match |
| Nav bar | 937x26 | 935x26 | match |
| Nav link | Helvetica 12px/700 white | Helvetica 12px white | match |
| Banner section | 965x233 | 965x226 | match (-7px) |
| Login panel | 241x233, #B2B2B2 | 241x222, #B2B2B2 | match |
| CTA button | 142x37, Georgia 16px on #00457C | 142x37, Georgia 16px on #00457C | match |
| Banner image | 709x215 | 724x222 | match (+15px wide) |
| Colour bar | 4 x 4px, quarters | 4 x 4px, quarters at 479/720/962 | match |
| Statement | Georgia 21px/34px #868686 | Georgia 21px/34px #868686 | match |
| Footer links | 11px #00447C | 11px #00447C | match |

No console or page errors at any breakpoint.

## What was built

Three extends, no new blocks:

- **`header`** — logo row above a full-bleed navy menu bar, 6 items with hairline
  separators, hamburger right-aligned below 900px.
- **`hero`** — new `panel` variant: #B2B2B2 aside with a 13px prompt and two stacked
  Georgia CTA buttons at 25%, contained banner image at 75%, closed by the four-stop
  brand rule.
- **`footer`** — inline pipe-separated link row plus copyright line.

Two components were deliberately **not** built:

- **Colour bar (cmp-003)** — rendered as a `border-image` gradient on the hero rather
  than a block, so there is no empty block for authors to misuse.
- **Statement (cmp-004)** — default content, promoted from `<p>` to `<h1>`.

## Bugs found and fixed during verification

1. **Logo rendered at y = -75, off-screen.** The desktop grid template dropped the
   `hamburger` and `tools` named areas that the boilerplate still assigns via
   `grid-area`, so those items auto-placed and pushed the brand row out of the header
   box. Switched the desktop header to flex.
2. **Hero rendered full-bleed at 1440.** The boilerplate's
   `.hero-container .hero-wrapper { max-width: unset }` bleeds the hero; this design
   keeps the banner inside the 965px container. Constrained the `panel` variant.
3. **Panel content was full-width.** The source indents prompt and buttons to a shared
   142px measure; buttons were rendering at 222px.
4. **Mobile logo was 325px wide** at a 375px viewport, colliding with the hamburger.
   Capped at 245px below 900px.
5. **Hamburger was on the left**, source has it right of the logo. Reordered the grid
   template at both mobile states.
6. **Navy bar stretched to 44px** (source 26px). The boilerplate sets
   `.nav-sections { flex: 1 1 auto }` later in the file than my override, so on equal
   specificity it won and the bar filled the header. Pinned to `flex: 0 0 auto`.

## Known gaps

1. **The source page has no `h1`.** I promoted the Georgia statement to `h1` so the
   migrated page has a real heading. This is a judgement call I made without
   confirmation — revert to `<p>` if you want byte-fidelity over accessibility.
2. **Sub-navigation cannot be modelled from this page.** Policyholders and
   Agents/Brokers carry Drupal's `menu-item--collapsed`, meaning they have children,
   but no submenu markup renders on the homepage. A second page must be crawled before
   a two-level nav can be built. The current header handles single-level only.
3. **`/nav` and `/footer` are drafts, not CMS content.** Verified against
   `drafts/nav.plain.html` and `drafts/footer.plain.html`; the real documents still
   need authoring.
4. **No import transform yet.** Only block code and drafts exist. `tools/importer/`
   was written for PPM on the other branch and does not apply to this Drupal markup.
5. **Base font size is 12px**, faithful to a 2014 design but below modern accessibility
   norms. Flagging rather than silently modernising.
6. A faint smear appears at the top-left of both the original and rendered full-page
   screenshots. Confirmed by hit-testing to be a screenshot stitching artifact — no
   element renders above y=14 in either page.
