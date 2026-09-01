# Import QA report — PPM America

Script: `tools/importer/import.js` · Sample: `https://www.ppmamerica.com/` (homepage)
Run against the captured DOM; output rendered through the real blocks and compared
to `capture/home/screenshots/`.

Artefacts:
- `capture/home/imported/` — importer output (`index`, `nav`, `footer` as `.md` + `.html`)
- `drafts/imported/` — the same output re-rendered as EDS plain HTML for QA
- `capture/home/imported-render/` — screenshots of the imported page

## Result: pass, 8 of 8 components

| ID | Component | Target block | Result |
|---|---|---|---|
| cmp-001 | Header / nav | `/nav` document | pass — 4 top-level items, 15 children, 4 dropdowns, search control present |
| cmp-002 | Hero | `Hero (card)` | pass — 1440x409, image + h1, image row tagged correctly |
| cmp-003 | Intro | `Columns (thirds)` | pass — 2 cells, heading + prose |
| cmp-004 | Stats band | `Stats` | pass — 8 stats in 2 groups, `$` prefix and `%` suffix parsed, footnote `<sup>` intact |
| cmp-005 | Insights cards | `Cards (insights)` | pass — 3 cards, 3 whole-card links, 3 images, section heading outside the block |
| cmp-006 | Our Advantage | `Feature (gray)` | pass — 690/690 split, 6 bullets, CTA resolved to `button primary` |
| cmp-007 | Disclaimer | `Disclaimer` | pass — 2 notes |
| cmp-008 | Footer | `/footer` document | pass — 2 rows, logo/address/social + copyright/policy |

Page renders in **6 sections**, **2817px** tall against the hand-authored
reference's 2812px and the original's 2899px. **No console or page errors.**

## Defects found and fixed during QA

1. **Everything imported into a single EDS section** — no `---` breaks, which collapsed
   section spacing and the full-bleed banding on stats and disclaimer. Added
   `addSectionBreaks()`, which also keeps an introducing heading with its block.
2. **`/nav` and `/footer` had no section breaks** — the header block classes
   `nav.children[0..2]` as brand/sections/tools by index, so without breaks the
   whole document collapsed into one mis-classed section.
3. **Description metadata duplicated** — `createMetadata` concatenates `description`
   and `og:description`, which are identical on this site. Added `dedupeMetadata()`.
4. **Footer LinkedIn icon dropped to a text link** — now keeps the mark and moves the
   `aria-label` onto the image's `alt`.
5. **Heading levels followed the source's visual scale, not the outline.** Fixed on the
   block side rather than in the import: the uppercase treatment is now scoped to
   `.columns.thirds` and `.feature`, so the import can emit a correct
   h1 → h2 → h3 hierarchy instead of picking levels for their styling side effects.

## Known gaps and caveats

1. **One page sampled.** The mapping was derived from the homepage only. Other templates
   (article, listing, team) will contain components not in this inventory, and the
   selectors here are homepage-shaped. Re-run detection on one page per template before
   any bulk import.
2. **Stat labels and the feature heading import as ALL CAPS** because that is how the
   source stores them. Rendering is correct (the CSS uppercases regardless), but authors
   will see shouty text in the editor. Worth a normalising pass if you care.
3. **Hero image has empty alt text** — faithful to the source, which sets `alt=""`. It is
   a meaningful image and should get real alt text during content review.
4. **Fonts are still substituted** (Azo Sans / Century Std are licensed and absent), so
   every screenshot renders a weight light. Unchanged from the block-authoring stage.
5. **The QA renderer is a local stand-in for the pipeline.** It uses the same
   `@adobe/remark-gridtables` + `mdast2hastGridTablesHandler` stack, plus `<picture>`
   wrapping and Metadata extraction to mimic pipeline behaviour. It is close, not
   identical — final confirmation should come from a real import run.
6. **No live import has been run.** `npm run import` calls Adobe's Import as a Service
   and needs `AEM_IMPORT_API_KEY`, which is not set here. Everything above was produced
   by executing the same transform locally against the captured DOM.

## To run for real

```
# document-based
npm run import -- --urls ./urls.txt --importjs tools/importer/import.js

# xwalk (this project is aem-boilerplate-xwalk, so this is the one you want)
npm run import -- --urls ./urls.txt --importjs tools/importer/import.js \
  --options '{"type":"xwalk","data":{"siteName":"ppm","assetFolder":"ppm"}}' \
  --models ./component-models.json \
  --filters ./component-filters.json \
  --definitions ./component-definition.json
```

**Do not bulk-run yet** — sample one page per remaining template first.
