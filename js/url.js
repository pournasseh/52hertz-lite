/** Resolve station-owned resource references without allowing script/data URLs. */
export function resolveWebUrl(raw, baseHref) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value, baseHref);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/** The station root when code is running from /editor/. */
export function stationRootFromEditor(editorHref) {
  try {
    return new URL('../', editorHref).href;
  } catch {
    return '';
  }
}
