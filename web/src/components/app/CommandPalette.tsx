import { ArrowDownIcon, ArrowUpIcon, Building2Icon, CalendarClockIcon, CornerDownLeftIcon, KanbanSquareIcon, LayoutListIcon, ListPlusIcon, MailIcon, PhoneIcon, PlusIcon, SearchIcon, SunriseIcon, type LucideIcon } from "lucide-react";
import { Fragment, useMemo } from "react";
import {
  Command, CommandCollection, CommandDialog, CommandDialogPopup, CommandEmpty, CommandFooter, CommandGroup,
  CommandGroupLabel, CommandInput, CommandItem, CommandList, CommandPanel, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { agencyName } from "@/lib/agency";
import { STAGE_LABEL } from "@/lib/constants";
import { navigate } from "@/lib/router";
import { useApp } from "./AppProvider";

interface PaletteItem { value: string; label: string; icon: LucideIcon; hint?: string; run: () => void }
interface PaletteGroup { value: string; items: PaletteItem[] }

/** Cmd/Ctrl+K. Opens and closes instantly (motion policy); arrow keys move with no animation. */
export function CommandPalette({ currentAgencyId }: { currentAgencyId: number | null }) {
  const { paletteOpen, setPaletteOpen, agencies, openQuickLog } = useApp();

  const groups = useMemo<PaletteGroup[]>(() => {
    const actions: PaletteItem[] = [
      { value: "log-call", label: "Log a call", icon: PhoneIcon, hint: "L", run: () => openQuickLog({ agencyId: currentAgencyId }) },
      { value: "log-email", label: "Log an email", icon: MailIcon, run: () => openQuickLog({ agencyId: currentAgencyId, channel: "email" }) },
      { value: "add-task", label: "Add task", icon: ListPlusIcon, run: () => navigate(currentAgencyId ? `/agency/${currentAgencyId}?tab=tasks&new=1` : "/today?newtask=1") },
      { value: "new-agency", label: "New agency (by hand)", icon: PlusIcon, hint: "N", run: () => navigate("/agencies/new") },
      { value: "search-google", label: "Search Google for agencies", icon: SearchIcon, hint: "G F", run: () => navigate("/search") },
    ];
    const pages: PaletteItem[] = [
      { value: "go-today", label: "Today", icon: SunriseIcon, hint: "G T", run: () => navigate("/today") },
      { value: "go-agencies", label: "Agencies", icon: LayoutListIcon, hint: "G A", run: () => navigate("/agencies") },
      { value: "go-pipeline", label: "Pipeline", icon: KanbanSquareIcon, hint: "G P", run: () => navigate("/pipeline") },
      { value: "go-followups", label: "Follow-ups", icon: CalendarClockIcon, hint: "G U", run: () => navigate("/followups") },
    ];
    const ag: PaletteItem[] = agencies.map((a) => ({
      value: `agency-${a.id}`, label: agencyName(a), icon: Building2Icon, hint: STAGE_LABEL[a.pipeline_stage],
      run: () => navigate(`/agency/${a.id}`),
    }));
    return [{ value: "Actions", items: actions }, { value: "Go to", items: pages }, { value: "Agencies", items: ag }];
  }, [agencies, currentAgencyId, openQuickLog]);

  function choose(item: PaletteItem) {
    setPaletteOpen(false);
    window.setTimeout(item.run, 0);
  }

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <CommandDialogPopup aria-label="Command palette">
        <Command items={groups} itemToStringValue={(i: unknown) => (i as PaletteItem).label}>
          <CommandInput placeholder="Type a command or search agencies…" aria-label="Command or agency" />
          <CommandPanel>
            <CommandEmpty>No matches. Try another word.</CommandEmpty>
            <CommandList>
              {(group: PaletteGroup) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: PaletteItem) => (
                        <CommandItem key={item.value} value={item} onClick={() => choose(item)}>
                          <item.icon aria-hidden className="size-4 opacity-70" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.hint && <CommandShortcut>{item.hint}</CommandShortcut>}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  <CommandSeparator />
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2"><KbdGroup><Kbd><ArrowUpIcon aria-label="Up" /></Kbd><Kbd><ArrowDownIcon aria-label="Down" /></Kbd></KbdGroup>Navigate</span>
              <span className="flex items-center gap-2"><Kbd><CornerDownLeftIcon aria-label="Enter" /></Kbd>Open</span>
            </div>
            <span className="flex items-center gap-2"><Kbd>?</Kbd>All shortcuts</span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
