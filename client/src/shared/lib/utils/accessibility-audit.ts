/**
 * WCAG 2.2 Level A Audit & Auto-Fix Script
 * Run this in browser console to audit and fix accessibility issues
 */

interface AccessibilityReport {
  total: number;
  iconButtonsWithoutLabel: number;
  inputsWithoutLabel: number;
  imagesWithoutAlt: number;
  headingHierarchyIssues: number;
  duplicateIds: number;
  issues: string[];
}

export function auditAccessibility(): AccessibilityReport {
  const report: AccessibilityReport = {
    total: 0,
    iconButtonsWithoutLabel: 0,
    inputsWithoutLabel: 0,
    imagesWithoutAlt: 0,
    headingHierarchyIssues: 0,
    duplicateIds: 0,
    issues: [],
  };

  // 1. Check for icon-only buttons without aria-labels
  const allButtons = document.querySelectorAll("button");
  allButtons.forEach((button) => {
    const text = button.textContent?.trim();
    const ariaLabel = button.getAttribute("aria-label");
    const hasSvg = button.querySelector("svg");

    if (!text && hasSvg && !ariaLabel) {
      report.iconButtonsWithoutLabel++;
      report.issues.push(`Icon button without aria-label: ${button.className}`);
    }
  });

  // 2. Check for form inputs without labels
  const inputs = document.querySelectorAll("input, textarea, select");
  inputs.forEach((input) => {
    const ariaLabel = input.getAttribute("aria-label");
    const id = input.getAttribute("id");
    const labelFor = id ? document.querySelector(`label[for="${id}"]`) : null;

    if (!ariaLabel && !labelFor) {
      report.inputsWithoutLabel++;
      report.issues.push(`Form input without label: ${input.getAttribute("name") || input.className}`);
    }
  });

  // 3. Check for images without alt text
  const images = document.querySelectorAll("img");
  images.forEach((img) => {
    const alt = img.getAttribute("alt");
    if (!alt) {
      report.imagesWithoutAlt++;
      report.issues.push(`Image without alt text: ${img.src}`);
    }
  });

  // 4. Check heading hierarchy
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  let lastLevel = 0;
  let h1Found = false;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.charAt(1));
    if (level === 1) h1Found = true;
    if (level > lastLevel + 1) {
      report.headingHierarchyIssues++;
      report.issues.push(`Heading hierarchy skip: ${heading.tagName} after H${lastLevel}`);
    }
    lastLevel = level;
  });

  if (!h1Found) {
    report.headingHierarchyIssues++;
    report.issues.push("No H1 heading found on page");
  }

  // 5. Check for duplicate IDs
  const allIds = new Map<string, number>();
  document.querySelectorAll("[id]").forEach((el) => {
    const id = el.getAttribute("id");
    if (id) {
      allIds.set(id, (allIds.get(id) || 0) + 1);
    }
  });

  allIds.forEach((count, id) => {
    if (count > 1) {
      report.duplicateIds++;
      report.issues.push(`Duplicate ID: ${id} (found ${count} times)`);
    }
  });

  report.total =
    report.iconButtonsWithoutLabel +
    report.inputsWithoutLabel +
    report.imagesWithoutAlt +
    report.headingHierarchyIssues +
    report.duplicateIds;

  return report;
}

/**
 * Auto-fix common accessibility issues
 */
export function autoFixAccessibility(): void {
  // Fix icon-only buttons
  document.querySelectorAll("button").forEach((button) => {
    const text = button.textContent?.trim();
    const ariaLabel = button.getAttribute("aria-label");
    const hasSvg = button.querySelector("svg");

    if (!text && hasSvg && !ariaLabel) {
      const title = button.getAttribute("title");
      if (title) {
        button.setAttribute("aria-label", title);
      } else {
        button.setAttribute("aria-label", "Button");
      }
    }
  });

  // Fix form inputs
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    const ariaLabel = input.getAttribute("aria-label");
    const id = input.getAttribute("id");
    const placeholder = input.getAttribute("placeholder");
    const name = input.getAttribute("name");

    if (!ariaLabel) {
      const label = placeholder || name || `Field ${Math.random()}`;
      input.setAttribute("aria-label", label);
    }
  });

  // Fix images
  document.querySelectorAll("img").forEach((img) => {
    const alt = img.getAttribute("alt");
    if (!alt) {
      const src = img.getAttribute("src") || "image";
      img.setAttribute("alt", src);
    }
  });
}

/**
 * Run audit and log results
 */
export function logAccessibilityReport(): void {
  const report = auditAccessibility();
  console.group("WCAG 2.2 Level A Accessibility Audit");
  console.log(`Total issues found: ${report.total}`);
  console.log(`Icon buttons without labels: ${report.iconButtonsWithoutLabel}`);
  console.log(`Form inputs without labels: ${report.inputsWithoutLabel}`);
  console.log(`Images without alt text: ${report.imagesWithoutAlt}`);
  console.log(`Heading hierarchy issues: ${report.headingHierarchyIssues}`);
  console.log(`Duplicate IDs: ${report.duplicateIds}`);
  console.log("Issues:", report.issues);
  console.groupEnd();
}
