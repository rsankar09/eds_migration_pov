#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax, no-continue,
   no-bitwise, no-restricted-globals, import/no-extraneous-dependencies, max-len */
// Airbnb rules relaxed deliberately: this is a Node tooling script, not block
// code. Sequential awaits are required (each page must finish before the next),
// bitwise ops implement the structure hash, and `location` is referenced inside
// functions that run in the browser, not in Node.

/**
 * Site-agnostic capture engine for EDS migrations.
 *
 * Produces a capture bundle per page: DOM (with stable node ids), computed
 * styles, the source CSS that actually matches those nodes, an interaction
 * probe of the page's JS behaviour, an asset manifest, raw style histograms
 * and multi-breakpoint screenshots.
 *
 * Nothing in here is specific to any site. Every heuristic is driven by
 * standard HTML/ARIA/CSS signals, never by a hardcoded class name from one
 * particular CMS.
 *
 * Usage:
 *   node capture.mjs --url https://example.com [--url ...] --out capture
 *   node capture.mjs --sitemap https://example.com/sitemap.xml --max-pages 8
 *   node capture.mjs --urls ./urls.txt --breakpoints 375,768,1440
 *
 * Options:
 *   --url <u>            page to capture (repeatable)
 *   --urls <file>        newline-delimited list of URLs
 *   --sitemap <u>        sitemap.xml to expand
 *   --out <dir>          output root (default: capture)
 *   --slug <name>        force the folder name (single-URL runs only)
 *   --breakpoints <csv>  viewport widths (default: 375,768,1440)
 *   --max-pages <n>      cap after sitemap expansion (default: 10)
 *   --timeout <ms>       navigation timeout (default: 45000)
 *   --storage <file>     Playwright storageState JSON, for authed pages
 *   --no-interact        skip the behaviour probe
 *   --max-nodes <n>      cap on styled nodes (default: 2500)
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// --------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const opts = {
    urls: [],
    out: 'capture',
    breakpoints: [375, 768, 1440],
    maxPages: 10,
    timeout: 45000,
    interact: true,
    maxNodes: 2500,
    slug: null,
    sitemap: null,
    urlsFile: null,
    storage: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      i += 1;
      return argv[i];
    };
    switch (a) {
      case '--url': opts.urls.push(next()); break;
      case '--urls': opts.urlsFile = next(); break;
      case '--sitemap': opts.sitemap = next(); break;
      case '--out': opts.out = next(); break;
      case '--slug': opts.slug = next(); break;
      case '--breakpoints': opts.breakpoints = next().split(',').map((n) => parseInt(n, 10)); break;
      case '--max-pages': opts.maxPages = parseInt(next(), 10); break;
      case '--timeout': opts.timeout = parseInt(next(), 10); break;
      case '--storage': opts.storage = next(); break;
      case '--max-nodes': opts.maxNodes = parseInt(next(), 10); break;
      case '--no-interact': opts.interact = false; break;
      default:
        if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
        opts.urls.push(a);
    }
  }
  return opts;
}

async function resolveUrls(opts) {
  const urls = [...opts.urls];
  if (opts.urlsFile) {
    const txt = await readFile(opts.urlsFile, 'utf-8');
    urls.push(...txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
  }
  if (opts.sitemap) {
    const xml = await (await fetch(opts.sitemap)).text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    urls.push(...locs);
  }
  const seen = new Set();
  return urls
    .map((u) => {
      try {
        const p = new URL(u);
        [...p.searchParams.keys()]
          .filter((k) => /^(utm_|gclid|fbclid|mc_|_ga)/.test(k))
          .forEach((k) => p.searchParams.delete(k));
        p.hash = '';
        return p.toString();
      } catch { return null; }
    })
    .filter((u) => u && !seen.has(u) && seen.add(u))
    .slice(0, opts.maxPages);
}

function slugify(url) {
  const u = new URL(url);
  const p = u.pathname.replace(/\/index\.\w+$/, '/').replace(/^\/|\/$/g, '');
  return p ? p.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'home';
}

// ------------------------------------------------------------- in-page code
// These run inside the browser. Kept as plain functions passed to evaluate()
// so they stay lint-readable here rather than living in template strings.

const STYLE_PROPS = [
  'display', 'position', 'color', 'background-color', 'background-image',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-transform', 'text-align', 'text-decoration-line',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-top-style', 'border-top-color',
  'border-bottom-width', 'border-bottom-color', 'border-radius',
  'box-shadow', 'opacity', 'overflow-x', 'overflow-y', 'z-index',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
  'grid-template-columns', 'grid-template-rows', 'grid-auto-flow',
  'max-width', 'width', 'height', 'aspect-ratio', 'object-fit',
  'transition-property', 'transition-duration', 'transform', 'animation-name',
];

/**
 * Consent banners, chat widgets and tag-manager chrome are not page content.
 * Dismissing a banner leaves its markup behind, where it otherwise pollutes
 * the style walk, the asset manifest and component detection. Mark the whole
 * subtree once, up front, so every later pass can ignore it.
 */
