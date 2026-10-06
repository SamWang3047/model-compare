/* Personal workflow content lives in data.json.multi_model_workflow. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function renderWorkflow(data) {
  const section = document.getElementById('workflow');
  if (!section || !data) return;
  document.getElementById('workflow-heading').textContent = data.title;
  document.getElementById('workflow-intro').textContent = data.intro.join(' ');
  document.getElementById('workflow-cards').innerHTML = data.cards.map((card, index) => {
    const testing = card.status === 'to_test';
    const does = card.trials
      ? `<div class="workflow-trials">${card.trials.map(trial => `<p><strong>${esc(trial.model_name)}:</strong> ${esc(trial.text)}</p>`).join('')}</div>`
      : `<p class="workflow-does"><strong>Does</strong> ${esc(card.does)}</p>`;
    return `<article class="workflow-card workflow-card-${esc(card.id)} ${testing ? 'workflow-to-test' : 'workflow-decided'}" data-status="${esc(card.status)}" aria-labelledby="workflow-model-${esc(card.id)}"><div class="workflow-card-top"><span class="workflow-layer"><span class="workflow-layer-number" aria-hidden="true">${index + 1}</span>${esc(card.role)}</span><div class="workflow-status-group"><span class="workflow-status">${testing ? 'To be tested' : 'Decided'}</span>${card.status_note ? `<span class="workflow-status-note">${esc(card.status_note)}</span>` : ''}</div></div><h3 id="workflow-model-${esc(card.id)}">${esc(card.model_name)}</h3>${does}<p class="workflow-why"><strong>${testing ? 'Why not fixed yet' : 'Why'}</strong> ${esc(card.why)}</p></article>`;
  }).join('');
  document.getElementById('workflow-flow').innerHTML = data.flow.map(step => `<li>${Array.isArray(step) ? `<div class="workflow-branches">${step.map(branch => `<span>${esc(branch)}</span>`).join('')}</div>` : `<span>${esc(step)}</span>`}</li>`).join('');
  document.getElementById('workflow-practices').innerHTML = data.practices.map(practice => `<li><h4>${esc(practice.title)}</h4><p>${esc(practice.reason)}</p></li>`).join('');
  const validation = document.getElementById('workflow-validation');
  const summary = validation.querySelector('summary');
  summary.textContent = data.validation_plan.title;
  document.getElementById('workflow-validation-body').textContent = data.validation_plan.text;
  const syncExpanded = () => summary.setAttribute('aria-expanded', String(validation.open));
  syncExpanded();
  validation.addEventListener('toggle', syncExpanded);
  document.getElementById('workflow-footnote').textContent = data.footnote;
  const comparison = document.getElementById('workflow-comparison-link');
  comparison.textContent = data.comparison_link.label;
  comparison.href = data.comparison_link.href;
  section.dataset.ready = 'true';
}
