// Renders the shopkeeper GLB models (public/models) into the sprite sheets and
// portraits the game ships (public/avatars). Needs the Vite dev server:
//   npm run dev -- --port 5199   then   node scripts/render-avatars.cjs
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
for (const name of ['male', 'female']) {
  const url = `/models/${name}.glb`;
  const sheet = await page.evaluate(([u]) => window.renderSheet(u, 96), [url]);
  save(`public/avatars/${name}.png`, sheet.png);
  save(`public/avatars/${name}-portrait.png`, await page.evaluate(([u]) => window.renderPortrait(u, 384), [url]));
  console.log(name, JSON.stringify(sheet.info), 'hips bone:', sheet.hips);
}
await browser.close();
})();