function markThirdParty() {
  const PATTERN = /(onetrust|ot-sdk|optanon|cookielaw|cookie[-_]?(consent|banner|notice)|truste|osano|didomi|usercentrics|quantcast|drift|intercom|zendesk|livechat|hubspot|olark|tawk|freshchat|recaptcha|google-tag|gtm-)/i;
  const found = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.hasAttribute('data-eds-third-party') || el.closest('[data-eds-third-party]')) return;
    const id = el.id || '';
    const cls = typeof el.className === 'string' ? el.className : '';
    if (!PATTERN.test(id) && !PATTERN.test(cls)) return;
    // never swallow real page content that merely sits inside a wrapper
    if (el.querySelector('main, [role="main"], header, footer')) return;
    el.setAttribute('data-eds-third-party', '');
    found.push({ tag: el.tagName.toLowerCase(), id: id || null, classes: cls.trim().slice(0, 120) });
  });
  return found;
}

/** Tag every candidate element with a stable id so styles/CSS/DOM can be joined. */
function tagNodes(maxNodes) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'BR']);
  const all = [...document.querySelectorAll('body *')];
  let n = 0;
  all.forEach((el) => {
    if (n >= maxNodes || SKIP.has(el.tagName)) return;
    if (el.closest('[data-eds-third-party]')) return;
    const r = el.getBoundingClientRect();
    const semantic = /^(HEADER|FOOTER|NAV|MAIN|SECTION|ARTICLE|ASIDE|FORM|TABLE|UL|OL|H1|H2|H3|H4|H5|H6|IMG|PICTURE|VIDEO|BUTTON|A|DETAILS)$/.test(el.tagName);
    if (r.width === 0 && r.height === 0 && !semantic) return;
    n += 1;
    el.setAttribute('data-eds-id', `n${n}`);
  });
  return n;
}

/** Walk tagged nodes and record computed style + geometry + a text preview. */
function collectStyles(props) {
  const out = [];
  document.querySelectorAll('[data-eds-id]').forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const computed = {};
    props.forEach((p) => {
      const v = cs.getPropertyValue(p);
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        computed[p] = v;
      }
    });
    const parentPath = [];
    let cur = el;
    while (cur && cur !== document.body && parentPath.length < 12) {
      const cls = (cur.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)
        .join('.');
      parentPath.unshift(cur.tagName.toLowerCase() + (cls ? `.${cls}` : ''));
      cur = cur.parentElement;
    }
    out.push({
      node_id: el.getAttribute('data-eds-id'),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.getAttribute('class') || '',
      role: el.getAttribute('role') || null,
      selector_path: parentPath.join(' > '),
      depth: parentPath.length,
      child_count: el.children.length,
      text_preview: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
      // text this element owns directly, as opposed to text inherited from
      // descendants — the only reliable way to attribute a colour or size to
      // the element that actually paints it
      own_text: [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 120),
      rect: {
        x: Math.round(r.x + window.scrollX),
        y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      computed,
    });
  });
  return out;
}

/**
 * Harvest the page's real CSS and keep only rules that match captured nodes.
 * Media conditions, state pseudo-classes, keyframes and font-faces are all
 * preserved — those are exactly what a block's CSS needs to reproduce.
 */
