import { buildStation, resolve, skewFromResponse } from './52hertz.js';
import { resolveWebUrl } from './url.js';

const DRIFT = 8;
const RESYNC_GAP = 10;
const PLAY_PATH = 'M8 5l12 7-12 7z';
const STOP_PATH = 'M7 7h10v10H7z';

const el = (id) => document.getElementById(id);
const ui = {
  app: el('app'),
  hero: el('stage-art'),
  name: el('station-name'),
  tagline: el('station-tagline'),
  onair: el('onair-text'),
  eyebrow: el('eyebrow'),
  title: el('title'),
  credit: el('credit'),
  length: el('length'),
  sleeve: el('sleeve'),
  sleeveImg: el('sleeve-img'),
  sleeveLetter: el('sleeve-letter'),
  queueTitle: el('queue-title'),
  later: el('later'),
  more: el('more'),
  play: el('play'),
  glyph: el('play-glyph'),
  share: el('share'),
  notice: el('notice'),
  about: el('about'),
  aboutTitle: el('about-title'),
  shut: el('shut'),
  aboutArtImg: el('about-art-img'),
  aboutArtLetter: el('about-art-letter'),
  aboutKicker: el('about-kicker'),
  aboutTrackTitle: el('about-track-title'),
  aboutTrackCredit: el('about-track-credit'),
  aboutStart: el('about-start'),
  aboutDuration: el('about-duration'),
  countdownLeft: el('countdown-left'),
  countdownTime: el('countdown-time'),
  description: el('about-description'),
  link: el('track-link'),
  foot: el('foot'),
  colophon: el('colophon'),
  home: el('home-link'),
  toast: el('toast'),
  audio: el('audio'),
  favicon: el('favicon'),
};

const state = {
  station: null,
  words: {},
  langMeta: { direction: 'ltr', locale: 'en', digits: null },
  skew: 0,
  armed: false,
  curKey: null,
  heroUrl: null,
  sleeveUrl: null,
  aboutArtUrl: null,
  lastResync: 0,
  seekTo: null,
  failedUntil: 0,
  toastTimer: 0,
};

const stationBase = new URL('./', location.href).href;
const safeStationUrl = (raw) => resolveWebUrl(raw, stationBase);

const now = () => Date.now() / 1000 + state.skew;

const say = (key, vars) => {
  let s = state.words[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll('{' + k + '}', String(v));
    }
  }
  return s;
};

const digits = (n) => {
  const d = state.langMeta.digits;
  const s = String(n);
  return d ? s.replace(/\d/g, (c) => d[c] || c) : s;
};

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return digits(m) + ':' + digits(String(r).padStart(2, '0'));
};

const hhmm = (unixSec) => {
  const d = new Date(unixSec * 1000);
  const loc = state.langMeta.locale || 'en';
  try {
    return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return digits(d.getHours()) + ':' + digits(String(d.getMinutes()).padStart(2, '0'));
  }
};

function showImage(node, url, apply) {
  const resolved = safeStationUrl(url);
  if (!resolved) { apply(''); return; }
  const img = new Image();
  img.onload = () => apply(resolved);
  img.onerror = () => apply('');
  img.src = resolved;
}

function paintHero(url) {
  if (url === state.heroUrl) return;
  state.heroUrl = url;
  showImage(ui.hero, url, (shown) => {
    ui.hero.style.backgroundImage = shown ? 'url("' + shown + '")' : '';
    ui.hero.toggleAttribute('data-ready', Boolean(shown));
  });
}

function paintSleeve(url, letter) {
  ui.sleeveLetter.textContent = letter;
  if (url === state.sleeveUrl) return;
  state.sleeveUrl = url;
  showImage(ui.sleeveImg, url, (shown) => {
    ui.sleeveImg.hidden = !shown;
    if (!shown) { ui.sleeveImg.removeAttribute('data-ready'); return; }
    ui.sleeveImg.src = shown;
    requestAnimationFrame(() => ui.sleeveImg.setAttribute('data-ready', ''));
  });
}

