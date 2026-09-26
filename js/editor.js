/** Playlist editor entry: wire DOM events and boot. */
import { $, say, state, readStoredUiLang, emptyItem } from './editor/core.js';
import { toast, setMenu, closeAllMoreMenus, wireConfirmModal } from './editor/ui.js';
import { inspectAudioUrl } from './editor/audio.js';
import { resolveWebUrl, stationRootFromEditor } from './url.js';
import {
  updateStationSummary,
  updatePulse,
  writeStationFields,
  adopt,
  openStationModal,
  closeStationModal,
  openJsonModal,
  copyJson,
  downloadJson,
  openPublishModal,
  closePublishModal,
  persistPublishHintFromUi,
} from './editor/station.js';
import {
  openHealthModal,
  cancelHealthCheck,
  runHealthCheck,
  applyHealthFixes,
  clearTrackHealth,
  pruneHealthFixes,
  resetHealthState,
} from './editor/health.js';
import { renderLists } from './editor/tracks.js';
import {
  configureMetaChrome,
  stopMetaPlayer,
  syncMetaPlayer,
  openUrlModal,
  openMetaModal,
  readMetaFormTrack,
} from './editor/track-form.js';
import { loadEditorLanguage } from './editor/i18n.js';
import {
  loadLanguageCatalog,
  fillUiLanguageSelect,
  fillStationLanguageSelect,
} from './editor/languages.js';
import {
  schedulePersist,
  initPersistAfterOnAirLoad,
  restoreRecovery,
  discardRecovery,
  openDraftsModal,
  saveActiveDraft,
  openSaveAsModal,
  saveDraftAsNew,
  returnToOnAir,
  adoptImportedJson,
} from './editor/persist.js';

function downloadAndExplain() {
  downloadJson();
  if (!openPublishModal()) {
    toast(say('station.json downloaded'));
  }
}

$('menu-btn').addEventListener('click', () => {
  closeSaveMenu();
  setMenu(!$('menu').classList.contains('is-open'));
});
$('menu-backdrop').addEventListener('click', () => setMenu(false));
$('open-player').addEventListener('click', () => setMenu(false));

$('download').addEventListener('click', downloadAndExplain);
$('menu-download').addEventListener('click', () => {
  setMenu(false);
  downloadAndExplain();
});
$('menu-view-json').addEventListener('click', openJsonModal);
$('json-copy').addEventListener('click', copyJson);
$('json-close').addEventListener('click', () => $('modal-json').close());
$('publish-close').addEventListener('click', closePublishModal);
$('modal-publish').addEventListener('close', persistPublishHintFromUi);
$('menu-publish-help').addEventListener('click', () => {
  openPublishModal({ force: true });
});

$('menu-drafts').addEventListener('click', openDraftsModal);
$('menu-on-air').addEventListener('click', () => { returnToOnAir(); });
$('drafts-close').addEventListener('click', () => $('modal-drafts').close());
$('draft-save').addEventListener('click', () => {
  closeSaveMenu();
  saveActiveDraft();
});
$('draft-save-as').addEventListener('click', () => {
  closeSaveMenu();
  openSaveAsModal();
});
$('draft-name-cancel').addEventListener('click', () => $('modal-draft-name').close());
$('form-draft-name').addEventListener('submit', (e) => {
  e.preventDefault();
  if (saveDraftAsNew($('draft-name-input').value)) {
    $('modal-draft-name').close();
    if ($('modal-drafts').open) openDraftsModal();
  }
});
$('recovery-restore').addEventListener('click', () => { restoreRecovery(); });
$('recovery-discard').addEventListener('click', () => { discardRecovery(); });

