#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-syntax, no-continue, no-bitwise, max-len */
// Airbnb rules relaxed deliberately: Node tooling script, not block code.

/**
 * Turn a capture bundle into an EDS design system.
 *
 * Reads every page in the bundle (tokens-raw.json, styles.json, css/index.json)
 * and derives one site-wide token set: colour roles, font stacks, a type scale,
 * a spacing scale, container width and the site's real breakpoints — then emits
 * a `:root` block using the variable names the EDS boilerplate already uses, so
 * it can be dropped into styles/styles.css.
 *
 * Roles are derived from element context (what an <a> is coloured, what a
 * <h1> is sized) rather than raw frequency alone, so the output is meaningful
 * on any site regardless of its CSS conventions.
 *
 * Usage:
 *   node tokens.mjs [--capture capture] [--out capture] [--top 6]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const o = { capture: 'capture', out: null, top: 6 };
  for (let i = 0; i < argv.length; i += 1) {
    const next = () => {
      i += 1;
      return argv[i];
    };
    if (argv[i] === '--capture') o.capture = next();
    else if (argv[i] === '--out') o.out = next();
    else if (argv[i] === '--top') o.top = parseInt(next(), 10);
  }
  o.out = o.out || o.capture;
  return o;
}

// ------------------------------------------------------------------ colour

function toHex(css) {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  if (!m) return /^#/.test(css) ? css.toLowerCase() : null;
  const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
  const [r, g, b] = parts;
  const a = parts.length > 3 ? parts[3] : 1;
  if (!Number.isFinite(r) || a === 0) return null;
  if (a < 1) return `rgb(${r} ${g} ${b} / ${a})`;
  const hex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function rgbOf(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const distance = (a, b) => {
  const x = rgbOf(a); const y = rgbOf(b);
  if (!x || !y) return Infinity;
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
};

const luminance = (hex) => {
  const c = rgbOf(hex);
  if (!c) return 0.5;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Merge colours that are visually the same, keeping the heaviest variant. */
function clusterColours(weighted, threshold = 14) {
  const sorted = [...weighted.entries()].sort((a, b) => b[1] - a[1]);
  const out = [];
  sorted.forEach(([hex, weight]) => {
    const near = out.find((o) => distance(o.value, hex) < threshold);
    if (near) { near.weight += weight; near.merged.push(hex); } else out.push({ value: hex, weight, merged: [] });
  });
  return out;
}

// ------------------------------------------------------------------- input

async function loadBundle(captureDir) {
  const entries = await readdir(captureDir, { withFileTypes: true });
  const pages = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(captureDir, e.name);
    const read = async (f) => {
      try { return JSON.parse(await readFile(path.join(dir, f), 'utf-8')); } catch { return null; }
    };
    /* eslint-disable no-await-in-loop */
    const meta = await read('meta.json');
    if (!meta) continue;
    pages.push({
      slug: e.name,
      meta,
      styles: (await read('styles.json')) || [],
      css: (await read('css/index.json')) || { rules: [], rootVars: {} },
      raw: (await read('tokens-raw.json')) || {},
    });
    /* eslint-enable no-await-in-loop */
  }
  return pages;
}

// ------------------------------------------------------------------ derive

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const px = (v) => (/^-?[\d.]+px$/.test(v || '') ? parseFloat(v) : null);

/**
 * Length of the text a node paints itself. Bundles captured before own_text
 * existed fall back to the subtree preview, which over-counts ancestors.
 */
function ownTextLen(n) {
  if (typeof n.own_text === 'string') return n.own_text.length;
  return n.child_count === 0 ? (n.text_preview || '').length : 0;
}

/**
 * Weight for role derivation. Square-rooted on purpose: a single long block
 * of fine print would otherwise outrank three ordinary paragraphs, and the
 * body role belongs to the size and colour used in the most *places*, not
 * the one that happens to carry the most characters.
 */
const textWeight = (n) => Math.sqrt(ownTextLen(n));

