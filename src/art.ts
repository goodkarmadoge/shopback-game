// All art is original and drawn in code, so the prototype ships with no image files.
// Sprites are authored on a small grid and scaled 2x to 32x32 for a chunky pixel look.

type Px = (x: number, y: number, w: number, h: number, c: string) => void;

export const ART: Record<string, HTMLCanvasElement> = {};
const urls: Record<string, string> = {};

function make(key: string, w: number, h: number, scale: number, draw: (p: Px, ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const ctx = cv.getContext('2d')!;
  const p: Px = (x, y, pw, ph, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.round(pw * scale), Math.round(ph * scale));
  };
  draw(p, ctx);
  ART[key] = cv;
}

/** Data URL for use in DOM <img> tags. */
export function artUrl(key: string): string {
  return (urls[key] ??= ART[key].toDataURL());
}

const INK = '#2b1b2e';

interface Look {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  hat?: string;
  apron?: string;
  bag?: string;
}

function person(key: string, o: Look) {
  for (const f of [0, 1]) {
    make(`${key}_${f}`, 16, 16, 2, (p) => {
      const b = f; // bob on the walk frame
      // head
      p(4, 1 + b, 8, 9, INK);
      p(3, 2 + b, 10, 7, INK);
      p(4, 4 + b, 8, 5, o.skin);
      p(4, 2 + b, 8, 3, o.hair);
      p(3, 3 + b, 1, 3, o.hair);
      p(12, 3 + b, 1, 3, o.hair);
      if (o.hat) {
        p(3, 1 + b, 10, 2, o.hat);
        p(2, 3 + b, 12, 1, o.hat);
      }
      p(6, 6 + b, 1, 2, INK);
      p(9, 6 + b, 1, 2, INK);
      p(5, 8 + b, 1, 1, '#f2a48f');
      p(10, 8 + b, 1, 1, '#f2a48f');
      // body
      p(4, 10, 8, 4, INK);
      p(5, 10, 6, 3, o.shirt);
      p(3, 10, 1, 3, INK);
      p(12, 10, 1, 3, INK);
      p(3, 11, 1, 1, o.skin);
      p(12, 11, 1, 1, o.skin);
      if (o.apron) p(6, 10, 4, 3, o.apron);
      if (o.bag) {
        p(11, 10, 3, 4, INK);
        p(11, 11, 2, 2, o.bag);
      }
      // legs
      p(5, 13, 2, f ? 2 : 3, o.pants);
      p(9, 13, 2, f ? 3 : 2, o.pants);
    });
  }
}

function buildCharacters() {
  person('hero', { hair: '#5a3825', skin: '#f6cfa3', shirt: '#2f8f83', pants: '#3b3355', hat: '#e9573f', apron: '#f4e3c1' });
  person('cust_hunter', { hair: '#3a2a4a', skin: '#e8b88a', shirt: '#7aa63c', pants: '#4a3b2a', bag: '#d9a441' });
  person('cust_collector', { hair: '#d8d2e8', skin: '#f6cfa3', shirt: '#7b4bb3', pants: '#2e2a45', hat: '#4b2d7a' });
  person('cust_rusher', { hair: '#e0762a', skin: '#c98d62', shirt: '#e23f4f', pants: '#22324f' });
  person('ped_a', { hair: '#27314a', skin: '#f6cfa3', shirt: '#4a86c5', pants: '#5a4634' });
  person('ped_b', { hair: '#8a4b2d', skin: '#e8b88a', shirt: '#e8c547', pants: '#3b3355', hat: '#ffffff' });
}

