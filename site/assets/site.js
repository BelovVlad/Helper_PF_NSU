const root = document.documentElement;
try {
  const theme = JSON.parse(localStorage.getItem('pweb.home.v1'))?.settings?.theme;
  root.dataset.theme = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme:light)').matches) ? 'light' : 'dark';
} catch {}
const $ = id => document.getElementById(id);
const container = $('sections'), search = $('search'), semesters = $('semesters');
const views = { home: $('home'), semester: $('semester'), results: $('results') };
const API = 'https://api.hyle.space';
const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';
const url = path => './' + path.split('/').map(encodeURIComponent).join('/');
const size = bytes => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.ceil(bytes / 1024)) + ' КБ';
const date = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n, one, few, many) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? few : many); };
const books = n => plural(n, 'книга', 'книги', 'книг');
const lower = s => String(s || '').toLocaleLowerCase('ru');
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
let catalog = { sections: [], files: [] };

// Where a book opens: the PDF reader (or the NSU readers for notebooks and code). `subject` is the
// semester/subject pair, so the reader's back button returns to that subject's folder.
function readerHref(file, extra = {}) {
  const params = new URLSearchParams({ file: file.view, title: file.title, subject: file.group ? file.section + '/' + file.group : file.section, ...extra });
  if (file.view !== 'files/' + file.path) params.set('source', file.href || 'files/' + file.path);
  return `./viewer/${file.reader === 'notebook' ? 'notebook/viewer' : file.reader === 'code' ? 'notebook/code' : 'pdfjs/viewer'}.html?` + params;
}
// One book: a single compact row (title, size), plus the download button.
function fileRow(file, place) {
  const row = el('div', 'file');
  const main = el('a', 'file-main');
  if (file.view) main.href = readerHref(file);
  else if (file.remote) { main.removeAttribute('href'); row.classList.add('pending'); main.title = 'Книга ещё не выложена на сайт'; }
  else { main.href = url('files/' + file.path); main.download = file.name; }
  const badge = el('span', 'file-icon', file.kind); badge.dataset.kind = file.kind;
  const copy = el('span', 'file-copy');
  copy.append(el('strong', '', file.title));
  if (place) copy.append(el('small', '', place));
  else if (file.description) copy.append(el('small', '', file.description));
  const meta = el('span', 'file-meta', file.remote && !file.view ? 'скоро' : size(file.bytes));
  main.append(badge, copy, meta); row.append(main);
  if (file.view) {
    const download = el('a', 'download'); download.href = file.href || url('files/' + file.path); download.download = file.name;
    download.title = download.ariaLabel = 'Скачать ' + file.name + ' · ' + date(file.modified); download.innerHTML = downloadIcon;
    row.append(download);
  }
  return row;
}
const list = files => { const box = el('div', 'files'); box.append(...files.map(f => fileRow(f))); return box; };