function deriveColours(pages) {
  const text = new Map();
  const link = new Map();
  const bg = new Map();
  const bump = (m, k, w) => { if (k) m.set(k, (m.get(k) || 0) + w); };

  pages.forEach((p) => p.styles.forEach((n) => {
    const c = toHex(n.computed.color);
    // attribute colour to the element that actually paints the text
    const chars = textWeight(n);
    if (chars && c) {
      if (n.tag === 'a') bump(link, c, chars);
      else bump(text, c, chars);
    }
    const b = toHex(n.computed['background-color']);
    const r = n.rect || n.bounding_rect || { w: 0, h: 0 };
    const area = (r.w * r.h) / 1000;
    if (b && area > 1) bump(bg, b, area);
  }));

  const textRank = clusterColours(text);
  const linkRank = clusterColours(link);
  const bgRank = clusterColours(bg);

  const pageBg = bgRank.find((c) => luminance(c.value) > 0.85) || bgRank[0] || { value: '#ffffff' };
  // brand surfaces: heavily used backgrounds that aren't the page background
  const brand = bgRank
    .filter((c) => distance(c.value, pageBg.value) > 30)
    .filter((c) => luminance(c.value) < 0.92)
    .slice(0, 5);

  // hover colour, read from the site's own :hover rules rather than guessed
  const hover = new Map();
  pages.forEach((p) => p.css.rules
    .filter((r) => /a[^,]*:hover/i.test(r.selector))
    .forEach((r) => {
      const m = /(?:^|[;{])\s*color\s*:\s*([^;}]+)/i.exec(r.css);
      const c = m && toHex(m[1].trim());
      if (c) bump(hover, c, 1);
    }));
  const hoverRank = clusterColours(hover);

  // A near-tie on a role token is a judgement call, not a derivation. Surface
  // it instead of silently picking the winner.
  const closeCalls = [];
  const flag = (role, rank) => {
    if (rank.length > 1 && rank[1].weight / rank[0].weight > 0.75) {
      closeCalls.push({
        role,
        chosen: rank[0].value,
        runner_up: rank[1].value,
        margin: `${Math.round((1 - rank[1].weight / rank[0].weight) * 100)}%`,
      });
    }
  };
  flag('text', textRank);
  flag('link', linkRank);

  return {
    background: pageBg.value,
    text: (textRank[0] || { value: '#000000' }).value,
    close_calls: closeCalls,
    text_alternates: textRank.slice(1, 4).map((c) => c.value),
    link: (linkRank[0] || textRank[0] || { value: '#0000ee' }).value,
    link_hover: (hoverRank[0] || {}).value || null,
    brand: brand.map((c) => c.value),
    all_backgrounds: bgRank.slice(0, 8).map((c) => c.value),
  };
}

function deriveFonts(pages) {
  const byRole = { body: new Map(), heading: new Map(), display: new Map() };
  const bump = (m, k, w = 1) => { if (k) m.set(k, (m.get(k) || 0) + w); };
  pages.forEach((p) => p.styles.forEach((n) => {
    const ff = (n.computed['font-family'] || '').toLowerCase();
    if (!ff || !ownTextLen(n)) return;
    const size = px(n.computed['font-size']) || 0;
    if (HEADINGS.includes(n.tag)) bump(byRole.heading, ff, 3);
    else if (size >= 18) bump(byRole.display, ff, 2);
    else bump(byRole.body, ff, 1);
  }));
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const body = top(byRole.body);
  const heading = top(byRole.heading) || body;
  let display = top(byRole.display);
  if (display === body || display === heading) display = null;
  return {
    body, heading, display, stacks: [...new Set([body, heading, display].filter(Boolean))],
  };
}

