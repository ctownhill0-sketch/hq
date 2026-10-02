import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useApp } from "./AppProvider";

export const SHORTCUTS: [string[], string][] = [
  [["⌘/Ctrl", "K"], "Command palette"],
  [["G", "T"], "Go to Today"],
  [["G", "A"], "Go to Agencies"],
  [["G", "P"], "Go to Pipeline"],
  [["G", "U"], "Go to Follow-ups"],
  [["G", "F"], "Find agencies on Google"],
  [["N"], "New agency (by hand)"],
  [["L"], "Log a call"],
  [["/"], "Focus search"],
  [["["], "Collapse or expand the sidebar"],
  [["↑", "↓"], "Move in lists and the agencies grid (also J / K)"],
  [["↵"], "Open the selected row"],
  [["⌘/Ctrl", "↵"], "Save the open form"],
  [["Space"], "Pick up / drop a pipeline card (then arrow keys)"],
  [["?"], "Show this help"],
  [["Esc"], "Close a dialog"],
];

export function ShortcutHelp() {
  const { helpOpen, setHelpOpen } = useApp();
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything in HQ Desk works from the keyboard.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2.5 text-sm">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={label} className="contents">
                <dt>{label}</dt>
                <dd className="flex justify-end"><KbdGroup>{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</KbdGroup></dd>
              </div>
            ))}
          </dl>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
