# Import QA report — commonwealth.globalatlantic.com

Script: `tools/importer/import.js` · Sample: homepage
Run against the captured DOM; output rendered through the real blocks and compared
to `capture/home/screenshots/`.

Artefacts:
- `capture/home/imported/` — importer output (`index`, `nav`, `footer` as `.md` + `.html`)
- `drafts/imported/` — the same output re-rendered as EDS plain HTML for QA
- `capture/home/imported-render/` — screenshots of the imported page

## Result: pass, 5 of 5 components

| ID | Component | Target | Result |
|---|---|---|---|
| cmp-001 | Header / nav | `/nav` document | pass — logo 345x90, 6 items, navy bar 935x26, links Helvetica 12px white |
| cmp-002 | Banner | `Hero (panel)` | pass — 965x226, panel 241x222 on #B2B2B2, buttons 142x37 Georgia on #00457C, four-stop rule intact |
| cmp-003 | Colour bar | (no block) | pass — dropped from content, drawn by the hero's border-image |
| cmp-004 | Statement | default content | pass — promoted to `<h1>`, Georgia 21px/34px #868686 |
| cmp-005 | Footer | `/footer` document | pass — 2 links 11px #00447C plus copyright |

Renders in **2 sections**. **No console or page errors.** Every measurement matches
the hand-authored reference in `visual-diff-report.md`.

## Transform decisions worth noting

1. **Colour bar is removed at import time.** `.content-banner-color` is stripped in the
   `DOMUtils.remove` list rather than being carried into content, because the bar is
   drawn by the hero block's `border-image`. If the hero is ever replaced, the bar
   disappears with it.
2. **The statement is retagged `<p>` to `<h1>`.** The source page has no heading at
   all. This is a content change made by the importer, not a faithful copy.
3. **Logo alt text is rewritten.** The source uses `alt="Home"`; the import replaces it
   with the organisation name so the brand link has a meaningful accessible name.
4. **Collapsed menu items are annotated, not expanded.** Items Drupal marks
   `menu-item--collapsed` get `data-has-children="true"` so a later pass can find them.
   Their children are not on this page and cannot be recovered from it.
5. **Consent SDK stripped.** OneTrust injects a large markup tree; it is removed along
   with the Drupal a11y helpers, or it would dominate the imported document.

## Known gaps and caveats

1. **One page sampled.** Selectors are homepage-shaped. Interior pages of this site use
   different Drupal field wrappers, and the two-level navigation only exists there.
   Re-run detection on an interior page before any bulk import.
2. **Banner image keeps `alt="home banner"`** from the source. The image is decorative,
   so `alt=""` would be more correct; left as-is rather than silently changing meaning.
3. **No live import has been run.** `npm run import` calls Adobe's Import as a Service
   and needs `AEM_IMPORT_API_KEY`, which is not set here. Everything above was produced
   by executing the same transform locally against the captured DOM.
4. **The QA renderer is a local stand-in for the pipeline** — same
   `@adobe/remark-gridtables` stack, plus `<picture>` wrapping and Metadata extraction.
   Close, not identical.
5. **Metadata carries only a Title.** The source page publishes no meta description.

## To run for real

```
npm run import -- --urls ./urls.txt --importjs tools/importer/import.js \
  --options '{"type":"xwalk","data":{"siteName":"commonwealth","assetFolder":"commonwealth"}}' \
  --models ./component-models.json \
  --filters ./component-filters.json \
  --definitions ./component-definition.json
```

**Do not bulk-run yet** — sample an interior page first.