function deriveTypeScale(pages) {
  const perTag = new Map();
  pages.forEach((p) => p.styles.forEach((n) => {
    if (!ownTextLen(n)) return;
    const size = px(n.computed['font-size']);
    if (!size) return;
    const key = n.tag;
    if (!perTag.has(key)) perTag.set(key, new Map());
    const m = perTag.get(key);
    const sig = `${size}|${n.computed['font-weight'] || '400'}|${n.computed['line-height'] || ''}`;
    // weight by how much text is actually set at this size — one long
    // paragraph matters more than a dozen one-word labels
    m.set(sig, (m.get(sig) || 0) + textWeight(n));
  }));
  const closeCalls = [];
  const dominant = (tag) => {
    const m = perTag.get(tag);
    if (!m) return null;
    const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const [sig, count] = ranked[0];
    if (ranked.length > 1 && ranked[1][1] / count > 0.75) {
      closeCalls.push({
        role: `${tag} size`,
        chosen: `${sig.split('|')[0]}px`,
        runner_up: `${ranked[1][0].split('|')[0]}px`,
        margin: `${Math.round((1 - ranked[1][1] / count) * 100)}%`,
      });
    }
    const [size, weight, lineHeight] = sig.split('|');
    return {
      size: parseFloat(size), weight, line_height: lineHeight || null, count: Math.round(count),
    };
  };
  const headings = Object.fromEntries(HEADINGS.map((h) => [h, dominant(h)]).filter(([, v]) => v));
  const body = dominant('p') || dominant('li') || dominant('span') || dominant('div');
  const small = [...new Set(pages.flatMap((p) => p.styles
    .filter((n) => ownTextLen(n))
    .map((n) => px(n.computed['font-size']))
    .filter(Boolean)))].sort((a, b) => a - b);
  return {
    body, headings, observed_sizes: small, close_calls: closeCalls,
  };
}

function deriveSpacing(pages, top) {
  const m = new Map();
  pages.forEach((p) => (p.raw.spacing || []).forEach(({ value, count }) => {
    const v = px(value);
    if (v && v > 0 && v <= 160) m.set(v, (m.get(v) || 0) + count);
  }));
  pages.forEach((p) => (p.raw.gaps || []).forEach(({ value, count }) => {
    const v = px(value.split(' ')[0]);
    if (v) m.set(v, (m.get(v) || 0) + count);
  }));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value - b.value);
}

function deriveLayout(pages) {
  const widths = new Map();
  let gutter = null;
  let navHeight = null;
  pages.forEach((p) => p.styles.forEach((n) => {
    const mw = px(n.computed['max-width']);
    if (mw && mw >= 480) {
      widths.set(mw, (widths.get(mw) || 0) + 1);
      if (gutter === null) gutter = px(n.computed['padding-left']);
    }
    const r = n.rect || n.bounding_rect;
    if (n.tag === 'header' && n.depth <= 3 && r && r.h > 0) navHeight = Math.max(navHeight || 0, r.h);
  }));
  const container = [...widths.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { container_max_width: container, gutter, nav_height: navHeight };
}

function deriveBreakpoints(pages) {
  const m = new Map();
  pages.forEach((p) => p.css.rules.forEach((r) => {
    if (!r.media) return;
    // both the classic form and modern range syntax:
    //   (min-width: 900px)   (width >= 900px)   (400px <= width <= 700px)
    const hits = [
      ...r.media.matchAll(/\((?:min|max)-width\s*:\s*([\d.]+)px\)/gi),
      ...r.media.matchAll(/width\s*[<>]=?\s*([\d.]+)px/gi),
      ...r.media.matchAll(/([\d.]+)px\s*[<>]=?\s*width/gi),
    ];
    hits.forEach((mm) => {
      const v = Math.round(parseFloat(mm[1]));
      m.set(v, (m.get(v) || 0) + 1);
    });
  }));
  return [...m.entries()]
    .filter(([v]) => v >= 320 && v <= 1920)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([value, rules]) => ({ value, rules }))
    .sort((a, b) => a.value - b.value);
}

// ------------------------------------------------------------------ output

