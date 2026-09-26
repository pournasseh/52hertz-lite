/** Station fields, pulse card, JSON import/export. */
import { buildStation, resolve } from '../52hertz.js';
import { $, say, state, emptyItem } from './core.js';
import { toast, setMenu } from './ui.js';
import { formatSpan, mmss, slugId, decodeDescription } from './util.js';
import { renderLists } from './tracks.js';
import { resetHealthState } from './health.js';
import { nextPublishHintHidden } from './persist-utils.js';

export function updateStationSummary() {
  const accent = $('f-accent').value;
  if (/^#[0-9a-f]{6}$/i.test(accent)) {
    document.documentElement.style.setProperty('--accent', accent);
  }
}

export function previewPosition() {
  try {
    const station = buildStation({
      ...readStationFields(),
      tracks: state.tracks,
    });
    return resolve(station, Math.floor(Date.now() / 1000));
  } catch {
    return null;
  }
}

export function findLiveIndex(pos) {
  if (!pos || pos.state !== 'on-air' || !pos.item) return -1;
  const url = String(pos.item.url || '').trim();
  if (!url) return -1;
  return state.tracks.findIndex((t) => !t.disabled && String(t.url || '').trim() === url);
}

export function paintLiveRows(index) {
  document.querySelectorAll('#tracks .item').forEach((el) => {
    el.classList.toggle('is-live', Number(el.dataset.index) === index);
  });
}

/** Status badge only — cheap enough to call on every dirty sync. */
export function updatePulseStatus() {
  if (!$('pulse-onair')) return;
  const live = state.tracks.filter((t) => !t.disabled && Number(t.duration) > 0);
  const epoch = Number(state.epoch);
  const pos = live.length && Number.isFinite(epoch) ? previewPosition() : null;
  paintPulseStatus($('pulse-onair'), $('pulse-onair-text'), pos, live.length, epoch);
}

function paintPulseStatus(onair, onairText, pos, liveCount, epoch) {
  if (!onair || !onairText) return;
  onair.classList.remove('is-on', 'is-off', 'is-draft', 'is-unsaved');
  if (state.isDirty) {
    onair.hidden = false;
    onair.classList.add('is-unsaved');
    onairText.textContent = say('unsaved');
    onairText.removeAttribute('dir');
    return;
  }
  if (state.activeDraftName) {
    onair.hidden = false;
    onair.classList.add('is-draft');
    onairText.textContent = state.activeDraftName;
    onairText.dir = 'auto';
    return;
  }
  if (!liveCount || !Number.isFinite(epoch)) {
    onair.hidden = true;
    onairText.removeAttribute('dir');
    return;
  }
  onair.hidden = false;
  const on = Boolean(pos && pos.state === 'on-air');
  onair.classList.toggle('is-on', on);
  onair.classList.toggle('is-off', !on);
  onairText.textContent = on ? say('on air') : say('off air');
  onairText.removeAttribute('dir');
}

export function updatePulse() {
  if (!$('pulse-card')) return;

  const live = state.tracks.filter((t) => !t.disabled && Number(t.duration) > 0);
  const totalSec = live.reduce((n, t) => n + Number(t.duration), 0);
  const avgSec = live.length ? totalSec / live.length : 0;
  const name = $('f-name').value.trim() || say('This station');
  const epoch = Number(state.epoch);
  const now = Math.floor(Date.now() / 1000);
  const pos = live.length && Number.isFinite(epoch) ? previewPosition() : null;
  const liveIndex = findLiveIndex(pos);
  state.liveIndex = liveIndex;

  $('pulse-kicker').textContent = say('Station');
  $('pulse-line').textContent = name;
  $('lbl-stat-tracks').textContent = say('Tracks');
  $('lbl-stat-duration').textContent = say('One pass');
  $('lbl-stat-avg').textContent = say('Average');
  if ($('pulse-now-kicker')) $('pulse-now-kicker').textContent = say('Now playing');

  const onair = $('pulse-onair');
  const onairText = $('pulse-onair-text');
  paintPulseStatus(onair, onairText, pos, live.length, epoch);

  if (!live.length) {
    $('stat-tracks').textContent = '0';
    $('stat-duration').textContent = '—';
    $('stat-avg').textContent = '—';
    if ($('pulse-now')) $('pulse-now').hidden = true;
    paintLiveRows(-1);
    return;
  }

  $('stat-tracks').textContent = String(live.length);
  $('stat-duration').textContent = formatSpan(totalSec);
  $('stat-avg').textContent = formatSpan(avgSec);

  if (pos && pos.state === 'on-air' && pos.item) {
    const left = Math.max(0, pos.slotEnd - now);
    const title = pos.item.title || say('Untitled track');
    $('pulse-now').hidden = false;
    $('pulse-now-title').textContent = pos.item.credit
      ? title + ' · ' + pos.item.credit
      : title;
    $('pulse-now-meta').textContent = say('{time} left')
      .replace('{time}', mmss(left))
      + ' · '
      + mmss(pos.offset)
      + ' / '
      + mmss(pos.item.duration);
  } else if ($('pulse-now')) {
    $('pulse-now').hidden = true;
  }

  paintLiveRows(liveIndex);
}

