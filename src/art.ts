// Small effects and HUD glyphs drawn in code. Characters, enemies and loot are rendered
// sprites: see sprites.ts.

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

/** Point a DOM icon at an image file instead of a code-drawn canvas. */
export function setArtUrl(key: string, url: string) {
  urls[key] = url;
}

const INK = '#2b1b2e';

function buildSpecials() {
  make('arrow', 10, 3, 2, (p) => {
    p(0, 1, 7, 1, '#eaffff');
    p(6, 0, 2, 3, '#35e0ff');
    p(8, 1, 2, 1, '#ffffff');
    p(0, 0, 1, 3, '#ff6ad5');
  });
}

function buildProps() {
  const heart = (key: string, c: string, hi: string) =>
    make(key, 9, 8, 2, (p) => {
      p(1, 0, 3, 1, INK); p(5, 0, 3, 1, INK); p(0, 1, 9, 3, INK); p(1, 4, 7, 1, INK); p(2, 5, 5, 1, INK); p(3, 6, 3, 1, INK); p(4, 7, 1, 1, INK);
      p(1, 1, 3, 3, c); p(5, 1, 3, 3, c); p(4, 2, 1, 2, c); p(2, 4, 5, 1, c); p(3, 5, 3, 1, c); p(4, 6, 1, 1, c);
      p(2, 1, 1, 1, hi);
    });
  heart('heart', '#ff4d6d', '#ffd0d8');
  heart('heart_empty', '#3a3f5c', '#565c80');
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
  const radial = (key: string, size: number, stops: [number, string][]) =>
    make(key, size, size, 1, (_p, ctx) => {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [at, c] of stops) g.addColorStop(at, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    });
  radial('bullet', 24, [[0, '#ffffff'], [0.3, '#ffe14d'], [0.6, 'rgba(255,170,40,.55)'], [1, 'rgba(255,170,40,0)']]);
  radial('spark', 12, [[0, '#ffffff'], [0.45, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']]);
  // soft light pool, tinted and drawn additively under glowing things
  radial('glow', 96, [[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]);
  // darkened edges for the dungeon
  make('vignette', 180, 320, 1, (_p, ctx) => {
    const g = ctx.createRadialGradient(90, 160, 70, 90, 160, 210);
    g.addColorStop(0, 'rgba(6,8,26,0)');
    g.addColorStop(1, 'rgba(6,8,26,.78)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 180, 320);
  });
}

export function buildArt() {
  buildProps();
  buildSpecials();
}