function emitCss(ds) {
  const L = [];
  const push = (s = '') => L.push(s);
  push('/*');
  push(' * Design tokens derived from the captured source site.');
  push(` * Generated by eds-design-system from ${ds.source.pages.length} page(s).`);
  push(' * Role names follow the EDS boilerplate; --brand-N are unnamed source');
  push(' * colours — rename them to something meaningful before shipping.');
  push(' */');
  push();
  push(':root {');
  push('  /* colors */');
  push(`  --background-color: ${ds.colors.background};`);
  push(`  --text-color: ${ds.colors.text};`);
  if (ds.colors.text_alternates[0]) push(`  --dark-color: ${ds.colors.text_alternates[0]};`);
  if (ds.colors.text_alternates[1]) push(`  --light-color: ${ds.colors.text_alternates[1]};`);
  push(`  --link-color: ${ds.colors.link};`);
  if (ds.colors.link_hover) push(`  --link-hover-color: ${ds.colors.link_hover};`);
  if (ds.colors.brand.length) {
    push();
    push('  /* brand surfaces, in order of how much of the page they cover */');
    ds.colors.brand.forEach((c, i) => push(`  --brand-${i + 1}: ${c};`));
  }
  push();
  push('  /* fonts */');
  push(`  --body-font-family: ${ds.fonts.body};`);
  push(`  --heading-font-family: ${ds.fonts.heading};`);
  if (ds.fonts.display) push(`  --display-font-family: ${ds.fonts.display};`);
  push();
  push('  /* body sizes */');
  const bodySize = ds.type.body?.size || 16;
  push(`  --body-font-size-m: ${bodySize}px;`);
  const smaller = ds.type.observed_sizes.filter((s) => s < bodySize).reverse();
  push(`  --body-font-size-s: ${smaller[0] || Math.round(bodySize * 0.9)}px;`);
  push(`  --body-font-size-xs: ${smaller[1] || Math.round(bodySize * 0.8)}px;`);
  push();
  push('  /* heading sizes */');
  const names = ['xxl', 'xl', 'l', 'm', 's', 'xs'];
  const hs = HEADINGS.map((h) => ds.type.headings[h]?.size).filter(Boolean);
  const scale = hs.length
    ? [...new Set(hs)].sort((a, b) => b - a)
    : [32, 26, 22, 18, 16, 14];
  names.forEach((n, i) => push(`  --heading-font-size-${n}: ${scale[i] || scale[scale.length - 1]}px;`));
  if (ds.spacing.length) {
    push();
    push('  /* spacing scale */');
    ds.spacing.forEach((s, i) => push(`  --space-${i + 1}: ${s.value}px;`));
  }
  push();
  push('  /* layout */');
  if (ds.layout.container_max_width) push(`  --content-max-width: ${ds.layout.container_max_width}px;`);
  if (ds.layout.gutter) push(`  --content-gutter: ${ds.layout.gutter}px;`);
  if (ds.layout.nav_height) push(`  --nav-height: ${ds.layout.nav_height}px;`);
  push('}');
  if (ds.breakpoints.length) {
    push();
    push(`/* source breakpoints: ${ds.breakpoints.map((b) => `${b.value}px (${b.rules} rules)`).join(', ')} */`);
  }
  return `${L.join('\n')}\n`;
}

