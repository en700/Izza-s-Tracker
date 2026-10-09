// Renders the home-screen icons from public/favicon.svg with the Chromium that
// Playwright uses:  node tools/make_icons.mjs  (needs `playwright-core`).
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
// Full-bleed square (iOS and launchers round the corners themselves).
const square = inner.replace('<rect width="32" height="32" rx="8" fill="#3b5bdb"/>', '');
const art = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  <rect width="32" height="32" fill="#3b5bdb"/><g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${square}</g></svg>`;
const out = [
  ['public/apple-touch-icon.png', 180, art(1)],
  ['public/icons/icon-192.png', 192, art(1)],
  ['public/icons/icon-512.png', 512, art(1)],
  ['public/icons/icon-maskable-512.png', 512, art(0.78)], // keep the tooth inside the maskable safe zone
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
for (const [file, size, markup] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style>${markup}`);
  await page.screenshot({ path: new URL('../' + file, import.meta.url).pathname, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}
await browser.close();
