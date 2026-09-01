/* global WebImporter */

/**
 * Import transforms for the PPM America site (classic AEM Sites, `cmp-*` markup)
 * into the blocks on this project.
 *
 * Component mapping is documented in capture/home/mapping.json. Each transform
 * below emits exactly the row/cell contract its target block's decorate()
 * expects; changing one without the other will break the import.
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
 * Rebuilds a heading at the requested level, keeping its inline markup.
 * The source's heading levels follow its own visual scale rather than the
 * document outline, so levels are re-assigned on import.
 * @param {Document} document the source document
 * @param {Element} source the source heading (or null)
 * @param {string} level e.g. 'h2'
 * @returns {Element|null} the new heading
 */
const heading = (document, source, level) => {
  if (!source) return null;
  const h = document.createElement(level);
  h.innerHTML = source.innerHTML.trim();
  return h;
};

/**
 * Unwraps `<li><p>text</p></li>` to `<li>text</li>`, which the source emits and
 * markdown renders as a loose list otherwise.
 * @param {Element} root the element to clean
 */
const tightenListItems = (root) => {
  if (!root) return;
  root.querySelectorAll('li > p:only-child').forEach((p) => {
    p.replaceWith(...p.childNodes);
  });
};

/* -------------------------------------------------------------------------- */
/* hero -> Hero (card)                                                        */
/* -------------------------------------------------------------------------- */

const transformHero = (main, document) => {
  main.querySelectorAll('.cmp-hero').forEach((hero) => {
    const img = hero.querySelector('.cmp-hero__image img');
    const title = hero.querySelector('.cmp-hero__title');
    if (!img && !title) return;

    // image row first so the copy stacks under it on small screens
    const rows = [['Hero (card)']];
    if (img) rows.push([img]);
    const copy = [heading(document, title, 'h1')];
    const body = hero.querySelector('.cmp-hero__description');
    if (body) copy.push(body);
    rows.push([cell(document, copy)]);

    hero.replaceWith(WebImporter.DOMUtils.createTable(rows, document));
  });
};

/* -------------------------------------------------------------------------- */
/* 33/66 text container -> Columns (thirds)                                   */
/* -------------------------------------------------------------------------- */

const transformIntroColumns = (main, document) => {
  main.querySelectorAll('.cmp-container-columns-33-66').forEach((container) => {
    // the same layout class is used by the stats band; only take the text one
    if (container.querySelector('.cmp-numbertext')) return;

    const texts = [...container.querySelectorAll('.cmp-text')];
    if (texts.length < 2) return;

    const lead = texts[0];
    const rest = texts.slice(1);

    const leadHeading = lead.querySelector('h1, h2, h3, h4, h5, h6');
    const leadCell = cell(document, [heading(document, leadHeading, 'h2')]);
    const bodyCell = cell(document, rest.flatMap((t) => [...t.children]));

    container.replaceWith(WebImporter.DOMUtils.createTable(
      [['Columns (thirds)'], [leadCell, bodyCell]],
      document,
    ));
  });
};

/* -------------------------------------------------------------------------- */
/* numbertext groups -> Stats                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reassembles the source's split numeral (prefix glyph, digits, suffix glyph)
 * into the single value string the stats block parses back apart.
 * @param {Element} numbertext a .cmp-numbertext element
 * @returns {string} e.g. "$95" or "53%"
 */
const statValue = (numbertext) => {
  const text = (sel) => (numbertext.querySelector(sel)?.textContent || '').trim();
  return [
    text('.cmp-numbertext__prestat-icon'),
    text('.cmp-numbertext__text'),
    text('.cmp-numbertext__poststat-icon'),
  ].join('');
};

const transformStats = (main, document) => {
  const all = [...main.querySelectorAll('.cmp-numbertext')];
  if (!all.length) return;

  // the band is whatever wraps every stat on the page
  const root = all[0].closest('.cmp-experiencefragment')
    || all[0].closest('.cmp-container--teal-theme')
    || main;

  const rows = [['Stats']];
  const seenGroups = new Set();

  all.forEach((numbertext) => {
    // a stat sitting inside a 33/66 container belongs to a labelled group
    const labelled = numbertext.closest('.cmp-container-columns-33-66');
    const group = labelled || numbertext.closest('.cmp-container-columns-4-equal');

    if (group && labelled && !seenGroups.has(group)) {
      seenGroups.add(group);
      const label = labelled.querySelector('.cmp-title__text');
      if (label) {
        const p = document.createElement('p');
        p.textContent = label.textContent.trim();
        rows.push([p]);
      }
    }

    const value = document.createElement('p');
    value.textContent = statValue(numbertext);

    const label = document.createElement('p');
    // innerHTML keeps footnote <sup> markers attached to the label
    label.innerHTML = (numbertext.querySelector('.cmp-numbertext__stattext')?.innerHTML || '').trim();

    rows.push([value, label]);
  });

  root.replaceWith(WebImporter.DOMUtils.createTable(rows, document));
};

