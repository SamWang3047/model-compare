import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveCodingData } from '../coding-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const missing = [];
let assertions = 0;
let facts = 0;
const assert = (condition, message) => { assertions++; if (!condition) errors.push(message); };
const read = file => readFile(path.join(root, file), 'utf8');
const exists = async file => { try { await access(path.join(root, file)); return true; } catch { return false; } };
const close = (left, right) => Number.isFinite(left) && Number.isFinite(right)
  && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
const date = value => /^\d{4}-\d{2}-\d{2}$/u.test(value ?? '')
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const normalizeUrl = value => { try { const url = new URL(value); url.hash = ''; return url.href.replace(/\/$/u, ''); } catch { return ''; } };
const hostname = value => { try { return new URL(value).hostname; } catch { return ''; } };
const coding = JSON.parse(await read('coding.json'));
const html = await read('index.html');
const allowedLabels = new Set(['verified', 'vendor_reported', 'third_party', 'calculated', 'not_found']);
const modelIds = ['opus', 'sol', 'glm', 'qwen_flash', 'kimi', 'mimo', 'deepseek'];
const metricNames = [
  'arena_score', 'arena_price', 'terminal_bench', 'intelligence', 'output_tokens',
  'api_input', 'api_output', 'speed', 'context', 'index_total_cost', 'index_cost_per_task'
];
const models = new Map((coding.models ?? []).map(model => [model.id, model]));
const sources = new Map((coding.sources ?? []).map(source => [source.id, source]));
const sourceUrls = new Set((coding.sources ?? []).map(source => normalizeUrl(source.url)));

