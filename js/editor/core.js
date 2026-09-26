/** Shared editor state and tiny DOM/i18n accessors. */
export const LANG_KEY = '52hertz-lite.editorLang';

export const emptyItem = () => ({
  url: '',
  duration: '',
  title: '',
  credit: '',
  artUrl: '',
  link: '',
  description: '',
  disabled: false,
});

export const state = {
  words: {},
  tracks: [],
  draftUrl: '',
  editIndex: null,
  editOriginalUrl: '',
  metaFromFile: false,
  stationSnapshot: null,
  liveIndex: -1,
  healthFixes: [],
  healthMap: new WeakMap(),
  healthToken: 0,
  sort: null,
  activeDraftId: null,
  activeDraftName: '',
  isDirty: false,
  onAirFingerprint: '',
  onAirSnapshot: null,
  epoch: Math.floor(Date.now() / 1000),
  stationId: 'station',
  languageCatalog: [],
  uiLang: 'en',
};

export const $ = (id) => document.getElementById(id);
export const say = (k) => state.words[k] ?? k;

export function readStoredUiLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v && /^[a-z]{2}(-[a-z0-9]+)?$/i.test(v)) return v.toLowerCase();
  } catch { /* private mode */ }
  return 'en';
}

export function storeUiLang(code) {
  try { localStorage.setItem(LANG_KEY, code); } catch { /* */ }
}