function collectCss() {
  const rules = [];
  const keyframes = [];
  const fontFaces = [];
  const blocked = [];

  const matchNodes = (selectorText) => {
    const tryQuery = (sel) => {
      try {
        return [...document.querySelectorAll(sel)]
          .map((el) => el.getAttribute('data-eds-id'))
          .filter(Boolean);
      } catch { return null; }
    };
    let ids = tryQuery(selectorText);
    if (ids === null || ids.length === 0) {
      // retry without state pseudo-classes so :hover/:focus rules still bind
      const base = selectorText
        .replace(/:{1,2}(hover|focus|focus-visible|focus-within|active|visited|target|checked|before|after|first-line|placeholder|marker|backdrop)\b/gi, '')
        .trim();
      if (base && base !== selectorText) ids = tryQuery(base);
    }
    return ids || [];
  };

  const walk = (list, media, origin) => {
    [...list].forEach((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) {
        const nodes = [...new Set(rule.selectorText.split(',').flatMap((s) => matchNodes(s.trim())))];
        if (nodes.length) {
          rules.push({
            selector: rule.selectorText, media, origin, nodes, css: rule.cssText,
          });
        }
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        walk(rule.cssRules, [media, rule.conditionText].filter(Boolean).join(' and '), origin);
      } else if (rule.type === CSSRule.SUPPORTS_RULE) {
        walk(rule.cssRules, media, origin);
      } else if (rule.type === CSSRule.KEYFRAMES_RULE) {
        keyframes.push({ name: rule.name, css: rule.cssText, origin });
      } else if (rule.type === CSSRule.FONT_FACE_RULE) {
        fontFaces.push({ css: rule.cssText, origin });
      }
    });
  };

  [...document.styleSheets].forEach((sheet) => {
    const origin = sheet.href || 'inline';
    try {
      walk(sheet.cssRules, null, origin);
    } catch {
      blocked.push(sheet.href);
    }
  });

  // custom properties declared on :root / html / body — the site's own tokens
  const rootVars = {};
  [document.documentElement, document.body].forEach((el) => {
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i += 1) {
      const p = cs[i];
      if (p.startsWith('--')) rootVars[p] = cs.getPropertyValue(p).trim();
    }
  });

  return {
    rules, keyframes, fontFaces, blocked, rootVars,
  };
}

/** Everything the migration will need to re-upload into the DAM. */
function collectAssets() {
  const abs = (u) => { try { return new URL(u, location.href).toString(); } catch { return null; } };
  const items = [];
  const push = (url, role, extra = {}) => { if (url) items.push({ url, role, ...extra }); };
  const own = (sel) => [...document.querySelectorAll(sel)].filter((el) => !el.closest('[data-eds-third-party]'));

  own('img').forEach((img) => push(abs(img.currentSrc || img.src), 'image', {
    node_id: img.getAttribute('data-eds-id'),
    alt: img.getAttribute('alt'),
    width: img.naturalWidth,
    height: img.naturalHeight,
    loading: img.getAttribute('loading'),
    srcset: img.getAttribute('srcset') || null,
  }));
  own('source[srcset]').forEach((s) => s.getAttribute('srcset').split(',')
    .forEach((c) => push(abs(c.trim().split(/\s+/)[0]), 'image-source', { media: s.getAttribute('media') })));
  own('video, video source').forEach((v) => push(abs(v.getAttribute('src')), 'video'));
  document.querySelectorAll('[data-eds-id]').forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      .forEach((m) => push(abs(m[1]), 'background', { node_id: el.getAttribute('data-eds-id') }));
  });
  own('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/\.(pdf|docx?|xlsx?|pptx?|zip|csv)(\?|$)/i.test(href)) push(abs(href), 'document', { text: a.textContent.trim().slice(0, 80) });
  });
  document.querySelectorAll('link[rel*="icon"]').forEach((l) => push(abs(l.getAttribute('href')), 'icon'));

  const seen = new Set();
  return items.filter((i) => i.url && !seen.has(i.url + i.role) && seen.add(i.url + i.role));
}

/** Frequency histograms of the values actually used on the page. */
function collectTokens() {
  const bump = (map, k) => { if (k) map.set(k, (map.get(k) || 0) + 1); };
  const maps = {
    fontFamilies: new Map(),
    typeScale: new Map(),
    colors: new Map(),
    backgrounds: new Map(),
    borderColors: new Map(),
    radii: new Map(),
    shadows: new Map(),
    spacing: new Map(),
    gaps: new Map(),
    containerWidths: new Map(),
  };
  document.querySelectorAll('[data-eds-id]').forEach((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      bump(maps.fontFamilies, cs.fontFamily.toLowerCase());
      bump(maps.typeScale, `${cs.fontSize}/${cs.fontWeight}/${cs.lineHeight}`);
      bump(maps.colors, cs.color);
    }
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.width * r.height > 400) bump(maps.backgrounds, cs.backgroundColor);
    if (parseFloat(cs.borderTopWidth) > 0) bump(maps.borderColors, cs.borderTopColor);
    if (cs.borderRadius !== '0px') bump(maps.radii, cs.borderRadius);
    if (cs.boxShadow !== 'none') bump(maps.shadows, cs.boxShadow);
    if (cs.gap && cs.gap !== 'normal') bump(maps.gaps, cs.gap);
    ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'].forEach((p) => {
      const v = cs[p];
      if (v && v !== '0px') bump(maps.spacing, v);
    });
    if (cs.maxWidth !== 'none') bump(maps.containerWidths, cs.maxWidth);
  });
  const top = (m, n = 20) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([value, count]) => ({ value, count }));
  return Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, top(m)]));
}

