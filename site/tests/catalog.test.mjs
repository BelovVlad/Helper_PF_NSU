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