function emitMarkdown(ds) {
  const rows = (arr) => arr.map((r) => `| ${r.join(' | ')} |`).join('\n');
  const bp = ds.breakpoints.map((b) => `${b.value}px`).join(', ') || 'none found';
  return `# Design system — derived from source

Pages analysed: ${ds.source.pages.join(', ')}
Generated: ${ds.source.generated_at}

## Colour roles

| Role | Value | Basis |
|---|---|---|
${rows([
    ['background', ds.colors.background, 'largest light surface'],
    ['text', ds.colors.text, 'most text weight on leaf nodes'],
    ['link', ds.colors.link, 'dominant `<a>` colour'],
    ['link hover', ds.colors.link_hover || '—', ds.colors.link_hover ? 'from the source `a:hover` rule' : 'no hover rule found'],
    ...ds.colors.brand.map((c, i) => [`brand-${i + 1}`, c, 'background surface by page area']),
  ])}

## Type

- Body: **${ds.fonts.body}** at ${ds.type.body?.size || '?'}px${ds.type.body?.line_height ? ` / ${ds.type.body.line_height}` : ''}
- Heading: **${ds.fonts.heading}**
${ds.fonts.display ? `- Display: **${ds.fonts.display}**\n` : ''}
| Tag | Size | Weight | Line height |
|---|---|---|---|
${rows(HEADINGS.filter((h) => ds.type.headings[h]).map((h) => [h, `${ds.type.headings[h].size}px`, ds.type.headings[h].weight, ds.type.headings[h].line_height || '—']))}

Observed text sizes: ${ds.type.observed_sizes.join(', ')}px

## Layout

- Container: ${ds.layout.container_max_width ? `${ds.layout.container_max_width}px` : 'not detected'}
- Gutter: ${ds.layout.gutter ? `${ds.layout.gutter}px` : 'not detected'}
- Header height: ${ds.layout.nav_height ? `${ds.layout.nav_height}px` : 'not detected'}
- Source breakpoints: ${bp}

## Spacing scale

${ds.spacing.map((s) => `- ${s.value}px (${s.count} uses)`).join('\n') || '- none detected'}

${[...ds.colors.close_calls, ...ds.type.close_calls].length ? `## Close calls — decide these yourself

${[...ds.colors.close_calls, ...ds.type.close_calls].map((c) => `- **${c.role}**: chose \`${c.chosen}\` over \`${c.runner_up}\` by only ${c.margin}. Both are genuinely in use — pick the one the design intends, not the one that happened to win on volume.`).join('\n')}

` : ''}## Review before adopting

1. \`--brand-N\` names are positional. Rename to the organisation's own names.
2. Check the body size against accessibility norms — legacy sites often sit
   below 16px, and faithfully copying that is a decision, not a default.
3. Colours within ~14 RGB units were merged; \`design-system.json\` lists what
   was folded into each role.
`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pages = await loadBundle(opts.capture);
  if (!pages.length) {
    console.error(`no capture bundles under ${opts.capture}/`);
    process.exit(1);
  }
  const ds = {
    source: {
      pages: pages.map((p) => p.slug),
      urls: pages.map((p) => p.meta.url),
      generated_at: new Date().toISOString(),
    },
    colors: deriveColours(pages),
    fonts: deriveFonts(pages),
    type: deriveTypeScale(pages),
    spacing: deriveSpacing(pages, opts.top),
    layout: deriveLayout(pages),
    breakpoints: deriveBreakpoints(pages),
    source_custom_properties: Object.assign({}, ...pages.map((p) => p.css.rootVars || {})),
  };

  await writeFile(path.join(opts.out, 'design-system.json'), `${JSON.stringify(ds, null, 2)}\n`);
  await writeFile(path.join(opts.out, 'design-system.css'), emitCss(ds));
  await writeFile(path.join(opts.out, 'design-system.md'), emitMarkdown(ds));

  console.log(`design system from ${pages.length} page(s): ${pages.map((p) => p.slug).join(', ')}`);
  console.log(`  text ${ds.colors.text} · link ${ds.colors.link} · bg ${ds.colors.background}`);
  console.log(`  body ${ds.fonts.body} @ ${ds.type.body?.size}px · heading ${ds.fonts.heading}${ds.fonts.display ? ` · display ${ds.fonts.display}` : ''}`);
  console.log(`  container ${ds.layout.container_max_width}px · breakpoints ${ds.breakpoints.map((b) => b.value).join('/') || 'none'}`);
  console.log(`  → ${opts.out}/design-system.{json,css,md}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
