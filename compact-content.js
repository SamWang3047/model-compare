const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 4) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
const money = value => `$${number(value)}`;
const dateText = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date not found';
const labels = { verified: 'Verified', verified_context: 'Verified context', inference: 'Analyst inference', analyst_inference: 'Analyst inference', calculated: 'Calculated', illustrative: 'Illustrative assumption', missing: 'Not found', not_found: 'Not found', estimated: 'Estimate', estimate: 'Estimate', vendor_reported: 'Vendor reported' };
let copyInstalled = false;

function mount(id, html) {
  const target = document.getElementById(id);
  if (target) target.innerHTML = html;
}
function dot(item) {
  const type = item?.type || item?.label || item?.classification || 'verified';
  const label = labels[type] || type;
  return `<span class="status-dot status-${esc(type)}" role="img" aria-label="${esc(label)}" title="${esc(label)}"></span>`;
}
function value(item, format = String) {
  const raw = item?.value;
  return raw == null || raw === '' || /^(not found|not published)$/i.test(String(raw)) ? 'Not found' : format(raw);
}
function cell(raw, item, format = String) {
  return `${esc(raw == null ? 'Not found' : format(raw))}${dot(item)}`;
}
function table(caption, headings, rows, className = '') {
  return `<div class="table-scroll compact-table ${esc(className)}" role="region" aria-label="${esc(caption)}" tabindex="0"><table><caption>${esc(caption)}</caption><thead><tr>${headings.map(heading => `<th scope="col">${esc(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(item => `<td>${item}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function sourceLink(url, title) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`;
  } catch { return ''; }
}
function provenance(item, sources, fallbackDate) {
  const date = item?.date || item?.retrieved_date || fallbackDate;
  const urls = [...new Set([item?.source_url, ...(item?.source_urls || []), ...(item?.source_ids || []).map(id => sources.get(id)?.url)].filter(Boolean))];
  const snapshots = item?.snapshot_date && item.snapshot_date !== date ? ` · Snapshot ${dateText(item.snapshot_date)}` : '';
  return `<span class="compact-note-provenance"><time datetime="${esc(date || '')}">${dateText(date)}</time>${snapshots}${urls.map((url, index) => ` · ${sourceLink(url, urls.length > 1 ? `Source ${index + 1}` : 'Source')}`).join('')}</span>`;
}
function note(item, sources, fallbackDate, title = '') {
  return `<li>${title ? `<strong>${esc(title)}: </strong>` : ''}${esc(item.text ?? item.value ?? 'Not found')}${dot(item)}${item.note ? ` <span>${esc(item.note)}</span>` : ''}${provenance(item, sources, fallbackDate)}</li>`;
}
function figures(title, metrics, sources, fallbackDate, labelMap = {}) {
  const rows = Object.entries(metrics || {}).map(([key, item]) => `<li><strong>${esc(labelMap[key] || key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' '))}:</strong> ${esc(value(item, raw => typeof raw === 'object' ? JSON.stringify(raw) : String(raw)))}${item.unit ? ` ${esc(item.unit)}` : ''}${dot(item)}${item.note ? ` <span>${esc(item.note)}</span>` : ''}${provenance(item, sources, fallbackDate)}</li>`).join('');
  return `<h4>${esc(title)}</h4><ul class="compact-metric-registry">${rows}</ul>`;
}
function codeBlock(code, label, id) {
  return `<div class="code-block"><div class="code-toolbar"><span>${esc(label)}</span><button class="copy-button" data-copy="${esc(id)}" type="button" aria-label="Copy ${esc(label)}">Copy</button></div><pre tabindex="0" aria-label="${esc(label)}; scroll horizontally to read"><code id="${esc(id)}">${esc(code)}</code></pre></div>`;
}

function renderOverview(report) {
  const takeaways = [
    ['Cheap tokens don’t mean cheap tasks: Sol medium outperforms both Flash options at lower benchmark attempt cost.', report.takeaways[0]],
    ['Harness changes results: Kimi’s native CLI performs better on repository tasks than its generic terminal score suggests.', report.takeaways[2]],
    ['Long autonomous runs need quota planning, compaction and recovery; context size alone does not establish reliability.', report.takeaways[3]]
  ];
  mount('overview-text', `<p class="compact-conclusion">Sol medium gives the best coding value. GLM Flash and DeepSeek Flash offer cheap tokens; MiMo is worth testing.${dot(report.conclusion)}</p><ul class="compact-takeaways">${takeaways.map(([text, item]) => `<li>${esc(text)}${dot(item)}</li>`).join('')}</ul>`);
}

function renderPicks(report, coding) {
  const recommendations = report.final_recommendations;
  const modelName = id => report.models.find(model => model.id === id)?.display_name || 'Not found';
  const opusPair = coding.agent_pairs.find(pair => pair.id === 'opus_current');
  const opusHarness = opusPair?.name.split(' - ')[0] || 'Not found';
  const picks = [
    ['Primary coding agent', modelName('sol_medium'), 'Codex', recommendations[0]],
    ['Budget subscription', modelName('glm'), 'Claude Code or ZCode', recommendations[1]],
    ['Fast cached API', modelName('deepseek'), 'Native Standard Harness', recommendations[2]],
    ['Additional API trial', modelName('mimo'), 'API trial; harness not specified', recommendations[3]],
    ['Hard tasks, selectively', 'Claude Opus 5.5', opusHarness, recommendations[4]],
    ['Kimi repository work', modelName('kimi'), 'Native Kimi Code CLI', recommendations[5]]
  ];
  mount('quick-picks', table('Choose by task', ['Need', 'Pick', 'Harness'], picks.map(([need, pick, harness, item]) => [esc(need), `${esc(pick)}${dot(item)}`, esc(harness)])));
  const glm = report.harness.glm;
  mount('glm-setup', `<p>Merge this into <code>${esc(glm.configPath)}</code>, preserving existing settings.${dot(glm.configProvenance)}</p>${codeBlock(glm.configCode, 'Claude Code configuration', 'compact-glm-config')}<ul><li>Use your Z.ai Coding Plan key.${dot(glm.steps[0])}</li><li>Map every alias to Flash; the general example can use about three times the credits.${dot(glm.compatibility[0])}</li><li>No automatic API fallback when plan quota runs out.${dot(glm.compatibility[3])}</li></ul>`);
  const ds = report.harness.deepseek;
  mount('deepseek-line', `For working projects, use DeepSeek’s native Standard mode.${dot(ds.recommendation)}`);
  mount('deepseek-results', table('Vendor-run, not comparable to Terminal-Bench 4.0', ['Harness', 'DeepSWE %', 'Terminal-Bench 2.1 %'], ds.rows.map(row => [esc(row.harness), cell(row.deepswe_percent, row, number), cell(row.tb21_percent, row, number)])));
}

function renderPlans(report, coding) {
  const { zai, go, deepseek } = report.subscriptions;
  const rows = zai.individual.map(plan => [`Z.ai ${esc(plan.name)}`, cell(plan.monthly_usd, plan, money)]);
  rows.push(...go.plans.map(plan => [`OpenCode ${esc(plan.name)}`, cell(plan.monthly_usd, plan, money)]));
  rows.push(['DeepSeek', `Prepaid API; flat plan Not found${dot({ type: 'missing' })}`]);
  const campaignMatch = zai.campaign.text.match(/end\s+(\d{1,2}\s+October\s+\d{4})/i);
  const ending = campaignMatch ? new Date(campaignMatch[1]) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const campaign = ending && !Number.isNaN(ending.getTime()) && today <= ending ? `<p class="compact-campaign">Ends ${esc(ending.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}${dot(zai.campaign)}</p>` : '';
  mount('plan-table', table('Individual monthly plans · USD', ['Plan', 'Monthly cost'], rows) + campaign);

  const assumptions = report.workload_assumptions;
  const workload = `<p>${cell(assumptions.days, assumptions, number)} days; ${cell(assumptions.workdays, assumptions, number)} workdays across ${cell(assumptions.weekly_blocks, assumptions, number)} weeks; ${cell(assumptions.input_cache_hit_fraction * 100, assumptions, raw => `${number(raw)}%`)} cached input. ${esc(assumptions.session_distribution)}. Output is ${esc(assumptions.output)}. Excludes ${esc(assumptions.excluded)}.</p>`;
  const costs = table('Illustrative monthly workloads · USD', ['Workload', 'Input uncached / cached / output, M', 'GLM API', 'DeepSeek off-peak / peak', 'Z.ai off-peak / peak', 'Go, GLM only', 'GLM credits off-peak / peak'], report.monthly_costs.map(row => [
    esc(row.label), [row.uncached_input_millions, row.cached_input_millions, row.output_millions].map(raw => cell(raw, row, number)).join(' / '), cell(row.glm_api_usd, row, money), [row.deepseek_offpeak_usd, row.deepseek_peak_usd].map(raw => cell(raw, row, money)).join(' / '), `${esc(row.glm_offpeak_plan)} ${cell(row.glm_offpeak_plan_usd, row, money)} / ${esc(row.glm_peak_plan)} ${cell(row.glm_peak_plan_usd, row, money)}`, `${esc(row.go_glm_plan)} ${cell(row.go_glm_plan_usd, row, money)}`, [row.glm_credits_offpeak, row.glm_credits_peak].map(raw => cell(raw, row, number)).join(' / ')
  ]));
  const upfront = table('Z.ai individual quotas and upfront prices', ['Plan', 'Credits / five hours', 'Credits / week', 'Quarterly upfront', 'Annual upfront'], zai.individual.map(plan => [esc(plan.name), cell(plan.credits_per_five_hours, plan, number), cell(plan.credits_per_week, plan, number), cell(plan.quarterly_upfront_usd, plan, money), cell(plan.annual_upfront_usd, plan, money)]));
  const goAllowances = table('Go model allowance equivalents · shared, not additive', ['Plan', 'GLM Flash, USD equivalent', 'DeepSeek Flash, USD equivalent'], go.plans.map(plan => [esc(plan.name), cell(plan.glm_flash_allowance_usd_equivalent, plan, money), cell(plan.deepseek_flash_allowance_usd_equivalent, plan, money)]));
  const goFallback = coding.plans.find(plan => plan.name === 'OpenCode Go')?.facts.find(item => item.value?.['5_hours'] != null)?.note;
  const exhaustion = zai.exhaustion.text.split('. Team')[0] + '.';
  mount('plan-rules', `<h3>Workloads</h3>${workload}${costs}<p>These are planning scenarios, not measured developer averages; heavy means parallel-agent traffic.${dot(report.workload_notes[0])}</p><h3>Z.ai rules</h3>${upfront}<p>${esc(zai.billingNote.text)}${dot(zai.billingNote)}</p><p>Flash credit formula: <code>${esc(zai.creditFormula.text)}</code>${dot(zai.creditFormula)}</p><p>${esc(zai.offpeak.text)}${dot(zai.offpeak)} ${esc(exhaustion)}${dot(zai.exhaustion)}</p><p>${esc(zai.rateLimits.text)}${dot(zai.rateLimits)}</p><h3>Go rules</h3>${goAllowances}<p>${esc(go.limits.text)}${dot(go.limits)}</p>${goFallback ? `<p>${esc(goFallback)}${dot({ type: 'verified' })}</p>` : ''}<p>${esc(go.compatibility.text)}${dot(go.compatibility)}</p><h3>DeepSeek rules</h3><p>${esc(deepseek.peakWindows.text)}${dot(deepseek.peakWindows)}</p><p>${esc(deepseek.rateLimits.text)}${dot(deepseek.rateLimits)}</p>`);
}

function renderNotes(report, coding, companies) {
  const reportSources = new Map(report.sources.map(source => [source.id, source]));
  const companySources = new Map(companies.sources.map(source => [source.id, source]));
  const codingSources = new Map(coding.sources.map(source => [source.id, source]));
  const visible = [
    [report.benchmark.costDefinition, report.benchmark],
    ['Opus was evaluated with fallback allowed.', report.caveats.find(item => item.model_ids?.includes('opus') && /fallback/.test(item.text))],
    ['DeepSeek benchmark cost uses peak pricing.', { ...report.models.find(model => model.id === 'deepseek'), source_ids: ['aa_deepseek', 'deepseek_pricing'] }],
    ['AA-LCR measures long-context reasoning, not unattended success.', report.benchmark]
  ];
  mount('data-notes', `<ul class="compact-data-notes">${visible.map(([text, item]) => `<li>${esc(text)}${dot(item)}${provenance(item, reportSources, report.snapshot_date)}</li>`).join('')}</ul>`);

  const reportNotes = [...report.caveats, ...report.workload_notes, report.long_task_note, report.repository_agent_note, report.final_note, ...report.harness.glm.compatibility.slice(1, 3), report.harness.deepseek.limitations].filter(Boolean);
  const noteSourceIds = [
    ['aa_glm', 'zai_pricing'], ['aa_deepseek', 'deepseek_pricing'], ['aa_opus'], ['aa_qwen', 'qwen_pricing'],
    ['sol_pricing', 'aa_sol_max'], ['kimi_pricing', 'kimi_cache'], ['aa_method'], ['aa_method'],
    ['aa_minimax', 'minimax_pricing', 'minimax_cache'], ['zai_claude', 'zcode_config', 'zai_faq']
  ];
  const rawNotes = report.notes.map((text, index) => ({ text, type: 'verified', date: report.snapshot_date, source_ids: noteSourceIds[index] || [] }));
  rawNotes.unshift({ text: report.benchmark_methodology, ...report.benchmark });
  const companyNotes = [...companies.methods, ...companies.limits].filter(item => !/team|promotion|temporary|campaign/i.test(item.text || ''));
  let notes = `<h3>Other notes</h3><ul class="compact-notes-list">${[...reportNotes, ...rawNotes].map(item => note(item, reportSources, report.snapshot_date)).join('')}${companyNotes.map(item => note(item, companySources, companies.snapshot_date)).join('')}${[...coding.caveats, ...coding.name_checks].map(item => note(item, codingSources, coding.metadata.updated_date)).join('')}</ul>`;
  const companyMetricLabels = { ii: 'Intelligence Index', rank: 'Leaderboard rank', context: 'Context tokens', tb4: 'Terminal-Bench 4.0 %', sciCode: 'SciCode % (under review)', agent: 'AutomationBench % (SaaS workflows)', input: 'Input USD / M', output: 'Output USD / M', cache: 'Cached input USD / M', blended: 'Illustrative blended USD / M', gapSol: 'Intelligence gap to Sol', gapOpus: 'Intelligence gap to Opus', outputRatioSol: 'Output-price ratio to Sol', outputRatioOpus: 'Output-price ratio to Opus', elo: 'Video arena score', ciLow: '95% interval lower bound', ciHigh: '95% interval upper bound', priceMinute: 'Video USD / minute', priceSecond: 'Video USD / second', weights: 'Weight availability', modalities: 'Modalities', resolution: 'Maximum resolution', duration: 'Maximum duration', effort: 'Tested effort' };
  notes += '<h3>Model figures and pricing conditions</h3>' + companies.models.map(model => figures(model.name, model.metrics, companySources, companies.snapshot_date, companyMetricLabels) + (model.notes?.length ? `<ul class="compact-notes-list">${model.notes.map(item => note(item, companySources, companies.snapshot_date)).join('')}</ul>` : '')).join('');
  const originalMetricLabels = { tb4_percent: 'Terminal-Bench 4.0 %', tb4_api_usd_per_attempt: 'TB4 USD / attempt', output_tokens_per_second: 'Output tokens / second', first_answer_seconds: 'First answer seconds', aa_lcr_percent: 'AA-LCR %', context_tokens: 'Context tokens', input_usd_per_million: 'Input USD / M', output_usd_per_million: 'Output USD / M', cache_read_usd_per_million: 'Cached input USD / M' };
  notes += '<h3>Original coding snapshot</h3>' + report.models.map(model => {
    const metrics = Object.fromEntries(Object.keys(originalMetricLabels).map(key => [key, { value: model[key], type: model.type, date: model.date, source_ids: model.metric_sources?.[key] ? [model.metric_sources[key]] : model.source_ids }]));
    return figures(model.model, metrics, reportSources, report.snapshot_date, originalMetricLabels);
  }).join('');
  notes += '<h3>Coding figures</h3>' + coding.models.map(model => figures(model.name, model.metrics, codingSources, coding.metadata.updated_date) + (model.vendor_tb4 ? figures(`${model.name} — vendor configuration`, { terminal_bench: model.vendor_tb4 }, codingSources, coding.metadata.updated_date) : '') + `<ul class="compact-notes-list">${model.notes.map(item => note(item, codingSources, coding.metadata.updated_date)).join('')}</ul>`).join('');
  notes += '<h3>Original repository-agent snapshot</h3>' + report.repository_agents.map(row => {
    const metrics = Object.fromEntries(['deepswe_percent', 'api_usd_per_task', 'minutes_per_task'].map(key => [key, { value: row[key], type: row.type, date: row.date, source_ids: row.source_ids }]));
    return figures(`${row.model} · ${row.harness}`, metrics, reportSources, report.snapshot_date, { deepswe_percent: 'DeepSWE v1.1 solved %', api_usd_per_task: 'USD / task, across coding-agent suites', minutes_per_task: 'Minutes / task, across coding-agent suites' });
  }).join('');
  notes += '<h3>Agent configurations</h3>' + coding.agent_pairs.map(pair => `<p>${esc(pair.note)}</p>${figures(pair.name, pair.metrics, codingSources, coding.metadata.updated_date)}`).join('') + figures(coding.terminal_reference.name, { terminal_bench: coding.terminal_reference.metric }, codingSources, coding.metadata.updated_date);
  notes += '<h3>Other subscription details</h3>' + coding.plans.map(plan => figures(plan.name, { price: plan.price, ...Object.fromEntries(plan.facts.map((item, index) => [`${item.unit} (${index + 1})`, item])) }, codingSources, coding.metadata.updated_date)).join('');
  notes += '<h3>Missing data</h3><ul class="compact-notes-list">' + coding.unverified_claims.map(item => note({ ...item.metric, text: 'Not found' }, codingSources, coding.metadata.updated_date, item.title)).join('') + '</ul>';
  notes += `<h3>Plan source dates</h3><ul class="compact-notes-list">${report.subscriptions.zai.individual.map(plan => note({ ...plan, text: `${plan.name}: ${money(plan.monthly_usd)} monthly; ${money(plan.quarterly_upfront_usd)} quarterly upfront; ${money(plan.annual_upfront_usd)} annual upfront; ${number(plan.credits_per_five_hours)} credits / five hours; ${number(plan.credits_per_week)} credits / week.` }, reportSources, report.snapshot_date)).join('')}${report.monthly_costs.map(row => note({ ...row, text: `${row.label}: GLM API ${money(row.glm_api_usd)}; DeepSeek off-peak ${money(row.deepseek_offpeak_usd)} / peak ${money(row.deepseek_peak_usd)}; Z.ai off-peak ${row.glm_offpeak_plan} ${money(row.glm_offpeak_plan_usd)} / peak ${row.glm_peak_plan} ${money(row.glm_peak_plan_usd)}; Go ${row.go_glm_plan} ${money(row.go_glm_plan_usd)}.` }, reportSources, report.snapshot_date)).join('')}</ul>`;
  mount('all-notes', notes);
}

export function bindCompactCopies() {
  if (copyInstalled) return;
  copyInstalled = true;
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const code = document.getElementById(button.dataset.copy);
    if (!code) return;
    const status = document.getElementById('copy-status');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code.textContent);
      else {
        const input = document.createElement('textarea');
        input.value = code.textContent;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      button.textContent = 'Copied';
      if (status) { status.textContent = 'Copied to clipboard'; status.classList.add('visible'); }
      setTimeout(() => { button.textContent = 'Copy'; status?.classList.remove('visible'); }, 2000);
    } catch {
      button.textContent = 'Select code to copy';
      if (status) { status.textContent = 'Select the code and copy it manually.'; status.classList.add('visible'); }
      setTimeout(() => status?.classList.remove('visible'), 4000);
    }
  });
}

/** Compact presentation only: all datasets and their source values remain untouched. */
export function renderCompactContent(reportData, codingData, companyData) {
  renderOverview(reportData);
  renderPicks(reportData, codingData);
  renderPlans(reportData, codingData);
  renderNotes(reportData, codingData, companyData);
  bindCompactCopies();
}
