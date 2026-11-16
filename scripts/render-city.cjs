// Renders City props and buildings (GLB files in assets-src/city, decoded from the
// operation-merlion repo's models2/*.json) into sprites in public/city.
// Needs the Vite dev server:  npm run dev -- --port 5199   then   node scripts/render-city.cjs
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');

const base = process.env.BASE ?? 'http://localhost:5199';
// name: [pixels per metre (sprites are drawn at half size in the 360-wide world), yaw]
const PROPS = {
  shophouse_pink: [44, 0], shophouse_mint: [44, 0], shophouse_peach: [44, 0], shophouse_blue: [44, 0],
  shophouse_lilac: [44, 0], shophouse_yellow: [44, 0],
  hdb_a: [26, 0], hdb_c: [26, 0], office_a: [26, 0], office_c: [26, 0],
  palm: [40, 0], round_tree: [40, 0], bush: [44, 0], flowers: [44, 0], lamp: [44, 0],
  crate: [44, 20], barrel: [44, 0], traffic_cone: [44, 0], checkpoint: [40, 0],
  merlion: [56, 0], mbs: [24, 0], supertree: [36, 0],
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${base}/tools/render-avatar.html`);
  await page.waitForFunction('window.ready');
  const manifest = {};
  for (const [name, [ppm, yaw]] of Object.entries(PROPS)) {
    const r = await page.evaluate(([u, p, y]) => window.renderProp(u, p, y, 40), [`/assets-src/city/${name}.glb`, ppm, yaw]);
    writeFileSync(`public/city/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    manifest[name] = [r.w, r.h];
  }
  console.log(JSON.stringify(manifest));
  await browser.close();
})();
