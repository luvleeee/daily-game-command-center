// Renders public/icons/icon.svg into every PNG size the manifest / iOS needs.
// Usage: npm run icons   (re-run after editing icon.svg)
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];
for (const [name, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(name));
}

// Maskable: Android crops to a circle/squircle → keep the art inside the 80% safe zone.
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b0816' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-maskable-512.png'));

console.log('Icons generated in public/icons/');
