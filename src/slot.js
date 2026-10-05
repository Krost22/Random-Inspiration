// La máquina: rodillos, palanca, bloqueos, modos y ticket impreso.
import { REELS, TIERS, load, spin, tier, isJackpot, text } from './engine.js';
import * as fx from './fx.js';
import * as meta from './meta.js';

const { LABELS, MODE_NAMES } = meta;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE_MS = reduced ? 250 : 900, STAGGER_MS = reduced ? 80 : 300, TEASE_MS = reduced ? 400 : 1400;
const $ = s => document.querySelector(s);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s[0].toUpperCase() + s.slice(1);
const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };

let pools, combo, spinning = false;
let mode = MODE_NAMES[store('ri-mode')] ? store('ri-mode') : 'juego';
const held = [false, false, false, false];
const lever = $('.lever'), cabinet = $('.cabinet'), panel = $('.panel');

document.querySelectorAll('.bulbs').forEach(row => row.append(...Array.from({ length: 18 }, () => Object.assign(document.createElement('i'), { className: 'bulb' }))));

const reels = LABELS.map((label, k) => {
  const el = document.createElement('div');
  el.className = 'reel';
  el.innerHTML = `<span class="label">${label}</span>
    <div class="window"><div class="band"></div><div class="strip"></div><div class="shade"></div></div>
    <button class="hold" aria-pressed="false" aria-label="Bloquear ${label}">Bloquear</button>`;
  $('.reels').append(el);
  el.querySelector('.hold').onclick = () => toggleHold(k);
  return { el, win: el.querySelector('.window'), strip: el.querySelector('.strip'), hold: el.querySelector('.hold'), items: [] };
});

const filler = k => rnd(pools[mode][k].flat());
const retrigger = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const ticketNum = n => `Nº ${String(n).padStart(4, '0')}`;
const SPARKS = [null, ['#3B8BFF', '#93C5FD', '#FFFFFF'], ['#9B5CFF', '#C4A1FF', '#FFFFFF'], ['#F5B940', '#FFD27A', '#FFF6E0', '#E0A630']];
const center = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };

function cell(it) {
  const d = document.createElement('div');
  d.className = `cell r${it.r}`;
  d.textContent = it.t;
  return d;
}

// Centra el elemento i de la tira en la ventana; con ms > 0 lo anima (la curva se pasa un poco y rebota).
function place(reel, i, ms = 0) {
  const h = reel.strip.firstChild.offsetHeight;
  reel.strip.style.transition = ms ? `transform ${ms}ms cubic-bezier(.15, .7, .3, 1.06)` : 'none';
  reel.strip.style.transform = `translateY(${(reel.win.clientHeight - h) / 2 - i * h}px)`;
}

function show(reel, items) { // [arriba, centro, abajo]
  reel.items = items;
  reel.strip.replaceChildren(...items.map(cell));
  place(reel, 1);
}

function roll(k, target, ms) {
  const reel = reels[k];
  const items = [...reel.items, ...Array.from({ length: Math.round(ms / 40) }, () => filler(k)), target, filler(k)];
  reel.strip.replaceChildren(...items.map(cell));
  place(reel, 1);
  void reel.strip.offsetHeight; // fija la posición inicial antes de animar
  reel.el.classList.add('blur');
  place(reel, items.length - 2, ms);
  setTimeout(() => reel.el.classList.remove('blur'), ms * 0.55);
  return new Promise(done => setTimeout(() => {
    show(reel, items.slice(-3));
    retrigger(reel.el, 'landed');
    fx.sfx.stop(target.r);
    fx.vibrate(8);
    if (target.r >= 2) fx.burst(...center(reel.win), SPARKS[target.r], target.r === 3 ? 40 : 16, target.r === 3 ? 7 : 4);
    done();
  }, ms));
}

async function doSpin() {
  if (spinning || !pools) return;
  spinning = true;
  document.body.classList.add('spinning');
  cabinet.classList.remove('jackpot');
  $('.ticket').hidden = true;
  $('.wait').hidden = false;
  $('.wait').textContent = 'Imprimiendo…';
  const { floor, kind } = meta.spinBoost(held);
  if (kind === 'golden') meta.toast('Giro dorado del día', 'Un rodillo épico o mejor garantizado.', 'golden');
  if (kind === 'pity') meta.toast('Tu suerte cambia', 'Esta idea será épica o mejor.', 'golden');
  const next = spin(pools, mode, held.map((h, k) => h && combo[k]), floor);
  held.forEach((h, k) => h && next[k] !== combo[k] && setHold(k, false)); // spin() soltó un bloqueo imposible
  const tease = !held[3] && next.slice(0, 3).every(it => it.r > 0);
  const ms = k => BASE_MS + k * STAGGER_MS + (tease && k === 3 ? TEASE_MS : 0);
  const lastMs = ms(held.lastIndexOf(false)); // el último rodillo que gira marca el ritmo de los tics
  fx.sfx.lever();
  fx.sfx.ticks(lastMs, Math.round(lastMs / 40) + 1);
  const runs = reels.map((_, k) => !held[k] && roll(k, next[k], ms(k)));
  if (tease) Promise.all(runs.slice(0, 3)).then(() => {
    reels[3].el.classList.add('tease');
    fx.sfx.heartbeat(ms(3) - ms(2));
  });
  await Promise.all(runs);
  reels[3].el.classList.remove('tease');
  combo = next;
  const { num } = meta.record(combo, mode, kind);
  printTicket(`${ticketNum(num)} · ${MODE_NAMES[mode]}`);
  spinning = false;
  document.body.classList.remove('spinning');
}

