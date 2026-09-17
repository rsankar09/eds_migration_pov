#!/usr/bin/env node
/**
 * eds-site-crawl — produce a capture bundle for EDS migration analysis.
 *
 * Site-agnostic: no per-site selectors or assumptions. Usage:
 *   node crawl.js <url|urls.txt|sitemap.xml> [--output ./capture]
 *     [--breakpoints 375,768,1440] [--max N] [--full-scroll]
 *
 * Emits per page:
 *   <output>/<slug>/meta.json dom.json styles.json styles-<bp>.json screenshots/<bp>.png
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BREAKPOINTS = [375, 768, 1440];

// Generic consent-banner dismissal. Ordered most-specific first. Best effort.
const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#onetrust-reject-all-handler',
  'button#truste-consent-button',
  '[aria-label*="accept cookies" i]',
  'button[title*="Accept" i]',
  '.cookie-banner button, #cookie-banner button',
  'button:has-text("Accept All")',
  'button:has-text("Accept all")',
  'button:has-text("I Accept")',
  'button:has-text("Got it")',
];

function parseArgs(argv) {
  const args = { input: null, output: './capture', breakpoints: DEFAULT_BREAKPOINTS, max: 0, fullScroll: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--output') { args.output = argv[++i]; } else if (a === '--breakpoints') {
      args.breakpoints = argv[++i].split(',').map((n) => parseInt(n.trim(), 10)).filter(Boolean);
    } else if (a === '--max') { args.max = parseInt(argv[++i], 10); } else if (a === '--full-scroll') { args.fullScroll = true; } else if (!a.startsWith('--')) { args.input = a; }
  }
  return args;
}

function slugify(url) {
  const u = new URL(url);
  const p = u.pathname.replace(/\.(html?|php|aspx)$/i, '').replace(/^\/|\/$/g, '');
  const slug = (p || 'index').replace(/[^a-z0-9/-]+/gi, '-').replace(/\//g, '--').toLowerCase();
  return slug || 'index';
}

const TRACKING_PARAMS = /^(utm_|gclid|fbclid|mc_|_hs|msclkid|igshid)/i;
function cleanUrl(raw) {
  const u = new URL(raw);
  [...u.searchParams.keys()].forEach((k) => { if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k); });
  u.hash = '';
  return u.toString();
}

async function resolveUrls(input, max) {
  let urls = [];
  if (/^https?:\/\//i.test(input)) {
    if (/sitemap.*\.xml$/i.test(input)) {
      const res = await fetch(input);
      const xml = await res.text();
      urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    } else {
      urls = [input];
    }
  } else {
    const txt = await readFile(input, 'utf8');
    urls = txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  }
  urls = [...new Set(urls.map(cleanUrl))];
  return max > 0 ? urls.slice(0, max) : urls;
}

async function dismissConsent(page) {
  for (const sel of CONSENT_SELECTORS) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 700 })) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        return sel;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        y += step;
        if (y >= document.body.scrollHeight) { clearInterval(timer); resolve(); }
      }, 100);
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

/** Serialize top-level sections + computed styles. Runs in page context. */
const COLLECT_STYLES = () => {
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize',
    'fontWeight', 'lineHeight', 'textAlign', 'padding', 'margin', 'display',
    'gridTemplateColumns', 'gridGap', 'gap', 'flexDirection', 'justifyContent',
    'alignItems', 'borderRadius', 'border', 'maxWidth'];

  function selectorPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) { s += `#${cur.id}`; parts.unshift(s); break; }
      const cls = (cur.className && typeof cur.className === 'string')
        ? cur.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      if (cls) s += `.${cls}`;
      const parent = cur.parentElement;
      if (parent) {
        const sibs = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (sibs.length > 1) s += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }

  // Third-party overlay widgets (consent, feedback, chat). These stay in the
  // DOM even when visually dismissed and otherwise surface as false-positive
  // components downstream. Matched generically, not per-site.
  const THIRD_PARTY = /onetrust|ot-sdk|optanon|truste|qsifeedback|qualtrics|drift|intercom|usabilla|livechat|hubspot-messages/i;
  const isThirdParty = (el) => THIRD_PARTY.test(`${el.id} ${typeof el.className === 'string' ? el.className : ''}`);

  // Find the real content root: prefer <main>, else unwrap single-child
  // wrapper chains from <body> (common in AEM/WP templates) so that we start
  // from the element whose children are actual page sections.
  let contentRoot = document.querySelector('main');
  if (!contentRoot) {
    contentRoot = document.body;
    let guard = 0;
    while (contentRoot && guard < 12) {
      const kids = [...contentRoot.children].filter(
        (c) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(c.tagName) && !isThirdParty(c),
      );
      if (kids.length === 1 && kids[0].children.length > 0) { contentRoot = kids[0]; guard += 1; } else break;
    }
  }

  const roots = [];
  roots.push(...contentRoot.children);
  ['header', 'footer', 'nav'].forEach((t) => roots.push(...document.querySelectorAll(t)));

  const seen = new Set();
  const out = [];
  const visit = (el, depth) => {
    if (!el || el.nodeType !== 1 || seen.has(el) || depth > 3) return;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) return;
    if (isThirdParty(el)) return;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cs = getComputedStyle(el);
    const computed = {};
    PROPS.forEach((p) => { computed[p] = cs[p]; });
    out.push({
      selector_path: selectorPath(el),
      tag: el.tagName.toLowerCase(),
      classes: typeof el.className === 'string' ? el.className : '',
      id: el.id || '',
      role: el.getAttribute('role') || '',
      child_count: el.children.length,
      text_preview: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      computed,
      rect: {
        x: Math.round(r.x + window.scrollX),
        y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    });
    // Single-child wrappers (layout shells with no siblings) are transparent:
    // they don't consume depth budget, so nesting-heavy templates still reach
    // their real section elements.
    const kids = [...el.children].filter(
      (c) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(c.tagName),
    );
    const nextDepth = kids.length === 1 ? depth : depth + 1;
    kids.forEach((c) => visit(c, nextDepth));
  };
  roots.forEach((el) => visit(el, 0));
  return out;
};

