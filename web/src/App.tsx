import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppProvider, useApp } from "@/components/app/AppProvider";
import { CommandPalette } from "@/components/app/CommandPalette";
import { QuickLogDrawer } from "@/components/app/QuickLogDrawer";
import { ShortcutHelp } from "@/components/app/ShortcutHelp";
import { Sidebar } from "@/components/app/Sidebar";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useHash } from "@/lib/router";
import { watchSystemTheme } from "@/lib/theme";
import { AgenciesPage } from "@/pages/AgenciesPage";
import { AgencyPage } from "@/pages/agency/AgencyPage";
import { FollowupsPage } from "@/pages/FollowupsPage";
import { NewAgencyPage } from "@/pages/NewAgencyPage";
import { PipelinePage } from "@/pages/PipelinePage";
import { SearchPage } from "@/pages/SearchPage";
import { TodayPage } from "@/pages/TodayPage";

export function App() {
  useEffect(() => watchSystemTheme(), []);
  return (
    // Tooltips: short delay on the first, then instant for neighbours.
    // The CSP is style-src 'self': Base UI must not inject <style> tags (the
    // one rule it needs lives in app.css).
    <CSPProvider disableStyleElements>
      <TooltipProvider delay={400} closeDelay={0}>
        <ToastProvider position="bottom-right">
          <AppProvider>
            <Shell />
          </AppProvider>
        </ToastProvider>
      </TooltipProvider>
    </CSPProvider>
  );
}

function currentAgencyId(): number | null {
  const m = window.location.hash.match(/^#\/agency\/(\d+)(?:[?/]|$)/);
  return m ? Number(m[1]) : null;
}

function route(path: string, query: URLSearchParams): { nav: string; page: ReactNode; agencyId: number | null } {
  let m: RegExpMatchArray | null;
  if (path === "/today") return { nav: "today", page: <TodayPage query={query} />, agencyId: null };
  if (path === "/agencies") return { nav: "agencies", page: <AgenciesPage />, agencyId: null };
  if (path === "/agencies/new") return { nav: "new", page: <NewAgencyPage />, agencyId: null };
  if ((m = path.match(/^\/agency\/(\d+)$/))) {
    const id = Number(m[1]);
    return { nav: "agencies", page: <AgencyPage key={id} id={id} query={query} />, agencyId: id };
  }
  if (path === "/pipeline") return { nav: "pipeline", page: <PipelinePage />, agencyId: null };
  if (path === "/followups") return { nav: "followups", page: <FollowupsPage />, agencyId: null };
  if (path === "/search") return { nav: "search", page: <SearchPage query={query} />, agencyId: null };
  return { nav: "today", page: <TodayPage query={query} />, agencyId: null };
}

function Shell() {
  const { path, query } = useHash();
  const app = useApp();
  const narrow = useMediaQuery("(max-width: 1023px)");
  const [userCollapsed, setUserCollapsed] = useState(() => document.documentElement.classList.contains("sidebar-collapsed"));
  const collapsed = userCollapsed || narrow;

  const toggleSidebar = useCallback(() => {
    setUserCollapsed((c) => {
      const next = !c;
      document.documentElement.classList.toggle("sidebar-collapsed", next);
      try { localStorage.setItem("hq.sidebar", next ? "collapsed" : "open"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const r = useMemo(() => route(path, query), [path, query]);
  useEffect(() => { if (!window.location.hash) history.replaceState(null, "", "#/today"); }, []);

  const shortcutActions = useMemo(() => ({
    palette: () => app.setPaletteOpen(true),
    help: () => app.setHelpOpen(true),
    // Read the URL at key-press time: the routed state can lag a hash change by a render.
    logCall: () => app.openQuickLog({ agencyId: currentAgencyId() }),
    toggleSidebar,
  }), [app, toggleSidebar]);
  useShortcuts(shortcutActions);

  // Move focus to the page on navigation so screen readers announce it
  // (not on first load, so the first Tab still reaches the skip link).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const main = document.getElementById("main");
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="flex min-h-dvh">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}
        className="sr-only z-(--z-toast) rounded-md bg-card px-3 py-2 shadow focus:not-sr-only focus:fixed focus:start-2 focus:top-2">
        Skip to content
      </a>
      <Sidebar active={r.nav} collapsed={collapsed} onToggle={toggleSidebar} />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <div className="mx-auto w-full max-w-310 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{r.page}</div>
      </main>
      <CommandPalette currentAgencyId={r.agencyId} />
      <ShortcutHelp />
      <QuickLogDrawer />
    </div>
  );
}
