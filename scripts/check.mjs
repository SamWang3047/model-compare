import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
let assertions = 0;
function assert(condition, message) {
  assertions++;
  if (!condition) errors.push(message);
}
const read = file => readFile(path.join(root, file), 'utf8');
const exists = async file => { try { await access(path.join(root, file)); return true; } catch { return false; } };

const data = JSON.parse(await read('data.json'));
const html = await read('index.html');
const date = data.snapshot_date ?? data.meta?.snapshot_date ?? data.meta?.snapshotDate;
assert(/^\d{4}-\d{2}-\d{2}$/.test(date ?? ''), 'The dataset needs a machine-readable snapshot date.');
assert(Array.isArray(data.models) && data.models.length === 9, 'The report must contain exactly nine model/effort rows.');
for (const key of ['metadata', 'conclusion', 'takeaways', 'benchmark', 'caveats', 'repository_agents', 'repository_agent_note', 'long_task_note', 'harness', 'subscriptions', 'monthly_costs', 'chart_estimates', 'final_recommendations', 'final_note', 'sources']) {
  assert(data[key] !== undefined, `Missing report section: ${key}.`);
}
const sourceMap = new Map((data.sources ?? []).map(source => [source.id, source]));
assert(sourceMap.size === (data.sources ?? []).length, 'Source IDs must be unique.');
for (const source of data.sources ?? []) {
  assert(/^https:\/\//.test(source.url ?? ''), `${source.id}: invalid source URL.`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(source.date ?? ''), `${source.id}: missing source access date.`);
  assert(typeof source.title === 'string' && source.title.length > 0, `${source.id}: missing source title.`);
}
const kinds = new Set(['verified', 'inference', 'calculated', 'illustrative', 'missing']);
function checkProvenance(value, location = 'data') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item, index) => checkProvenance(item, `${location}[${index}]`));
  if (typeof value.type === 'string' && kinds.has(value.type)) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(value.date ?? ''), `${location}: missing evidence date.`);
    assert(Array.isArray(value.source_ids) && value.source_ids.length > 0, `${location}: missing evidence sources.`);
  }
  for (const id of value.source_ids ?? []) assert(sourceMap.has(id), `${location}: unknown source ID ${id}.`);
  for (const id of Object.values(value.metric_sources ?? {})) assert(sourceMap.has(id), `${location}: unknown metric source ${id}.`);
  for (const [key, child] of Object.entries(value)) checkProvenance(child, `${location}.${key}`);
}
checkProvenance(data);
assert(data.long_task_note?.type === 'missing', 'The lack of matched independent long-task evidence must remain explicit.');
assert((data.caveats ?? []).filter(note => note.conflict).length >= 2, 'The GLM and MiniMax pricing conflicts must remain in the report.');
assert(data.subscriptions?.zai?.annualConflict?.conflict === true, 'The ambiguous Team annual invoice must remain labelled.');
assert(data.chart_estimates?.deepseek_offpeak?.type === 'calculated', 'The off-peak scatter point must be labelled calculated, not a benchmark rerun.');

