import { useEffect } from "react";

interface KeyboardShortcut {
  keys: string[]; // e.g., ["Control", "S"] or ["Meta", "S"]
  description: string;
  handler: () => void;
  preventDefault?: boolean;
}

const COMMON_SHORTCUTS: Record<string, KeyboardShortcut> = {
  save: {
    keys: ["Control", "S"],
    description: "Save",
    handler: () => {
      const form = document.querySelector("form");
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        submitBtn?.click();
      }
    },
    preventDefault: true,
  },
  saveAlt: {
    keys: ["Meta", "S"],
    description: "Save (Mac)",
    handler: () => {
      const form = document.querySelector("form");
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        submitBtn?.click();
      }
    },
    preventDefault: true,
  },
  cancel: {
    keys: ["Escape"],
    description: "Cancel / Close",
    handler: () => {
      const dialog = document.querySelector("[role='dialog']");
      if (dialog) {
        const closeBtn = dialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
        closeBtn?.click();
      }
    },
    preventDefault: true,
  },
  new: {
    keys: ["Control", "N"],
    description: "Create New",
    handler: () => {
      const newBtn = document.querySelector('[data-testid*="button-new"]') as HTMLButtonElement;
      newBtn?.click();
    },
    preventDefault: true,
  },
  delete: {
    keys: ["Delete"],
    description: "Delete",
    handler: () => {
      const deleteBtn = document.querySelector('[data-testid*="button-delete"]') as HTMLButtonElement;
      deleteBtn?.click();
    },
    preventDefault: false,
  },
};

export function useKeyboardShortcuts(customShortcuts: Record<string, KeyboardShortcut> = {}) {
  useEffect(() => {
    const allShortcuts = { ...COMMON_SHORTCUTS, ...customShortcuts };

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of Object.values(allShortcuts)) {
        const isMatch = shortcut.keys.every((key) => {
          if (key === "Control") return event.ctrlKey;
          if (key === "Meta") return event.metaKey;
          if (key === "Shift") return event.shiftKey;
          if (key === "Alt") return event.altKey;
          return event.key === key;
        });

        if (isMatch) {
          if (shortcut.preventDefault) {
            event.preventDefault();
          }
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return COMMON_SHORTCUTS;
}
