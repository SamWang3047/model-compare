import { renderCompanyCharts } from './companies-charts.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 1) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
const money = value => `$${number(value, 4)}`;
const percent = value => `${number(value)}%`;
const points = value => `${value > 0 ? '+' : ''}${number(value)} points`;
const dateText = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Date not found';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const typeLabels = { verified: 'Verified fact', inference: 'Analyst inference', calculated: 'Calculated', missing: 'Not found', illustrative: 'Illustrative assumption', estimate: 'Estimated', estimated: 'Estimated' };
let data;
let sourceMap = new Map();
let mode = 'llm';
let sort = { key: 'ii', direction: -1 };

function sourceLink(source, label = source.title) {
  let url;
  try { url = new URL(source.url); } catch { return esc(label); }
  if (!['https:', 'http:'].includes(url.protocol)) return esc(label);
  return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}
function fact(item, fallbackType = 'missing') {
  if (item && typeof item === 'object' && !Array.isArray(item)) return item;
  return { value: item ?? null, type: item == null ? 'missing' : fallbackType, date: data.snapshot_date, source_ids: [] };
}
function badge(item) {
  const type = item?.type || 'missing';
  return `<span class="content-label cmp-label ${type === 'inference' || type === 'missing' || type === 'estimate' || type === 'estimated' ? 'inference' : type === 'calculated' ? 'calculated' : ''}">${esc(typeLabels[type] || type)}</span>`;
}
function provenance(item, compact = false) {
  const refs = [...new Set(item?.source_ids || [])].map(id => sourceMap.get(id)).filter(Boolean);
  const date = item?.date || data.snapshot_date;
  const links = compact && refs.length > 2 ? `<details class="cmp-source-disclosure"><summary>${refs.length} sources ↗</summary><div>${refs.map(source => sourceLink(source)).join('')}</div></details>` : refs.map((source, index) => sourceLink(source, compact ? `Source${refs.length > 1 ? ` ${index + 1}` : ''} ↗` : source.title)).join('');
  return `<div class="provenance cmp-provenance"><time datetime="${esc(date)}">${dateText(date)}</time>${links}</div>`;
}
function displayValue(item, formatter = value => String(value)) {
  const value = item?.value;
  if (value === null || value === undefined || value === '' || /^(not found|not published)$/i.test(String(value))) return 'Not found';
  return typeof value === 'number' && Number.isFinite(value) ? formatter(value) : String(value);
}
function metric(item, formatter, compact = true) {
  const normalized = fact(item);
  const note = normalized.note ? `<span class="cmp-metric-note">${esc(normalized.note)}</span>` : '';
  return `<div class="cmp-fact"><strong class="cmp-fact-value">${esc(displayValue(normalized, formatter))}</strong>${badge(normalized)}${provenance(normalized, compact)}${note}</div>`;
}
function content(item, title = '', compact = false) {
  const normalized = fact(item);
  const text = normalized.text ?? normalized.value ?? 'Not found';
  return `<div class="content-item cmp-content">${title ? `<h4>${esc(title)}</h4>` : ''}${badge(normalized)}<p>${esc(text)}</p>${provenance(normalized, compact)}</div>`;
}
function write(selector, html) {
  const target = $(selector);
  if (target) target.innerHTML = html;
}
function companyFor(model) { return data.companies.find(company => company.id === model.companyId); }
function modelFor(id) { return data.models.find(model => model.id === id); }
function valueFor(model, key) {
  if (key === 'company') return model.company || companyFor(model)?.name || '';
  if (key === 'name') return model.name || '';
  const value = model.metrics?.[key]?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function chooseRows() {
  const flagshipIds = new Set(data.companies.map(company => company.flagshipId));
  return data.models.filter(model => model.kind === mode && (model.baseline || model.role === 'flagship' || flagshipIds.has(model.id)));
}
function bestFor(model) {
  const company = companyFor(model);
  const entry = company?.profile?.find(item => /^best\s+for/i.test(item.label || ''));
  if (entry) return content(entry, '', true);
  if (model.bestFor) return content(model.bestFor, '', true);
  return model.baseline ? '<span class="cmp-muted">Reference baseline</span>' : '<span class="cmp-muted">See company profile</span>';
}
function gapCell(model) {
  if (model.baseline) return '<span class="cmp-baseline-tag">Reference baseline</span>';
  const metrics = model.metrics || {};
  return `<div class="cmp-gap-line"><span>vs. Sol max</span>${metric(metrics.gapSol, points)}</div><div class="cmp-gap-line"><span>vs. Opus max</span>${metric(metrics.gapOpus, points)}</div>`;
}
function intelligenceCell(model) {
  return `${metric(model.metrics?.ii, value => number(value, 0))}<div class="cmp-rank">${metric(model.metrics?.rank, value => `Rank #${number(value, 0)}`)}</div>`;
}
function confidenceCell(model) {
  const low = model.metrics?.ciLow;
  const high = model.metrics?.ciHigh;
  if (!low || !high || valueFor(model, 'ciLow') == null || valueFor(model, 'ciHigh') == null) return '';
  return `<div class="cmp-ci"><span>95% confidence interval</span>${metric(low, value => number(value, 0))}${metric(high, value => number(value, 0))}</div>`;
}
function tableColumns() {
  const common = [
    { key: 'company', label: 'Company', direction: 1, render: model => `<strong>${esc(model.company || companyFor(model)?.name || '')}</strong>${model.baseline ? '<span class="cmp-baseline-tag">Baseline</span>' : ''}` },
    { key: 'name', label: 'Model / effort', direction: 1, render: model => `<strong>${esc(model.name)}</strong><small class="cmp-role">${esc(model.role || '')}</small>` }
  ];
  return mode === 'llm' ? [...common,
    { key: 'ii', label: 'Intelligence ↑', direction: -1, render: intelligenceCell },
    { key: 'gap', label: 'Gap to baselines', render: gapCell },
    { key: 'input', label: 'Input $/M ↓', direction: 1, render: model => metric(model.metrics?.input, money) },
    { key: 'output', label: 'Output $/M ↓', direction: 1, render: model => metric(model.metrics?.output, money) },
    { key: 'cache', label: 'Cache $/M ↓', direction: 1, render: model => metric(model.metrics?.cache, money) },
    { key: 'bestFor', label: 'Best for', render: bestFor }
  ] : [...common,
    { key: 'elo', label: 'Video arena score ↑', direction: -1, render: model => metric(model.metrics?.elo, value => number(value, 0)) + confidenceCell(model) },
    { key: 'rank', label: 'Arena rank ↓', direction: 1, render: model => metric(model.metrics?.rank, value => `#${number(value, 0)}`) },
    { key: 'priceSecond', label: 'Price $/second ↓', direction: 1, render: model => metric(model.metrics?.priceSecond, money) },
    { key: 'bestFor', label: 'Best for', render: bestFor }
  ];
}
function renderComparison() {
  const target = $('#company-table');
  if (!target) return;
  const columns = tableColumns();
  const rows = chooseRows().sort((a, b) => {
    const av = valueFor(a, sort.key), bv = valueFor(b, sort.key);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.direction;
  });
  const best = new Map(columns.filter(column => ['ii', 'input', 'output', 'cache', 'elo', 'priceSecond'].includes(column.key)).map(column => {
    const values = rows.map(model => valueFor(model, column.key)).filter(value => typeof value === 'number');
    return [column.key, values.length ? Math[column.direction === 1 ? 'min' : 'max'](...values) : null];
  }));
  const caption = target.querySelector('caption') || target.createCaption();
  caption.textContent = mode === 'llm' ? `Current flagship LLMs + reference baselines · ${dateText(data.snapshot_date)} · USD per million tokens · Prices subject to context/cache conditions` : `Video arena comparisons · ${dateText(data.snapshot_date)} · Video scores are separate from the LLM Intelligence Index · Format and pricing conditions apply`;
  const head = target.tHead || target.createTHead();
  head.innerHTML = `<tr>${columns.map(column => `<th scope="col"${column.direction ? ` aria-sort="${column.key === sort.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}"` : ''}>${column.direction ? `<button type="button" data-company-sort="${esc(column.key)}">${esc(column.label)}<span class="sort-indicator" aria-hidden="true">${column.key === sort.key ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span></button>` : esc(column.label)}</th>`).join('')}</tr>`;
  const body = target.tBodies[0] || target.createTBody();
  body.innerHTML = rows.map(model => `<tr class="${model.baseline ? 'cmp-baseline-row' : ''}">${columns.map(column => `<td${best.has(column.key) && valueFor(model, column.key) != null && valueFor(model, column.key) === best.get(column.key) ? ' class="best"' : ''}>${column.render(model)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No sourced models found for this category.</td></tr>`;
}
function cardMetric(label, item, formatter) {
  return `<div><dt>${esc(label)}</dt><dd>${metric(item, formatter)}</dd></div>`;
}
function renderCompanyCards() {
  write('#company-cards', data.companies.map(company => {
    const model = modelFor(company.flagshipId);
    if (!model) return '';
    const metrics = model.metrics || {};
    const headline = model.kind === 'video' ? cardMetric('Video arena score', metrics.elo, value => number(value, 0)) + cardMetric('API $/second', metrics.priceSecond, money) : cardMetric('Intelligence Index', metrics.ii, value => number(value, 0)) + cardMetric('API input, $/M', metrics.input, money) + cardMetric('API output, $/M', metrics.output, money);
    const profile = (company.profile || []).map(item => `<div class="cmp-profile-line"><dt>${esc(item.label)}</dt><dd><p>${esc(item.text)}</p>${badge(item)}${provenance(item, true)}</dd></div>`).join('');
    return `<article class="company-card" id="company-${esc(company.id)}"><div class="cmp-card-head"><span class="small-label">${model.kind === 'video' ? 'VIDEO COMPANY' : 'LLM COMPANY'}</span><h3>${esc(company.name)}</h3><p>${esc(model.name)}</p></div>${company.gapBadge ? `<div class="cmp-gap-badge">${content(company.gapBadge, '', true)}</div>` : ''}<dl class="cmp-card-metrics">${headline}</dl><dl class="cmp-profile">${profile}</dl>${company.match ? `<div class="cmp-match">${content(company.match, 'How it compares', true)}</div>` : ''}<a class="cmp-detail-link" href="#model-${esc(model.id)}" data-open-model="${esc(model.id)}">Sources, prices &amp; model details →</a></article>`;
  }).join(''));
  $('#company-cards')?.classList.add('companies-grid');
}
const detailMetrics = [
  ['ii', 'Intelligence Index'], ['rank', 'Current leaderboard rank'], ['input', 'API input, $/M', money], ['output', 'API output, $/M', money], ['cache', 'Cached input, $/M', money], ['blended', 'Blended API price, $/M', money],
  ['tb4', 'Terminal-Bench 4.0', percent], ['sciCode', 'SciCode (under review)', percent], ['agent', 'AutomationBench (SaaS workflows)', percent], ['context', 'Context tokens', value => number(value, 0)], ['weights', 'Weight availability'], ['modalities', 'Input / output modalities'],
  ['gapSol', 'II gap vs. Sol max', points], ['gapOpus', 'II gap vs. Opus max', points], ['outputRatioSol', 'Output-price ratio to Sol', value => `${number(value, 4)}×`], ['outputRatioOpus', 'Output-price ratio to Opus', value => `${number(value, 4)}×`],
  ['elo', 'Video arena score', value => number(value, 0)], ['ciLow', '95% interval lower bound', value => number(value, 0)], ['ciHigh', '95% interval upper bound', value => number(value, 0)], ['priceMinute', 'Price per minute', money], ['priceSecond', 'Price per second', money], ['modes', 'Generation modes'], ['resolution', 'Maximum resolution'], ['duration', 'Maximum duration']
];
function renderModelDetails() {
  const rows = data.models;
  write('#model-details', rows.map(model => {
    const shown = detailMetrics.filter(([key]) => model.metrics?.[key]);
    const extras = Object.entries(model.metrics || {}).filter(([key]) => !detailMetrics.some(([known]) => known === key));
    const fields = shown.map(([key, label, formatter]) => cardMetric(label, model.metrics[key], formatter)).join('') + extras.map(([key, value]) => cardMetric(key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()), value)).join('');
    return `<details class="accordion cmp-model-detail" id="model-${esc(model.id)}" data-model-kind="${esc(model.kind)}"${model.kind !== mode ? ' hidden' : ''}><summary>${esc(model.name)}<span class="summary-meta">${esc(model.baseline ? 'Reference baseline' : model.role || 'Model details')}</span></summary><div class="detail-body"><dl class="cmp-detail-metrics">${fields}</dl>${(model.notes || []).map(item => content(item, item.title || '')).join('')}</div></details>`;
  }).join(''));
}
function renderPlans() {
  const groupIds = [...new Set((data.plans || []).map(plan => plan.companyId))];
  write('#plan-details', groupIds.map(id => {
    const company = data.companies.find(item => item.id === id);
    const plans = data.plans.filter(plan => plan.companyId === id);
    return `<details class="accordion cmp-plan-group"><summary>${esc(company?.name || id)}<span class="summary-meta">Plans, limits &amp; supported tools</span></summary><div class="detail-body cmp-plan-grid">${plans.map(plan => `<article class="cmp-plan"><h4>${esc(plan.name)}</h4><div class="cmp-plan-price">${metric(plan.price, value => `${plan.priceUnit?.startsWith('CNY') ? `¥${number(value, 4)}` : money(value)}${plan.priceUnit?.includes('month') ? ' / month' : ''}`)}${plan.priceUnit ? `<span class="cmp-price-unit">${esc(plan.priceUnit)}</span>` : ''}</div>${plan.usage ? content(plan.usage, 'Usage limits', true) : ''}${plan.tools ? content(plan.tools, 'Tools', true) : ''}${(plan.notes || []).map(item => content(item, item.title || '', true)).join('')}</article>`).join('')}</div></details>`;
  }).join(''));
}
function renderOverview() {
  write('#overview-text', content(data.overview));
  write('#method-notes', (data.methods || []).map(item => content(item, item.title || '')).join(''));
  write('#scenario-guide', (data.scenarios || []).map(item => `<article class="recommendation-card cmp-scenario">${content(item, item.title || '')}</article>`).join(''));
  $('#scenario-guide')?.classList.add('recommendation-grid');
  write('#data-limits', (data.limits || []).map(item => `<details class="accordion"><summary>${esc(item.title || 'Data limit')}</summary><div class="detail-body">${content(item)}</div></details>`).join(''));
  write('#source-list', (data.sources || []).map(source => `<div class="source-item">${sourceLink(source, `${source.title} ↗`)}<time datetime="${esc(source.date || data.snapshot_date)}">${dateText(source.date || data.snapshot_date)}</time></div>`).join(''));
  const date = $('#last-updated');
  if (date) { date.textContent = dateText(data.snapshot_date); date.dateTime = data.snapshot_date; }
  const footerDate = $('#footer-date');
  if (footerDate) footerDate.textContent = `New companies overview updated ${dateText(data.snapshot_date)}. The original coding report retains its 5 October 2026 snapshot.`;
}
function setMode(nextMode) {
  mode = nextMode === 'video' ? 'video' : 'llm';
  sort = { key: mode === 'llm' ? 'ii' : 'elo', direction: -1 };
  document.documentElement.dataset.companyMode = mode;
  document.querySelectorAll('#mode-toggle [data-mode]').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-kind-panel], [data-model-kind]').forEach(panel => {
    const kind = panel.dataset.kindPanel || panel.dataset.modelKind;
    panel.hidden = kind !== mode;
  });
  renderComparison();
  renderModelDetails();
  document.dispatchEvent(new CustomEvent('companies:mode', { detail: { mode } }));
}
function initTheme() {
  const button = $('#theme-toggle');
  if (!button) return;
  const modes = ['system', 'light', 'dark'];
  if (!document.documentElement.dataset.theme) {
    try { document.documentElement.dataset.theme = localStorage.getItem('model-compare-theme') || 'system'; } catch { document.documentElement.dataset.theme = 'system'; }
  }
  const refresh = () => {
    const current = document.documentElement.dataset.theme || 'system';
    const label = $('#theme-label');
    if (label) label.textContent = current.charAt(0).toUpperCase() + current.slice(1);
    button.setAttribute('aria-label', `Color theme: ${current}. Activate to choose ${modes[(modes.indexOf(current) + 1) % modes.length]}.`);
  };
  button.addEventListener('click', () => {
    const next = modes[(modes.indexOf(document.documentElement.dataset.theme || 'system') + 1) % modes.length];
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('model-compare-theme', next); } catch { /* Manual theme remains available. */ }
    refresh();
  });
  refresh();
}
function initNavigation() {
  const revealModel = detail => {
    if (!detail) return;
    detail.open = true;
    let parent = detail.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  };
  document.addEventListener('click', event => {
    const toggle = event.target.closest('#mode-toggle [data-mode]');
    if (toggle) setMode(toggle.dataset.mode);
    const sorter = event.target.closest('[data-company-sort]');
    if (sorter) {
      const key = sorter.dataset.companySort;
      sort = { key, direction: sort.key === key ? -sort.direction : tableColumns().find(column => column.key === key)?.direction || 1 };
      renderComparison();
      $(`[data-company-sort="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    }
    const detailLink = event.target.closest('[data-open-model]');
    if (detailLink) {
      const model = modelFor(detailLink.dataset.openModel);
      if (model?.kind !== mode) setMode(model.kind);
      const detail = document.getElementById(`model-${detailLink.dataset.openModel}`);
      revealModel(detail);
    }
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        document.querySelectorAll('#toc a[href^="#"]').forEach(anchor => {
          const active = anchor.hash === `#${entry.target.id}`;
          anchor.classList.toggle('active', active);
          if (active) anchor.setAttribute('aria-current', 'location'); else anchor.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-18% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('.report-section, .report-footer').forEach(section => observer.observe(section));
  }
  if (location.hash.startsWith('#model-')) {
    const model = modelFor(decodeURIComponent(location.hash.slice(7)));
    if (model) {
      if (model.kind !== mode) setMode(model.kind);
      const detail = document.getElementById(`model-${model.id}`);
      if (detail) { revealModel(detail); requestAnimationFrame(() => detail.scrollIntoView()); }
    }
  }
}
async function start() {
  initTheme();
  try {
    const response = await fetch('./companies.json');
    if (!response.ok) throw new Error(`Company dataset returned ${response.status}`);
    data = await response.json();
    sourceMap = new Map((data.sources || []).map(source => [source.id, source]));
    renderOverview(); renderCompanyCards(); renderPlans(); setMode('llm');
    renderCompanyCharts(data);
    initNavigation();
    document.documentElement.dataset.ready = 'true';
  } catch (error) {
    write('#overview-text', '<p>The companies overview could not load. Refresh the page or download <a href="./companies.json">companies.json</a>.</p>');
    console.error('Companies overview initialization failed:', error);
  }
}
start();