assert(Array.isArray(coding.models) && coding.models.length === modelIds.length, 'Coding comparison must contain seven model configurations.');
assert(models.size === modelIds.length, 'Coding model IDs must be unique.');
for (const id of modelIds) assert(models.has(id), `Missing coding model configuration: ${id}.`);
assert(sources.size === (coding.sources ?? []).length, 'Coding source IDs must be unique.');
assert(sourceUrls.size === (coding.sources ?? []).length, 'Coding source URLs must be deduplicated.');
for (const source of coding.sources ?? []) {
  assert(typeof source.title === 'string' && source.title.trim().length > 0, `${source.id}: source needs a title.`);
  assert(/^https:\/\//u.test(source.url ?? ''), `${source.id}: source must use HTTPS.`);
  assert(date(source.date), `${source.id}: source needs a retrieval date.`);
}

function checkFact(fact, location, context = '') {
  facts++;
  assert(fact && typeof fact === 'object' && Object.hasOwn(fact, 'value'), `${location}: missing fact object.`);
  if (!fact || typeof fact !== 'object') return;
  assert(allowedLabels.has(fact.label), `${location}: unrecognized evidence label ${fact.label}.`);
  assert(typeof fact.unit === 'string' && fact.unit.length > 0, `${location}: fact needs a unit.`);
  assert(/^https:\/\//u.test(fact.source_url ?? ''), `${location}: fact needs an HTTPS source URL.`);
  assert(sourceUrls.has(normalizeUrl(fact.source_url)), `${location}: source is absent from the footer source registry.`);
  assert(date(fact.retrieved_date), `${location}: fact needs a retrieval date.`);
  assert(typeof fact.note === 'string', `${location}: fact needs a note, even when the note is empty.`);
  assert((fact.value === null) === (fact.label === 'not_found'), `${location}: null and not_found must occur together.`);
  if (typeof fact.value === 'number') assert(Number.isFinite(fact.value), `${location}: value must be finite.`);
  if (fact.snapshot_date !== undefined) {
    assert(date(fact.snapshot_date), `${location}: snapshot date must be a date.`);
    assert(fact.snapshot_date <= fact.retrieved_date, `${location}: snapshot cannot occur after retrieval.`);
  }
  if (fact.older_snapshot !== undefined) assert(typeof fact.older_snapshot === 'boolean', `${location}: older_snapshot must be boolean.`);
  if (fact.label === 'not_found') {
    assert(fact.note.trim().length > 0, `${location}: a missing fact must explain the gap.`);
    missing.push({ item: context ? `${context} — ${fact.unit} (${location})` : location, note: fact.note });
  }
}

// Check every declared fact, including subscription and benchmark references,
// without prescribing the page's presentation of secondary evidence.
function inspect(value, location = 'coding', context = '') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${location}[${index}]`, context));
  const name = value.name ?? value.title ?? context;
  if (Object.hasOwn(value, 'value') && Object.hasOwn(value, 'label')) checkFact(value, location, name);
  for (const [key, child] of Object.entries(value)) inspect(child, `${location}.${key}`, name);
}
inspect(coding);

for (const model of coding.models ?? []) {
  assert(typeof model.name === 'string' && model.name.trim().length > 0, `${model.id}: model needs its sourced configuration name.`);
  for (const key of metricNames) {
    const metric = model.metrics?.[key];
    assert(Boolean(metric), `${model.id}: missing ${key} metric.`);
    if (metric?.value !== null && metric?.value !== undefined) {
      assert(typeof metric.value === 'number' && metric.value >= 0, `${model.id}.${key}: metric must be a nonnegative raw number.`);
    }
  }
  const terminal = model.metrics?.terminal_bench;
  assert(terminal?.label === 'verified' && Number.isFinite(terminal.value), `${model.id}: use the independently verified current model-level Terminal-Bench result.`);
  assert(hostname(terminal?.source_url) === 'artificialanalysis.ai', `${model.id}: independent terminal result must cite Artificial Analysis.`);
  assert(terminal?.value >= 0 && terminal?.value <= 100, `${model.id}: terminal score must be a percentage.`);
  const intelligence = model.metrics?.intelligence;
  assert(intelligence?.label === 'verified' && Number.isFinite(intelligence.value), `${model.id}: current Intelligence Index is verified, not estimated.`);
  assert(hostname(intelligence?.source_url) === 'artificialanalysis.ai', `${model.id}: Intelligence Index must cite Artificial Analysis.`);
  assert(/v?4\.3\.2/u.test(`${intelligence?.note ?? ''} ${coding.intelligence_index_version ?? ''}`), `${model.id}: identify Intelligence Index v4.3.2.`);
  assert(model.metrics?.output_tokens?.label === 'verified', `${model.id}: use the observed Intelligence Index output-token count.`);
  assert(Number.isInteger(model.metrics?.output_tokens?.value), `${model.id}: retain raw token counts instead of rounded millions.`);
}
assert(/GPT-6\.1 Sol/iu.test(models.get('sol')?.name ?? ''), 'The baseline must be GPT-6.1 Sol, not the GPT-6 predecessor.');
assert(/Qwen3\.8[- ]Flash[- ]Next/iu.test(models.get('qwen_flash')?.name ?? ''), 'Qwen Flash Next must not be replaced by Qwen Max.');
assert(/GLM[- ]5\.3[- ]Flash/iu.test(models.get('glm')?.name ?? ''), 'The comparison row must be GLM Flash, not flagship GLM-5.3.');
assert(!close(models.get('glm')?.metrics?.intelligence?.value, 57), 'Do not reuse GLM Flash Intelligence Index v4.1.1.');
assert(!close(models.get('qwen_flash')?.metrics?.intelligence?.value, 56), 'Do not reuse Qwen Flash Next Intelligence Index v4.1.1.');

const opus = models.get('opus');
const vendor = opus?.metrics?.vendor_tb4 ?? opus?.vendor_tb4;
assert(Boolean(vendor), 'Keep the Opus vendor-reported result separate from its independent result.');
assert(vendor?.label === 'vendor_reported', 'The Opus vendor result must be labelled vendor_reported.');
assert(/(^|\.)anthropic\.com$/u.test(hostname(vendor?.source_url)), 'The vendor result must cite Anthropic directly.');
assert(/xhigh/iu.test(vendor?.note ?? ''), 'The vendor result must disclose its different xhigh effort setting.');

const pairs = coding.agent_pairs ?? [];
assert(Array.isArray(pairs), 'Coding agent comparisons need a separate pair dataset.');
assert(new Set(pairs.map(pair => pair.id)).size === pairs.length, 'Coding agent pair IDs must be unique.');
const pairByName = expression => pairs.find(pair => expression.test(pair.name ?? ''));
for (const [description, expression] of [
  ['Claude Code / Fable 5.1', /Claude Code.*Fable 5\.1/iu],
  ['Codex / GPT-6 Astra', /Codex.*GPT-6 Astra/iu],
  ['Codex / GPT-6 Sol predecessor', /Codex.*GPT-6 Sol/iu],
  ['OpenCode / GLM-5.3 flagship', /Opencode.*GLM[- ]5\.3(?!(?:[- ]Flash))/iu],
  ['Claude Code / Opus 5.5', /Claude Code.*Opus 5\.5/iu],
  ['Codex / GPT-6.1 Sol (max)', /Codex.*GPT-6\.1 Sol.*\(max\)/iu]
]) assert(Boolean(pairByName(expression)), `Missing verified agent pair: ${description}.`);
for (const pair of pairs) {
  assert(typeof pair.reference_only === 'boolean', `${pair.id}: disclose whether the pair is reference-only.`);
  assert(typeof pair.name === 'string' && pair.name.length > 0, `${pair.id}: identify the agent and model configuration.`);
  for (const key of ['score', 'cost_per_task']) {
    const fact = pair.metrics?.[key];
    assert(fact?.label === 'verified', `${pair.id}.${key}: use the now-verified primary agent benchmark.`);
    assert(hostname(fact?.source_url) === 'artificialanalysis.ai', `${pair.id}.${key}: cite the primary coding agent page.`);
    assert(Number.isFinite(fact?.value) && fact.value >= 0, `${pair.id}.${key}: invalid measured agent metric.`);
  }
  assert(pair.metrics?.score?.value <= 100, `${pair.id}: agent index score must use the 0–100 scale.`);
}
assert(pairByName(/Opencode.*GLM[- ]5\.3/iu)?.reference_only === true, 'Flagship GLM agent evidence must not be presented as a Flash result.');
assert(pairByName(/Codex.*GPT-6 Sol/iu)?.name !== models.get('sol')?.name, 'The GPT-6 predecessor agent pair must remain separate from GPT-6.1.');
const terminalReference = coding.terminal_reference;
assert(/Claude Code.*GLM[- ]5\.3/iu.test(terminalReference?.name ?? '') && !/Flash/iu.test(terminalReference?.name ?? ''), 'The separate tbench reference must identify Claude Code with flagship GLM-5.3.');
assert(terminalReference?.metric?.label === 'verified' && /(^|\.)tbench\.ai$/u.test(hostname(terminalReference?.metric?.source_url)), 'The submitted harness reference must cite the official tbench leaderboard.');
assert(/agent.*(?:model|flagship)|flagship.*model/iu.test(terminalReference?.metric?.note ?? '') && /not.*Flash/iu.test(terminalReference?.metric?.note ?? ''), 'The submitted harness reference must explain why it is separate from Flash model-level evidence.');

const derived = deriveCodingData(coding);
const arenaPoints = derived.arenaPoints ?? [];
const pointIds = arenaPoints.map(point => point.id);
assert(new Set(pointIds).size === pointIds.length, 'Arena chart must contain one point per model configuration.');
const gapIds = (derived.gaps ?? []).map(gap => gap.id);
assert(new Set(gapIds).size === gapIds.length, 'Each model must have at most one comparison against Opus.');
if (pointIds.includes('opus')) {
  for (const id of ['sol', 'glm', 'qwen_flash']) {
    if (pointIds.includes(id)) assert(gapIds.includes(id), `${id}: a comparable model must have a price/score gap.`);
  }
} else assert(gapIds.length === 0, 'Without a verified Opus Arena baseline, comparative gaps must remain unavailable.');
for (const id of gapIds) assert(pointIds.includes(id) && id !== 'opus', `${id}: gap comparisons must only use comparable non-baseline points.`);
for (const point of arenaPoints) {
  const model = models.get(point.id);
  assert(Boolean(model), `Chart point ${point.id} must refer to a model in coding.json.`);
  if (!model) continue;
  assert(model.metrics.arena_score.label === 'verified' && model.metrics.arena_price.label === 'verified', `${point.id}: unverified evidence cannot enter the Arena chart.`);
  assert(!model.metrics.arena_score.older_snapshot && !model.metrics.arena_price.older_snapshot, `${point.id}: older Arena snapshots must not enter the current chart.`);
  assert(model.metrics.arena_score.snapshot_date === models.get('opus')?.metrics.arena_score.snapshot_date, `${point.id}: Arena scores must share the baseline snapshot.`);
  assert(model.metrics.arena_price.snapshot_date === model.metrics.arena_score.snapshot_date, `${point.id}: chart price and score must share an Arena snapshot.`);
  assert(close(point.x, model.metrics.arena_price.value) && point.x > 0, `${point.id}: logarithmic chart price differs from its sourced value.`);
  assert(close(point.y, model.metrics.arena_score.value), `${point.id}: chart score differs from its sourced value.`);
}
if (models.get('kimi')?.metrics?.arena_score?.value !== null) {
  assert(models.get('kimi')?.metrics?.arena_score?.older_snapshot === true, 'The older Kimi Arena result must be explicitly identified.');
  assert(!pointIds.includes('kimi'), 'Exclude older Kimi Arena evidence from the comparable chart cohort.');
}
const frontier = derived.frontierPoints ?? [];
for (let index = 0; index < frontier.length; index++) {
  const point = frontier[index];
  assert(pointIds.includes(point.id), `${point.id}: frontier must only use comparable Arena points.`);
  if (index > 0) assert(point.x >= frontier[index - 1].x, 'Pareto frontier must be ordered by price.');
  assert(!arenaPoints.some(other => other.x <= point.x && other.y >= point.y && (other.x < point.x || other.y > point.y)), `${point.id}: a dominated model cannot be on the Pareto frontier.`);
}

function validateGaps(input, result, label) {
  const baseline = input.models.find(model => model.id === 'opus');
  for (const gap of result.gaps ?? []) {
    const model = input.models.find(row => row.id === gap.id);
    assert(Boolean(model), `${label}: gap must join to an existing model.`);
    if (!model) continue;
    assert(close(gap.scoreGap, baseline.metrics.arena_score.value - model.metrics.arena_score.value), `${label}/${gap.id}: score gap must be calculated from raw sourced values.`);
    assert(close(gap.priceRatio, model.metrics.arena_price.value / baseline.metrics.arena_price.value), `${label}/${gap.id}: price ratio must be model price / Opus price.`);
    assert(close(gap.cheaperBy, baseline.metrics.arena_price.value / model.metrics.arena_price.value), `${label}/${gap.id}: inverse price ratio must be Opus price / model price.`);
  }
}
validateGaps(coding, derived, 'current');
if (arenaPoints.some(point => point.id !== 'opus') && pointIds.includes('opus')) {
  const changed = structuredClone(coding);
  const candidate = changed.models.find(model => pointIds.includes(model.id) && model.id !== 'opus');
  candidate.metrics.arena_score.value += 7;
  candidate.metrics.arena_price.value *= 1.25;
  const changedResult = deriveCodingData(changed);
  validateGaps(changed, changedResult, 'edited data');
  const oldGap = (derived.gaps ?? []).find(gap => gap.id === candidate.id);
  const newGap = (changedResult.gaps ?? []).find(gap => gap.id === candidate.id);
  if (['sol', 'glm', 'qwen_flash'].includes(candidate.id)) {
    assert(Boolean(oldGap) && Boolean(newGap), 'Changing a comparable raw value must retain its derived comparison.');
  }
  if (oldGap && newGap) {
    assert(!close(oldGap.scoreGap, newGap.scoreGap) && !close(oldGap.priceRatio, newGap.priceRatio), 'Editing the data must update derived gaps without changing chart code.');
  }
  candidate.metrics.arena_score.snapshot_date = '2026-01-01';
  const mismatched = deriveCodingData(changed);
  assert(!(mismatched.arenaPoints ?? []).some(point => point.id === candidate.id), 'A mismatched Arena snapshot must leave the current chart.');
  assert(!(mismatched.gaps ?? []).some(gap => gap.id === candidate.id), 'A mismatched Arena snapshot must leave comparative gap calculations.');
  candidate.metrics.arena_score.snapshot_date = coding.models.find(model => model.id === candidate.id).metrics.arena_score.snapshot_date;
  candidate.metrics.arena_price.snapshot_date = '2026-01-01';
  const oldPrice = deriveCodingData(changed);
  assert(!(oldPrice.arenaPoints ?? []).some(point => point.id === candidate.id), 'A mismatched price snapshot must leave the current chart.');
  assert(!(oldPrice.gaps ?? []).some(gap => gap.id === candidate.id), 'Price gaps must not combine prices and scores from different snapshots.');
  candidate.metrics.arena_price.snapshot_date = coding.models.find(model => model.id === candidate.id).metrics.arena_price.snapshot_date;
  candidate.metrics.arena_score.label = 'third_party';
  const unverified = deriveCodingData(changed);
  assert(!(unverified.arenaPoints ?? []).some(point => point.id === candidate.id), 'Third-party evidence must not enter the verified Arena chart.');
  const olderBaseline = structuredClone(coding);
  olderBaseline.models.find(model => model.id === 'opus').metrics.arena_score.older_snapshot = true;
  assert((deriveCodingData(olderBaseline).gaps ?? []).length === 0, 'An older baseline snapshot must not support current comparative gaps.');
}

assert(/<section\b[^>]*\bid=["']coding-comparison["']/iu.test(html), 'Add the coding comparison as a page section.');
assert(/data-mode=["']coding["']/iu.test(html) && /aria-controls=["']coding-comparison["']/iu.test(html), 'The coding comparison must be reachable through its tab.');
for (const file of ['coding.json', 'coding-data.js', 'coding-comparison.js', 'coding-charts.js', 'coding-comparison.css', 'table-dialog.js']) {
  assert(await exists(file), `Missing static coding comparison asset: ${file}.`);
  const build = await read('scripts/build.mjs');
  assert(build.includes(file), `The production build must copy ${file}.`);
}

// This one-time integration audit is opt-in so future research refreshes can
// intentionally change datasets without weakening the provenance checks.
const referenceIndex = process.argv.indexOf('--reference');
if (referenceIndex >= 0) {
  const revision = process.argv[referenceIndex + 1];
  assert(Boolean(revision), '--reference needs a Git revision.');
  if (revision) {
    for (const file of ['data.json', 'companies.json']) {
      const previous = spawnSync('git', ['show', `${revision}:${file}`], { cwd: root, encoding: 'utf8' });
      assert(previous.status === 0, `Cannot read ${file} from the audit revision.`);
      if (previous.status === 0) {
        const previousData = JSON.parse(previous.stdout);
        const currentData = JSON.parse(await read(file));
        for (const [key, value] of Object.entries(previousData)) {
          assert(JSON.stringify(value) === JSON.stringify(currentData[key]), `${file}.${key}: existing report data must remain unchanged in this additive update.`);
        }
      }
    }
    const previousHtml = spawnSync('git', ['show', `${revision}:index.html`], { cwd: root, encoding: 'utf8' });
    assert(previousHtml.status === 0, 'Cannot read the original page for the additive section audit.');
    if (previousHtml.status === 0) {
      const previousSections = [...previousHtml.stdout.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/giu)].map(match => match[1]);
      const currentSections = new Set([...html.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/giu)].map(match => match[1]));
      const mergedSections = { harness: 'scenarios' };
      for (const id of previousSections) assert(currentSections.has(mergedSections[id] || id), `Existing section #${id} was removed without a merged destination.`);
    }
  }
}

if (errors.length) {
  console.error(`Coding comparison checks failed (${errors.length}/${assertions}):\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Coding comparison checks passed: ${assertions} checks across ${facts} sourced facts.`);
}
if (missing.length) console.log(`Not found items (${missing.length}):\n${missing.map(item => `- ${item.item}: ${item.note}`).join('\n')}`);
