# Visual diff report — commonwealth.globalatlantic.com/agentbrokers/transamerica

Branch: `migrate/globalatlantic-homepage`
Source: `capture/agentbrokers-transamerica/screenshots/`
Migrated: `capture/verify/imported-render/screenshots/` (the importer output, rendered
through the real blocks — not the hand-authored draft)

## Geometry at 1440

| element | source | migrated | |
|---|---|---|---|
| logo | 345x90 @y26 | 345x90 @y26 | match |
| navy bar | 937x26 @y128 | 935x26 @y128 | match |
| subnav row | 937x30 @y154 | 935x30 @y154 | match |
| hero block | 965x215 @y184 | 965x226 @y184 | ≈ 11px |
| panel aside | 241x215 @y184 | 241x222 @y184 | ≈ 7px |
| banner image | 709x215 @y184 | 724x222 @y184 | 22px |
| heading | 695x31 @y432 | 695x31 @y455 | 23px, y only |
| body paragraph | 695x18 @y483 | 695x18 @y506 | 23px, y only |

Nav item widths, source vs migrated: `134/211/133/160/170/125` vs
`133/211/133/160/170/126`. Submenu item widths: `146/95/186/97/93` in both.

Pixel probes (source vs migrated): navy bar gradient at +3px
`107,145,180` vs `103,144,177`; at +9px `54,103,152` vs `57,111,154`; at +17px
and below both `0,69,124`. Active nav item `128,160,190` vs `127,161,189`.
Submenu strip `232,236,244` in both.

No console or page errors at 375, 768 or 1440.

## What changed

Two extends, no new blocks.

- **`header`** — the source renders a section's second level as a permanent
  30px row under the navy bar, not as a dropdown, and only for the section the
  current page is in. Since one `/nav` document serves every page, that trail
  can only be resolved at runtime, so `markActiveTrail()` matches
  `window.location.pathname` against each nav link and marks the branch.
- **`hero`** — model only. The `panel` variant already existed in CSS and JS;
  `_hero.json` gained the `classes` field that makes it selectable.

New global section style `content-column` for the interior page body, and a
footer layout fix. Both derive from measured source rules, not from eyeballing.

## Bugs found and fixed during verification

1. **Subnav overflowed the header.** The submenu row is absolutely positioned
   under the navy bar, and nothing reserved space for it, so it overlapped the
   hero by 12px. The source reserves a 30px strip on *every* page (empty on the
   homepage) — now reproduced unconditionally.
2. **Navy bar sat 12px low on every page.** Pre-existing, inherited from the
   homepage build, and invisible to the earlier QA because that pass compared
   width and height but not position. The source seats the logo at y=26 and the
   bar at y=128; the offset belongs in the header's padding, not its gap.
3. **Subnav row was 965px instead of 937px.** `width: 100%` plus `padding: 0
   15px` with no `box-sizing`. The repo has no global border-box reset.
4. **Nav items were equal-width.** The source sizes each item by its label
   (`padding: 0 40px` on the anchor), giving 134/211/133/160/170/125. Also
   pre-existing and also missed by the earlier pass, which measured the bar but
   not its items.
5. **Navy bar was flat.** The source paints a gif: 2px navy hairline, then
   `#7298b7` fading back to navy over 15px, then flat. Sampled row by row and
   reproduced as a `linear-gradient`. This also explains the active item, whose
   `rgb(255 255 255 / 20%)` reads much lighter over the gradient than over flat
   navy.
6. **Submenu strip was white.** Source is `#e8ecf4`.
7. **Footer stacked its two rows.** The source floats links left and copyright
   right on one line above 767px. Pre-existing; the earlier report checked the
   link colour and size but not the arrangement.
8. **Interior body was full width.** The source floats it into a 75% right
   column in Verdana with a ruled Georgia heading.

Items 2, 4 and 7 are corrections to output that was signed off during the
homepage migration. All three move toward the source, and the homepage was
re-measured after each: logo, navy bar and item widths now match there too.

## Known gaps

1. **Hero panel and banner image run 7–11px tall.** Inherited from the homepage
   build, where the same deltas were accepted. The panel prompt has less
   leading than the source's and the image fills its column (724px) rather than
   sitting at its natural 709px inside it. Not fixed here because the fix
   changes a block shared with the already-approved homepage; worth doing as a
   deliberate follow-up rather than a side effect of this page.
2. **The body block starts 23px lower** than the source. It is a knock-on of
   gap 1 (the hero is 11px taller) plus section margin, not an independent
   error — the block's own size and horizontal placement match exactly.
3. **`/nav` is incomplete from any single page.** Drupal renders a section's
   children only when that section is active, so the Transamerica page yields
   the Agents/Brokers branch and flags Policyholders `data-has-children`.
   A complete `/nav` needs one page per section, or one hand-authored document.
4. **The mobile submenu is a plain indent** in the white panel, not the
   source's navy overlay. The mobile nav was already a white panel in this
   build; matching the source there would mean rebuilding the mobile nav.
5. **Base font size is 12px**, faithful to a 2014 design and below modern
   accessibility norms. Flagged, not silently modernised.