function closeSaveMenu() {
  const dd = $('save-dropdown');
  const btn = $('save-menu-btn');
  if (dd) dd.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleSaveMenu() {
  const dd = $('save-dropdown');
  const btn = $('save-menu-btn');
  if (!dd || !btn) return;
  const open = dd.hidden;
  closeAllMoreMenus();
  dd.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

$('save-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSaveMenu();
});

$('ui-language').addEventListener('change', () => {
  loadEditorLanguage($('ui-language').value || 'en');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.item-more')) closeAllMoreMenus();
  if (!e.target.closest('#save-menu-wrap')) closeSaveMenu();
});

$('add-track').addEventListener('click', () => {
  setMenu(false);
  openUrlModal();
});

$('url-cancel').addEventListener('click', () => $('modal-url').close());

$('form-url').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('m-url').value.trim();
  $('modal-url-error').hidden = true;
  if (!url) return;
  if (!resolveWebUrl(url, stationRootFromEditor(location.href))) {
    $('modal-url-error').hidden = false;
    $('modal-url-error').textContent = say('That does not look like a valid URL.');
    return;
  }

  $('url-next').disabled = true;
  $('url-next').textContent = say('Checking…');
  const probe = await inspectAudioUrl(url);
  $('url-next').disabled = false;
  $('url-next').textContent = say('Continue');

  if (!probe.ok) {
    $('modal-url-error').hidden = false;
    $('modal-url-error').textContent = say('Could not reach that audio file.');
    return;
  }

  $('modal-url').close();
  openMetaModal(url, probe);
});

$('m-meta-url').addEventListener('input', syncMetaPlayer);
$('modal-meta').addEventListener('close', () => { stopMetaPlayer(); });

$('meta-back').addEventListener('click', () => {
  stopMetaPlayer();
  if (state.editIndex != null) {
    $('modal-meta').close();
    state.editIndex = null;
    return;
  }
  $('modal-meta').close();
  openUrlModal();
  $('m-url').value = state.draftUrl;
});

