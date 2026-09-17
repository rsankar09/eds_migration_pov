---
name: eds-author-upload
description: Run the approved importer transform over source pages and land the result as authorable content in AEM author (xwalk / Universal Editor), then verify the page renders and is editable there. Use this as the last stage of an EDS migration, once block code exists and the import transform is approved — it is the step that turns a migration from "blocks in a repo" into "a page an author can open". Do not bulk-upload: land one sample page, verify it in the editor, and get human sign-off before the rest. Never target a production author environment without explicit approval.
compatibility: requires @adobe/aem-import-helper (repo dependency); an approved tools/importer/import.js; the aggregated component-definition/models/filters JSON; an AEM author base URL and a login token; network access to that environment
---

# EDS author upload

The last mile: source URL → imported block markup → content package → AEM
author, where a person can open the page in Universal Editor.

Earlier stages stop at code. `eds-block-authoring` produces blocks;
`eds-import-transform` produces the transform script and QAs it. Neither puts
a page anywhere. This skill does, and is where a migration stops being a
proposal.

## Inputs

- A page assembled and verified locally by `eds-page-assemble`. Do not upload
  a set of blocks that has never been composed into a page — the failures this
  catches (adjacency, chrome, missing components, project breakpoints) become
  content in a live environment once uploaded.
- Approved `tools/importer/import.js` (from `eds-import-transform`).
- The aggregated `component-definition.json`, `component-models.json`,
  `component-filters.json` — regenerate them first if any model partial
  changed, or the importer will emit the *old* cell structure.
- A URL list (one per line) for the pages to import.
- `--target`: the AEM author base URL, e.g.
  `https://author-pNNNNN-eNNNNNN.adobeaemcloud.com`.
- `--token`: an AEM login token, or a path to a file containing one. Never
  paste a token into a command that gets logged or committed — use a file
  path, and keep it out of the repo.

If the target or token is missing, stop and ask. Do not guess an environment.

## Why the model JSONs matter here

`aem-import-helper import` takes `--models`, `--filters` and `--definitions`.
The importer builds each block's cell and row structure **from the component
model** — the same field-grouping that determines what `decorate()` receives.
So the model partial is the contract on both ends: it shapes what the editor
delivers *and* what the importer writes. A model change that was never
aggregated means imported pages and authored pages disagree about the same
block.

Regenerate and confirm clean before importing (commonly `npm run build:json`).

## Process

### 1. Import one page first

```sh
aem-import-helper import --urls urls.txt --importjs tools/importer/import.js \
  --models component-models.json --filters component-filters.json \
  --definitions component-definition.json
```

Inspect the output before going near AEM: open the produced markup and check
it against the block contracts the mapping approved. A transform that emits
the wrong cell count fails silently later — the block renders unstyled rather
than erroring.

### 2. Upload to AEM author

```sh
aem-import-helper aem upload --zip <content-package.zip> \
  --token <token-or-token-file> --target <aem-author-base-url> \
  [--asset-mapping image-mapping.json] [--local-assets <dir>]
```

What this actually does, so failures are diagnosable:

- Validates the token with a HEAD request against `--target`.
- Uploads referenced assets, unless `--skip-assets`.
- Installs the content package via `${target}/crx/packmgr/service.jsp`.

`--images-to-png` defaults to **true** and rewrites references — check whether
that is what the site wants before accepting it for a bulk run.

### 3. Verify in the editor, not just on the page

A page can render correctly and still be unauthorable. Open the uploaded page
in Universal Editor and confirm:

- Each block appears with its fields editable in the properties rail — if a
  block is missing from the component filter, it renders but cannot be added
  or edited.
- The delivered markup matches the contract the block was built against (one
  row per field group). This is the shape the blocks must already handle; if
  something renders unstyled here, the block is reading rows instead of cells.
- Assets resolved to DAM references, not still-remote URLs.
- Page properties/metadata (title, description, theme) carried across.

Capture the editor-delivered markup for at least one instance of each block
and keep it — it is the only real sample of that surface, and every later
block change should be checked against it.

### 4. Then, and only then, bulk import

Repeat with the full URL list once a person has signed off on the sample.

## Human gate — do not skip

Two gates, for different reasons:

1. **Before the first upload**: confirm the target environment. Uploading to
   the wrong one writes content into somebody's site.
2. **After the sample page, before the bulk run**: a wrong transform repeated
   across hundreds of pages is expensive to unpick, and the failure mode is
   quiet.

## Output

- The imported content package and asset mapping.
- The upload summary (what installed, what assets moved).
- The editor-delivered markup sample per block.
- A verification note per page: renders correctly / editable in UE / assets in
  DAM / metadata carried.

## Handoff

Blocks that turn out to mishandle the editor-delivered shape go back to
`eds-block-authoring`; transforms that emit the wrong cells go back to
`eds-import-transform`. Neither is a content problem — resist fixing either
by hand-editing the authored page, which does not survive a re-import.
