// Efectos: sonido sintetizado (WebAudio, sin archivos), partículas en canvas, temblor, destello y vibración.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = a => a[Math.floor(Math.random() * a.length)];

// ---------- Sonido ----------
let ctx, master, noise;
let muted = false;
try { muted = localStorage.getItem('ri-mute') === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('ri-mute', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : 1;
}

// El AudioContext se crea en el primer gesto del usuario (los navegadores lo exigen).
function audio() {
  if (muted) return null;
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null; // sin gesto aún: Chrome no deja sonar
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(a, { f, f2 = f, type = 'sine', at = 0, dur = 0.12, vol = 0.2, attack = 0.005 }) {
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(a, { at = 0, dur = 0.05, vol = 0.1, freq = 3000, q = 1 }) {
  const t = a.currentTime + at, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noise;
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.4, dur + 0.02);
}

const C5 = 523.25, note = semis => C5 * 2 ** (semis / 12);

export const sfx = {
  lever() { // trinquete + golpe seco
    const a = audio(); if (!a) return;
    for (let i = 0; i < 5; i++) tone(a, { f: 900 - i * 90, type: 'square', at: i * 0.03, dur: 0.02, vol: 0.04 });
    tone(a, { f: 120, f2: 60, at: 0.17, dur: 0.18, vol: 0.3 });
    hiss(a, { at: 0.17, dur: 0.06, vol: 0.15, freq: 800 });
  },
  ticks(ms, n) { // un tic por cada celda que pasa, frenando como el rodillo
    const a = audio(); if (!a) return;
    for (let i = 1; i <= n; i++) tone(a, { f: 2400, type: 'triangle', at: (ms / 1000) * (1 - Math.sqrt(1 - i / n)), dur: 0.015, vol: 0.03 });
  },
  stop(r) { // golpe al parar el rodillo; campanita si es raro o mejor
    const a = audio(); if (!a) return;
    tone(a, { f: 150, f2: 70, dur: 0.14, vol: 0.28 });
    hiss(a, { dur: 0.03, vol: 0.12, freq: 2000 });
    if (r) tone(a, { f: [0, 880, 1175, 1568][r], at: 0.02, dur: 0.45, vol: 0.07 + r * 0.02 });
  },
  heartbeat(ms) { // latido durante la anticipación
    const a = audio(); if (!a) return;
    for (let t = 0; t < ms / 1000; t += 0.48) {
      tone(a, { f: 70, f2: 50, at: t, dur: 0.12, vol: 0.35 });
      tone(a, { f: 65, f2: 48, at: t + 0.15, dur: 0.1, vol: 0.22 });
    }
  },
  hold(on) {
    const a = audio(); if (!a) return;
    tone(a, { f: on ? 660 : 440, type: 'square', dur: 0.05, vol: 0.04 });
  },
  mode() {
    const a = audio(); if (!a) return;
    tone(a, { f: 520, f2: 780, type: 'triangle', dur: 0.08, vol: 0.06 });
  },
  print() { // impresora de matriz de puntos
    const a = audio(); if (!a) return;
    for (let i = 0; i < 14; i++) {
      hiss(a, { at: i * 0.045, dur: 0.025, vol: 0.06, freq: 4500, q: 4 });
      tone(a, { f: 110, type: 'square', at: i * 0.045, dur: 0.02, vol: 0.015 });
    }
  },
  win(tier) { // arpegio: más notas cuanto más épica
    const a = audio(); if (!a) return;
    [0, 4, 7, 12, 16].slice(0, tier + 2).forEach((s, i) => tone(a, { f: note(s), type: 'triangle', at: 0.7 + i * 0.09, dur: 0.4, vol: 0.1 }));
    if (tier === 3) hiss(a, { at: 0.9, dur: 0.6, vol: 0.05, freq: 8000, q: 0.7 });
  },
  jackpot() {
    const a = audio(); if (!a) return;
    for (let i = 0; i < 12; i++) tone(a, { f: note([0, 4, 7, 11][i % 4] + 12 * Math.floor(i / 4)), type: 'triangle', at: 0.7 + i * 0.06, dur: 0.25, vol: 0.1 });
    [0, 4, 7, 12].forEach(s => tone(a, { f: note(s + 12), at: 1.5, dur: 1.4, vol: 0.08, attack: 0.02 }));
    for (let i = 0; i < 18; i++) tone(a, { f: 2000 + Math.random() * 700, at: 1.6 + i * 0.07, dur: 0.08, vol: 0.04 }); // monedas
  },
};

// ---------- Partículas ----------
const canvas = Object.assign(document.createElement('canvas'), { className: 'fx' });
canvas.setAttribute('aria-hidden', 'true');
document.body.append(canvas);
const g = canvas.getContext('2d');
let parts = [], raf = 0, W = 0, H = 0;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener('resize', resize);

function loop() {
  g.clearRect(0, 0, W, H);
  parts = parts.filter(p => p.life-- > 0 && p.y < H + 40);
  for (const p of parts) {
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.grav;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    g.globalAlpha = Math.min(1, p.life / 20);
    g.fillStyle = p.color;
    if (p.spark) {
      g.beginPath(); g.arc(p.x, p.y, p.size / 2.5, 0, 7); g.fill();
    } else { // confeti que gira: se estrecha con el coseno para parecer 3D
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.rot * 2)) + 1);
      g.restore();
    }
  }
  g.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(loop) : 0;
}

function add(list) {
  parts.push(...list);
  if (!raf) raf = requestAnimationFrame(loop);
}

const piece = (x, y, vx, vy, colors, extra) => ({
  x, y, vx, vy, grav: 0.18, drag: 0.97, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
  size: 5 + Math.random() * 6, color: rnd(colors), life: 60 + Math.random() * 40, spark: Math.random() < 0.35, ...extra,
});

export function burst(x, y, colors, n = 30, power = 6) {
  if (reduced) return;
  add(Array.from({ length: n }, () => {
    const ang = Math.random() * Math.PI * 2, s = power * (0.4 + Math.random());
    return piece(x, y, Math.cos(ang) * s, Math.sin(ang) * s - power * 0.4, colors);
  }));
}

export function rain(colors, ms = 2500) {
  if (reduced) return;
  const end = performance.now() + ms;
  const drop = () => {
    add(Array.from({ length: 6 }, () => piece(Math.random() * W, -10, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 3, colors, { grav: 0.06, drag: 0.995, life: 240 })));
    if (performance.now() < end) setTimeout(drop, 40);
  };
  drop();
}

// ---------- Pantalla y móvil ----------
export function flash() {
  if (reduced) return;
  const el = Object.assign(document.createElement('div'), { className: 'flash' });
  el.addEventListener('animationend', () => el.remove());
  document.body.append(el);
}

export function shake(el, strength = 1) {
  if (reduced) return;
  el.style.setProperty('--shake', strength);
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

// Sin toque previo en la página, Chrome bloquea vibrate() y lo registra como error.
export const vibrate = pattern => {
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { navigator.vibrate?.(pattern); } catch {}
};
