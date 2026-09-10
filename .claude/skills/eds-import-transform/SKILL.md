---
name: eds-import-transform
description: Generate or extend the AEM Importer (aem-import-helper) transformation script — including custom per-component transform functions in WebImporter.rules, page-path mapping and asset handling — based on an approved EDS block mapping, so that migrated pages convert cleanly into the target block structure and land at the right paths in AEM. Use this once a block mapping is approved and the target block's cell/row contract is known (from an existing block's docs, or from eds-block-authoring's output for new/extended blocks). Always run the generated script against sample pages and produce a visual/content QA report before recommending a bulk import.
compatibility: requires an approved mapping.json; target block contracts; aem-import-helper installed; AEM_IMPORT_API_KEY for a live xwalk run; Playwright for visual diffing
---

# EDS import transform generation

Writes the `import.js` logic the AEM Importer uses to turn each migrated
component into the correct block markup, and gets the result into AEM.

## Inputs

- Approved `mapping.json` (all verdicts).
- Each mapped block's contract — the row/cell structure its `decorate()`
  expects. For reused blocks, read the block's own example markup. For
  extend/new, take it from `eds-block-authoring`'s output.
- The capture bundle: `dom.html` per page, plus `assets.json`.

## Process

### 1. Decide default vs. custom transform per component

`aem-import-helper`'s generic DOM-to-block transform handles sections that
are already roughly table-shaped. It does **not** handle structural
reshaping — flattening carousel slides into rows, splitting a mega-menu into
cells, merging a testimonial's quote/name/avatar into one row. Compare the
component's source shape to the target contract; if they line up row for row,
use the default. Don't write a custom function for something already covered.

### 2. Write the custom transform

Add a `WebImporter.rules` transform matching the component's DOM (by selector
or the structural signal used in detection) that:

- selects the right source elements in the right order,
- emits exactly the cell/row structure the contract expects — wrong cell
  count or order is the most common failure mode; check against the contract
  before moving on,
- preserves accessible text alternatives (alt text, aria-labels) into the
  right cell rather than dropping them,
- strips third-party subtrees listed in `third-party.json`.

Follow the style of any transforms already in the repo's import script.

**Every content change the transform makes must be recorded** — retagging a
`<p>` to `<h1>`, rewriting alt text, dropping a decorative element. These are
edits to the customer's content, not faithful copies, and they belong in the
QA report where a human can veto them.

### 3. Map source URLs to AEM paths

Define the path mapping explicitly rather than letting it fall out of the
crawl: source URL → target `/content/<site>/<path>`. Decide and write down:

- where the page tree roots,
- how `/index.php/...`-style legacy segments are normalised,
- which pages become documents (`/nav`, `/footer`) rather than pages.

### 4. Handle assets

Use `assets.json` for the full media list. Confirm the asset folder and site
name passed in `--options`, and check that images referenced by blocks
resolve after import — a page that renders with broken images passes a
markup diff and fails a visual one.

### 5. Run it

Preflight: **fail loudly if `AEM_IMPORT_API_KEY` is unset.** Running the
transform locally against captured DOM is a useful dry run, but it is not an
import, and a QA report that doesn't distinguish the two is misleading.

```bash
npm run import -- --urls ./urls.txt --importjs tools/importer/import.js \
  --options '{"type":"xwalk","data":{"siteName":"<site>","assetFolder":"<folder>"}}' \
  --models ./component-models.json \
  --filters ./component-filters.json \
  --definitions ./component-definition.json
```

Run against a handful of real pages — ideally one per template group from
`capture/index.json`, not several of the same template.

### 6. QA the output

Per sample page:

- render the imported result and diff visually against the original
  screenshot,
- check for dropped content, misordered sections, broken links/images,
- open the page in Universal Editor and confirm each block is **editable** —
  fields present, variants selectable. A block that renders but is opaque in
  the editor is a failed migration, and only this check catches it,
- report pass/fail per component with specifics on failures ("testimonial
  avatar dropped — cell 3 empty").

State plainly in the report whether it reflects a live import or a local dry
run.

## Output

- Updated `import.js` with new/modified transforms.
- The URL→path mapping.
- A QA report across sample pages, including every content change the
  transform makes.

## Human gate — do not skip

Present the QA report before recommending a bulk run. Fidelity problems are
expensive to catch after a large-scale import; a person signs off on the
sample first.
