/** Track health probes, badges, and fix apply.
 * Status is keyed by track object identity (WeakMap), so reorder keeps
 * badges, duplicate URLs stay independent, and replacing/editing url|duration
 * drops stale results.
 */
import { $, say, state } from './core.js';
import { svgIcon, toast, setMenu, closeAllMoreMenus } from './ui.js';
import { inspectAudioUrl } from './audio.js';
import { renderLists } from './tracks.js';
import { updatePulse } from './station.js';
import { resolveWebUrl, stationRootFromEditor } from '../url.js';

const DURATION_SLACK = 1.25; // seconds — bigger than this counts as suspicious

export function resetHealthState() {
  state.healthMap = new WeakMap();
  state.healthFixes = [];
  syncHealthApplyBar();
}

export function clearTrackHealth(track) {
  if (!track) return;
  try { state.healthMap.delete(track); } catch { /* */ }
  state.healthFixes = state.healthFixes.filter((fix) => fix.track !== track);
}

export function pruneHealthFixes() {
  state.healthFixes = state.healthFixes.filter((fix) => state.tracks.includes(fix.track));
  syncHealthApplyBar();
}

export function healthDetailFor(item) {
  if (!item || !state.healthMap) return null;
  return state.healthMap.get(item) || null;
}

export function makeHealthBadge(item) {
  const detail = healthDetailFor(item);
  if (!detail) return null;
  const level = detail.level || 'bad';
  if (level === 'ok') {
    const badge = document.createElement('span');
    badge.className = 'health-badge is-ok';
    badge.setAttribute('aria-hidden', 'true');
    badge.title = say('OK');
    badge.innerHTML = svgIcon('healthOk');
    return badge;
  }
  const warn = level === 'warn';
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'health-badge is-clickable ' + (warn ? 'is-warn' : 'is-bad');
  const label = warn ? say('Warning') : say('Needs attention');
  badge.setAttribute('aria-label', label);
  badge.title = label;
  badge.innerHTML = svgIcon(warn ? 'healthWarn' : 'healthBad');
  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openHealthIssueModal(item, detail);
  });
  return badge;
}

export function openHealthIssueModal(item, detail) {
  closeAllMoreMenus();
  const title = item.title || say('Untitled track');
  $('health-issue-title').textContent = title;
  $('health-issue-title').dir = 'auto';
  const list = $('health-issue-list');
  list.innerHTML = '';
  const level = (detail && detail.level) || 'bad';
  const messages = (detail && detail.messages) || [say('Needs attention')];
  messages.forEach((msg) => {
    const li = document.createElement('li');
    li.className = 'is-' + level;
    li.dir = 'auto';
    li.textContent = msg;
    list.append(li);
  });
  $('modal-health-issue-heading').textContent = level === 'warn'
    ? say('Warning')
    : say('Track issue');
  $('health-issue-close').textContent = say('Close');
  $('modal-health-issue').showModal();
}

export function setHealthChrome(phase) {
  const running = phase === 'running';
  $('health-run').hidden = running;
  $('health-run').disabled = running || !state.tracks.length;
  $('health-close').textContent = running ? say('Cancel') : say('Close');
  if (phase === 'idle') {
    $('health-progress').textContent = state.tracks.length
      ? say('Press Start check when you are ready.')
      : say('No tracks to check.');
    $('health-run').textContent = say('Start check');
  }
}

export function syncHealthApplyBar() {
  const bar = $('health-apply-bar');
  const btn = $('health-fix');
  if (!bar || !btn) return;
  const n = state.healthFixes.filter((fix) => state.tracks.includes(fix.track)).length;
  if (!n) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('health-apply-note').textContent = say('{n} durations can be updated from the browser probe.')
    .replace('{n}', String(n));
  btn.textContent = say('Apply probed durations');
}

export function openHealthModal() {
  setMenu(false);
  state.healthToken += 1;
  setHealthChrome('idle');
  $('modal-health').showModal();
}

