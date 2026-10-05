// Motor puro (sin DOM): lo usan la web y tools/check.js.
export const REELS = ['que', 'sobre', 'gancho', 'reto'];
export const MODES = ['web', 'unity', 'juego'];
export const ODDS = [76, 15, 6, 3]; // % por rodillo: común, rara, épica, legendaria (≈ 60/31/8/1 por idea)
export const TIERS = ['común', 'rara', 'épica', 'legendaria'];

// raw: { que: [...], sobre: [...], ... } -> pools[modo][rodillo][rareza] = fragmentos
export function load(raw) {
  for (const reel of REELS) for (const it of raw[reel]) {
    it.m ??= MODES; it.tags ??= []; it.needs ??= []; it.not ??= []; it.r ??= 0; it.reel = reel;
  }
  const pools = {};
  for (const mode of [...MODES, 'random']) {
    pools[mode] = REELS.map(reel => {
      const items = raw[reel].filter(it => mode === 'random' || it.m.includes(mode));
      return ODDS.map((_, r) => items.filter(it => it.r === r));
    });
  }
  return pools;
}

export function valid(combo) {
  const que = combo[0];
  return combo.every((it, i) => {
    if (i && !it.m.some(m => que.m.includes(m))) return false; // regla de plataforma
    const others = new Set(combo.flatMap((o, j) => (j === i ? [] : o.tags)));
    return (!it.needs.length || it.needs.some(t => others.has(t))) && !it.not.some(t => others.has(t));
  });
}

function pick(buckets, min = 0) {
  let x = Math.random() * 100, r = 0;
  while (x >= ODDS[r]) x -= ODDS[r++];
  r = Math.max(r, min);
  while (r && !buckets[r].length) r--; // sin fragmentos de esa rareza: baja a la anterior
  const b = buckets[r];
  return b[Math.floor(Math.random() * b.length)];
}

// held[i] = fragmento bloqueado en el rodillo i. Si con bloqueos no sale nada válido, los suelta.
// floor[i] = rareza mínima del rodillo i (giro dorado, pity timer).
export function spin(pools, mode, held = [], floor = []) {
  const reels = pools[mode];
  for (let i = 0; i < 400; i++) {
    const combo = reels.map((buckets, k) => (i < 200 && held[k]) || pick(buckets, floor[k]));
    if (valid(combo)) return combo;
  }
  return null;
}

export function tier(combo) {
  const s = combo.reduce((a, it) => a + it.r, 0);
  return s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0;
}

export const isJackpot = combo => combo.every(it => it.r > 0); // los 4 rodillos raros o mejores

export function text([que, sobre, gancho, reto]) {
  const s = `${que.t} ${sobre.t}, ${gancho.t}, ${reto.t}.`;
  return s[0].toUpperCase() + s.slice(1);
}