function buildEnemies() {
  for (const f of [0, 1]) {
    make(`bot_${f}`, 16, 16, 2, (p) => {
      p(7, 0, 2, 2, '#ff5470');
      p(4, 1, 8, 6, INK);
      p(5, 2, 6, 4, '#9aa7b8');
      p(5, 3, 6, 2, '#1a1c2c');
      p(6 + f, 3, 2, 2, '#ff5470');
      p(9 + f, 3, 1, 2, '#ff5470');
      p(2, 6, 12, 8, INK);
      p(3, 7, 10, 6, '#6f7d92');
      p(3, 7, 10, 1, '#9aa7b8');
      p(6, 9, 4, 3, '#f2c14e');
      p(7, 10, 2, 1, INK);
      p(1, 8, 2, 4, '#4a5568');
      p(13, 8, 2, 4, '#4a5568');
      p(3 - f, 14, 4, 2, INK);
      p(9 + f, 14, 4, 2, INK);
    });
    make(`drone_${f}`, 16, 16, 2, (p) => {
      p(f ? 3 : 0, 3, f ? 10 : 16, 1, '#c8f7ff');
      p(7, 3, 2, 2, INK);
      p(3, 5, 10, 7, INK);
      p(4, 6, 8, 5, '#23395d');
      p(4, 6, 8, 1, '#3f6aa8');
      p(6, 7, 4, 3, '#0d0f1c');
      p(7, 8, 2, 1, '#ffe14d');
      p(2, 8, 1, 2, '#35e0ff');
      p(13, 8, 1, 2, '#35e0ff');
      p(6, 12, 4, 1, '#35e0ff');
      p(7, 13, 2, 1 + f, '#35e0ff');
    });
    make(`slime_${f}`, 16, 16, 2, (p) => {
      const y = f ? 2 : 0;
      p(3 - f, 6 + y, 10 + 2 * f, 9 - y, INK);
      p(5, 4 + y, 6, 2, INK);
      p(4 - f, 7 + y, 8 + 2 * f, 7 - y, '#c63fd9');
      p(6, 5 + y, 4, 2, '#c63fd9');
      p(5, 6 + y, 2, 2, '#f09cff');
      p(5, 9 + y, 2, 2, '#ffffff');
      p(9, 9 + y, 2, 2, '#ffffff');
      p(6, 10 + y, 1, 1, INK);
      p(10, 10 + y, 1, 1, INK);
      p(11, 7 + y, 2, 1, '#35e0ff');
      p(3, 12, 2, 1, '#6dff9c');
      p(12, 4 + y, 1, 1, '#35e0ff');
    });
    make(`guardian_${f}`, 24, 24, 2, (p) => {
      p(2, 2, 20, 20, INK);
      p(3, 3, 18, 18, '#3d4663');
      p(3, 3, 18, 2, '#5d6a91');
      p(3, 19, 18, 2, '#2a3049');
      p(0, 9 + f, 3, 8, INK);
      p(21, 9 + f, 3, 8, INK);
      p(0, 10 + f, 2, 6, '#5d6a91');
      p(22, 10 + f, 2, 6, '#5d6a91');
      p(5, 6, 4, 2, '#ff5470');
      p(15, 6, 4, 2, '#ff5470');
      p(6 + f, 6, 2, 2, '#ffd0d8');
      p(16 + f, 6, 2, 2, '#ffd0d8');
      // vault dial
      p(8, 10, 8, 8, INK);
      p(9, 11, 6, 6, '#f2c14e');
      p(11, 11, 2, 6, '#b8862e');
      p(9, 13, 6, 2, '#b8862e');
      p(11, 13, 2, 2, INK);
      p(4, 22, 5, 2, INK);
      p(15, 22, 5, 2, INK);
      p(4, 10, 2, 2, '#35e0ff');
      p(18, 10, 2, 2, '#35e0ff');
    });
  }
}

