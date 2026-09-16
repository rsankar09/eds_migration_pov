import { createOptimizedPicture } from '../../scripts/aem.js';
import { decorateCta, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Publishes the image's own aspect ratio to the block as
 * `--feature-image-ratio`, so the stacked layout sizes the pane from the real
 * asset instead of a hardcoded crop.
 *
 * Preferred source is the width/height attributes, which the delivery pipeline
 * puts on every authored image and `createOptimizedPicture` then drops. Local
 * drafts and hand-written markup have no attributes, so those fall back to the
 * decoded image — one frame later, hence the attribute path first: reading the
 * attributes is synchronous and shifts nothing.
 *
 * @param {Element} block the block
 * @param {HTMLImageElement} img the image to measure
 */
function publishImageRatio(block, img) {
  const apply = (w, h) => {
    if (w > 0 && h > 0) block.style.setProperty('--feature-image-ratio', `${w} / ${h}`);
  };

  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  if (width && height) {
    apply(width, height);
    return;
  }

  if (img.complete && img.naturalWidth) {
    apply(img.naturalWidth, img.naturalHeight);
    return;
  }

  img.addEventListener('load', () => apply(img.naturalWidth, img.naturalHeight), { once: true });
}

/**
 * loads and decorates the block
 *
 * Takes an image cell and a copy cell, in either order. Either may be absent:
 * with no image the copy pane spans the full band, and with no copy the image
 * stands alone. The band background is a section style, not a block variant
 * (see capture/credit-union/content-model.md decision D-A).
 *
 * The number of *rows* those cells arrive in is deliberately not part of the
 * contract, because it differs per authoring surface. Universal Editor renders
 * one row per field group in the model — `image`/`imageAlt` in the first,
 * the `copy_*` group in the second — while document authoring puts both cells
 * in a single row. So classify cells and flatten them into one row, which
 * makes the 50/50 split a single flex container either way.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  // the author-facing default is image-right; apply it when no variant is set
  if (!block.classList.contains('image-left')) block.classList.add('image-right');

  const cells = [...block.querySelectorAll(':scope > div > div')];
  if (!cells.length) return;

  const row = document.createElement('div');
  cells.forEach((cell) => {
    if (cell.querySelector('picture, img')) {
      cell.classList.add('feature-image');
      row.append(cell);
    } else if (cell.textContent.trim() || cell.childElementCount) {
      cell.classList.add('feature-copy');
      row.append(cell);
    }
    // an unauthored slot is left behind rather than appended: an empty image
    // cell would otherwise hold open half the band
  });

  block.replaceChildren(row);

  // toggled, not just added: the editor re-runs decorate() after every change,
  // so an image added to a copy-only band has to clear this again
  block.classList.toggle('feature-no-image', !row.querySelector('.feature-image'));

  decorateCta(row.querySelector('.feature-copy'));

  row.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    const optimizedImg = optimized.querySelector('img');

    // createOptimizedPicture copies only src and alt, so carry the intrinsic
    // dimensions across: without them the browser has no ratio to reserve
    // space with, which is what the removed hardcoded crop was standing in for
    ['width', 'height'].forEach((attr) => {
      const value = img.getAttribute(attr);
      if (value) optimizedImg.setAttribute(attr, value);
    });

    moveInstrumentation(img, optimizedImg);
    img.closest('picture').replaceWith(optimized);
    publishImageRatio(block, optimizedImg);
  });
}
