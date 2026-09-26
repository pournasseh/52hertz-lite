/** Local recovery autosave + named drafts (browser storage only).
 * Boot always loads on-air station.json; recovery is never applied silently.
 */
import { $, say, state } from './core.js';
import { toast, setMenu, askConfirm, svgIcon } from './ui.js';
import { buildJson, updatePulseStatus } from './station.js';
import {
  fingerprintData,
  nextDraftNameFromList,
  capDrafts,
  MAX_DRAFTS,
  isDirtyFingerprint,
  isAlreadyCleanOnAir,
  baselineAfterActiveDraftDeleted,
  fitsStorageBudget,
} from './persist-utils.js';

const SCHEMA = 1;
const RECOVERY_KEY = '52hertz-lite.recovery';
const DRAFTS_KEY = '52hertz-lite.drafts';
const DEBOUNCE_MS = 700;
const CHROME_MS = 120;

let baselineFp = '';
let saveTimer = 0;
let chromeTimer = 0;
let beforeUnloadBound = false;
let persistReady = false;
let lastStatusKey = '';
let recoveryWriteFailed = false;
let visibilityBound = false;

export function fingerprint(data) {
  return fingerprintData(data);
}

export function currentFingerprint() {
  return fingerprint(buildJson());
}

function computeDirty() {
  return isDirtyFingerprint(baselineFp, currentFingerprint());
}

/** Accurate dirty check (builds JSON). Prefer schedulePersist for edit paths. */
export function isDirty() {
  return computeDirty();
}

function applyDirtyState(dirty) {
  state.isDirty = dirty;
  document.body.classList.toggle('is-dirty', dirty);
  bindBeforeUnload(dirty);
  syncDraftChrome();
}

export function markBaselineClean() {
  baselineFp = currentFingerprint();
  clearRecovery();
  applyDirtyState(false);
}

export function markBaselineOnly() {
  baselineFp = currentFingerprint();
  applyDirtyState(false);
}

function cloneJson(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return null;
  }
}

function rememberOnAir(data) {
  const snap = cloneJson(data) || buildJson();
  state.onAirSnapshot = snap;
  state.onAirFingerprint = fingerprint(snap);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!fitsStorageBudget(value)) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readRecovery() {
  const env = readJson(RECOVERY_KEY, null);
  if (!env || env.v !== SCHEMA || !env.data || typeof env.data !== 'object') return null;
  return env;
}

export function clearRecovery() {
  try { localStorage.removeItem(RECOVERY_KEY); } catch { /* */ }
  hideRecoveryBar();
}

function writeRecovery(data) {
  const ok = writeJson(RECOVERY_KEY, {
    v: SCHEMA,
    savedAt: Date.now(),
    data,
  });
  if (ok) {
    recoveryWriteFailed = false;
    return true;
  }
  if (!recoveryWriteFailed) {
    recoveryWriteFailed = true;
    toast(say('Could not autosave. Storage may be full.'));
  }
  return false;
}

export function listDrafts() {
  const env = readJson(DRAFTS_KEY, { v: SCHEMA, items: [] });
  const items = Array.isArray(env.items) ? env.items.slice() : [];
  items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return items;
}

function writeDrafts(items) {
  return writeJson(DRAFTS_KEY, { v: SCHEMA, items: capDrafts(items, MAX_DRAFTS) });
}

function newDraftId() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Next free draft-N name (skips gaps left by deletes). */
export function nextDraftName() {
  return nextDraftNameFromList(listDrafts());
}

export function getActiveDraftId() {
  return state.activeDraftId || null;
}

export function setActiveDraftId(id, name) {
  state.activeDraftId = id || null;
  if (!id) {
    state.activeDraftName = '';
  } else if (name != null && String(name).trim()) {
    state.activeDraftName = String(name).trim();
  } else {
    const draft = listDrafts().find((d) => d.id === id);
    state.activeDraftName = draft ? String(draft.name || '') : '';
  }
  syncDraftChrome();
}

/** Confirm before throwing away dirty editor state. */
export async function confirmDiscardIfDirty(message) {
  flushPersist();
  if (!computeDirty()) return true;
  return askConfirm({
    title: say('Unsaved changes'),
    message: message || say('You have unsaved changes. Discard them?'),
    confirmLabel: say('Discard'),
    cancelLabel: say('Cancel'),
    danger: true,
  });
}

export function saveActiveDraft() {
  const id = getActiveDraftId();
  if (!id) return false;
  const items = listDrafts();
  const i = items.findIndex((d) => d.id === id);
  if (i < 0) return false;
  items[i] = {
    ...items[i],
    savedAt: Date.now(),
    data: buildJson(),
  };
  if (!writeDrafts(items)) {
    toast(say('Could not save draft.'));
    return false;
  }
  state.activeDraftName = String(items[i].name || state.activeDraftName || '');
  markBaselineOnly();
  clearRecovery();
  toast(say('Draft saved.'));
  renderDraftsList();
  return true;
}

