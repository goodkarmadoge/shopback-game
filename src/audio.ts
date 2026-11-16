// Synthesised audio: two music loops and a handful of sound effects, no audio files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let musicTimer: number | undefined;
let musicKind: 'shop' | 'dungeon' | null = null;

function ensure(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Browsers only allow audio after a gesture.
window.addEventListener('pointerdown', () => ensure(), { passive: true });
window.addEventListener('keydown', () => ensure());

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.2, slide = 0, delay = 0) {
  const c = ctx;
  if (!c || !master || c.state !== 'running') return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Sfx = 'tap' | 'coin' | 'cashback' | 'swing' | 'hit' | 'hurt' | 'chest' | 'deal' | 'leave' | 'campaign' | 'level' | 'roll';

export function sfx(name: Sfx) {
  ensure();
  switch (name) {
    case 'tap': return tone(520, 0.05, 'square', 0.08);
    case 'coin': tone(988, 0.07, 'square', 0.12); return tone(1319, 0.14, 'square', 0.12, 0, 0.07);
    case 'cashback': tone(1319, 0.06, 'triangle', 0.14); return tone(880, 0.12, 'triangle', 0.14, 0, 0.06);
    case 'swing': return tone(300, 0.09, 'sawtooth', 0.08, -180);
    case 'hit': return tone(180, 0.1, 'square', 0.16, -100);
    case 'hurt': return tone(240, 0.25, 'sawtooth', 0.18, -170);
    case 'roll': return tone(200, 0.14, 'triangle', 0.1, 260);
    case 'chest': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.12, 0, i * 0.08)); return;
    case 'deal': tone(659, 0.08, 'triangle', 0.16); return tone(880, 0.16, 'triangle', 0.16, 0, 0.08);
    case 'leave': return tone(220, 0.22, 'triangle', 0.14, -90);
    case 'campaign': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.14, 0, i * 0.09)); return;
    case 'level': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.16, 0, i * 0.11)); return;
  }
}

const SONGS = {
  // cosy major-pentatonic arpeggio
  shop: { step: 0.3, lead: [392, 494, 587, 494, 440, 523, 659, 523, 392, 494, 587, 784, 659, 587, 494, 440], bass: [98, 110, 98, 73], type: 'triangle' as OscillatorType },
  // tense minor pulse
  dungeon: { step: 0.2, lead: [220, 0, 262, 220, 330, 0, 294, 262, 220, 0, 262, 220, 196, 0, 208, 0], bass: [55, 55, 65, 49], type: 'square' as OscillatorType },
};

export function music(kind: 'shop' | 'dungeon' | null) {
  if (kind === musicKind) return;
  musicKind = kind;
  window.clearInterval(musicTimer);
  if (!kind) return;
  const song = SONGS[kind];
  let i = 0;
  musicTimer = window.setInterval(() => {
    const f = song.lead[i % song.lead.length];
    if (f) tone(f, song.step * 0.9, song.type, 0.035);
    if (i % 4 === 0) tone(song.bass[(i / 4) % song.bass.length | 0], song.step * 3.5, 'triangle', 0.07);
    i++;
  }, song.step * 1000);
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
