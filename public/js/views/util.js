// Small helpers shared by views.

// Listen to a window event only while this view is on screen.
export function listenWhileCurrent(params, event, fn) {
  const handler = (e) => {
    if (!params.isCurrent()) { window.removeEventListener(event, handler); return; }
    fn(e);
  };
  window.addEventListener(event, handler);
}

// Re-render the current route in place (keeps scroll position).
export function rerender() {
  const y = window.scrollY;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  requestAnimationFrame(() => window.scrollTo(0, y));
}
