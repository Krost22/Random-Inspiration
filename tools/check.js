// npm run check — valida data/*.json y estima combinaciones válidas por modo. Sale con 1 si hay errores.
import { readFileSync } from 'node:fs';
import { REELS, MODES, TIERS, load, valid, spin, tier, isJackpot, text } from '../src/engine.js';

const MIN_COMBOS = 10_000, MIN_RATIO = 0.05, TARGET_ITEMS = 1000, SAMPLES = 100_000, ORPHAN_TRIES = 2000, MAX_LEN = 64;
const KEYS = new Set(['id', 't', 'm', 'tags', 'needs', 'not', 'r']);
const errors = [], warns = [];
const err = msg => errors.push(msg);

function finish() {
  for (const w of warns) console.log(`⏳ ${w}`);
  for (const e of errors) console.log(`❌ ${e}`);
  console.log(errors.length ? `\n${errors.length} error(es)` : '\n✅ sin errores');
  process.exit(errors.length ? 1 : 0);
}

const raw = Object.fromEntries(REELS.map(r =>
  [r, JSON.parse(readFileSync(new URL(`../data/${r}.json`, import.meta.url), 'utf8'))]));
const all = REELS.flatMap(r => raw[r].map(it => [r, it]));

// 1. Estructura (antes de load(), que rellena los valores por defecto)
const ids = new Set(), texts = new Set(), allTags = new Set();
for (const [reel, it] of all) {
  const at = it.id ?? JSON.stringify(it);
  if (typeof it.id !== 'string' || ids.has(it.id)) err(`${at}: id ausente o repetido`);
  ids.add(it.id);
  for (const k of Object.keys(it)) if (!KEYS.has(k)) err(`${at}: campo desconocido "${k}"`);
  if (typeof it.t !== 'string' || !it.t.trim()) err(`${at}: texto vacío`);
  else if (it.t.length > MAX_LEN) err(`${at}: más de ${MAX_LEN} caracteres, no cabe en el rodillo`);
  else if (texts.has(reel + it.t)) err(`${at}: texto repetido "${it.t}"`);
  else texts.add(reel + it.t);
  if (reel === 'que' && !/^una? /.test(it.t)) err(`${at}: un QUÉ empieza por "un " o "una "`);
  if (it.m !== undefined && (!Array.isArray(it.m) || !it.m.length || it.m.some(m => !MODES.includes(m))))
    err(`${at}: m debe ser una lista con ${MODES.join('/')}`);
  if (it.r !== undefined && ![0, 1, 2, 3].includes(it.r)) err(`${at}: r debe ser 0-3`);
  for (const k of ['tags', 'needs', 'not'])
    if (it[k] !== undefined && (!Array.isArray(it[k]) || it[k].some(t => typeof t !== 'string')))
      err(`${at}: ${k} debe ser una lista de textos`);
  it.tags?.forEach?.(t => allTags.add(t));
}
for (const [, it] of all)
  for (const t of [...(it.needs ?? []), ...(it.not ?? [])])
    if (!allTags.has(t)) err(`${it.id}: la etiqueta "${t}" no la aporta ningún fragmento`);
if (errors.length) finish();

const pools = load(raw);
const ALL_MODES = [...MODES, 'random'];
for (const mode of ALL_MODES) REELS.forEach((reel, k) => {
  if (!pools[mode][k][0].length) err(`${mode}/${reel}: no hay fragmentos comunes (r 0)`);
});
if (errors.length) finish();

// 2. Huérfanos: cada fragmento tiene que poder salir en cada uno de sus modos
const flat = Object.fromEntries(ALL_MODES.map(mode => [mode, pools[mode].map(b => b.flat())]));
const rnd = a => a[Math.floor(Math.random() * a.length)];
for (const [reel, it] of all) {
  const k = REELS.indexOf(reel);
  for (const mode of it.m) {
    let ok = false;
    for (let i = 0; i < ORPHAN_TRIES && !ok; i++) ok = valid(flat[mode].map((items, j) => (j === k ? it : rnd(items))));
    if (!ok) err(`${it.id} "${it.t}": huérfano en modo ${mode}`);
  }
}

// 3. Combinaciones y rarezas por modo
console.log(`modo     fragmentos (q·s·g·r)   válidas   estimadas      ${TIERS.join(' / ')}   jackpot`);
const examples = [];
for (const mode of ALL_MODES) {
  const reels = flat[mode];
  const total = reels.reduce((a, r) => a * r.length, 1);
  let ok = 0;
  for (let i = 0; i < SAMPLES; i++) ok += valid(reels.map(rnd));
  const ratio = ok / SAMPLES, est = Math.round(ratio * total);
  if (est < MIN_COMBOS) err(`${mode}: ~${est} combinaciones válidas (mínimo ${MIN_COMBOS})`);
  if (ratio < MIN_RATIO) err(`${mode}: solo ${(ratio * 100).toFixed(1)} % de combinaciones válidas, el giro tardará`);

  const tiers = [0, 0, 0, 0];
  let jackpots = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const c = spin(pools, mode);
    if (!c) { err(`${mode}: spin() no encontró combinación válida`); break; }
    tiers[tier(c)]++;
    jackpots += isJackpot(c);
  }
  for (let i = 0; i < 3; i++) examples.push(`[${mode}] ${text(spin(pools, mode))}`);

  const pct = n => `${((n / SAMPLES) * 100).toFixed(1)}%`;
  console.log([
    mode.padEnd(8),
    reels.map(r => r.length).join('·').padEnd(22),
    pct(ok).padStart(7),
    est.toLocaleString('es').padStart(11),
    '    ' + tiers.map(pct).join(' / ').padEnd(30),
    jackpots ? `1 de cada ${Math.round(SAMPLES / jackpots)}` : '—',
  ].join(' '));
}
console.log('\n' + examples.join('\n') + '\n');

// 4. Contenido
if (all.length < TARGET_ITEMS) warns.push(`contenido: ${all.length}/${TARGET_ITEMS} fragmentos`);
finish();