/**
 * Probe the page's interactive behaviour without reading its source JS.
 * Hover and click each candidate control, diff the DOM, and record what
 * changed — that delta is the behaviour contract a block's decorate() must
 * reproduce.
 */
async function probeBehaviour() {
  const sleep = (ms) => new Promise((res) => { setTimeout(res, ms); });
  // Structure- and ARIA-driven, never keyed to one CMS's markup. `li:has(> ul)`
  // is deliberately not scoped to <nav> — plenty of sites build menus out of a
  // bare <ul> with no nav element, and a submenu is a submenu either way.
  const CANDIDATE = [
    '[aria-expanded]', '[aria-controls]', '[role="tab"]', '[role="button"]',
    'details > summary', 'summary', 'button', '[data-toggle]', '[data-target]',
    'li:has(> ul)', 'li:has(> div:not(:empty))', 'li:has(> nav)',
    '[class*="accordion" i]', '[class*="toggle" i]', '[class*="dropdown" i]',
    '[class*="tab" i]', '[class*="menu-item" i]', '[class*="hamburger" i]',
    '[class*="expand" i]', '[class*="collaps" i]', '[class*="submenu" i]',
    '[class*="popup" i]', '[class*="modal" i]', '[class*="btn" i]',
    '[class*="trigger" i]', '[class*="overlay" i]', '[class*="drawer" i]',
    'a[href^="#"]',
  ].join(',');
  const CAROUSEL = '[class*="carousel" i],[class*="slider" i],[class*="swiper" i],[class*="slick" i],[role="region"][aria-roledescription="carousel"]';

  const stateOf = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return [
      el.getAttribute('class') || '',
      el.getAttribute('aria-expanded') || '',
      el.getAttribute('aria-selected') || '',
      el.getAttribute('aria-hidden') || '',
      el.hasAttribute('hidden') ? 'hidden' : '',
      cs.display, cs.visibility, cs.opacity, cs.maxHeight, cs.transform, cs.height,
    ].join('|');
  };
  const targetsOf = (el) => {
    const t = [];
    const ctrl = el.getAttribute('aria-controls');
    if (ctrl) ctrl.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) t.push(n); });
    if (el.nextElementSibling) t.push(el.nextElementSibling);
    const inner = el.querySelector(':scope > ul, :scope > div, :scope > nav');
    if (inner) t.push(inner);
    if (el.parentElement) {
      const sib = el.parentElement.querySelector(':scope > ul, :scope > div[class]');
      if (sib && sib !== el) t.push(sib);
    }
    return [...new Set(t)].slice(0, 3);
  };
  const snap = (el) => ({ self: stateOf(el), targets: targetsOf(el).map(stateOf) });
  const changed = (a, b) => a.self !== b.self || a.targets.join('~') !== b.targets.join('~');

  // A modal, off-canvas panel or tab pane usually lives nowhere near its
  // trigger, so a local target diff never sees it. Diff which nodes are
  // visible across the whole document instead.
  const visibleSet = () => new Set([...document.querySelectorAll('[data-eds-id]')]
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => el.getAttribute('data-eds-id')));
  const diffVisible = (before, after) => ({
    appeared: [...after].filter((id) => !before.has(id)).slice(0, 20),
    disappeared: [...before].filter((id) => !after.has(id)).slice(0, 20),
  });

  // Probing means clicking things, and plenty of toggles are also links.
  // Swallow the default action so a nav click can't destroy the execution
  // context mid-capture; site handlers still run, only navigation is stopped.
  const suppress = (e) => e.preventDefault();
  document.addEventListener('click', suppress);
  document.addEventListener('submit', suppress);

  const results = [];
  const candidates = [...document.querySelectorAll(CANDIDATE)]
    .filter((el) => el.getAttribute('data-eds-id'))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .slice(0, 45);

  for (const el of candidates) {
    const entry = {
      node_id: el.getAttribute('data-eds-id'),
      tag: el.tagName.toLowerCase(),
      label: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48),
      target_ids: targetsOf(el).map((t) => t.getAttribute('data-eds-id')).filter(Boolean),
      hover: null,
      click: null,
    };
    const before = snap(el);

    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(260);
    const afterHover = snap(el);
    if (changed(before, afterHover)) entry.hover = { before: before.targets, after: afterHover.targets };
    el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await sleep(120);

    const preClick = snap(el);
    const preVisible = visibleSet();
    try { el.click(); } catch { /* ignore */ }
    await sleep(320);
    const afterClick = snap(el);
    const remote = diffVisible(preVisible, visibleSet());
    const movedRemotely = remote.appeared.length > 0 || remote.disappeared.length > 0;
    if (changed(preClick, afterClick) || movedRemotely) {
      entry.click = {
        before: preClick, after: afterClick, remote, restored: false,
      };
      try { el.click(); } catch { /* ignore */ }
      await sleep(240);
      const back = diffVisible(preVisible, visibleSet());
      entry.click.restored = !changed(preClick, snap(el))
        && back.appeared.length === 0 && back.disappeared.length === 0;
      // an unrestored modal hides everything behind it; reload rather than
      // probing the rest of the page through an overlay
      if (!entry.click.restored && movedRemotely) {
        results.push(entry);
        entry.click.note = 'left the page in a changed state; probe stopped here';
        break;
      }
    }
    if (entry.hover || entry.click) results.push(entry);
  }

  // autoplay / rotation detection
  const rotators = [];
  for (const el of [...document.querySelectorAll(CAROUSEL)].slice(0, 6)) {
    const read = () => {
      const active = el.querySelector('[aria-current],[class*="active" i],[class*="current" i],[class*="selected" i]');
      const track = el.querySelector('[class*="track" i],[class*="wrapper" i],[class*="inner" i]') || el;
      return `${active ? [...(active.parentElement?.children || [])].indexOf(active) : -1}|${getComputedStyle(track).transform}|${track.scrollLeft}`;
    };
    const samples = [read()];
    for (let i = 0; i < 4; i += 1) { await sleep(1600); samples.push(read()); }
    const distinct = [...new Set(samples)];
    rotators.push({
      node_id: el.getAttribute('data-eds-id'),
      slide_count: el.querySelectorAll('[class*="slide" i],[role="group"],li').length,
      autoplay: distinct.length > 1,
      approx_interval_ms: distinct.length > 1 ? Math.round(6400 / (distinct.length - 1)) : null,
      has_prev_next: !!el.querySelector('[class*="prev" i],[class*="next" i],[aria-label*="previous" i],[aria-label*="next" i]'),
      has_dots: !!el.querySelector('[class*="dot" i],[class*="indicator" i],[class*="pagination" i]'),
    });
  }

  document.removeEventListener('click', suppress);
  document.removeEventListener('submit', suppress);
  return { interactions: results, rotators };
}