// ---------- Routes: #s-<semester> shows its subjects as folders, #s-<semester>/<subject> one subject's books.
const anchor = (section, group) => '#s-' + encodeURIComponent(group ? section + '/' + group : section);
let current = { section: null, group: null };
function parseHash() {
  let id = location.hash.slice(1);
  try { id = decodeURIComponent(id); } catch {}
  if (!id.startsWith('s-')) return { section: null, group: null };
  const [name, ...rest] = id.slice(2).split('/'), section = catalog.sections.find(s => s.name === name) || null;
  const group = section && rest.length ? section.groups.find(g => g.name === rest.join('/')) || null : null;
  return { section, group };
}
function show(name) { for (const [key, view] of Object.entries(views)) view.hidden = key !== name; }
function route() {
  current = parseHash();
  search.value = ''; setPlaceholder();
  const { section, group } = current;
  if (!section) { show('home'); document.title = 'Хелпер ФФ · Hyle'; window.HelperSemesters?.redraw(); scrollTo(0, 0); return; }
  show('semester');
  const crumb = $('crumb');
  crumb.textContent = group ? '← ' + section.title : '← Все семестры';
  crumb.href = group ? anchor(section.name) : './';
  $('semester-title').textContent = group ? group.title : section.title;
  const note = $('semester-note'), text = group ? group.description : section.description;
  note.textContent = text || ''; note.hidden = !text;
  document.title = (group ? group.title + ' · ' : '') + section.title + ' · Хелпер ФФ · Hyle';
  const files = catalog.files.filter(f => f.section === section.name && (!group || f.group === group.name));
  $('semester-count').textContent = books(files.length);
  container.replaceChildren();
  if (group) container.append(files.length ? list(files) : el('p', 'empty', 'Пока пусто'));
  else renderFolders(section, files);
  scrollTo(0, 0);
}
function renderFolders(section, files) {
  const direct = files.filter(f => !f.group);
  if (direct.length) container.append(list(direct));
  const grid = el('div', 'folders');
  section.groups.forEach((group, i) => {
    const count = files.filter(f => f.group === group.name).length;
    const tile = el('a', 'folder'); tile.href = anchor(section.name, group.name);
    tile.setAttribute('aria-label', group.title + ', ' + books(count));
    const canvas = el('canvas'); canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.seed = i + section.name.length * 7;
    tile.append(canvas, el('b', '', group.title), el('span', '', count ? books(count) : 'пока пусто'));
    grid.append(tile);
  });
  if (section.groups.length) container.append(grid); else if (!direct.length) container.append(el('p', 'empty', 'Пока пусто'));
  requestAnimationFrame(drawFolders);
}
// The folder tiles carry a quiet dot field, in the same family as the semester cards.
function drawFolders() {
  const cream = getComputedStyle(root).getPropertyValue('--cream').trim() || '#ead4b7';
  const red = getComputedStyle(root).getPropertyValue('--accent').trim() || '#d64c50';
  const semester = Number((/^(\d+)/.exec(current.section?.name || '') || [])[1]) || 1;
  for (const canvas of container.querySelectorAll('.folder canvas')) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) continue;
    const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
    const k = Number(canvas.dataset.seed) || 0, gap = 13;
    for (let y = 8; y < h; y += gap) for (let x = 8; x < w; x += gap) {
      const wave = .5 + .5 * Math.sin(x * .03 + y * .05 + k * 1.7 + 2 * Math.sin(x * .02 - y * .03 + k));
      const r = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + k) * 43758.5453) % 1;
      ctx.globalAlpha = (.12 + .55 * wave * wave) * (1 - y / (h * 1.25));
      ctx.fillStyle = r > .975 && semester >= 4 ? red : cream;
      ctx.beginPath(); ctx.arc(x, y, .6 + wave * wave * 1.8, 0, 6.283); ctx.fill();
    }
  }
}
let resizeTimer = 0;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawFolders, 150); });