/* -------------------------------------------------------------------------- */
/* 3-up linked cards -> Cards (insights)                                      */
/* -------------------------------------------------------------------------- */

const transformInsightCards = (main, document) => {
  main.querySelectorAll('.cmp-container-columns-3-equal').forEach((container) => {
    const cards = [...container.querySelectorAll('.cmp-card')]
      .filter((c) => c.querySelector('.cmp-card__link'));
    if (!cards.length) return;

    const rows = [['Cards (insights)']];

    cards.forEach((card) => {
      const img = card.querySelector('.cmp-card__image img');
      const href = card.querySelector('.cmp-card__link')?.getAttribute('href');
      const eyebrowText = card.querySelector('.cmp-card__pretitle')?.textContent.trim();
      const titleText = card.querySelector('.cmp-card__title')?.textContent.trim();

      const body = [];
      if (eyebrowText) {
        const p = document.createElement('p');
        p.textContent = eyebrowText;
        body.push(p);
      }
      if (titleText) {
        const h = document.createElement('h3');
        if (href) {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = titleText;
          h.append(a);
        } else {
          h.textContent = titleText;
        }
        body.push(h);
      }

      rows.push([img, cell(document, body)]);
    });

    // the section heading above the grid is default content, not part of the block,
    // but it must sit immediately before the table so both land in the same section
    const table = WebImporter.DOMUtils.createTable(rows, document);
    container.replaceWith(table);

    const sectionTitle = container.closest('.cmp-container')
      ?.querySelector('.cmp-title__text')
      || document.querySelector('.cmp-title--default .cmp-title__text');
    if (sectionTitle && !table.contains(sectionTitle)) {
      const h = heading(document, sectionTitle, 'h2');
      sectionTitle.closest('.title, .cmp-title')?.remove();
      table.parentElement.insertBefore(h, table);
    }
  });
};

/* -------------------------------------------------------------------------- */
/* single media+text card with a CTA -> Feature (gray)                        */
/* -------------------------------------------------------------------------- */

const transformFeature = (main, document) => {
  main.querySelectorAll('.cmp-card__action-container').forEach((actions) => {
    const card = actions.closest('.cmp-card');
    if (!card) return;

    const img = card.querySelector('.cmp-card__image img');
    const pretitle = card.querySelector('.cmp-card__pre-title');
    const description = card.querySelector('.cmp-card__description');
    tightenListItems(description);

    const content = [heading(document, pretitle, 'h2')];
    if (description) content.push(...description.children);

    // decorateButtons() turns a lone <strong>-wrapped link into a primary button
    const link = actions.querySelector('a[href]');
    if (link) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      const a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = link.textContent.trim();
      strong.append(a);
      p.append(strong);
      content.push(p);
    }

    const target = card.closest('.cmp-experiencefragment') || card;
    target.replaceWith(WebImporter.DOMUtils.createTable(
      [['Feature (gray)'], [img, cell(document, content)]],
      document,
    ));
  });
};

/* -------------------------------------------------------------------------- */
/* fine print -> Disclaimer                                                   */
/* -------------------------------------------------------------------------- */

const transformDisclaimer = (main, document) => {
  main.querySelectorAll('.cmp-experiencefragment--firm-statistics').forEach((xf) => {
    const paragraphs = [...xf.querySelectorAll('.cmp-text p')]
      .filter((p) => p.textContent.trim());
    if (!paragraphs.length) return;

    const rows = [['Disclaimer'], ...paragraphs.map((p) => [p])];
    xf.replaceWith(WebImporter.DOMUtils.createTable(rows, document));
  });
};

/* -------------------------------------------------------------------------- */
/* header -> /nav document                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds the three-section /nav document the header block expects:
 * brand, sections (a nested link list), tools.
 * @param {Document} document the source document
 * @returns {Element|null} the nav document body
 */
const buildNavDocument = (document) => {
  const header = document.querySelector('.cmp-header');
  if (!header) return null;

  const body = document.createElement('div');

  const brand = document.createElement('div');
  const brandP = document.createElement('p');
  const brandLink = document.createElement('a');
  brandLink.href = '/';
  const logo = header.querySelector('.cmp-header__content img');
  if (logo) {
    brandLink.append(logo);
    // keep the accessible name if the logo carries no alt text
    if (!logo.getAttribute('alt')) logo.setAttribute('alt', 'PPM America');
  } else {
    brandLink.textContent = 'PPM America';
  }
  brandP.append(brandLink);
  brand.append(brandP);

  const sections = document.createElement('div');
  const list = document.createElement('ul');
  header.querySelectorAll('.cmp-nav > .cmp-nav__list > .cmp-nav__list-item').forEach((item) => {
    const li = document.createElement('li');
    const top = item.querySelector(':scope > .cmp-nav__list-item-link');
    if (top) li.append(document.createTextNode(top.textContent.trim()));

    const children = [...item.querySelectorAll(':scope > .cmp-nav-sec__list > .cmp-nav-sec__list-item > a')];
    if (children.length) {
      const sub = document.createElement('ul');
      children.forEach((a) => {
        const subLi = document.createElement('li');
        const link = document.createElement('a');
        link.href = a.getAttribute('href');
        link.textContent = a.textContent.trim();
        subLi.append(link);
        sub.append(subLi);
      });
      li.append(sub);
    }
    list.append(li);
  });
  sections.append(list);

  // the header block builds its own search control, so no tools section is emitted;
  // the <hr> is what makes brand and sections separate EDS sections, which the
  // block relies on to class them by index
  body.append(brand, document.createElement('hr'), sections);
  return body;
};