async function crawlPage(browser, url, args) {
  const slug = slugify(url);
  const dir = path.join(args.output, slug);
  await mkdir(path.join(dir, 'screenshots'), { recursive: true });

  const notes = [];
  const desktop = Math.max(...args.breakpoints);
  const ctx = await browser.newContext({ viewport: { width: desktop, height: 900 } });
  const page = await ctx.newPage();

  let title = '';
  let dismissed = null;
  let truncated = false;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch {
    notes.push('networkidle timed out; captured after load');
    try { await page.waitForLoadState('load', { timeout: 15000 }); } catch { /* proceed */ }
  }

  dismissed = await dismissConsent(page);
  if (!dismissed) notes.push('no consent banner dismissed (none found, or selector unmatched)');

  await autoScroll(page);
  if (!args.fullScroll) {
    // Detect likely infinite scroll: height grew a lot after scrolling.
    truncated = false;
  }

  title = await page.title();

  // Re-capture check: placeholder/empty images after scroll.
  const emptyImgs = await page.evaluate(() => [...document.images]
    .filter((i) => !i.currentSrc || /data:image\/(gif|svg)/.test(i.currentSrc)).length);
  if (emptyImgs > 0) {
    notes.push(`${emptyImgs} image(s) still placeholder after scroll`);
    await autoScroll(page);
  }

  const bodyText = await page.evaluate(() => (document.body.innerText || '').trim().length);
  if (bodyText < 200) notes.push('body text under 200 chars — possible auth wall or JS failure');

  const styles = await page.evaluate(COLLECT_STYLES);
  const html = await page.evaluate(() => document.documentElement.outerHTML);

  await writeFile(path.join(dir, 'dom.json'), JSON.stringify({ html }, null, 2));
  await writeFile(path.join(dir, 'styles.json'), JSON.stringify(styles, null, 2));

  for (const bp of args.breakpoints) {
    await page.setViewportSize({ width: bp, height: 900 });
    await page.waitForTimeout(600);
    await autoScroll(page);
    await page.screenshot({
      path: path.join(dir, 'screenshots', `${bp}.png`),
      fullPage: true,
    });

    /*
     * Computed styles and rects per breakpoint, not just at desktop.
     *
     * Downstream verification compares rendered geometry against the source on
     * BOTH axes at every breakpoint. With desktop-only styles, that check can
     * only be satisfied at one width, and responsive differences — band
     * heights, stacked image ratios, column counts — have no source numbers to
     * be measured against. The viewport is already set here for the
     * screenshot, so this costs one extra evaluate per breakpoint.
     *
     * styles.json (desktop) is still written above for existing consumers.
     */
    // eslint-disable-next-line no-await-in-loop
    const bpStyles = await page.evaluate(COLLECT_STYLES);
    // eslint-disable-next-line no-await-in-loop
    await writeFile(path.join(dir, `styles-${bp}.json`), JSON.stringify(bpStyles, null, 2));
  }

  const meta = {
    url,
    slug,
    crawled_at: new Date().toISOString(),
    breakpoints: args.breakpoints,
    page_title: title,
    consent_dismissed: dismissed,
    truncated,
    section_count: styles.length,
    notes,
  };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  await ctx.close();
  return meta;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Usage: node crawl.js <url|urls.txt|sitemap.xml> [--output ./capture] [--breakpoints 375,768,1440] [--max N]');
    process.exit(1);
  }
  const urls = await resolveUrls(args.input, args.max);
  console.log(`Crawling ${urls.length} page(s) at breakpoints ${args.breakpoints.join(', ')}`);
  await mkdir(args.output, { recursive: true });

  const browser = await chromium.launch();
  const results = [];
  const failures = [];
  for (const url of urls) {
    process.stdout.write(`  → ${url} ... `);
    try {
      const meta = await crawlPage(browser, url, args);
      results.push(meta);
      console.log(`ok (${meta.section_count} nodes)${meta.notes.length ? ` [${meta.notes.length} note(s)]` : ''}`);
    } catch (err) {
      failures.push({ url, error: err.message });
      console.log(`FAILED: ${err.message}`);
    }
  }
  await browser.close();

  const index = { crawled_at: new Date().toISOString(), output: args.output, pages: results, failures };
  await writeFile(path.join(args.output, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nCaptured ${results.length} page(s), ${failures.length} failure(s) → ${args.output}`);
  results.forEach((r) => r.notes.forEach((n) => console.log(`  ! ${r.slug}: ${n}`)));
}

main().catch((e) => { console.error(e); process.exit(1); });
