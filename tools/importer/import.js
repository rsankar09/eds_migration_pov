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
  /*
   * Jackson titles their headings as `<h3 class="…__title"><p>text</p></h3>`,
   * so copying innerHTML verbatim produces `<h3><p>…</p></h3>` — invalid
   * nesting that survives into the import. Unwrap a lone block child.
   */
  const only = source.children.length === 1 ? source.firstElementChild : null;
  const inner = only && /^(P|DIV|SPAN)$/.test(only.tagName) ? only : source;
  el.innerHTML = inner.innerHTML.trim();
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

    /*
     * Model order is `image` (+imageAlt) then `text`, one row of one cell
     * each — so the image row comes FIRST, and both rows are always emitted.
     * Pushing the copy first mapped it into the image property; skipping an
     * absent row shifted every later property up by one.
     */
    const rows = [
      ['Hero (panel)'],
      [img || ''],
      [panelParts.length ? cell(document, panelParts) : ''],
    ];

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
  header.querySelectorAll('#block-mainnavigation ul.menu > li').forEach((item) => {
    const source = item.querySelector(':scope > a');
    if (!source) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = source.getAttribute('href');
    a.textContent = source.textContent.trim();
    li.append(a);

    // Drupal marks items with children as collapsed, but renders no submenu on
    // this page, so second-level links cannot be recovered from the homepage
    if (item.classList.contains('menu-item--collapsed')) {
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
    if (!next || next.tagName === 'HR') return;
    /*
     * A Section Metadata table belongs to the section it follows, so no break
     * goes between them. Without this the style lands on the *next* section:
     * the block ends up in one section and its own `Style` in the one after.
     */
    if (next.tagName === 'TABLE' && next.rows[0]?.textContent.trim() === 'Section Metadata') return;
    next.parentElement.insertBefore(document.createElement('hr'), next);
  });
};

/* ========================================================================== */
/* Jackson (AEM, fp-site components) -> the blocks in this project            */
/*                                                                            */
/* Contracts are the *document* shape each block documents: one row of cells. */
/* The same blocks also accept Universal Editor's one-row-per-field-group     */
/* shape; see .claude/skills/eds-block-authoring/references/                  */
/* authoring-contract.md. Do not reshape a transform to work around a block   */
/* that only tolerates one of the two — fix the block.                        */
/* ========================================================================== */

/**
 * Band background colour -> the project's section style.
 * Measured from capture/financial-professional--ria-and-wealth-manager.
 */
const JACKSON_BANDS = {
  '#d4b5a3': 'tan',
  '#ebebeb': 'grey',
  '#dbcfc7': 'stone',
  // #ffffff is the default band and needs no section style.
  // #474546 is the carousel card's own panel, not a band — it is styled by
  // the block's CSS (--card-charcoal) and must not become a section style.
};

/** Gradient classes the source puts on a band wrapper. */
const JACKSON_GRADIENTS = {
  'color-grad-red-plum-diag': 'brand-gradient',
};

/**
 * Appends a Section Metadata table plus a break, so the band's background
 * survives as a section style rather than being lost with the source markup.
 * @param {Element} target the element to insert after
 * @param {Document} document the source document
 * @param {string} style the section style value
 */
const sectionStyle = (target, document, style) => {
  if (!style) return;

  /*
   * The section model's `style` is a `multiselect`, so the JCR property has to
   * be a multi-valued attribute (String[]) — a single comma-joined string is
   * imported as one value that matches no CSS class, which is why bands came
   * through with no background at all.
   *
   * The encoding that produces an array is one <p> per value in the cell:
   * readBlockConfig() returns `ps.map(p => p.textContent)` for a cell holding
   * several paragraphs, and a plain string for one. So each style token gets
   * its own paragraph rather than being joined with commas.
   */
  const values = String(style).split(',').map((v) => v.trim()).filter(Boolean);
  if (!values.length) return;

  const valueCell = document.createElement('div');
  values.forEach((v) => {
    const para = document.createElement('p');
    para.textContent = v;
    valueCell.append(para);
  });

  const table = WebImporter.DOMUtils.createTable([['Section Metadata'], ['Style', valueCell]], document);
  target.after(table);
  table.after(document.createElement('hr'));
};

/**
 * Reads the band colour a Jackson wrapper carries.
 *
 * The source sets it as a CSS custom property — `style="--bg-color: #d4b5a3"`
 * — not as `background-color`, and in hex rather than rgb(). Matching the
 * wrong one returns null for every band and every section style is silently
 * dropped.
 */