export function cancelHealthCheck() {
  state.healthToken += 1;
  if ($('modal-health').open) {
    setHealthChrome('idle');
  }
}

export async function runHealthCheck() {
  const tracks = state.tracks;
  if (!tracks.length) {
    setHealthChrome('idle');
    return;
  }

  const token = ++state.healthToken;
  state.healthFixes = [];
  syncHealthApplyBar();
  setHealthChrome('running');
  $('health-progress').textContent = say('Checking…');

  let ok = 0;
  let warn = 0;
  let bad = 0;

  for (let i = 0; i < tracks.length; i++) {
    if (token !== state.healthToken) return;

    const track = tracks[i];
    $('health-progress').textContent = say('Checking {n} of {total}…')
      .replace('{n}', String(i + 1))
      .replace('{total}', String(tracks.length));

    const url = String(track.url || '').trim();
    const stored = Number(track.duration);
    let level = 'ok';
    const messages = [];

    if (!url) {
      bad += 1;
      level = 'bad';
      messages.push(say('Missing audio URL.'));
    } else {
      const shapeOk = Boolean(resolveWebUrl(url, stationRootFromEditor(location.href)));
      if (!shapeOk) {
        bad += 1;
        level = 'bad';
        messages.push(say('That does not look like a valid URL.'));
      } else {
        const probe = await inspectAudioUrl(url);
        if (token !== state.healthToken) return;
        if (!probe.ok) {
          warn += 1;
          level = 'warn';
          messages.push(say('Editor could not read this URL (often CORS). The file may still play fine for listeners.'));
        } else if (!(stored > 0)) {
          warn += 1;
          level = 'warn';
          if (probe.duration) {
            messages.push(
              say('No duration stored. Browser reads {sec}s.')
                .replace('{sec}', String(probe.duration)),
            );
            state.healthFixes.push({ track, duration: probe.duration });
          } else {
            messages.push(say('No duration stored, and the browser could not read one.'));
            messages.push(say('This is a metadata warning, not proof the file is broken.'));
          }
        } else if (probe.duration == null) {
          warn += 1;
          level = 'warn';
          messages.push(
            say('Reachable, but duration could not be read. Stored {sec}s kept.')
              .replace('{sec}', String(stored)),
          );
          messages.push(say('This is a metadata warning, not proof the file is broken.'));
        } else {
          const delta = Math.abs(probe.duration - stored);
          if (delta > DURATION_SLACK) {
            warn += 1;
            level = 'warn';
            messages.push(
              say('Duration mismatch: stored {stored}s, browser {probed}s (Δ {delta}s).')
                .replace('{stored}', String(stored))
                .replace('{probed}', String(probe.duration))
                .replace('{delta}', String(Math.round(delta * 100) / 100)),
            );
            state.healthFixes.push({ track, duration: probe.duration });
          } else {
            ok += 1;
            level = 'ok';
          }
        }
      }
    }

    state.healthMap.set(track, { level, messages });
    renderLists();
  }

  if (token !== state.healthToken) return;

  pruneHealthFixes();
  renderLists();
  $('modal-health').close();
  toast(
    say('{ok} ok · {warn} warnings · {bad} failed.')
      .replace('{ok}', String(ok))
      .replace('{warn}', String(warn))
      .replace('{bad}', String(bad)),
  );
}

export function applyHealthFixes() {
  pruneHealthFixes();
  if (!state.healthFixes.length) return;
  let n = 0;
  for (const fix of state.healthFixes) {
    const i = state.tracks.indexOf(fix.track);
    if (i < 0) continue;
    state.tracks[i].duration = String(fix.duration);
    state.healthMap.set(fix.track, { level: 'ok', messages: [] });
    n += 1;
  }
  state.healthFixes = [];
  syncHealthApplyBar();
  renderLists();
  updatePulse();
  toast(say('Updated {n} durations.').replace('{n}', String(n)));
}
