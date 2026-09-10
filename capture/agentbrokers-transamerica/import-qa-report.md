# Import QA report — /agentbrokers/transamerica

Script: `tools/importer/import.js`
Samples: `agentbrokers-transamerica` (interior template), `home` (regression)

## This is a dry run, not an import

`AEM_IMPORT_API_KEY` is not set, so **no import ran**. Everything below was
produced by executing the same `import.js` against the captured DOM in jsdom
via `.claude/skills/eds-import-transform/scripts/run-local.mjs`, then serving
the result through the real blocks on the local dev server.

What that does *not* exercise: asset ingestion into the DAM, xwalk packaging,
page creation in AEM, and Universal Editor behaviour. Those remain unverified.

The runner emulates two things the real pipeline does for free, and would
otherwise be blamed on the transform: it strips the crawler's `data-eds-id`
instrumentation, and it wraps images in `<picture>`. Without the second, the
hero measured 13px taller for reasons that have nothing to do with the import.

## Result: pass, 5 of 5 components

| ID | Component | Target | Result |
|---|---|---|---|
| cmp-001 | Header / two-level nav | `/nav` document | pass — logo 345x90, 6 items at 133/211/133/160/170/126, submenu row 935x30 with items 146/95/186/97/93 |
| cmp-002 | Banner | `Hero (panel)` | pass — 965x226, panel 241x222, four-stop rule intact |
| cmp-003 | Colour bar | (no block) | pass — dropped from content, drawn by the hero's border-image |
| cmp-005 | Footer | `/footer` document | pass — links left at x=238, copyright right at x=756, one row |
| — | Page body | default content, `content-column` section | pass — 695x31 heading at x=483 in Georgia 24px with a `#ccc` rule, Verdana copy |

Renders in **2 sections**. **No console or page errors.**

## Transform changes made for this page

1. **`transformBody`** — interior pages keep their copy in
   `.cw-content-section > .content-right-sec`. It is a heading plus
   paragraphs, so it lands as default content, with a `Section Metadata`
   table carrying `Style: content-column` for the 75% right column. Layout
   travels as section metadata rather than as a block, because it is layout.
2. **Second-level nav recovery** — `buildNavDocument` now emits the nested
   `<ul>` for whichever branch the page exposes.
3. **`normalizeLinks`** — strips the legacy `/index.php` segment. Interior
   pages link through it and the homepage does not, so without this the same
   target imports under two paths.

## Bugs found and fixed in the transform

1. **The nav duplicated its submenu as top-level items.** `#block-mainnavigation
   ul.menu > li` also matches the nested submenu's items, because the submenu
   is itself a `ul.menu`. Rooted the selector at the block. Produced 11
   top-level items instead of 6.
2. **The heading was never promoted.** `querySelector('.content-right-sec
   .field, .content-right-sec')` returns the ancestor first, so the h2 stayed
   an h2 and the page shipped with no h1.

## Content changes the transform makes — review these

1. **`<h2>` becomes `<h1>`.** The source page has no h1 at all. Consistent
   with the homepage decision, but it is a change to the customer's content.
2. **Logo alt is rewritten** from `"Home"` to the organisation name.
3. **The colour bar is dropped** from content and drawn by the hero's CSS. If
   the hero is ever replaced, the bar goes with it.
4. **Banner image keeps `alt="Transamerica"`.** The image is decorative, so
   `alt=""` would be more correct; left as-is rather than silently changing
   meaning.
5. **Third-party subtrees are dropped** (OneTrust and friends), listed per
   page in `third-party.json`.

## Known gaps

1. **`/nav` is per-page and therefore incomplete.** This page yields the
   Agents/Brokers branch; Policyholders is flagged `data-has-children` because
   its children live on another page. Merge across pages, or author `/nav`
   once by hand, before going wide.
2. **Two templates sampled, three exist.** `capture/index.json` groups the
   three captured pages into three distinct structure hashes. The
   Policyholders template — with its company directory and modal — has no
   transform and is out of scope by agreement.
3. **No asset handling.** `assets.json` lists 4 assets for this page; none
   have been uploaded to a DAM and the transform still emits absolute source
   URLs.
4. **Path mapping is implicit.** `/index.php` is stripped and `.html` dropped,
   but the target root under `/content/<site>/` has not been set.

## To run for real

```
npm run import -- --urls ./urls.txt --importjs tools/importer/import.js \
  --options '{"type":"xwalk","data":{"siteName":"commonwealth","assetFolder":"commonwealth"}}' \
  --models ./component-models.json \
  --filters ./component-filters.json \
  --definitions ./component-definition.json
```

**Do not bulk-run yet** — `/nav` must be assembled first, and no page has been
opened in Universal Editor to confirm the blocks are editable.