function paintAboutArt(url, letter) {
  ui.aboutArtLetter.textContent = letter;
  if (url === state.aboutArtUrl) return;
  state.aboutArtUrl = url;
  showImage(ui.aboutArtImg, url, (shown) => {
    ui.aboutArtImg.hidden = !shown;
    if (!shown) { ui.aboutArtImg.removeAttribute('data-ready'); return; }
    ui.aboutArtImg.src = shown;
    requestAnimationFrame(() => ui.aboutArtImg.setAttribute('data-ready', ''));
  });
}

function artFor(item) {
  return (item && item.artUrl) || (state.station && state.station.artUrl) || '';
}

function applyWords() {
  ui.more.setAttribute('aria-label', say('About this track'));
  ui.more.title = say('About this track');
  ui.share.setAttribute('aria-label', say('Share'));
  ui.share.title = say('Share');
  ui.shut.setAttribute('aria-label', say('Close'));
  ui.aboutTitle.textContent = say('About this track');
  ui.aboutKicker.textContent = say('Now playing');
  ui.queueTitle.textContent = say('Coming up');
  ui.eyebrow.textContent = say('Now playing');
  paintChrome();
}

function paintChrome() {
  const playing = state.armed && !ui.audio.paused;
  ui.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
  ui.play.setAttribute('aria-label', playing ? say('Stop') : say('Tune in'));
  ui.play.title = playing ? say('Stop') : say('Tune in');
  ui.glyph.setAttribute('d', playing ? STOP_PATH : PLAY_PATH);
}

async function loadLanguage(code) {
  const tryCodes = [code, code.split('-')[0], 'en'];
  for (const c of tryCodes) {
    try {
      const r = await fetch('languages/' + encodeURIComponent(c) + '.json', { cache: 'no-store' });
      if (!r.ok) continue;
      const data = await r.json();
      state.words = data.player || {};
      state.langMeta = {
        direction: (data.language && data.language.direction) === 'rtl' ? 'rtl' : 'ltr',
        locale: (data.language && data.language.locale) || c,
        digits: (data.language && data.language.digits) || null,
      };
      document.documentElement.lang = c;
      document.documentElement.dir = state.langMeta.direction;
      return;
    } catch { /* try next */ }
  }
  state.words = {};
}

function adoptStation(raw) {
  const station = buildStation(raw);
  state.station = station;
  document.title = station.name;
  ui.name.textContent = station.name;
  ui.tagline.textContent = station.tagline;
  document.documentElement.style.setProperty('--accent', station.accent);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', station.accent);
  const logo = safeStationUrl(station.logoUrl);
  if (logo) ui.favicon.href = logo;
  else ui.favicon.removeAttribute('href');
  ui.colophon.textContent = station.colophon;
  const home = safeStationUrl(station.homeUrl);
  if (home) {
    ui.home.hidden = false;
    ui.home.href = home;
    try { ui.home.textContent = new URL(home).host; }
    catch { ui.home.textContent = station.homeUrl; }
  } else {
    ui.home.hidden = true;
    ui.home.removeAttribute('href');
  }
  ui.foot.hidden = !station.colophon && !home;
  paintHero(station.artUrl);
}

function setBodyState(s) {
  document.body.dataset.state = s;
}

function renderOffAir(pos) {
  setBodyState('offair');
  ui.onair.textContent = say('off air');
  ui.title.textContent = say('Off air');
  ui.credit.textContent = '';
  ui.length.textContent = '';
  ui.later.innerHTML = '';
  if (pos && pos.reason === 'not-yet' && pos.backAt) {
    ui.notice.textContent = say('Back on air at {time}', { time: hhmm(pos.backAt) });
  } else {
    ui.notice.textContent = say('Nothing to play');
  }
  paintSleeve(state.station.artUrl, (state.station.name || '?').charAt(0).toUpperCase());
}

function renderNext(pos) {
  ui.later.innerHTML = '';
  if (!pos || !pos.next) return;
  const n = pos.next;
  const li = document.createElement('li');
  const art = document.createElement('span');
  art.className = 'later-art';
  const cover = artFor(n);
  if (cover) art.style.backgroundImage = 'url("' + cover + '")';
  const words = document.createElement('span');
  words.className = 'later-words';
  const name = document.createElement('span');
  name.className = 'later-name';
  name.dir = 'auto';
  name.textContent = n.title || n.url;
  const credit = document.createElement('span');
  credit.className = 'later-credit';
  credit.dir = 'auto';
  credit.textContent = n.credit || '';
  words.append(name, credit);
  li.append(art, words);
  ui.later.append(li);
}

