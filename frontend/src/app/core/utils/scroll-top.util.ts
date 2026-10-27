/**
 * Reset the page scroll to the top.
 *
 * This app scrolls inside the `<body>` element (it has `overflow-y: auto` and a
 * viewport-height cap), not the window, so `window.scrollTo` / Angular's
 * `ViewportScroller` — which target `document.scrollingElement` (the `<html>`
 * element) — have no visible effect. We reset `<body>` and cover the window/html
 * cases too for safety. It runs immediately and again after the next frame /
 * macrotask so it also sticks once freshly rendered (taller) content — including
 * lazy-loaded route components — has laid out.
 */
export function resetScrollTop(): void {
  if (typeof document === 'undefined') return;
  const reset = () => {
    if (document.body) document.body.scrollTop = 0;
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };
  reset();
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(reset);
  if (typeof setTimeout !== 'undefined') setTimeout(reset, 0);
}
