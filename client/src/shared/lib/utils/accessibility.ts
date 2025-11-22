/**
 * Accessibility Utilities - WCAG 2.2 Level A Compliance Helpers
 */

/**
 * Generate descriptive aria-label for icon-only buttons
 * @param action The action being performed (e.g., "delete", "edit", "close")
 * @param context Optional context for the button (e.g., "invoice", "customer")
 */
export const getIconButtonLabel = (action: string, context?: string): string => {
  if (context) {
    return `${action.charAt(0).toUpperCase() + action.slice(1)} ${context}`;
  }
  return action.charAt(0).toUpperCase() + action.slice(1);
};

/**
 * Common aria-labels for standard actions
 */
export const ARIA_LABELS = {
  // Navigation
  CLOSE: "Close",
  OPEN: "Open",
  EXPAND: "Expand",
  COLLAPSE: "Collapse",
  BACK: "Go back",
  NEXT: "Next",
  PREVIOUS: "Previous",
  MENU: "Menu",

  // CRUD Operations
  ADD: "Add",
  CREATE: "Create",
  EDIT: "Edit",
  DELETE: "Delete",
  SAVE: "Save",
  CANCEL: "Cancel",
  SUBMIT: "Submit",
  RESET: "Reset",

  // Actions
  SEARCH: "Search",
  FILTER: "Filter",
  SORT: "Sort",
  DOWNLOAD: "Download",
  UPLOAD: "Upload",
  EXPORT: "Export",
  IMPORT: "Import",
  REFRESH: "Refresh",
  SYNC: "Sync",

  // UI Controls
  TOGGLE: "Toggle",
  SETTINGS: "Settings",
  HELP: "Help",
  INFO: "Information",
  WARNING: "Warning",
  ERROR: "Error",
  SUCCESS: "Success",

  // User Account
  PROFILE: "User profile",
  LOGOUT: "Log out",
  LOGIN: "Log in",
  SIGNUP: "Sign up",
  ACCOUNT: "Account settings",

  // Document/File
  PRINT: "Print",
  SHARE: "Share",
  ATTACH: "Attach file",
  REMOVE_ATTACHMENT: "Remove attachment",
  VIEW_ATTACHMENT: "View attachment",

  // Tables/Lists
  SELECT_ALL: "Select all",
  DESELECT_ALL: "Deselect all",
  DUPLICATE: "Duplicate",
  MOVE: "Move",
  PIN: "Pin",
  UNPIN: "Unpin",
} as const;

/**
 * Generate unique field ID for form inputs
 * @param fieldName The name of the field (e.g., "email", "password")
 * @param context Optional context for uniqueness (e.g., "login-form")
 */
export const getFieldId = (fieldName: string, context?: string): string => {
  if (context) {
    return `${context}-${fieldName}`.toLowerCase().replace(/\s+/g, "-");
  }
  return fieldName.toLowerCase().replace(/\s+/g, "-");
};

/**
 * Check if element needs aria-label (for icon-only elements)
 */
export const needsAriaLabel = (hasText: boolean, hasTitle: boolean): boolean => {
  return !hasText && !hasTitle;
};

/**
 * WCAG 2.2 Level A: Common aria-live regions
 */
export const ARIA_LIVE_REGIONS = {
  POLITE: "polite" as const,
  ASSERTIVE: "assertive" as const,
  OFF: "off" as const,
} as const;

/**
 * Generate aria-label for search/filter input
 */
export const getSearchAriaLabel = (placeholder?: string): string => {
  return `Search ${placeholder?.toLowerCase() || "items"}`;
};

/**
 * Generate aria-label for status/badge
 */
export const getStatusAriaLabel = (status: string): string => {
  return `Status: ${status}`;
};

/**
 * Generate aria-label for delete confirmation
 */
export const getDeleteAriaLabel = (itemType: string): string => {
  return `Delete ${itemType}. This action cannot be undone.`;
};

/**
 * WCAG 2.2: Helper to announce dynamic content changes
 * Use with aria-live="polite" for non-critical updates
 * Use with aria-live="assertive" for critical updates
 */
export const announceToScreenReader = (
  message: string,
  priority: "polite" | "assertive" = "polite"
): void => {
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
};