/** Open everything that can be opened, so hidden markup lands in the DOM dump. */
async function expandAll() {
  const sleep = (ms) => new Promise((res) => { setTimeout(res, ms); });
  const suppress = (e) => e.preventDefault();
  document.addEventListener('click', suppress);
  const opened = [];
  const toggles = [...document.querySelectorAll('[aria-expanded="false"], details:not([open]) > summary')];
  for (const el of toggles.slice(0, 60)) {
    try {
      el.click();
      opened.push(el.getAttribute('data-eds-id'));
      await sleep(60);
    } catch { /* ignore */ }
  }
  // hover-only menus: force them visible for serialization
  document.querySelectorAll('nav li').forEach((li) => {
    li.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    li.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  });
  await sleep(400);
  document.removeEventListener('click', suppress);
  return opened.filter(Boolean);
}

function dismissConsent() {
  const SELECTORS = [
    '#onetrust-accept-btn-handler', '#truste-consent-button', '.cc-allow',
    '[id*="accept-all" i]', '[class*="accept-all" i]',
    '[aria-label*="accept" i]', '[data-testid*="accept" i]',
  ];
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.getBoundingClientRect().width > 0) { el.click(); return sel; }
  }
  const byText = [...document.querySelectorAll('button, a[role="button"]')]
    .find((b) => /^(accept|agree|allow|got it|i agree)/i.test(b.textContent.trim()));
  if (byText) { byText.click(); return 'text-match'; }
  return null;
}

