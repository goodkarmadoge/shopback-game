// Renders the companion GLB models (assets-src/pets) into sprite strips and portraits
// (public/pets). Needs the Vite dev server:
//   npm run dev -- --port 5199   then   node scripts/render-pets.cjs
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');

const base = process.env.BASE ?? 'http://localhost:5199';
const save = (path, dataUrl) => writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${base}/tools/render-avatar.html`);
  await page.waitForFunction('window.ready');
  for (const name of ['cat', 'dog']) {
    const url = `/assets-src/pets/${name}.glb`;
    const strip = await page.evaluate(([u]) => window.renderTurn(u, 80, 30), [url]);
    save(`public/pets/${name}.png`, strip.png);
    save(`public/pets/${name}-portrait.png`, await page.evaluate(([u]) => window.renderPortrait(u, 384), [url]));
    console.log(name, JSON.stringify(strip.size));
  }
  await browser.close();
})();
