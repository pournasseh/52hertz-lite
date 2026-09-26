/** Editor UI language pack load + label apply. */
import { $, say, state, storeUiLang } from './core.js';
import { configureMetaChrome } from './track-form.js';
import { syncHealthApplyBar } from './health.js';
import { updateStationSummary, updatePulse } from './station.js';
import { renderLists } from './tracks.js';
import { catalogHas } from './languages.js';

export async function loadEditorLanguage(code) {
  let next = String(code || 'en').trim().toLowerCase() || 'en';
  if (state.languageCatalog && state.languageCatalog.length && !catalogHas(next)) {
    next = state.languageCatalog[0].code;
  }
  state.uiLang = next;
  storeUiLang(next);
  try {
    const r = await fetch('../languages/' + encodeURIComponent(next) + '.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('missing');
    const data = await r.json();
    state.words = data.editor || {};
    document.documentElement.lang = next;
    document.documentElement.dir = (data.language && data.language.direction) === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    if (next !== 'en') {
      return loadEditorLanguage('en');
    }
    state.words = {};
  }
  if ($('ui-language')) $('ui-language').value = next;
  applyLabels();
  if ($('tracks')) renderLists();
}

export function applyLabels() {
  $('page-title').textContent = say('Playlist editor');
  $('drawer-brand-title').textContent = '52hertz-lite';
  $('drawer-brand-tag').textContent = say('Playlist editor');
  $('lbl-load').textContent = say('Load JSON');
  $('lbl-menu-download').textContent = say('Download JSON');
  $('lbl-view-json').textContent = say('View JSON');
  $('lbl-menu-station').textContent = say('Station settings');
  $('lbl-menu-health').textContent = say('Health check');
  if ($('lbl-menu-drafts')) $('lbl-menu-drafts').textContent = say('Drafts');
  if ($('lbl-menu-on-air')) $('lbl-menu-on-air').textContent = say('Load on-air');
  if ($('lbl-menu-publish-help')) $('lbl-menu-publish-help').textContent = say('How to publish');
  if ($('lbl-draft-save')) $('lbl-draft-save').textContent = say('Save draft');
  if ($('lbl-draft-save-as')) $('lbl-draft-save-as').textContent = say('Save as new draft');
  $('lbl-ui-language').textContent = say('Language');
  $('download-label').textContent = say('Download JSON');
  $('add-track-label').textContent = say('Add track');
  $('open-player-label').textContent = say('Open player');
  $('h-tracks').textContent = say('Tracks');
  $('menu-btn').setAttribute('aria-label', say('Menu'));
  $('station-settings-btn').setAttribute('aria-label', say('Station settings'));
  if ($('save-menu-btn')) $('save-menu-btn').setAttribute('aria-label', say('Save'));
  if ($('recovery-restore')) $('recovery-restore').textContent = say('Restore');
  if ($('recovery-discard')) $('recovery-discard').textContent = say('Discard');
  import('./persist.js').then((m) => m.syncDirtyChrome()).catch(() => {});

  $('modal-station-title').textContent = say('Station settings');
  $('station-cancel').textContent = say('Cancel');
  $('station-save').textContent = say('Save');
  [...$('f-mode').options].forEach((opt) => {
    const key = opt.getAttribute('data-i18n-option');
    if (key) opt.textContent = say(key);
  });

  $('modal-health-title').textContent = say('Health check');
  $('health-lead').textContent = say('Checks every audio URL and duration. Results appear as icons beside each track.');
  $('health-close').textContent = say('Close');
  $('health-run').textContent = say('Start check');
  syncHealthApplyBar();

  $('modal-url-title').textContent = say('Add track');
  $('modal-url-lead').textContent = say('Paste the audio URL. We will check that the file is reachable.');
  $('url-cancel').textContent = say('Cancel');
  $('url-next').textContent = say('Continue');

  configureMetaChrome();
  $('modal-meta-warn').textContent = say('Wrong duration breaks sync for every listener.');
  $('modal-json-title').textContent = 'station.json';
  $('json-copy').textContent = say('Copy');
  $('json-close').textContent = say('Close');

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = say(node.getAttribute('data-i18n'));
  });
  updateStationSummary();
  updatePulse();
}
