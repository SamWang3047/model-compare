import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;
let factCount = 0;
const assert = (condition, message) => { checks++; if (!condition) failures.push(message); };
const read = file => readFile(path.resolve(root, file), 'utf8');
const exists = async file => { try { await access(path.resolve(root, file)); return true; } catch { return false; } };
const close = (left, right) => Number.isFinite(left) && Number.isFinite(right)
  && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
const words = text => String(text ?? '').trim().split(/\s+/u).filter(Boolean).length;
const data = JSON.parse(await read('companies.json'));
const report = JSON.parse(await read('data.json'));
const sources = new Map(data.sources.map(source => [source.id, source]));
const models = new Map(data.models.map(model => [model.id, model]));
const kinds = new Set(['verified', 'calculated', 'inference', 'missing', 'estimate', 'illustrative']);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

assert(isoDate.test(data.snapshot_date), 'Snapshot must have a machine-readable date.');
assert(sources.size === data.sources.length, 'Source IDs must be unique.');
assert(models.size === data.models.length, 'Model IDs must be unique.');
assert(data.companies.length === 6, 'The overview must contain six company profiles.');
assert(new Set(data.companies.map(company => company.id)).size === 6, 'Company IDs must be unique.');
assert(words(data.overview.text) <= 40, 'The one-line overview must stay within 40 words.');
const glmRows = data.models.filter(model => /^glm(?:-|$)/iu.test(model.id));
assert(glmRows.length === 1, 'The overview must have one GLM model and one GLM scatter point.');
assert(glmRows[0]?.id === 'glm-5-3-flash', 'The sole GLM row must be the researched Flash model.');
assert(/^GLM(?:-| )5\.3(?:-| )Flash$/iu.test(glmRows[0]?.name ?? ''), 'Use the AA-listed GLM Flash name without inventing an effort qualifier.');
assert(data.companies.find(company => company.id === 'zai')?.flagshipId === 'glm-5-3-flash', 'Z.ai must point to Flash as its featured model.');
for (const file of ['companies.json', 'data.json', 'README.md']) {
  assert(!/GLM(?:-| )5\.3(?!(?:-| )Flash)/iu.test(await read(file)), `${file}: stale full GLM-5.3 reference; the featured model must be Flash.`);
}
const valueZone = report.chart_settings?.value_zone;
assert(Boolean(valueZone), 'The value zone must be editable in data.json.chart_settings.value_zone.');
assert(Number.isFinite(valueZone?.intelligence_min) && Number.isFinite(valueZone?.blended_price_max), 'Both value-zone thresholds must be finite numbers.');
assert(valueZone?.blended_price_max > 0, 'The logarithmic price threshold must be positive.');
assert(valueZone?.type === 'inference' && isoDate.test(valueZone?.date ?? ''), 'Threshold choice must be dated and labelled analyst inference.');
assert(Array.isArray(valueZone?.source_ids) && valueZone.source_ids.length > 0, 'Threshold choice must cite the observed model distribution.');
assert(typeof valueZone?.rule === 'string' && valueZone.rule.length > 0, 'The data file must explain the value-zone rule.');
const reportSources = new Set(report.sources.map(source => source.id));
for (const id of valueZone?.source_ids ?? []) assert(reportSources.has(id), `Value zone: unknown source ID ${id}.`);
const llmMetrics = data.models.filter(model => model.kind === 'llm').map(model => model.metrics);
assert(valueZone?.intelligence_min >= Math.min(...llmMetrics.map(metric => metric.ii.value)) && valueZone?.intelligence_min <= Math.max(...llmMetrics.map(metric => metric.ii.value)), 'The intelligence threshold must lie within the observed LLM range.');
assert(valueZone?.blended_price_max >= Math.min(...llmMetrics.map(metric => metric.blended.value)) && valueZone?.blended_price_max <= Math.max(...llmMetrics.map(metric => metric.blended.value)), 'The price threshold must lie within the observed blended-price range.');
for (const source of sources.values()) {
  assert(/^https:\/\//u.test(source.url), `${source.id}: source URL must use HTTPS.`);
  assert(isoDate.test(source.date), `${source.id}: source needs an access date.`);
  assert(typeof source.title === 'string' && source.title.trim().length > 0, `${source.id}: source needs a title.`);
}

// Every numeric leaf must belong to a dated, classified, sourced fact. The same
// provenance contract also applies to textual statements carrying a type.
function provenance(value, location = 'companies', inheritedFact = null) {
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `${location}: numeric values must be finite.`);
    assert(Boolean(inheritedFact), `${location}: number is not wrapped in a sourced fact.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item, index) => provenance(item, `${location}[${index}]`, inheritedFact));
  const isFact = Object.hasOwn(value, 'type');
  if (isFact) {
    factCount++;
    assert(kinds.has(value.type), `${location}: unknown evidence type ${value.type}.`);
    assert(isoDate.test(value.date ?? ''), `${location}: fact needs an evidence date.`);
    assert(Array.isArray(value.source_ids) && value.source_ids.length > 0, `${location}: fact needs source IDs.`);
    for (const id of value.source_ids ?? []) assert(sources.has(id), `${location}: unknown source ID ${id}.`);
    if (Object.hasOwn(value, 'value') && value.value === null) {
      assert(value.type === 'missing', `${location}: null value must be marked missing.`);
    }
  }
  for (const [key, child] of Object.entries(value)) provenance(child, `${location}.${key}`, isFact ? value : inheritedFact);
}
provenance(data);

for (const company of data.companies) {
  assert(models.has(company.flagshipId), `${company.id}: flagship reference is missing.`);
  assert(company.profile.length === 7, `${company.id}: profile needs the seven fixed fields.`);
  const count = words(company.profile.map(field => `${field.label}: ${field.text}`).join(' '));
  assert(count <= 100, `${company.id}: profile is ${count} words; limit is 100, excluding the separate match paragraph.`);
  for (const id of company.modelIds) assert(models.has(id), `${company.id}: unknown model reference ${id}.`);
  assert(company.match.type === 'inference', `${company.id}: match/fall-short judgment must be labelled inference.`);
}

const sol = models.get('gpt-6-1-sol');
const opus = models.get('claude-opus-5-5');
assert(sol?.baseline && opus?.baseline, 'Sol and Opus must be highlighted reference models.');
assert(/\(max\)/u.test(sol?.name ?? ''), 'Sol comparisons must identify the max effort baseline.');
assert(/max with fallback/u.test(opus?.name ?? ''), 'Opus comparisons must retain the fallback qualifier.');
for (const model of data.models) {
  assert(['llm', 'video'].includes(model.kind), `${model.id}: model kind must be llm or video.`);
  for (const [key, metric] of Object.entries(model.metrics)) {
    assert(metric && Object.hasOwn(metric, 'value'), `${model.id}.${key}: metrics must use the fact schema.`);
    if (metric?.value === null) assert(metric.type === 'missing', `${model.id}.${key}: a missing metric needs a missing label.`);
  }
  if (model.kind === 'llm') {
    const metric = model.metrics;
    assert(Number.isFinite(metric.ii?.value), `${model.id}: raw Intelligence Index must remain stored.`);
    if (metric.rank?.value !== null) assert(Number.isInteger(metric.rank?.value) && metric.rank.value > 0, `${model.id}: invalid global rank.`);
    assert(metric.blended?.type === 'calculated', `${model.id}: the uncached blend must be labelled calculated.`);
    assert(close(metric.blended?.value, (3 * metric.input?.value + metric.output?.value) / 4), `${model.id}: wrong 3:1 uncached blended price.`);
    assert(/uncached/iu.test(metric.blended?.note ?? '') && /not AA/iu.test(metric.blended?.note ?? ''), `${model.id}: distinguish the site's illustrative uncached mix from AA's cached default.`);
    for (const [name, baseline] of [['Sol', sol], ['Opus', opus]]) {
      const refreshedFlash = model.id === 'glm-5-3-flash';
      const expectedGap = refreshedFlash ? metric.ii.value - baseline.metrics.ii.value : Math.round(metric.ii.value) - Math.round(baseline.metrics.ii.value);
      assert(close(metric[`gap${name}`]?.value, expectedGap), `${model.id}: wrong Intelligence Index gap vs ${name}.`);
      assert(metric[`gap${name}`]?.type === 'calculated' && (refreshedFlash ? /raw|unrounded/iu : /rounded/iu).test(metric[`gap${name}`]?.note ?? ''), `${model.id}: displayed gap needs its raw-score or rounded-score rule.`);
      assert(close(metric[`outputRatio${name}`]?.value, metric.output.value / baseline.metrics.output.value), `${model.id}: wrong output-price ratio vs ${name}.`);
    }
  } else {
    assert(!Object.hasOwn(model.metrics, 'ii'), `${model.id}: video must not use the LLM Intelligence Index.`);
    if (Number.isFinite(model.metrics.priceMinute?.value)) {
      assert(close(model.metrics.priceSecond?.value, model.metrics.priceMinute.value / 60), `${model.id}: wrong minute-to-second price conversion.`);
      assert(model.metrics.priceSecond?.type === 'calculated', `${model.id}: converted per-second price must be labelled calculated.`);
    }
  }
}
assert(data.positioning.rows.length === 6 && data.positioning.columns.length === 4, 'The positioning map must cover six companies and four dimensions.');
for (const row of data.positioning.rows) {
  assert(row.cells.length === 4, `${row.company}: incomplete positioning row.`);
  for (const cell of row.cells) assert(typeof cell.value === 'string', `${row.company}: qualitative positioning must not invent numeric ratings.`);
}

// This revision explicitly refreshes GLM and adds a data-driven value zone.
// Preserve every unrelated numeric leaf, using stable row IDs so removing the
// retired full-GLM overview row cannot shift an array-based comparison.
function numericLeaves(value, location = '', output = new Map()) {
  if (typeof value === 'number') { output.set(location, value); return output; }
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    const candidates = ['id', 'name', 'label', 'title', 'model'];
    const identity = candidates.find(key => value.every(item => item && typeof item === 'object' && typeof item[key] === 'string')
      && new Set(value.map(item => item[key])).size === value.length);
    value.forEach((item, index) => {
      if (/^glm(?:-|$)/iu.test(item?.id ?? '') || /(?:^|\s)GLM(?:-| )/iu.test(item?.model ?? '')) return;
      numericLeaves(item, `${location}[${identity ? `${identity}=${JSON.stringify(item[identity])}` : index}]`, output);
    });
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/glm/iu.test(key) || (location === '' && key === 'chart_settings')) continue;
    numericLeaves(child, `${location}.${key}`, output);
  }
  return output;
}
function preserveNumbers(original, current, label) {
  const previous = numericLeaves(original);
  const next = numericLeaves(current);
  for (const [location, value] of previous) assert(next.get(location) === value, `${label}${location}: unrelated number changed or disappeared.`);
}
const originalIndex = process.argv.indexOf('--original');
const originalFile = originalIndex >= 0 ? process.argv[originalIndex + 1] : '.qa/original-data.json';
if (originalIndex >= 0 && !originalFile) throw new Error('--original requires a file path.');
if (await exists(originalFile)) {
  const [original, current] = await Promise.all([readFile(path.resolve(root, originalFile)), readFile(path.resolve(root, 'data.json'))]);
  preserveNumbers(JSON.parse(original), JSON.parse(current), 'data.json');
}
const preserveIndex = process.argv.indexOf('--preserve-against');
if (preserveIndex >= 0) {
  const revision = process.argv[preserveIndex + 1];
  if (!revision) throw new Error('--preserve-against requires a Git revision.');
  for (const file of ['data.json', 'companies.json']) {
    const result = spawnSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Cannot read ${file} at ${revision}: ${result.stderr}`);
    preserveNumbers(JSON.parse(result.stdout), file === 'data.json' ? report : data, file);
  }
}