$('form-meta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const editing = state.editIndex != null;
  let url = editing ? $('m-meta-url').value.trim() : state.draftUrl;
  const duration = Number($('m-duration').value);
  if (!(duration > 0)) {
    $('m-duration').classList.add('needs-duration');
    $('m-duration').focus();
    return;
  }
  if (!url) {
    if (editing) {
      $('m-meta-url').focus();
    }
    return;
  }
  if (!resolveWebUrl(url, stationRootFromEditor(location.href))) {
    toast(say('That does not look like a valid URL.'));
    if (editing) $('m-meta-url').focus();
    return;
  }

  let softWarn = '';
  if (editing && url !== state.editOriginalUrl) {
    $('meta-add').disabled = true;
    $('meta-add').textContent = say('Saving…');
    const probe = await inspectAudioUrl(url);
    $('meta-add').disabled = false;
    configureMetaChrome();
    if (!probe.ok) {
      softWarn = say('Audio URL changed but could not be verified. Duration left as entered.');
    } else if (probe.duration && !(Number($('m-duration').value) > 0)) {
      $('m-duration').value = String(probe.duration);
    }
  }

  const track = readMetaFormTrack(
    url,
    Number($('m-duration').value) || duration,
    editing ? state.tracks[state.editIndex].disabled : false,
  );

  if (editing) {
    const i = state.editIndex;
    const prev = state.tracks[i];
    const urlChanged = String(prev.url || '').trim() !== String(track.url || '').trim();
    const durChanged = Number(prev.duration) !== Number(track.duration);
    Object.assign(prev, track);
    if (urlChanged || durChanged) {
      clearTrackHealth(prev);
      pruneHealthFixes();
    }
    state.editIndex = null;
    stopMetaPlayer();
    $('modal-meta').close();
    renderLists();
    if (softWarn) toast(softWarn);
    else toast(say('Track updated.'));
    const row = $('tracks').querySelector(`.item[data-index="${i}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  state.tracks.push(track);
  stopMetaPlayer();
  $('modal-meta').close();
  renderLists();
  toast(say('Track added.'));
  const last = $('tracks').querySelector('.item:last-child');
  last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('tracks').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const item = btn.closest('.item');
  const index = Number(item.dataset.index);
  const list = state.tracks;
  const action = btn.dataset.action;

  if (action === 'duplicate') {
    const src = list[index];
    if (src) {
      list.splice(index + 1, 0, {
        ...emptyItem(),
        url: src.url || '',
        duration: src.duration ?? '',
        title: src.title || '',
        credit: src.credit || '',
        artUrl: src.artUrl || '',
        link: src.link || '',
        description: src.description || '',
        disabled: Boolean(src.disabled),
      });
    }
  }
  if (action === 'remove') {
    clearTrackHealth(list[index]);
    list.splice(index, 1);
    pruneHealthFixes();
  }
  if (action === 'jump-up' && index > 0) {
    const [row] = list.splice(index, 1);
    list.unshift(row);
  }
  if (action === 'jump-down' && index < list.length - 1) {
    const [row] = list.splice(index, 1);
    list.push(row);
  }
  if (action === 'toggle-disable') {
    list[index].disabled = !list[index].disabled;
  }
  closeAllMoreMenus();
  renderLists();
});

$('station-settings-btn').addEventListener('click', () => {
  closeSaveMenu();
  openStationModal();
});
$('menu-station').addEventListener('click', openStationModal);
$('menu-health').addEventListener('click', openHealthModal);
$('health-close').addEventListener('click', () => {
  cancelHealthCheck();
  $('modal-health').close();
});
$('health-run').addEventListener('click', () => { runHealthCheck(); });
$('health-fix').addEventListener('click', applyHealthFixes);
$('modal-health').addEventListener('close', () => { cancelHealthCheck(); });
$('health-issue-close').addEventListener('click', () => $('modal-health-issue').close());
$('station-cancel').addEventListener('click', () => {
  closeStationModal(true);
  schedulePersist();
});
$('form-station').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!Number.isFinite(Number(state.epoch))) {
    state.epoch = Math.floor(Date.now() / 1000);
  }
  const dayStart = $('f-dayStart').value.trim();
  if (dayStart && !$('f-timezone').value.trim()) {
    $('f-timezone').value = 'UTC';
  }
  state.stationSnapshot = null;
  $('modal-station').close();
  updateStationSummary();
  updatePulse();
  schedulePersist();
  toast(say('Station updated.'));
});

['f-name', 'f-accent', 'f-mode', 'f-dayStart', 'f-timezone'].forEach((id) => {
  $(id).addEventListener('input', () => {
    updateStationSummary();
    updatePulse();
    schedulePersist();
  });
  $(id).addEventListener('change', () => {
    updateStationSummary();
    updatePulse();
    schedulePersist();
  });
});

$('load').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  setMenu(false);
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (await adoptImportedJson(data)) {
      toast(say('JSON loaded into the editor.'));
    }
  } catch {
    toast(say('Could not read that file.'));
  }
});

async function boot() {
  await loadLanguageCatalog();
  fillUiLanguageSelect();
  fillStationLanguageSelect();
  await loadEditorLanguage(readStoredUiLang());
  try {
    const r = await fetch('../station.json', { cache: 'no-store' });
    if (r.ok) {
      adopt(await r.json());
    } else {
      throw new Error('missing');
    }
  } catch {
    writeStationFields({
      id: 'my-station',
      name: 'My station',
      accent: '#6a7f8c',
      language: 'en',
      mode: 'shuffle',
      epoch: Math.floor(Date.now() / 1000),
    });
    state.tracks = [];
    resetHealthState();
    renderLists();
  }
  initPersistAfterOnAirLoad();
  wireConfirmModal();
  $('recovery-restore').textContent = say('Restore');
  $('recovery-discard').textContent = say('Discard');
  setInterval(() => {
    if (document.hidden) return;
    updatePulse();
  }, 2000);
}

boot();
