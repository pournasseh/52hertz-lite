/** Pure helpers for drafts/recovery (DOM-free, testable). */

export const MAX_DRAFTS = 20;
/** Soft per-key limit so one huge playlist cannot silently fill localStorage. */
export const MAX_STORAGE_BYTES = 1_500_000;

export function fingerprintData(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

export function isDirtyFingerprint(baselineFp, currentFp) {
  return Boolean(baselineFp) && currentFp !== baselineFp;
}

/** True when editor already matches clean on-air (no draft, not dirty). */
export function isAlreadyCleanOnAir(activeDraftId, dirty, onAirFp, currentFp) {
  return !activeDraftId
    && !dirty
    && Boolean(onAirFp)
    && currentFp === onAirFp;
}

/** After deleting the active draft, baseline returns to on-air. */
export function baselineAfterActiveDraftDeleted(onAirFp) {
  return onAirFp || '';
}

export function jsonByteLength(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function fitsStorageBudget(value, maxBytes = MAX_STORAGE_BYTES) {
  return jsonByteLength(value) <= maxBytes;
}

/** Next free draft-N from a list of drafts. */
export function nextDraftNameFromList(items) {
  const used = new Set();
  (items || []).forEach((d) => {
    const m = /^draft-(\d+)$/i.exec(String(d && d.name != null ? d.name : '').trim());
    if (m) used.add(Number(m[1]));
  });
  let n = 1;
  while (used.has(n)) n += 1;
  return 'draft-' + n;
}

/** Keep newest drafts only (assumes items may be unsorted). */
export function capDrafts(items, max = MAX_DRAFTS) {
  const list = Array.isArray(items) ? items.slice() : [];
  list.sort((a, b) => ((b && b.savedAt) || 0) - ((a && a.savedAt) || 0));
  if (list.length <= max) return list;
  return list.slice(0, max);
}

/**
 * Publish-hint checkbox mode:
 * - hide: checked → store hide flag
 * - show-again: checked → clear hide flag
 */
export function nextPublishHintHidden(currentlyHidden, mode, checked) {
  if (!checked) return currentlyHidden;
  if (mode === 'show-again') return false;
  return true;
}
