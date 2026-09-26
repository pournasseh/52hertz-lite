/** Shell chrome: toast, drawer, icons, track kebab helpers, confirm. */
import { $, say } from './core.js';

const ICONS = {
  jumpUp: '<path d="M5 6h14"/><path d="M12 19V9"/><path d="M7 13l5-5 5 5"/>',
  jumpDown: '<path d="M5 18h14"/><path d="M12 5v10"/><path d="M7 11l5 5 5-5"/>',
  disable: '<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>',
  enable: '<circle cx="12" cy="12" r="8"/><path d="M8.2 12.3l2.4 2.4 5.2-5.5"/>',
  remove: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  duplicate: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M6 14V5.5A1.5 1.5 0 0 1 7.5 4H16"/>',
  more: '<circle cx="12" cy="5.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.5" r="1.4"/>',
  grip: '<circle cx="9" cy="6" r="1.35"/><circle cx="15" cy="6" r="1.35"/><circle cx="9" cy="12" r="1.35"/><circle cx="15" cy="12" r="1.35"/><circle cx="9" cy="18" r="1.35"/><circle cx="15" cy="18" r="1.35"/>',
  healthOk: '<path d="M20 6.5L9.5 17 4 11.5"/>',
  healthWarn: '<path d="M12 8v5"/><circle cx="12" cy="16.5" r="1"/><path d="M10.2 4.8h3.6L19 19.2H5z"/>',
  healthBad: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1"/>',
};

export function svgIcon(key) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ''}</svg>`;
}

export function mkMoreItem(label, action, iconKey, danger) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'more-item' + (danger ? ' danger' : '');
  b.dataset.action = action;
  b.innerHTML = svgIcon(iconKey) + '<span></span>';
  b.querySelector('span').textContent = label;
  return b;
}

export function closeAllMoreMenus(except) {
  document.querySelectorAll('.more-menu').forEach((menu) => {
    if (menu !== except) {
      menu.hidden = true;
      menu.classList.remove('is-up');
    }
  });
  document.querySelectorAll('.more-btn[aria-expanded="true"]').forEach((btn) => {
    if (!except || btn.nextElementSibling !== except) {
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

export function placeMoreMenu(btn, menu) {
  menu.classList.remove('is-up');
  menu.hidden = false;
  const btnRect = btn.getBoundingClientRect();
  const menuH = menu.offsetHeight || 280;
  const bar = document.querySelector('.bottom-bar');
  const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  const spaceBelow = barTop - btnRect.bottom - 8;
  const spaceAbove = btnRect.top - 8;
  if (spaceBelow < menuH && spaceAbove > spaceBelow) {
    menu.classList.add('is-up');
  }
}

let toastTimer = 0;
export function toast(msg) {
  const n = $('toast');
  const openDialog = document.querySelector('dialog[open]');
  (openDialog || document.body).appendChild(n);
  n.hidden = false;
  n.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    n.hidden = true;
    document.body.appendChild(n);
  }, 2200);
}

let menuCloseTimer = 0;
export function setMenu(open) {
  const el = $('menu');
  clearTimeout(menuCloseTimer);
  $('menu-btn').setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('is-open');
  } else {
    el.classList.remove('is-open');
    menuCloseTimer = setTimeout(() => {
      el.hidden = true;
    }, 200);
  }
}

let confirmResolver = null;

function settleConfirm(ok) {
  const dlg = $('modal-confirm');
  if (dlg?.open) dlg.close();
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) resolve(Boolean(ok));
}

/** App-styled confirm (never window.confirm). Resolves true/false. */
export function askConfirm({
  title = '',
  message = '',
  confirmLabel = '',
  cancelLabel = '',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    if (confirmResolver) settleConfirm(false);
    confirmResolver = resolve;
    const dlg = $('modal-confirm');
    const okBtn = $('confirm-ok');
    $('confirm-title').textContent = title || say('Confirm');
    $('confirm-message').textContent = message || '';
    $('confirm-cancel').textContent = cancelLabel || say('Cancel');
    okBtn.textContent = confirmLabel || say('OK');
    okBtn.className = 'btn' + (danger ? ' danger' : ' primary');
    dlg.showModal();
    setTimeout(() => okBtn.focus(), 40);
  });
}

export function wireConfirmModal() {
  const dlg = $('modal-confirm');
  if (!dlg || dlg.dataset.wired) return;
  dlg.dataset.wired = '1';
  $('confirm-cancel').addEventListener('click', () => settleConfirm(false));
  $('confirm-ok').addEventListener('click', () => settleConfirm(true));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    settleConfirm(false);
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) settleConfirm(false);
  });
}
