// Painted backdrops for the shop, the dungeon and the city ground. Drawn in code at
// twice the world resolution (720x1280 for a 360x640 world), in a 3/4 top-down view:
// walls show a front face and a cap, things cast shadows, and light pools on the floor.

import { ART } from './art';

type Ctx = CanvasRenderingContext2D;

function board(key: string, w = 360, h = 640): Ctx {
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * 2;
  const ctx = cv.getContext('2d')!;
  ctx.scale(2, 2);
  ART[key] = cv;
  return ctx;
}

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
function tone(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

const rect = (c: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) => {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
};

function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, ...stops: [number, string][]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
}

function pool(c: Ctx, x: number, y: number, r: number, inner: string, outer: string, squash = 1) {
  c.save();
  c.translate(x, y);
  c.scale(1, squash);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Soft contact shadow under an object. */
const contact = (c: Ctx, x: number, y: number, r: number, a = 0.35) => pool(c, x, y, r, `rgba(0,0,0,${a})`, 'rgba(0,0,0,0)', 0.42);

function vignette(c: Ctx, x: number, y: number, w: number, h: number, strength: number, tint = '4,6,16') {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const g = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.42, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, `rgba(${tint},0)`);
  g.addColorStop(1, `rgba(${tint},${strength})`);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.restore();
}

// ---------------------------------------------------------------------------------
// Shop: warm timber room, afternoon light through two windows
// ---------------------------------------------------------------------------------

