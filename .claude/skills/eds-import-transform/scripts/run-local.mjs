#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax, no-continue,
   max-len, import/no-extraneous-dependencies, no-undef */
// Node tooling script, not block code — Airbnb rules relaxed deliberately.

/**
 * Run an import transform against captured DOM, without calling Adobe's
 * Import as a Service.
 *
 * This is a **dry run**, not an import. It executes the same `import.js`
 * against `capture/<page>/dom.html` in jsdom and writes the resulting
 * documents as EDS plain HTML, so block contracts and content decisions can
 * be reviewed before spending an API key on a real run. Anything downstream
 * of the transform — asset ingestion, DAM paths, xwalk packaging — is not
 * exercised here and must not be reported as if it were.
 *
 * Usage:
 *   node run-local.mjs --capture capture --page home [--page about] \
 *     --importjs tools/importer/import.js --out capture/imported
 */

import { JSDOM } from 'jsdom';
import { DOMUtils, Blocks } from '@adobe/helix-importer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const o = {
    capture: 'capture', pages: [], importjs: 'tools/importer/import.js', out: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const next = () => {
      i += 1;
      return argv[i];
    };
    if (argv[i] === '--capture') o.capture = next();
    else if (argv[i] === '--page') o.pages.push(next());
    else if (argv[i] === '--importjs') o.importjs = next();
    else if (argv[i] === '--out') o.out = next();
  }
  return o;
}

/** Minimal stand-in for the globals the importer runtime provides. */
function installWebImporter() {
  globalThis.WebImporter = {
    DOMUtils,
    Blocks,
    rules: {
      createMetadata: (root, doc) => {
        const meta = {};
        const title = doc.querySelector('title');
        if (title) meta.Title = title.textContent.replace(/[|\-–—].*$/, '').trim();
        const desc = doc.querySelector('meta[name="description"]');
        if (desc) meta.Description = desc.content;
        const image = doc.querySelector('meta[property="og:image"]');
        if (image) meta.Image = image.content;
        if (!Object.keys(meta).length) return null;
        const rows = [['Metadata'], ...Object.entries(meta).map(([k, v]) => [k, v])];
        const table = DOMUtils.createTable(rows, doc);
        root.append(table);
        return table;
      },
      adjustImageUrls: (element, url, originalURL) => {
        element.querySelectorAll('img[src]').forEach((img) => {
          try {
            img.src = new URL(img.getAttribute('src'), originalURL || url).toString();
          } catch { /* leave as-is */ }
        });
      },
      convertIcons: () => {},
    },
  };
}

/** Serializes a transformed element tree as importer-shaped HTML. */
function toPlainHtml(element) {
  return `${element.innerHTML.trim()}\n`;
}

const CONTENT_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'TABLE', 'HR',
  'BLOCKQUOTE', 'PRE', 'IMG', 'PICTURE', 'FIGURE', 'CODE', 'DL',
]);
const WRAPPER_TAGS = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'MAIN', 'HEADER', 'FOOTER', 'NAV',
  'SPAN', 'FORM', 'A',
]);

/**
 * Flattens source wrapper markup away, keeping only content elements in
 * order. The real pipeline gets this for free by round-tripping through
 * markdown; skipping it would leave `<div class="container ttt12">` in the
 * output, which EDS would then decorate as a block named `container`.
 */
function flatten(node, out = []) {
  [...node.children].forEach((el) => {
    if (CONTENT_TAGS.has(el.tagName)) out.push(el);
    else if (WRAPPER_TAGS.has(el.tagName)) flatten(el, out);
  });
  return out;
}

/** `Hero (panel)` -> `hero panel`, matching the importer's block naming. */
function blockClass(label) {
  const m = /^([^(]+?)\s*(?:\(([^)]*)\))?$/.exec(label.trim());
  const name = (m ? m[1] : label).trim().toLowerCase().replace(/\s+/g, '-');
  const variants = (m && m[2] ? m[2].split(',') : [])
    .map((v) => v.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean);
  return [name, ...variants].join(' ');
}

