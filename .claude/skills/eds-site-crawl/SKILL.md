---
name: eds-site-crawl
description: Crawl a website (single URL, list of URLs, or sitemap) and produce a structured capture bundle — rendered DOM, computed styles, and multi-breakpoint screenshots — as the input for EDS (Edge Delivery Services) migration analysis. Use this whenever the user gives a URL and wants it migrated to EDS, wants a site "scanned" or "analyzed" for migration, or asks to capture/inventory a page's markup and styles before component detection. Always run this first in an EDS migration pipeline, before eds-component-detect.
compatibility: requires Playwright (node) with a working browser binary; bash/file tools
---

# EDS site crawl

Turns a URL into a self-contained capture bundle that later skills reason
over, without needing to re-fetch the live site.

## Inputs

- One URL, a list of URLs, or a `sitemap.xml` URL.
- Breakpoints (default: `375` mobile, `768` tablet, `1440` desktop — override
  if the user specifies their own).
- Output directory (default: `./capture/`).

If given a sitemap, ask the user to confirm the page count before crawling
everything — large sites should be sampled (e.g. one of each template type)
rather than crawled in full on a first pass. If unsure which pages are
representative, ask.

## Process

1. **Resolve the URL set.** Expand a sitemap into URLs; dedupe; strip
   tracking params.
2. **For each URL**, launch a headless browser and:
   - Navigate and wait for network-idle (SPA-heavy pages may need an explicit
     extra wait or a scroll-to-bottom pass to trigger lazy-loaded content —
     check for empty `<img>` `src`/placeholder attributes after initial load
     and re-capture if found).
   - For each breakpoint: set viewport width, capture a full-page screenshot.
   - Serialize the DOM (`document.documentElement.outerHTML`) once, at the
     desktop breakpoint, since structure rarely changes across breakpoints —
     only capture DOM separately per-breakpoint if you detect responsive
     markup swaps (e.g. `<picture>` sources, conditionally rendered nav).
   - Walk top-level sections (roughly: direct children of `<main>`, plus
     `<header>`/`<footer>`/`<nav>`) and record computed style for each:
     color, background, font-family/size/weight, padding/margin, display,
     grid/flex properties, and bounding rect.
3. **Write the bundle** per page:
   ```
   capture/<page-slug>/
     meta.json        { url, crawled_at, breakpoints, page_title }
     dom.json          { html: "<serialized DOM>" }
     styles.json        [ { selector_path, tag, computed: {...}, rect: {x,y,w,h} }, ... ]
     screenshots/
       375.png  768.png  1440.png
   ```

## Output

The bundle above. Report back to the user: number of pages captured, any
pages that failed or looked incomplete (auth walls, JS errors, empty body),
and the output directory path.

## Edge cases

- **Auth-gated or paywalled pages**: skip and list them separately rather
  than capturing a login screen.
- **Infinite scroll / pagination**: capture only the first viewport-load
  unless the user asks for full-depth capture; note this limitation in
  `meta.json` (`"truncated": true`).
- **Cookie/consent banners**: attempt a best-effort dismiss (common selector
  patterns) before capturing; note if one couldn't be dismissed, since it
  will otherwise get detected as a spurious "component" downstream.

## Handoff

Output feeds directly into `eds-component-detect`. Don't discard the
screenshots or DOM after this step — component detection, mapping review, and
QA all re-open them.
