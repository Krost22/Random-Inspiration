// Bucle de enganche: XP y niveles con skins, racha diaria, giro dorado, pity timer, colección, logros,
// favoritas, historial y 👎. Todo se guarda en localStorage (solo en este navegador).
import * as fx from './fx.js';
import { TIERS, tier as tierOf, isJackpot, text } from './engine.js';

export const MODE_NAMES = { web: 'Web', unity: 'Unity', juego: 'Videojuego', random: 'Full Random' };
export const LABELS = ['Qué', 'Sobre', 'Gancho', 'Reto'];
const KEY = 'ri-state', PITY = 30, HIST_MAX = 50;
const XP_TIER = [10, 25, 60, 150], XP_JACKPOT = 300, XP_GOLDEN = 20;

export const SKINS = [
  { id: 'dorada', name: 'Noche dorada', level: 1, color: '#F5B940' },
  { id: 'plata', name: 'Plata', level: 3, color: '#C9D1DC' },
  { id: 'neon', name: 'Neón', level: 5, color: '#FF4FA3' },
  { id: 'esmeralda', name: 'Esmeralda', level: 8, color: '#34D399' },
  { id: 'rubi', name: 'Rubí', level: 12, color: '#F43F5E' },
];

const ACH = [
  ['primera', 'Primera idea', 'Imprime tu primer ticket', s => s.spins >= 1],
  ['diez', 'Calentando', 'Tira 10 veces', s => s.spins >= 10],
  ['cien', 'Máquina de ideas', 'Tira 100 veces', s => s.spins >= 100],
  ['mil', 'Sin fondo', 'Tira 1000 veces', s => s.spins >= 1000],
  ['rara', 'Algo distinto', 'Consigue una idea rara', s => s.tiers[1] > 0],
  ['epica', 'Épica', 'Consigue una idea épica', s => s.tiers[2] > 0],
  ['legendaria', 'Leyenda', 'Consigue una idea legendaria', s => s.tiers[3] > 0],
  ['jackpot', '¡Jackpot!', 'Los 4 rodillos raros o mejores', s => s.jackpots > 0],
  ['racha3', 'Constancia', 'Racha de 3 días', s => s.streak.best >= 3],
  ['racha7', 'Hábito', 'Racha de 7 días', s => s.streak.best >= 7],
  ['modos', 'Explorador', 'Tira en los 4 modos', s => s.modes.length >= 4],
  ['col100', 'Coleccionista', 'Descubre 100 fragmentos', (s, seen) => seen >= 100],
  ['col500', 'Archivista', 'Descubre 500 fragmentos', (s, seen) => seen >= 500],
  ['colAll', 'Lo he visto todo', 'Descubre todos los fragmentos', (s, seen, total) => seen >= total],
  ['favs', 'Curador', 'Guarda 10 favoritas', s => s.favs.length >= 10],
  ['critico', 'Control de calidad', 'Marca una idea sin sentido', s => s.bad.length >= 1],
];

const $ = s => document.querySelector(s);
const cap = s => s[0].toUpperCase() + s.slice(1);
const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-DD local
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const need = l => 50 * l * (l + 1); // XP total para pasar del nivel l al l + 1: 100, 300, 600, 1000…
export const levelFor = xp => { let l = 1; while (xp >= need(l)) l++; return l; };
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);
const days = n => `${n} ${n === 1 ? 'día' : 'días'}`;
const ids = combo => combo.map(it => it.id);
const sameIds = (a, b) => a.join() === b.join();

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

const fresh = () => ({
  v: 1, xp: 0, spins: 0, tiers: [0, 0, 0, 0], jackpots: 0, sinceEpic: 0, seen: [], favs: [], hist: [], bad: [],
  modes: [], ach: {}, streak: { day: null, count: 0, best: 0 }, golden: null, skin: 'dorada',
});

let state = fresh(), seen = new Set(), byId = new Map(), all = [], onRestore = () => {};

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
  state = { ...fresh(), ...(s ?? {}) };
  if (!s) try { state.spins = +localStorage.getItem('ri-count') || 0; } catch {} // contador de la fase 2
  seen = new Set(state.seen);
}

