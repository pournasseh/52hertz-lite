/** Add / edit track URL + metadata modals. */
import { $, say, state, emptyItem } from './core.js';
import { closeAllMoreMenus } from './ui.js';
import { titleFromUrl, decodeDescription } from './util.js';
import { resolveWebUrl, stationRootFromEditor } from '../url.js';

export function configureMetaChrome() {
  const editing = state.editIndex != null;
  $('meta-url-field').hidden = !editing;
  $('m-meta-url').required = editing;
  if (editing) {
    $('modal-meta-title').textContent = say('Edit track');
    $('meta-back').textContent = say('Cancel');
    $('meta-add').textContent = say('Save');
  } else {
    $('modal-meta-title').textContent = say('Track details');
    $('meta-back').textContent = say('Back');
    $('meta-add').textContent = say('Add to list');
  }
  syncMetaPlayer();
}

export function metaPreviewUrl() {
  if (state.editIndex != null) {
    return $('m-meta-url').value.trim() || state.draftUrl || '';
  }
  return state.draftUrl || $('m-meta-url').value.trim() || '';
}

export function stopMetaPlayer() {
  const audio = $('meta-player');
  if (!audio) return;
  audio.pause();
  audio.removeAttribute('src');
  try { audio.load(); } catch { /* */ }
}

export function syncMetaPlayer() {
  const wrap = $('meta-player-wrap');
  const audio = $('meta-player');
  if (!wrap || !audio) return;
  const url = metaPreviewUrl();
  if (!url) {
    wrap.hidden = true;
    stopMetaPlayer();
    return;
  }
  wrap.hidden = false;
  const current = audio.getAttribute('src') || '';
  const resolved = resolveWebUrl(url, stationRootFromEditor(location.href));
  if (!resolved) {
    wrap.hidden = true;
    stopMetaPlayer();
    return;
  }
  if (current !== resolved) {
    audio.pause();
    audio.src = resolved;
  }
}

export function openUrlModal() {
  state.editIndex = null;
  state.editOriginalUrl = '';
  $('m-url').value = '';
  $('modal-url-error').hidden = true;
  $('url-next').disabled = false;
  $('url-next').textContent = say('Continue');
  $('modal-url').showModal();
  setTimeout(() => $('m-url').focus(), 50);
}

/** Turn leftover literal \n sequences into real newlines (bad JSON exports). */

export function fillMetaFields({ url, title, credit, duration, artUrl, link, description, probed }) {
  $('m-meta-url').value = url || '';
  $('m-title').value = title || '';
  $('m-credit').value = credit || '';
  $('m-duration').value = duration != null && duration !== '' ? String(duration) : '';
  $('m-artUrl').value = artUrl || '';
  $('m-link').value = link || '';
  $('m-description').value = decodeDescription(description);
  state.metaFromFile = Boolean(probed);
  $('m-duration').classList.toggle('needs-duration', !state.metaFromFile);
  $('modal-meta-note').hidden = state.metaFromFile;
  $('modal-meta-note').textContent = state.metaFromFile
    ? ''
    : say('Duration could not be read automatically. Enter it carefully.');
}

export function openMetaModal(url, probe) {
  stopMetaPlayer();
  state.editIndex = null;
  state.editOriginalUrl = '';
  state.draftUrl = url;
  fillMetaFields({
    url,
    title: titleFromUrl(url),
    credit: '',
    duration: probe && probe.duration ? probe.duration : '',
    artUrl: '',
    link: '',
    description: '',
    probed: Boolean(probe && probe.duration),
  });
  configureMetaChrome();
  $('modal-meta').showModal();
  setTimeout(() => (state.metaFromFile ? $('m-title') : $('m-duration')).focus(), 50);
}

export function openEditModal(index) {
  const item = state.tracks[index];
  if (!item) return;
  closeAllMoreMenus();
  stopMetaPlayer();
  state.editIndex = index;
  state.editOriginalUrl = String(item.url || '');
  state.draftUrl = state.editOriginalUrl;
  fillMetaFields({
    url: item.url,
    title: item.title,
    credit: item.credit,
    duration: item.duration,
    artUrl: item.artUrl,
    link: item.link,
    description: item.description,
    probed: Number(item.duration) > 0,
  });
  configureMetaChrome();
  $('modal-meta').showModal();
  setTimeout(() => $('m-title').focus(), 50);
}

export function readMetaFormTrack(url, duration, disabled) {
  return {
    ...emptyItem(),
    url,
    duration: String(duration),
    title: $('m-title').value.trim(),
    credit: $('m-credit').value.trim(),
    artUrl: $('m-artUrl').value.trim(),
    link: $('m-link').value.trim(),
    description: $('m-description').value.trim(),
    disabled: Boolean(disabled),
  };
}