function buildItems() {
  make('item_gear', 16, 16, 2, (p) => {
    const t = '#8f9bb0';
    p(6, 1, 4, 14, INK);
    p(1, 6, 14, 4, INK);
    p(3, 3, 10, 10, INK);
    p(7, 2, 2, 12, t);
    p(2, 7, 12, 2, t);
    p(4, 4, 8, 8, '#b9c4d6');
    p(4, 4, 8, 1, '#e3eaf5');
    p(6, 6, 4, 4, INK);
    p(7, 7, 2, 2, '#6b4a2b');
  });
  make('item_cell', 16, 16, 2, (p) => {
    p(6, 1, 4, 2, INK);
    p(7, 1, 2, 1, '#c9d1dc');
    p(4, 3, 8, 12, INK);
    p(5, 4, 6, 10, '#39c46b');
    p(5, 4, 2, 10, '#7df0a2');
    p(5, 4, 6, 2, '#c9d1dc');
    p(8, 7, 2, 2, '#ffe14d');
    p(7, 9, 2, 2, '#ffe14d');
    p(8, 11, 1, 2, '#ffe14d');
  });
  make('item_gel', 16, 16, 2, (p) => {
    p(5, 2, 6, 3, INK);
    p(6, 3, 4, 1, '#d9a441');
    p(3, 5, 10, 10, INK);
    p(4, 6, 8, 8, '#c63fd9');
    p(4, 6, 8, 2, '#e9f6ff');
    p(5, 9, 2, 3, '#f09cff');
    p(9, 11, 2, 1, '#35e0ff');
    p(8, 9, 1, 1, '#6dff9c');
  });
  make('item_lens', 16, 16, 2, (p) => {
    p(4, 1, 8, 12, INK);
    p(2, 3, 12, 8, INK);
    p(4, 3, 8, 8, '#35e0ff');
    p(3, 4, 10, 6, '#35e0ff');
    p(5, 4, 6, 6, '#b8f5ff');
    p(6, 5, 2, 2, '#ffffff');
    p(9, 8, 1, 1, '#ff6ad5');
    p(7, 12, 2, 3, INK);
    p(5, 14, 6, 2, INK);
    p(6, 14, 4, 1, '#ff6ad5');
  });
  make('item_core', 16, 16, 2, (p) => {
    for (let dy = -6; dy <= 6; dy++) {
      const w = (6 - Math.abs(dy)) * 2 + 2;
      p(8 - w / 2 - 1, 8 + dy - 0.5, w + 2, 1.5, INK);
    }
    for (let dy = -5; dy <= 5; dy++) {
      const w = (5 - Math.abs(dy)) * 2 + 2;
      p(8 - w / 2, 8 + dy - 0.5, w, 1, dy < 0 ? '#ffb347' : '#f0722e');
    }
    p(6, 5, 2, 3, '#fff1b8');
    p(7, 7, 2, 2, '#ffe14d');
  });
}

