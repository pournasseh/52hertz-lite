/** Track list rendering. */
import { $, say, state } from './core.js';
import { svgIcon, mkMoreItem, closeAllMoreMenus, placeMoreMenu } from './ui.js';
import { mmss } from './util.js';
import { bindSortHandle } from './sort.js';
import { makeHealthBadge } from './health.js';
import { updatePulse } from './station.js';
import { openEditModal } from './track-form.js';
import { resolveWebUrl, stationRootFromEditor } from '../url.js';

export function itemSummaryText(item) {
  const title = item.title || say('Untitled track');
  const bits = [];
  if (item.credit) bits.push(item.credit);
  const dur = mmss(item.duration);
  if (dur) bits.push(dur);
  if (item.disabled) bits.push(say('Disabled'));
  return { title, meta: bits.join(' · ') || say('Tap to edit') };
}
export function itemRow(item, index) {
  const wrap = document.createElement('article');
  wrap.className = 'item'
    + (item.disabled ? ' is-disabled' : '')
    + (index === state.liveIndex ? ' is-live' : '');
  wrap.dataset.index = String(index);

  const row = document.createElement('div');
  row.className = 'item-row';
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-label', say('Edit track'));

  const { title, meta } = itemSummaryText(item);

  const drag = document.createElement('button');
  drag.type = 'button';
  drag.className = 'item-drag';
  drag.setAttribute('aria-label', say('Reorder'));
  drag.innerHTML = svgIcon('grip');
  bindSortHandle(drag, wrap, index);

  const lead = document.createElement('div');
  lead.className = 'item-lead';

  const idx = document.createElement('span');
  idx.className = 'item-index';
  idx.textContent = String(index + 1) + '.';

  const art = document.createElement('span');
  art.className = 'item-art';
  art.setAttribute('aria-hidden', 'true');
  const artImg = document.createElement('img');
  artImg.alt = '';
  const src = resolveWebUrl(item.artUrl, stationRootFromEditor(location.href));
  if (src) {
    artImg.onload = () => art.setAttribute('data-ready', '');
    artImg.onerror = () => {
      artImg.removeAttribute('src');
      art.removeAttribute('data-ready');
    };
    artImg.src = src;
  }
  art.append(artImg);
  lead.append(idx, art);

  const words = document.createElement('span');
  words.className = 'item-words';
  const name = document.createElement('span');
  name.className = 'item-name';
  name.dir = 'auto';
  name.textContent = title;
  const metaEl = document.createElement('span');
  metaEl.className = 'item-meta';
  metaEl.dir = 'auto';
  metaEl.textContent = meta;
  words.append(name, metaEl);

  const end = document.createElement('div');
  end.className = 'item-end';

  const badge = makeHealthBadge(item);
  if (badge) end.append(badge);

  const moreWrap = document.createElement('div');
  moreWrap.className = 'item-more';
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'more-btn';
  moreBtn.setAttribute('aria-label', say('Actions'));
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.setAttribute('aria-haspopup', 'menu');
  moreBtn.innerHTML = svgIcon('more');

  const menu = document.createElement('div');
  menu.className = 'more-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.append(
    mkMoreItem(say('Duplicate'), 'duplicate', 'duplicate'),
    mkMoreItem(say('Jump to top'), 'jump-up', 'jumpUp'),
    mkMoreItem(say('Jump to bottom'), 'jump-down', 'jumpDown'),
    mkMoreItem(item.disabled ? say('Enable') : say('Disable'), 'toggle-disable', item.disabled ? 'enable' : 'disable'),
    mkMoreItem(say('Remove'), 'remove', 'remove', true),
  );

  moreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = menu.hidden;
    closeAllMoreMenus();
    if (open) {
      placeMoreMenu(moreBtn, menu);
      moreBtn.setAttribute('aria-expanded', 'true');
    }
  });
  moreWrap.append(moreBtn, menu);
  end.append(moreWrap);
  row.append(drag, lead, words, end);
  wrap.append(row);

  const openEdit = (e) => {
    if (state.sort) return;
    if (e.target.closest('.item-more, .item-drag, .health-badge')) return;
    e.preventDefault();
    openEditModal(index);
  };
  row.addEventListener('click', openEdit);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openEdit(e);
  });

  return wrap;
}

export function renderLists() {
  const tracks = $('tracks');
  tracks.innerHTML = '';
  state.tracks.forEach((item, i) => tracks.append(itemRow(item, i)));
  updatePulse();
  import('./persist.js').then((m) => m.schedulePersist()).catch(() => {});
}
