/**
 * Combine the two published snapshots for the single-page report.
 * Source JSON stays untouched; facts retain their own observation dates.
 */
const clone = value => JSON.parse(JSON.stringify(value));

function sourceUrlKey(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return String(url || '').replace(/\/+$/, '');
  }
}

function remapReferences(value, aliases) {
  if (Array.isArray(value)) return value.map(item => remapReferences(item, aliases));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'source_ids' && Array.isArray(item)) {
      result[key] = [...new Set(item.map(id => aliases.get(id) || id))];
    } else if (key === 'metric_sources' && item && typeof item === 'object') {
      result[key] = Object.fromEntries(Object.entries(item).map(([metric, id]) => [metric, aliases.get(id) || id]));
    } else {
      result[key] = remapReferences(item, aliases);
    }
  }
  return result;
}

const modelJoins = {
  glm: { id: 'glm-5-3-flash', companyId: 'zai' },
  deepseek: { id: 'deepseek-v4-1-flash', companyId: 'deepseek' },
  mimo: { id: 'mimo-v2-6-pro', companyId: 'xiaomi', company: 'Xiaomi (MiMo)' },
  qwen: { id: 'qwen3-8-max-0902', companyId: 'alibaba', company: 'Alibaba (Qwen)' },
  kimi: { id: 'kimi-k3', companyId: 'kimi' },
  minimax: { id: 'minimax-m3', companyId: 'minimax' },
  sol_medium: { id: 'gpt-6-1-sol-medium', companyId: 'openai', company: 'OpenAI' },
  sol_max: { id: 'gpt-6-1-sol', companyId: 'openai' },
  opus: { id: 'claude-opus-5-5', companyId: 'anthropic' }
};

const baseMetricFields = {
  tb4: 'tb4_percent',
  context: 'context_tokens',
  input: 'input_usd_per_million',
  output: 'output_usd_per_million',
  cache: 'cache_read_usd_per_million'
};

const codingMetricFields = {
  speed: 'output_tokens_per_second',
  latency: 'first_answer_seconds',
  lcr_percent: 'aa_lcr_percent',
  codingCost: 'tb4_api_usd_per_attempt'
};

function reportMetric(model, field, fallbackDate) {
  const value = model[field];
  const sourceId = model.metric_sources?.[field];
  const metric = {
    value: value ?? null,
    type: value == null ? 'missing' : model.type || 'verified',
    date: model.date || fallbackDate,
    source_ids: sourceId ? [sourceId] : [...(model.source_ids || [])]
  };
  if (field === 'first_answer_seconds') metric.note = 'AA time to first answer; this includes reasoning time and is not network-only first-token latency.';
  if (field === 'aa_lcr_percent') metric.note = 'AA long-context recall test; not a completion or reliability rate for multi-hour coding.';
  if (field === 'tb4_api_usd_per_attempt') metric.note = 'AA Terminal-Bench 4.0 API spend per attempted task in the common harness; not cost per successful task.';
  if (field === 'output_tokens_per_second') metric.note = 'AA observed output generation speed in the original coding-report snapshot.';
  return metric;
}

function missingMetric(model, message, fallbackDate) {
  return {
    value: null,
    type: 'missing',
    date: model.date || fallbackDate,
    source_ids: model.metric_sources?.tb4_percent ? [model.metric_sources.tb4_percent] : [],
    note: message
  };
}

/**
 * @param {object} companyData Existing companies.json snapshot.
 * @param {object} reportData Existing data.json coding snapshot.
 * @returns {object} Company-shaped data plus source-remapped original .report.
 */
