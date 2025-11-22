import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Command, Code } from "lucide-react";

interface KeyboardShortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Record<string, KeyboardShortcut[]> = {
  Navigation: [
    { keys: ["Cmd", "K"], description: "Open command palette" },
    { keys: ["Escape"], description: "Close dialog or palette" },
  ],
  Forms: [
    { keys: ["Cmd", "S"], description: "Save form" },
    { keys: ["Cmd", "N"], description: "Create new item" },
    { keys: ["Delete"], description: "Delete selected item" },
  ],
  Tables: [
    { keys: ["Shift", "Click"], description: "Multi-select rows" },
    { keys: ["Cmd", "A"], description: "Select all visible" },
  ],
};

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+? or Ctrl+? for shortcuts
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setOpen(!open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto" data-testid="keyboard-shortcuts-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <Badge variant="outline" className="ml-1">
              <Command className="h-3 w-3 mr-1" /> ?
            </Badge> anytime to show this menu
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(SHORTCUTS).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="font-semibold text-sm mb-3 text-secondary">
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <Badge key={keyIdx} variant="secondary" className="font-mono text-xs">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
