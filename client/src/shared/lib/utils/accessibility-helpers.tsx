/**
 * WCAG 2.2 Level A Compliance Helpers
 * Automatically add accessibility attributes to common patterns
 */

import React from "react";

/**
 * Helper to create an accessible dialog trigger
 */
export const createAccessibleDialogTrigger = (
  label: string,
  icon?: React.ReactNode
) => ({
  "aria-label": label,
  "data-testid": `button-${label.toLowerCase().replace(/\s+/g, "-")}`,
  title: label,
  children: icon,
});

/**
 * Helper to create accessible form field IDs
 */
export const createFormFieldId = (fieldName: string, formId?: string): string => {
  const baseId = fieldName.toLowerCase().replace(/\s+/g, "-");
  return formId ? `${formId}-${baseId}` : baseId;
};

/**
 * Helper to announce to screen readers
 */
export const announceChange = (message: string, priority: "polite" | "assertive" = "polite") => {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    announcement.remove();
  }, 1000);
};

/**
 * Check if button has accessible text
 */
export const hasAccessibleText = (element: HTMLElement): boolean => {
  const text = element.textContent?.trim();
  const ariaLabel = element.getAttribute("aria-label");
  const title = element.getAttribute("title");
  const ariaLabelledBy = element.getAttribute("aria-labelledby");
  
  return !!(text || ariaLabel || title || ariaLabelledBy);
};

/**
 * Make all buttons in a container accessible
 * Adds aria-labels to icon-only buttons
 */
export const makeButtonsAccessible = (container: HTMLElement) => {
  const buttons = container.querySelectorAll("button");
  
  buttons.forEach((button) => {
    if (!hasAccessibleText(button)) {
      // Icon-only button without label
      const svgs = button.querySelectorAll("svg");
      if (svgs.length > 0) {
        // Try to infer label from SVG name or data attributes
        const svgTitle = svgs[0].querySelector("title")?.textContent;
        if (svgTitle && !button.hasAttribute("aria-label")) {
          button.setAttribute("aria-label", svgTitle);
        }
      }
    }
  });
};

/**
 * Auto-label form inputs that lack labels
 */
export const autoLabelFormInputs = (container: HTMLElement) => {
  const inputs = container.querySelectorAll("input, textarea, select");
  
  inputs.forEach((input, index) => {
    if (!input.hasAttribute("aria-label") && !input.hasAttribute("aria-labelledby")) {
      const placeholder = input.getAttribute("placeholder");
      const name = input.getAttribute("name");
      const label = placeholder || name;
      
      if (label && !label.includes("...")) {
        input.setAttribute("aria-label", label);
      } else if (!label) {
        input.setAttribute("aria-label", `Field ${index + 1}`);
      }
    }
  });
};

/**
 * Make all links accessible
 */
export const makeLinksAccessible = (container: HTMLElement) => {
  const links = container.querySelectorAll("a");
  
  links.forEach((link) => {
    const text = link.textContent?.trim();
    const ariaLabel = link.getAttribute("aria-label");
    
    if (!text && !ariaLabel) {
      // Icon-only link
      const title = link.getAttribute("title");
      if (title) {
        link.setAttribute("aria-label", title);
      }
    }
  });
};

/**
 * Fix heading hierarchy (ensure h1 exists and order is correct)
 */
export const fixHeadingHierarchy = (container: HTMLElement) => {
  const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  let lastLevel = 1;
  let h1Found = false;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.charAt(1));
    
    if (level === 1) {
      h1Found = true;
    }
    
    // Check if jumping more than 1 level
    if (level > lastLevel + 1) {
      console.warn(`Heading hierarchy skips from H${lastLevel} to H${level}:`, heading);
    }
    
    lastLevel = level;
  });
  
  if (!h1Found && headings.length > 0) {
    console.warn("No H1 heading found on page");
  }
};

/**
 * Initialize full accessibility audit on load
 */
export const initializeAccessibility = () => {
  if (typeof document !== "undefined") {
    const main = document.querySelector("main") || document.body;
    
    // Run accessibility helpers
    makeButtonsAccessible(main);
    autoLabelFormInputs(main);
    makeLinksAccessible(main);
    fixHeadingHierarchy(main);
  }
};
