import { renderCharts } from './charts.js';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 0) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const dollars = value => `$${number(value, 2)}`;
const dateText = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const kindLabels = { verified: 'Verified fact', inference: 'Analyst inference', calculated: 'Calculated', missing: 'Evidence missing', illustrative: 'Illustrative assumption' };
let data, sourceMap;
let copyControlsInstalled = false;

function mount(id, markup) {
  const host = document.getElementById(id);
  if (host) host.innerHTML = markup;
  return host;
}
function link(url, label, className = '', title = '') {
  return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"${className ? ` class="${className}"` : ''}${title ? ` title="${escapeHTML(title)}"` : ''}>${escapeHTML(label)}</a>`;
}
function provenance(item, compact = false) {
  const refs = (item.source_ids || []).map(id => sourceMap.get(id)).filter(Boolean);
  return `<div class="provenance"><time datetime="${escapeHTML(item.date || data.snapshot_date)}">${dateText(item.date || data.snapshot_date)}</time>${refs.map((source, index) => link(source.url, compact ? (index === 0 ? 'Evidence ↗' : 'Source ↗') : source.title)).join('')}</div>`;
}
function badge(item) {
  return `<span class="content-label ${item.type === 'inference' || item.type === 'missing' ? 'inference' : item.type === 'calculated' ? 'calculated' : ''}">${kindLabels[item.type] || 'Report snapshot'}</span>`;
}
function content(item, heading = '') {
  return `<div class="content-item">${heading ? `<h4>${escapeHTML(heading)}</h4>` : ''}${badge(item)}<p>${escapeHTML(item.text)}</p>${provenance(item)}</div>`;
}
function table(columns, rows, caption = '') {
  return `<div class="table-scroll detail-table" role="region" aria-label="${escapeHTML(caption || 'Report data')}" tabindex="0"><table>${caption ? `<caption>${escapeHTML(caption)}</caption>` : ''}<thead><tr>${columns.map(col => `<th scope="col">${escapeHTML(col.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map((col, index) => `<td>${col.render ? col.render(row) : escapeHTML(row[col.key])}${index === 0 ? provenance(row, true) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function codeBlock(code, label, id) {
  return `<div class="code-block"><div class="code-toolbar"><span>${escapeHTML(label)}</span><button class="copy-button" data-copy="${id}" type="button" aria-label="Copy ${escapeHTML(label)}">Copy</button></div><pre><code id="${id}">${escapeHTML(code)}</code></pre></div>`;
}
function renderBenchmark() {
  mount('benchmark-method', `<strong>${escapeHTML(data.benchmark.title)} · ${escapeHTML(data.benchmark.harness)}</strong><p>${escapeHTML(data.benchmark_methodology)} ${escapeHTML(data.benchmark.lcrDefinition)} ${escapeHTML(data.benchmark.speedDefinition)}</p>${badge(data.benchmark)}${provenance(data.benchmark)}`);
  mount('comparison-interpretation', content(data.benchmark.interpretation));
}
function renderHarness() {
  const glm = data.harness.glm, ds = data.harness.deepseek;
  mount('harness-overview', `<article class="harness-card"><span class="small-label">GLM 5.3-FLASH</span><h3>ZCode or Claude Code</h3>${content(glm.official)}${content(glm.recommendation)}</article><article class="harness-card"><span class="small-label">DEEPSEEK V4.1 FLASH</span><h3>Native Standard Harness</h3>${content(ds.recommendation)}${content(ds.setup)}</article>`);
}
function renderSubscriptions() {
  const { zai, deepseek, go } = data.subscriptions;
  mount('billing-overview', `<article class="billing-card"><span class="small-label">GLM FLASH</span><h3>Subscription or API</h3>${content(zai.exhaustion)}${content(zai.rateLimits)}</article><article class="billing-card"><span class="small-label">DEEPSEEK FLASH</span><h3>Pay for what you use</h3>${content(deepseek.billing)}${content(deepseek.peakWindows)}</article>`);
  const a = data.workload_assumptions;
  mount('cost-details', `<div class="content-item"><span class="content-label inference">Illustrative assumptions</span><p>${number(a.days)} days / ${number(a.weekly_blocks)} weeks / ${number(a.workdays)} workdays. ${number(a.input_cache_hit_fraction * 100)}% of input is cached. ${escapeHTML(a.session_distribution)}. Output is ${escapeHTML(a.output)}. Excludes ${escapeHTML(a.excluded)}.</p>${provenance(a)}</div>` + table([
    { label: 'Scenario', render: row => escapeHTML(row.label === 'Heavy' ? 'Heavy / parallel agents' : row.label) },
    { label: 'Uncached / cached / output, M', render: row => `${number(row.uncached_input_millions)} / ${number(row.cached_input_millions)} / ${number(row.output_millions)}` },
    { label: 'GLM API', render: row => dollars(row.glm_api_usd) },
    { label: 'DeepSeek off-peak / peak', render: row => `${dollars(row.deepseek_offpeak_usd)} / ${dollars(row.deepseek_peak_usd)}` },
    { label: 'Z.ai off-peak / peak', render: row => `${row.glm_offpeak_plan} ${dollars(row.glm_offpeak_plan_usd)} / ${row.glm_peak_plan} ${dollars(row.glm_peak_plan_usd)}` },
    { label: 'Go, GLM only', render: row => `${row.go_glm_plan} ${dollars(row.go_glm_plan_usd)}` }
  ], data.monthly_costs, 'Calculated monthly costs · constant billed-token volumes · USD') + data.workload_notes.map(item => content(item)).join(''));
  mount('zai-plans', content(zai.billingNote) + table([
    { key: 'name', label: 'Individual plan' },
    { label: 'Monthly', render: row => dollars(row.monthly_usd) },
    { label: 'Quarterly upfront', render: row => dollars(row.quarterly_upfront_usd) },
    { label: 'Annual upfront', render: row => dollars(row.annual_upfront_usd) },
    { label: 'Credits / five hours', render: row => number(row.credits_per_five_hours) },
    { label: 'Credits / week', render: row => number(row.credits_per_week) }
  ], zai.individual, 'Current international individual plans') + table([
    { key: 'name', label: 'Team plan' },
    { label: 'Monthly / seat', render: row => dollars(row.monthly_usd_per_seat) },
    { label: 'Quarterly', render: () => 'Not published' },
    { label: 'Annual initial / renewal*', render: row => `${dollars(row.annual_initial_invoice_usd)} / ${dollars(row.annual_renewal_usd)}` },
    { label: 'Credits / five hours', render: row => number(row.credits_per_five_hours) },
    { label: 'Credits / week', render: row => number(row.credits_per_week) }
  ], zai.team, 'Team pricing per seat · annual charge is ambiguous, see note') + content(zai.annualConflict) + content(zai.supportedTools) + `<h4>How Flash credits are counted</h4>${codeBlock(zai.creditFormula.text, 'Flash credit formula', 'credit-formula-code')}${provenance(zai.creditFormula)}` + content(zai.offpeak));
  const deepseekCaveat = data.caveats.find(item => item.model_ids?.includes('deepseek'));
  mount('deepseek-billing', [deepseek.rateLimits, deepseekCaveat].filter(Boolean).map(item => content(item)).join(''));
  mount('go-plans', table([
    { key: 'name', label: 'Subscription' },
    { label: 'Monthly', render: row => dollars(row.monthly_usd) },
    { label: 'GLM allowance equivalent', render: row => dollars(row.glm_flash_allowance_usd_equivalent) },
    { label: 'DeepSeek allowance equivalent', render: row => dollars(row.deepseek_flash_allowance_usd_equivalent) }
  ], go.plans, 'Third-party OpenCode Go · shared normalized allowances') + content(go.limits) + content(go.compatibility));
  mount('subscription-caveats', content(zai.campaign, 'Temporary campaign'));
  // Evidence remains linked and dated without repeating the removed fact badges.
  for (const id of ['billing-overview', 'cost-details', 'zai-plans', 'deepseek-billing', 'go-plans', 'subscription-caveats']) {
    document.getElementById(id)?.querySelectorAll('.content-label').forEach(label => {
      if (label.textContent === kindLabels.verified) label.remove();
    });
  }
}
function initCopyControls() {
  if (copyControlsInstalled) return;
  copyControlsInstalled = true;
  document.addEventListener('click', async event => {
    const copy = event.target.closest('[data-copy]');
    if (!copy) return;
    const code = document.getElementById(copy.dataset.copy);
    if (!code) return;
    const status = $('#copy-status');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code.textContent);
      else {
        const input = document.createElement('textarea');
        input.value = code.textContent; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
        const copied = document.execCommand('copy'); input.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      copy.textContent = 'Copied';
      if (status) { status.textContent = 'Copied to clipboard'; status.classList.add('visible'); }
      setTimeout(() => { copy.textContent = 'Copy'; status?.classList.remove('visible'); }, 2000);
    } catch {
      copy.textContent = 'Select code to copy';
      if (status) { status.textContent = 'Clipboard access unavailable. Select the code and copy it manually.'; status.classList.add('visible'); }
      setTimeout(() => status?.classList.remove('visible'), 4000);
    }
  });
}

/** Render the unique coding-report details inside the shared comparison page.
 * Hosts are optional, so layout, navigation, model comparisons and source lists
 * remain the responsibility of the page orchestrator.
 */
export function renderCodingSections(reportData) {
  data = reportData;
  sourceMap = new Map(data.sources.map(source => [source.id, source]));
  renderBenchmark();
  renderHarness();
  renderSubscriptions();
  const cleanupCharts = renderCharts(data);
  initCopyControls();
  return cleanupCharts;
}