export function createUnifiedData(companyData, reportData) {
  const companyAliases = new Map();
  const reportAliases = new Map();
  const sourceByUrl = new Map();
  const sources = [];
  const usedIds = new Set();

  function addSource(source, preferredId, aliases) {
    const urlKey = sourceUrlKey(source.url);
    const existing = sourceByUrl.get(urlKey);
    if (existing) {
      aliases.set(source.id, existing.id);
      return;
    }
    let id = preferredId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${preferredId}:${suffix++}`;
    const canonical = { ...clone(source), id };
    usedIds.add(id);
    sources.push(canonical);
    sourceByUrl.set(urlKey, canonical);
    aliases.set(source.id, id);
  }

  // Existing company titles and dates take precedence for repeated URLs.
  (companyData.sources || []).forEach(source => addSource(source, source.id, companyAliases));
  (reportData.sources || []).forEach(source => addSource(source, `report:${source.id}`, reportAliases));

  const data = remapReferences(clone(companyData), companyAliases);
  const report = remapReferences(clone(reportData), reportAliases);
  data.sources = sources;
  report.sources = sources;
  data.models ||= [];
  data.companies ||= [];
  const sourceMap = new Map(sources.map(source => [source.id, source]));

  for (const reportModel of report.models || []) {
    const join = modelJoins[reportModel.id];
    if (!join) continue;
    let model = data.models.find(item => item.id === join.id);

    if (model) {
      // Require the same AA model page, keeping effort variants and Kimi K3
      // separate from K2.7 Code rather than joining by vendor or nickname.
      const expectedUrl = sourceUrlKey(reportModel.aa_source);
      const modelSourceUrls = Object.values(model.metrics || {}).flatMap(metric => metric.source_ids || []).map(id => sourceUrlKey(sourceMap.get(id)?.url));
      if (!modelSourceUrls.includes(expectedUrl)) {
        throw new Error(`Cannot merge different model configurations: ${reportModel.model} and ${model.name}`);
      }
    } else {
      model = {
        id: join.id,
        companyId: join.companyId,
        company: join.company,
        name: reportModel.model,
        chartLabel: reportModel.short_name || reportModel.display_name || reportModel.model,
        role: 'companion',
        kind: 'llm',
        baseline: false,
        metrics: {
          ii: missingMetric(reportModel, 'Intelligence Index is not included for this configuration in the two published snapshots; no score is inferred.', report.snapshot_date),
          rank: missingMetric(reportModel, 'A comparable global Intelligence Index rank is not included in the published snapshots.', report.snapshot_date),
          weights: missingMetric(reportModel, 'Weights or license information is not included for this model in the published coding snapshot.', report.snapshot_date),
          gapSol: missingMetric(reportModel, 'An Intelligence Index gap cannot be calculated without this configuration’s score.', report.snapshot_date),
          gapOpus: missingMetric(reportModel, 'An Intelligence Index gap cannot be calculated without this configuration’s score.', report.snapshot_date)
        },
        notes: []
      };
      data.models.push(model);
    }

    model.reportModelId = reportModel.id;
    model.bestFor ||= reportModel.card_description;
    for (const [metric, field] of Object.entries(baseMetricFields)) {
      // The overview's later exact coding scores, prices and context facts win.
      model.metrics[metric] ||= reportMetric(reportModel, field, report.snapshot_date);
    }
    for (const [metric, field] of Object.entries(codingMetricFields)) {
      model.metrics[metric] = reportMetric(reportModel, field, report.snapshot_date);
    }
    model.metrics.lcr ||= reportMetric(reportModel, 'aa_lcr_percent', report.snapshot_date);

    if (!model.metrics.blended && Number.isFinite(model.metrics.input?.value) && Number.isFinite(model.metrics.output?.value)) {
      model.metrics.blended = {
        value: (3 * model.metrics.input.value + model.metrics.output.value) / 4,
        type: 'calculated',
        date: reportModel.date || report.snapshot_date,
        source_ids: [...new Set([...model.metrics.input.source_ids, ...model.metrics.output.source_ids])],
        note: '(3 × uncached input + output) / 4, USD per million total tokens. Illustrative token mix; excludes cache, context uplifts, retries and tool fees. Not cost per successful task.'
      };
    }

    let company = data.companies.find(item => item.id === model.companyId);
    if (!company) {
      company = {
        id: model.companyId,
        name: model.company || join.company,
        flagshipId: model.id,
        modelIds: [],
        profile: []
      };
      data.companies.push(company);
    }
    company.modelIds ||= [];
    if (!company.modelIds.includes(model.id)) company.modelIds.push(model.id);
  }

  data.report = report;
  data.chart_settings = clone(report.chart_settings || {});
  data.value_zone = data.chart_settings.value_zone;
  return data;
}