// quiet: ticket recuperado (historial, favoritas o enlace): se imprime sin celebración ni XP.
function printTicket(label, quiet = false) {
  const t = tier(combo), jackpot = isJackpot(combo), ticket = $('.ticket');
  cabinet.classList.toggle('jackpot', jackpot && !quiet);
  $('.wait').hidden = true;
  ticket.hidden = false;
  retrigger(ticket, 'print');
  $('.ticket-meta').textContent = label;
  $('.next-num').textContent = ticketNum(meta.num() + 1);
  const stamp = $('.stamp');
  stamp.className = `stamp r${t}${jackpot ? ' jackpot' : ''}`;
  stamp.textContent = jackpot ? `Jackpot · ${TIERS[t]}` : TIERS[t];
  $('.idea').replaceChildren(...meta.ideaNodes(combo));
  $('.parts').replaceChildren(...combo.map((it, k) => {
    const row = document.createElement('div');
    row.className = 'part';
    row.innerHTML = `<span class="mono"></span><span class="t"></span><i class="sq r${it.r}"></i><span class="name r${it.r}"></span>`;
    row.querySelector('.mono').textContent = LABELS[k];
    row.querySelector('.t').textContent = it.t;
    row.querySelector('.name').textContent = cap(TIERS[it.r]);
    return row;
  }));
  showFav();
  $('.bad span').textContent = 'No tiene sentido';
  $('.bad').disabled = false;
  ticket.classList.toggle('holo', t === 3 || jackpot);
  ticket.style.cssText = '';
  fx.sfx.print();
  if (!quiet) celebrate(t, jackpot, ticket);
}

function celebrate(t, jackpot, ticket) {
  const [x] = center(ticket), y = ticket.getBoundingClientRect().top + 40;
  if (jackpot) {
    fx.sfx.jackpot();
    fx.flash();
    fx.shake($('.machine'), 1.6);
    fx.rain(SPARKS[3], 2600);
    fx.burst(x, y, SPARKS[3], 90, 9);
    fx.vibrate([30, 40, 30, 40, 120]);
    return;
  }
  fx.sfx.win(t);
  if (t) setTimeout(() => fx.burst(x, y, SPARKS[t], [0, 18, 40, 80][t], 4 + t), 650);
  if (t >= 2) fx.shake($('.machine'), t === 3 ? 1 : 0.5);
  if (t === 3) fx.vibrate([20, 30, 60]);
}

// Muestra en la máquina una idea guardada (historial, favoritas o enlace compartido).
function restore(c, m, label) {
  if (spinning) return;
  if (m !== mode) setMode(m);
  held.forEach((_, k) => setHold(k, false));
  combo = c;
  reels.forEach((reel, k) => show(reel, [filler(k), c[k], filler(k)]));
  printTicket(`${label} · ${MODE_NAMES[m]}`, true);
  $('.ticket').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
}

// Ticket holográfico: el brillo y la inclinación siguen al puntero.
$('.ticket').addEventListener('pointermove', e => {
  const el = e.currentTarget;
  if (!el.classList.contains('holo')) return;
  const b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
  el.style.setProperty('--mx', `${px * 100}%`);
  el.style.setProperty('--my', `${py * 100}%`);
  el.style.setProperty('--rx', `${(px - 0.5) * 12}deg`);
  el.style.setProperty('--ry', `${(0.5 - py) * 12}deg`);
});
$('.ticket').addEventListener('pointerleave', e => (e.currentTarget.style.cssText = ''));

function setHold(k, on) {
  held[k] = on;
  reels[k].el.classList.toggle('held', on);
  reels[k].hold.setAttribute('aria-pressed', on);
  reels[k].hold.textContent = on ? 'Bloqueado' : 'Bloquear';
}

function toggleHold(k) {
  if (spinning || !combo) return;
  if (!held[k] && held.filter(Boolean).length === 3) return retrigger(reels[k].el, 'nope'); // siempre gira al menos uno
  setHold(k, !held[k]);
  fx.sfx.hold(held[k]);
}

function setMode(m, spinAfter) {
  if (spinning) return;
  mode = m;
  document.body.dataset.mode = m;
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  $('.mode-name').textContent = MODE_NAMES[m];
  held.forEach((_, k) => setHold(k, false));
  store('ri-mode', m);
  if (spinAfter) { fx.sfx.mode(); pullLever(); }
}

