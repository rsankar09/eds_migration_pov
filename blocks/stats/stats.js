import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Splits a stat value into an optional leading glyph, the numerals, and an
 * optional trailing glyph, so "$95" and "53%" can be typeset like the source
 * design (affixes set smaller than the numerals).
 * @param {string} value the authored value, e.g. "$95" or "53%"
 * @returns {{prefix: string, number: string, suffix: string}}
 */
function splitValue(value) {
  const match = value.trim().match(/^(\D*?)([\d.,]+)(\D*)$/);
  if (!match) return { prefix: '', number: value.trim(), suffix: '' };
  const [, prefix, number, suffix] = match;
  return { prefix, number, suffix };
}

/**
 * Builds the value element, wrapping any affixes in their own spans.
 * @param {Element} cell the authored value cell
 * @returns {Element} the decorated value element
 */
function buildValue(cell) {
  const { prefix, number, suffix } = splitValue(cell.textContent);
  const p = document.createElement('p');
  p.className = 'stats-value';
  if (prefix) {
    const span = document.createElement('span');
    span.className = 'stats-affix stats-prefix';
    span.textContent = prefix;
    p.append(span);
  }
  p.append(document.createTextNode(number));
  if (suffix) {
    const span = document.createElement('span');
    span.className = 'stats-affix stats-suffix';
    span.textContent = suffix;
    p.append(span);
  }
  return p;
}

/**
 * loads and decorates the block
 *
 * Authoring contract: one row per statistic, first cell the value, second cell
 * the label. A row with a single cell starts a new group and is rendered as
 * that group's left-hand heading.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const groups = [];
  let current = null;

  const startGroup = (labelCell) => {
    const group = document.createElement('div');
    group.className = 'stats-group';
    if (labelCell) {
      group.classList.add('stats-group-labelled');
      const label = document.createElement('p');
      label.className = 'stats-group-label';
      label.append(...labelCell.childNodes);
      group.append(label);
    }
    const list = document.createElement('ul');
    list.className = 'stats-list';
    group.append(list);
    groups.push(group);
    current = list;
    return group;
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    // a single-cell row is a group heading, not a statistic
    if (cells.length < 2) {
      const group = startGroup(cells[0]);
      moveInstrumentation(row, group);
      return;
    }

    if (!current) startGroup(null);

    const li = document.createElement('li');
    li.className = 'stats-item';
    moveInstrumentation(row, li);

    li.append(buildValue(cells[0]));

    const label = document.createElement('p');
    label.className = 'stats-label';
    label.append(...cells[1].childNodes);
    li.append(label);

    current.append(li);
  });

  block.replaceChildren(...groups);
}