function renderTrack(pos) {
  const item = pos.item;
  const title = item.title || item.url;
  const letter = title.trim().charAt(0).toUpperCase() || '?';
  const cover = artFor(item);

  ui.title.textContent = title;
  ui.credit.textContent = item.credit || '';
  ui.length.textContent = mmss(item.duration);
  paintSleeve(cover, letter);
  paintAboutArt(cover, letter);
  paintHero(state.station.artUrl);

  ui.aboutTrackTitle.textContent = title;
  ui.aboutTrackCredit.textContent = item.credit || '';
  ui.aboutStart.textContent = say('Starts at {time}', { time: hhmm(pos.slotStart) });
  ui.aboutDuration.textContent = say('{time} total', { time: mmss(item.duration) });

  if (item.description) {
    ui.description.hidden = false;
    ui.description.textContent = item.description;
  } else {
    ui.description.hidden = true;
    ui.description.textContent = '';
  }

  const itemLink = safeStationUrl(item.link);
  if (itemLink) {
    ui.link.hidden = false;
    ui.link.href = itemLink;
    ui.link.textContent = say('Open this track’s page');
  } else {
    ui.link.hidden = true;
    ui.link.removeAttribute('href');
  }

  renderNext(pos);
  renderCountdown(pos);
  badge(title, cover);
}

function renderCountdown(pos) {
  const t = now();
  const left = Math.max(0, pos.slotEnd - t);
  const frac = pos.item.duration > 0 ? left / pos.item.duration : 0;
  ui.countdownLeft.style.setProperty('--left', (frac * 100) + '%');
  ui.countdownTime.textContent = say('{time} left', { time: mmss(left) });
}

function badge(title, cover) {
  if (!('mediaSession' in navigator) || !state.station) return;
  const artwork = cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || state.station.name,
      artist: state.station.name,
      album: state.station.tagline || state.station.name,
      artwork,
    });
    navigator.mediaSession.setActionHandler('play', () => tuneIn());
    navigator.mediaSession.setActionHandler('pause', () => stop());
    navigator.mediaSession.setActionHandler('stop', () => stop());
  } catch { /* some browsers reject handlers */ }
}

function slotKey(pos) {
  if (!pos || pos.state !== 'on-air') return null;
  return pos.cycle + ':' + pos.index + ':' + pos.item.url;
}

function applySeek(seconds) {
  const target = Math.max(0, seconds);
  try {
    if (Number.isFinite(ui.audio.duration) && ui.audio.duration > 0) {
      ui.audio.currentTime = Math.min(target, Math.max(0, ui.audio.duration - 0.05));
    } else {
      ui.audio.currentTime = target;
    }
    state.seekTo = null;
  } catch {
    /* not seekable yet — keep seekTo for loadedmetadata */
  }
}

function cue(pos, play) {
  const item = pos.item;
  state.curKey = slotKey(pos);
  state.seekTo = pos.offset;
  state.lastResync = now();
  const audioUrl = safeStationUrl(item.url);
  if (!audioUrl) {
    state.failedUntil = pos.slotEnd;
    ui.notice.textContent = say('This track would not load. Rejoining at {time}.', { time: hhmm(pos.slotEnd) });
    renderTrack(pos);
    return;
  }
  ui.audio.src = audioUrl;
  ui.audio.load();
  if (play) {
    ui.play.setAttribute('data-busy', '');
    const start = () => {
      if (state.seekTo != null) applySeek(state.seekTo);
      ui.audio.play().then(() => {
        ui.play.removeAttribute('data-busy');
        paintChrome();
        setBodyState('playing');
      }).catch(() => {
        ui.play.removeAttribute('data-busy');
        ui.notice.textContent = say('The browser asked for a tap before playing sound.');
        state.armed = false;
        paintChrome();
      });
    };
    if (ui.audio.readyState >= 1) start();
    else ui.audio.addEventListener('loadedmetadata', start, { once: true });
  }
  renderTrack(pos);
}