function save() {
  state.seen = [...seen];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

const resolve = list => {
  const combo = list.map(id => byId.get(id));
  return combo.every(Boolean) ? combo : null; // un id que ya no existe en data/ invalida la entrada
};

// Frase con cada parte coloreada por su rareza (la usan el ticket y los paneles).
export function ideaNodes(combo) {
  const [q, s, g, r] = combo;
  const span = (it, t) => el('span', `r${it.r}`, t);
  return [span(q, cap(q.t)), ' ', span(s, s.t), ', ', span(g, g.t), ', ', span(r, r.t), '.'];
}

// ---------- Avisos ----------
export function toast(title, sub = '', kind = '') {
  const t = el('div', `toast ${kind}`);
  t.append(el('b', '', title));
  if (sub) t.append(el('span', '', sub));
  $('.toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4000);
}

// ---------- Cabecera ----------
const streakNow = () => (state.streak.day && daysBetween(state.streak.day, today()) <= 1 ? state.streak.count : 0);
const goldenReady = () => state.golden !== today();

function renderStats(gain) {
  const l = levelFor(state.xp), from = need(l - 1), to = need(l);
  const pct = Math.round(((state.xp - from) / (to - from)) * 100);
  $('.lvl-n').textContent = l;
  $('.xp i').style.width = `${pct}%`;
  $('.xp').setAttribute('aria-valuenow', pct);
  $('.xp').title = `${state.xp - from} / ${to - from} XP para el nivel ${l + 1}`;
  $('.streak-n').textContent = streakNow();
  $('.golden').hidden = !goldenReady();
  document.body.classList.toggle('golden-ready', goldenReady());
  if (gain) {
    const g = $('.xp-gain');
    g.textContent = `+${gain} XP`;
    g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop');
  }
}

function applySkin(id) {
  const skin = SKINS.find(s => s.id === id && s.level <= levelFor(state.xp)) ?? SKINS[0];
  state.skin = skin.id;
  document.body.dataset.skin = skin.id;
}

// ---------- Tiradas ----------
export const num = () => state.spins;

// Rareza mínima por rodillo para esta tirada: pity (idea épica garantizada) o giro dorado del día.
export function spinBoost(held) {
  const free = shuffle([0, 1, 2, 3].filter(k => !held[k]));
  const floor = [];
  if (state.sinceEpic >= PITY) { free.slice(0, 2).forEach(k => (floor[k] = 2)); return { floor, kind: 'pity' }; }
  if (goldenReady()) { floor[free[0]] = 2; return { floor, kind: 'golden' }; }
  return { floor, kind: null };
}

export function record(combo, mode, kind) {
  const t = tierOf(combo), jackpot = isJackpot(combo), before = levelFor(state.xp), day = today();
  state.spins++;
  state.tiers[t]++;
  if (jackpot) state.jackpots++;
  state.sinceEpic = t >= 2 ? 0 : state.sinceEpic + 1;
  if (kind === 'golden') state.golden = day;
  if (state.streak.day !== day) {
    state.streak.count = state.streak.day && daysBetween(state.streak.day, day) === 1 ? state.streak.count + 1 : 1;
    state.streak.day = day;
    state.streak.best = Math.max(state.streak.best, state.streak.count);
  }
  combo.forEach(it => seen.add(it.id));
  if (!state.modes.includes(mode)) state.modes.push(mode);
  state.hist.unshift({ ids: ids(combo), mode, at: Date.now() });
  state.hist.length = Math.min(state.hist.length, HIST_MAX);
  const gain = XP_TIER[t] + (jackpot ? XP_JACKPOT : 0) + (kind === 'golden' ? XP_GOLDEN : 0);
  state.xp += gain;

  const after = levelFor(state.xp);
  if (after > before) {
    setTimeout(() => {
      toast(`¡Nivel ${after}!`, 'Sigues subiendo.', 'level');
      fx.burst(...centerOf($('.lvl')), ['#FFD27A', '#F5B940', '#FFFFFF'], 30, 4);
      SKINS.filter(s => s.level > before && s.level <= after).forEach(s => toast(`Nueva skin: ${s.name}`, 'Actívala en Perfil.', 'skin'));
    }, 900);
  }
  save();
  renderStats(gain);
  checkAchievements(1300);
  return { num: state.spins };
}

const centerOf = e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

function checkAchievements(delay = 0) {
  const fresh = ACH.filter(([id, , , test]) => !state.ach[id] && test(state, seen.size, all.length));
  fresh.forEach(([id, name, desc], i) => {
    state.ach[id] = Date.now();
    setTimeout(() => toast(`Logro: ${name}`, desc, 'ach'), delay + i * 700);
  });
  if (fresh.length) save();
}

// ---------- Favoritas, 👎 y compartir ----------
export const isFav = combo => state.favs.some(f => sameIds(f.ids, ids(combo)));

export function toggleFav(combo, mode) {
  const i = state.favs.findIndex(f => sameIds(f.ids, ids(combo)));
  if (i >= 0) state.favs.splice(i, 1);
  else state.favs.unshift({ ids: ids(combo), mode, at: Date.now() });
  save();
  checkAchievements();
  return i < 0;
}

export function markBad(combo, mode) {
  if (!state.bad.some(b => sameIds(b.ids, ids(combo)))) state.bad.push({ ids: ids(combo), mode, at: Date.now() });
  save();
  checkAchievements();
}

export const shareUrl = (combo, mode) => `${location.origin}${location.pathname}#${mode}/${ids(combo).join('-')}`;

export function parseShare(hash) {
  const m = /^#(web|unity|juego|random)\/([a-z0-9-]+)$/.exec(hash);
  const combo = m && resolve(m[2].split('-'));
  return combo && combo.length === 4 ? { combo, mode: m[1] } : null;
}

// ---------- Paneles ----------
const panel = $('.panel');
const PANELS = { perfil: 'Perfil', coleccion: 'Colección', favoritas: 'Favoritas', historial: 'Historial' };

function download(name, data) {
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copy(btn, txt) {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(txt); btn.textContent = '¡Copiado!'; }
  catch { btn.textContent = 'No se pudo copiar'; }
  setTimeout(() => (btn.textContent = label), 1200);
}

function button(label, onClick, cls = 'chip') {
  const b = el('button', cls, label);
  b.onclick = onClick;
  return b;
}

function bar(label, have, total) {
  const row = el('div', 'bar-row');
  const b = el('div', 'bar');
  b.append(el('i'));
  b.firstChild.style.width = `${total ? (have / total) * 100 : 0}%`;
  row.append(el('span', '', label), b, el('span', 'mono', `${have}/${total}`));
  return row;
}

function entry(item, actions) {
  const combo = resolve(item.ids);
  if (!combo) return null;
  const t = tierOf(combo);
  const e = el('article', 'entry');
  const p = el('p', 'entry-idea');
  p.append(...ideaNodes(combo));
  const date = new Date(item.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  e.append(p, el('div', 'entry-meta mono', `${TIERS[t]}${isJackpot(combo) ? ' · jackpot' : ''} · ${MODE_NAMES[item.mode] ?? ''} · ${date}`));
  const row = el('div', 'entry-actions');
  row.append(...actions(combo, item));
  e.append(row);
  return e;
}

const restoreBtn = (combo, item) => button('Ver en la máquina', () => { panel.close(); onRestore(combo, item.mode, 'Recuperada'); });

const VIEWS = {
  perfil() {
    const l = levelFor(state.xp);
    const stats = el('div', 'stats');
    [
      ['Nivel', l], ['XP total', state.xp], ['Al siguiente nivel', `${need(l) - state.xp} XP`], ['Tiradas', state.spins],
      ['Racha', days(streakNow())], ['Mejor racha', days(state.streak.best)], ['Jackpots', state.jackpots],
      ['Ideas rara / épica / leg.', `${state.tiers[1]} / ${state.tiers[2]} / ${state.tiers[3]}`],
    ].forEach(([k, v]) => { const d = el('div', 'stat'); d.append(el('span', 'mono', k), el('b', '', String(v))); stats.append(d); });

    const skins = el('div', 'skins');
    SKINS.forEach(s => {
      const locked = s.level > l;
      const b = el('button', 'skin');
      b.style.setProperty('--c', s.color);
      b.disabled = locked;
      b.setAttribute('aria-pressed', state.skin === s.id);
      b.append(el('i'), el('span', '', s.name), el('span', 'mono', locked ? `Nivel ${s.level}` : state.skin === s.id ? 'Activa' : 'Usar'));
      b.onclick = () => { applySkin(s.id); save(); render('perfil'); };
      skins.append(b);
    });

    const ach = el('div', 'achs');
    ACH.forEach(([id, name, desc]) => {
      const a = el('div', `ach${state.ach[id] ? ' got' : ''}`);
      a.append(el('b', '', name), el('span', '', desc));
      ach.append(a);
    });
    const got = ACH.filter(([id]) => state.ach[id]).length;
    return [stats, el('h3', 'mono', 'Skins de la máquina'), skins, el('h3', 'mono', `Logros · ${got}/${ACH.length}`), ach];
  },

  coleccion() {
    const out = [bar('Fragmentos descubiertos', seen.size, all.length), el('h3', 'mono', 'Por rodillo')];
    ['que', 'sobre', 'gancho', 'reto'].forEach((reel, k) => {
      const list = all.filter(it => it.reel === reel);
      out.push(bar(LABELS[k], list.filter(it => seen.has(it.id)).length, list.length));
    });
    out.push(el('h3', 'mono', 'Por rareza'));
    TIERS.forEach((name, r) => {
      const list = all.filter(it => it.r === r);
      const row = bar(cap(name), list.filter(it => seen.has(it.id)).length, list.length);
      row.classList.add(`t${r}`);
      out.push(row);
    });
    const legs = all.filter(it => it.r === 3), found = legs.filter(it => seen.has(it.id));
    out.push(el('h3', 'mono', 'Legendarias descubiertas'));
    const ul = el('ul', 'legs');
    found.forEach(it => ul.append(el('li', 'r3', it.t)));
    if (found.length < legs.length) ul.append(el('li', 'hidden', `${legs.length - found.length} por descubrir…`));
    out.push(ul);
    return out;
  },

  favoritas() {
    if (!state.favs.length) return [el('p', 'empty', 'Aún no hay favoritas. Pulsa «Guardar» en un ticket (o la tecla F).')];
    const list = state.favs.map(f => entry(f, (combo) => [
      restoreBtn(combo, f),
      button('Copiar', e => copy(e.currentTarget, text(combo))),
      button('Quitar', () => { toggleFav(combo, f.mode); render('favoritas'); }),
    ])).filter(Boolean);
    const tools = el('div', 'panel-tools');
    tools.append(
      button('Copiar todas en Markdown', e => copy(e.currentTarget, state.favs.map(f => resolve(f.ids)).filter(Boolean).map(c => `- ${text(c)}`).join('\n'))),
      button('Descargar JSON', () => download('favoritas.json', state.favs.map(f => ({ ...f, idea: (c => c && text(c))(resolve(f.ids)) })))),
    );
    return [tools, ...list];
  },

  historial() {
    const tools = el('div', 'panel-tools');
    tools.append(el('span', 'mono', `${state.bad.length} marcadas sin sentido`));
    if (state.bad.length) tools.append(button('Descargar marcadas en JSON', () => download('sin-sentido.json', state.bad.map(b => ({ ...b, idea: (c => c && text(c))(resolve(b.ids)) })))));
    if (!state.hist.length) return [tools, el('p', 'empty', 'Todavía no has tirado de la palanca.')];
    return [tools, ...state.hist.map(h => entry(h, (combo) => [
      restoreBtn(combo, h),
      button(isFav(combo) ? 'Guardada' : 'Guardar', e => { const on = toggleFav(combo, h.mode); e.currentTarget.textContent = on ? 'Guardada' : 'Guardar'; }),
    ])).filter(Boolean)];
  },
};

function render(name) {
  panel.querySelector('h2').textContent = PANELS[name];
  panel.querySelector('.panel-body').replaceChildren(...VIEWS[name]());
}

export function openPanel(name) {
  render(name);
  if (!panel.open) panel.showModal();
}

// ---------- Arranque ----------
export function init({ items, restore }) {
  all = items;
  byId = new Map(items.map(it => [it.id, it]));
  onRestore = restore;
  load();
  applySkin(state.skin);
  renderStats();
  document.querySelectorAll('[data-panel]').forEach(b => (b.onclick = () => openPanel(b.dataset.panel)));
  panel.querySelector('.panel-close').onclick = () => panel.close();
  panel.addEventListener('click', e => e.target === panel && panel.close()); // clic en el fondo
  checkAchievements(); // logros que ya se cumplían con datos de versiones anteriores
}
