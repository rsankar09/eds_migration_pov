/* global WebImporter */

/**
 * Import transforms for the Commonwealth Annuity site (Drupal, Bootstrap grid
 * markup) into the blocks in this project.
 *
 * Component mapping is documented in capture/home/mapping.json. Each transform
 * emits exactly the row/cell contract its target block's decorate() expects;
 * changing one without the other will break the import.
 */

/**
 * Wraps a set of nodes in a div so a table cell can hold several elements.
 * @param {Document} document the source document
 * @param {Array<Node>} nodes the nodes to wrap
 * @returns {Element} the wrapper
 */
const cell = (document, nodes) => {
  const div = document.createElement('div');
  nodes.filter((n) => n).forEach((n) => div.append(n));
  return div;
};

/**
 * Rebuilds an element at a different tag, keeping its inline markup.
 * @param {Document} document the source document
 * @param {Element} source the source element (or null)
 * @param {string} tag the tag to build
 * @returns {Element|null} the new element
 */
const retag = (document, source, tag) => {
  if (!source) return null;
  const el = document.createElement(tag);
  el.innerHTML = source.innerHTML.trim();
  return el;
};

/* -------------------------------------------------------------------------- */
/* banner -> Hero (panel)                                                     */
/* -------------------------------------------------------------------------- */

const transformBanner = (main, document) => {
  main.querySelectorAll('.content-banner-section').forEach((banner) => {
    const panelSource = banner.querySelector('.content-top-right');
    const img = banner.querySelector('.cw-banner-image img');
    if (!panelSource && !img) return;

    const panelParts = [];
    // the prompt and the CTA list, in authored order
    panelSource?.querySelectorAll(':scope > div > *').forEach((node) => {
      if (node.tagName === 'P' || node.tagName === 'UL') panelParts.push(node);
    });

    const rows = [['Hero (panel)']];
    if (panelParts.length) rows.push([cell(document, panelParts)]);
    if (img) rows.push([img]);

    banner.replaceWith(WebImporter.DOMUtils.createTable(rows, document));
  });
};

/* -------------------------------------------------------------------------- */
/* lead statement -> default content, promoted to h1                          */
/* -------------------------------------------------------------------------- */

const transformStatement = (main, document) => {
  main.querySelectorAll('.cw-content-section-fullwidth').forEach((section) => {
    const paragraphs = [...section.querySelectorAll('p')]
      .filter((p) => p.textContent.trim());
    if (!paragraphs.length) return;

    // the source page has no heading at all; the lead statement becomes the h1
    const [lead, ...rest] = paragraphs;
    const nodes = [retag(document, lead, 'h1'), ...rest];
    section.replaceWith(cell(document, nodes));
  });
};

/* -------------------------------------------------------------------------- */
/* interior page body -> default content                                      */
/* -------------------------------------------------------------------------- */

/**
 * Interior pages put their copy in `.cw-content-section > .content-right-sec`.
 * It is a heading plus paragraphs — default content, not a block. The source
 * heading is an h2 and the page has no h1 at all, so it is promoted, matching
 * the decision made for the homepage lead statement.
 * @param {Element} main the page root
 * @param {Document} document the source document
 */
const transformBody = (main, document) => {
  main.querySelectorAll('.cw-content-section').forEach((section) => {
    const holder = section.querySelector('.content-right-sec');
    if (!holder) return;
    // the inner field wrapper if Drupal emitted one, else the holder itself
    const field = holder.querySelector('.field') || holder;
    const nodes = [...field.children];
    if (!nodes.length) return;

    const first = nodes[0];
    if (first.tagName === 'H2') nodes[0] = retag(document, first, 'h1');

    /*
     * The source floats this copy into a 75% right-hand column
     * (`.cw-content-section .content-right-sec { width: 75%; float: right }`)
     * and sets it in Verdana. That is section layout, not block content, so
     * it travels as section metadata rather than wrapping the copy in a block.
     */
    nodes.push(WebImporter.DOMUtils.createTable([
      ['Section Metadata'],
      ['Style', 'content-column'],
    ], document));

    section.replaceWith(cell(document, nodes));
  });
};

/* -------------------------------------------------------------------------- */
/* link normalisation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Drops the legacy `/index.php` path segment. Interior pages link through it
 * while the homepage does not, so without this the same target imports under
 * two different paths.
 * @param {Element} root the element to normalise
 */
const normalizeLinks = (root) => {
  if (!root) return;
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href.startsWith('/index.php/')) a.setAttribute('href', href.replace('/index.php', ''));
  });
};

/* -------------------------------------------------------------------------- */
/* header -> /nav document                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds the /nav document: a brand section holding the logo link, then a
 * sections list. The header block classes nav.children by index, so the two
 * must be separated by a section break.
 * @param {Document} document the source document
 * @returns {Element|null} the nav document body
 */
