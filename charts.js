/* Dependency-free, responsive charts. All reported values come from data.json.
 * API: renderCharts(data) renders into the three chart containers.
 * Supports the report's models, monthly_costs and chart_estimates schema.
 */
const NS = 'http://www.w3.org/2000/svg';
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const exact = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
const dateText = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Report snapshot';
const color = 'var(--accent, #175dcc)';
const muted = 'var(--muted, #5c6b83)';
const grid = 'var(--chart-grid, #dce5f1)';
const textColor = 'var(--text, #172640)';
let sequence = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgEl(tag, attrs = {}, content) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (content !== undefined) node.textContent = content;
  return node;
}
function appendSVG(parent, tag, attrs, content) {
  const node = svgEl(tag, attrs, content);
  parent.append(node);
  return node;
}
function svgRoot(width, height, title, description) {
  const id = `chart-${++sequence}`;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-labelledby': `${id}-title ${id}-desc` });
  svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible;font:inherit';
  appendSVG(svg, 'title', { id: `${id}-title` }, title);
  appendSVG(svg, 'desc', { id: `${id}-desc` }, description);
  return svg;
}
function svgText(svg, x, y, content, attrs = {}) {
  return appendSVG(svg, 'text', { x, y, fill: muted, 'font-size': 12, ...attrs }, content);
}
function line(svg, x1, y1, x2, y2, attrs = {}) {
  return appendSVG(svg, 'line', { x1, y1, x2, y2, stroke: grid, 'stroke-width': 1, ...attrs });
}
function link(url, label) {
  const a = el('a', '', label);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
function sourcesFromIds(data, ids = []) {
  const sources = data.sources || {};
  return ids.map(id => Array.isArray(sources) ? sources.find(source => source.id === id) : sources[id]).filter(Boolean).map(source => typeof source === 'string' ? { url: source, title: 'Source' } : source);
}
function sourceURL(source) { return source.url || source.href || source.link; }
function sourceName(source) { return source.title || source.label || source.name || 'Source'; }
function caption(host, data, note, sources) {
  const p = el('p', 'chart-note', `${note} Snapshot: ${dateText(data.snapshot_date)}.`);
  host.append(p);
  if (sources.length) {
    const details = el('details', 'chart-sources');
    details.append(el('summary', '', 'Sources and dates'));
    const list = el('ul');
    for (const source of sources) {
      if (!sourceURL(source)) continue;
      const item = el('li');
      item.append(link(sourceURL(source), sourceName(source)), document.createTextNode(` — ${dateText(source.date || source.accessed || data.snapshot_date)}`));
      list.append(item);
    }
    details.append(list);
    host.append(details);
  }
}
function tooltip(host) {
  const tip = el('div', 'chart-tooltip');
  tip.setAttribute('aria-live', 'polite');
  tip.setAttribute('aria-atomic', 'true');
  tip.style.cssText = 'min-height:6rem;padding:1rem;border:1px solid var(--chart-grid,#dce5f1);border-radius:12px;background:var(--surface,#fff);margin-top:1rem;line-height:1.6';
  tip.append(el('p', '', 'Hover, focus or tap a mark to inspect its data and source.'));
  host.append(tip);
  return (title, rows, sources = []) => {
    tip.replaceChildren(el('strong', '', title));
    for (const row of rows) tip.append(el('div', '', row));
    const sourceRow = el('div');
    sources.forEach((source, index) => {
      if (index) sourceRow.append(document.createTextNode(' · '));
      if (sourceURL(source)) sourceRow.append(link(sourceURL(source), sourceName(source)));
    });
    tip.append(sourceRow);
  };
}
function interact(mark, label, select) {
  mark.setAttribute('tabindex', '0');
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', label);
  mark.style.cursor = 'pointer';
  mark.classList.add('chart-mark');
  mark.append(svgEl('title', {}, label));
  mark.addEventListener('pointerenter', select);
  mark.addEventListener('focus', select);
  mark.addEventListener('click', select);
  mark.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    }
  });
}
function responsive(host, draw) {
  let lastWidth = 0;
  const repaint = () => {
    const width = Math.round(Math.max(300, Math.min(820, host.clientWidth || 640)));
    if (width === lastWidth) return;
    lastWidth = width;
    draw(width);
  };
  repaint();
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(repaint);
    observer.observe(host);
    return () => observer.disconnect();
  }
  window.addEventListener('resize', repaint);
  return () => window.removeEventListener('resize', repaint);
}