export function readStationFields() {
  const dayStart = $('f-dayStart').value.trim();
  const timezone = $('f-timezone').value.trim();
  const epoch = Number.isFinite(Number(state.epoch))
    ? Number(state.epoch)
    : Math.floor(Date.now() / 1000);
  const id = String(state.stationId || '').trim() || slugId($('f-name').value);
  const out = {
    id,
    name: $('f-name').value.trim(),
    tagline: $('f-tagline').value.trim(),
    accent: $('f-accent').value.trim(),
    language: $('f-language').value.trim() || 'en',
    logoUrl: $('f-logoUrl').value.trim(),
    artUrl: $('f-artUrl').value.trim(),
    homeUrl: $('f-homeUrl').value.trim(),
    colophon: $('f-colophon').value.trim(),
    mode: $('f-mode').value === 'order' ? 'order' : 'shuffle',
    epoch,
  };
  if (dayStart) {
    out.dayStart = dayStart.length === 5 ? dayStart : dayStart.slice(0, 5);
    out.timezone = timezone || 'UTC';
  }
  return out;
}

export function writeStationFields(data) {
  $('f-name').value = data.name || '';
  $('f-tagline').value = data.tagline || '';
  $('f-accent').value = /^#[0-9a-f]{6}$/i.test(data.accent || '') ? data.accent : '#6a7f8c';
  const lang = data.language || 'en';
  if (![...$('f-language').options].some((o) => o.value === lang)) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    $('f-language').append(opt);
  }
  $('f-language').value = lang;
  $('f-mode').value = data.mode === 'order' ? 'order' : 'shuffle';
  $('f-dayStart').value = data.dayStart || '';
  $('f-timezone').value = data.timezone || '';
  $('f-logoUrl').value = data.logoUrl || '';
  $('f-artUrl').value = data.artUrl || '';
  $('f-homeUrl').value = data.homeUrl || '';
  $('f-colophon').value = data.colophon || '';
  state.epoch = Number.isFinite(Number(data.epoch))
    ? Number(data.epoch)
    : Math.floor(Date.now() / 1000);
  state.stationId = String(data.id || '').trim() || slugId(data.name);
  updateStationSummary();
}

export function cleanItems(list) {
  return list
    .map((it) => ({
      url: it.url,
      duration: Number(it.duration),
      title: it.title,
      credit: it.credit,
      artUrl: it.artUrl,
      link: it.link,
      description: it.description,
      disabled: Boolean(it.disabled),
    }))
    .filter((it) => it.url && Number.isFinite(it.duration) && it.duration > 0)
    .map((it) => {
      const out = { url: it.url, duration: it.duration, title: it.title };
      if (it.credit) out.credit = it.credit;
      if (it.artUrl) out.artUrl = it.artUrl;
      if (it.link) out.link = it.link;
      if (it.description) out.description = it.description;
      if (it.disabled) out.disabled = true;
      return out;
    });
}

export function buildJson() {
  return {
    ...readStationFields(),
    tracks: cleanItems(state.tracks),
  };
}

