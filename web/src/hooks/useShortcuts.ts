import { useEffect } from "react";
import { navigate } from "@/lib/router";

export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return Boolean(t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)));
}

/** Global keyboard shortcuts. Ignored while typing or while a dialog is open (except ⌘K). */
export function useShortcuts(actions: { palette: () => void; help: () => void; logCall: () => void; toggleSidebar: () => void }) {
  useEffect(() => {
    let pendingG = 0;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); actions.palette(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      // Only real modal popups block shortcuts; toasts also use role=dialog.
      if (document.querySelector('[data-slot="dialog-popup"], [data-slot="sheet-popup"], [data-slot="alert-dialog-popup"], [data-slot="command-dialog-popup"]')) return;
      if (isTyping(e.target)) return;
      const k = e.key;
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0;
        const to = { t: "/today", a: "/agencies", f: "/search", p: "/pipeline", u: "/followups" }[k.toLowerCase()];
        if (to) { e.preventDefault(); navigate(to); }
        return;
      }
      if (k === "g") { pendingG = Date.now(); return; }
      if (k === "?") { e.preventDefault(); actions.help(); }
      else if (k === "n") { e.preventDefault(); navigate("/agencies/new"); }
      else if (k === "l") { e.preventDefault(); actions.logCall(); }
      else if (k === "[") { e.preventDefault(); actions.toggleSidebar(); }
      else if (k === "/") {
        e.preventDefault();
        const s = document.querySelector<HTMLElement>("[data-search]");
        if (s) s.focus();
        else { sessionStorage.setItem("hq.focusSearch", "1"); navigate("/agencies"); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [actions]);
}
