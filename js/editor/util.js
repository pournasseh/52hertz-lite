/** Small pure-ish helpers shared by station / tracks / forms. */
import { say } from './core.js';
import { resolveWebUrl, stationRootFromEditor } from '../url.js';

export function formatSpan(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  if (!n) return '—';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) {
    return say('{h}h {m}m')
      .replace('{h}', String(h))
      .replace('{m}', String(m));
  }
  if (m > 0) {
    return say('{m}m {s}s')
      .replace('{m}', String(m))
      .replace('{s}', String(s));
  }
  return say('{s}s').replace('{s}', String(s));
}

export function mmss(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  const s = Math.round(n);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function titleFromUrl(url) {
  try {
    const resolved = resolveWebUrl(url, stationRootFromEditor(location.href));
    if (!resolved) return '';
    const path = decodeURIComponent(new URL(resolved).pathname.split('/').pop() || '');
    return path.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  } catch {
    return '';
  }
}

export function slugId(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'station';
}

export function decodeDescription(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
}
