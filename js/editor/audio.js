/** Probe an audio URL for reachability + browser duration. */
import { resolveWebUrl, stationRootFromEditor } from '../url.js';


export function inspectAudioUrl(url) {
  return new Promise((resolve) => {
    const resolved = resolveWebUrl(url, stationRootFromEditor(location.href));
    if (!resolved) { resolve({ ok: false, reason: 'invalid-url' }); return; }
    const audio = new Audio();
    audio.preload = 'metadata';
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      audio.removeAttribute('src');
      try { audio.load(); } catch { /* */ }
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), 12000);
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timer);
      const duration = Number(audio.duration);
      finish({
        ok: true,
        duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : null,
      });
    });
    audio.addEventListener('error', () => {
      clearTimeout(timer);
      finish({ ok: false, reason: 'error' });
    });
    audio.src = resolved;
  });
}