export function adopt(data) {
  writeStationFields(data);
  resetHealthState();
  state.tracks = Array.isArray(data.tracks) && data.tracks.length
    ? data.tracks.map((t) => ({
      ...emptyItem(),
      url: t.url || '',
      duration: t.duration ?? '',
      title: t.title || '',
      credit: t.credit || '',
      artUrl: t.artUrl || '',
      link: t.link || '',
      description: decodeDescription(t.description || ''),
      disabled: Boolean(t.disabled),
    }))
    : [];
  renderLists();
}

export function openStationModal() {
  setMenu(false);
  state.stationSnapshot = readStationFields();
  $('modal-station').showModal();
  setTimeout(() => $('f-name').focus(), 50);
}

export function closeStationModal(revert) {
  if (revert && state.stationSnapshot) {
    writeStationFields(state.stationSnapshot);
  }
  state.stationSnapshot = null;
  $('modal-station').close();
  updatePulse();
}

export function openJsonModal() {
  setMenu(false);
  const text = JSON.stringify(buildJson(), null, 2) + '\n';
  $('json-view').textContent = text;
  $('modal-json').showModal();
}

export async function copyJson() {
  const text = $('json-view').textContent || '';
  try {
    await navigator.clipboard.writeText(text);
    toast(say('Copied.'));
  } catch {
    // Fallback for older browsers / insecure contexts
    const range = document.createRange();
    range.selectNodeContents($('json-view'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try {
      document.execCommand('copy');
      toast(say('Copied.'));
    } catch {
      toast(say('Could not copy.'));
    }
  }
}

/** Try to reach the audio URL and read duration when the browser allows it. */

export function downloadJson() {
  const data = buildJson();
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'station.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

const PUBLISH_HINT_KEY = '52hertz-lite.hidePublishHint';

/** 'hide' = checkbox stores hide preference; 'show-again' = checkbox clears it. */
let publishHintMode = 'hide';

export function shouldShowPublishModal() {
  try {
    return localStorage.getItem(PUBLISH_HINT_KEY) !== '1';
  } catch {
    return true;
  }
}

export function clearPublishHintHidden() {
  try { localStorage.removeItem(PUBLISH_HINT_KEY); } catch { /* */ }
}

/** Save checkbox preference from the open publish dialog. */
export function persistPublishHintFromUi() {
  const checked = Boolean($('publish-dont-show')?.checked);
  const currentlyHidden = !shouldShowPublishModal();
  const hidden = nextPublishHintHidden(currentlyHidden, publishHintMode, checked);
  if (hidden) {
    try { localStorage.setItem(PUBLISH_HINT_KEY, '1'); } catch { /* */ }
  } else {
    clearPublishHintHidden();
  }
}

export function openPublishModal(opts = {}) {
  const force = Boolean(opts.force);
  const tipHidden = !shouldShowPublishModal();
  if (!force && tipHidden) return false;

  setMenu(false);
  $('publish-dont-show').checked = false;

  if (force) {
    // Re-read help without silently changing preference.
    publishHintMode = tipHidden ? 'show-again' : 'hide';
    $('modal-publish-title').textContent = say('How to publish');
    $('modal-publish-lead').textContent = say('Download JSON is not live by itself. Listeners keep hearing the old playlist until you replace station.json on your host.');
    $('publish-step-1').textContent = say('In the editor, download station.json (or use a JSON file you already have).');
    $('publish-step-2').textContent = say('Upload it to your static host.');
    $('publish-step-3').textContent = say('Replace the existing station.json in the same folder as the player (next to index.html).');
    $('lbl-publish-dont-show').textContent = tipHidden
      ? say('Show tip after downloads again')
      : say("Don't show this again in this browser");
  } else {
    publishHintMode = 'hide';
    $('modal-publish-title').textContent = say('station.json downloaded');
    $('modal-publish-lead').textContent = say('This file is not live yet. Listeners keep hearing the old playlist until you replace station.json on your host.');
    $('publish-step-1').textContent = say('Find the downloaded station.json on your device.');
    $('publish-step-2').textContent = say('Upload it to your static host.');
    $('publish-step-3').textContent = say('Replace the existing station.json in the same folder as the player (next to index.html).');
    $('lbl-publish-dont-show').textContent = say("Don't show this again in this browser");
  }

  $('publish-close').textContent = say('Got it');
  $('modal-publish').showModal();
  return true;
}

export function closePublishModal() {
  $('modal-publish')?.close();
}
