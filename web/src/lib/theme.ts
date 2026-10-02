// Theme: "system" | "light" | "dark", persisted. Switching never animates.
export type ThemeChoice = "system" | "light" | "dark";

export function getTheme(): ThemeChoice {
  try { return (localStorage.getItem("hq.theme") as ThemeChoice) || "system"; } catch { return "system"; }
}

export function applyTheme(choice: ThemeChoice): void {
  try { localStorage.setItem("hq.theme", choice); } catch { /* ignore */ }
  const root = document.documentElement;
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.add("theme-switching");
  root.classList.toggle("dark", dark);
  // Force a style flush, then re-enable transitions on the next frame.
  void root.offsetHeight;
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}

export function watchSystemTheme(): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const h = () => { if (getTheme() === "system") applyTheme("system"); };
  mq.addEventListener("change", h);
  return () => mq.removeEventListener("change", h);
}