// Optional independent fidelity check against the research artifacts. This
// avoids baking today's numerical values into the application's test code.
const evidenceIndex = process.argv.indexOf('--evidence');
if (evidenceIndex >= 0) {
  const folder = process.argv[evidenceIndex + 1];
  if (!folder) throw new Error('--evidence requires the research directory.');
  const evidence = async file => JSON.parse(await readFile(path.resolve(root, folder, file), 'utf8'));
  const [zai, minimax, step] = await Promise.all(['zai-deepseek.json', 'minimax-kimi.json', 'stepfun-baselines.json'].map(evidence));
  const expected = new Map();
  for (const model of zai.models) expected.set(model.id, {
    ii: model.intelligence.value, rank: model.globalRank.value, context: model.contextTokens.value,
    tb4: model.codingTerminalBench4Percent.value, agent: model.agentAutomationBenchPercent.value,
    input: model.price.input.value, output: model.price.output.value, cache: model.price.cachedInput.value
  });
  for (const model of minimax.models) expected.set(model.id, {
    ii: model.intelligence.rawScore.value, rank: model.intelligence.globalRank.value, context: model.contextTokens.value,
    input: model.api.input.value, output: model.api.output.value, cache: model.api.cachedInput.value,
    lcr: model.longContextReasoning.value,
    ...Object.fromEntries(model.benchmarks.filter(benchmark => ['Terminal-Bench 4.0', 'SciCode'].includes(benchmark.name)).map(benchmark => [benchmark.name === 'SciCode' ? 'sciCode' : 'tb4', benchmark.score.value]))
  });
  for (const model of [...step.baselines, ...step.company.models]) expected.set(model.id, {
    ii: model.intelligence.score.value, rank: model.intelligence.globalRank.value,
    ...(model.context ? { context: model.context.value } : {}),
    input: model.pricing.input.value, output: model.pricing.output.value, cache: model.pricing.cachedInput.value,
    tb4: model.benchmarks.terminalBench40.value, sciCode: model.benchmarks.sciCode.value, lcr: model.benchmarks.longContextReasoning.value
  });
  for (const [id, metrics] of expected) {
    if (id === 'glm-5-3' || id === 'glm-5-3-flash') continue; // Replaced by the newer, separately dated Flash refresh.
    const model = models.get(id);
    assert(Boolean(model), `${id}: researched LLM row missing from overview.`);
    if (!model) continue;
    for (const [key, value] of Object.entries(metrics)) {
      assert(value === null ? model.metrics[key]?.value === null : close(model.metrics[key]?.value, value), `${id}.${key}: value differs from independently sourced research.`);
    }
  }
  for (const plan of zai.zaiPlans) {
    const actual = data.plans.find(row => row.companyId === 'zai' && row.name === plan.name);
    assert(actual?.price.value === plan.monthly.value, `${plan.name}: Z.ai monthly price differs from research.`);
    const normalized = actual?.usage.text.replaceAll(',', '') ?? '';
    assert(normalized.includes(String(plan.fiveHourCredits.value)) && normalized.includes(String(plan.weeklyCredits.value)), `${plan.name}: Z.ai quota differs from research.`);
  }
  for (const company of minimax.companies) for (const plan of company.plans) {
    const actual = data.plans.find(row => row.companyId === company.id && row.name === plan.name);
    const monthly = plan.monthlyUsd?.value ?? plan.monthly?.value ?? plan.priceUsd?.value;
    if (monthly !== undefined) assert(actual?.price.value === monthly, `${company.id}/${plan.name}: monthly price differs from research.`);
  }
  const ranks = await evidence('aa-global-ranks.json');
  const rankMap = new Map(ranks.entries.map(row => [row.slug, row]));
  for (const model of data.models.filter(row => row.kind === 'llm')) {
    if (model.id === 'glm-5-3-flash') continue; // Current Flash rank is verified by the refresh, not this historical manifest.
    const row = rankMap.get(model.id);
    if (!row) { assert(model.metrics.rank.value === null, `${model.id}: model absent from current global rank universe needs a missing rank.`); continue; }
    assert(close(model.metrics.ii.value, row.intelligenceIndex), `${model.id}: Intelligence Index differs from AA public manifest.`);
    assert(model.metrics.rank.value === row.globalRank, `${model.id}: rank differs from AA current-scored universe.`);
  }
}

if (failures.length) {
  console.error(`${failures.length} failures across ${checks} checks:\n${failures.map(message => `- ${message}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Passed ${checks} companies checks: ${factCount} sourced facts, six concise profiles, Flash deduplication, editable value-zone thresholds, formulas and unrelated-number preservation.`);
}