function buildProps() {
  for (const f of [0, 1]) {
    make(`chest_${f}`, 16, 16, 2, (p) => {
      if (f) {
        p(1, 1, 14, 4, INK);
        p(2, 2, 12, 2, '#1f7d86');
        p(2, 5, 12, 3, '#ffe14d');
        p(4, 4, 8, 2, '#fff7c2');
      } else {
        p(1, 4, 14, 5, INK);
        p(2, 5, 12, 3, '#2bb3bd');
        p(2, 5, 12, 1, '#7ff3fa');
      }
      p(1, 8, 14, 7, INK);
      p(2, 9, 12, 5, '#1f7d86');
      p(2, 9, 12, 1, '#2bb3bd');
      p(7, 8, 2, 3, '#ffe14d');
      p(2, 12, 12, 1, '#ff6ad5');
    });
  }
  const heart = (key: string, c: string, hi: string) =>
    make(key, 9, 8, 2, (p) => {
      p(1, 0, 3, 1, INK); p(5, 0, 3, 1, INK); p(0, 1, 9, 3, INK); p(1, 4, 7, 1, INK); p(2, 5, 5, 1, INK); p(3, 6, 3, 1, INK); p(4, 7, 1, 1, INK);
      p(1, 1, 3, 3, c); p(5, 1, 3, 3, c); p(4, 2, 1, 2, c); p(2, 4, 5, 1, c); p(3, 5, 3, 1, c); p(4, 6, 1, 1, c);
      p(2, 1, 1, 1, hi);
    });
  heart('heart', '#ff4d6d', '#ffd0d8');
  heart('heart_empty', '#3a3f5c', '#565c80');
  const coin = (key: string, a: string, b: string) =>
    make(key, 8, 8, 2, (p) => {
      p(2, 0, 4, 8, INK); p(0, 2, 8, 4, INK); p(1, 1, 6, 6, INK);
      p(2, 1, 4, 6, a); p(1, 2, 6, 4, a);
      p(3, 2, 2, 4, b); p(2, 2, 1, 1, '#ffffff');
    });
  coin('coin', '#ffcf40', '#d99a1f');
  coin('cbcoin', '#ff7a59', '#d6452a');
  make('shadow', 12, 5, 2, (p) => {
    p(2, 0, 8, 5, 'rgba(0,0,0,0.22)');
    p(0, 1, 12, 3, 'rgba(0,0,0,0.22)');
  });
  make('slash', 24, 24, 2, (_p, ctx) => {
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(8, 24, 32, -1.0, 1.0);
    ctx.stroke();
    ctx.strokeStyle = '#35e0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(8, 24, 38, -0.9, 0.9);
    ctx.stroke();
  });
  make('bullet', 6, 6, 2, (p) => {
    p(1, 0, 4, 6, '#ffe14d'); p(0, 1, 6, 4, '#ffe14d'); p(2, 2, 2, 2, '#ffffff');
  });
  make('spark', 2, 2, 2, (p) => p(0, 0, 2, 2, '#ffffff'));
  make('table', 22, 16, 2, (p) => {
    p(0, 0, 22, 13, INK);
    p(1, 1, 20, 9, '#b5672f');
    p(1, 1, 20, 2, '#d98a45');
    p(1, 10, 20, 2, '#7d4320');
    p(2, 13, 2, 3, INK); p(18, 13, 2, 3, INK);
    p(3, 4, 16, 5, '#8fc7a0');
    p(3, 4, 16, 1, '#b8e3c3');
  });
}

// Deterministic noise so backgrounds look the same on every load.
function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
}

function buildShop() {
  make('shop_bg', 180, 320, 2, (p) => {
    const n = noise(11);
    // street
    p(0, 255, 180, 65, '#d8c193');
    for (let i = 0; i < 90; i++) p(Math.floor(n() * 176), 262 + Math.floor(n() * 56), 3 + Math.floor(n() * 3), 2, n() > 0.5 ? '#c9b07f' : '#e6d3a8');
    p(0, 255, 180, 3, '#a58a5c');
    for (let x = 6; x < 180; x += 34) {
      p(x, 300, 14, 12, '#5d8f4e'); p(x + 2, 297, 10, 4, '#79b25f'); p(x + 5, 310, 4, 5, '#6e4a2b');
    }
    // floor
    p(8, 50, 164, 205, '#dda15e');
    for (let y = 50; y < 250; y += 8) {
      p(8, y, 164, 1, '#c98a48');
      for (let k = 0; k < 4; k++) p(12 + Math.floor(n() * 156), y + 1, 1, 7, '#c98a48');
    }
    // light pools from the windows
    p(14, 56, 40, 26, 'rgba(255,236,170,0.28)');
    p(126, 56, 40, 26, 'rgba(255,236,170,0.28)');
    // rug
    p(26, 106, 128, 96, '#3f7f72');
    p(29, 109, 122, 90, '#58a08f');
    p(33, 113, 114, 82, '#3f7f72');
    p(36, 116, 108, 76, '#6fb7a4');
    // back wall
    p(0, 0, 180, 50, '#7a3f28');
    for (let y = 2; y < 48; y += 6) for (let x = (y % 12 ? 0 : 6) - 6; x < 180; x += 12) p(x, y, 11, 5, '#8d4a2f');
    p(0, 46, 180, 4, '#4f2618');
    // windows
    for (const x of [18, 138]) {
      p(x - 1, 17, 26, 22, '#4f2618'); p(x, 18, 24, 20, '#ffe9a8'); p(x + 11, 18, 2, 20, '#4f2618'); p(x, 27, 24, 2, '#4f2618');
    }
    // wall shelves with wares
    for (const x of [52, 100]) {
      p(x, 30, 28, 3, '#4f2618');
      p(x + 2, 22, 5, 8, '#35e0ff'); p(x + 10, 24, 6, 6, '#f2c14e'); p(x + 19, 21, 5, 9, '#c63fd9');
      p(x, 16, 28, 2, '#4f2618');
      p(x + 4, 10, 7, 6, '#6dff9c'); p(x + 16, 11, 8, 5, '#ff7a59');
    }
    // side and front walls
    p(0, 50, 8, 205, '#5c2e1c'); p(172, 50, 8, 205, '#5c2e1c');
    p(0, 247, 72, 9, '#5c2e1c'); p(108, 247, 72, 9, '#5c2e1c');
    p(72, 247, 36, 9, '#b98a55');
    p(74, 240, 32, 7, '#c4473a'); p(76, 242, 28, 3, '#e2695b');
    // counter
    p(48, 58, 84, 15, INK);
    p(49, 59, 82, 6, '#e0a868'); p(49, 65, 82, 7, '#8a4b2d');
    for (let x = 56; x < 130; x += 12) p(x, 66, 1, 5, '#6e3a22');
    p(104, 51, 16, 9, INK); p(105, 52, 14, 7, '#f2c14e'); p(107, 53, 10, 3, '#fff1b8');
    p(56, 54, 6, 5, '#c63fd9'); p(64, 55, 5, 4, '#35e0ff');
    // potted plants
    for (const x of [12, 160]) {
      p(x, 236, 8, 8, '#a8552f'); p(x - 2, 226, 12, 11, '#4f9a53'); p(x, 223, 8, 5, '#6cc070');
    }
  });
}

