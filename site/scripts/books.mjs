// Writes site/books.json: the list of books in the semester folders (they are not in git, see .gitignore).
// Run after adding or removing books, then commit site/books.json:  npm run books  (in site/)
import { writeBookList } from './catalog.mjs';
const books = await writeBookList();
const gb = books.reduce((s, b) => s + b.bytes, 0) / 2 ** 30;
console.log(`site/books.json: ${books.length} books, ${gb.toFixed(2)} GB`);
