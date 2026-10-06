import { initTableDialog } from './table-dialog.js';
import { renderCodingCharts } from './coding-charts.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const decimal = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateText = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not disclosed';
const labels = { verified: 'Verified', vendor_reported: 'Vendor-reported', third_party: 'Third-party', calculated: 'Calculated', not_found: 'Not found' };
const numeric = metric => typeof metric?.value === 'number' && Number.isFinite(metric.value);
const metricDefinitions = [
  ['arena_score', 'Arena WebDev score', value => decimal(value), -1],
  ['arena_price', 'Arena price, $/M', value => `$${decimal(value)}`, 1],
  ['terminal_bench', 'Terminal-Bench 4.0', value => `${decimal(value)}%`, -1],
  ['intelligence', 'Intelligence Index', value => decimal(value), -1],
  ['output_tokens', 'II output tokens', value => `${decimal(value / 1e6)}M`, 1]
];
const extraDefinitions = [
  ['api_input', 'API input, $/M', value => `$${decimal(value)}`, 1],
  ['api_output', 'API output, $/M', value => `$${decimal(value)}`, 1],
  ['speed', 'Output tok/s', decimal, -1],
  ['context', 'Context tokens', value => `${decimal(value / 1e6)}M`, -1],
  ['index_total_cost', 'Entire II suite, $', value => `$${decimal(value)}`, 1],
  ['index_cost_per_task', 'II weighted $/task', value => `$${decimal(value)}`, 1]
];
function sourceLink(url, label = 'Source ↗') {
  if (!/^https:\/\//.test(url || '')) return '';
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}
function display(metric, formatter = value => esc(value)) {
  if (metric?.value == null) return 'Not found';
  if (numeric(metric)) return formatter(metric.value);
  if (typeof metric.value === 'object') return Object.entries(metric.value).map(([key, value]) => `${esc(key.replaceAll('_', ' '))}: ${typeof value === 'number' ? decimal(value) : esc(value)}`).join(' · ');
  return esc(metric.value);
}
function evidence(metric, formatter = decimal) {
  if (!metric) return '<span class="coding-missing">Not found</span>';
  return `<div class="cmp-fact"><strong class="cmp-fact-value${metric.value == null ? ' coding-missing' : ''}">${display(metric, formatter)}</strong><span class="coding-unit">${esc(metric.unit)}</span><span class="content-label cmp-label ${metric.label === 'not_found' ? 'inference' : metric.label === 'calculated' ? 'calculated' : ''}">${esc(labels[metric.label] || metric.label)}</span><div class="provenance cmp-provenance">${metric.snapshot_date ? `<span>Snapshot ${dateText(metric.snapshot_date)}</span>` : ''}<span>Retrieved ${dateText(metric.retrieved_date)}</span>${sourceLink(metric.source_url)}</div>${numeric(metric) || (metric.value && typeof metric.value === 'object') ? `<small class="coding-precision">Source precision: ${esc(typeof metric.value === 'object' ? JSON.stringify(metric.value) : metric.value)} ${esc(metric.unit)}</small>` : ''}${metric.note ? `<span class="cmp-metric-note">${esc(metric.note)}</span>` : ''}</div>`;
}
function statement(item) {
  const sources = [...new Set([item.source_url, ...(item.source_urls || [])].filter(Boolean))];
  return `<p>${esc(item.value)}</p><div class="provenance cmp-provenance"><span>${item.classification === 'analyst_inference' ? 'Analyst inference · ' : ''}Retrieved ${dateText(item.retrieved_date)}</span>${sources.map((url, index) => sourceLink(url, sources.length > 1 ? `Source ${index + 1} ↗` : 'Source ↗')).join('')}</div>`;
}
export function renderCodingComparison(data) {
  const root = document.getElementById('coding-comparison');
  if (!root) return;
  let sort = { key: 'arena_score', direction: -1 };
  let currentInfo;
  const popover = document.getElementById('coding-info-popover');
  const getModel = id => data.models.find(model => model.id === id);
  const info = (model, key, label) => `<button type="button" class="cmp-info-button" data-coding-info="${esc(model.id)}:${esc(key)}" aria-label="Evidence for ${esc(label)}: ${esc(model.name)}" aria-controls="coding-info-popover" aria-expanded="false"><span aria-hidden="true">i</span></button>`;
  const closeInfo = () => {
    if (popover.matches(':popover-open')) popover.hidePopover();
    currentInfo?.setAttribute('aria-expanded', 'false');
    currentInfo = null;
  };
  const columns = expanded => [
    { key: 'name', label: 'Model', direction: 1, render: model => `<strong>${esc(model.name)}</strong>${model.baseline ? '<span class="cmp-baseline-tag">Baseline</span>' : ''}` },
    ...[...metricDefinitions, ...(expanded ? extraDefinitions : [])].map(([key, label, format, direction]) => ({ key, label, direction, render: model => expanded ? evidence(model.metrics[key], format) + (key === 'terminal_bench' && model.vendor_tb4 ? `<div class="coding-vendor-result">${evidence(model.vendor_tb4, value => `${decimal(value)}%`)}</div>` : '') : `<div class="cmp-preview-value"><strong${model.metrics[key]?.value == null ? ' class="coding-missing"' : ''}>${display(model.metrics[key], format)}</strong>${info(model, key, label)}</div>` })),
    { key: 'notes', label: 'Notes', render: model => expanded ? model.notes.map(statement).join('') : `<div class="cmp-preview-text"><span class="cmp-best-summary">${esc(model.short_note)}</span>${info(model, 'notes', 'Notes')}</div>` }
  ];
  const renderTable = expanded => {
    const target = document.getElementById(expanded ? 'coding-full-table' : 'coding-table');
    const fields = columns(expanded);
    const rows = [...data.models].sort((a, b) => {
      const av = sort.key === 'name' ? a.name : a.metrics[sort.key]?.value;
      const bv = sort.key === 'name' ? b.name : b.metrics[sort.key]?.value;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.direction;
    });
    target.querySelector('caption').textContent = expanded ? 'Coding evidence · Source labels, dates, raw values and scope included' : data.metadata.table_caption;
    target.querySelector('thead').innerHTML = `<tr>${fields.map(field => `<th scope="col"${field.direction ? ` aria-sort="${sort.key === field.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}"` : ''}>${field.direction ? `<button type="button" data-coding-sort="${field.key}">${field.label}<span class="sort-indicator" aria-hidden="true">${sort.key === field.key ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span></button>` : field.label}</th>`).join('')}</tr>`;
    target.querySelector('tbody').innerHTML = rows.map(model => `<tr class="${model.baseline ? 'cmp-baseline-row' : ''}">${fields.map(field => `<td>${field.render(model)}</td>`).join('')}</tr>`).join('');
  };
  renderTable(false); renderTable(true);
  document.getElementById('coding-lead').textContent = data.lead.value;
  document.getElementById('coding-lead-evidence').innerHTML = `<span>Analyst inference · Retrieved ${dateText(data.lead.retrieved_date)}</span>${sourceLink(data.lead.source_url)}`;
  document.getElementById('coding-table-note').textContent = data.metadata.display_note;
  const predecessor = data.agent_pairs.find(pair => pair.id === 'sol_predecessor');
  const flagship = data.agent_pairs.find(pair => pair.id === 'glm_flagship');
  document.getElementById('coding-task-callout').innerHTML = `<h3>Cheap tokens are not always cheap tasks</h3><p>Codex + GPT-6 Sol (${decimal(predecessor.metrics.score.value)}; $${decimal(predecessor.metrics.cost_per_task.value)}/task) beat OpenCode + GLM-5.3 (${decimal(flagship.metrics.score.value)}; $${decimal(flagship.metrics.cost_per_task.value)}/task) on both score and cost in this agent evaluation.</p>${statement(data.task_callout)}<div class="coding-agent-evidence"><details><summary>Inspect the two agent results</summary>${[predecessor, flagship].map(pair => `<div><h4>${esc(pair.name)}</h4>${evidence(pair.metrics.score)}${evidence(pair.metrics.cost_per_task, value => `$${decimal(value)}`)}</div>`).join('')}</details></div>`;
  document.getElementById('coding-jobs').innerHTML = data.jobs.map(job => `<article class="recommendation-card"><h4>${esc(job.title)}</h4>${statement(job)}</article>`).join('');
  const agentRows = data.agent_pairs.map(pair => `<tr><td><strong>${esc(pair.name)}</strong><span class="cmp-role">${pair.reference_only ? 'Reference only' : 'Current baseline pair'}</span></td><td>${evidence(pair.metrics.score)}</td><td>${evidence(pair.metrics.cost_per_task, value => `$${decimal(value)}`)}</td><td>${esc(pair.note)}</td></tr>`).join('');
  document.getElementById('coding-agent-references').innerHTML = `<p>${esc(data.metadata.agent_note)}</p><div class="table-scroll"><table><caption>Coding Agent Index v1.5 · agent + model configurations</caption><thead><tr><th scope="col">Agent + model</th><th scope="col">Index score</th><th scope="col">$/task</th><th scope="col">Scope</th></tr></thead><tbody>${agentRows}</tbody></table></div><div class="coding-terminal-reference"><h4>${esc(data.terminal_reference.name)}</h4>${evidence(data.terminal_reference.metric, value => `${decimal(value)}%`)}</div>`;
  document.getElementById('coding-plan-checks').innerHTML = data.plans.map(plan => `<article class="coding-plan"><h4>${esc(plan.name)}</h4>${plan.provider_type === 'third_party' ? '<p class="coding-plan-type">Third-party coding plan · checked on its official page</p>' : ''}${evidence(plan.price, value => `$${decimal(value)}/month`)}${plan.facts.map(item => evidence(item, value => esc(value))).join('')}</article>`).join('');
  const missing = [];
  data.models.forEach(model => Object.entries(model.metrics).forEach(([key, metric]) => {
    if (metric.label === 'not_found') missing.push({ title: `${model.name}: ${[...metricDefinitions, ...extraDefinitions].find(([id]) => id === key)?.[1] || key}`, metric });
  }));
  data.unverified_claims.forEach(item => missing.push({ title: item.title, metric: item.metric }));
  data.plans.forEach(plan => [plan.price, ...plan.facts].forEach(metric => { if (metric.label === 'not_found') missing.push({ title: `${plan.name}: ${metric.unit}`, metric }); }));
  document.getElementById('coding-data-gaps').innerHTML = `<h4>Not found in the checked sources</h4><ul class="coding-gap-list">${missing.map(item => `<li><strong>${esc(item.title)}</strong>${evidence(item.metric, value => esc(value))}</li>`).join('')}</ul><h4>Keep these results separate</h4>${data.caveats.map(statement).join('')}<h4>Name and configuration checks</h4>${data.name_checks.map(statement).join('')}`;
  initTableDialog({ dialog: document.getElementById('coding-dialog'), trigger: document.getElementById('expand-coding'), close: document.getElementById('close-coding'), onOpen: closeInfo, onClose: closeInfo });
  document.addEventListener('click', event => {
    const sorter = event.target.closest('[data-coding-sort]');
    if (sorter) {
      closeInfo();
      const key = sorter.dataset.codingSort;
      const target = sorter.closest('table');
      sort = { key, direction: sort.key === key ? -sort.direction : columns(target.id === 'coding-full-table').find(field => field.key === key).direction };
      renderTable(false); renderTable(true);
      target.querySelector(`[data-coding-sort="${key}"]`)?.focus({ preventScroll: true });
    }
    const button = event.target.closest('[data-coding-info]');
    if (button) {
      if (currentInfo === button && popover.matches(':popover-open')) { closeInfo(); return; }
      closeInfo();
      const [id, key] = button.dataset.codingInfo.split(':');
      const model = getModel(id);
      const definition = [...metricDefinitions, ...extraDefinitions].find(([field]) => field === key);
      popover.innerHTML = `<div class="cmp-info-heading"><h4>${esc(definition?.[1] || 'Notes')}</h4><button type="button" class="cmp-info-close" data-coding-close-info aria-label="Close coding evidence">×</button></div><p class="cmp-info-model">${esc(model.name)}</p>${key === 'notes' ? model.notes.map(statement).join('') : evidence(model.metrics[key], definition[2])}${key === 'terminal_bench' && model.vendor_tb4 ? `<div class="coding-vendor-result">${evidence(model.vendor_tb4, value => `${decimal(value)}%`)}</div>` : ''}`;
      currentInfo = button; button.setAttribute('aria-expanded', 'true'); popover.showPopover();
      const anchor = button.getBoundingClientRect(), size = popover.getBoundingClientRect();
      popover.style.left = `${Math.max(12, Math.min(anchor.left - 12, innerWidth - size.width - 12))}px`;
      popover.style.top = `${anchor.bottom + size.height + 20 < innerHeight ? anchor.bottom + 8 : Math.max(12, anchor.top - size.height - 8)}px`;
      popover.querySelector('[data-coding-close-info]').focus({ preventScroll: true });
    }
    if (event.target.closest('[data-coding-close-info]')) { const trigger = currentInfo; closeInfo(); trigger?.focus({ preventScroll: true }); }
  });
  popover.addEventListener('toggle', event => { if (event.newState === 'closed') { currentInfo?.setAttribute('aria-expanded', 'false'); currentInfo = null; } });
  window.addEventListener('resize', closeInfo);
  document.addEventListener('scroll', event => { if (!popover.contains(event.target)) closeInfo(); }, true);
  renderCodingCharts(data);
  root.dataset.ready = 'true';
}