/** Turns an importer table into the block div markup EDS decorates. */
function tableToBlock(table, document) {
  const rows = [...table.querySelectorAll(':scope > tbody > tr, :scope > tr')];
  if (!rows.length) return null;
  const head = rows[0];
  const label = head.textContent.trim();
  if (/^metadata$/i.test(label)) return null;

  const block = document.createElement('div');
  block.className = blockClass(label);
  rows.slice(1).forEach((tr) => {
    const row = document.createElement('div');
    [...tr.children].forEach((cellEl) => {
      const div = document.createElement('div');
      /*
       * Transforms wrap multi-node cells in a plain div so they fit one table
       * cell. Markdown has no divs, so the real pipeline drops that wrapper —
       * keep the emulation honest and drop it here too, or the extra nesting
       * shows up as spacing that production will not have.
       */
      const only = cellEl.children.length === 1 ? cellEl.children[0] : null;
      const redundant = only && only.tagName === 'DIV' && !only.attributes.length;
      div.innerHTML = redundant ? only.innerHTML : cellEl.innerHTML;
      row.append(div);
    });
    block.append(row);
  });
  return block;
}

/**
 * Renders the transform output as EDS plain HTML: sections split on <hr>,
 * tables converted to block divs, wrappers dropped.
 */
function toRenderableHtml(element, document) {
  /*
   * EDS delivers every image inside a <picture>. Block CSS is written against
   * that, so an emulation that emits a bare <img> measures differently from
   * production for reasons that have nothing to do with the transform.
   */
  element.querySelectorAll('img').forEach((img) => {
    if (img.parentElement && img.parentElement.tagName === 'PICTURE') return;
    const picture = document.createElement('picture');
    img.replaceWith(picture);
    picture.append(img);
  });

  const nodes = flatten(element);
  const sections = [[]];
  nodes.forEach((el) => {
    if (el.tagName === 'HR') {
      sections.push([]);
      return;
    }
    if (el.tagName === 'TABLE') {
      const block = tableToBlock(el, document);
      if (block) sections[sections.length - 1].push(block);
      return;
    }
    sections[sections.length - 1].push(el);
  });

  return `${sections
    .filter((group) => group.length)
    .map((group) => {
      const wrap = document.createElement('div');
      group.forEach((el) => wrap.append(el));
      return wrap.outerHTML;
    })
    .join('\n')}\n`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.pages.length) {
    console.error('no pages. pass --page <slug> (repeatable)');
    process.exit(1);
  }
  const outRoot = opts.out || path.join(opts.capture, 'imported');
  const mod = await import(path.resolve(opts.importjs));
  const transform = mod.default?.transform;
  if (typeof transform !== 'function') {
    console.error(`${opts.importjs} does not export default { transform }`);
    process.exit(1);
  }

  for (const page of opts.pages) {
    const dir = path.join(opts.capture, page);
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf-8'));
    // the expanded dump carries submenu/accordion markup the plain one hides
    let html;
    try {
      html = await readFile(path.join(dir, 'dom-expanded.html'), 'utf-8');
    } catch {
      html = await readFile(path.join(dir, 'dom.html'), 'utf-8');
    }

    const dom = new JSDOM(html, { url: meta.url });
    const { document } = dom.window;
    /*
     * The crawler stamps data-eds-id on every node so styles and CSS can be
     * joined back to it. A real import fetches the live page and never sees
     * those, so strip them here rather than teaching the transform to ignore
     * an attribute that will not exist in production.
     */
    document.querySelectorAll('[data-eds-id]').forEach((el) => el.removeAttribute('data-eds-id'));
    document.querySelectorAll('[data-eds-third-party]').forEach((el) => el.remove());
    globalThis.document = document;
    installWebImporter();

    const results = transform({ document, url: meta.url, params: { originalURL: meta.url } });
    const list = Array.isArray(results) ? results : [{ element: results, path: '/index' }];

    console.log(`\n${page} → ${list.length} document(s)`);
    for (const { element, path: docPath } of list) {
      const rel = `${docPath.replace(/^\//, '') || 'index'}.plain.html`;
      const tables = element.querySelectorAll('table').length;
      const imgs = element.querySelectorAll('img').length;
      const links = element.querySelectorAll('a[href]').length;

      const outFile = path.join(outRoot, page, rel);
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, toPlainHtml(element));

      // renderable twin, for serving through a local dev server during QA.
      // Built from a clone: the conversion moves nodes out of the tree.
      const renderFile = path.join(outRoot, `${page}-renderable`, rel);
      await mkdir(path.dirname(renderFile), { recursive: true });
      await writeFile(renderFile, toRenderableHtml(element.cloneNode(true), document));
      console.log(`  ${docPath.padEnd(34)} ${String(tables).padStart(2)} blocks · ${String(imgs).padStart(2)} img · ${String(links).padStart(3)} links → ${outFile}`);
    }
  }
  console.log('\nDRY RUN — transform output only. No import ran, no assets were ingested.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
