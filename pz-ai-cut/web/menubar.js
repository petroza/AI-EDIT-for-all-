'use strict';
/* HTML lišta menu webové verze ze sdílené šablony (src/core/menu.js) – vypadá a chová se jako nativní menu
 * desktopu: klik otevře, najetí přepíná, Esc / klik mimo zavře. Zkratky položek, které na desktopu obsluhuje
 * nativní menu (Ctrl+S, Ctrl+O, Ctrl+I, Ctrl+M, F1, F4…), tu obsluhuje keydown. */
const { ipcRenderer } = require('electron');
const { menuTemplate, ABOUT } = require('../src/core/menu');

const bar = document.getElementById('menubar');
let open = null;

const accelText = (a) => (a ? a.replace('CmdOrCtrl', 'Ctrl') : '');
function visible(items) { return items.filter((it) => it === '-' || !it.desktop); }

function run(it) {
  close();
  if (it.cmd === 'about') {
    const lang = (window.TN && window.TN.lang) || 'en';
    ipcRenderer.invoke('dialog', 'message', { message: 'PZ AI Cut Web', detail: ABOUT[lang](window.__PZ_VERSION__ || '', true), buttons: ['OK'] });
    return;
  }
  if (it.cmd === 'fullScreen') {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    return;
  }
  if (it.cmd) ipcRenderer.emit('cmd', it.cmd, it.arg);
}

function itemsEl(items) {
  const box = document.createElement('div');
  box.className = 'menu-drop';
  for (const it of visible(items)) {
    if (it === '-' || it.sep) { box.appendChild(document.createElement('hr')); continue; }
    const row = document.createElement('div');
    row.className = 'menu-item';
    const checked = it.radio && window.TN && window.TN.lang === it.radio;
    row.innerHTML = `<span class="mi-check">${checked ? '✓' : ''}</span><span class="mi-label"></span><span class="mi-key">${accelText(it.accel)}</span>${it.submenu ? '<span class="mi-sub">›</span>' : ''}`;
    row.querySelector('.mi-label').textContent = it.label;
    if (it.submenu) {
      row.classList.add('has-sub');
      const sub = itemsEl(it.submenu);
      sub.classList.add('sub');
      row.appendChild(sub);
    } else row.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); run(it); });
    box.appendChild(row);
  }
  return box;
}

function render() {
  if (!bar) return;
  bar.innerHTML = '';
  for (const top of menuTemplate()) {
    const b = document.createElement('div');
    b.className = 'menu-top';
    const lab = document.createElement('span');
    lab.textContent = top.label;
    b.appendChild(lab);
    b.addEventListener('mousedown', (e) => {
      if (e.target.closest('.menu-drop')) return;
      e.preventDefault();
      if (open === b) close(); else show(b, top);
    });
    b.addEventListener('mouseenter', () => { if (open && open !== b) show(b, top); });
    bar.appendChild(b);
  }
}
function show(b, top) {
  close();
  b.classList.add('on');
  b.appendChild(itemsEl(top.submenu));
  open = b;
}
function close() {
  if (!open) return;
  open.classList.remove('on');
  const d = open.querySelector('.menu-drop');
  if (d) d.remove();
  open = null;
}
window.addEventListener('mousedown', (e) => { if (open && !open.contains(e.target)) close(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(); }, true);
window.addEventListener('blur', close);

// zkratky položek, které na desktopu obsluhuje nativní menu (local = false)
const accels = [];
(function collect(items) {
  for (const it of items) {
    if (it === '-' || it.desktop) continue;
    if (it.submenu) collect(it.submenu);
    else if (it.accel && it.local === false) accels.push(it);
  }
})(menuTemplate());
function matches(ev, accel) {
  const parts = accel.split('+');
  const key = parts.pop();
  const want = { ctrl: parts.includes('CmdOrCtrl') || parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Shift') };
  if (want.ctrl !== (ev.ctrlKey || ev.metaKey) || want.alt !== ev.altKey || want.shift !== ev.shiftKey) return false;
  return /^F\d+$/.test(key) ? ev.key === key : ev.key.toUpperCase() === key.toUpperCase();
}
window.addEventListener('keydown', (ev) => {
  const tag = (ev.target && ev.target.tagName || '').toLowerCase();
  if ((tag === 'input' || tag === 'textarea') && !(ev.ctrlKey || ev.metaKey)) return;
  for (const it of accels) {
    if (matches(ev, it.accel)) { ev.preventDefault(); ev.stopPropagation(); run(it); return; }
  }
}, true);

render();
window.__pzMenu = { render };
module.exports = { render };