function buildDungeon() {
  const accents = ['#35e0ff', '#ff6ad5', '#ffb347'];
  for (let room = 0; room < 3; room++) {
    make(`dungeon_bg_${room}`, 180, 320, 2, (p) => {
      const n = noise(31 + room * 7);
      const ac = accents[room];
      p(0, 0, 180, 320, '#090a18');
      // floor: the room fills the screen; touch controls float over the lower part
      p(12, 36, 156, 268, '#12142e');
      for (let y = 36; y < 304; y += 12) p(12, y, 156, 1, '#1d2250');
      for (let x = 12; x < 168; x += 12) p(x, 36, 1, 268, '#1d2250');
      for (let i = 0; i < 24; i++) {
        const tx = 12 + Math.floor(n() * 13) * 12;
        const ty = 36 + Math.floor(n() * 22) * 12;
        p(tx + 1, ty + 1, 11, 11, n() > 0.5 ? '#171a3a' : '#0f1126');
        if (n() > 0.6) p(tx + 5, ty + 5, 2, 2, ac);
      }
      // cable runs
      p(12, 120, 156, 1, '#262b5e'); p(12, 228, 156, 1, '#262b5e'); p(90, 36, 1, 268, '#262b5e');
      // back wall of server racks
      p(0, 18, 180, 18, '#1a1d3d');
      for (let x = 4; x < 176; x += 14) {
        if (x > 74 && x < 100) continue;
        p(x, 20, 12, 15, '#0d0f22');
        for (let y = 22; y < 34; y += 3) {
          p(x + 2, y, 5, 1, '#2c3270');
          p(x + 9, y, 1, 1, n() > 0.5 ? ac : '#6dff9c');
        }
      }
      // exit door
      p(78, 18, 24, 18, ac); p(80, 20, 20, 16, '#090a18'); p(82, 22, 16, 14, '#1b1f47'); p(89, 26, 2, 6, ac);
      // side and bottom walls
      p(0, 36, 12, 276, '#1a1d3d'); p(168, 36, 12, 276, '#1a1d3d');
      p(10, 36, 2, 268, ac); p(168, 36, 2, 268, ac);
      p(0, 304, 180, 16, '#1a1d3d'); p(12, 304, 156, 1, ac);
    });
  }
}

export function buildArt() {
  buildCharacters();
  buildEnemies();
  buildItems();
  buildProps();
  buildShop();
  buildDungeon();
}