function codingChart(host, data) {
  const plot = el('div');
  host.append(plot);
  const show = tooltip(host);
  const models = [...data.models].sort((a, b) => b.tb4_percent - a.tb4_percent);
  caption(host, data, 'Verified AA observations. Same Terminal-Bench 4.0 harness; higher is better. Evaluation-run dates are not consistently disclosed.', models.map(model => ({ title: model.model, url: model.aa_source })));
  return responsive(plot, width => {
    const small = width < 600;
    const rowHeight = small ? 61 : 43;
    const left = small ? 8 : 244;
    const right = 52;
    const top = 12;
    const bottom = 45;
    const height = top + models.length * rowHeight + bottom;
    const svg = svgRoot(width, height, 'Coding performance: Terminal-Bench 4.0', 'Horizontal bars show the share of tasks solved. Every bar can be focused or tapped for the source, date and exact value.');
    const chartWidth = width - left - right;
    const maximum = Math.ceil(Math.max(...models.map(model => model.tb4_percent)) / 10) * 10;
    for (let tick = 0; tick <= maximum; tick += 20) {
      const x = left + tick / maximum * chartWidth;
      line(svg, x, top, x, height - bottom + 2);
      svgText(svg, x, height - bottom + 22, `${tick}%`, { 'text-anchor': 'middle' });
    }
    models.forEach((model, index) => {
      const y = top + index * rowHeight;
      const barY = y + (small ? 27 : 9);
      const barWidth = model.tb4_percent / maximum * chartWidth;
      const bar = appendSVG(svg, 'rect', { x: left, y: barY, width: barWidth, height: small ? 22 : 24, rx: 4, fill: color });
      svgText(svg, small ? left : left - 12, small ? y + 16 : barY + 17, model.model, { 'text-anchor': small ? 'start' : 'end', fill: textColor, 'font-size': small ? 12 : 12.5 });
      svgText(svg, left + barWidth + 8, barY + 16, `${model.tb4_percent.toFixed(1)}%`, { fill: textColor, 'font-weight': 650, 'font-size': 12 });
      interact(bar, `${model.model}: ${exact(model.tb4_percent)} percent of tasks solved.`, () => show(model.model, [
        `Terminal-Bench 4.0: ${exact(model.tb4_percent)}% solved`,
        'Verified observation · common mini-swe-agent harness',
        `Snapshot: ${dateText(model.date || model.snapshot_date || data.snapshot_date)} · evaluation date not disclosed`
      ], [{ title: 'Artificial Analysis model page', url: model.aa_source }]));
    });
    svgText(svg, left + chartWidth / 2, height - 2, 'Tasks solved (%)', { 'text-anchor': 'middle' });
    plot.replaceChildren(svg);
  });
}

