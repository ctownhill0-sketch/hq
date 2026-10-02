import {
  AwardIcon, BarChart3Icon, CalendarClockIcon, ClipboardListIcon, CommandIcon, DownloadIcon, FlagIcon, KanbanSquareIcon,
  KeyboardIcon, LayoutListIcon, MessageSquareWarningIcon, MonitorIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon,
  PlusIcon, SearchIcon, SunIcon, SunriseIcon, UsersIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { applyTheme, getTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useApp } from "./AppProvider";
import { SegmentedControl } from "./SegmentedControl";
import { UsageMeters } from "./UsageMeters";

type NavItem = { id: string; label: string; icon: LucideIcon; href?: string; keys?: string[]; soon?: string };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Sales",
    items: [
      { id: "today", label: "Today", icon: SunriseIcon, href: "#/today", keys: ["G", "T"] },
      { id: "agencies", label: "Agencies", icon: LayoutListIcon, href: "#/agencies", keys: ["G", "A"] },
      { id: "pipeline", label: "Pipeline", icon: KanbanSquareIcon, href: "#/pipeline", keys: ["G", "P"] },
      { id: "followups", label: "Follow-ups", icon: CalendarClockIcon, href: "#/followups", keys: ["G", "U"] },
      { id: "search", label: "Find agencies", icon: SearchIcon, href: "#/search", keys: ["G", "F"] },
      { id: "new", label: "Add by hand", icon: PlusIcon, href: "#/agencies/new", keys: ["N"] },
    ],
  },
  {
    group: "Coming next",
    items: [
      { id: "scorecard", label: "Scorecard", icon: BarChart3Icon, soon: "Stage 2" },
      { id: "objections", label: "Objections", icon: MessageSquareWarningIcon, soon: "Stage 2" },
      { id: "operators", label: "Operators", icon: UsersIcon, soon: "Stage 3" },
      { id: "licensing", label: "Licensing", icon: AwardIcon, soon: "Stage 3" },
      { id: "gates", label: "Gates", icon: FlagIcon, soon: "Stage 3" },
      { id: "ledger", label: "Ledger", icon: WalletIcon, soon: "Stage 4" },
      { id: "renewal", label: "Renewal demo", icon: ClipboardListIcon, soon: "Stage 5" },
    ],
  },
];

export function Sidebar({ active, collapsed, onToggle }: { active: string; collapsed: boolean; onToggle: () => void }) {
  const { setPaletteOpen, setHelpOpen } = useApp();
  const [theme, setTheme] = useState<ThemeChoice>(getTheme());
  useEffect(() => { applyTheme(theme); }, [theme]);

  // The outer column stretches to the page height so the sidebar colour
  // continues on long pages; the nav itself stays pinned to the viewport.
  return (
    <div className="z-(--z-sidebar) shrink-0 border-sidebar-border border-e bg-sidebar">
    <aside
      aria-label="Main navigation"
      className={cn(
        "sticky top-0 flex h-dvh flex-col gap-1 px-2 py-3 text-sidebar-foreground",
        collapsed ? "w-15" : "w-60",
      )}
    >
      <div className={cn("flex min-h-10 items-center gap-2 px-2 pb-3", collapsed && "justify-center px-0")}>
        {!collapsed && (
          <a href="#/today" className="flex min-w-0 items-center gap-2 rounded-md font-semibold text-foreground text-sm">
            <span aria-hidden className="grid size-6.5 shrink-0 place-items-center rounded-md bg-primary font-bold text-[11px] text-primary-foreground">HQ</span>
            HQ Desk
            <span className="rounded-full border px-1.5 font-medium text-[10px] text-muted-foreground">local</span>
          </a>
        )}
        <Tooltip>
          <TooltipTrigger render={<Button size="icon-sm" variant="ghost" className={cn(!collapsed && "ms-auto")} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={onToggle} />}>
            {collapsed ? <PanelLeftOpenIcon aria-hidden /> : <PanelLeftCloseIcon aria-hidden />}
          </TooltipTrigger>
          <TooltipPopup side="right">{collapsed ? "Expand" : "Collapse"} <Kbd>[</Kbd></TooltipPopup>
        </Tooltip>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map((g) => (
          <div key={g.group} className="flex flex-col gap-0.5">
            {!collapsed ? <p className="px-3 pt-4 pb-1 font-medium text-muted-foreground text-xs">{g.group}</p> : <div className="my-2 h-px bg-sidebar-border" aria-hidden />}
            {g.items.map((item) => <NavLink key={item.id} item={item} active={active === item.id} collapsed={collapsed} />)}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-3">
        {!collapsed && (
          <div className="rounded-xl border bg-card p-3">
            <UsageMeters />
          </div>
        )}
        <div className={cn("flex items-center gap-1 px-1", collapsed && "flex-col")}>
          {!collapsed ? (
            <SegmentedControl
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "system", label: "System theme", icon: <MonitorIcon aria-hidden />, iconOnly: true },
                { value: "light", label: "Light theme", icon: <SunIcon aria-hidden />, iconOnly: true },
                { value: "dark", label: "Dark theme", icon: <MoonIcon aria-hidden />, iconOnly: true },
              ]}
            />
          ) : (
            <IconAction label={`Theme: ${theme}`} onClick={() => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system")}>
              {theme === "dark" ? <MoonIcon aria-hidden /> : theme === "light" ? <SunIcon aria-hidden /> : <MonitorIcon aria-hidden />}
            </IconAction>
          )}
          <span className="flex-1" />
          <IconAction label="Keyboard shortcuts" kbd="?" onClick={() => setHelpOpen(true)}><KeyboardIcon aria-hidden /></IconAction>
          <IconAction label="Command palette" kbd="⌘K" onClick={() => setPaletteOpen(true)}><CommandIcon aria-hidden /></IconAction>
          <Tooltip>
            <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Export my notes (JSON)" render={<a href="/api/export/my-data.json" download />} />}>
              <DownloadIcon aria-hidden />
            </TooltipTrigger>
            <TooltipPopup side="top">Export my notes (JSON, place IDs only)</TooltipPopup>
          </Tooltip>
        </div>
      </div>
    </aside>
    </div>
  );
}

function IconAction({ label, kbd, onClick, children }: { label: string; kbd?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} onClick={onClick} />}>{children}</TooltipTrigger>
      <TooltipPopup side="top">{label} {kbd && <Kbd>{kbd}</Kbd>}</TooltipPopup>
    </Tooltip>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const base = cn(
    "flex min-h-8 items-center gap-3 rounded-lg px-3 font-medium text-sm outline-none touch-target",
    "focus-visible:ring-2 focus-visible:ring-ring",
    collapsed && "justify-center px-0",
  );
  const content = (
    <>
      <Icon aria-hidden className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.soon && <span className="ms-auto rounded-full border px-1.5 text-[10px] text-muted-foreground">{item.soon}</span>}
    </>
  );
  if (item.soon) {
    const el = (
      <span role="link" aria-disabled="true" aria-label={`${item.label}, coming next in ${item.soon}`} className={cn(base, "cursor-not-allowed text-muted-foreground opacity-70")}>
        {content}
      </span>
    );
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger render={el} />
        <TooltipPopup side="right">{item.label}: coming next ({item.soon})</TooltipPopup>
      </Tooltip>
    ) : el;
  }
  const link = (
    <a href={item.href} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined}
      className={cn(base, active ? "bg-sidebar-accent text-accent-text" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
      {content}
    </a>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipPopup side="right">{item.label} {item.keys && <span className="ms-1 inline-flex gap-0.5">{item.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}</TooltipPopup>
    </Tooltip>
  );
}