function pullLever() {
  if (spinning || !pools) return;
  retrigger(lever, 'yank');
  doSpin();
}

// Palanca: arrastrar la bola hacia abajo más del 60 % gira; un clic sin arrastrar también.
const knob = $('.knob');
let drag = null, dragged = false;
knob.addEventListener('pointerdown', e => {
  if (spinning || !pools) return;
  drag = { y: e.clientY, pull: 0 };
  dragged = false;
  knob.setPointerCapture(e.pointerId);
  lever.classList.add('dragging');
});
knob.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.pull = Math.min(1, Math.max(0, (e.clientY - drag.y) / 240));
  if (drag.pull > 0.04) dragged = true;
  lever.style.setProperty('--pull', drag.pull);
});
const release = fire => () => {
  if (!drag) return;
  const { pull } = drag;
  drag = null;
  lever.classList.remove('dragging');
  lever.style.removeProperty('--pull'); // vuelve con muelle (transición en CSS)
  if (fire && pull > 0.6) doSpin();
};
knob.addEventListener('pointerup', release(true));
knob.addEventListener('pointercancel', release(false));
knob.addEventListener('click', () => (dragged ? (dragged = false) : pullLever())); // clic o teclado

// Ticket: guardar, compartir y 👎
const showFav = () => {
  const on = !!combo && meta.isFav(combo);
  $('.fav').setAttribute('aria-pressed', on);
  $('.fav span').textContent = on ? 'Guardada' : 'Guardar';
};
function toggleFav() {
  if (!combo || $('.ticket').hidden) return;
  const on = meta.toggleFav(combo, mode);
  showFav();
  if (on) { fx.sfx.hold(true); fx.burst(...center($('.fav')), ['#F5B940', '#FFD27A', '#FFFFFF'], 14, 3); }
}
$('.fav').onclick = toggleFav;
$('.share').onclick = async () => {
  const label = $('.share span');
  try { await navigator.clipboard.writeText(meta.shareUrl(combo, mode)); label.textContent = '¡Enlace copiado!'; }
  catch { label.textContent = 'No se pudo copiar'; }
  setTimeout(() => (label.textContent = 'Compartir'), 1400);
};
$('.bad').onclick = () => {
  meta.markBad(combo, mode);
  $('.bad span').textContent = 'Anotada, gracias';
  $('.bad').disabled = true;
};

addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || panel.open) return;
  if (e.code === 'Space' || e.key === 'Enter') {
    if (e.target.closest?.('button')) return; // el botón enfocado ya hace su clic
    e.preventDefault();
    pullLever();
  } else if (/^[1-4]$/.test(e.key)) toggleHold(+e.key - 1);
  else if (e.key.toLowerCase() === 'm') toggleMute();
  else if (e.key.toLowerCase() === 'f') toggleFav();
});

const muteBtn = $('.mute');
const showMute = () => {
  muteBtn.setAttribute('aria-pressed', fx.isMuted());
  muteBtn.setAttribute('aria-label', fx.isMuted() ? 'Activar sonido' : 'Silenciar sonido');
};
function toggleMute() { fx.setMuted(!fx.isMuted()); showMute(); }
muteBtn.onclick = toggleMute;
showMute();

document.querySelectorAll('.modes button').forEach(b => (b.onclick = () => b.dataset.mode !== mode && setMode(b.dataset.mode, true)));
$('.again').onclick = pullLever;
$('.copy').onclick = async () => {
  const label = $('.copy span');
  try { await navigator.clipboard.writeText(text(combo)); label.textContent = '¡Copiada!'; }
  catch { label.textContent = 'No se pudo copiar'; }
  setTimeout(() => (label.textContent = 'Copiar idea'), 1200);
};
addEventListener('resize', () => spinning || reels.forEach(r => place(r, 1)));

setMode(mode);
let raw;
try {
  raw = Object.fromEntries(await Promise.all(REELS.map(async r => [r, await (await fetch(`data/${r}.json`)).json()])));
  pools = load(raw);
} catch (e) {
  $('.wait').textContent = 'No se pudieron cargar las ideas. Arranca la app con "npm run dev"; abrir index.html con doble clic no funciona.';
  throw e;
}
const items = REELS.flatMap(r => raw[r]);
meta.init({ items, restore });
$('.next-num').textContent = ticketNum(meta.num() + 1);
$('.frag-count').textContent = `${items.length} fragmentos`;

const shared = meta.parseShare(location.hash);
if (shared) {
  restore(shared.combo, shared.mode, 'Compartida');
  history.replaceState(null, '', location.pathname); // que recargar no vuelva a abrirla
} else {
  combo = spin(pools, mode);
  reels.forEach((reel, k) => show(reel, [filler(k), combo[k], filler(k)]));
}
