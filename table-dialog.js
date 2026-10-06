/* Shared behavior for the site's expanded comparison tables. */
export function initTableDialog({ dialog, trigger, close, onOpen = () => {}, onClose = () => {} }) {
  if (!dialog || !trigger || !close) return;
  let previousBodyStyle = '';
  let scrollPosition = 0;
  trigger.addEventListener('click', () => {
    onOpen();
    scrollPosition = window.scrollY;
    previousBodyStyle = document.body.getAttribute('style') || '';
    Object.assign(document.body.style, { position: 'fixed', top: `-${scrollPosition}px`, left: '0', right: '0', overflow: 'hidden' });
    dialog.showModal();
    const tableScroll = dialog.querySelector('.cmp-dialog-scroll');
    if (tableScroll) { tableScroll.scrollTop = 0; tableScroll.scrollLeft = 0; }
    close.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    onClose();
    document.body.setAttribute('style', previousBodyStyle);
    window.scrollTo(0, scrollPosition);
    trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}