function buildShop() {
  const c = board('shop_bg');
  const r = rng(11);

  // street outside
  rect(c, 0, 518, 360, 122, '#cbb48a');
  for (let y = 524; y < 640; y += 13) {
    for (let x = ((y / 13) % 2) * 9 - 9; x < 360; x += 18) {
      const col = tone('#cdb58b', (r() - 0.5) * 0.22);
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(x + 0.7, y + 0.7, 16.6, 11.6, 2.5);
      c.fill();
      rect(c, x + 2, y + 1.2, 13, 0.8, 'rgba(255,255,255,0.18)');
    }
  }
  rect(c, 0, 518, 360, 26, linear(c, 0, 518, 0, 544, [0, 'rgba(60,30,10,0.45)'], [1, 'rgba(60,30,10,0)']));

  // floorboards
  rect(c, 16, 100, 328, 404, '#d39a57');
  for (let y = 100; y < 504; y += 13) {
    let x = 16 - r() * 60;
    while (x < 344) {
      const w = 46 + r() * 54;
      const base = tone('#d69c58', (r() - 0.5) * 0.2);
      rect(c, x, y, w, 13, base);
      rect(c, x, y, w, 1, 'rgba(255,236,190,0.28)');
      rect(c, x, y + 12, w, 1, 'rgba(92,48,18,0.5)');
      rect(c, x + w - 0.8, y, 0.8, 13, 'rgba(92,48,18,0.55)');
      for (let k = 0; k < 3; k++) rect(c, x + 3 + r() * (w - 8), y + 2 + r() * 9, 6 + r() * 16, 0.5, 'rgba(110,62,24,0.22)');
      rect(c, x + w - 3.5, y + 3, 1, 1, 'rgba(70,36,14,0.6)');
      rect(c, x + w - 3.5, y + 9, 1, 1, 'rgba(70,36,14,0.6)');
      x += w;
    }
  }
  c.clearRect(0, 0, 16, 640);
  c.clearRect(344, 0, 16, 640);

  // rug with a woven border
  contact(c, 180, 404, 150, 0.28);
  c.fillStyle = '#2f6f66';
  c.beginPath();
  c.roundRect(50, 208, 260, 198, 5);
  c.fill();
  rect(c, 55, 213, 250, 188, '#4a9486');
  rect(c, 61, 219, 238, 176, '#337a6f');
  rect(c, 65, 223, 230, 168, '#5fae9c');
  for (let x = 69; x < 292; x += 12) {
    for (const y of [226, 384]) {
      c.fillStyle = '#e9d9a6';
      c.beginPath();
      c.moveTo(x + 4, y);
      c.lineTo(x + 8, y + 2.5);
      c.lineTo(x + 4, y + 5);
      c.lineTo(x, y + 2.5);
      c.fill();
    }
  }
  for (let x = 52; x < 308; x += 4) {
    rect(c, x, 204, 1.4, 4, '#e9d9a6');
    rect(c, x, 406, 1.4, 4, '#e9d9a6');
  }
  rect(c, 65, 223, 230, 168, linear(c, 0, 223, 0, 391, [0, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,30,30,0.16)']));

  // back wall: front face in timber panelling, with a beam and skirting
  rect(c, 0, 0, 360, 100, linear(c, 0, 0, 0, 100, [0, '#8a4a2c'], [1, '#6a361f']));
  for (let x = 0; x < 360; x += 15) {
    rect(c, x, 12, 15, 82, tone('#8f4d2e', (r() - 0.5) * 0.14));
    rect(c, x, 12, 0.8, 82, 'rgba(40,16,6,0.55)');
    rect(c, x + 1, 12, 0.8, 82, 'rgba(255,200,150,0.12)');
  }
  rect(c, 0, 0, 360, 12, linear(c, 0, 0, 0, 12, [0, '#b06a40'], [1, '#7c4025']));
  rect(c, 0, 11, 360, 1.5, 'rgba(30,10,4,0.6)');
  rect(c, 0, 92, 360, 8, linear(c, 0, 92, 0, 100, [0, '#5a2c18'], [1, '#3c1a0c']));
  rect(c, 0, 12, 360, 82, linear(c, 0, 12, 0, 94, [0, 'rgba(0,0,0,0.28)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.18)']));

  // windows, and the light they throw across the floor
  for (const x of [34, 278]) {
    rect(c, x - 3, 26, 54, 50, '#4a2414');
    rect(c, x, 29, 48, 44, linear(c, 0, 29, 0, 73, [0, '#fff6c9'], [1, '#ffd98a']));
    rect(c, x + 22.5, 29, 3, 44, '#4a2414');
    rect(c, x, 49.5, 48, 3, '#4a2414');
    rect(c, x - 5, 75, 58, 4, '#b06a40');
    rect(c, x - 5, 79, 58, 2, 'rgba(0,0,0,0.35)');
    const lean = x < 180 ? 46 : -46;
    const g = c.createLinearGradient(0, 100, 0, 330);
    g.addColorStop(0, 'rgba(255,232,160,0.36)');
    g.addColorStop(1, 'rgba(255,232,160,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 2, 100);
    c.lineTo(x + 50, 100);
    c.lineTo(x + 50 + lean + 40, 330);
    c.lineTo(x - 2 + lean - 20, 330);
    c.fill();
  }

  // wall shelves with wares
  const jars = ['#35c8e8', '#f2c14e', '#c65ad9', '#6ddc8c', '#ff7a59', '#e9e3d0'];
  for (const sx of [104, 190]) {
    for (const sy of [38, 66]) {
      rect(c, sx, sy + 9, 66, 5, 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 5; i++) {
        const jx = sx + 4 + i * 12.5;
        const jh = 9 + r() * 7;
        const col = jars[Math.floor(r() * jars.length)];
        c.fillStyle = col;
        c.beginPath();
        c.roundRect(jx, sy - jh, 8, jh, 2);
        c.fill();
        rect(c, jx + 1.2, sy - jh + 1.5, 1.5, jh - 3, 'rgba(255,255,255,0.45)');
        rect(c, jx + 1.5, sy - jh - 1.6, 5, 2, '#5a2c18');
      }
      rect(c, sx - 2, sy, 70, 3, '#c98552');
      rect(c, sx - 2, sy + 3, 70, 3.5, '#6e3a20');
    }
  }

  // shadow the back wall drops onto the floor
  rect(c, 16, 100, 328, 30, linear(c, 0, 100, 0, 130, [0, 'rgba(40,16,4,0.5)'], [1, 'rgba(40,16,4,0)']));

  // side walls (caps seen from above) and their shadow
  for (const x of [0, 344]) {
    rect(c, x, 0, 16, 520, linear(c, x, 0, x + 16, 0, [0, '#6a361f'], [0.5, '#8a4a2c'], [1, '#5a2c18']));
    rect(c, x + (x ? 0 : 15), 100, 1, 420, 'rgba(30,10,4,0.7)');
  }
  rect(c, 16, 100, 20, 404, linear(c, 16, 0, 36, 0, [0, 'rgba(40,16,4,0.42)'], [1, 'rgba(40,16,4,0)']));
  rect(c, 330, 100, 14, 404, linear(c, 330, 0, 344, 0, [0, 'rgba(40,16,4,0)'], [1, 'rgba(40,16,4,0.22)']));

  // front wall cap with the doorway
  for (const [x, w] of [[0, 146], [214, 146]] as const) {
    rect(c, x, 502, w, 18, linear(c, 0, 502, 0, 520, [0, '#9a5632'], [0.45, '#7c4025'], [1, '#4f2513']));
    rect(c, x, 502, w, 1.2, 'rgba(255,210,160,0.35)');
  }
  rect(c, 146, 502, 68, 18, '#b98f5c');
  rect(c, 146, 502, 3, 18, '#4f2513');
  rect(c, 211, 502, 3, 18, '#4f2513');
  rect(c, 16, 490, 328, 12, linear(c, 0, 490, 0, 502, [0, 'rgba(40,16,4,0)'], [1, 'rgba(40,16,4,0.3)']));
  // doormat
  c.fillStyle = '#b6402f';
  c.beginPath();
  c.roundRect(152, 478, 56, 20, 3);
  c.fill();
  rect(c, 156, 482, 48, 12, '#d6604c');
  rect(c, 160, 486, 40, 4, '#f0d9a0');

  // counter: top, front face, and a drop shadow
  rect(c, 92, 150, 176, 12, linear(c, 0, 150, 0, 162, [0, 'rgba(40,16,4,0.5)'], [1, 'rgba(40,16,4,0)']));
  c.fillStyle = '#3a1a0c';
  c.beginPath();
  c.roundRect(94, 112, 172, 40, 3);
  c.fill();
  rect(c, 96, 114, 168, 15, linear(c, 0, 114, 0, 129, [0, '#f0bd7e'], [1, '#d99a58']));
  rect(c, 96, 114, 168, 1.2, 'rgba(255,255,255,0.45)');
  rect(c, 96, 129, 168, 21, linear(c, 0, 129, 0, 150, [0, '#96522f'], [1, '#6a361f']));
  for (let x = 100; x < 262; x += 27) {
    rect(c, x, 132, 23, 15, 'rgba(50,20,8,0.35)');
    rect(c, x + 1, 133, 21, 13, '#8a4a2c');
    rect(c, x + 1, 133, 21, 1, 'rgba(255,200,150,0.25)');
  }
  // till and wares on the counter
  contact(c, 222, 124, 18, 0.3);
  rect(c, 208, 100, 28, 22, '#3a1a0c');
  rect(c, 210, 102, 24, 9, '#ffe9a8');
  rect(c, 210, 111, 24, 9, '#e0a93a');
  rect(c, 212, 104, 20, 3, '#6a7d4a');
  rect(c, 213, 113, 3, 2, '#fff');
  rect(c, 218, 113, 3, 2, '#fff');
  rect(c, 223, 113, 3, 2, '#fff');
  for (const [x, col] of [[108, '#c65ad9'], [122, '#35c8e8']] as const) {
    contact(c, x + 4, 123, 7, 0.3);
    c.fillStyle = col;
    c.beginPath();
    c.roundRect(x, 110, 8, 12, 2.5);
    c.fill();
    rect(c, x + 1.3, 112, 1.5, 8, 'rgba(255,255,255,0.5)');
  }

  // potted plants by the door
  for (const x of [34, 326]) {
    contact(c, x, 486, 16, 0.4);
    c.fillStyle = '#a4502c';
    c.beginPath();
    c.moveTo(x - 9, 468);
    c.lineTo(x + 9, 468);
    c.lineTo(x + 6.5, 486);
    c.lineTo(x - 6.5, 486);
    c.fill();
    rect(c, x - 10, 466, 20, 3.5, '#c46a40');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      pool(c, x + Math.cos(a) * 8, 456 + Math.sin(a) * 6, 7.5, i % 2 ? '#6cc070' : '#4f9a53', i % 2 ? '#4f9a53' : '#357a3d');
    }
    pool(c, x - 2, 452, 6, '#93dc8f', '#5fb565');
  }

  // warm ambient light and falloff into the corners
  pool(c, 180, 290, 230, 'rgba(255,226,160,0.16)', 'rgba(255,226,160,0)');
  vignette(c, 16, 100, 328, 404, 0.34, '50,20,6');
  vignette(c, 0, 518, 360, 122, 0.3, '40,22,8');
}

function buildTable() {
  // display table: top, front face, legs and a soft shadow (drawn at 2x, shown at half size)
  const cv = document.createElement('canvas');
  cv.width = 104;
  cv.height = 84;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  contact(c, 26, 35, 25, 0.42);
  rect(c, 5, 24, 4, 12, '#4f2513');
  rect(c, 43, 24, 4, 12, '#4f2513');
  c.fillStyle = '#3a1a0c';
  c.beginPath();
  c.roundRect(2, 3, 48, 27, 3);
  c.fill();
  rect(c, 3.5, 4.5, 45, 15, linear(c, 0, 4, 0, 20, [0, '#e7ad6c'], [1, '#cf8f4f']));
  rect(c, 3.5, 4.5, 45, 1, 'rgba(255,255,255,0.5)');
  rect(c, 3.5, 19.5, 45, 9, linear(c, 0, 19, 0, 29, [0, '#8a4a2c'], [1, '#63301a']));
  c.fillStyle = '#e9f3ea';
  c.beginPath();
  c.roundRect(8, 7, 36, 10, 2);
  c.fill();
  rect(c, 9.5, 8.5, 33, 7, '#9fd2b1');
  rect(c, 9.5, 8.5, 33, 1.2, 'rgba(255,255,255,0.5)');
  ART.table = cv;
}

function buildShadow() {
  const cv = document.createElement('canvas');
  cv.width = 56;
  cv.height = 24;
  const c = cv.getContext('2d')!;
  pool(c, 28, 12, 27, 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 0.42);
  ART.shadow = cv;
}

// ---------------------------------------------------------------------------------
// Techno Dungeon: an abandoned server mall. Cold teal floor plates, racks on the
// back wall, neon signage in the room's accent colour.
// ---------------------------------------------------------------------------------

function buildDungeon(room: number) {
  const c = board(`dungeon_bg_${room}`);
  const r = rng(31 + room * 7);
  const ac = ['#35e0ff', '#ff6ad5', '#ffb347'][room];
  const acRgb = ['53,224,255', '255,106,213', '255,179,71'][room];
  const F = { x: 22, y: 76, w: 316, h: 530 };

  rect(c, 0, 0, 360, 640, '#0b0c16');

  // floor plates
  rect(c, F.x, F.y, F.w, F.h, '#173a40');
  const T = 26.33;
  for (let ty = 0; ty * T < F.h; ty++) {
    for (let tx = 0; tx < 12; tx++) {
      const x = F.x + tx * T;
      const y = F.y + ty * T;
      const v = r();
      const base = tone(v > 0.9 ? '#1c3248' : '#1b444a', (r() - 0.5) * 0.26);
      rect(c, x, y, T, T, base);
      rect(c, x, y, T, 0.9, 'rgba(150,240,230,0.13)');
      rect(c, x, y, 0.9, T, 'rgba(150,240,230,0.08)');
      rect(c, x, y + T - 1, T, 1, 'rgba(2,10,14,0.6)');
      rect(c, x + T - 1, y, 1, T, 'rgba(2,10,14,0.5)');
      if (v > 0.9) {
        // inspection plate with bolts and a status light
        for (const [bx, by] of [[3, 3], [T - 4, 3], [3, T - 4], [T - 4, T - 4]]) rect(c, x + bx, y + by, 1.2, 1.2, 'rgba(180,220,240,0.5)');
        rect(c, x + 7, y + 7, T - 14, T - 14, 'rgba(4,12,20,0.5)');
        pool(c, x + T / 2, y + T / 2, 9, `rgba(${acRgb},0.5)`, `rgba(${acRgb},0)`);
        rect(c, x + T / 2 - 1.5, y + T / 2 - 1.5, 3, 3, ac);
      } else if (v < 0.16) {
        // a crack
        c.strokeStyle = 'rgba(2,10,14,0.55)';
        c.lineWidth = 0.7;
        c.beginPath();
        let px = x + 3 + r() * 8;
        let py = y + 2;
        c.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += (r() - 0.3) * 8;
          py += 4 + r() * 4;
          c.lineTo(px, py);
        }
        c.stroke();
      }
    }
  }
  // grime
  for (let i = 0; i < 26; i++) pool(c, F.x + r() * F.w, F.y + r() * F.h, 14 + r() * 26, 'rgba(4,14,18,0.3)', 'rgba(4,14,18,0)', 0.6 + r() * 0.5);

  // cable trenches with a live line
  for (const y of [F.y + T * 6, F.y + T * 14]) {
    rect(c, F.x, y - 3, F.w, 6, '#0c1c24');
    rect(c, F.x, y - 3, F.w, 1, 'rgba(0,0,0,0.6)');
    rect(c, F.x, y + 2, F.w, 1, 'rgba(150,240,230,0.12)');
    rect(c, F.x, y - 0.5, F.w, 1, `rgba(${acRgb},0.75)`);
    rect(c, F.x, y - 4, F.w, 8, linear(c, 0, y - 4, 0, y + 4, [0, `rgba(${acRgb},0)`], [0.5, `rgba(${acRgb},0.16)`], [1, `rgba(${acRgb},0)`]));
  }
  if (room === 2) {
    // the vault's floor seal
    c.lineWidth = 2;
    for (const [rad, a] of [[62, 0.5], [50, 0.25], [30, 0.4]] as const) {
      c.strokeStyle = `rgba(${acRgb},${a})`;
      c.beginPath();
      c.ellipse(180, 300, rad, rad * 0.86, 0, 0, Math.PI * 2);
      c.stroke();
    }
    pool(c, 180, 300, 70, `rgba(${acRgb},0.16)`, `rgba(${acRgb},0)`, 0.86);
  }

  // wall caps, seen from above
  const cap = (x: number, y: number, w: number, h: number) => {
    rect(c, x, y, w, h, '#2b3350');
    rect(c, x, y, w, h, linear(c, x, y, x + (w > h ? 0 : w), y + (w > h ? h : 0), [0, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.3)']));
  };
  cap(6, 14, 16, 608);
  cap(338, 14, 16, 608);
  cap(6, 606, 348, 16);
  cap(6, 14, 348, 16);
  for (let y = 40; y < 610; y += 38) {
    rect(c, 12, y, 4, 4, '#1a1f36');
    rect(c, 344, y, 4, 4, '#1a1f36');
    rect(c, 12.8, y + 0.8, 1.4, 1.4, 'rgba(255,255,255,0.3)');
    rect(c, 344.8, y + 0.8, 1.4, 1.4, 'rgba(255,255,255,0.3)');
  }
  rect(c, 21, 76, 1, 530, `rgba(${acRgb},0.55)`);
  rect(c, 338, 76, 1, 530, `rgba(${acRgb},0.55)`);
  rect(c, 22, 605, 316, 1, `rgba(${acRgb},0.55)`);

  // back wall front face: server racks either side of the exit
  rect(c, 22, 30, 316, 46, linear(c, 0, 30, 0, 76, [0, '#2a3252'], [1, '#141829']));
  for (let i = 0; i < 8; i++) {
    const x = 22 + i * 39.5;
    rect(c, x, 30, 0.8, 46, 'rgba(0,0,0,0.5)');
    if (i === 3 || i === 4) continue;
    rect(c, x + 5, 35, 29.5, 36, '#090b16');
    rect(c, x + 5, 35, 29.5, 1, 'rgba(255,255,255,0.14)');
    for (let ry = 38; ry < 69; ry += 5.2) {
      rect(c, x + 7.5, ry, 24.5, 3.6, '#1a2040');
      rect(c, x + 7.5, ry, 24.5, 0.7, 'rgba(255,255,255,0.1)');
      for (let k = 0; k < 4; k++) rect(c, x + 9 + k * 3, ry + 1.4, 1.6, 0.9, 'rgba(120,150,210,0.35)');
      const lit = r();
      const col = lit > 0.66 ? ac : lit > 0.33 ? '#6dff9c' : '#3a4270';
      rect(c, x + 28, ry + 1.1, 1.8, 1.4, col);
      if (lit > 0.33) pool(c, x + 28.9, ry + 1.8, 4, lit > 0.66 ? `rgba(${acRgb},0.5)` : 'rgba(109,255,156,0.4)', 'rgba(0,0,0,0)');
    }
  }
  // exit door
  rect(c, 146, 22, 68, 54, '#0a0c18');
  rect(c, 146, 22, 68, 54, linear(c, 146, 0, 214, 0, [0, `rgba(${acRgb},0.9)`], [0.06, `rgba(${acRgb},0)`], [0.94, `rgba(${acRgb},0)`], [1, `rgba(${acRgb},0.9)`]));
  rect(c, 146, 22, 68, 2.5, ac);
  rect(c, 152, 28, 56, 48, linear(c, 0, 28, 0, 76, [0, '#1d2444'], [1, '#10142a']));
  rect(c, 179.4, 28, 1.2, 48, '#05060c');
  for (let y = 34; y < 74; y += 8) {
    rect(c, 155, y, 21, 1, 'rgba(255,255,255,0.08)');
    rect(c, 184, y, 21, 1, 'rgba(255,255,255,0.08)');
  }
  rect(c, 176, 46, 8, 12, ac);
  pool(c, 180, 52, 20, `rgba(${acRgb},0.55)`, `rgba(${acRgb},0)`);
  rect(c, 22, 74, 316, 2, '#05060c');

  // shadows: the back wall and the left wall both fall across the floor
  rect(c, F.x, F.y, F.w, 44, linear(c, 0, F.y, 0, F.y + 44, [0, 'rgba(0,4,10,0.72)'], [1, 'rgba(0,4,10,0)']));
  rect(c, F.x, F.y, 26, F.h, linear(c, F.x, 0, F.x + 26, 0, [0, 'rgba(0,4,10,0.5)'], [1, 'rgba(0,4,10,0)']));
  rect(c, 322, F.y, 16, F.h, linear(c, 322, 0, 338, 0, [0, 'rgba(0,4,10,0)'], [1, 'rgba(0,4,10,0.28)']));
  rect(c, F.x, 590, F.w, 16, linear(c, 0, 590, 0, 606, [0, 'rgba(0,4,10,0)'], [1, 'rgba(0,4,10,0.35)']));

  // light: the door spills its colour, wall lamps pool on the floor, the centre is lifted
  c.save();
  c.beginPath();
  c.rect(F.x, F.y, F.w, F.h);
  c.clip();
  pool(c, 180, 80, 110, `rgba(${acRgb},0.34)`, `rgba(${acRgb},0)`, 0.8);
  for (const y of [210, 420]) {
    pool(c, 26, y, 74, `rgba(${acRgb},0.2)`, `rgba(${acRgb},0)`);
    pool(c, 334, y, 74, `rgba(${acRgb},0.2)`, `rgba(${acRgb},0)`);
  }
  pool(c, 180, 330, 250, 'rgba(120,240,225,0.11)', 'rgba(120,240,225,0)', 1.2);
  c.restore();
  for (const y of [210, 420]) {
    for (const x of [14, 346]) {
      rect(c, x - 3, y - 6, 6, 12, '#10142a');
      rect(c, x - 1.5, y - 4, 3, 8, ac);
      pool(c, x, y, 9, `rgba(${acRgb},0.6)`, `rgba(${acRgb},0)`);
    }
  }
  vignette(c, F.x, F.y, F.w, F.h, 0.62);
}

// ---------------------------------------------------------------------------------
// City ground: a waterfront plaza, a shophouse street and a park
// ---------------------------------------------------------------------------------

export const CITY_H = 900;

function buildCity() {
  const c = board('city_bg', 360, CITY_H);
  const r = rng(77);

  // bay water behind the skyline
  rect(c, 0, 0, 360, 200, linear(c, 0, 0, 0, 200, [0, '#5fc4d8'], [1, '#3a9fc0']));
  for (let i = 0; i < 70; i++) rect(c, r() * 360, 20 + r() * 170, 8 + r() * 18, 0.8, 'rgba(255,255,255,0.3)');

  // plaza of granite pavers
  rect(c, 0, 176, 360, 144, '#d9d2c2');
  for (let y = 176; y < 320; y += 12) {
    for (let x = ((y / 12) % 2) * 12 - 12; x < 360; x += 24) {
      rect(c, x + 0.5, y + 0.5, 23, 11, tone('#dcd5c5', (r() - 0.5) * 0.12));
      rect(c, x + 0.5, y + 0.5, 23, 0.8, 'rgba(255,255,255,0.35)');
    }
  }
  rect(c, 0, 176, 360, 5, '#f4efe2');
  rect(c, 0, 181, 360, 3, 'rgba(60,50,40,0.35)');

  // shophouse row stands on a five-foot way
  rect(c, 0, 320, 360, 150, '#c9b89a');
  for (let x = 0; x < 360; x += 15) rect(c, x, 440, 14, 29, tone('#cfa27a', (r() - 0.5) * 0.14));
  rect(c, 0, 468, 360, 3, '#8c7a62');

  // the street
  rect(c, 0, 471, 360, 84, linear(c, 0, 471, 0, 555, [0, '#4d5560'], [1, '#434a55']));
  for (let i = 0; i < 420; i++) rect(c, r() * 360, 472 + r() * 82, 1, 1, r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.14)');
  for (let x = 8; x < 360; x += 38) rect(c, x, 511, 20, 2.5, '#f2e9c8');
  rect(c, 0, 474, 360, 1.5, '#e9d24e');
  rect(c, 0, 551, 360, 1.5, '#e9d24e');
  // zebra crossing down to the park
  for (let y = 476; y < 550; y += 9) rect(c, 150, y, 60, 5, '#f4f1e6');
  rect(c, 0, 555, 360, 5, '#b9b2a2');
  rect(c, 0, 471, 360, 18, linear(c, 0, 471, 0, 489, [0, 'rgba(10,14,24,0.4)'], [1, 'rgba(10,14,24,0)']));

  // park
  rect(c, 0, 560, 360, CITY_H - 560, '#6fb46a');
  for (let i = 0; i < 90; i++) pool(c, r() * 360, 566 + r() * (CITY_H - 570), 14 + r() * 30, r() > 0.5 ? 'rgba(140,210,120,0.4)' : 'rgba(60,140,80,0.3)', 'rgba(0,0,0,0)', 0.6);
  for (let i = 0; i < 700; i++) {
    const x = r() * 360;
    const y = 564 + r() * (CITY_H - 566);
    rect(c, x, y, 0.8, 2.2, r() > 0.5 ? 'rgba(190,240,150,0.5)' : 'rgba(40,110,60,0.4)');
  }
  // path from the crossing to the old mall entrance
  c.strokeStyle = '#e4d6b4';
  c.lineWidth = 34;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(180, 560);
  c.bezierCurveTo(180, 660, 110, 680, 180, 800);
  c.stroke();
  c.strokeStyle = 'rgba(150,120,80,0.35)';
  c.lineWidth = 1;
  c.setLineDash([3, 5]);
  c.beginPath();
  c.moveTo(180, 560);
  c.bezierCurveTo(180, 660, 110, 680, 180, 800);
  c.stroke();
  c.setLineDash([]);

  // the stairwell down into the abandoned server mall
  contact(c, 180, 842, 62, 0.4);
  c.fillStyle = '#3c4258';
  c.beginPath();
  c.roundRect(132, 790, 96, 62, 6);
  c.fill();
  rect(c, 138, 796, 84, 50, '#12142a');
  for (let i = 0; i < 6; i++) rect(c, 142, 800 + i * 7.5, 76, 5.5, tone('#3a4470', -i * 0.14));
  rect(c, 138, 796, 84, 50, linear(c, 0, 796, 0, 846, [0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']));
  rect(c, 132, 790, 96, 3, '#35e0ff');
  pool(c, 180, 836, 44, 'rgba(53,224,255,0.45)', 'rgba(53,224,255,0)', 0.6);
  for (const x of [136, 224]) rect(c, x - 2, 780, 4, 74, '#f0b429');

  vignette(c, 0, 0, 360, CITY_H, 0.22, '20,30,50');
}

function buildPillar() {
  const cv = document.createElement('canvas');
  cv.width = 84;
  cv.height = 108;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  contact(c, 21, 46, 24, 0.5);
  rect(c, 1, 0, 40, 22, '#3a4468');
  rect(c, 1, 0, 40, 22, linear(c, 0, 0, 0, 22, [0, 'rgba(255,255,255,0.18)'], [1, 'rgba(0,0,0,0.1)']));
  rect(c, 1, 22, 40, 26, linear(c, 0, 22, 0, 48, [0, '#1c2238'], [1, '#0d1020']));
  for (let y = 25; y < 46; y += 5) {
    rect(c, 4, y, 34, 3.2, '#1a2040');
    rect(c, 33, y + 1, 2, 1.2, y % 10 ? '#35e0ff' : '#6dff9c');
  }
  rect(c, 1, 21, 40, 1, '#05060c');
  ART.pillar = cv;
}

// Cosmetic shop upgrades, each a transparent layer over the shop backdrop.
function buildDeco() {
  // polished wood finish: a deeper, glossier floor
  let c = board('deco_wood');
  rect(c, 16, 100, 328, 404, 'rgba(110, 44, 16, 0.34)');
  for (let y = 100; y < 504; y += 13) rect(c, 16, y + 1, 328, 2, 'rgba(255, 220, 170, 0.16)');
  for (let x = 40; x < 340; x += 70) rect(c, x, 100, 26, 404, linear(c, x, 0, x + 26, 0, [0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,240,210,0.13)'], [1, 'rgba(255,255,255,0)']));
  rect(c, 16, 100, 328, 30, linear(c, 0, 100, 0, 130, [0, 'rgba(40,16,4,0.3)'], [1, 'rgba(40,16,4,0)']));

  // fine carpet: crimson and gold over the old rug
  c = board('deco_carpet');
  c.fillStyle = '#7a1420';
  c.beginPath();
  c.roundRect(50, 208, 260, 198, 5);
  c.fill();
  rect(c, 55, 213, 250, 188, '#c9a23a');
  rect(c, 59, 217, 242, 180, '#a31c2c');
  rect(c, 65, 223, 230, 168, '#c4283a');
  for (let x = 72; x < 290; x += 22) {
    for (let y = 232; y < 384; y += 22) {
      c.fillStyle = 'rgba(233, 196, 90, 0.75)';
      c.beginPath();
      c.moveTo(x + 6, y);
      c.lineTo(x + 12, y + 6);
      c.lineTo(x + 6, y + 12);
      c.lineTo(x, y + 6);
      c.fill();
      rect(c, x + 5, y + 5, 2, 2, '#7a1420');
    }
  }
  for (let x = 52; x < 308; x += 4) {
    rect(c, x, 203, 1.6, 5, '#e9c45a');
    rect(c, x, 406, 1.6, 5, '#e9c45a');
  }
  rect(c, 65, 223, 230, 168, linear(c, 0, 223, 0, 391, [0, 'rgba(255,255,255,0.1)'], [1, 'rgba(40,0,10,0.2)']));

  // curtains on both windows
  c = board('deco_curtains');
  for (const x of [34, 278]) {
    rect(c, x - 7, 22, 62, 4, '#c98552');
    rect(c, x - 9, 21, 4, 6, '#e0a868');
    rect(c, x + 53, 21, 4, 6, '#e0a868');
    for (const side of [0, 1]) {
      const cx = side ? x + 34 : x - 5;
      for (let k = 0; k < 5; k++) rect(c, cx + k * 3.8, 26, 3.8, 52 - Math.abs(k - (side ? 4 : 0)) * 3, k % 2 ? '#d6455a' : '#b82e44');
      rect(c, cx, 26, 19, 3, 'rgba(255,255,255,0.25)');
      rect(c, cx + (side ? 0 : 11), 58, 8, 3, '#e9c45a');
    }
  }

  // string lights along the back wall, with a warm glow
  c = board('deco_lights');
  c.strokeStyle = '#3a1a0c';
  c.lineWidth = 0.8;
  const bulbs = ['#ffd84a', '#ff7a59', '#6ddc8c', '#35c8e8', '#ff6ad5'];
  for (let seg = 0; seg < 6; seg++) {
    const x0 = seg * 60;
    c.beginPath();
    c.moveTo(x0, 13);
    c.quadraticCurveTo(x0 + 30, 26, x0 + 60, 13);
    c.stroke();
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const bx = x0 + t * 60;
      const by = 13 + 13 * 2 * t * (1 - t) + 1.5;
      const col = bulbs[(seg * 3 + k) % bulbs.length];
      pool(c, bx, by + 1, 9, col + 'aa', col + '00');
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(bx, by + 1.5, 2, 2.8, 0, 0, Math.PI * 2);
      c.fill();
      rect(c, bx - 0.6, by, 0.9, 1.2, 'rgba(255,255,255,0.8)');
    }
  }
  pool(c, 180, 150, 220, 'rgba(255, 214, 120, 0.12)', 'rgba(255, 214, 120, 0)', 0.7);
}

export function buildScenery() {
  buildDeco();
  buildPillar();
  buildShop();
  buildTable();
  buildShadow();
  for (let i = 0; i < 3; i++) buildDungeon(i);
  buildCity();
}
