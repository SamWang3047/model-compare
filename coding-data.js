/* Comparisons use source precision and matching benchmark snapshots. */
export function deriveCodingData(data) {
  const baseline = data.models.find(model => model.id === data.chart_settings.gap_baseline_id);
  const isVerified = metric => metric?.label === 'verified' && Number.isFinite(metric.value);
  const snapshot = baseline?.metrics.arena_score.snapshot_date;
  const arenaPoints = data.models.filter(model => {
    const score = model.metrics.arena_score, price = model.metrics.arena_price;
    return isVerified(score) && isVerified(price) && price.value > 0 && !score.older_snapshot && !price.older_snapshot && score.snapshot_date === snapshot && price.snapshot_date === snapshot;
  }).map(model => ({ ...model, x: model.metrics.arena_price.value, y: model.metrics.arena_score.value }));
  const frontierIds = new Set(data.chart_settings.arena_frontier_ids);
  const frontierPoints = arenaPoints.filter(model => frontierIds.has(model.id)).sort((a, b) => a.x - b.x);
  const gaps = arenaPoints.some(model => model.id === baseline?.id)
    ? arenaPoints.filter(model => data.chart_settings.gap_model_ids.includes(model.id)).map(model => ({
      ...model,
      baseline,
      scoreGap: baseline.metrics.arena_score.value - model.y,
      priceRatio: model.x / baseline.metrics.arena_price.value,
      cheaperBy: baseline.metrics.arena_price.value / model.x
    })) : [];
  return { arenaPoints, frontierPoints, gaps };
}