/* -------------------------------------------------------------------------- */
/* footer -> /footer document                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Builds the two-section /footer document the footer block's CSS expects:
 * logo + address + social, then copyright + policy links.
 * @param {Document} document the source document
 * @returns {Element|null} the footer document body
 */
const buildFooterDocument = (document) => {
  const footer = document.querySelector('.cmp-footer');
  if (!footer) return null;

  const body = document.createElement('div');

  const top = document.createElement('div');
  const logo = footer.querySelector('.cmp-footer__logo img');
  if (logo) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = '/';
    if (!logo.getAttribute('alt')) logo.setAttribute('alt', 'PPM America');
    a.append(logo);
    p.append(a);
    top.append(p);
  }
  const address = footer.querySelector('.cmp-footer__address-list');
  if (address) top.append(address);
  const social = footer.querySelector('.cmp-footer__social');
  if (social) {
    const a = social.querySelector('a');
    const icon = social.querySelector('img');
    const label = a?.getAttribute('aria-label')?.trim()
      || icon?.getAttribute('alt')?.trim()
      || 'LinkedIn';

    const p = document.createElement('p');
    const socialLink = document.createElement('a');
    socialLink.href = a ? a.getAttribute('href') : '#';
    if (icon) {
      // keep the mark, but make sure it carries the accessible name
      icon.setAttribute('alt', label);
      socialLink.append(icon);
    } else {
      socialLink.textContent = label;
    }
    p.append(socialLink);
    top.append(p);
  }

  const bottom = document.createElement('div');
  const copyright = footer.querySelector('.cmp-footer__copyright');
  if (copyright) {
    const p = document.createElement('p');
    p.textContent = copyright.textContent.trim();
    bottom.append(p);
  }
  const policy = footer.querySelector('.cmp-footer__policy ul');
  if (policy) bottom.append(policy);

  body.append(top, document.createElement('hr'), bottom);
  return body;
};

/* -------------------------------------------------------------------------- */
/* section breaks                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Inserts an <hr> before each block table so every component lands in its own
 * EDS section. Without this the whole page imports as a single section and the
 * per-section spacing and full-bleed banding collapse.
 * @param {Element} main the page root
 * @param {Document} document the source document
 */
const addSectionBreaks = (main, document) => {
  const tables = [...main.querySelectorAll('table')]
    .filter((t) => !t.parentElement.closest('table'));

  tables.forEach((table, i) => {
    if (i === 0) return;

    // a heading directly above the table introduces it; keep them together
    let anchor = table;
    const prev = table.previousElementSibling;
    if (prev && /^H[1-6]$/.test(prev.tagName)) anchor = prev;

    anchor.parentElement.insertBefore(document.createElement('hr'), anchor);
  });
};

/**
 * The source page carries the same copy in both `description` and
 * `og:description`, which createMetadata concatenates. Collapse the repeat.
 * @param {Element} main the page root, after createMetadata has appended the table
 */
const dedupeMetadata = (main) => {
  // createMetadata returns the data object and appends the table itself
  const table = [...main.querySelectorAll('table')]
    .find((t) => t.querySelector('th, td')?.textContent.trim() === 'Metadata');
  if (!table) return;
  table.querySelectorAll('tr').forEach((tr) => {
    const value = tr.children[1];
    if (!value) return;
    const text = value.textContent.trim();
    const half = Math.floor(text.length / 2);
    const a = text.slice(0, half).replace(/[,\s]+$/, '');
    const b = text.slice(half).replace(/^[,\s]+/, '');
    if (a && a === b) value.textContent = a;
  });
};

/* -------------------------------------------------------------------------- */

export default {
  transform: ({ document, url, params }) => {
    const nav = buildNavDocument(document);
    const footer = buildFooterDocument(document);

    const main = document.querySelector('.root.container') || document.body;

    transformHero(main, document);
    transformStats(main, document);
    transformIntroColumns(main, document);
    transformInsightCards(main, document);
    transformFeature(main, document);
    transformDisclaimer(main, document);

    // chrome that now lives in /nav and /footer, plus non-content noise
    WebImporter.DOMUtils.remove(main, [
      'header',
      'footer',
      '.cmp-header',
      '.cmp-footer',
      '.experiencefragment .cmp-experiencefragment--header',
      '.experiencefragment .cmp-experiencefragment--footer',
      'script',
      'noscript',
      'style',
      '#ppm-overlay',
    ]);

    addSectionBreaks(main, document);

    WebImporter.rules.createMetadata(main, document);
    dedupeMetadata(main);
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