function valueChart(host, data) {
  const plot = el('div');
  const legend = el('div', 'chart-legend');
  legend.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.4rem;margin-top:1rem';
  host.append(plot, legend);
  const show = tooltip(host);
  const points = data.models.map((model, index) => ({ ...model, mark: String(index + 1), estimate: false }));
  const estimate = data.chart_estimates?.deepseek_offpeak;
  if (estimate) {
    const model = data.models.find(item => item.id === estimate.model_id);
    if (model) points.push({ ...model, ...estimate, model: `${model.model} — off-peak estimate`, mark: 'E', estimate: true });
  }
  const selectPoint = point => show(point.model, [
    `Terminal-Bench 4.0: ${exact(point.tb4_percent)}% solved`,
    `API cost per attempt: $${exact(point.tb4_api_usd_per_attempt)} (failed attempts included)`,
    point.estimate ? `Calculated estimate: ${estimate.note}.` : 'Verified AA observation · common mini-swe-agent harness',
    `Snapshot: ${dateText(point.date || point.snapshot_date || data.snapshot_date)}`
  ], [{ title: 'Artificial Analysis model page', url: point.aa_source }, ...(point.estimate ? [{ title: 'DeepSeek tariff', url: point.pricing_source }] : [])]);
  points.forEach(point => {
    const button = el('button', 'chart-legend-item', `${point.mark}. ${point.model}`);
    button.type = 'button';
    button.style.cssText = 'text-align:left;font:inherit;font-size:.82rem;line-height:1.4;background:var(--surface,#fff);color:var(--text,#172640);border:1px solid var(--chart-grid,#dce5f1);border-radius:8px;padding:.55rem .65rem;cursor:pointer';
    button.addEventListener('click', () => selectPoint(point));
    button.addEventListener('focus', () => selectPoint(point));
    legend.append(button);
  });
  caption(host, data, 'Verified AA points; lower cost and higher score are preferable. Hollow E is a calculated off-peak estimate, not a benchmark rerun. The horizontal axis is logarithmic.', points.filter(point => !point.estimate).map(point => ({ title: point.model, url: point.aa_source })));
  return responsive(plot, width => {
    const small = width < 500;
    const height = small ? 350 : 410;
    const left = 46, right = 18, top = 25, bottom = 66;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const minX = 0.3, maxX = 30, maxY = 65;
    const x = value => left + (Math.log10(value) - Math.log10(minX)) / (Math.log10(maxX) - Math.log10(minX)) * plotWidth;
    const y = value => top + (1 - value / maxY) * plotHeight;
    const svg = svgRoot(width, height, 'Coding value: API attempt cost versus tasks solved', 'Numbered points correspond to the model buttons below. Lower cost and higher scores are preferable. Focus or tap a point for exact source data.');
    for (const tick of [0.5, 1, 2, 5, 10, 20]) {
      line(svg, x(tick), top, x(tick), height - bottom);
      svgText(svg, x(tick), height - bottom + 22, `$${tick}`, { 'text-anchor': 'middle' });
    }
    for (let tick = 0; tick <= 60; tick += 20) {
      line(svg, left, y(tick), width - right, y(tick));
      svgText(svg, left - 8, y(tick) + 4, `${tick}%`, { 'text-anchor': 'end' });
    }
    points.forEach(point => {
      const g = appendSVG(svg, 'g', {});
      appendSVG(g, 'circle', { cx: x(point.tb4_api_usd_per_attempt), cy: y(point.tb4_percent), r: 12, fill: point.estimate ? 'var(--surface,#fff)' : color, stroke: color, 'stroke-width': point.estimate ? 2.5 : 1 });
      svgText(g, x(point.tb4_api_usd_per_attempt), y(point.tb4_percent) + 4, point.mark, { fill: point.estimate ? color : 'var(--on-accent, #fff)', 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, 'pointer-events': 'none' });
      interact(g, `${point.model}: ${exact(point.tb4_percent)}% solved at $${exact(point.tb4_api_usd_per_attempt)} per attempt${point.estimate ? ', calculated estimate' : ''}.`, () => selectPoint(point));
    });
    svgText(svg, left + plotWidth / 2, height - 19, 'API cost per attempt (USD · log scale)', { 'text-anchor': 'middle', 'font-size': small ? 11 : 12 });
    svgText(svg, left + plotWidth / 2, 14, 'Tasks solved (%)', { 'text-anchor': 'middle' });
    plot.replaceChildren(svg);
  });
}

