#!/usr/bin/env node
/**
 * eds-component-detect — crop component screenshots from a full-page capture.
 *
 * Usage: node crop.js <inventory.json> <screenshot.png> <outDir>
 * Reads each entry's bounding_rect and writes <outDir>/<id>.png.
 * Site-agnostic; clamps rects to image bounds.
 */
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [, , invPath, shotPath, outDir] = process.argv;
if (!invPath || !shotPath || !outDir) {
  console.error('Usage: node crop.js <inventory.json> <screenshot.png> <outDir>');
  process.exit(1);
}

const inv = JSON.parse(await readFile(invPath, 'utf8'));
await mkdir(outDir, { recursive: true });
const meta = await sharp(shotPath).metadata();

for (const c of inv) {
  const r = c.bounding_rect;
  const left = Math.max(0, Math.round(r.x));
  const top = Math.max(0, Math.round(r.y));
  const width = Math.min(Math.round(r.w), meta.width - left);
  const height = Math.min(Math.round(r.h), meta.height - top);
  if (width <= 0 || height <= 0) {
    console.log(`  skip ${c.id} (out of bounds)`);
    continue;
  }
  const out = path.join(outDir, `${c.id}.png`);
  // Downscale wide crops so review thumbnails stay small.
  await sharp(shotPath)
    .extract({ left, top, width, height })
    .resize({ width: Math.min(width, 900), withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ${c.id} → ${out} (${width}x${height})`);
}
console.log(`\nWrote ${inv.length} crop(s) to ${outDir}`);