export function saveDraftAsNew(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  const items = listDrafts();
  const id = newDraftId();
  items.unshift({
    id,
    name: trimmed,
    savedAt: Date.now(),
    data: buildJson(),
  });
  const before = items.length;
  if (!writeDrafts(items)) {
    toast(say('Could not save draft.'));
    return false;
  }
  if (before > MAX_DRAFTS) {
    toast(say('Oldest drafts were removed to stay under the limit.'));
  }
  setActiveDraftId(id, trimmed);
  markBaselineOnly();
  clearRecovery();
  toast(say('Draft saved.'));
  renderDraftsList();
  return true;
}

export async function openDraft(id) {
  if (id === getActiveDraftId()) {
    $('modal-drafts')?.close();
    return true;
  }
  const draft = listDrafts().find((d) => d.id === id);
  if (!draft || !draft.data) return false;
  if (!(await confirmDiscardIfDirty(
    say('You have unsaved changes. Discard them and open this draft?'),
  ))) {
    return false;
  }
  const { adopt } = await import('./station.js');
  adopt(draft.data);
  setActiveDraftId(draft.id, draft.name);
  markBaselineOnly();
  clearRecovery();
  setMenu(false);
  $('modal-drafts')?.close();
  toast(say('Draft opened.'));
  return true;
}

export async function deleteDraft(id) {
  const wasActive = getActiveDraftId() === id;
  const items = listDrafts().filter((d) => d.id !== id);
  if (!writeDrafts(items)) {
    toast(say('Could not save draft.'));
    return false;
  }
  if (wasActive) {
    // Keep content, but identity returns to on-air baseline so badge stays honest.
    setActiveDraftId(null);
    baselineFp = baselineAfterActiveDraftDeleted(state.onAirFingerprint);
    applyDirtyState(computeDirty());
    if (state.isDirty) schedulePersist();
    else clearRecovery();
  }
  renderDraftsList();
  toast(say('Draft deleted.'));
  return true;
}

/** Reload published station.json (or cached snapshot). */
export async function returnToOnAir() {
  flushPersist();
  if (isAlreadyCleanOnAir(
    getActiveDraftId(),
    computeDirty(),
    state.onAirFingerprint,
    currentFingerprint(),
  )) {
    setMenu(false);
    toast(say('Already on air.'));
    return true;
  }
  if (!(await confirmDiscardIfDirty(
    say('You have unsaved changes. Discard them and reload on-air?'),
  ))) {
    return false;
  }
  const { adopt } = await import('./station.js');
  let data = null;
  try {
    const r = await fetch('../station.json', { cache: 'no-store' });
    if (r.ok) data = await r.json();
  } catch { /* use snapshot */ }
  if (!data && state.onAirSnapshot) data = cloneJson(state.onAirSnapshot);
  if (!data) {
    toast(say('Could not load on-air JSON.'));
    return false;
  }
  adopt(data);
  rememberOnAir(data);
  setActiveDraftId(null);
  baselineFp = state.onAirFingerprint;
  clearRecovery();
  applyDirtyState(false);
  setMenu(false);
  $('modal-drafts')?.close();
  toast(say('On-air playlist loaded.'));
  return true;
}

/** After Load JSON file: detach from draft, dirty vs on-air. */
export async function adoptImportedJson(data) {
  if (!(await confirmDiscardIfDirty(
    say('You have unsaved changes. Discard them and load this file?'),
  ))) {
    return false;
  }
  const { adopt } = await import('./station.js');
  adopt(data);
  setActiveDraftId(null);
  baselineFp = state.onAirFingerprint || '';
  applyDirtyState(computeDirty());
  if (state.isDirty) {
    writeRecovery(buildJson());
  } else {
    clearRecovery();
  }
  return true;
}

export function schedulePersist() {
  if (!persistReady) return;
  // Show unsaved immediately; reconcile within CHROME_MS so Undo clears the badge fast.
  if (!state.isDirty) applyDirtyState(true);
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => {
    chromeTimer = 0;
    applyDirtyState(computeDirty());
  }, CHROME_MS);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushPersist();
  }, DEBOUNCE_MS);
}

export function flushPersist() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  clearTimeout(chromeTimer);
  chromeTimer = 0;
  if (!persistReady) return;
  const dirty = computeDirty();
  applyDirtyState(dirty);
  if (!dirty) {
    clearRecovery();
    return;
  }
  writeRecovery(buildJson());
}

function onBeforeUnload(e) {
  if (!computeDirty()) return;
  flushPersist();
  e.preventDefault();
  e.returnValue = '';
}

function bindBeforeUnload(on) {
  if (on && !beforeUnloadBound) {
    window.addEventListener('beforeunload', onBeforeUnload);
    beforeUnloadBound = true;
  } else if (!on && beforeUnloadBound) {
    window.removeEventListener('beforeunload', onBeforeUnload);
    beforeUnloadBound = false;
  }
}

