import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(root, 'data.json'), 'utf8'));
const companies = JSON.parse(await readFile(path.join(root, 'companies.json'), 'utf8'));
const coding = JSON.parse(await readFile(path.join(root, 'coding.json'), 'utf8'));
const urls = new Set();

function collect(value) {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) urls.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
// Configuration API endpoints are not navigation links. Check the source
// registry that the site renders rather than sending requests to auth routes.
if (!process.argv.includes('--coding-only')) {
  collect(data.sources ?? data);
  collect(companies.sources);
}
collect(coding.sources);

async function inspect(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(18000),
      headers: { 'User-Agent': 'model-compare-link-check/1.0', Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }
    });
    // Cancel the body: link validation needs status, not a full page download.
    await response.body?.cancel();
    const verdict = response.ok ? 'reachable' : [404, 410].includes(response.status) ? 'broken' : 'unverified';
    return { url, finalUrl: response.url, status: response.status, verdict };
  } catch (error) {
    return { url, verdict: 'unverified', error: error.message };
  }
}

const pending = [...urls].sort();
const results = [];
async function worker() {
  while (pending.length) {
    const url = pending.shift();
    const result = await inspect(url);
    results.push(result);
    console.log(`${result.verdict.padEnd(10)} ${result.status ?? 'ERR'} ${url}`);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
await mkdir(path.join(root, '.qa'), { recursive: true });
await writeFile(path.join(root, '.qa', 'external-links.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n');
const counts = Object.fromEntries(['reachable', 'broken', 'unverified'].map(label => [label, results.filter(r => r.verdict === label).length]));
console.log(JSON.stringify(counts));
console.log('403, 429, 5xx, network failures and timeouts are unverified, not evidence of broken sources.');
if (counts.broken) process.exitCode = 1;
