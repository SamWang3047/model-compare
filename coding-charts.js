/* Coding-only SVG charts. Values, thresholds and source dates come from coding.json. */
import { deriveCodingData } from './coding-data.js';

const NS = 'http://www.w3.org/2000/svg';
const mounted = new WeakMap();
let sequence = 0;
const numeric = value => typeof value === 'number' && Number.isFinite(value);
const decimal = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = value => `$${decimal(value)}`;
const date = value => {
  if (!value) return 'Not found';
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const status = value => ({ verified: 'Verified', vendor_reported: 'Vendor reported', third_party: 'Third party', calculated: 'Calculated', not_found: 'Not found' }[value] || 'Not found');
const label = model => model.chart_label || model.name;
const settings = data => data.chart_settings || data;

function html(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgNode(parent, tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}
function text(parent, x, y, value, attrs = {}) {
  return svgNode(parent, 'text', { x, y, fill: 'var(--muted)', 'font-size': 12, ...attrs }, value);
}
function line(parent, x1, y1, x2, y2, attrs = {}) {
  return svgNode(parent, 'line', { x1, y1, x2, y2, stroke: 'var(--chart-grid)', ...attrs });
}
function root(width, height, title, description) {
  const id = `coding-chart-${++sequence}`;
  const svg = svgNode(null, 'svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-labelledby': `${id}-title ${id}-description`, class: 'company-chart-svg' });
  svgNode(svg, 'title', { id: `${id}-title` }, title);
  svgNode(svg, 'desc', { id: `${id}-description` }, description);
  return svg;
}
function sources(fact) {
  return [...new Set([fact?.source_url, ...(fact?.source_urls || [])].filter(Boolean))];
}
function evidence(fact) {
  const node = html('div', 'company-chart-provenance');
  const age = fact?.older_snapshot ? ' · Older snapshot' : '';
  node.append(html('span', '', `${status(fact?.label)}${age} · Snapshot: ${date(fact?.snapshot_date)} · Retrieved: ${date(fact?.retrieved_date)}`));
  sources(fact).forEach((url, index) => {
    const link = html('a', '', `Source${index ? ` ${index + 1}` : ''} ↗`);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    node.append(link);
  });
  return node;
}
function precision(fact, format) {
  if (!numeric(fact?.value)) return '';
  return format === money ? `Source precision: $${String(fact.value)}/M.` : `Source precision: ${String(fact.value)}${fact.unit ? ` ${fact.unit}` : ''}.`;
}
function factRow(title, fact, format = decimal, rawNote) {
  const row = html('div', 'company-chart-tooltip-row');
  row.append(html('strong', '', `${title}: ${numeric(fact?.value) ? format(fact.value) : 'Not found'}`), evidence(fact));
  if (numeric(fact?.value)) row.append(html('span', 'company-chart-metric-note', rawNote || precision(fact, format)));
  if (fact?.note) row.append(html('span', 'company-chart-metric-note', fact.note));
  return row;
}
function inspector(host) {
  const box = html('div', 'company-chart-tooltip');
  box.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-atomic', 'true');
  box.append(html('p', '', 'Hover, focus or tap a model to inspect its values, calculations, dates and sources.'));
  host.append(box);
  return (model, rows) => {
    box.replaceChildren(html('strong', 'company-chart-tooltip-title', model.name));
    rows.forEach(row => box.append(row));
  };
}
function interaction(mark, accessibleLabel, select) {
  mark.classList.add('company-chart-mark');
  mark.setAttribute('tabindex', '0');
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', accessibleLabel);
  svgNode(mark, 'title', {}, accessibleLabel);
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
function controls(host, points, select) {
  const buttons = html('div', 'chart-controls');
  buttons.setAttribute('role', 'group');
  buttons.setAttribute('aria-label', 'Inspect model evidence');
  points.forEach(model => {
    const button = html('button', '', label(model));
    button.type = 'button';
    button.dataset.modelId = model.id;
    button.addEventListener('click', () => select(model));
    buttons.append(button);
  });
  host.append(buttons);
}
function responsive(plot, draw) {
  let last = -1;
  const repaint = () => {
    if (!plot.isConnected) return;
    const width = Math.max(220, Math.min(1100, Math.round(plot.clientWidth || 650)));
    if (last === width) return;
    last = width;
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
function table(host, models, columns, title) {
  const details = html('details', 'company-chart-data-details');
  details.append(html('summary', '', 'Chart data, dates and sources'));
  const scroller = html('div', 'table-scroll company-chart-table-scroll');
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', title);
  const table = html('table');
  table.append(html('caption', '', title));
  const head = html('thead'), header = html('tr');
  ['Model', ...columns.map(column => column.title)].forEach(title => {
    const cell = html('th', '', title);
    cell.scope = 'col';
    header.append(cell);
  });
  head.append(header);
  const body = html('tbody');
  models.forEach(model => {
    const row = html('tr', model.baseline ? 'company-chart-baseline-row' : '');
    const name = html('th', '', model.name);
    name.scope = 'row';
    row.append(name);
    columns.forEach(column => {
      const cell = html('td');
      cell.append(factRow(column.title, column.fact(model), column.format, column.raw?.(model)));
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  scroller.append(table);
  details.append(scroller);
  host.append(details);
}
function logTicks(min, max, narrow) {
  const values = [];
  for (let power = Math.floor(Math.log10(min)); power <= Math.ceil(Math.log10(max)); power++) {
    [1, 2, 5].forEach(factor => {
      const value = factor * 10 ** power;
      if (value >= min && value <= max) values.push(value);
    });
  }
  return narrow && values.length > 5 ? values.filter((_, index) => index % 2 === 0) : values;
}
function overlap(a, b) {
  return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
}
function drawPoints(svg, plot, positions, bounds, occupied, narrow, select, aria, isZone = () => false) {
  const fontSize = narrow ? 11 : 12;
  const context = document.createElement('canvas').getContext('2d');
  if (context) context.font = `${fontSize}px ${getComputedStyle(plot).fontFamily}`;
  occupied.push(...positions.map(p => ({ x: p.x - 11, y: p.y - 11, width: 22, height: 22 })));
  positions.sort((a, b) => a.y - b.y || a.x - b.x).forEach(position => {
    const { model, x: cx, y: cy } = position;
    const name = label(model);
    const labelWidth = Math.min(bounds.right - bounds.left - 6, Math.ceil(context ? context.measureText(name).width : name.length * fontSize * .57) + 12);
    const labelHeight = 22;
    const valid = candidate => candidate.x >= bounds.left + 2 && candidate.x + candidate.width <= bounds.right - 2 && candidate.y >= bounds.top + 2 && candidate.y + candidate.height <= bounds.bottom - 2 && !occupied.some(item => overlap(candidate, item));
    const candidates = [];
    [-40, 16, -66, 42, -92, 68].forEach(dy => {
      candidates.push({ x: cx + 13, y: cy + dy, width: labelWidth, height: labelHeight }, { x: cx - labelWidth - 13, y: cy + dy, width: labelWidth, height: labelHeight });
    });
    let box = candidates.find(valid);
    if (!box) {
      let best = Infinity;
      for (let y = bounds.top + 3; y + labelHeight < bounds.bottom - 3; y += 6) {
        for (let x = bounds.left + 3; x + labelWidth < bounds.right - 3; x += 7) {
          const candidate = { x, y, width: labelWidth, height: labelHeight };
          const distance = Math.abs(x + labelWidth / 2 - cx) + Math.abs(y + labelHeight / 2 - cy) * 1.2;
          if (distance < best && valid(candidate)) { box = candidate; best = distance; }
        }
      }
    }
    box ||= { x: Math.max(bounds.left, Math.min(bounds.right - labelWidth, cx - labelWidth / 2)), y: Math.max(bounds.top, Math.min(bounds.bottom - labelHeight, cy + 15)), width: labelWidth, height: labelHeight };
    occupied.push(box);
    line(svg, cx, cy, Math.max(box.x, Math.min(box.x + box.width, cx)), Math.max(box.y, Math.min(box.y + box.height, cy)), { stroke: 'var(--accent)', opacity: .6 });
    const group = svgNode(svg, 'g', { 'data-model-id': model.id });
    svgNode(group, 'circle', { cx, cy, r: 18, fill: 'transparent' });
    if (isZone(model)) svgNode(group, 'circle', { cx, cy, r: 11, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, class: 'company-value-ring' });
    svgNode(group, model.baseline ? 'rect' : 'circle', model.baseline ? { x: cx - 6, y: cy - 6, width: 12, height: 12, rx: 1, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 } : { cx, cy, r: 6.5, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 });
    svgNode(group, 'rect', { x: box.x, y: box.y, width: box.width, height: box.height, rx: 4, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': .7, class: 'company-point-label-box' });
    text(group, box.x + 6, box.y + 15, name, { fill: 'var(--text)', 'font-size': fontSize, 'font-weight': 600, class: 'company-point-label' });
    interaction(group, aria(model), () => select(model));
  });
}
function arena(host, data, derived) {
  const models = data.models || [], points = derived.arenaPoints;
  if (!points.length) {
    host.append(html('p', 'company-chart-note', 'Not found: no current, sourced Arena score and price pairs are available.'));
    return () => {};
  }
  const plot = html('div', 'company-chart-plot');
  host.append(plot);
  const show = inspector(host);
  const select = model => show(model, [factRow('Arena WebDev score', model.metrics.arena_score), factRow('Arena blended USD per 1M tokens', model.metrics.arena_price, money)]);
  controls(host, points, select);
  const config = settings(data), zone = config.arena_value_zone;
  const hasZone = numeric(zone?.min_score) && numeric(zone?.max_price) && zone.max_price > 0;
  const inZone = model => hasZone && model.metrics.arena_score.value >= zone.min_score && model.metrics.arena_price.value <= zone.max_price;
  if (hasZone) {
    const summary = html('div', 'company-value-zone-summary');
    summary.append(html('p', '', `Illustrative value zone: Arena score ≥ ${decimal(zone.min_score)} and Arena blended price ≤ ${money(zone.max_price)}/M.`), html('p', 'company-chart-zone-note', zone.note || 'Illustrative screening rule; not a measured benchmark.'));
    host.append(summary);
  }
  const excluded = models.filter(model => !points.some(point => point.id === model.id));
  if (excluded.length) host.append(html('p', 'company-chart-note', `Excluded from the current plot: ${excluded.map(model => `${label(model)} (${model.metrics?.arena_score?.older_snapshot || model.metrics?.arena_price?.older_snapshot ? 'older snapshot' : 'score or price not found'})`).join('; ')}.`));
  host.append(html('p', 'company-chart-note', 'Arena blends 1 input : 3 output tokens. The dashed line is the frontier among the selected models, not the global Arena frontier. Higher score and lower price are preferable. Plots and calculations use raw values; display is rounded to one decimal.'));
  table(host, models, [{ title: 'Arena WebDev score', fact: model => model.metrics?.arena_score, format: decimal }, { title: 'Arena blended USD/M', fact: model => model.metrics?.arena_price, format: money }], 'Arena WebDev evidence — historical entries are labelled and excluded from the current plot');
  return responsive(plot, width => {
    const narrow = width < 500, height = narrow ? 450 : 410;
    const bounds = { left: narrow ? 49 : 61, right: width - 16, top: 37, bottom: height - 65 };
    const prices = points.map(model => model.x), scores = points.map(model => model.y);
    const minLog = Math.log10(Math.min(...prices)) - .2, maxLog = Math.log10(Math.max(...prices)) + .17;
    const minY = Math.floor((Math.min(...scores, ...(hasZone ? [zone.min_score] : [])) - 35) / 50) * 50;
    const maxY = Math.ceil((Math.max(...scores) + 35) / 50) * 50;
    const x = value => bounds.left + (Math.log10(value) - minLog) / (maxLog - minLog) * (bounds.right - bounds.left);
    const y = value => bounds.bottom - (value - minY) / (maxY - minY) * (bounds.bottom - bounds.top);
    const svg = root(width, height, 'Coding performance and Arena token price', 'Arena WebDev preference scores versus logarithmic blended price. Direct model labels, keyboard and touch controls, and sourced data follow.');
    const occupied = [];
    if (hasZone && zone.max_price >= 10 ** minLog && zone.min_score <= maxY) {
      const right = Math.min(bounds.right, x(zone.max_price)), bottom = Math.min(bounds.bottom, y(zone.min_score));
      if (right > bounds.left && bottom > bounds.top) {
        svgNode(svg, 'rect', { x: bounds.left, y: bounds.top, width: right - bounds.left, height: bottom - bounds.top, fill: 'var(--accent)', 'fill-opacity': .06, stroke: 'var(--accent)', 'stroke-dasharray': '5 4', class: 'company-value-zone' });
        text(svg, bounds.left + 8, bounds.top + 17, 'Illustrative value zone', { fill: 'var(--accent)', 'font-size': narrow ? 10 : 12, 'font-weight': 600 });
        occupied.push({ x: bounds.left + 5, y: bounds.top + 4, width: narrow ? 118 : 144, height: 20 });
      }
    }
    logTicks(10 ** minLog, 10 ** maxLog, narrow).forEach(tick => {
      line(svg, x(tick), bounds.top, x(tick), bounds.bottom);
      text(svg, x(tick), bounds.bottom + 23, money(tick), { 'text-anchor': 'middle', 'font-size': narrow ? 10.5 : 12 });
    });
    for (let tick = minY; tick <= maxY; tick += 50) {
      line(svg, bounds.left, y(tick), bounds.right, y(tick));
      text(svg, bounds.left - 8, y(tick) + 4, decimal(tick), { 'text-anchor': 'end', 'font-size': narrow ? 10.5 : 12 });
    }
    text(svg, bounds.left, 18, 'Arena WebDev score ↑', { fill: 'var(--text)', 'font-size': 12 });
    text(svg, (bounds.left + bounds.right) / 2, height - 15, 'Arena blended USD / 1M tokens · log scale', { 'text-anchor': 'middle', 'font-size': narrow ? 9.5 : 12 });
    const frontier = derived.frontierPoints;
    if (frontier.length > 1) {
      const path = svgNode(svg, 'polyline', { points: frontier.map(model => `${x(model.x)},${y(model.y)}`).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.8, 'stroke-dasharray': '6 5', opacity: .65, class: 'coding-selected-frontier' });
      svgNode(path, 'title', {}, 'Frontier among selected models');
    }
    drawPoints(svg, plot, points.map(model => ({ model, x: x(model.x), y: y(model.y) })), bounds, occupied, narrow, select, model => `${model.name}. Arena WebDev score ${decimal(model.y)}. Arena blended price ${money(model.x)} per million tokens. Inspect exact values, dates and sources.`, inZone);
    plot.replaceChildren(svg);
  });
}
function gapFacts(model, baseline, data) {
  const price = model.metrics.arena_price.value, basePrice = baseline.metrics.arena_price.value;
  const score = model.metrics.arena_score.value, baseScore = baseline.metrics.arena_score.value;
  const derived = (value, unit, originals, note) => ({ value, unit, label: 'calculated', snapshot_date: originals[0].snapshot_date, retrieved_date: data.metadata?.updated_date, source_urls: [...new Set(originals.flatMap(sources))], note });
  return {
    gap: derived(model.scoreGap, 'Arena points', [baseline.metrics.arena_score, model.metrics.arena_score], `Formula: ${decimal(baseScore)} − ${decimal(score)} = ${decimal(model.scoreGap)} Arena points.`),
    ratio: derived(model.priceRatio * 100, '%', [baseline.metrics.arena_price, model.metrics.arena_price], `Formula: model price / Opus price × 100. Source precision: $${String(price)}/M / $${String(basePrice)}/M; raw price ratio ${String(model.priceRatio)}.`),
    inverse: derived(model.cheaperBy, '×', [baseline.metrics.arena_price, model.metrics.arena_price], `Formula: Opus price / model price. Source precision: $${String(basePrice)}/M / $${String(price)}/M = ${String(model.cheaperBy)}×.`)
  };
}
function gap(host, data, derived) {
  const points = derived.gaps, baseline = points[0]?.baseline;
  if (!points.length) {
    host.append(html('p', 'company-chart-note', 'Not found: no current models have comparable score and price pairs.'));
    return () => {};
  }
  const facts = new Map(points.map(model => [model.id, gapFacts(model, baseline, data)]));
  const plot = html('div', 'company-chart-plot');
  host.append(plot);
  const show = inspector(host);
  const select = model => {
    const f = facts.get(model.id);
    show(model, [factRow('Arena points below Opus', f.gap), factRow('Price as a share of Opus', f.ratio, value => `${decimal(value)}%`), factRow('Opus price / model price', f.inverse, value => `${decimal(value)}×`), factRow('Model Arena blended USD/M', model.metrics.arena_price, money), factRow('Opus Arena blended USD/M', baseline.metrics.arena_price, money), factRow('Model Arena WebDev score', model.metrics.arena_score), factRow('Opus Arena WebDev score', baseline.metrics.arena_score)]);
  };
  controls(host, points, select);
  host.append(html('p', 'company-chart-note', `Reference: ${baseline.name}. Smaller score gaps and lower price shares are preferable. Arena score gaps are preference points, not percentages of coding ability. Ratios compare Arena's token-price mix, not cost per completed task. Plots and calculations use raw values; display is rounded to one decimal.`));
  table(host, points, [{ title: 'Arena points below Opus', fact: model => facts.get(model.id).gap, format: decimal }, { title: 'Share of Opus price', fact: model => facts.get(model.id).ratio, format: value => `${decimal(value)}%` }, { title: 'Opus / model price', fact: model => facts.get(model.id).inverse, format: value => `${decimal(value)}×` }], 'Calculated coding-score gaps and Arena price ratios');
  return responsive(plot, width => {
    const narrow = width < 500, height = narrow ? 340 : 300;
    const bounds = { left: narrow ? 44 : 53, right: width - 17, top: 37, bottom: height - 61 };
    const ratios = points.map(model => facts.get(model.id).ratio.value), gaps = points.map(model => facts.get(model.id).gap.value);
    const minLog = Math.log10(Math.min(...ratios)) - .18, maxLog = Math.log10(Math.max(100, ...ratios)) + .06;
    const minY = Math.min(0, Math.floor((Math.min(...gaps) - 10) / 50) * 50), maxY = Math.max(50, Math.ceil((Math.max(...gaps) + 20) / 50) * 50);
    const x = value => bounds.left + (Math.log10(value) - minLog) / (maxLog - minLog) * (bounds.right - bounds.left);
    const y = value => bounds.bottom - (value - minY) / (maxY - minY) * (bounds.bottom - bounds.top);
    const svg = root(width, height, 'Price share and coding score gap relative to Opus', 'Calculated Arena score gaps and price ratios relative to Opus. Lower values on both axes are preferable. Direct model labels support keyboard and touch inspection.');
    logTicks(10 ** minLog, 10 ** maxLog, narrow).forEach(tick => {
      line(svg, x(tick), bounds.top, x(tick), bounds.bottom, tick === 100 ? { stroke: 'var(--accent)', 'stroke-dasharray': '4 4', opacity: .5 } : {});
      text(svg, x(tick), bounds.bottom + 22, `${decimal(tick)}%`, { 'text-anchor': 'middle', 'font-size': narrow ? 10 : 12 });
    });
    for (let tick = minY; tick <= maxY; tick += 50) {
      line(svg, bounds.left, y(tick), bounds.right, y(tick));
      text(svg, bounds.left - 8, y(tick) + 4, decimal(tick), { 'text-anchor': 'end', 'font-size': narrow ? 10 : 12 });
    }
    text(svg, bounds.left, 18, 'Arena points below Opus ↓', { fill: 'var(--text)', 'font-size': narrow ? 11 : 12 });
    text(svg, (bounds.left + bounds.right) / 2, height - 13, 'Share of Opus price · log scale · 100.0% = Opus', { 'text-anchor': 'middle', 'font-size': narrow ? 9 : 12 });
    drawPoints(svg, plot, points.map(model => ({ model, x: x(facts.get(model.id).ratio.value), y: y(facts.get(model.id).gap.value) })), bounds, [], narrow, select, model => { const f = facts.get(model.id); return `${model.name}. ${decimal(f.gap.value)} Arena points below Opus; ${decimal(f.ratio.value)} percent of Opus price. Inspect formulas, exact values, dates and sources.`; });
    plot.replaceChildren(svg);
  });
}

export function renderCodingCharts(data) {
  const cleanup = [], derived = deriveCodingData(data);
  [['coding-arena-chart', arena], ['coding-gap-chart', gap]].forEach(([id, render]) => {
    const host = document.getElementById(id);
    if (!host) return;
    mounted.get(host)?.();
    host.replaceChildren();
    host.classList.add('company-chart');
    const dispose = render(host, data, derived);
    mounted.set(host, dispose);
    cleanup.push(() => {
      dispose();
      if (mounted.get(host) === dispose) mounted.delete(host);
    });
  });
  return () => cleanup.forEach(dispose => dispose());
}
