/* Responsive SVG charts for companies.json. No model values are stored here. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const activeCharts = new WeakMap();
let chartNumber = 0;
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
const intelligence = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = value => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const dateLabel = value => {
  if (!value) return 'Date not found';
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const statusLabel = type => ({ verified: 'Verified', fact: 'Verified', observed: 'Verified observation', calculated: 'Calculated', derived: 'Calculated', inference: 'Inference', estimate: 'Estimate', estimated: 'Estimate', missing: 'Not found', not_found: 'Not found' }[type] || type || 'Report observation');
const snapshot = data => data.snapshot_date || data.snapshotDate || data.metadata?.snapshotDate || data.metadata?.lastUpdated || data.date;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgAdd(parent, tag, attributes = {}, text) {
  const node = svgElement(tag, attributes, text);
  parent.append(node);
  return node;
}
function svgText(parent, x, y, text, attributes = {}) {
  return svgAdd(parent, 'text', { x, y, fill: 'var(--muted)', 'font-size': 12, ...attributes }, text);
}
function svgLine(parent, x1, y1, x2, y2, attributes = {}) {
  return svgAdd(parent, 'line', { x1, y1, x2, y2, stroke: 'var(--chart-grid)', ...attributes });
}
function svgRoot(width, height, title, description) {
  const id = `companies-chart-${++chartNumber}`;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-labelledby': `${id}-title ${id}-description`, class: 'company-chart-svg' });
  svgAdd(svg, 'title', { id: `${id}-title` }, title);
  svgAdd(svg, 'desc', { id: `${id}-description` }, description);
  return svg;
}
function sourceById(data, id) {
  return Array.isArray(data.sources) ? data.sources.find(source => source.id === id) : data.sources?.[id];
}
function sourceLink(source, label) {
  if (!source?.url) return null;
  const anchor = element('a', '', label || source.title || 'Source');
  anchor.href = source.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}
function provenance(data, metric, compact = false) {
  const row = element('div', 'company-chart-provenance');
  row.append(element('span', '', `${statusLabel(metric?.type)} · ${dateLabel(metric?.date || snapshot(data))}`));
  (metric?.source_ids || []).forEach((id, index) => {
    const source = sourceById(data, id);
    const anchor = sourceLink(source, compact ? `Source${index ? ` ${index + 1}` : ''} ↗` : undefined);
    if (anchor) row.append(anchor);
  });
  return row;
}
function metricDisplay(value, formatter = number) {
  return isNumber(value) ? formatter(value) : 'Not found';
}
function metricRow(data, label, metric, formatter = number) {
  const row = element('div', 'company-chart-tooltip-row');
  row.append(element('strong', '', `${label}: ${metricDisplay(metric?.value, formatter)}`), provenance(data, metric));
  if (metric?.note) row.append(element('span', 'company-chart-metric-note', metric.note));
  return row;
}
function tooltip(host, data) {
  const box = element('div', 'company-chart-tooltip');
  box.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-atomic', 'true');
  box.append(element('p', '', 'Hover, focus or tap a labelled point to inspect its values, dates and sources.'));
  host.append(box);
  return (model, fields) => {
    box.replaceChildren(element('strong', 'company-chart-tooltip-title', model.chartLabel || model.name || model.company));
    if (model.chartLabel && model.chartLabel !== model.name) box.append(element('span', 'company-chart-full-name', model.name));
    fields.forEach(field => box.append(metricRow(data, field.label, field.metric, field.format)));
  };
}
function caption(host, data, text, metrics) {
  host.append(element('p', 'chart-note company-chart-note', `${text} Snapshot: ${dateLabel(snapshot(data))}. Display values are rounded; source precision is retained in the JSON data.`));
  const ids = [...new Set(metrics.flatMap(metric => metric?.source_ids || []))];
  const details = element('details', 'company-chart-source-details');
  details.append(element('summary', '', 'Chart sources and dates'));
  const list = element('ul');
  ids.forEach(id => {
    const source = sourceById(data, id);
    const anchor = sourceLink(source);
    if (!anchor) return;
    const item = element('li');
    item.append(anchor, document.createTextNode(` — ${dateLabel(source.date || source.accessed || snapshot(data))}`));
    list.append(item);
  });
  if (list.children.length) {
    details.append(list);
    host.append(details);
  }
}
function interact(mark, label, select) {
  mark.setAttribute('tabindex', '0');
  mark.setAttribute('role', 'button');
  mark.setAttribute('aria-label', label);
  mark.classList.add('company-chart-mark');
  svgAdd(mark, 'title', {}, label);
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
function responsive(plot, draw) {
  let previousWidth = 0;
  const repaint = () => {
    if (!plot.isConnected) return;
    const width = Math.round(Math.max(280, Math.min(1000, plot.clientWidth || 650)));
    if (width === previousWidth) return;
    previousWidth = width;
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
function legend(host) {
  const list = element('ul', 'company-chart-symbols');
  list.setAttribute('aria-label', 'Chart symbols');
  [['', 'Measured model'], ['is-baseline', 'Reference baseline'], ['is-estimate', 'Estimate']].forEach(([className, label]) => {
    const item = element('li');
    const symbol = element('span', `company-chart-symbol ${className}`);
    symbol.setAttribute('aria-hidden', 'true');
    item.append(symbol, document.createTextNode(label));
    list.append(item);
  });
  host.append(list);
}
function fallbackTable(host, data, points, fields, label) {
  const details = element('details', 'company-chart-data-details');
  details.append(element('summary', '', 'Chart data and sources in a table'));
  const scroller = element('div', 'table-scroll company-chart-table-scroll');
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', label);
  scroller.tabIndex = 0;
  const table = element('table');
  table.append(element('caption', '', `${label} · ${dateLabel(snapshot(data))} · all values come from companies.json`));
  const thead = element('thead');
  const header = element('tr');
  ['Model', ...fields.map(field => field.label)].forEach(label => {
    const cell = element('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  });
  thead.append(header);
  const tbody = element('tbody');
  points.forEach(point => {
    const row = element('tr', point.baseline ? 'company-chart-baseline-row' : '');
    row.append(element('td', '', point.name));
    fields.forEach(field => {
      const metric = point.metrics?.[field.key];
      const cell = element('td');
      cell.append(element('strong', '', metricDisplay(metric?.value, field.format)), provenance(data, metric, true));
      if (metric?.note) cell.append(element('div', 'company-chart-metric-note', metric.note));
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(thead, tbody);
  scroller.append(table);
  details.append(scroller);
  host.append(details);
}
function logTicks(minimum, maximum) {
  const ticks = [];
  for (let power = Math.floor(Math.log10(minimum)); power <= Math.ceil(Math.log10(maximum)); power++) {
    [1, 2, 5].forEach(factor => {
      const tick = factor * 10 ** power;
      if (tick >= minimum && tick <= maximum) ticks.push(tick);
    });
  }
  return ticks;
}
function extent(values, minimumPadding = 0.1) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.13, minimumPadding);
  return [minimum - padding, maximum + padding];
}
function overlaps(a, b) {
  return a.x < b.x + b.width + 3 && a.x + a.width + 3 > b.x && a.y < b.y + b.height + 3 && a.y + a.height + 3 > b.y;
}
function scatterChart(host, data, kind) {
  const isVideo = kind === 'video';
  const xKey = isVideo ? 'priceSecond' : 'blended', yKey = isVideo ? 'elo' : 'ii';
  const points = (data.models || []).filter(model => model.kind === kind && isNumber(model.metrics?.[xKey]?.value) && model.metrics[xKey].value > 0 && isNumber(model.metrics?.[yKey]?.value));
  const plot = element('div', 'company-chart-plot');
  host.append(plot);
  if (!points.length) {
    host.append(element('p', 'chart-note', 'Not found: no comparable entries have both a sourced score and a sourced price.'));
    return () => {};
  }
  const fields = [
    { key: yKey, label: isVideo ? 'Video Arena Elo' : 'Intelligence Index', format: isVideo ? number : intelligence },
    { key: xKey, label: isVideo ? 'USD per generated second' : 'Blended USD per 1M tokens', format: money }
  ];
  const show = tooltip(host, data);
  const select = point => {
    const rows = fields.map(field => ({ label: field.label, metric: point.metrics[field.key], format: field.format }));
    if (isVideo && isNumber(point.metrics.ciLow?.value) && isNumber(point.metrics.ciHigh?.value)) rows.push({ label: 'Lower 95% confidence bound', metric: point.metrics.ciLow, format: number }, { label: 'Upper 95% confidence bound', metric: point.metrics.ciHigh, format: number });
    show(point, rows);
  };
  legend(host);
  const settings = !isVideo && (data.value_zone || data.chart_settings?.value_zone);
  const zone = settings && isNumber(settings.intelligence_min) && isNumber(settings.blended_price_max) && settings.blended_price_max > 0 ? settings : null;
  const inZone = point => zone && point.metrics.ii.value >= zone.intelligence_min && point.metrics.blended.value <= zone.blended_price_max;
  if (zone) {
    const summary = element('div', 'company-value-zone-summary');
    summary.append(element('p', '', `Value zone rule: Intelligence Index ≥ ${intelligence(zone.intelligence_min)} and blended price ≤ ${money(zone.blended_price_max)} per million tokens; these adjustable thresholds are an analyst screening rule, not a prediction of task success.`));
    const members = points.filter(inZone);
    const memberLine = element('p');
    memberLine.append(element('strong', '', 'In the value zone: '), document.createTextNode(members.length ? members.map(point => point.chartLabel || point.name).join(', ') : 'None'));
    summary.append(memberLine);
    const note = element('p', 'company-chart-zone-note', `Analyst inference · ${dateLabel(zone.date || snapshot(data))}. `);
    const link = element('a', '', 'Adjust the thresholds in data.json ↗');
    link.href = '/data.json';
    note.append(link);
    summary.append(note);
    if (zone.rule) {
      const details = element('details', 'company-zone-rationale');
      details.append(element('summary', '', 'Why these default thresholds?'), element('p', '', typeof zone.rule === 'string' ? zone.rule : zone.rule.text || 'An illustrative screening rule.'));
      summary.append(details);
    }
    host.append(summary);
  }
  const absent = (data.models || []).filter(model => model.kind === kind && !points.some(point => point.id === model.id));
  if (absent.length) host.append(element('p', 'company-chart-note', `Excluded where score or comparable price is not found: ${absent.map(model => model.name).join('; ')}.`));
  caption(host, data, isVideo ? 'AA-Video-T2V v2.0 with audio only. Higher Elo and lower price are preferable; price is logarithmic. Vertical lines show confidence intervals. Video preference is separate from LLM intelligence.' : 'LLMs only. Higher Intelligence Index and lower blended price are preferable; price is logarithmic. Blend: 3 uncached-input : 1 output tokens, excluding cache and long-context uplifts. This illustrative token mix is not cost per successful task.', points.flatMap(point => Object.values(point.metrics)));
  fallbackTable(host, data, points, fields, isVideo ? 'Video quality and price' : 'LLM intelligence and blended price');
  return responsive(plot, width => {
    const narrow = width < 500;
    const height = narrow ? (isVideo ? 440 : 580) : 450;
    const left = narrow ? 42 : 53, right = narrow ? 14 : 26, top = 37, bottom = 66;
    const usableWidth = width - left - right, usableHeight = height - top - bottom;
    const xRange = extent(points.map(point => Math.log10(point.metrics[xKey].value)), 0.14);
    const minX = 10 ** xRange[0], maxX = 10 ** xRange[1];
    const yValues = points.flatMap(point => isVideo ? [point.metrics[yKey].value, point.metrics.ciLow?.value, point.metrics.ciHigh?.value].filter(isNumber) : [point.metrics[yKey].value]);
    const yStep = isVideo ? 50 : 10, yRange = extent(yValues, isVideo ? 30 : 5);
    const minY = isVideo ? Math.floor(yRange[0] / yStep) * yStep : 0, maxY = Math.ceil(yRange[1] / yStep) * yStep;
    const x = value => left + (Math.log10(value) - xRange[0]) / (xRange[1] - xRange[0]) * usableWidth;
    const y = value => top + (1 - (value - minY) / (maxY - minY)) * usableHeight;
    const svg = svgRoot(width, height, isVideo ? 'Video quality versus price per generated second' : 'LLM intelligence versus blended token price', 'Every point has a direct model-name label and supports keyboard, hover and touch inspection. A sourced data table follows.');
    const occupied = [];
    if (zone && zone.blended_price_max >= minX && zone.intelligence_min <= maxY) {
      const zoneRight = Math.min(width - right, x(zone.blended_price_max));
      const zoneBottom = Math.min(height - bottom, y(zone.intelligence_min));
      if (zoneRight > left && zoneBottom > top) {
        const rect = svgAdd(svg, 'rect', { x: left, y: top, width: zoneRight - left, height: zoneBottom - top, fill: 'var(--accent)', 'fill-opacity': '.07', stroke: 'var(--accent)', 'stroke-width': 1.2, 'stroke-dasharray': '6 4', class: 'company-value-zone' });
        svgAdd(rect, 'title', {}, 'Value zone: high intelligence, low cost');
        const lines = narrow ? ['Value zone:', 'high intelligence,', 'low cost'] : ['Value zone: high intelligence, low cost'];
        lines.forEach((line, index) => svgText(svg, left + 10, top + 18 + index * 14, line, { fill: 'var(--accent)', 'font-size': narrow ? 10.5 : 12, 'font-weight': 650, class: 'company-zone-label' }));
        occupied.push({ x: left + 8, y: top + 5, width: narrow ? 106 : 285, height: lines.length * 14 + 5 });
      }
    }
    let ticks = logTicks(minX, maxX);
    if (narrow && ticks.length > 5) ticks = ticks.filter((_, index) => index % 2 === 0);
    ticks.forEach(tick => {
      svgLine(svg, x(tick), top, x(tick), height - bottom);
      svgText(svg, x(tick), height - bottom + 24, money(tick), { 'text-anchor': 'middle', 'font-size': narrow ? 10.5 : 12 });
    });
    for (let tick = minY; tick <= maxY; tick += yStep) {
      svgLine(svg, left, y(tick), width - right, y(tick));
      svgText(svg, left - 9, y(tick) + 4, number(tick), { 'text-anchor': 'end', 'font-size': narrow ? 11 : 12 });
    }
    svgText(svg, left, 19, isVideo ? 'Video Arena Elo ↑' : 'Intelligence Index ↑', { fill: 'var(--text)', 'font-size': narrow ? 12 : 13 });
    svgText(svg, left + usableWidth / 2, height - 14, isVideo ? 'USD / generated second · log scale' : 'Blended USD / 1M tokens · log scale', { 'text-anchor': 'middle', 'font-size': narrow ? 10.5 : 12 });
    const positions = points.map(point => ({ point, x: x(point.metrics[xKey].value), y: y(point.metrics[yKey].value) }));
    occupied.push(...positions.map(position => ({ x: position.x - 11, y: position.y - 11, width: 22, height: 22 })));
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    const fontSize = narrow ? 11 : 12;
    if (context) context.font = `${fontSize}px ${getComputedStyle(plot).fontFamily}`;
    positions.sort((a, b) => a.y - b.y || a.x - b.x).forEach(position => {
      const { point, x: cx, y: cy } = position;
      const color = point.baseline ? 'var(--company-chart-baseline)' : 'var(--accent)';
      const estimated = ['estimate', 'estimated'].includes(point.metrics[yKey].type);
      const labelText = (point.chartLabel || point.name).replace(/\*$/, '');
      const lines = estimated ? [labelText, 'Estimate'] : [labelText];
      const labelWidth = Math.ceil(Math.max(...lines.map(line => context ? context.measureText(line).width : line.length * fontSize * .57))) + 12;
      const labelHeight = estimated ? 34 : 21;
      const valid = candidate => candidate.x >= left + 2 && candidate.x + candidate.width <= width - right - 2 && candidate.y >= top + 2 && candidate.y + candidate.height <= height - bottom - 2 && !occupied.some(item => overlaps(candidate, item));
      const candidates = [];
      for (const offset of [-labelHeight - 10, 10, -labelHeight - 30, 30, -labelHeight - 55, 55, -labelHeight - 85, 85]) {
        candidates.push({ x: cx + 13, y: cy + offset, width: labelWidth, height: labelHeight }, { x: cx - labelWidth - 13, y: cy + offset, width: labelWidth, height: labelHeight });
      }
      let label = candidates.find(valid);
      if (!label) {
        let distance = Infinity;
        for (let ly = top + 3; ly + labelHeight <= height - bottom - 3; ly += 6) {
          for (let lx = left + 3; lx + labelWidth <= width - right - 3; lx += 8) {
            const candidate = { x: lx, y: ly, width: labelWidth, height: labelHeight };
            const score = Math.abs(lx + labelWidth / 2 - cx) + Math.abs(ly + labelHeight / 2 - cy) * 1.25;
            if (score < distance && valid(candidate)) { label = candidate; distance = score; }
          }
        }
      }
      if (!label) label = { x: Math.min(width - right - labelWidth, Math.max(left, cx - labelWidth / 2)), y: Math.min(height - bottom - labelHeight, Math.max(top, cy + 15)), width: labelWidth, height: labelHeight };
      occupied.push(label);
      if (isVideo && isNumber(point.metrics.ciLow?.value) && isNumber(point.metrics.ciHigh?.value)) {
        const lower = y(point.metrics.ciLow.value), upper = y(point.metrics.ciHigh.value);
        svgLine(svg, cx, upper, cx, lower, { stroke: color, 'stroke-width': 1.4, opacity: .7 });
        svgLine(svg, cx - 4, upper, cx + 4, upper, { stroke: color });
        svgLine(svg, cx - 4, lower, cx + 4, lower, { stroke: color });
      }
      svgLine(svg, cx, cy, Math.max(label.x, Math.min(label.x + label.width, cx)), Math.max(label.y, Math.min(label.y + label.height, cy)), { stroke: color, opacity: .65, 'stroke-width': 1 });
      const mark = svgAdd(svg, 'g', { 'data-model-id': point.id });
      svgAdd(mark, 'circle', { cx, cy, r: 17, fill: 'transparent' });
      if (inZone(point)) svgAdd(mark, 'circle', { cx, cy, r: 11, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, class: 'company-value-ring' });
      svgAdd(mark, point.baseline ? 'rect' : 'circle', point.baseline ? { x: cx - 6, y: cy - 6, width: 12, height: 12, rx: 1, fill: color, stroke: 'var(--surface)', 'stroke-width': 1.5 } : { cx, cy, r: 6.5, fill: estimated ? 'var(--surface)' : color, stroke: estimated ? color : 'var(--surface)', 'stroke-width': estimated ? 2 : 1.5 });
      svgAdd(mark, 'rect', { x: label.x, y: label.y, width: label.width, height: label.height, rx: 4, fill: 'var(--surface)', 'fill-opacity': '.98', stroke: color, 'stroke-width': '.65', class: 'company-point-label-box' });
      lines.forEach((line, index) => svgText(mark, label.x + 6, label.y + 15 + index * 13, line, { fill: 'var(--text)', 'font-size': index ? 10 : fontSize, 'font-weight': index ? 450 : 600, class: 'company-point-label' }));
      interact(mark, `${point.name}. ${fields[0].label}: ${fields[0].format(point.metrics[yKey].value)}. ${fields[1].label}: ${money(point.metrics[xKey].value)}.${inZone(point) ? ' In the value zone.' : ''}`, () => select(point));
    });
    plot.replaceChildren(svg);
  });
}

function positioningChart(host, data) {
  const positioning = data.positioning;
  if (!positioning?.rows?.length || !positioning.columns?.length) {
    host.append(element('p', 'chart-note', 'Not found: a sourced categorical positioning map is unavailable.'));
    return () => {};
  }
  host.append(element('p', 'company-chart-note', 'A categorical map of focus and availability, not a numerical capability ranking. Each cell identifies whether it is verified or an analyst inference.'));
  const scroller = element('div', 'table-scroll company-positioning-scroll');
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'Categorical company positioning map');
  scroller.tabIndex = 0;
  const table = element('table', 'company-positioning-table');
  table.append(element('caption', '', `Company positioning · ${dateLabel(snapshot(data))} · no numerical ratings`));
  const header = element('tr');
  ['Company', ...positioning.columns].forEach(column => {
    const cell = element('th', '', typeof column === 'string' ? column : column.label || column.name);
    cell.scope = 'col';
    header.append(cell);
  });
  const thead = element('thead');
  thead.append(header);
  const body = element('tbody');
  positioning.rows.forEach(row => {
    const tr = element('tr');
    const company = element('th', '', row.company);
    company.scope = 'row';
    tr.append(company);
    (row.cells || []).forEach(cell => {
      const td = element('td', `company-positioning-cell${cell.type === 'inference' ? ' company-positioning-inference' : ''}`);
      const label = cell.text || (typeof cell.value === 'string' ? cell.value : 'Not found');
      td.append(element('strong', '', label), provenance(data, cell, true));
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(thead, body);
  scroller.append(table);
  host.append(scroller);
  caption(host, data, 'Positioning assessments are categorical. Open weights describe availability and licensing, not a capability score.', positioning.rows.flatMap(row => row.cells));
  return () => {};
}

export function renderCompanyCharts(data) {
  const cleanup = [];
  [['llm-value-chart', host => scatterChart(host, data, 'llm')], ['positioning-chart', host => positioningChart(host, data)], ['video-value-chart', host => scatterChart(host, data, 'video')]].forEach(([id, render]) => {
    const host = document.getElementById(id);
    if (!host) return;
    activeCharts.get(host)?.();
    host.replaceChildren();
    host.classList.add('company-chart');
    const dispose = render(host);
    activeCharts.set(host, dispose);
    cleanup.push(() => {
      dispose();
      if (activeCharts.get(host) === dispose) activeCharts.delete(host);
    });
  });
  return () => cleanup.forEach(dispose => dispose());
}