const buildNavDocument = (document) => {
  const header = document.querySelector('header .region-header');
  if (!header) return null;

  const body = document.createElement('div');

  const brand = document.createElement('div');
  const brandP = document.createElement('p');
  const brandLink = document.createElement('a');
  brandLink.href = '/';
  const logo = header.querySelector('.site-logo img');
  if (logo) {
    // the source alt is just "Home"; name the organisation instead
    logo.setAttribute('alt', 'Commonwealth Annuity and Life Insurance Company');
    brandLink.append(logo);
  } else {
    brandLink.textContent = 'Commonwealth Annuity and Life Insurance Company';
  }
  brandP.append(brandLink);
  brand.append(brandP);

  const sections = document.createElement('div');
  const list = document.createElement('ul');
  header.querySelectorAll('#block-mainnavigation > ul.menu > li').forEach((item) => {
    const source = item.querySelector(':scope > a');
    if (!source) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = source.getAttribute('href');
    a.textContent = source.textContent.trim();
    li.append(a);

    /*
     * Drupal renders a section's children only when that section is the
     * active trail, so one page yields one branch. Capture whichever branch
     * this page exposes; items marked collapsed have children that live on
     * another page and are flagged for a later pass.
     */
    const submenu = item.querySelector(':scope > ul.menu');
    if (submenu) {
      const sub = document.createElement('ul');
      submenu.querySelectorAll(':scope > li > a[href]').forEach((child) => {
        const subLi = document.createElement('li');
        const subA = document.createElement('a');
        subA.href = child.getAttribute('href');
        subA.textContent = child.textContent.trim();
        subLi.append(subA);
        sub.append(subLi);
      });
      if (sub.children.length) li.append(sub);
    } else if (item.classList.contains('menu-item--collapsed')) {
      li.setAttribute('data-has-children', 'true');
    }
    list.append(li);
  });
  sections.append(list);

  body.append(brand, document.createElement('hr'), sections);
  return body;
};

/* -------------------------------------------------------------------------- */
/* footer -> /footer document                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Builds the /footer document: the link row as a list, then the copyright line.
 * @param {Document} document the source document
 * @returns {Element|null} the footer document body
 */
const buildFooterDocument = (document) => {
  const footer = document.querySelector('footer .region-footer');
  if (!footer) return null;

  const body = document.createElement('div');

  const links = [...footer.querySelectorAll('p.links a[href]')];
  if (links.length) {
    const list = document.createElement('ul');
    links.forEach((source) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = source.getAttribute('href');
      a.textContent = source.textContent.trim();
      li.append(a);
      list.append(li);
    });
    body.append(list);
  }

  const copy = footer.querySelector('p.copy');
  if (copy) {
    const p = document.createElement('p');
    p.textContent = copy.textContent.trim();
    body.append(p);
  }

  return body;
};

/* -------------------------------------------------------------------------- */
/* section breaks                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Inserts an <hr> before each block table and before the lead statement so each
 * component lands in its own EDS section. Without this the page imports as a
 * single section and the section rhythm collapses.
 * @param {Element} main the page root
 * @param {Document} document the source document
 */
const addSectionBreaks = (main, document) => {
  const tables = [...main.querySelectorAll('table')]
    .filter((t) => !t.parentElement.closest('table'));

  tables.forEach((table) => {
    const next = table.nextElementSibling;
    if (next && next.tagName !== 'HR') {
      next.parentElement.insertBefore(document.createElement('hr'), next);
    }
  });
};

/* -------------------------------------------------------------------------- */

export default {
  transform: ({ document, url, params }) => {
    const nav = buildNavDocument(document);
    const footer = buildFooterDocument(document);

    const main = document.querySelector('main') || document.body;

    transformBanner(main, document);
    transformStatement(main, document);
    transformBody(main, document);

    WebImporter.DOMUtils.remove(main, [
      // chrome that now lives in /nav and /footer
      'header',
      'footer',
      // the colour bar is decorative and is drawn by the hero block's CSS
      '.content-banner-color',
      // consent SDK, Drupal a11y helpers and other non-content noise
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#drupal-live-announce',
      '.skip-link',
      '.visually-hidden',
      'script',
      'noscript',
      'style',
      'iframe',
    ]);

    addSectionBreaks(main, document);

    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params?.originalURL || url);
    WebImporter.rules.convertIcons(main, document);

    const { pathname } = new URL(url);
    const documentPath = pathname
      .replace(/^\/index\.php/, '')
      .replace(/\.html$/, '')
      .replace(/\/$/, '') || '/index';

    [main, nav, footer].forEach(normalizeLinks);

    const results = [{ element: main, path: documentPath }];
    [[nav, '/nav'], [footer, '/footer']].forEach(([element, docPath]) => {
      if (!element) return;
      WebImporter.rules.adjustImageUrls(element, url, params?.originalURL || url);
      results.push({ element, path: docPath });
    });
    return results;
  },
};
