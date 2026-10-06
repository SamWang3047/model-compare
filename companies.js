import { renderCompanyCharts } from './companies-charts.js';
import { renderCodingSections } from './app.js';
import { createUnifiedData } from './model-data.js';
import { initTableDialog } from './table-dialog.js';
import { renderCodingComparison } from './coding-comparison.js';
import { renderWorkflow } from './workflow.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 1) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
const intelligence = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = value => `$${number(value, 4)}`;
const percent = value => `${number(value)}%`;
const points = value => `${value > 0 ? '+' : ''}${intelligence(value)} points`;
const dateText = date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Date not found';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const typeLabels = { verified: 'Verified fact', inference: 'Analyst inference', calculated: 'Calculated', missing: 'Not found', illustrative: 'Illustrative assumption', estimate: 'Estimated', estimated: 'Estimated' };
let data;
let sourceMap = new Map();
let mode = 'llm';
let sort = { key: 'tb4', direction: -1 };
let infoEntries = new Map();
let infoTrigger = null;

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
function content(item, title = '', compact = false, showEvidenceLabel = true) {
  const normalized = fact(item);
  const text = normalized.text ?? normalized.value ?? 'Not found';
  return `<div class="content-item cmp-content">${title ? `<h4>${esc(title)}</h4>` : ''}${showEvidenceLabel ? badge(normalized) : ''}<p>${esc(text)}</p>${provenance(normalized, compact)}</div>`;
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
function chooseRows(expanded = false) {
  const flagshipIds = new Set(data.companies.map(company => company.flagshipId));
  return data.models.filter(model => model.kind === mode && (expanded || model.baseline || model.role === 'flagship' || flagshipIds.has(model.id)));
}
function bestForFact(model) {
  const company = companyFor(model);
  const entry = company?.profile?.find(item => /^best\s+for/i.test(item.label || ''));
  return entry || model.bestFor;
}
function bestFor(model, expanded = false) {
  const item = bestForFact(model);
  if (item) return expanded ? content(item, '', true) : `<div class="cmp-preview-text"><span class="cmp-best-summary">${esc(item.text ?? item.value)}</span>${infoButton(model, 'bestFor', item, 'Best for')}</div>`;
  return model.baseline ? '<span class="cmp-muted">Reference baseline</span>' : '<span class="cmp-muted">See company profile</span>';
}
function infoButton(model, key, item, label, formatter) {
  const id = `${model.id}:${key}`;
  infoEntries.set(id, { model, item: fact(item), label, formatter });
  return `<button type="button" class="cmp-info-button" data-metric-info="${esc(id)}" aria-label="Evidence for ${esc(label)}: ${esc(model.name)}" aria-controls="table-info-popover" aria-expanded="false"><span aria-hidden="true">i</span></button>`;
}
function previewMetric(model, key, label, formatter) {
  return `<div class="cmp-preview-value"><strong>${esc(displayValue(model.metrics?.[key], formatter))}</strong>${infoButton(model, key, model.metrics?.[key], label, formatter)}</div>`;
}
function gapCell(model) {
  if (model.baseline) return '<span class="cmp-baseline-tag">Reference baseline</span>';
  const metrics = model.metrics || {};
  return `<div class="cmp-gap-line"><span>vs. Sol max</span>${metric(metrics.gapSol, points)}</div><div class="cmp-gap-line"><span>vs. Opus max</span>${metric(metrics.gapOpus, points)}</div>`;
}
function intelligenceCell(model) {
  return metric(model.metrics?.ii, intelligence);
}
function confidenceCell(model) {
  const low = model.metrics?.ciLow;
  const high = model.metrics?.ciHigh;
  if (!low || !high || valueFor(model, 'ciLow') == null || valueFor(model, 'ciHigh') == null) return '';
  return `<div class="cmp-ci"><span>95% confidence interval</span>${metric(low, value => number(value, 0))}${metric(high, value => number(value, 0))}</div>`;
}
function effortLabel(model) {
  return model.metrics?.effort ? `<small class="cmp-role">Tested effort: ${esc(displayValue(model.metrics.effort))}</small>` : '';
}
function tableColumns(expanded = false) {
  const common = [
    { key: 'company', label: 'Company', direction: 1, render: model => `<strong>${esc(model.company || companyFor(model)?.name || '')}</strong>${model.baseline ? '<span class="cmp-baseline-tag">Baseline</span>' : ''}` },
    { key: 'name', label: 'Model / effort', direction: 1, render: model => `<strong>${esc(model.name)}</strong>${effortLabel(model)}` }
  ];
  if (!expanded) return mode === 'llm' ? [...common,
    { key: 'tb4', label: 'Coding TB4 ↑', direction: -1, render: model => previewMetric(model, 'tb4', 'Terminal-Bench 4.0 solved', percent) },
    { key: 'ii', label: 'Intelligence ↑', direction: -1, render: model => previewMetric(model, 'ii', 'Intelligence Index', intelligence) },
    { key: 'input', label: 'Input $/M ↓', direction: 1, render: model => previewMetric(model, 'input', 'Input $/M', money) },
    { key: 'output', label: 'Output $/M ↓', direction: 1, render: model => previewMetric(model, 'output', 'Output $/M', money) },
    { key: 'bestFor', label: 'Best for', render: model => bestFor(model) }
  ] : [...common,
    { key: 'elo', label: 'Video score ↑', direction: -1, render: model => previewMetric(model, 'elo', 'Video arena score', value => number(value, 0)) },
    { key: 'rank', label: 'Arena rank ↓', direction: 1, render: model => previewMetric(model, 'rank', 'Arena rank', value => `#${number(value, 0)}`) },
    { key: 'priceSecond', label: 'Price $/second ↓', direction: 1, render: model => previewMetric(model, 'priceSecond', 'Price per second', money) },
    { key: 'bestFor', label: 'Best for', render: model => bestFor(model) }
  ];
  const identity = { key: 'name', label: 'Company / model', direction: 1, render: model => `<div class="cmp-full-identity"><span>${esc(model.company || companyFor(model)?.name || '')}</span><strong>${esc(model.name)}</strong>${effortLabel(model)}${model.baseline ? '<span class="cmp-baseline-tag">Reference baseline</span>' : `<small class="cmp-role">${esc(model.role || '')}</small>`}</div>` };
  return mode === 'llm' ? [identity,
    { key: 'ii', label: 'Intelligence ↑', direction: -1, render: intelligenceCell },
    { key: 'rank', label: 'Global rank ↓', direction: 1, render: model => metric(model.metrics?.rank, value => `#${number(value, 0)}`) },
    { key: 'tb4', label: 'Coding TB4 ↑', direction: -1, render: model => metric(model.metrics?.tb4, percent) },
    { key: 'speed', label: 'Speed tok/s ↑', direction: -1, render: model => metric(model.metrics?.speed, value => number(value)) },
    { key: 'latency', label: 'Answer delay ↓', direction: 1, render: model => metric(model.metrics?.latency, value => `${number(value)}s`) },
    { key: 'lcr', label: 'Long context LCR ↑', direction: -1, render: model => metric(model.metrics?.lcr, percent) },
    { key: 'codingCost', label: 'Coding $/attempt ↓', direction: 1, render: model => metric(model.metrics?.codingCost, money) },
    { key: 'gap', label: 'Gap to baselines', render: gapCell },
    { key: 'input', label: 'Input $/M ↓', direction: 1, render: model => metric(model.metrics?.input, money) },
    { key: 'output', label: 'Output $/M ↓', direction: 1, render: model => metric(model.metrics?.output, money) },
    { key: 'cache', label: 'Cache $/M ↓', direction: 1, render: model => metric(model.metrics?.cache, money) },
    { key: 'bestFor', label: 'Best for', render: model => bestFor(model, true) }
  ] : [identity,
    { key: 'elo', label: 'Video arena score ↑', direction: -1, render: model => metric(model.metrics?.elo, value => number(value, 0)) + confidenceCell(model) },
    { key: 'rank', label: 'Arena rank ↓', direction: 1, render: model => metric(model.metrics?.rank, value => `#${number(value, 0)}`) },
    { key: 'priceSecond', label: 'Price $/second ↓', direction: 1, render: model => metric(model.metrics?.priceSecond, money) },
    { key: 'priceMinute', label: 'Price $/minute ↓', direction: 1, render: model => metric(model.metrics?.priceMinute, money) },
    { key: 'bestFor', label: 'Best for', render: model => bestFor(model, true) }
  ];
}
function renderComparison() {
  closeInfo();
  infoEntries = new Map();
  const compare = (a, b) => {
    const av = valueFor(a, sort.key), bv = valueFor(b, sort.key);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.direction;
  };
  renderTable($('#company-table'), chooseRows().sort(compare), false);
  renderTable($('#expanded-company-table'), chooseRows(true).sort(compare), true);
  const heading = $('#comparison-dialog-title');
  if (heading) heading.textContent = mode === 'llm' ? 'Full LLM comparison' : 'Full video comparison';
  document.querySelectorAll('#dialog-mode-toggle [data-mode]').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderTable(target, rows, expanded) {
  if (!target) return;
  const columns = tableColumns(expanded);
  const best = new Map(columns.filter(column => ['ii', 'tb4', 'speed', 'latency', 'lcr', 'codingCost', 'input', 'output', 'cache', 'elo', 'priceSecond', 'priceMinute'].includes(column.key)).map(column => {
    const values = rows.map(model => valueFor(model, column.key)).filter(value => typeof value === 'number');
    return [column.key, values.length ? Math[column.direction === 1 ? 'min' : 'max'](...values) : null];
  }));
  const caption = target.querySelector('caption') || target.createCaption();
  caption.textContent = mode === 'llm' ? `${expanded ? 'All LLMs + effort variants' : 'Flagships + primary coding choices'} · USD / million tokens · Dates in evidence` : `Video arena + baselines · ${dateText(data.snapshot_date)} · USD / second`;
  if (expanded) caption.textContent += ' · Sources, dates and pricing conditions included';
  const head = target.tHead || target.createTHead();
  head.innerHTML = `<tr>${columns.map(column => `<th scope="col"${column.direction ? ` aria-sort="${column.key === sort.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}"` : ''}>${column.direction ? `<button type="button" data-company-sort="${esc(column.key)}">${esc(column.label)}<span class="sort-indicator" aria-hidden="true">${column.key === sort.key ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span></button>` : esc(column.label)}</th>`).join('')}</tr>`;
  const body = target.tBodies[0] || target.createTBody();
  body.innerHTML = rows.map(model => `<tr class="${model.baseline ? 'cmp-baseline-row' : ''}">${columns.map(column => `<td${best.has(column.key) && valueFor(model, column.key) != null && valueFor(model, column.key) === best.get(column.key) ? ' class="best"' : ''}>${column.render(model)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length}">No sourced models found for this category.</td></tr>`;
}
function cardMetric(label, item, formatter) {
  return `<div><dt>${esc(label)}</dt><dd>${metric(item, formatter)}</dd></div>`;
}
const detailMetrics = [
  ['ii', 'Intelligence Index', intelligence], ['rank', 'Current leaderboard rank'], ['input', 'API input, $/M', money], ['output', 'API output, $/M', money], ['cache', 'Cached input, $/M', money], ['blended', 'Blended API price, $/M', money],
  ['tb4', 'Terminal-Bench 4.0', percent], ['sciCode', 'SciCode (under review)', percent], ['agent', 'AutomationBench (SaaS workflows)', percent], ['context', 'Context tokens', value => number(value, 0)], ['weights', 'Weight availability'], ['modalities', 'Input / output modalities'],
  ['speed', 'Output speed, tok/s', value => number(value)], ['latency', 'Time to first answer', value => `${number(value)}s`], ['lcr', 'Long-context recall', percent], ['codingCost', 'TB4 API cost per attempt', money],
  ['gapSol', 'II gap vs. Sol max', points], ['gapOpus', 'II gap vs. Opus max', points], ['outputRatioSol', 'Output-price ratio to Sol', value => `${number(value, 4)}×`], ['outputRatioOpus', 'Output-price ratio to Opus', value => `${number(value, 4)}×`],
  ['elo', 'Video arena score', value => number(value, 0)], ['ciLow', '95% interval lower bound', value => number(value, 0)], ['ciHigh', '95% interval upper bound', value => number(value, 0)], ['priceMinute', 'Price per minute', money], ['priceSecond', 'Price per second', money], ['modes', 'Generation modes'], ['resolution', 'Maximum resolution'], ['duration', 'Maximum duration']
];
function renderModelDetails() {
  const rows = data.models;
  write('#model-details', rows.map(model => {
    const shown = detailMetrics.filter(([key]) => model.metrics?.[key]);
    const extras = Object.entries(model.metrics || {}).filter(([key]) => key !== 'lcr_percent' && !detailMetrics.some(([known]) => known === key));
    const fields = shown.map(([key, label, formatter]) => cardMetric(label, model.metrics[key], formatter)).join('') + extras.map(([key, value]) => cardMetric(key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()), value)).join('');
    return `<details class="accordion cmp-model-detail" id="model-${esc(model.id)}" data-model-kind="${esc(model.kind)}"${model.kind !== mode ? ' hidden' : ''}><summary>${esc(model.name)}<span class="summary-meta">${esc(model.baseline ? 'Reference baseline' : model.role || 'Model details')}</span></summary><div class="detail-body"><dl class="cmp-detail-metrics">${fields}</dl>${(model.notes || []).map(item => content(item, item.title || '')).join('')}</div></details>`;
  }).join(''));
}
function renderOverview() {
  write('#overview-text', content(data.report.conclusion));
  write('#method-notes', (data.methods || []).map(item => content(item, item.title || '')).join(''));
  write('#scenario-guide', (data.scenarios || []).map(item => {
    const models = (item.model_labels || []).map(esc).join(' / ');
    const heading = `<h4>${esc(item.title || '')}${models ? ` – <span class="cmp-scenario-model">${models}</span>` : ''}</h4>`;
    const codingOptions = item.title === 'Coding' ? `<details class="cmp-coding-options"><summary>Other coding choices</summary>${data.report.final_recommendations.filter((_, index) => [0, 3, 4, 5].includes(index)).map(choice => {
      const separator = choice.text.indexOf(':');
      return content({ ...choice, text: separator > 0 ? choice.text.slice(separator + 1).trim() : choice.text }, separator > 0 ? choice.text.slice(0, separator) : 'Other Chinese options', false, false);
    }).join('')}</details>` : '';
    return `<article class="recommendation-card cmp-scenario">${heading}${content(item, '', false, false)}${codingOptions}</article>`;
  }).join(''));
  $('#scenario-guide')?.classList.add('recommendation-grid');
  write('#source-list', (data.sources || []).map(source => `<div class="source-item">${sourceLink(source, `${source.title} ↗`)}<time datetime="${esc(source.date || data.snapshot_date)}">${dateText(source.date || data.snapshot_date)}</time></div>`).join(''));
  const date = $('#last-updated');
  if (date) { date.textContent = dateText(data.snapshot_date); date.dateTime = data.snapshot_date; }
  const footerDate = $('#footer-date');
  if (footerDate) footerDate.textContent = `Last updated ${dateText(data.snapshot_date)} · Prices in USD before tax. Each fact retains its source date.`;
}
function setMode(nextMode) {
  mode = nextMode === 'video' ? 'video' : 'llm';
  sort = { key: mode === 'llm' ? 'tb4' : 'elo', direction: -1 };
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
  const fullScroll = $('#comparison-dialog .cmp-dialog-scroll');
  if (fullScroll) { fullScroll.scrollTop = 0; fullScroll.scrollLeft = 0; }
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
function closeInfo() {
  const panel = $('#table-info-popover');
  if (panel?.matches(':popover-open')) panel.hidePopover();
  if (infoTrigger) infoTrigger.setAttribute('aria-expanded', 'false');
  infoTrigger = null;
}
function showInfo(button) {
  const entry = infoEntries.get(button.dataset.metricInfo);
  const panel = $('#table-info-popover');
  if (!entry || !panel) return;
  if (infoTrigger === button && panel.matches(':popover-open')) { closeInfo(); return; }
  closeInfo();
  panel.innerHTML = `<div class="cmp-info-heading"><h4>${esc(entry.label)}</h4><button type="button" class="cmp-info-close" data-close-info aria-label="Close evidence">×</button></div><p class="cmp-info-model">${esc(entry.model.name)}</p>${entry.item.text != null ? content(entry.item) : metric(entry.item, entry.formatter, false)}`;
  infoTrigger = button;
  button.setAttribute('aria-expanded', 'true');
  panel.showPopover();
  const anchor = button.getBoundingClientRect();
  const margin = 12;
  const size = panel.getBoundingClientRect();
  const left = Math.max(margin, Math.min(anchor.left - 12, window.innerWidth - size.width - margin));
  const below = anchor.bottom + 8;
  const top = below + size.height <= window.innerHeight - margin ? below : Math.max(margin, anchor.top - size.height - 8);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.querySelector('[data-close-info]')?.focus({ preventScroll: true });
}
function initComparisonDialog() {
  const dialog = $('#comparison-dialog');
  const expand = $('#expand-comparison');
  if (!dialog || !expand) return;
  initTableDialog({ dialog, trigger: expand, close: $('#close-comparison'), onOpen: closeInfo, onClose: closeInfo });
  $('#table-info-popover')?.addEventListener('toggle', event => {
    if (event.newState === 'closed') {
      infoTrigger?.setAttribute('aria-expanded', 'false');
      infoTrigger = null;
    }
  });
  window.addEventListener('resize', closeInfo);
  document.addEventListener('scroll', event => {
    if (!$('#table-info-popover')?.contains(event.target)) closeInfo();
  }, true);
}
function initNavigation() {
  const aliases = { overview: 'conclusion', recommendation: 'scenarios', profiles: 'comparison', limits: 'comparison', takeaways: 'conclusion' };
  const revealModel = detail => {
    if (!detail) return;
    detail.open = true;
    let parent = detail.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  };
  const resolveHash = () => {
    const legacyTarget = aliases[location.hash.slice(1)];
    if (legacyTarget) {
      history.replaceState(null, '', `#${legacyTarget}`);
      requestAnimationFrame(() => document.getElementById(legacyTarget)?.scrollIntoView());
      return;
    }
    if (!location.hash.startsWith('#model-')) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) requestAnimationFrame(() => target.scrollIntoView());
      return;
    }
    const model = modelFor(decodeURIComponent(location.hash.slice(7)));
    if (!model) return;
    if (model.kind !== mode) setMode(model.kind);
    const detail = document.getElementById(`model-${model.id}`);
    if (detail) { revealModel(detail); requestAnimationFrame(() => detail.scrollIntoView()); }
  };
  document.addEventListener('click', event => {
    const toggle = event.target.closest('#mode-toggle [data-mode], #dialog-mode-toggle [data-mode]');
    if (toggle) setMode(toggle.dataset.mode);
    const sorter = event.target.closest('[data-company-sort]');
    if (sorter) {
      const key = sorter.dataset.companySort;
      const table = sorter.closest('table');
      const expanded = table?.id === 'expanded-company-table';
      sort = { key, direction: sort.key === key ? -sort.direction : tableColumns(expanded).find(column => column.key === key)?.direction || 1 };
      renderComparison();
      table?.querySelector(`[data-company-sort="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
    }
    const info = event.target.closest('[data-metric-info]');
    if (info) showInfo(info);
    const close = event.target.closest('[data-close-info]');
    if (close) { const trigger = infoTrigger; closeInfo(); trigger?.focus({ preventScroll: true }); }
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
  window.addEventListener('hashchange', resolveHash);
  resolveHash();
}
async function start() {
  initTheme();
  try {
    const [response, reportResponse, codingResponse] = await Promise.all([fetch('./companies.json'), fetch('./data.json'), fetch('./coding.json')]);
    if (!response.ok) throw new Error(`Company dataset returned ${response.status}`);
    if (!reportResponse.ok) throw new Error(`Chart settings returned ${reportResponse.status}`);
    if (!codingResponse.ok) throw new Error(`Coding comparison returned ${codingResponse.status}`);
    const companyData = await response.json();
    const reportData = await reportResponse.json();
    const codingData = await codingResponse.json();
    data = createUnifiedData(companyData, reportData);
    const sourceKeys = new Set(data.sources.map(source => source.url.replace(/\/$/, '').split('#')[0]));
    for (const source of codingData.sources) {
      const key = source.url.replace(/\/$/, '').split('#')[0];
      if (!sourceKeys.has(key)) { data.sources.push({ ...source, id: `coding:${source.id}` }); sourceKeys.add(key); }
    }
    sourceMap = new Map((data.sources || []).map(source => [source.id, source]));
    renderOverview(); setMode('llm');
    renderCodingSections(data.report);
    renderCompanyCharts(data);
    renderCodingComparison(codingData);
    renderWorkflow(reportData.multi_model_workflow);
    const updatedDate = [data.snapshot_date, codingData.metadata.updated_date, reportData.multi_model_workflow?.updated_date].filter(Boolean).sort().at(-1);
    $('#last-updated').textContent = dateText(updatedDate);
    $('#last-updated').dateTime = updatedDate;
    $('#footer-date').textContent = `Last updated ${dateText(updatedDate)} · Prices in USD before tax. Each fact retains its source date.`;
    initComparisonDialog();
    initNavigation();
    document.documentElement.dataset.ready = 'true';
  } catch (error) {
    write('#overview-text', '<p>The report could not load. Refresh the page or download <a href="./data.json">coding data</a> and <a href="./companies.json">model data</a>.</p>');
    console.error('Model Compare initialization failed:', error);
  }
}
start();