// ---------- Search under the logo: typing filters the books where you are (all semesters, one semester
// or one subject); Enter searches the text of the books on the home server.
function scope() {
  const { section, group } = current;
  return { section, group, label: group ? group.title : section ? section.title : 'все семестры' };
}
function setPlaceholder() {
  const s = scope();
  search.placeholder = s.group ? 'Поиск: ' + s.group.title : s.section ? 'Поиск: ' + s.section.title : 'Поиск по ' + books(catalog.files.length || 362).replace(/книг[аи]?$/, 'книгам');
}
function where(file) { return [file.section, file.group].filter(Boolean).join(' › '); }
function filterTitles() {
  const query = lower(search.value.trim());
  if (!query) { if (!views.results.hidden) route(); return; }
  const s = scope(), words = query.split(/\s+/);
  const files = catalog.files.filter(f => (!s.section || f.section === s.section.name) && (!s.group || f.group === s.group.name)
    && words.every(w => lower([f.title, f.description, f.path].join(' ')).includes(w)));
  show('results');
  $('results-scope').textContent = 'НАЗВАНИЯ · ' + s.label.toUpperCase();
  $('results-title').textContent = '«' + search.value.trim() + '»';
  $('results-count').textContent = (files.length ? books(files.length) : 'Нет книг с таким названием') + ' · Enter — искать в тексте книг';
  const box = $('results-list'); box.replaceChildren();
  if (files.length) { const l = el('div', 'files'); l.append(...files.slice(0, 200).map(f => fileRow(f, s.group ? '' : where(f)))); box.append(l); }
}
let fullRun = 0;
async function searchText() {
  const q = search.value.trim(); if (!q) return;
  const s = scope(), run = ++fullRun, box = $('results-list');
  show('results');
  $('results-scope').textContent = 'ТЕКСТ КНИГ · ' + s.label.toUpperCase();
  $('results-title').textContent = '«' + q + '»';
  $('results-count').textContent = 'Ищу в тексте…';
  box.replaceChildren();
  const params = new URLSearchParams({ q, limit: '30', site: 'helper' });
  if (s.section) params.set('semester', String(parseInt(s.section.name, 10)));
  if (s.group) params.set('subject', s.group.name);
  try {
    const response = await fetch(API + '/search?' + params);
    const data = await response.json().catch(() => ({}));
    if (run !== fullRun) return;
    if (!response.ok) throw new Error(data.error || 'сервер ответил ' + response.status);
    const hits = data.hits || [];
    $('results-count').textContent = hits.length ? 'Найдено на ' + plural(data.total || hits.length, 'странице', 'страницах', 'страницах') : 'В тексте книг ничего не нашлось';
    const byPath = new Map(catalog.files.map(f => [f.path, f]));
    const l = el('div', 'hits');
    for (const hit of hits) {
      const file = byPath.get(hit.book), a = el('a', 'hit');
      if (file?.view) a.href = readerHref(file, { page: hit.page, find: q });
      const head = el('span', 'hit-head');
      head.append(el('strong', '', file?.title || hit.title), el('span', 'hit-page', 'стр. ' + hit.page));
      const snip = el('span', 'hit-snippet'); snip.innerHTML = hit.snippet || '';
      a.append(head, snip, el('small', '', [hit.semester + ' семестр', hit.subject].filter(Boolean).join(' › ')));
      l.append(a);
    }
    box.append(l);
  } catch (error) {
    if (run !== fullRun) return;
    $('results-count').textContent = 'Поиск по тексту сейчас недоступен: ' + (error.message === 'Failed to fetch' ? 'домашний сервер не отвечает' : error.message) + '. Поиск по названиям работает.';
  }
}
search.addEventListener('input', () => { fullRun++; filterTitles(); });
search.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchText(); search.blur(); }
  if (e.key === 'Escape' && search.value) { search.value = ''; route(); }
});
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' || e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); search.focus(); search.select(); }
});
// The AI dialog (ai.js) asks within the same place as the search.
window.HelperScope = () => { const s = scope(); return { semester: s.section ? String(parseInt(s.section.name, 10)) : '', subject: s.group?.name || '', label: s.label }; };
window.HelperBook = path => { const file = catalog.files.find(f => f.path === path); return file?.view ? readerHref(file) : null; };
window.HelperBookPage = (path, page, find) => { const file = catalog.files.find(f => f.path === path); return file?.view ? readerHref(file, { page, ...(find ? { find } : {}) }) : null; };

// ---------- Semester cards: a dot field each (assets/semesters.js) with the number on it.
const semesterOf = name => Number((/^(\d+)\s*семестр/i.exec(name) || [])[1]) || 0;
function renderSemesters() {
  semesters.replaceChildren();
  for (let n = 1; n <= 8; n++) {
    const section = catalog.sections.find(s => semesterOf(s.name) === n);
    const count = section ? catalog.files.filter(f => f.section === section.name).length : 0;
    const card = el(section ? 'a' : 'div', 'semester'); card.dataset.semester = n;
    if (!count) card.dataset.empty = '';
    const canvas = el('canvas'); canvas.setAttribute('aria-hidden', 'true');
    const label = el('span', 'semester-label'); label.append(el('b', '', String(n)), el('span', '', 'семестр'));
    card.append(canvas, label);
    card.setAttribute('aria-label', n + ' семестр, ' + (count ? books(count) : 'пока пусто'));
    if (section) card.href = anchor(section.name);
    semesters.append(card);
  }
  window.HelperSemesters?.mount(semesters);
}
// Every move between views is a history entry, so Back returns to the folder you came from.
document.addEventListener('click', e => {
  const link = e.target.closest('a.semester, a.folder, a.crumb'); if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  const target = link.getAttribute('href') === './' ? location.pathname : link.getAttribute('href');
  history.pushState(null, '', target); route();
});
addEventListener('popstate', route);
try {
  const response = await fetch('./materials.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('catalog');
  catalog = await response.json();
  renderSemesters();
  route();
} catch { semesters.replaceChildren(el('p', 'empty', 'Не удалось загрузить список файлов. Обновите страницу.')); }
