// Runs before first paint (loaded synchronously in <head>) so there is no
// flash of the wrong theme. Saved choice: "light" | "dark" | "system".
(function () {
  try {
    var t = localStorage.getItem('hq.theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    if (localStorage.getItem('hq.sidebar') === 'collapsed') document.documentElement.classList.add('sidebar-collapsed');
  } catch (e) { /* storage unavailable: follow system */ }
})();
