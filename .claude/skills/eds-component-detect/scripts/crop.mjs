#!/usr/bin/env node
/* eslint-disable no-console, no-await-in-loop, no-restricted-syntax, no-continue, max-len,
   import/no-extraneous-dependencies */
// Node tooling script, not block code — Airbnb rules relaxed deliberately.

/**
 * Crop each inventory component out of its page screenshot, so a reviewer can
 * see what they are approving instead of reading bounding boxes.
 *
 * Reads `inventory.json` at the capture root. Every entry needs `id`,
 * `crop_source` ({ page, breakpoint }) and `bounding_rect` ({ x, y, w, h }) —
 * the rect coordinates the crawler records are document-absolute at
 * deviceScaleFactor 1, so they map 1:1 onto the full-page screenshot.
 *
 * Usage:
 *   node crop.mjs [--capture capture] [--pad 8]
 */

import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const o = { capture: 'capture', pad: 8 };
  for (let i = 0; i < argv.length; i += 1) {
    const next = () => {
      i += 1;
      return argv[i];
    };
    if (argv[i] === '--capture') o.capture = next();
    else if (argv[i] === '--pad') o.pad = parseInt(next(), 10);
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const invPath = path.join(opts.capture, 'inventory.json');
  const inventory = JSON.parse(await readFile(invPath, 'utf-8'));
  let written = 0;

  for (const entry of inventory) {
    const src = entry.crop_source;
    const rect = entry.bounding_rect;
    if (!src || !rect) {
      console.log(`  – ${entry.id}: no crop_source/bounding_rect, skipped`);
      continue;
    }
    const bp = src.breakpoint || 1440;
    const shot = path.join(opts.capture, src.page, 'screenshots', `${bp}.png`);
    const outDir = path.join(opts.capture, src.page, 'crops');
    await mkdir(outDir, { recursive: true });
    const out = path.join(outDir, `${entry.id}.png`);

    const image = sharp(shot);
    const { width, height } = await image.metadata();
    const left = Math.max(0, Math.round(rect.x - opts.pad));
    const top = Math.max(0, Math.round(rect.y - opts.pad));
    const w = Math.min(width - left, Math.round(rect.w + opts.pad * 2));
    const h = Math.min(height - top, Math.round(rect.h + opts.pad * 2));
    if (w <= 0 || h <= 0) {
      console.log(`  – ${entry.id}: rect outside the screenshot, skipped`);
      continue;
    }

    await image.extract({
      left, top, width: w, height: h,
    }).toFile(out);
    entry.screenshot_crop = out;
    written += 1;
    console.log(`  ✓ ${entry.id.padEnd(10)} ${src.page}/${bp} ${w}x${h} → ${out}`);
  }

  await writeFile(invPath, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`\n${written}/${inventory.length} crops written; inventory.json updated with crop paths`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
