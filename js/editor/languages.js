/** Discover language packs via languages/index.json (static-host friendly). */
import { $, state } from './core.js';

const INDEX_URL = '../languages/index.json';
const PACK_URL = (code) => '../languages/' + encodeURIComponent(code) + '.json';

function normalizeCodes(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && Array.isArray(raw.languages)) list = raw.languages;
  return list
    .map((c) => String(c || '').trim())
    .filter((c) => /^[a-z]{2}(-[a-z0-9]+)?$/i.test(c))
    .map((c) => c.toLowerCase());
}

/** Load catalog: [{ code, name, direction, locale }]. */
export async function loadLanguageCatalog() {
  let codes = ['en'];
  try {
    const r = await fetch(INDEX_URL, { cache: 'no-store' });
    if (r.ok) {
      const parsed = normalizeCodes(await r.json());
      if (parsed.length) codes = parsed;
    }
  } catch { /* keep en */ }

  const entries = [];
  for (const code of codes) {
    let name = code;
    let direction = 'ltr';
    let locale = code;
    try {
      const r = await fetch(PACK_URL(code), { cache: 'no-store' });
      if (r.ok) {
        const pack = await r.json();
        const meta = pack.language || {};
        if (meta.name) name = String(meta.name);
        if (meta.direction === 'rtl') direction = 'rtl';
        if (meta.locale) locale = String(meta.locale);
      }
    } catch { /* label = code */ }
    entries.push({ code, name, direction, locale });
  }

  if (!entries.length) {
    entries.push({ code: 'en', name: 'English', direction: 'ltr', locale: 'en' });
  }

  state.languageCatalog = entries;
  return entries;
}

function fillSelect(selectId, labelMode) {
  const sel = $(selectId);
  if (!sel) return;
  const prev = sel.value;
  const catalog = state.languageCatalog || [];
  sel.innerHTML = '';
  catalog.forEach(({ code, name }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = labelMode === 'code' ? code : name;
    sel.append(opt);
  });
  if (prev && [...sel.options].some((o) => o.value === prev)) {
    sel.value = prev;
  } else if (catalog[0]) {
    sel.value = catalog[0].code;
  }
}

/** Editor UI language picker — native names (English, فارسی, …). */
export function fillUiLanguageSelect() {
  fillSelect('ui-language', 'name');
}

/** Station.json language field — codes matching pack files. */
export function fillStationLanguageSelect() {
  fillSelect('f-language', 'code');
}

export function catalogHas(code) {
  const c = String(code || '').toLowerCase();
  return (state.languageCatalog || []).some((e) => e.code === c);
}
