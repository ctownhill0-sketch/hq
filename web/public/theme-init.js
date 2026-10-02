// Runs before first paint (classic script, not inline: the CSP forbids inline
// scripts) so the page never flashes the wrong theme or sidebar width.
(function () {
  try {
    var t = localStorage.getItem("hq.theme") || "system";
    var dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    if (localStorage.getItem("hq.sidebar") === "collapsed") document.documentElement.classList.add("sidebar-collapsed");
  } catch (e) { /* storage blocked: follow defaults */ }
})();