/** Structural fingerprint, used to cluster pages into templates. */
function structureHash() {
  const skel = [...document.querySelectorAll('body *')]
    .slice(0, 400)
    .map((el) => el.tagName + (el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/)[0]}` : ''))
    .join('>');
  let h = 0;
  for (let i = 0; i < skel.length; i += 1) { h = ((h << 5) - h + skel.charCodeAt(i)) | 0; }
  return `s${(h >>> 0).toString(16)}`;
}

// ------------------------------------------------------------------ driver

async function autoScroll(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(120);
    }
    window.scrollTo(0, 0);
    await sleep(200);
  });
}

/**
 * Not all interactivity is JavaScript. A CSS-only dropdown never fires an
 * event the probe can see, so derive it from the matched rules instead:
 * a `:hover`/`:focus-within` selector that flips a visibility property is a
 * behaviour the block has to reproduce.
 */
function deriveCssBehaviour(css) {
  const VISIBILITY = /(^|;|\{)\s*(display|visibility|opacity|max-height|transform|left|top|clip-path)\s*:/i;
  return css.rules
    .filter((r) => /:(hover|focus|focus-within|focus-visible|checked|target)\b/i.test(r.selector))
    .filter((r) => VISIBILITY.test(r.css))
    .slice(0, 60)
    .map((r) => ({
      selector: r.selector,
      media: r.media,
      nodes: r.nodes.slice(0, 8),
      css: r.css.length > 300 ? `${r.css.slice(0, 300)}…` : r.css,
    }));
}

function formatMatchedCss(css) {
  const groups = new Map();
  css.rules.forEach((r) => {
    const key = r.media || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });
  const chunks = [];
  if (Object.keys(css.rootVars).length) {
    chunks.push(`/* source custom properties */\n:root {\n${Object.entries(css.rootVars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`);
  }
  css.fontFaces.forEach((f) => chunks.push(f.css));
  [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([media, rules]) => {
    const body = rules.map((r) => `/* ${r.nodes.slice(0, 8).join(' ')} */\n${r.css}`).join('\n');
    chunks.push(media ? `@media ${media} {\n${body.replace(/^/gm, '  ')}\n}` : body);
  });
  css.keyframes.forEach((k) => chunks.push(k.css));
  return chunks.join('\n\n');
}

async function capturePage(browser, url, opts) {
  const slug = opts.slug || slugify(url);
  const dir = path.join(opts.out, slug);
  await mkdir(path.join(dir, 'screenshots'), { recursive: true });
  await mkdir(path.join(dir, 'css'), { recursive: true });

  const widest = Math.max(...opts.breakpoints);
  const context = await browser.newContext({
    viewport: { width: widest, height: 900 },
    deviceScaleFactor: 1,
    storageState: opts.storage || undefined,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 eds-migration-crawler',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)));

  const report = {
    url, slug, ok: true, notes: [],
  };
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeout });
    report.status = resp ? resp.status() : null;
  } catch (e) {
    report.notes.push(`navigation: ${e.message.split('\n')[0]}`);
    try { await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); } catch { /* ignore */ }
  }

  const consent = await page.evaluate(dismissConsent);
  if (consent) report.notes.push(`consent dismissed via ${consent}`);
  await page.waitForTimeout(500);
  await autoScroll(page);

  // screenshots, narrow to wide, then settle back at the widest
  for (const bp of [...opts.breakpoints].sort((a, b) => a - b)) {
    await page.setViewportSize({ width: bp, height: 900 });
    await page.waitForTimeout(450);
    await autoScroll(page);
    await page.screenshot({ path: path.join(dir, 'screenshots', `${bp}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: widest, height: 900 });
  await page.waitForTimeout(400);

  const thirdParty = await page.evaluate(markThirdParty);
  if (thirdParty.length) report.notes.push(`${thirdParty.length} third-party subtree(s) excluded`);
  const nodeCount = await page.evaluate(tagNodes, opts.maxNodes);
  const styles = await page.evaluate(collectStyles, STYLE_PROPS);
  const css = await page.evaluate(collectCss);
  const assets = await page.evaluate(collectAssets);
  const tokens = await page.evaluate(collectTokens);
  const hash = await page.evaluate(structureHash);
  const domHtml = await page.content();

  let behaviour = { interactions: [], rotators: [] };
  let expandedHtml = null;
  let opened = [];
  if (opts.interact) {
    // The probe is the only stage that mutates the page, so it is also the
    // only one that can fail late. Everything above is already collected —
    // degrade to a capture without behaviour rather than losing the page.
    try {
      behaviour = await page.evaluate(probeBehaviour);
      opened = await page.evaluate(expandAll);
      expandedHtml = await page.content();
    } catch (e) {
      report.notes.push(`behaviour probe aborted: ${e.message.split('\n')[0]}`);
    }
  }

  const cssBehaviour = deriveCssBehaviour(css);

  const meta = {
    url,
    slug,
    page_title: await page.title(),
    crawled_at: new Date().toISOString(),
    breakpoints: opts.breakpoints,
    status: report.status ?? null,
    structure_hash: hash,
    node_count: nodeCount,
    counts: {
      styled_nodes: styles.length,
      css_rules_matched: css.rules.length,
      keyframes: css.keyframes.length,
      font_faces: css.fontFaces.length,
      assets: assets.length,
      interactions: behaviour.interactions.length,
      rotators: behaviour.rotators.length,
      css_behaviours: cssBehaviour.length,
      expanded_toggles: opened.length,
      third_party_excluded: thirdParty.length,
    },
    blocked_stylesheets: css.blocked,
    console_errors: consoleErrors.slice(0, 20),
    truncated: false,
    notes: report.notes,
  };

  const w = (f, data) => writeFile(path.join(dir, f), typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`);
  await Promise.all([
    w('meta.json', meta),
    w('dom.html', domHtml),
    w('styles.json', styles),
    w('css/index.json', {
      rules: css.rules, keyframes: css.keyframes, fontFaces: css.fontFaces, rootVars: css.rootVars,
    }),
    w('css/matched.css', formatMatchedCss(css)),
    w('assets.json', assets),
    w('tokens-raw.json', tokens),
    w('behavior.json', { ...behaviour, css_hover: cssBehaviour, expanded_toggles: opened }),
    w('third-party.json', thirdParty),
    expandedHtml ? w('dom-expanded.html', expandedHtml) : Promise.resolve(),
  ]);

  await context.close();
  report.meta = meta;
  console.log(`  ✓ ${slug}  ${styles.length} nodes · ${css.rules.length} css rules · ${assets.length} assets · ${behaviour.interactions.length} js + ${cssBehaviour.length} css behaviours${thirdParty.length ? ` · ${thirdParty.length} 3p excluded` : ''}${consoleErrors.length ? ` · ${consoleErrors.length} console errors` : ''}`);
  return report;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const urls = await resolveUrls(opts);
  if (!urls.length) {
    console.error('no URLs. pass --url, --urls <file> or --sitemap <url>');
    process.exit(1);
  }
  console.log(`capturing ${urls.length} page(s) at ${opts.breakpoints.join('/')} → ${opts.out}/`);
  const browser = await chromium.launch();
  const reports = [];
  for (const url of urls) {
    try {
      reports.push(await capturePage(browser, url, opts));
    } catch (e) {
      console.log(`  ✗ ${url} — ${e.message.split('\n')[0]}`);
      reports.push({ url, ok: false, error: e.message.split('\n')[0] });
    }
  }
  await browser.close();

  const templates = {};
  reports.filter((r) => r.meta).forEach((r) => {
    const k = r.meta.structure_hash;
    templates[k] = templates[k] || [];
    templates[k].push(r.slug);
  });
  await writeFile(path.join(opts.out, 'index.json'), `${JSON.stringify({
    crawled_at: new Date().toISOString(),
    breakpoints: opts.breakpoints,
    pages: reports.map((r) => ({
      slug: r.slug, url: r.url, ok: r.ok !== false, notes: r.notes || [],
    })),
    templates,
  }, null, 2)}\n`);

  const groups = Object.entries(templates);
  console.log(`\n${reports.filter((r) => r.ok !== false).length}/${urls.length} captured · ${groups.length} template group(s)`);
  groups.forEach(([h, slugs]) => console.log(`  ${h}: ${slugs.join(', ')}`));
  console.log(`bundle written to ${opts.out}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
