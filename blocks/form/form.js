import { moveInstrumentation } from '../../scripts/scripts.js';

const TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'submit'];

/**
 * Reads an item's cells into a field descriptor.
 *
 * The model deliberately gives each property its own top-level name rather
 * than a shared `field_` prefix: grouped names collapse into a single cell in
 * the editor, which would make the values unparseable, while ungrouped ones
 * become one cell each — the same shape a document author produces as columns.
 *
 * @param {Element} row One authored item row
 * @returns {{type: string, label: string, name: string, width: string}|null}
 */
function readField(row) {
  const cells = [...row.children].map((c) => c.textContent.trim());
  const type = (cells[0] || '').toLowerCase();
  if (!TYPES.includes(type)) return null;
  return {
    type,
    label: cells[1] || '',
    name: cells[2] || '',
    width: (cells[3] || '').toLowerCase() === 'half' ? 'half' : 'full',
  };
}

/**
 * loads and decorates the block
 *
 * One row per item. A row whose first cell is a known field type is a field;
 * anything else is the intro copy that sits beside the fields at desktop.
 *
 * The inputs are rendered natively rather than embedding a third-party form
 * script: the source uses a marketing-automation embed, and reproducing that
 * is an integration decision, not a block one. The markup here is a real,
 * labelled, submittable form with no endpoint wired up — see the block's
 * README note in the migration report.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const intro = document.createElement('div');
  intro.className = 'form-intro';
  const form = document.createElement('form');
  form.className = 'form-fields';
  form.setAttribute('novalidate', '');

  [...block.children].forEach((row) => {
    const field = readField(row);
    if (!field) {
      while (row.firstElementChild) intro.append(row.firstElementChild);
      return;
    }

    const wrapper = document.createElement('div');
    moveInstrumentation(row, wrapper);
    wrapper.className = `form-field form-field-${field.width}`;

    if (field.type === 'submit') {
      const button = document.createElement('button');
      button.type = 'submit';
      button.className = 'button';
      button.textContent = field.label || 'Submit';
      wrapper.append(button);
    } else {
      const id = `form-${field.name || field.label}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const control = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
      if (field.type !== 'textarea') control.type = field.type;
      control.id = id;
      control.name = field.name || id;
      control.placeholder = field.label;
      // the placeholder is not an accessible name, so every control keeps a
      // real label; it is visually hidden because the design has none
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.className = 'form-label';
      label.textContent = field.label;
      wrapper.append(label, control);
    }

    form.append(wrapper);
  });

  block.replaceChildren(...(intro.childElementCount ? [intro, form] : [form]));
}
