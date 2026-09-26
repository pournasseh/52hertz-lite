/** Pointer-driven track reordering. */
import { $, state } from './core.js';
import { closeAllMoreMenus } from './ui.js';
import { renderLists } from './tracks.js';

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function sortEdgePads() {
  const topBar = document.querySelector('.topbar');
  const bottomBar = document.querySelector('.bottom-bar');
  const top = (topBar ? topBar.getBoundingClientRect().bottom : 0) + 48;
  const bottom = (bottomBar
    ? window.innerHeight - bottomBar.getBoundingClientRect().top
    : 0) + 48;
  return { top, bottom };
}

export function stopSortAutoScroll() {
  const session = state.sort;
  if (!session) return;
  if (session.scrollRaf) {
    cancelAnimationFrame(session.scrollRaf);
    session.scrollRaf = 0;
  }
}

export function tickSortAutoScroll() {
  const session = state.sort;
  if (!session || !session.active) return;
  session.scrollRaf = 0;
  const y = session.lastY;
  if (y == null) return;

  const pads = sortEdgePads();
  const viewH = window.innerHeight;
  let speed = 0;
  if (y < pads.top) {
    speed = -Math.min(28, Math.ceil((pads.top - y) * 0.35));
  } else if (y > viewH - pads.bottom) {
    speed = Math.min(28, Math.ceil((y - (viewH - pads.bottom)) * 0.35));
  }

  if (speed) {
    const before = window.scrollY;
    window.scrollBy(0, speed);
    if (window.scrollY !== before) {
      placePlaceholderAt(y);
      moveFloat(session, session.lastX, y);
    }
    session.scrollRaf = requestAnimationFrame(tickSortAutoScroll);
  }
}

export function ensureSortAutoScroll() {
  const session = state.sort;
  if (!session || !session.active || session.scrollRaf) return;
  session.scrollRaf = requestAnimationFrame(tickSortAutoScroll);
}

export function endSortSession(commit) {
  const session = state.sort;
  if (!session) return;
  const list = $('tracks');
  const { from, wrap, floatEl, pointerId, handle } = session;
  stopSortAutoScroll();
  try { handle.releasePointerCapture(pointerId); } catch { /* */ }
  floatEl?.remove();
  wrap.classList.remove('is-placeholder');
  list?.classList.remove('is-sorting');
  document.body.classList.remove('is-sorting', 'is-sorting-motion');
  state.sort = null;

  if (!commit || !session.moved) {
    renderLists();
    return;
  }
  const to = [...list.children].indexOf(wrap);
  if (to < 0 || to === from) {
    renderLists();
    return;
  }
  const [row] = state.tracks.splice(from, 1);
  state.tracks.splice(to, 0, row);
  renderLists();
}

export function moveFloat(session, clientX, clientY) {
  if (!session.floatEl) return;
  const x = clientX - session.offsetX;
  const y = clientY - session.offsetY;
  const scale = session.reduceMotion ? 1 : 1.03;
  session.floatEl.style.transform =
    'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
}

export function placePlaceholderAt(clientY) {
  const session = state.sort;
  if (!session) return;
  const list = $('tracks');
  const wrap = session.wrap;
  const others = [...list.children].filter((el) => el !== wrap);
  let ref = null;
  for (const el of others) {
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      ref = el;
      break;
    }
  }
  if (ref) {
    if (wrap.nextSibling !== ref) list.insertBefore(wrap, ref);
  } else if (list.lastElementChild !== wrap) {
    list.append(wrap);
  }
}

export function beginSort(session, clientX, clientY) {
  const { wrap } = session;
  const list = $('tracks');
  const rect = wrap.getBoundingClientRect();
  const floatEl = wrap.cloneNode(true);
  floatEl.classList.add('item-float');
  if (session.reduceMotion) floatEl.classList.add('is-reduced');
  floatEl.classList.remove('is-placeholder', 'is-live', 'is-disabled');
  floatEl.removeAttribute('data-index');
  floatEl.style.width = rect.width + 'px';
  floatEl.querySelectorAll('[tabindex]').forEach((n) => n.removeAttribute('tabindex'));
  floatEl.querySelectorAll('button').forEach((n) => { n.tabIndex = -1; });
  document.body.append(floatEl);

  session.floatEl = floatEl;
  session.offsetX = clientX - rect.left;
  session.offsetY = clientY - rect.top;
  session.active = true;
  session.moved = true;
  session.lastX = clientX;
  session.lastY = clientY;

  wrap.classList.add('is-placeholder');
  list.classList.add('is-sorting');
  document.body.classList.add('is-sorting');
  if (!session.reduceMotion) document.body.classList.add('is-sorting-motion');
  moveFloat(session, clientX, clientY);
  ensureSortAutoScroll();
}

export function sortActivationDistance(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen' ? 12 : 5;
}

export function onSortPointerMove(e) {
  const session = state.sort;
  if (!session || e.pointerId !== session.pointerId) return;
  session.lastX = e.clientX;
  session.lastY = e.clientY;
  const dx = e.clientX - session.startX;
  const dy = e.clientY - session.startY;
  if (!session.active) {
    if (Math.hypot(dx, dy) < session.activateAt) return;
    // Touch: only start drag once movement is mostly vertical/any; handle already
    // has touch-action:none so page scroll is suppressed on the grip.
    beginSort(session, e.clientX, e.clientY);
    try { session.handle.setPointerCapture(session.pointerId); } catch { /* */ }
  }
  e.preventDefault();
  moveFloat(session, e.clientX, e.clientY);
  placePlaceholderAt(e.clientY);
  ensureSortAutoScroll();
}

export function onSortPointerUp(e) {
  const session = state.sort;
  if (!session || e.pointerId !== session.pointerId) return;
  document.removeEventListener('pointermove', onSortPointerMove);
  document.removeEventListener('pointerup', onSortPointerUp);
  document.removeEventListener('pointercancel', onSortPointerUp);
  endSortSession(true);
}

export function bindSortHandle(handle, wrap, index) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    closeAllMoreMenus();
    if (state.sort) endSortSession(false);

    state.sort = {
      from: index,
      wrap,
      handle,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      offsetX: 0,
      offsetY: 0,
      floatEl: null,
      active: false,
      moved: false,
      activateAt: sortActivationDistance(e.pointerType),
      reduceMotion: prefersReducedMotion(),
      scrollRaf: 0,
    };
    // Capture only after activation so tiny taps don't steal the gesture.
    document.addEventListener('pointermove', onSortPointerMove, { passive: false });
    document.addEventListener('pointerup', onSortPointerUp);
    document.addEventListener('pointercancel', onSortPointerUp);
  });
  handle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}