function tick() {
  if (!state.station) return;
  const t = now();
  if (t < state.failedUntil) return;

  const pos = resolve(state.station, t);
  if (pos.state !== 'on-air') {
    if (state.armed) stop();
    renderOffAir(pos);
    paintChrome();
    return;
  }

  setBodyState(state.armed && !ui.audio.paused ? 'playing' : 'ready');
  ui.onair.textContent = say('on air');
  if (!ui.play.hasAttribute('data-busy')) ui.notice.textContent = '';

  const key = slotKey(pos);
  if (key !== state.curKey) {
    cue(pos, state.armed);
  } else {
    renderCountdown(pos);
    if (
      state.armed
      && state.seekTo == null
      && !ui.audio.paused
      && ui.audio.readyState >= 2
      && Number.isFinite(ui.audio.currentTime)
    ) {
      const drift = Math.abs(ui.audio.currentTime - pos.offset);
      if (drift > DRIFT && t - state.lastResync > RESYNC_GAP) {
        state.lastResync = t;
        applySeek(pos.offset);
      }
    }
  }
  paintChrome();
}

function tuneIn() {
  if (!state.station) return;
  state.armed = true;
  const pos = resolve(state.station, now());
  if (pos.state !== 'on-air') {
    renderOffAir(pos);
    return;
  }
  cue(pos, true);
  paintChrome();
}

function stop() {
  state.armed = false;
  state.seekTo = null;
  ui.audio.pause();
  ui.play.removeAttribute('data-busy');
  paintChrome();
  setBodyState(state.station ? 'ready' : 'loading');
}

function toast(msg) {
  ui.toast.hidden = false;
  ui.toast.textContent = msg;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 2200);
}

async function share() {
  const station = state.station;
  if (!station) return;
  const url = location.href;
  const title = station.name;
  const text = say('Listen to {station}', { station: title });
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch { /* fall through */ }
  try {
    await navigator.clipboard.writeText(url);
    toast(say('Link copied.'));
  } catch {
    toast(url);
  }
}

function openAbout(open) {
  ui.app.toggleAttribute('data-about', open);
  ui.more.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) ui.about.removeAttribute('inert');
  else ui.about.setAttribute('inert', '');
}

ui.play.addEventListener('click', () => {
  if (state.armed && !ui.audio.paused) stop();
  else tuneIn();
});
ui.more.addEventListener('click', () => openAbout(!ui.app.hasAttribute('data-about')));
ui.shut.addEventListener('click', () => openAbout(false));
ui.share.addEventListener('click', () => share());

ui.audio.addEventListener('playing', () => {
  ui.play.removeAttribute('data-busy');
  paintChrome();
  setBodyState('playing');
});
ui.audio.addEventListener('loadedmetadata', () => {
  if (state.seekTo != null) applySeek(state.seekTo);
});
ui.audio.addEventListener('pause', () => paintChrome());
ui.audio.addEventListener('ended', () => {
  // File ended early or on the boundary — rejoin from the clock.
  state.curKey = null;
  if (state.armed) tick();
});
ui.audio.addEventListener('error', () => {
  ui.play.removeAttribute('data-busy');
  const pos = state.station ? resolve(state.station, now()) : null;
  const until = pos && pos.slotEnd ? pos.slotEnd : now() + 30;
  state.failedUntil = until;
  ui.notice.textContent = say('This track would not load. Rejoining at {time}.', { time: hhmm(until) });
});

async function boot() {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch('station.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
  } catch {
    setBodyState('error');
    ui.notice.textContent = say('The station could not be reached.');
    ui.onair.textContent = say('off air');
    return;
  }
  const t1 = Date.now();
  state.skew = skewFromResponse(res, t0, t1);

  let raw;
  try {
    raw = await res.json();
  } catch {
    setBodyState('error');
    ui.notice.textContent = say('This station published something this player cannot read.');
    return;
  }

  try {
    adoptStation(raw);
  } catch {
    setBodyState('error');
    ui.notice.textContent = say('This station published something this player cannot read.');
    return;
  }

  await loadLanguage(state.station.language);
  applyWords();
  setBodyState('ready');
  tick();
  setInterval(tick, 1000);
}

boot();
