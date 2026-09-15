import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const ACCENTS = ['plum', 'coral', 'charcoal', 'tan'];
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Sorts a row's cells into the four roles the model defines.
 *
 * Cells are classified by content rather than position so that an unauthored
 * image or accent doesn't shift the ones that follow. The accent arrives as an
 * item-level `classes` cell — xwalk renders item variants as a cell, not a
 * header — which is consumed here and never rendered.
 *
 * @param {Element} row One authored card row
 * @returns {{image: Element, copy: Element, links: Element, accent: string}}
 */
function classifyCells(row) {
  const parts = {
    image: null, copy: null, links: null, accent: '',
  };

  [...row.children].forEach((cell) => {
    if (cell.querySelector('picture, img')) {
      parts.image = cell;
      return;
    }

    const token = cell.textContent.trim().toLowerCase().replace(/^accent-/, '');
    if (!parts.accent && ACCENTS.includes(token) && !cell.querySelector('a')) {
      parts.accent = token;
      return;
    }

    if (cell.querySelector('a[href]') && !cell.querySelector(HEADINGS)) {
      parts.links = cell;
      return;
    }

    if (cell.textContent.trim() || cell.childElementCount) parts.copy = cell;
  });

  return parts;
}

/**
 * loads and decorates the block
 *
 * One row per card. Cards become list items so the grid reads as a list.
 *
 * Link labels repeated across cards — three cards legitimately say "Learn
 * more" — are an ambiguous-link failure, so those get an accessible name
 * derived from the product name. Labels that are already unique are left
 * alone: naming them "MarketProtector Suite about Spread-based products"
 * would be worse than the problem. Derived names keep the visible label as
 * their prefix, so WCAG 2.5.3 Label in Name still holds.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  // count labels up front; a label is only ambiguous relative to its siblings
  const labelCounts = new Map();
  block.querySelectorAll('a[href]').forEach((a) => {
    const label = a.textContent.trim().toLowerCase();
    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  });

  [...block.children].forEach((row) => {
    const {
      image, copy, links, accent,
    } = classifyCells(row);

    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'product-card';
    if (accent) li.classList.add(`accent-${accent}`);

    if (image) {
      image.className = 'product-card-image';
      li.append(image);
    }

    if (copy) {
      copy.className = 'product-card-body';
      const heading = copy.querySelector(HEADINGS);
      const first = copy.firstElementChild;

      // an eyebrow is any copy that precedes the product name; card 4 has none,
      // and the name must then sit flush to the image
      if (heading && first && first !== heading && first.tagName === 'P') {
        first.classList.add('product-card-eyebrow');
      }

      li.append(copy);

      if (links) {
        const name = heading ? heading.textContent.trim() : '';
        links.querySelectorAll('a[href]').forEach((a) => {
          const label = a.textContent.trim();
          if (name && label && labelCounts.get(label.toLowerCase()) > 1) {
            a.setAttribute('aria-label', `${label} about ${name}`);
          }
          a.title = a.title || label;
        });
      }
    }

    if (links) {
      links.className = 'product-card-links';
      li.append(links);
    }

    ul.append(li);
  });

  // the source image is a 306x94 strip — deliberately not the cards 4/3 crop
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