const originalFields = [
  'tb4_percent', 'tb4_api_usd_per_attempt', 'output_tokens_per_second',
  'first_answer_seconds', 'aa_lcr_percent', 'context_tokens',
  'input_usd_per_million', 'output_usd_per_million', 'cache_read_usd_per_million'
];
for (const model of data.models ?? []) {
  assert(typeof model.id === 'string' && model.id.length > 0, 'Each model needs a stable ID.');
  assert(typeof model.model === 'string' && model.model.length > 0, `${model.id}: missing model label.`);
  for (const field of originalFields) {
    assert(Number.isFinite(model[field]) && model[field] >= 0, `${model.id}: invalid numeric ${field}.`);
    assert(sourceMap.has(model.metric_sources?.[field]), `${model.id}: missing field-level source for ${field}.`);
  }
  for (const field of ['aa_source', 'pricing_source']) {
    assert(/^https:\/\//.test(model[field] ?? ''), `${model.id}: missing HTTPS ${field}.`);
  }
}
assert(new Set((data.models ?? []).map(model => model.id)).size === (data.models ?? []).length, 'Model IDs must be unique.');

// Optional source fidelity audit. The original report is supplied at execution
// time rather than baking a machine-specific path into the repository.
const referenceIndex = process.argv.indexOf('--reference');
if (referenceIndex >= 0) {
  const referencePath = process.argv[referenceIndex + 1];
  if (!referencePath) throw new Error('--reference requires a JSON path.');
  const reference = JSON.parse(await readFile(referencePath, 'utf8'));
  assert(date === reference.snapshot_date, 'Snapshot date changed from the original report.');
  for (const model of data.models ?? []) {
    const previous = reference.models.find(row => row.id === model.id);
    assert(Boolean(previous), `Unknown model ${model.id} compared with the original report.`);
    if (!previous) continue;
    for (const field of [...originalFields, 'aa_source', 'pricing_source']) {
      assert(model[field] === previous[field], `${model.id}.${field} changed from the original report.`);
    }
  }
}
const costReferenceIndex = process.argv.indexOf('--cost-reference');
if (costReferenceIndex >= 0) {
  const referencePath = process.argv[costReferenceIndex + 1];
  if (!referencePath) throw new Error('--cost-reference requires a JSON path.');
  const reference = JSON.parse(await readFile(referencePath, 'utf8'));
  assert(data.monthly_costs?.length === reference.length, 'Monthly scenario count changed from the original report.');
  for (const previous of reference) {
    const current = data.monthly_costs?.find(row => row.label === previous.label);
    assert(Boolean(current), `Missing original monthly scenario ${previous.label}.`);
    if (!current) continue;
    for (const [field, value] of Object.entries(previous)) {
      assert(current[field] === value, `${previous.label}.${field} changed from the original report.`);
    }
  }
}
const config = data.harness?.glm?.config;
try {
  assert(JSON.stringify(JSON.parse(data.harness?.glm?.configCode)) === JSON.stringify(config), 'Copyable GLM configuration differs from the structured configuration.');
} catch {
  assert(false, 'The copyable GLM configuration is not valid JSON.');
}

assert(/<title>[^<]+<\/title>/i.test(html), 'Missing SEO title.');
assert(/<meta\s+[^>]*name=["']description["']/i.test(html), 'Missing meta description.');
for (const property of ['og:title', 'og:description', 'og:type', 'og:image']) {
  assert(new RegExp(`<meta\\s+[^>]*property=["']${property}["']`, 'i').test(html), `Missing ${property} metadata.`);
}
assert(/<html\s+[^>]*lang=["']en["']/i.test(html), 'The document must declare English.');
assert(/name=["']viewport["']/i.test(html), 'Missing responsive viewport metadata.');

const sourceFiles = [];
async function walk(folder = '') {
  for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
    if (['node_modules', '.git', '.qa', 'dist', '.vercel'].includes(entry.name)) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:html|css|js|mjs)$/.test(entry.name)) sourceFiles.push(file);
  }
}
await walk();
const contents = new Map(await Promise.all(sourceFiles.map(async file => [file, await read(file)])));
const allMarkup = [...contents.values()].join('\n');
const ids = new Set([...allMarkup.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));

async function checkLocalLink(value, owner) {
  if (/^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(value)) return;
  if (value.includes('${')) return; // Runtime-generated links are browser-checked.
  const [pathname, fragment] = value.split('#');
  if (!pathname) {
    if (fragment) assert(ids.has(fragment), `${owner}: unresolved local anchor #${fragment}.`);
    return;
  }
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const local = clean.startsWith('/') ? clean.slice(1) : path.join(path.dirname(owner), clean);
  assert(await exists(local), `${owner}: missing local resource ${value}.`);
}
for (const [file, source] of contents) {
  if (/\.(?:js|mjs)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
    assert(result.status === 0, `${file}: JavaScript syntax error: ${result.stderr?.trim()}`);
  }
  if (!/\.(?:html|css|js)$/.test(file)) continue;
  for (const match of source.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) await checkLocalLink(match[1], file);
  for (const match of source.matchAll(/\b(?:import\s+(?:[^;]*?\s+from\s+)?|fetch\s*\()["'](\.?\.?\/[^"']+)["']/g)) {
    await checkLocalLink(match[1], file);
  }
  for (const match of source.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)) await checkLocalLink(match[1], file);
}
for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
  if (!/property=["']og:image["']/i.test(tag[0])) continue;
  const value = tag[0].match(/content=["']([^"']+)["']/i)?.[1];
  if (value) await checkLocalLink(value, 'index.html');
}

// Detailed benchmark figures belong in the data file, not presentation code.
const presentation = [...contents].filter(([file]) => !file.startsWith('scripts') && /\.(?:html|js)$/.test(file));
for (const model of data.models ?? []) {
  for (const field of ['tb4_percent', 'tb4_api_usd_per_attempt', 'output_tokens_per_second', 'first_answer_seconds']) {
    const literal = String(model[field]);
    if (literal.length < 6) continue;
    const pattern = new RegExp(`(?<![\\d.])${literal.replaceAll('.', '\\.')}(?![\\d.])`);
    for (const [file, source] of presentation) assert(!pattern.test(source), `${file}: hardcoded benchmark value ${literal}; read it from data.json.`);
  }
}

if (errors.length) {
  console.error(`${errors.length} failures across ${assertions} checks:\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Passed ${assertions} checks: sourced model data, optional report fidelity, syntax, SEO and local links.`);
}