const bandStyle = (el) => {
  // `[class$=]` would miss it: the source emits `class="…__wrapper "` with a
  // trailing space, so the attribute does not end with the suffix
  const wrapper = el.querySelector('[class*="__wrapper"]') || el;

  /*
   * The source encodes a band colour two different ways, and reading only one
   * silently drops every band that uses the other:
   *   - solid colours as a custom property: style="--bg-color: #d4b5a3"
   *   - gradients as a class:               class="… color-grad-red-plum-diag"
   * The gradient form is what the credit-union feature band uses, so matching
   * only --bg-color left that band with no section style at all.
   */
  const grad = [...wrapper.classList].find((c) => c.startsWith('color-grad-'));
  if (grad) return JACKSON_GRADIENTS[grad] || 'brand-gradient';

  const bg = (wrapper.getAttribute('style') || '').match(/--bg-color:\s*(#[0-9a-f]{3,8})/i);
  return bg ? JACKSON_BANDS[bg[1].toLowerCase()] : null;
};

/**
 * Line Awesome class -> icon token. The source names its icons `la-chart-bar`
 * and /icons is named to match, so the token is derived rather than mapped
 * through a table that would drift.
 * @param {Element} scope the element holding the <i>
 * @returns {string} the token, or '' when there is no icon
 */
const iconToken = (scope) => {
  // icon-card uses <i>, icon-feature uses <span> — match both
  const i = scope.querySelector('i[class*="la-"], span[class*="la-"]');
  if (!i) return '';
  const m = [...i.classList].find((c) => c.startsWith('la-'));
  return m ? m.replace(/^la-/, '') : '';
};

/** Collects a component's copy nodes: heading, body, then each CTA. */
const copyNodes = (document, scope, headingTag, { strongCta = false } = {}) => {
  const nodes = [];
  // several components title themselves with `<p class="…__title">` rather
  // than a heading tag, so fall back to the class before giving up
  const heading = scope.querySelector('h1, h2, h3, h4, h5, h6')
    || scope.querySelector('[class*="__title"]');
  if (heading) nodes.push(retag(document, heading, headingTag));
  /*
   * Take the *innermost* description container only. The source nests
   * `__description-wrapper > __description > p`, and `[class*="__description"]`
   * matches both levels: appending the children of each moved the <p> out of
   * the inner div and then appended that now-empty div too, leaving a stray
   * `<div class="no-image-hero__description"></div>` in the imported content.
   */
  const descriptions = [...scope.querySelectorAll('[class*="__description"], [class*="__text"]')]
    .filter((d) => !d.querySelector('[class*="__description"], [class*="__text"]'));
  descriptions.forEach((d) => {
    [...d.children].forEach((n) => { if (n.textContent.trim()) nodes.push(n); });
  });

  /*
   * Only links that are a CTA in their own right. A link written inside body
   * copy is already inside a description node above, so harvesting every
   * `a[href]` in scope would emit it a second time as a standalone CTA.
   */
  scope.querySelectorAll('a[href]').forEach((a) => {
    const label = a.textContent.replace(/\s+/g, ' ').trim();
    if (!label) return;
    if (descriptions.some((d) => d.contains(a))) return;
    a.textContent = label;
    const p = document.createElement('p');
    /*
     * Default content needs the CTA wrapped in <strong>: the project's global
     * decorateButtons() only buttonises emphasised links, so a bare link
     * imports as plain inline text where the source had a pill.
     *
     * Block CTAs are left bare — their blocks call decorateCta(), which
     * buttonises a standalone link on its own, and the importer maps the bare
     * <a> onto the model's link property.
     */
    if (strongCta) {
      const strong = document.createElement('strong');
      strong.append(a);
      p.append(strong);
    } else {
      p.append(a);
    }
    nodes.push(p);
  });
  return nodes;
};

/* feature-50-50 -> Feature ------------------------------------------------- */

const transformJacksonFeature = (main, document) => {
  main.querySelectorAll('.feature-50-50').forEach((band) => {
    const content = band.querySelector('[class*="__content"]');
    const img = band.querySelector('img');
    const card = band.querySelector('[class*="__card-content"], [class*="__content-inner"]');
    if (!card) return;

    const variant = content && content.classList.contains('image-left') ? 'image-left' : 'image-right';
    const style = bandStyle(band);

    /*
     * A simple (non-container) block maps ONE ROW PER PROPERTY OR GROUP, each
     * with a single cell — not one row of many columns. `feature`'s model is
     * `image` (+imageAlt, collapsed) then the `copy_*` group, so it is two
     * rows of one cell, in that order. Emitting [img, copy] as a single
     * two-column row is the *document authoring* shape: the importer then has
     * nothing in row 2 and the copy lands in the image property.
     *
     * The image row is emitted even when empty, so an imageless band does not
     * shift its copy up into the image property.
     */
    const rows = [
      [`Feature (${variant})`],
      [img || ''],
      [cell(document, copyNodes(document, card, 'h2'))],
    ];
    const table = WebImporter.DOMUtils.createTable(rows, document);
    band.replaceWith(table);
    sectionStyle(table, document, style);
  });
};

/* card-container + icon-card -> Icon Feature (cards) ----------------------- */

const transformJacksonIconCards = (main, document) => {
  main.querySelectorAll('.card-container').forEach((band) => {
    const cards = [...band.querySelectorAll('.icon-card')];
    if (!cards.length) return;

    const heading = band.querySelector('[class*="__title"]');
    const rows = [['Icon Feature (cards)']];
    cards.forEach((c) => {
      rows.push([iconToken(c), cell(document, copyNodes(document, c, 'h3'))]);
    });

    const table = WebImporter.DOMUtils.createTable(rows, document);
    band.replaceWith(table);
    // the band heading is default content above the block, as the blocks expect
    if (heading) table.before(retag(document, heading, 'h3'));
    sectionStyle(table, document, 'centered');
  });
};

/* card-container + icon-feature -> Icon Feature (columns) ------------------ */

const transformJacksonIconFeature = (main, document) => {
  main.querySelectorAll('.card-container').forEach((band) => {
    const items = [...band.querySelectorAll('.icon-feature__block')];
    if (!items.length) return;

    const rows = [['Icon Feature']];
    items.forEach((it) => rows.push([iconToken(it), cell(document, copyNodes(document, it, 'h3'))]));
    band.replaceWith(WebImporter.DOMUtils.createTable(rows, document));
  });
};

/* carousel-card-container -> Carousel -------------------------------------- */

const transformJacksonCarousel = (main, document) => {
  main.querySelectorAll('.carousel-card-container').forEach((band) => {
    // the slides are `feature-card` components; matching on `__card*` instead
    // selects the two *containers* (`__cards`, `__card-content`), which both
    // contain images and so silently pass an img-presence filter
    const cards = [...band.querySelectorAll('.feature-card')];
    if (!cards.length) return;

    const heading = band.querySelector('[class*="__title"]');
    const rows = [['Carousel']];
    cards.forEach((c) => rows.push([c.querySelector('img'), cell(document, copyNodes(document, c, 'h3'))]));

    const table = WebImporter.DOMUtils.createTable(rows, document);
    band.replaceWith(table);
    if (heading) table.before(retag(document, heading, 'h2'));
  });
};

/* flexible-width-container (marketing-automation embed) -> Form ------------ */

const transformJacksonForm = (main, document) => {
  main.querySelectorAll('.flexible-width-container').forEach((band) => {
    const form = band.querySelector('form.mktoForm, form');
    if (!form) return;

    const rows = [['Form']];
    // `flexible-width-container__content` exists but is an empty 0-height
    // wrapper; the copy is a `flexible-content-area` in the first column
    const intro = band.querySelector('.flexible-content-area');
    if (intro && intro.textContent.trim()) {
      // the form-intro item has two ungrouped properties (heading,
      // description), so they are two cells of one row
      const title = intro.querySelector('[class*="__title"]');
      const body = [...intro.querySelectorAll('[class*="__description"] > *')]
        .filter((n) => n.textContent.trim());
      rows.push([
        retag(document, title, 'h2') || '',
        body.length ? cell(document, body) : '',
      ]);
    }

    form.querySelectorAll('input, textarea, button').forEach((el) => {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const name = el.getAttribute('name') || '';
      // hidden tracking fields and the captcha are not authorable content
      if (type === 'hidden' || /recaptcha/i.test(name)) return;

      if (el.tagName === 'BUTTON' || type === 'submit') {
        rows.push(['submit', el.textContent.trim() || 'Submit', '', 'full']);
        return;
      }
      const label = el.getAttribute('placeholder') || el.getAttribute('aria-label') || name;
      const kind = el.tagName === 'TEXTAREA' ? 'textarea' : (type || 'text');
      // the source pairs name/surname and phone/zip on one line
      const half = /^(firstname|lastname|phone|postalcode|zip)$/i.test(name) ? 'half' : 'full';
      rows.push([kind, label, name, half]);
    });

    const table = WebImporter.DOMUtils.createTable(rows, document);
    band.replaceWith(table);
    sectionStyle(table, document, bandStyle(band) || 'grey');
  });
};

/* no-image-hero -> default content on a centred band ----------------------- */

const transformJacksonHero = (main, document) => {
  main.querySelectorAll('.no-image-hero').forEach((hero) => {
    const nodes = copyNodes(document, hero, 'h1', { strongCta: true });
    if (!nodes.length) return;
    const wrap = cell(document, nodes);
    hero.replaceWith(wrap);

    // read the band rather than assuming grey: a hero on the default white
    // band would otherwise be imported onto a grey one
    const content = hero.querySelector('[class*="__content"]');
    const centred = !content || !/left-align|right-align/.test(content.className);
    const band = bandStyle(hero);
    sectionStyle(wrap, document, [band, centred ? 'centered' : ''].filter(Boolean).join(', '));
  });
};

/* full-width-image-buffer -> a full-width image section -------------------- */

const transformJacksonBuffer = (main, document) => {
  main.querySelectorAll('.full-width-image-buffer').forEach((buffer) => {
    // the image is a CSS background declared in an inline <style>, not an <img>
    const css = buffer.querySelector('style')?.textContent || '';
    const match = css.match(/url\((["']?)([^"')]+)\1\)/);
    if (!match) { buffer.remove(); return; }
    const [, , url] = match;

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    const p = document.createElement('p');
    p.append(img);
    buffer.replaceWith(p);
    sectionStyle(p, document, 'full-width-image');
  });
};

/* text-block -> default content, disclosure bands keep their style --------- */

const transformJacksonTextBlock = (main, document) => {
  main.querySelectorAll('.text-block').forEach((block) => {
    const inner = block.querySelector('[class*="__block"]') || block;
    const isDisclosure = inner.className.includes('disclosure');
    const nodes = [...inner.querySelectorAll('p, h1, h2, h3, h4, ul, ol')]
      .filter((n) => n.textContent.trim() && !n.closest('table'));
    if (!nodes.length) { block.remove(); return; }

    const wrap = cell(document, nodes);
    block.replaceWith(wrap);
    if (isDisclosure) sectionStyle(wrap, document, 'disclosure');
  });
};

/** True when this document is a Jackson fp-site page rather than Commonwealth. */
const isJackson = (document) => !!document.querySelector(
  '.feature-50-50, .icon-card, .carousel-card-container, .masthead',
);

/* -------------------------------------------------------------------------- */

export default {
  transform: ({ document, url, params }) => {
    const nav = buildNavDocument(document);
    const footer = buildFooterDocument(document);

    const main = document.querySelector('main') || document.body;

    if (isJackson(document)) {
      // order matters: the icon-card grid and the icon-feature pair share the
      // `.card-container` wrapper, so the more specific one runs first
      transformJacksonHero(main, document);
      transformJacksonIconCards(main, document);
      transformJacksonIconFeature(main, document);
      transformJacksonFeature(main, document);
      transformJacksonCarousel(main, document);
      transformJacksonForm(main, document);
      transformJacksonBuffer(main, document);
      transformJacksonTextBlock(main, document);
    } else {
      transformBanner(main, document);
      transformStatement(main, document);
    }

    if (isJackson(document)) {
      /*
       * Jackson renders no <main>, <header> or <footer> element, so the
       * generic chrome removals below match nothing and the masthead would
       * survive into the imported page. Remove its chrome by component.
       *
       * nav and footer are `defer` in the approved mapping (shared Experience
       * Fragments), so they are stripped rather than emitted as documents.
       */
      WebImporter.DOMUtils.remove(main, [
        '.masthead',
        '.site-selector-bar',
        '.global-footer',
        '.breadcrumb',
        '.experiencefragment:not(:has(table))',
        // non-content overlays: their copy would otherwise land in the import
        '.session-timeout-dialog__panel',
        '#QSIFeedbackButton-btn',
        '[id^="QSIFeedbackButton"]',
        '.modal',
      ]);
    }

    WebImporter.DOMUtils.remove(main, [
      // chrome that now lives in /nav and /footer
      'header',
      'footer',
      // the colour bar is decorative and is drawn by the hero block's CSS
      '.content-banner-color',
      // consent SDK, Drupal a11y helpers and other non-content noise
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#onetrust-pc-sdk',
      '.ot-sdk-container',
      '#QSIFeedbackButton-btn',
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
    const documentPath = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/index';

    const results = [{ element: main, path: documentPath }];
    [[nav, '/nav'], [footer, '/footer']].forEach(([element, docPath]) => {
      if (!element) return;
      WebImporter.rules.adjustImageUrls(element, url, params?.originalURL || url);
      results.push({ element, path: docPath });
    });
    return results;
  },
};
