import { renderCharts } from './charts.js';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 0) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const dollars = value => `$${number(value, 2)}`;
const tokenPrice = value => `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
const percent = value => `${number(value, 1)}%`;
const dateText = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const kindLabels = { verified: 'Verified fact', inference: 'Analyst inference', calculated: 'Calculated', missing: 'Evidence missing', illustrative: 'Illustrative assumption' };
let data, sourceMap;
let filter = 'all', sortKey = 'tb4_percent', sortDirection = -1;

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
function metric(model, field, formatter) {
  const source = sourceMap.get(model.metric_sources[field]);
  const label = formatter(model[field]);
  return link(source.url, label, 'metric-link', `${source.title} · ${dateText(model.date)} · exact value: ${model[field]}`);
}
const columns = [
  { key: 'model', label: 'Model / effort', direction: 1 },
  { key: 'input_usd_per_million', label: 'API input $/M', format: tokenPrice, direction: 1 },
  { key: 'output_usd_per_million', label: 'API output $/M', format: tokenPrice, direction: 1 },
  { key: 'cache_read_usd_per_million', label: 'Cache read $/M', format: tokenPrice, direction: 1 },
  { key: 'tb4_percent', label: 'Coding TB4 ↑', format: percent, direction: -1 },
  { key: 'aa_lcr_percent', label: 'Long context LCR ↑', format: percent, direction: -1 },
  { key: 'output_tokens_per_second', label: 'Speed tok/s ↑', format: value => number(value), direction: -1 },
  { key: 'first_answer_seconds', label: 'Delay seconds ↓', format: value => `${number(value)}s`, direction: 1 },
  { key: 'tb4_api_usd_per_attempt', label: 'API $/attempt ↓', format: dollars, direction: 1 }
];
function renderModels() {
  const models = data.models.filter(model => filter === 'all' || model.group === filter);
  models.sort((a, b) => typeof a[sortKey] === 'string' ? a[sortKey].localeCompare(b[sortKey]) * sortDirection : (a[sortKey] - b[sortKey]) * sortDirection);
  $('#model-table thead').innerHTML = `<tr>${columns.map(col => `<th scope="col" aria-sort="${col.key === sortKey ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${col.key}" aria-label="Sort by ${escapeHTML(col.label)}">${escapeHTML(col.label)}<span class="sort-indicator" aria-hidden="true">${col.key === sortKey ? (sortDirection === 1 ? '↑' : '↓') : '↕'}</span></button></th>`).join('')}</tr>`;
  const best = new Map(columns.filter(col => col.format).map(col => [col.key, Math[col.direction === 1 ? 'min' : 'max'](...models.map(model => model[col.key]))]));
  $('#model-table tbody').innerHTML = models.map(model => `<tr><td><strong>${link(model.aa_source, model.model)}</strong>${provenance(model, true)}</td>${columns.slice(1).map(col => `<td${model[col.key] === best.get(col.key) ? ' class="best"' : ''}>${metric(model, col.key, col.format)}${model.id === 'deepseek' && (col.key.startsWith('input_') || col.key.startsWith('output_usd') || col.key.startsWith('cache_') || col.key === 'tb4_api_usd_per_attempt') ? '<small> peak</small>' : ''}</td>`).join('')}</tr>`).join('');
  $('#model-cards').innerHTML = models.map(model => `<article class="model-card"><span class="region-label">${model.group === 'China' ? 'Chinese model' : 'Western baseline'} · Verified snapshot</span><h3>${escapeHTML(model.model)}</h3><dl class="metric-grid"><div><dt>API input / output / cache</dt><dd class="price-metric">${metric(model, 'input_usd_per_million', tokenPrice)} / ${metric(model, 'output_usd_per_million', tokenPrice)} / ${metric(model, 'cache_read_usd_per_million', tokenPrice)}<small> per M${model.id === 'deepseek' ? ' · peak' : ''}</small></dd></div><div><dt>Coding · TB4 solved</dt><dd>${metric(model, 'tb4_percent', percent)}</dd></div><div><dt>Long context · AA-LCR</dt><dd>${metric(model, 'aa_lcr_percent', percent)}</dd></div><div><dt>Generation speed</dt><dd>${metric(model, 'output_tokens_per_second', value => number(value))}<small> tok/s</small></dd></div><div><dt>API cost / attempt</dt><dd>${metric(model, 'tb4_api_usd_per_attempt', dollars)}</dd></div><div><dt>Advertised context</dt><dd>${metric(model, 'context_tokens', value => `${Number(value / 1000000).toLocaleString('en-US', { maximumFractionDigits: 6 })}M`)}</dd></div></dl><div class="model-note">${badge(model.card_description)}<p>${escapeHTML(model.card_description.text)}</p></div>${provenance(model)}</article>`).join('');
}
function renderIntro() {
  $('#last-updated').textContent = dateText(data.metadata.lastUpdated);
  $('#last-updated').dateTime = data.metadata.lastUpdated;
  $('#conclusion-text').textContent = data.conclusion.text;
  $('#snapshot-note').textContent = `Data snapshot: ${dateText(data.metadata.snapshotDate)} · ${data.metadata.priceNote}. ${data.metadata.evaluationDateNote}`;
  $('#takeaway-list').innerHTML = data.takeaways.map(item => `<article class="takeaway">${badge(item)}<p>${escapeHTML(item.text)}</p>${provenance(item)}</article>`).join('');
  const choices = [
    { id: 'sol_medium', label: 'Balanced primary agent', field: 'tb4_percent', format: percent, unit: 'TB4 solved' },
    { id: 'glm', label: 'Budget subscription', field: 'tb4_api_usd_per_attempt', format: dollars, unit: 'AA cost / attempt' },
    { id: 'deepseek', label: 'Fast, cached API', field: 'output_tokens_per_second', format: value => number(value), unit: 'output tok/s' }
  ];
  $('#decision-cards').innerHTML = choices.map(choice => {
    const model = data.models.find(row => row.id === choice.id);
    return `<article class="decision-card"><span class="small-label">${choice.label} · Inference</span><h3>${escapeHTML(model.short_name)}</h3><div class="decision-metric">${metric(model, choice.field, choice.format)}<small>${choice.unit}</small></div><p>${escapeHTML(model.card_description.text)}</p>${provenance(model, true)}</article>`;
  }).join('');
  $('#benchmark-method').innerHTML = `<strong>${escapeHTML(data.benchmark.title)} · ${escapeHTML(data.benchmark.harness)}</strong><p>${escapeHTML(data.benchmark_methodology)} ${escapeHTML(data.benchmark.lcrDefinition)} ${escapeHTML(data.benchmark.speedDefinition)}</p>${badge(data.benchmark)}${provenance(data.benchmark)}`;
  $('#comparison-caption').textContent = `Verified snapshot · ${dateText(data.snapshot_date)} · USD before tax · DeepSeek peak tariff · LCR is a context test, not overnight reliability`;
  $('#comparison-interpretation').innerHTML = content(data.benchmark.interpretation);
  $('#repository-evidence').innerHTML = content(data.repository_agent_note) + table([
    { label: 'Model + harness', render: row => `<strong>${escapeHTML(row.model)}</strong><br>${escapeHTML(row.harness)}` },
    { label: 'DeepSWE v1.1 solved', render: row => percent(row.deepswe_percent) },
    { label: 'Average API $/task*', render: row => dollars(row.api_usd_per_task) },
    { label: 'Average minutes/task*', render: row => number(row.minutes_per_task, 1) }
  ], data.repository_agents, 'AA coding agents · cost/time averages across three suites, not DeepSWE alone') + content(data.long_task_note, 'What remains unproven');
  $('#api-caveats').innerHTML = data.caveats.map(item => content(item, item.conflict ? 'Conflicting pricing data' : '')).join('');
}
function renderHarness() {
  const glm = data.harness.glm, ds = data.harness.deepseek;
  $('#harness-overview').innerHTML = `<article class="harness-card"><span class="small-label">GLM 5.3-FLASH</span><h3>ZCode or Claude Code</h3>${content(glm.official)}${content(glm.recommendation)}</article><article class="harness-card"><span class="small-label">DEEPSEEK V4.1 FLASH</span><h3>Native Standard Harness</h3>${content(ds.recommendation)}${content(ds.setup)}</article>`;
  const headings = ['Get your Z.ai key', 'Merge the settings', 'Check the model aliases', 'Start and verify a session'];
  $('#glm-setup').innerHTML = `<ol class="setup-steps">${glm.steps.map((step, index) => `<li class="setup-step"><h4>${headings[index]}</h4><p>${escapeHTML(step.text)}</p>${index === 1 ? codeBlock(glm.configCode, glm.configPath, 'glm-config-code') : ''}${index === 3 ? codeBlock('/effort max\n/status', 'Claude Code commands', 'glm-session-code') : ''}${provenance(step)}</li>`).join('')}</ol><div class="callout">${content(glm.compatibility.at(-1))}</div>`;
  $('#glm-compatibility').innerHTML = glm.compatibility.map(item => content(item)).join('');
  $('#deepseek-harness').innerHTML = content(ds.benchmarkNote) + table([
    { key: 'harness', label: 'Harness' },
    { label: 'DeepSWE solved', render: row => percent(row.deepswe_percent) },
    { label: 'Terminal-Bench 2.1 solved', render: row => percent(row.tb21_percent) }
  ], ds.rows, 'Vendor-run same-model results · not comparable to AA Terminal-Bench 4.0') + content(ds.limitations) + content(ds.interpretation) + content(data.long_task_note);
}
function renderSubscriptions() {
  const { zai, deepseek, go } = data.subscriptions;
  $('#billing-overview').innerHTML = `<article class="billing-card"><span class="small-label">GLM FLASH</span><h3>Subscription or API</h3>${content(zai.exhaustion)}${content(zai.rateLimits)}</article><article class="billing-card"><span class="small-label">DEEPSEEK FLASH</span><h3>Pay for what you use</h3>${content(deepseek.billing)}${content(deepseek.peakWindows)}</article>`;
  const a = data.workload_assumptions;
  $('#cost-details').innerHTML = `<div class="content-item"><span class="content-label inference">Illustrative assumptions</span><p>${number(a.days)} days / ${number(a.weekly_blocks)} weeks / ${number(a.workdays)} workdays. ${number(a.input_cache_hit_fraction * 100)}% of input is cached. ${escapeHTML(a.session_distribution)}. Output is ${escapeHTML(a.output)}. Excludes ${escapeHTML(a.excluded)}.</p>${provenance(a)}</div>` + table([
    { label: 'Scenario', render: row => escapeHTML(row.label === 'Heavy' ? 'Heavy / parallel agents' : row.label) },
    { label: 'Uncached / cached / output, M', render: row => `${number(row.uncached_input_millions)} / ${number(row.cached_input_millions)} / ${number(row.output_millions)}` },
    { label: 'GLM API', render: row => dollars(row.glm_api_usd) },
    { label: 'DeepSeek off-peak / peak', render: row => `${dollars(row.deepseek_offpeak_usd)} / ${dollars(row.deepseek_peak_usd)}` },
    { label: 'Z.ai off-peak / peak', render: row => `${row.glm_offpeak_plan} ${dollars(row.glm_offpeak_plan_usd)} / ${row.glm_peak_plan} ${dollars(row.glm_peak_plan_usd)}` },
    { label: 'Go, GLM only', render: row => `${row.go_glm_plan} ${dollars(row.go_glm_plan_usd)}` }
  ], data.monthly_costs, 'Calculated monthly costs · constant billed-token volumes · USD') + data.workload_notes.map(item => content(item)).join('');
  $('#zai-plans').innerHTML = content(zai.billingNote) + table([
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
  ], zai.team, 'Team pricing per seat · annual charge is ambiguous, see note') + content(zai.annualConflict) + content(zai.supportedTools) + content(zai.rateLimits) + `<h4>How Flash credits are counted</h4>${codeBlock(zai.creditFormula.text, 'Flash credit formula', 'credit-formula-code')}${provenance(zai.creditFormula)}` + content(zai.offpeak) + content(zai.exhaustion);
  $('#deepseek-billing').innerHTML = [deepseek.billing, deepseek.rateLimits, deepseek.peakWindows, data.caveats.find(item => item.model_ids?.includes('deepseek'))].map(item => content(item)).join('');
  $('#go-plans').innerHTML = table([
    { key: 'name', label: 'Subscription' },
    { label: 'Monthly', render: row => dollars(row.monthly_usd) },
    { label: 'GLM allowance equivalent', render: row => dollars(row.glm_flash_allowance_usd_equivalent) },
    { label: 'DeepSeek allowance equivalent', render: row => dollars(row.deepseek_flash_allowance_usd_equivalent) }
  ], go.plans, 'Third-party OpenCode Go · shared normalized allowances') + content(go.limits) + content(go.compatibility);
  $('#subscription-caveats').innerHTML = content(zai.campaign, 'Temporary campaign') + content(zai.annualConflict, 'Ambiguous Team annual price');
}
function renderRecommendations() {
  $('#recommendation-list').innerHTML = data.final_recommendations.map(item => {
    const colon = item.text.indexOf(':');
    const heading = colon > 0 ? item.text.slice(0, colon) : 'Other Chinese options';
    const body = colon > 0 ? item.text.slice(colon + 1).trim() : item.text;
    return `<article class="recommendation-card">${badge(item)}<h3>${escapeHTML(heading)}</h3><p>${escapeHTML(body)}</p>${provenance(item)}</article>`;
  }).join('');
  $('#closing-note').innerHTML = content(data.final_note);
  $('#source-list').innerHTML = data.sources.map(source => `<div class="source-item">${link(source.url, `${source.title} ↗`)}<time datetime="${source.date}">${dateText(source.date)}</time></div>`).join('');
  $('#footer-date').textContent = `Data last updated ${dateText(data.metadata.lastUpdated)} · Report prepared ${dateText(data.metadata.reportDate)} · ${data.metadata.priceNote}. ${data.metadata.evaluationDateNote}`;
}
function initTheme() {
  const modes = ['system', 'light', 'dark'];
  const refresh = () => {
    const mode = document.documentElement.dataset.theme || 'system';
    $('#theme-label').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    $('#theme-toggle').setAttribute('aria-label', `Color theme: ${mode}. Activate to choose ${modes[(modes.indexOf(mode) + 1) % modes.length]}.`);
  };
  $('#theme-toggle').addEventListener('click', () => {
    const mode = modes[(modes.indexOf(document.documentElement.dataset.theme || 'system') + 1) % modes.length];
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('model-compare-theme', mode); } catch { /* Theme still works without storage. */ }
    refresh();
  });
  refresh();
}
function initInteractions() {
  document.addEventListener('click', async event => {
    const sorter = event.target.closest('[data-sort]');
    if (sorter) {
      const key = sorter.dataset.sort;
      sortDirection = key === sortKey ? -sortDirection : columns.find(col => col.key === key).direction;
      sortKey = key;
      renderModels();
      $(`[data-sort="${key}"]`).focus({ preventScroll: true });
    }
    const tab = event.target.closest('[data-filter]');
    if (tab) {
      filter = tab.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(button => { button.classList.toggle('selected', button === tab); button.setAttribute('aria-pressed', String(button === tab)); });
      renderModels();
    }
    const copy = event.target.closest('[data-copy]');
    if (copy) {
      const value = document.getElementById(copy.dataset.copy).textContent;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        else {
          const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
          const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('Copy unavailable');
        }
        copy.textContent = 'Copied';
        const status = $('#copy-status'); status.textContent = 'Copied to clipboard'; status.classList.add('visible');
        setTimeout(() => { copy.textContent = 'Copy'; status.classList.remove('visible'); }, 2000);
      } catch {
        copy.textContent = 'Select code to copy';
        $('#copy-status').textContent = 'Clipboard access unavailable. Select the code and copy it manually.'; $('#copy-status').classList.add('visible');
        setTimeout(() => $('#copy-status').classList.remove('visible'), 4000);
      }
    }
  });
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      document.querySelectorAll('#toc a').forEach(anchor => {
        const active = anchor.hash === `#${entry.target.id}`;
        anchor.classList.toggle('active', active);
        if (active) anchor.setAttribute('aria-current', 'location'); else anchor.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-18% 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('.report-section, .report-footer').forEach(section => observer.observe(section));
}
async function start() {
  initTheme();
  try {
    const response = await fetch('./data.json');
    if (!response.ok) throw new Error(`Dataset returned ${response.status}`);
    data = await response.json();
    sourceMap = new Map(data.sources.map(source => [source.id, source]));
    renderIntro(); renderModels(); renderHarness(); renderSubscriptions(); renderRecommendations(); renderCharts(data); initInteractions();
    document.documentElement.dataset.ready = 'true';
  } catch (error) {
    $('#conclusion-text').textContent = 'The report could not load. Please refresh or download data.json from the footer.';
    console.error('Report initialization failed:', error);
  }
}
start();
