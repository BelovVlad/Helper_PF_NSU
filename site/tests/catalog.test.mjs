import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect } from '../scripts/catalog.mjs';

test('semesters are the top-level folders in number order, subjects are their subfolders; site and _ocr are skipped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pweb-helper-test-'));
  try {
    for (const dir of ['10 семестр', '2 семестр/Молекулярная физика', '1 семестр/Механика и теория относительности', '1 семестр/Линейная алгебра и геометрия', '8 семестр', '_ocr', 'site', '.git']) await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, '1 семестр', 'Механика и теория относительности', 'Тельнов_2015_Механика_и_теория_относительности.pdf'), '%PDF');
    await writeFile(join(root, '1 семестр', 'Линейная алгебра и геометрия', 'Кострикин_2000_Линейная_алгебра.djvu'), 'x');
    await writeFile(join(root, '2 семестр', 'Молекулярная физика', 'Сивухин_т2.pdf'), '%PDF');
    await writeFile(join(root, '8 семестр', '.gitkeep'), '');
    await writeFile(join(root, '_ocr', 'ocr_books.py'), 'x');
    await writeFile(join(root, 'site', 'index.pdf'), '%PDF');
    const catalog = await collect(root, { '1 семестр/Механика и теория относительности/Тельнов_2015_Механика_и_теория_относительности.pdf': { title: 'В. И. Тельнов. Механика и теория относительности' } });
    assert.deepEqual(catalog.sections.map(s => s.name), ['1 семестр', '2 семестр', '8 семестр', '10 семестр']);
    assert.deepEqual(catalog.sections[0].groups.map(g => g.name), ['Линейная алгебра и геометрия', 'Механика и теория относительности']);
    assert.equal(catalog.files.length, 3);
    const byPath = Object.fromEntries(catalog.files.map(f => [f.path, f]));
    const telnov = byPath['1 семестр/Механика и теория относительности/Тельнов_2015_Механика_и_теория_относительности.pdf'];
    assert.equal(telnov.title, 'В. И. Тельнов. Механика и теория относительности');
    assert.equal(telnov.section, '1 семестр'); assert.equal(telnov.group, 'Механика и теория относительности');
    assert.equal(telnov.view, 'files/1 семестр/Механика и теория относительности/Тельнов_2015_Механика_и_теория_относительности.pdf');
    assert.equal(byPath['1 семестр/Линейная алгебра и геометрия/Кострикин_2000_Линейная_алгебра.djvu'].view, null);
    assert.equal(byPath['2 семестр/Молекулярная физика/Сивухин_т2.pdf'].title, 'Сивухин т2');
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pweb-helper-test-'))) throw new Error('Unsafe fixture path');
    await rm(root, { recursive: true, force: true });
  }
});

test('books listed in site/books.json but missing on disk stay in the catalog: without a link, or from $booksBase', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pweb-helper-test-'));
  try {
    for (const dir of ['1 семестр/Механика', '3 семестр', 'site']) await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, '1 семестр', 'Механика', 'Здесь.pdf'), '%PDF');
    await writeFile(join(root, 'site', 'books.json'), JSON.stringify({ books: [
      { path: '1 семестр/Механика/Здесь.pdf', bytes: 4, modified: '2026-01-01T00:00:00.000Z' },
      { path: '3 семестр/ТФКП/Лекции по ТФКП.pdf', bytes: 1000, modified: '2026-01-01T00:00:00.000Z' },
      { path: '../секрет.pdf', bytes: 1, modified: '2026-01-01T00:00:00.000Z' }] }));
    let catalog = await collect(root, {});
    const byPath = Object.fromEntries(catalog.files.map(f => [f.path, f]));
    assert.equal(catalog.files.length, 2);
    assert.equal(byPath['1 семестр/Механика/Здесь.pdf'].remote, undefined);
    const away = byPath['3 семестр/ТФКП/Лекции по ТФКП.pdf'];
    assert.equal(away.remote, true); assert.equal(away.view, null); assert.equal(away.bytes, 1000);
    assert.deepEqual(catalog.sections.find(s => s.name === '3 семестр').groups.map(g => g.name), ['ТФКП']);
    catalog = await collect(root, { $booksBase: 'https://books.hyle.space/helper' });
    assert.equal(catalog.files.find(f => f.remote).view, 'https://books.hyle.space/helper/3%20%D1%81%D0%B5%D0%BC%D0%B5%D1%81%D1%82%D1%80/%D0%A2%D0%A4%D0%9A%D0%9F/%D0%9B%D0%B5%D0%BA%D1%86%D0%B8%D0%B8%20%D0%BF%D0%BE%20%D0%A2%D0%A4%D0%9A%D0%9F.pdf');
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pweb-helper-test-'))) throw new Error('Unsafe fixture path');
    await rm(root, { recursive: true, force: true });
  }
});
