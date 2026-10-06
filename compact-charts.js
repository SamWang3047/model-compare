/* Compact SVG charts. The published JSON values are read, never changed. */
import { deriveCodingData } from './coding-data.js';

const NS = 'http://www.w3.org/2000/svg';
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
const raw = value => String(value);
const money = value => `$${number(value)}`;
const finite = value => typeof value === 'number' && Number.isFinite(value);
let sequence = 0;

function html(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function add(parent, tag, attributes = {}, content) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (content !== undefined) node.textContent = content;
  parent.append(node);
  return node;
}
function text(parent, x, y, content, attributes = {}) {
  return add(parent, 'text', { x, y, fill: 'var(--muted)', 'font-size': 13, ...attributes }, content);
}
function line(parent, x1, y1, x2, y2, attributes = {}) {
  return add(parent, 'line', { x1, y1, x2, y2, stroke: 'var(--chart-grid)', ...attributes });
}
function svgRoot(width, height, title, description) {
  const id = `compact-chart-${++sequence}`;
  const svg = document.createElementNS(NS, 'svg');
  Object.entries({ viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-labelledby': `${id}-title ${id}-description`, class: 'compact-chart-svg' }).forEach(([key, value]) => svg.setAttribute(key, value));
  add(svg, 'title', { id: `${id}-title` }, title);
  add(svg, 'desc', { id: `${id}-description` }, description);
  return svg;
}
function statusDot(status = 'verified') {
  const label = ({ verified: 'Verified', calculated: 'Calculated', inference: 'Inference', estimate: 'Estimate', estimated: 'Estimate', missing: 'Not found', not_found: 'Not found' })[status] || status;
  const dot = html('span', `compact-status-dot compact-status-${status}`);
  dot.title = label;
  dot.setAttribute('role', 'img');
  dot.setAttribute('aria-label', label);
  return dot;
}
function calculatedDot(parent, x, y) {
  const dot = add(parent, 'circle', { cx: x, cy: y, r: 3, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 1, role: 'img', 'aria-label': 'Calculated' });
  add(dot, 'title', {}, 'Calculated');
}
function inspector(host) {
  const target = html('div', 'compact-chart-inspector');
  target.setAttribute('aria-live', 'polite');
  target.setAttribute('aria-atomic', 'true');
  target.append(html('span', '', 'Focus, hover or tap a point for its values.'));
  host.append(target);
  return (title, rows, note = '') => {
    target.replaceChildren(html('strong', 'compact-chart-selection', title));
    const values = html('div', 'compact-chart-values');
    for (const row of rows) {
      const value = html('span', 'compact-chart-value');
      value.append(document.createTextNode(`${row.title}: ${row.value}`), statusDot(row.status));
      values.append(value);
    }
    target.append(values);
    if (note) target.append(html('span', 'compact-chart-inspector-note', note));
  };
}
function interact(mark, description, select) {
  mark.classList.add('compact-chart-mark');
  mark.setAttribute('role', 'button');
  mark.setAttribute('tabindex', '0');
  mark.setAttribute('aria-label', description);
  add(mark, 'title', {}, description);
  ['pointerenter', 'focus', 'click'].forEach(type => mark.addEventListener(type, select));
  mark.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    }
  });
}
function responsive(plot, draw) {
  let previous = -1;
  const repaint = () => {
    if (!plot.isConnected || !plot.getClientRects().length) return;
    const width = Math.max(250, Math.min(1100, Math.round(plot.clientWidth || 650)));
    if (width === previous) return;
    previous = width;
    draw(width);
  };
  repaint();
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(repaint);
    observer.observe(plot);
    return () => observer.disconnect();
  }
  window.addEventListener('resize', repaint);
  return () => window.removeEventListener('resize', repaint);
}
function ticks(minimum, maximum, narrow = false) {
  const values = [];
  for (let power = Math.floor(Math.log10(minimum)); power <= Math.ceil(Math.log10(maximum)); power++) {
    [1, 2, 5].forEach(factor => {
      const value = factor * 10 ** power;
      if (value >= minimum && value <= maximum) values.push(value);
    });
  }
  return narrow && values.length > 5 ? values.filter((_, index) => index % 2 === 0) : values;
}
function overlap(a, b) {
  return a.x < b.x + b.width + 5 && a.x + a.width + 5 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
}
function drawPoints(svg, positions, bounds, select, occupied = []) {
  const context = document.createElement('canvas').getContext('2d');
  if (context) context.font = `600 13px ${getComputedStyle(svg).fontFamily || getComputedStyle(document.body).fontFamily}`;
  occupied.push(...positions.map(point => ({ x: point.x - 9, y: point.y - 9, width: 18, height: 18 })));
  [...positions].sort((a, b) => a.y - b.y || a.x - b.x).forEach(point => {
    const width = Math.min(bounds.right - bounds.left - 8, Math.ceil(context ? context.measureText(point.label).width : point.label.length * 7.8) + 10);
    const height = 23;
    const fits = box => box.x >= bounds.left + 2 && box.x + box.width <= bounds.right - 2 && box.y >= bounds.top + 2 && box.y + box.height <= bounds.bottom - 2 && !occupied.some(item => overlap(box, item));
    const candidates = [];
    [-29, 14, -58, 43, -87, 72].forEach(dy => candidates.push({ x: point.x + 12, y: point.y + dy, width, height }, { x: point.x - width - 12, y: point.y + dy, width, height }));
    let box = candidates.find(fits);
    if (!box) {
      let best = Infinity;
      for (let by = bounds.top + 3; by + height < bounds.bottom - 3; by += 5) {
        for (let bx = bounds.left + 3; bx + width < bounds.right - 3; bx += 6) {
          const candidate = { x: bx, y: by, width, height };
          const distance = Math.abs(bx + width / 2 - point.x) + Math.abs(by + height / 2 - point.y) * 1.3;
          if (distance < best && fits(candidate)) { box = candidate; best = distance; }
        }
      }
    }
    box ||= { x: Math.max(bounds.left + 2, Math.min(bounds.right - width - 2, point.x - width / 2)), y: Math.max(bounds.top + 2, Math.min(bounds.bottom - height - 2, point.y + 12)), width, height };
    occupied.push(box);
    line(svg, point.x, point.y, Math.max(box.x, Math.min(box.x + width, point.x)), Math.max(box.y, Math.min(box.y + height, point.y)), { stroke: 'var(--accent)', opacity: .55 });
    const group = add(svg, 'g', { 'data-model-id': point.id });
    add(group, 'circle', { cx: point.x, cy: point.y, r: 16, fill: 'transparent' });
    if (point.inZone) add(group, 'circle', { cx: point.x, cy: point.y, r: 11, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 });
    add(group, 'circle', { cx: point.x, cy: point.y, r: 6, fill: point.estimate ? 'var(--surface)' : 'var(--accent)', stroke: 'var(--accent)', 'stroke-width': 2 });
    add(group, 'rect', { x: box.x, y: box.y, width, height, rx: 3, fill: 'var(--surface)', class: 'compact-chart-label-background' });
    text(group, box.x + 5, box.y + 16, point.label, { fill: 'var(--text)', 'font-weight': 600, class: 'compact-chart-label' });
    interact(group, point.description, () => select(point));
  });
}
function scatter(host, options) {
  const plot = html('div', 'compact-chart-plot');
  host.append(plot);
  const show = inspector(host);
  host.append(html('p', 'compact-chart-caption', options.caption));
  if (!options.points.length) {
    plot.append(html('p', '', 'Not found: no comparable score and price pairs.'));
    return () => {};
  }
  return responsive(plot, width => {
    const narrow = width < 550;
    const height = narrow ? options.mobileHeight || 430 : options.height || 340;
    const bounds = { left: narrow ? 42 : 54, right: width - 12, top: 40, bottom: height - 61 };
    const minimum = options.minX ?? Math.min(...options.points.map(point => point.x)) / 1.2;
    const maximum = options.maxX ?? Math.max(...options.points.map(point => point.x)) * 1.35;
    const minY = options.minY ?? 0, maxY = options.maxY;
    const x = value => bounds.left + (Math.log10(value) - Math.log10(minimum)) / (Math.log10(maximum) - Math.log10(minimum)) * (bounds.right - bounds.left);
    const y = value => bounds.bottom - (value - minY) / (maxY - minY) * (bounds.bottom - bounds.top);
    const svg = svgRoot(width, height, options.title, options.description);
    const occupied = [];
    if (options.zone) {
      const zoneRight = Math.min(bounds.right, x(options.zone.maxPrice)), zoneBottom = Math.min(bounds.bottom, y(options.zone.minScore));
      if (zoneRight > bounds.left && zoneBottom > bounds.top) add(svg, 'rect', { x: bounds.left, y: bounds.top, width: zoneRight - bounds.left, height: zoneBottom - bounds.top, fill: 'var(--accent)', 'fill-opacity': .06, stroke: 'var(--accent)', 'stroke-dasharray': '5 4', class: 'compact-value-zone' });
    }
    ticks(minimum, maximum, narrow).forEach(tick => {
      line(svg, x(tick), bounds.top, x(tick), bounds.bottom);
      text(svg, x(tick), bounds.bottom + 24, options.xTick ? options.xTick(tick) : money(tick), { 'text-anchor': 'middle' });
    });
    for (let tick = minY; tick <= maxY; tick += options.yStep || 20) {
      line(svg, bounds.left, y(tick), bounds.right, y(tick));
      text(svg, bounds.left - 8, y(tick) + 4, options.yTick ? options.yTick(tick) : number(tick), { 'text-anchor': 'end' });
    }
    text(svg, bounds.left, 20, options.yLabel, { fill: 'var(--text)' });
    text(svg, (bounds.left + bounds.right) / 2, height - 14, options.xLabel, { 'text-anchor': 'middle' });
    if (options.frontier?.length > 1) add(svg, 'polyline', { points: options.frontier.map(point => `${x(point.x)},${y(point.y)}`).join(' '), stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', fill: 'none' });
    options.points.filter(point => finite(point.ciLow) && finite(point.ciHigh)).forEach(point => {
      line(svg, x(point.x), y(point.ciLow), x(point.x), y(point.ciHigh), { stroke: 'var(--accent)', 'stroke-width': 1.5 });
      [point.ciLow, point.ciHigh].forEach(value => line(svg, x(point.x) - 4, y(value), x(point.x) + 4, y(value), { stroke: 'var(--accent)' }));
    });
    drawPoints(svg, options.points.map(point => ({ ...point, x: x(point.x), y: y(point.y) })), bounds, point => show(point.name, point.rows, point.note), occupied);
    plot.replaceChildren(svg);
  });
}

function coding(host, data) {
  const short = { glm: 'GLM Flash', deepseek: 'DeepSeek Flash max', mimo: 'MiMo Pro', qwen: 'Qwen Max 0902', kimi: 'Kimi K3 max', minimax: 'MiniMax M3', sol_medium: 'Sol medium', sol_max: 'Sol max', opus: 'Opus max + fallback' };
  const points = data.models.filter(model => finite(model.tb4_percent) && model.tb4_api_usd_per_attempt > 0).map(model => ({ id: model.id, name: model.model, label: short[model.id] || model.model, x: model.tb4_api_usd_per_attempt, y: model.tb4_percent, rows: [
    { title: 'Terminal-Bench 4.0', value: `${raw(model.tb4_percent)}%`, status: model.type },
    { title: 'Cost per attempt', value: `$${raw(model.tb4_api_usd_per_attempt)}`, status: model.type }
  ], description: `${model.model}: ${number(model.tb4_percent)}% tasks solved; ${money(model.tb4_api_usd_per_attempt)} per attempt.` }));
  const estimate = data.chart_estimates?.deepseek_offpeak;
  const original = data.models.find(model => model.id === estimate?.model_id);
  if (estimate && original) points.push({ id: 'deepseek-offpeak', name: `${original.model} — off-peak estimate`, label: 'DeepSeek off-peak*', x: estimate.tb4_api_usd_per_attempt, y: estimate.tb4_percent, estimate: true, note: estimate.note, rows: [
    { title: 'Terminal-Bench 4.0', value: `${raw(estimate.tb4_percent)}%`, status: 'verified' },
    { title: 'Estimated cost per attempt', value: `$${raw(estimate.tb4_api_usd_per_attempt)}`, status: estimate.type }
  ], description: `${original.model}: calculated off-peak estimate ${money(estimate.tb4_api_usd_per_attempt)}; unchanged ${number(estimate.tb4_percent)}% score, not a benchmark rerun.` });
  return scatter(host, { points, title: 'How many coding tasks get solved?', description: 'Terminal-Bench 4.0 versus API cost per attempt in the common mini-swe-agent harness; direct model labels include effort settings.', xLabel: 'USD per attempt · log scale', yLabel: 'Terminal-Bench 4.0 (%) ↑', yTick: value => `${value}%`, maxY: 70, yStep: 20, minX: .3, maxX: 25, height: 320, mobileHeight: 460, caption: 'Common mini-swe-agent harness; costs include failed attempts, and the hollow point estimates DeepSeek off-peak pricing.' });
}
function intelligence(host, data) {
  const zone = data.value_zone || data.chart_settings?.value_zone;
  const points = data.models.filter(model => model.kind === 'llm' && finite(model.metrics?.ii?.value) && model.metrics?.blended?.value > 0).map(model => {
    const score = model.metrics.ii, price = model.metrics.blended;
    return { id: model.id, name: model.name, label: model.chartLabel || model.name, x: price.value, y: score.value, estimate: ['estimate', 'estimated'].includes(score.type), inZone: zone && score.value >= zone.intelligence_min && price.value <= zone.blended_price_max, rows: [
      { title: 'Intelligence Index', value: raw(score.value), status: score.type },
      { title: 'Blended USD/M', value: `$${raw(price.value)}`, status: price.type }
    ], note: '(3 × uncached input + output) / 4; excludes cache, context uplifts and tool fees.', description: `${model.name}: Intelligence Index ${number(score.value)}; ${money(price.value)} per million blended tokens.` };
  });
  return scatter(host, { points, title: 'What does intelligence cost?', description: 'Intelligence Index versus a three-input to one-output token price blend, with an illustrative value zone.', xLabel: 'Blended USD/M · log scale', yLabel: 'Intelligence Index ↑', maxY: 70, yStep: 20, height: 350, mobileHeight: 460, zone: zone ? { maxPrice: zone.blended_price_max, minScore: zone.intelligence_min } : null, caption: zone ? `Value zone: Intelligence Index of ${number(zone.intelligence_min)} or more, and blended price of $${number(zone.blended_price_max)}/M or less (illustrative thresholds).` : 'Higher Intelligence Index and lower blended price are preferable.' });
}
function arena(host, data) {
  const derived = deriveCodingData(data), zone = data.chart_settings?.arena_value_zone;
  const points = derived.arenaPoints.map(model => ({ id: model.id, name: model.name, label: model.chart_label || model.name, x: model.x, y: model.y, inZone: zone && model.y >= zone.min_score && model.x <= zone.max_price, rows: [
    { title: 'Arena WebDev score', value: raw(model.y), status: model.metrics.arena_score.label },
    { title: 'Arena blended USD/M', value: `$${raw(model.x)}`, status: model.metrics.arena_price.label }
  ], description: `${model.name}: Arena WebDev ${number(model.y)}; ${money(model.x)} per million blended tokens.` }));
  const minY = points.length ? Math.floor((Math.min(...points.map(point => point.y), zone?.min_score || Infinity) - 35) / 50) * 50 : 0;
  const maxY = points.length ? Math.ceil((Math.max(...points.map(point => point.y)) + 35) / 50) * 50 : 50;
  return scatter(host, { points, title: 'Web development quality at what price?', description: 'Current Arena WebDev score versus its published token-price blend; historical entries are excluded.', xLabel: 'Arena blended USD/M · log scale', yLabel: 'Arena WebDev points ↑', minY, maxY, yStep: 50, height: 300, mobileHeight: 340, frontier: derived.frontierPoints, zone: zone ? { maxPrice: zone.max_price, minScore: zone.min_score } : null, caption: 'Arena weights one input to three output tokens; older snapshots are excluded, and the dashed frontier covers these models.' });
}
function gaps(host, data) {
  const derived = deriveCodingData(data);
  const points = derived.gaps.map(model => ({ id: model.id, name: model.name, label: model.chart_label || model.name, x: model.priceRatio * 100, y: model.scoreGap, rows: [
    { title: 'Arena points below Opus', value: raw(model.scoreGap), status: 'calculated' },
    { title: 'Share of Opus price', value: `${raw(model.priceRatio * 100)}%`, status: 'calculated' },
    { title: 'Opus price / model price', value: `${raw(model.cheaperBy)}×`, status: 'calculated' }
  ], description: `${model.name}: ${number(model.scoreGap)} Arena points below Opus at ${number(model.priceRatio * 100)}% of its blended token price.` }));
  const maxY = points.length ? Math.max(50, Math.ceil((Math.max(...points.map(point => point.y)) + 20) / 50) * 50) : 50;
  return scatter(host, { points, title: 'How much quality do lower prices give up?', description: 'Calculated Arena score gaps and token-price shares relative to Opus; neither is a percentage of coding ability.', xLabel: 'Share of Opus price (%) · log scale', yLabel: 'Arena points below Opus ↓', xTick: value => `${number(value)}%`, maxX: 115, maxY, yStep: 50, height: 290, mobileHeight: 330, caption: 'Smaller Arena gaps and price shares are preferable; these ratios compare token prices, not completed-task costs.' });
}
function video(host, data) {
  const points = data.models.filter(model => model.kind === 'video' && finite(model.metrics?.elo?.value) && model.metrics?.priceSecond?.value > 0).map(model => ({
    id: model.id, name: model.name, label: model.chartLabel || model.name, x: model.metrics.priceSecond.value, y: model.metrics.elo.value,
    ciLow: model.metrics.ciLow?.value, ciHigh: model.metrics.ciHigh?.value,
    rows: [
      { title: 'Video Arena Elo', value: raw(model.metrics.elo.value), status: model.metrics.elo.type },
      { title: 'USD per generated second', value: `$${raw(model.metrics.priceSecond.value)}`, status: model.metrics.priceSecond.type },
      ...(finite(model.metrics.ciLow?.value) && finite(model.metrics.ciHigh?.value) ? [
        { title: 'Lower 95% bound', value: raw(model.metrics.ciLow.value), status: model.metrics.ciLow.type },
        { title: 'Upper 95% bound', value: raw(model.metrics.ciHigh.value), status: model.metrics.ciHigh.type }
      ] : [])
    ], description: `${model.name}: Video Arena Elo ${number(model.metrics.elo.value)}; ${money(model.metrics.priceSecond.value)} per generated second.`
  }));
  const minY = points.length ? Math.floor((Math.min(...points.map(point => point.ciLow || point.y)) - 25) / 50) * 50 : 0;
  const maxY = points.length ? Math.ceil((Math.max(...points.map(point => point.ciHigh || point.y)) + 25) / 50) * 50 : 50;
  return scatter(host, { points, title: 'Video quality at what price?', description: 'Text-to-video preference scores for clips with audio versus generated-second price, with 95% confidence bounds.', xLabel: 'USD per generated second · log scale', yLabel: 'Video Arena Elo ↑', minY, maxY, yStep: 50, height: 300, mobileHeight: 340, caption: 'AA-Video-T2V with audio; vertical lines show 95% confidence bounds, and video preference is separate from LLM intelligence.' });
}
function monthly(host, data) {
  const scenarios = data.monthly_costs || [];
  if (!scenarios.length) return () => {};
  const controls = html('div', 'compact-chart-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Monthly workload');
  const plot = html('div', 'compact-chart-plot');
  host.append(controls, plot);
  const show = inspector(host);
  host.append(html('p', 'compact-chart-caption', 'Illustrative equal-token workloads; plan bars show off-peak eligibility, and tool fees and taxes are excluded.'));
  let selected = 0, currentWidth = 650;
  const buttons = scenarios.map((scenario, index) => {
    const button = html('button', '', scenario.label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === selected));
    button.addEventListener('click', () => {
      selected = index;
      buttons.forEach((item, position) => item.setAttribute('aria-pressed', String(position === selected)));
      draw(currentWidth);
      show(`${scenario.label} workload`, [
        { title: 'Uncached input', value: `${raw(scenario.uncached_input_millions)}M`, status: 'calculated' },
        { title: 'Cached input', value: `${raw(scenario.cached_input_millions)}M`, status: 'calculated' },
        { title: 'Output', value: `${raw(scenario.output_millions)}M`, status: 'calculated' }
      ], 'Output includes reasoning; heavy use aggregates parallel agents.');
    });
    controls.append(button);
    return button;
  });
  const draw = width => {
    currentWidth = width;
    const scenario = scenarios[selected], narrow = width < 550;
    const series = [
      { label: ['GLM', 'API'], value: scenario.glm_api_usd, name: 'GLM pay-as-you-go API' },
      { label: ['DeepSeek', 'off-peak'], value: scenario.deepseek_offpeak_usd, name: 'DeepSeek API · off-peak' },
      { label: ['DeepSeek', 'peak'], value: scenario.deepseek_peak_usd, name: 'DeepSeek API · peak' },
      { label: ['Z.ai', scenario.glm_offpeak_plan], value: scenario.glm_offpeak_plan_usd, name: `Z.ai ${scenario.glm_offpeak_plan} · off-peak eligibility` },
      { label: ['OpenCode', scenario.go_glm_plan], value: scenario.go_glm_plan_usd, name: `OpenCode ${scenario.go_glm_plan} · GLM only` }
    ];
    const height = narrow ? 265 : 270;
    const bounds = { left: 48, right: width - 8, top: 35, bottom: height - 65 };
    const largest = Math.max(...series.map(item => item.value));
    const rawStep = largest / 4, magnitude = 10 ** Math.floor(Math.log10(rawStep)), step = Math.ceil(rawStep / magnitude) * magnitude;
    const maximum = Math.ceil(largest / step) * step;
    if (narrow) {
      const left = 130, right = width - 67, top = 32, bottom = height - 35;
      const x = value => left + value / maximum * (right - left);
      const svg = svgRoot(width, height, `${scenario.label}: monthly costs`, 'Horizontal bars compare the same illustrative API and subscription monthly costs; focus or tap a row to inspect its amount.');
      for (let tick = 0; tick <= maximum + step / 100; tick += step * 2) {
        line(svg, x(tick), top, x(tick), bottom);
        text(svg, x(tick), bottom + 24, `$${number(tick)}`, { 'text-anchor': 'middle' });
      }
      text(svg, left, 18, 'Monthly USD', { fill: 'var(--text)' });
      const labels = ['GLM API', 'DeepSeek off-peak', 'DeepSeek peak', `Z.ai ${scenario.glm_offpeak_plan}`, `OpenCode ${scenario.go_glm_plan}`];
      series.forEach((item, index) => {
        const y = top + 8 + index * (bottom - top - 12) / series.length;
        const group = add(svg, 'g', {});
        add(group, 'rect', { x: 0, y: y - 6, width, height: 34, fill: 'transparent' });
        const barWidth = Math.max(3, x(item.value) - left);
        add(group, 'rect', { x: left, y, width: barWidth, height: 19, rx: 3, fill: 'var(--accent)' });
        text(group, left - 8, y + 14, labels[index], { 'text-anchor': 'end', fill: 'var(--text)' });
        calculatedDot(group, left + barWidth + 7, y + 10);
        text(group, left + barWidth + 15, y + 14, `$${Number(item.value).toFixed(2)}`, { fill: 'var(--text)', 'font-weight': 600 });
        interact(group, `${item.name}: ${money(item.value)} per month in the ${scenario.label.toLowerCase()} scenario. Calculated.`, () => show(item.name, [{ title: `${scenario.label} monthly cost`, value: `$${raw(item.value)}`, status: 'calculated' }], 'Equal token volumes; completed-task costs can differ.'));
      });
      plot.replaceChildren(svg);
      return;
    }
    const y = value => bounds.bottom - value / maximum * (bounds.bottom - bounds.top);
    const svg = svgRoot(width, height, `${scenario.label}: monthly costs`, 'Five bars show the existing illustrative API and subscription cost scenario; switch Light, Medium and Heavy with the controls.');
    for (let tick = 0; tick <= maximum + step / 100; tick += step) {
      line(svg, bounds.left, y(tick), bounds.right, y(tick));
      text(svg, bounds.left - 8, y(tick) + 4, `$${number(tick)}`, { 'text-anchor': 'end' });
    }
    const slot = (bounds.right - bounds.left) / series.length;
    series.forEach((item, index) => {
      const barWidth = slot * .52, x = bounds.left + slot * index + slot * .24;
      const barHeight = Math.max(3, item.value / maximum * (bounds.bottom - bounds.top));
      const group = add(svg, 'g', {});
      add(group, 'rect', { x: bounds.left + index * slot + 1, y: bounds.top, width: slot - 2, height: bounds.bottom - bounds.top + 48, fill: 'transparent' });
      add(group, 'rect', { x, y: bounds.bottom - barHeight, width: barWidth, height: barHeight, rx: 3, fill: 'var(--accent)' });
      text(group, x + barWidth / 2, bounds.bottom - barHeight - 8, `$${Number(item.value).toFixed(2)}`, { 'text-anchor': 'middle', fill: 'var(--text)', 'font-weight': 600 });
      calculatedDot(group, x + barWidth / 2 + (`$${Number(item.value).toFixed(2)}`.length * 3.7) + 8, bounds.bottom - barHeight - 12);
      item.label.forEach((part, position) => text(group, x + barWidth / 2, bounds.bottom + 22 + position * 18, part, { 'text-anchor': 'middle' }));
      interact(group, `${item.name}: ${money(item.value)} per month in the ${scenario.label.toLowerCase()} scenario. Calculated.`, () => show(item.name, [{ title: `${scenario.label} monthly cost`, value: `$${raw(item.value)}`, status: 'calculated' }], 'Equal token volumes; completed-task costs can differ.'));
    });
    text(svg, bounds.left, 18, 'Monthly USD', { fill: 'var(--text)' });
    plot.replaceChildren(svg);
  };
  return responsive(plot, draw);
}

export function renderCompactCharts(reportData, codingData, unifiedData) {
  const cleanups = [];
  for (const [id, render, data] of [['coding-chart', coding, reportData], ['llm-value-chart', intelligence, unifiedData], ['coding-arena-chart', arena, codingData], ['coding-gap-chart', gaps, codingData], ['video-value-chart', video, unifiedData], ['cost-chart', monthly, reportData]]) {
    const host = document.getElementById(id);
    if (!host) continue;
    host.replaceChildren();
    host.classList.add('compact-chart');
    cleanups.push(render(host, data));
  }
  return () => cleanups.forEach(cleanup => cleanup?.());
}
