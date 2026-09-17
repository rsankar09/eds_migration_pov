import { decorateIcons } from '../../scripts/aem.js';
import { decorateCta, moveInstrumentation } from '../../scripts/scripts.js';

const ICON_TOKEN = /^[a-z][a-z0-9-]*$/;

/**
 * Resolves a row's icon cell into a hydrateable icon span.
 *
 * The model's `icon` field is a select, so the cell holds a bare token
 * (`map-marker`) rather than `:map-marker:` markup. A document author writing
 * the token form will already have been through decorateIcons(), so an
 * existing span is reused as-is.
 *
 * @param {Element} cell A candidate icon cell
 * @returns {Element|null} The icon span, or null if this isn't an icon cell
 */
function resolveIcon(cell) {
  const existing = cell.querySelector('span.icon');
  if (existing) return existing;

  const token = cell.textContent.trim().toLowerCase();
  if (!ICON_TOKEN.test(token) || cell.querySelector('a, h1, h2, h3, h4, h5, h6')) return null;

  const span = document.createElement('span');
  span.className = `icon icon-${token}`;
  return span;
}

/**
 * Chooses the desktop column count for a given number of items.
 *
 * The divider is a border-left on every item except a row's first, so the row
 * width has to be expressible in CSS. `auto-fit` made it depend on the
 * container width, which a selector cannot introspect — so with 4+ items the
 * rule also drew down the first item of a wrapped row. Fixing the count here
 * lets the CSS address row starts with :nth-child().
 *
 * Prefers 3 across, dropping to 2 when that avoids a lone orphan on the last
 * row (4 items read better as 2x2 than as 3+1).
 *
 * @param {number} count The number of items
 * @returns {number} The column count to render at desktop
 */
function columnsFor(count) {
  if (count <= 3) return count;
  if (count % 3 === 0) return 3;
  if (count % 2 === 0) return 2;
  return 3;
}

/**
 * Turns an item's heading into the link, for the `cards` variant.
 *
 * The source's gradient card has no pill: where a card is linked, the title
 * itself carries the href (underlined). The authored anchor is reused rather
 * than replaced so its instrumentation survives and the field stays editable;
 * only its visible text changes, which makes the item's CTA *label* field
 * inert in this variant — the heading supplies the text.
 *
 * @param {Element} copy The item's copy container
 */
function linkHeading(copy) {
  const link = copy.querySelector('a[href]');
  const heading = copy.querySelector('h2, h3, h4, h5, h6');
  if (!link || !heading) return;

  link.textContent = '';
  while (heading.firstChild) link.append(heading.firstChild);
  const wrapper = link.closest('p');
  heading.append(link);
  if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
  link.title = link.title || link.textContent.trim();
}

/**
 * loads and decorates the block
 *
 * A pure collection: one row per item, each row an icon cell followed by a
 * copy cell. Rows become list items so the pair reads as a list to assistive
 * technology. The icon is decorative — decorateIcons() emits alt="" — so the
 * heading carries the accessible name.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cards = block.classList.contains('cards');
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);

    const copy = document.createElement('div');
    copy.className = 'icon-feature-copy';
    let icon = null;

    [...row.children].forEach((cell) => {
      const resolved = !icon ? resolveIcon(cell) : null;
      if (resolved) {
        icon = resolved;
        return;
      }
      while (cell.firstElementChild) copy.append(cell.firstElementChild);
    });

    if (icon) {
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'icon-feature-icon';
      iconWrapper.append(icon);
      li.append(iconWrapper);
    }

    if (cards) linkHeading(copy); else decorateCta(copy, 'secondary');
    li.append(copy);
    ul.append(li);
  });

  block.replaceChildren(ul);
  if (ul.children.length) block.dataset.columns = columnsFor(ul.children.length);
  decorateIcons(block);
}
