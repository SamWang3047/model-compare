import { initTableDialog } from './table-dialog.js';

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
  return `<div class="cmp-fact"><strong class="cmp-fact-value${metric.value == null ? ' coding-missing' : ''}">${display(metric, formatter)}</strong><span class="coding-unit">${esc(metric.unit)}</span><span class="status-dot status-${esc(metric.label)}" role="img" title="${esc(labels[metric.label] || metric.label)}" aria-label="${esc(labels[metric.label] || metric.label)}"></span><div class="provenance cmp-provenance">${metric.snapshot_date ? `<span>Snapshot ${dateText(metric.snapshot_date)}</span>` : ''}<span>Retrieved ${dateText(metric.retrieved_date)}</span>${sourceLink(metric.source_url)}</div>${numeric(metric) || (metric.value && typeof metric.value === 'object') ? `<small class="coding-precision">Source precision: ${esc(typeof metric.value === 'object' ? JSON.stringify(metric.value) : metric.value)} ${esc(metric.unit)}</small>` : ''}${metric.note ? `<span class="cmp-metric-note">${esc(metric.note)}</span>` : ''}</div>`;
}
function statement(item) {
  const sources = [...new Set([item.source_url, ...(item.source_urls || [])].filter(Boolean))];
  return `<p>${esc(item.value)}</p><div class="provenance cmp-provenance"><span>${item.classification === 'analyst_inference' ? 'Analyst inference · ' : ''}Retrieved ${dateText(item.retrieved_date)}</span>${sources.map((url, index) => sourceLink(url, sources.length > 1 ? `Source ${index + 1} ↗` : 'Source ↗')).join('')}</div>`;
}
export function renderCodingComparison(data, report) {
  const root = document.getElementById('coding-comparison');
  if (!root) return;
  let sort = { key: 'arena_score', direction: -1 };
  let currentInfo;
  const popover = document.getElementById('coding-info-popover');
  const getModel = id => data.models.find(model => model.id === id);
  const info = (model, key, label) => `<span class="status-dot status-${esc(model.metrics[key]?.label || 'not_found')}" role="img" title="${esc(labels[model.metrics[key]?.label] || 'Not found')}" aria-label="${esc(labels[model.metrics[key]?.label] || 'Not found')}"></span>`;
  const closeInfo = () => {
    if (popover.matches(':popover-open')) popover.hidePopover();
    currentInfo?.setAttribute('aria-expanded', 'false');
    currentInfo = null;
  };
  const columns = expanded => [
    { key: 'name', label: 'Model', direction: 1, render: model => `<strong>${esc(model.name)}</strong>` },
    ...[...metricDefinitions, ...(expanded ? extraDefinitions : [])].map(([key, label, format, direction]) => ({ key, label, direction, render: model => expanded ? evidence(model.metrics[key], format) + (key === 'terminal_bench' && model.vendor_tb4 ? `<div class="coding-vendor-result">${evidence(model.vendor_tb4, value => `${decimal(value)}%`)}</div>` : '') : `<div class="cmp-preview-value"><strong${model.metrics[key]?.value == null ? ' class="coding-missing"' : ''}>${display(model.metrics[key], format)}</strong>${info(model, key, label)}</div>` })),
    { key: 'notes', label: 'Notes', render: model => expanded ? model.notes.map(statement).join('') : `<div class="cmp-preview-text"><span class="cmp-best-summary">${esc(model.short_note)}</span>${info(model, 'notes', 'Notes')}</div>` }
  ].filter(column => expanded || !['output_tokens', 'notes'].includes(column.key));
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
    target.querySelector('caption').textContent = expanded ? 'Coding evidence · Source labels, dates, raw values and scope included' : 'WebDev, terminal and intelligence scores use different scales.';
    target.querySelector('thead').innerHTML = `<tr>${fields.map(field => `<th scope="col"${field.direction ? ` aria-sort="${sort.key === field.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}"` : ''}>${field.direction ? `<button type="button" data-coding-sort="${field.key}">${field.label}<span class="sort-indicator" aria-hidden="true">${sort.key === field.key ? (sort.direction === 1 ? '↑' : '↓') : '↕'}</span></button>` : field.label}</th>`).join('')}</tr>`;
    target.querySelector('tbody').innerHTML = rows.map(model => `<tr class="${model.baseline ? 'cmp-baseline-row' : ''}">${fields.map(field => `<td>${field.render(model)}</td>`).join('')}</tr>`).join('');
  };
  renderTable(false); renderTable(true);
  const agentNumber = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
  const dot = '<span class="status-dot status-verified" role="img" title="Verified" aria-label="Verified"></span>';
  const agentRows = report.repository_agents.map(pair => `<tr><td>${esc(pair.model)} · ${esc(pair.harness)}</td><td>${agentNumber(pair.deepswe_percent)}%${dot}</td><td>$${agentNumber(pair.api_usd_per_task)}${dot}</td><td>${agentNumber(pair.minutes_per_task)}${dot}</td></tr>`).join('');
  document.getElementById('coding-agent-references').innerHTML = `<p>DeepSWE scores cover repository tasks; costs and times average across three coding-agent suites.</p><div class="table-scroll"><table><caption>Repository coding · DeepSWE</caption><thead><tr><th scope="col">Agent + model</th><th scope="col">DeepSWE %</th><th scope="col">$/task</th><th scope="col">Minutes/task</th></tr></thead><tbody>${agentRows}</tbody></table></div>`;
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
  root.dataset.ready = 'true';
}