function costChart(host, data) {
  const scenarios = data.monthly_costs || data.costScenarios || [];
  if (!scenarios.length) return () => {};
  const controls = el('div', 'chart-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Monthly workload scenario');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem';
  const plot = el('div');
  host.append(controls, plot);
  const show = tooltip(host);
  let selected = 0;
  let currentWidth = 640;
  const buttons = scenarios.map((scenario, index) => {
    const button = el('button', '', scenario.label.toLowerCase().includes('heavy') ? 'Heavy · parallel agents' : scenario.label);
    button.type = 'button';
    button.setAttribute('aria-pressed', index === selected ? 'true' : 'false');
    button.addEventListener('click', () => {
      selected = index;
      buttons.forEach((item, position) => item.setAttribute('aria-pressed', position === selected ? 'true' : 'false'));
      draw(currentWidth);
      show(`${scenario.label} workload`, [
        `${exact(scenario.uncached_input_millions)}M uncached input + ${exact(scenario.cached_input_millions)}M cached input + ${exact(scenario.output_millions)}M output tokens`,
        'Calculated scenario · 95% input cached · output includes reasoning',
        `Snapshot: ${dateText(scenario.snapshot_date || data.snapshot_date)}`
      ], sourcesFromIds(data, scenario.source_ids));
    });
    controls.append(button);
    return button;
  });
  const ids = [...new Set(scenarios.flatMap(scenario => scenario.source_ids || []))];
  caption(host, data, 'Calculated illustrative costs, not measured developer averages. Z.ai shows the eligible off-peak plan; peak-time eligibility can differ. Heavy use aggregates parallel agents. Tool fees, taxes and temporary promotions are excluded.', sourcesFromIds(data, ids));
  const draw = width => {
    currentWidth = width;
    const scenario = scenarios[selected];
    const small = width < 500;
    const series = [
      { label: ['GLM', 'API'], value: scenario.glm_api_usd, name: 'GLM pay-as-you-go API', opacity: 0.55 },
      { label: ['DeepSeek', 'off-peak'], value: scenario.deepseek_offpeak_usd, name: 'DeepSeek API · off-peak', opacity: 0.7 },
      { label: ['DeepSeek', 'peak'], value: scenario.deepseek_peak_usd, name: 'DeepSeek API · peak', opacity: 0.85 },
      { label: ['Z.ai', scenario.glm_offpeak_plan], value: scenario.glm_offpeak_plan_usd, name: `Z.ai ${scenario.glm_offpeak_plan} · off-peak eligibility`, opacity: 1 },
      { label: ['OpenCode', scenario.go_glm_plan], value: scenario.go_glm_plan_usd, name: `OpenCode ${scenario.go_glm_plan} · GLM only`, opacity: 0.65 }
    ];
    const height = small ? 350 : 390;
    const left = 45, right = 10, top = 36, bottom = 77;
    const chartHeight = height - top - bottom;
    const maxValue = Math.max(...series.map(item => item.value));
    const rawStep = maxValue / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step = Math.ceil(rawStep / magnitude) * magnitude;
    const maximum = Math.ceil(maxValue / step) * step;
    const svg = svgRoot(width, height, `${scenario.label} workload: monthly subscription and API costs`, 'Five bars compare calculated monthly costs. Tap or focus each bar to read the amount, eligibility, sources and assumptions.');
    for (let value = 0; value <= maximum + step / 100; value += step) {
      const y = top + chartHeight * (1 - value / maximum);
      line(svg, left, y, width - right, y);
      svgText(svg, left - 8, y + 4, `$${exact(value)}`, { 'text-anchor': 'end', 'font-size': 11 });
    }
    const slotWidth = (width - left - right) / series.length;
    series.forEach((item, index) => {
      const x = left + index * slotWidth + slotWidth * 0.21;
      const barWidth = slotWidth * 0.58;
      const barHeight = Math.max(3, item.value / maximum * chartHeight);
      const y = top + chartHeight - barHeight;
      const mark = appendSVG(svg, 'g', {});
      // Include the label in the tap target, so tiny API bars remain usable.
      appendSVG(mark, 'rect', { x: left + index * slotWidth + 2, y: top, width: slotWidth - 4, height: chartHeight + 46, fill: 'transparent' });
      appendSVG(mark, 'rect', { x, y, width: barWidth, height: barHeight, rx: 4, fill: color });
      svgText(mark, x + barWidth / 2, y - 9, money(item.value), { fill: textColor, 'text-anchor': 'middle', 'font-size': small ? 10.5 : 12, 'font-weight': 650 });
      item.label.forEach((part, position) => svgText(mark, x + barWidth / 2, height - bottom + 23 + position * 17, part, { 'text-anchor': 'middle', 'font-size': small ? 10 : 12 }));
      interact(mark, `${item.name}: ${money(item.value)} monthly for the ${scenario.label.toLowerCase()} workload. Calculated scenario.`, () => show(item.name, [
        `Monthly cost: ${money(item.value)} · ${scenario.label} workload`,
        `${exact(scenario.uncached_input_millions)}M uncached input / ${exact(scenario.cached_input_millions)}M cached input / ${exact(scenario.output_millions)}M output`,
        `Calculated scenario · snapshot ${dateText(scenario.snapshot_date || data.snapshot_date)}`,
        'Equal token volumes; completed-task costs can differ across models.'
      ], sourcesFromIds(data, scenario.source_ids)));
    });
    svgText(svg, left, 16, 'Monthly cost (USD)', { 'font-size': 12 });
    plot.replaceChildren(svg);
  };
  return responsive(plot, draw);
}

export function renderCharts(data, options = {}) {
  const cleanups = [];
  for (const [id, render] of [['coding-chart', codingChart], ['value-chart', valueChart], ['cost-chart', costChart]]) {
    const host = document.getElementById(id);
    if (!host) continue;
    host.replaceChildren();
    cleanups.push(render(host, data, options));
  }
  return () => cleanups.forEach(cleanup => cleanup?.());
}
