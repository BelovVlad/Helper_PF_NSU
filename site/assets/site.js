const root = document.documentElement;
try {
  const theme = JSON.parse(localStorage.getItem('pweb.home.v1'))?.settings?.theme;
  root.dataset.theme = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme:light)').matches) ? 'light' : 'dark';
} catch {}
const container = document.querySelector('#sections'), search = document.querySelector('#search');
const home = document.querySelector('#home'), page = document.querySelector('#semester'), semesters = document.querySelector('#semesters');
const downloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';
const url = path => './' + path.split('/').map(encodeURIComponent).join('/');
const size = bytes => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' МБ' : Math.max(1, Math.ceil(bytes / 1024)) + ' КБ';
const date = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const anchor = name => 's-' + name;
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
let catalog = { sections: [], files: [] };
// Folded subjects are remembered per browser; they start open unless meta.json says "collapsed".
const FOLD_KEY = 'pweb.helper.folded.v1';
let folded = {};
try { folded = JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch {}
const isOpen = (key, collapsed) => !(folded[key] ?? collapsed);
function remember(key, open) { folded[key] = !open; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folded)); } catch {} }
// <details> that folds into one row: the summary holds the heading.
function fold(className, key, collapsed, heading, forceOpen) {
  const box = el('details', className); box.open = forceOpen || isOpen(key, collapsed);
  const summary = el('summary'); summary.append(heading); box.append(summary);
  box.addEventListener('toggle', () => { if (!search.value.trim()) remember(key, box.open); });
  return box;
}

function fileRow(file) {
  const row = el('div', 'file');
  const main = el('a', 'file-main');
  if (file.view) {
    const params = new URLSearchParams({ file: file.view, title: file.title, subject: file.section });
    if (file.view !== 'files/' + file.path) params.set('source', 'files/' + file.path);
    // Notebooks and code open in the NSU readers (viewer/notebook), everything else in the PDF reader.
    main.href = `./viewer/${file.reader === 'notebook' ? 'notebook/viewer' : file.reader === 'code' ? 'notebook/code' : 'pdfjs/viewer'}.html?` + params;
  } else { main.href = url('files/' + file.path); main.download = file.name; }
  const badge = el('span', 'file-icon', file.kind); badge.dataset.kind = file.kind;
  const copy = el('span', 'file-copy');
  copy.append(el('strong', '', file.title), el('small', '', file.description || [file.folder, file.name].filter(Boolean).join(' / ')));
  const meta = el('span', 'file-meta');
  meta.append(el('b', '', size(file.bytes)), document.createTextNode(file.view ? 'открыть' : 'скачать'));
  main.append(badge, copy, meta); row.append(main);
  if (file.view) {
    const download = el('a', 'download'); download.href = url('files/' + file.path); download.download = file.name;
    download.title = download.ariaLabel = 'Скачать ' + file.name + ' · ' + date(file.modified); download.innerHTML = downloadIcon;
    row.append(download);
  }
  return row;
}
// Two views on one page: the semester cards, and one semester (#s-<name>, which the viewer's back button
// also points at) with its subjects and books.
let current = null;
function render() {
  const section = current, query = search.value.trim().toLocaleLowerCase('ru');
  const match = file => !query || [file.title, file.description, file.path].join(' ').toLocaleLowerCase('ru').includes(query);
  const files = catalog.files.filter(f => f.section === section.name && match(f));
  container.replaceChildren();
  document.querySelector('#semester-count').textContent = plural(files.length, 'файл', 'файла', 'файлов');
  const direct = files.filter(f => !f.group);
  if (direct.length) { const list = el('div', 'files'); list.append(...direct.map(fileRow)); container.append(list); }
  for (const group of section.groups) {
    const own = files.filter(f => f.group === group.name);
    if (query && !own.length) continue;
    const heading = el('h2', '', group.title); heading.append(el('small', '', String(own.length)));
    const box = fold('section', section.name + '/' + group.name, group.collapsed, heading, !!query);
    if (group.description) box.append(el('p', 'description', group.description));
    const list = el('div', 'files'); list.append(...own.map(fileRow));
    if (!own.length) list.append(el('p', 'empty', 'Пока пусто'));
    box.append(list); container.append(box);
  }
  if (!container.children.length) container.append(el('p', 'empty', query ? 'Ничего не нашлось' : 'Пока пусто'));
}
function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  current = catalog.sections.find(s => anchor(s.name) === id) || null;
  home.hidden = !!current; page.hidden = !current;
  if (current) {
    document.title = current.title + ' · Хелпер ФФ · Hyle';
    document.querySelector('#semester-title').textContent = current.title;
    const note = document.querySelector('#semester-note'); note.textContent = current.description; note.hidden = !current.description;
    search.value = ''; render();
  } else {
    document.title = 'Хелпер ФФ · Hyle';
    window.HelperSemesters?.redraw();
  }
  scrollTo(0, 0);
}
// Semester cards: a dot field each (assets/semesters.js) with the number on it; a card opens its semester.
const semesterOf = name => Number((/^(\d+)\s*семестр/i.exec(name) || [])[1]) || 0;
const plural = (n, one, few, many) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? few : many); };
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
    card.setAttribute('aria-label', n + ' семестр, ' + (count ? plural(count, 'файл', 'файла', 'файлов') : 'пока пусто'));
    if (section) card.href = '#' + anchor(section.name);
    semesters.append(card);
  }
  window.HelperSemesters?.mount(semesters);
}
// «Все семестры» goes back in history when it came from the cards, so the page keeps its place.
document.querySelector('.crumb').addEventListener('click', e => {
  e.preventDefault();
  if (history.state?.fromCards) history.back(); else { history.pushState(null, '', location.pathname); route(); }
});
semesters.addEventListener('click', e => { const link = e.target.closest('a.semester'); if (!link) return; e.preventDefault(); history.pushState({ fromCards: true }, '', link.hash); route(); });
addEventListener('popstate', route);
search.addEventListener('input', render);
try {
  const response = await fetch('./materials.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('catalog');
  catalog = await response.json();
  renderSemesters();
  route();
} catch { semesters.replaceChildren(el('p', 'empty', 'Не удалось загрузить список файлов. Обновите страницу.')); }
