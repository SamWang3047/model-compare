import { mkdir, copyFile } from 'node:fs/promises';
const files = ['index.html', 'styles.css', 'app.js', 'charts.js', 'data.json', 'favicon.svg', 'og.png', 'robots.txt'];
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const file of files) await copyFile(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
console.log(`Built ${files.length} static files. No dependencies or backend required.`);