export function syncDirtyChrome() {
  applyDirtyState(computeDirty());
}

export function syncDraftChrome() {
  const saveBtn = $('draft-save');
  if (saveBtn) saveBtn.disabled = !getActiveDraftId();
  const key = `${state.isDirty ? 1 : 0}|${state.activeDraftId || ''}|${state.activeDraftName || ''}`;
  if (key === lastStatusKey) return;
  lastStatusKey = key;
  updatePulseStatus();
}

function formatWhen(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export function hideRecoveryBar() {
  const bar = $('recovery-bar');
  if (bar) bar.hidden = true;
}

export function maybeShowRecoveryOffer() {
  const bar = $('recovery-bar');
  if (!bar) return;
  const recovery = readRecovery();
  if (!recovery) {
    bar.hidden = true;
    return;
  }
  const recFp = fingerprint(recovery.data);
  if (!recFp || recFp === baselineFp) {
    clearRecovery();
    return;
  }
  $('recovery-note').textContent = say('Unsaved work from {when} is available. On-air JSON stayed loaded.')
    .replace('{when}', formatWhen(recovery.savedAt) || '—');
  bar.hidden = false;
}

export async function restoreRecovery() {
  const recovery = readRecovery();
  if (!recovery || !recovery.data) return;
  if (!(await confirmDiscardIfDirty(
    say('You have unsaved changes. Discard them and restore recovered work?'),
  ))) {
    return;
  }
  const onAir = state.onAirFingerprint;
  const { adopt } = await import('./station.js');
  adopt(recovery.data);
  setActiveDraftId(null);
  baselineFp = onAir || currentFingerprint();
  hideRecoveryBar();
  writeRecovery(buildJson());
  applyDirtyState(computeDirty());
  toast(say('Unsaved work restored.'));
}

export function discardRecovery() {
  clearRecovery();
  toast(say('Unsaved work discarded.'));
}

export function openDraftsModal() {
  setMenu(false);
  $('modal-drafts-title').textContent = say('Drafts');
  $('drafts-close').textContent = say('Close');
  $('drafts-lead').textContent = say('Named drafts stay in this browser. Download JSON is still what you publish.');
  renderDraftsList();
  $('modal-drafts').showModal();
}

export function renderDraftsList() {
  const list = $('drafts-list');
  if (!list) return;
  list.innerHTML = '';
  const items = listDrafts();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'modal-note';
    empty.textContent = say('No drafts yet.');
    list.append(empty);
    return;
  }
  const active = getActiveDraftId();
  items.forEach((draft) => {
    const row = document.createElement('article');
    row.className = 'draft-row' + (draft.id === active ? ' is-active' : '');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.addEventListener('click', (e) => {
      if (e.target.closest('.draft-row-delete')) return;
      openDraft(draft.id);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openDraft(draft.id);
    });
    const main = document.createElement('div');
    main.className = 'draft-row-main';
    const title = document.createElement('p');
    title.className = 'draft-row-title';
    title.dir = 'auto';
    title.textContent = draft.name || say('Untitled draft');
    const meta = document.createElement('p');
    meta.className = 'draft-row-meta';
    meta.textContent = formatWhen(draft.savedAt);
    main.append(title, meta);
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'draft-row-delete';
    delBtn.setAttribute('aria-label', say('Delete'));
    delBtn.innerHTML = svgIcon('remove');
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const active = draft.id === getActiveDraftId();
      const ok = await askConfirm({
        title: say('Delete draft'),
        message: active
          ? say('Delete this draft? It will be removed from this browser. The current playlist stays in the editor as unsaved work until you save or reload on-air.')
          : say('Delete this draft?'),
        confirmLabel: say('Delete'),
        cancelLabel: say('Cancel'),
        danger: true,
      });
      if (ok) deleteDraft(draft.id);
    });
    row.append(main, delBtn);
    list.append(row);
  });
}

export function openSaveAsModal() {
  $('modal-draft-name-title').textContent = say('Save as new draft');
  $('draft-name-lead').textContent = say('Name this draft for this browser only.');
  $('draft-name-input').value = nextDraftName();
  $('draft-name-cancel').textContent = say('Cancel');
  $('draft-name-save').textContent = say('Save');
  $('modal-draft-name').showModal();
  setTimeout(() => {
    const input = $('draft-name-input');
    input?.focus();
    input?.select();
  }, 40);
}

/** Call after on-air JSON (or empty station) is in the editor. */
export function initPersistAfterOnAirLoad() {
  rememberOnAir(buildJson());
  baselineFp = state.onAirFingerprint;
  setActiveDraftId(null);
  persistReady = true;
  lastStatusKey = '';
  applyDirtyState(false);
  maybeShowRecoveryOffer();

  if (!visibilityBound) {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPersist();
    });
  }
}
