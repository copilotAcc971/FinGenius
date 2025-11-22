/**
 * Focus Management Utilities - WCAG 2.2 Level AA Compliance
 * Ensures proper focus handling for dialogs, modals, and keyboard navigation
 */

let previouslyFocusedElement: Element | null = null;

export const focusManagement = {
  /**
   * Store the currently focused element before opening a modal/dialog
   */
  storeFocus: () => {
    previouslyFocusedElement = document.activeElement as Element | null;
  },

  /**
   * Restore focus to the previously focused element
   */
  restoreFocus: () => {
    if (previouslyFocusedElement instanceof HTMLElement) {
      previouslyFocusedElement.focus();
    }
  },

  /**
   * Trap focus within a container (for modals)
   */
  trapFocus: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  },

  /**
   * Check if an element is focusable
   */
  isFocusable: (element: Element): boolean => {
    if (element instanceof HTMLElement) {
      if (element.tabIndex > -1) return true;
      if (element.hasAttribute('href')) return true;
      if (!element.hasAttribute('disabled')) {
        const tagName = element.tagName.toLowerCase();
        return ['button', 'input', 'select', 'textarea'].includes(tagName);
      }
    }
    return false;
  },

  /**
   * Set focus on the first focusable element in a container
   */
  focusFirstElement: (container: HTMLElement) => {
    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    
    if (focusable) {
      setTimeout(() => focusable.focus(), 100);
    }
  },

  /**
   * Announce a message to screen readers
   */
  announceToScreenReader: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }
};
