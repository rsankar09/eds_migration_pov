---
name: eds-import-transform
description: Generate or extend the AEM Importer (aem-import-helper) transformation script — including custom per-component transform functions in WebImporter.rules — based on an approved EDS block mapping, so that migrated pages convert cleanly into the target block structure. Use this once a block mapping is approved and the target block's cell/row contract is known (from an existing block's docs, or from eds-block-authoring's output for new/extended blocks). Always run the generated script against sample pages and produce a visual/content QA report before recommending a bulk import.
compatibility: requires an approved mapping.json; target block contracts (existing block docs, or eds-block-authoring output); aem-import-helper installed; Playwright for visual diffing against original pages
---

# EDS import transform generation

Writes the actual `import.js` logic the AEM Importer uses to turn each
migrated component into the correct block markup.

## Inputs

- Approved `mapping.json` (all verdicts — reuse, extend, new).
- For each mapped block: its expected contract — the row/cell structure the
  block's `decorate()` expects. For reused blocks, read this off the existing
  block's own example markup/docs. For extend/new blocks, this comes from
  `eds-block-authoring`'s output.
- The original page HTML (from the capture bundle) for each component.

## Process

### 1. Decide default vs. custom transform per component

`aem-import-helper`'s generic DOM-to-block transform handles many
straightforward cases (a section that's already roughly table-shaped). It
does **not** handle structural reshaping — flattening a carousel's slides
into block rows, splitting a nav's mega-menu into the right cell layout,
merging a testimonial's quote/name/avatar into one row. Check the component's
original HTML shape against the target contract; if they already line up
row-for-row, the default transform is enough — don't write a custom function
for something the default already covers.

### 2. Write the custom transform function

For components that need one, add a `WebImporter.rules` transform matching
the component's DOM (by selector or the same structural signal used in
detection) that:
- Selects the right source elements in the right order.
- Emits exactly the cell/row structure the target block contract expects —
  wrong cell count or order is the most common failure mode, double-check
  against the contract before moving on.
- Preserves accessible text alternatives (alt text, aria-labels) into the
  appropriate cell rather than dropping them.

Look at any existing custom transforms already in the repo's import script
first and follow their style/structure as a pattern — don't introduce a
different code style for new transforms in the same file.

### 3. Run against sample pages

Run the updated import script against a handful of real captured pages
(ideally one per template/component combination present in the mapping).
Capture the resulting markdown/docx output.

### 4. QA the output

For each sample page:
- Render the imported result and compare visually against the original
  screenshot (Playwright diff).
- Check for dropped content, misordered sections, or broken links/images.
- Produce a short report per page: pass/fail per component, and specifics
  for any failure (e.g. "testimonial avatar image dropped — cell 3 empty").

## Output

- Updated `import.js` (or the relevant rules file) with new/modified
  transform functions.
- A QA report across sample pages.

## Human gate — do not skip

Present the QA report before recommending a bulk import run across the full
site. Visual and content fidelity issues are expensive to catch after a
large-scale import; a person should sign off on the sample results first.
