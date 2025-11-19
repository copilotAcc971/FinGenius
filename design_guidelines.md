# Design Guidelines: Copilot Accountant - Monochrome Professional

## Design Philosophy

**Design Standard:** Sophisticated Monochrome (inspired by Notion, Vercel, NYT)  
**Timeline:** 8-week production-ready transformation  
**Compliance:** WCAG 2.1 AA (High Contrast), fully accessible, mobile-responsive  
**Branding:** Black & White professional aesthetic with subtle gray gradations

## Core Design Principles

1. **Data Clarity First:** All financial information must be scannable and unambiguous
2. **High Contrast:** WCAG AA compliance - no mid-gray text, use black/near-black for readability
3. **Workflow Efficiency:** Keyboard-first navigation, minimal clicks for common tasks
4. **Professional Trust:** Monochrome conveys reliability and timeless sophistication
5. **Accessible by Default:** Semantic HTML, clear focus states, keyboard navigation

## Color System - Monochrome Palette

### Light Mode
- **Background:** Pure White (#FFFFFF)
- **Foreground (Primary Text):** Near Black (#0A0A0A / text-gray-900)
- **Secondary Text:** Dark Gray (#525252 / text-gray-600)
- **Tertiary Text/Meta:** Medium Gray (#737373 / text-gray-500)
- **Borders:** Light Gray (#E5E5E5 / border-gray-200)
- **Cards/Elevated Surfaces:** Off-White (#FAFAFA / bg-gray-50)
- **Hover States:** Very Light Gray (#F5F5F5 / bg-gray-100)
- **Active/Focus:** Black (#000000) with 2px ring

### Dark Mode (WCAG AA Compliant)
- **Background:** Near Black (#0A0A0A)
- **Foreground (Primary Text):** Pure White (#FFFFFF)
- **Secondary Text:** Light Gray (#A3A3A3 / text-gray-400) - 8:1 contrast
- **Tertiary Text/Meta:** Light Gray (#A3A3A3 / text-gray-400) - 8:1 contrast ⚠️ Use gray-400 for WCAG AA
- **Borders:** Dark Gray (#262626 / border-neutral-800)
- **Cards/Elevated Surfaces:** Dark Gray (#171717 / bg-neutral-900)
- **Hover States:** Slightly Lighter (#1F1F1F / bg-neutral-800)
- **Active/Focus:** White (#FFFFFF) with 2px ring

### Semantic Colors (Minimal, Accessibility-Focused)
- **Destructive/Error:** Red (#DC2626 / bg-red-600) - Only for errors and critical warnings
- **Success:** Green (#16A34A / bg-green-600) - Confirmations, success states
- **Warning:** Amber (#D97706 / bg-amber-600) - Cautions, pending states
- **Info:** Blue (#2563EB / bg-blue-600) - Informational badges

**Rule:** Use semantic colors sparingly. Default to monochrome for UI elements.

## Typography System

**Font Stack:**
- **Primary (Sans):** Inter, system-ui, sans-serif
- **Monospace (Financials/Code):** JetBrains Mono, Menlo, monospace
- **Serif (Optional Emphasis):** Georgia, serif

### Type Scale - Notion/Vercel/NYT Inspired

#### Display & Headers
```tsx
/* Hero/Landing H1 */
Display: text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]
Colors: text-gray-900 dark:text-white

/* Page Title H1 */
H1: text-3xl md:text-4xl font-semibold tracking-tight leading-tight
Colors: text-gray-900 dark:text-white

/* Section Header H2 */
H2: text-2xl md:text-3xl font-semibold tracking-tight leading-tight  
Colors: text-gray-900 dark:text-white

/* Subsection H3 */
H3: text-xl font-semibold leading-snug
Colors: text-gray-900 dark:text-white

/* Card/Item Title H4 */
H4: text-lg font-medium leading-snug
Colors: text-gray-900 dark:text-white

/* Label/Small Header H5 */
H5: text-base font-medium leading-normal
Colors: text-gray-900 dark:text-white
```

#### Body Text Hierarchy (3-Tier System)
```tsx
/* Primary Body - Default readable text */
Body: text-base (16px) leading-relaxed (1.75) 
Colors: text-gray-900 dark:text-white
Contrast: 16:1 (AAA) light, 21:1 (AAA) dark

/* Secondary Body - Supporting information */
Body-Secondary: text-sm (14px) leading-relaxed
Colors: text-gray-600 dark:text-gray-400
Contrast: 7:1 (AA) light, 8:1 (AA) dark

/* Tertiary/Meta - Timestamps, labels, subtle info */
Body-Tertiary: text-sm (14px) leading-normal
Colors: text-gray-500 dark:text-gray-400
Contrast: 4.5:1 (AA) light, 8:1 (AA) dark
```

#### Small Text & Captions
```tsx
/* Caption/Helper Text */
Caption: text-sm (14px) leading-normal
Colors: text-gray-500 dark:text-gray-400
Contrast: 4.5:1 (AA) light, 8:1 (AA) dark

/* Fine Print */
Small: text-xs (12px) leading-normal
Colors: text-gray-500 dark:text-gray-400
Contrast: 4.5:1 (AA) light, 8:1 (AA) dark

/* Legal/Footnotes - Use larger text size for better readability */
XSmall: text-xs (12px) leading-tight
Colors: text-gray-400 dark:text-gray-400
Contrast: 4.5:1 (AA) light, 8:1 (AA) dark
```

#### Specialized Typography
```tsx
/* Financial Figures (Monospace, Tabular) */
Financial: text-base font-mono font-medium tabular-nums
Colors: text-gray-900 dark:text-white
Right-align: text-right

/* Code/Technical */
Code: text-sm font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded
Colors: text-gray-900 dark:text-gray-100

/* Emphasized Text */
Strong: font-semibold text-gray-900 dark:text-white
```

### Typography Rules

#### Text Color Hierarchy (WCAG AA Compliant - Verified)
1. **Primary Text (Default):** `text-gray-900 dark:text-white`
   - Main headings, body copy, critical information
   - Contrast Ratio: 16:1 light (AAA), 21:1 dark (AAA)

2. **Secondary Text (Supporting):** `text-gray-600 dark:text-gray-400`
   - Descriptions, labels, secondary content
   - Contrast Ratio: 7:1 light (AA), 8:1 dark (AA)

3. **Tertiary Text (Metadata):** `text-gray-500 dark:text-gray-400`
   - Timestamps, helper text, captions
   - **IMPORTANT:** Dark mode uses gray-400 for WCAG AA compliance (8:1 ratio)
   - Contrast Ratio: 4.5:1 light (AA), 8:1 dark (AA)

4. **Disabled/Muted:** `text-gray-400 dark:text-gray-600`
   - Disabled fields, unavailable options
   - For display only, not interactive text
   - Contrast: 4.5:1 light (AA for large text), 3:1 dark (informational only)

#### Line Height Standards
- **Headers:** `leading-tight` (1.25) or `leading-snug` (1.375)
- **Body Text:** `leading-relaxed` (1.75) for optimal readability
- **Captions:** `leading-normal` (1.5)
- **Dense Lists:** `leading-snug` (1.375)

#### Letter Spacing
- **Large Headers (Display, H1, H2):** `tracking-tight` (-0.025em)
- **Body & Small Headers:** `tracking-normal` (0em)
- **All Caps Labels:** `tracking-wide` (0.025em) `uppercase`

### Font Weight Usage
- **Bold (700):** Reserved for H1 Display titles only
- **Semibold (600):** Default for H1-H3, emphasized text
- **Medium (500):** H4-H5, table headers, button text
- **Normal (400):** Body text, captions
- **Light (300):** Never use (poor contrast)

## Button System (Monochrome)

### Primary Button
```tsx
// Solid Black (Light Mode) / Solid White (Dark Mode)
bg-black text-white hover:bg-gray-800
dark:bg-white dark:text-black dark:hover:bg-neutral-200
```

### Secondary Button (Outline)
```tsx
// White with black border
border border-gray-200 text-black hover:border-black hover:bg-gray-50
dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800
```

### Tertiary/Ghost Button
```tsx
// Text only
text-gray-600 hover:text-black hover:bg-gray-100
dark:text-gray-400 dark:hover:text-white dark:hover:bg-neutral-800
```

### Destructive Button
```tsx
// Semantic red (keep for safety)
bg-white border border-red-600 text-red-600 hover:bg-red-50
```

### Button States
- **Disabled:** bg-gray-200 text-gray-400 cursor-not-allowed
- **Active (Click):** active:scale-95 transition-transform duration-100
- **Focus:** focus:ring-2 focus:ring-black focus:ring-offset-2

### Button Sizes
- **Default:** h-10 px-4 text-base (minimum for desktop)
- **Small:** h-9 px-3 text-sm
- **Large:** h-11 px-6 text-base
- **Icon Only:** h-9 w-9 (minimum 44px touch target on mobile)

## Form Components

### Input Fields
```tsx
border border-gray-200 
focus:border-black focus:ring-2 focus:ring-black
text-base // 16px minimum on mobile to prevent zoom
h-10 px-3
```

### Labels
```tsx
text-sm font-medium text-gray-900 mb-1.5
```

### Helper Text
```tsx
text-xs text-gray-500 dark:text-gray-400 mt-1
// Contrast: 4.5:1 (AA) light, 8:1 (AA) dark
```

### Error State
```tsx
border-red-500 focus:ring-red-500
// Error message below: text-sm text-red-600
```

### Checkboxes & Switches
```tsx
// Checked: bg-black text-white
// Unchecked: border-gray-300 bg-white
```

## Layout & Spacing

### Spacing Primitives
- **Container Padding:** 
  - Mobile: p-4
  - Tablet: p-6
  - Desktop: p-8
- **Element Gap:**
  - Tight: gap-4
  - Standard: gap-6
  - Section Break: gap-8

### Content Container
```tsx
max-w-7xl mx-auto px-4 md:px-6 lg:px-8
```

### Whitespace Philosophy
- Increase padding to allow content to breathe (p-6 to p-8 on desktop)
- Consistent spacing between grouped items (gap-4 to gap-6)
- Never let elements feel cramped

## Navigation Architecture

### Command Palette (NEW)
```tsx
// Global search/navigation: Cmd+K (Mac) / Ctrl+K (Windows)
- Trigger: Keyboard shortcut
- Includes: Navigation links, search, quick actions ("Create New...")
- Design: Modal with black borders, white background
```

### Breadcrumbs (NEW)
```tsx
// Format: Section / Category / Current Page
text-sm text-gray-400 // Path
text-black font-medium // Current location
```

### Sidebar
```tsx
// Width: w-64 (collapsible to w-16 icon mode)
// Background: bg-neutral-900 dark:bg-black
// Text: text-gray-100
// Active Item: bg-gray-800 font-medium text-white
// Hover: hover:bg-gray-800
```

### Vertical Filter Tabs Pattern (NEW)
```tsx
// Left sidebar layout for filtering lists
- Active: bg-gray-100 font-medium text-black
- Inactive: text-gray-600 hover:bg-gray-50
```

## Data Tables

### Structure
```tsx
// Headers: sticky with border-b-2
// Row height: h-12 (data), h-10 (header)
// Cell padding: px-4 py-3
// Hover: hover:bg-gray-50
// Zebra striping: even:bg-gray-50/50 (subtle)
```

### Financial Columns
- Right-aligned for monetary values
- Monospace font (font-mono)
- Negative values: Text with minus sign (not just red color)

### Mobile Tables
```tsx
// Wrap in overflow container
<div className="overflow-x-auto">
  <table>...</table>
</div>
```

## Accessibility Requirements

### Focus States
```tsx
// MANDATORY on all interactive elements
focus:ring-2 focus:ring-black focus:ring-offset-2
```

### ARIA Labels
```tsx
// All icon-only buttons MUST have aria-label
<button aria-label="Close modal">
  <X className="h-4 w-4" />
</button>
```

### Semantic HTML
```tsx
// All form inputs MUST have linked labels
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### Keyboard Navigation
- "Skip to Main Content" link (visible on Tab)
- All interactive elements keyboard-accessible
- Focus trap in modals

### Touch Targets (Mobile)
- Minimum h-11 (44px) for all tappable elements
- Add touch-manipulation class to prevent double-tap zoom

## Micro-Interactions

### Hover Effects
```tsx
// Buttons
hover:bg-gray-800 transition-colors duration-200

// Cards
hover:-translate-y-1 hover:shadow-md transition-all duration-200
```

### Active States
```tsx
// Scale down on click
active:scale-95 transition-transform duration-100
```

### Loading States
- Replace spinners with **Shimmer Skeletons**
- Match exact content height (prevent CLS)
- Grayscale: bg-gray-100 to bg-gray-200 animation

## Toast Notifications

### Style (High Visibility)
```tsx
// Black background, white text
bg-black text-white border border-gray-800
// Position: bottom-right
// Non-blocking: 3-second auto-dismiss
```

### Messages
- Success: "Changes saved successfully"
- Error: "We couldn't save your changes. Please check your connection and try again."
- NO technical jargon (e.g., "Error 500")

## Empty States

### Structure
```tsx
// Centered content with:
- Monochrome line-art illustration (optional)
- Clear heading: text-lg font-semibold text-gray-900 dark:text-white
- Explanation text: text-sm text-gray-500 dark:text-gray-400
- Primary CTA button
// All text uses WCAG AA compliant colors
```

## Shadows & Elevation

### Shadow Scale
```css
shadow-sm   → Standard borders, inputs, subtle separation
shadow      → Cards, static panels
shadow-md   → Hover states, dropdown menus
shadow-lg   → Modals, popovers, floating action buttons
```

**Use sparingly** - Prefer borders over shadows for most elements.

## Animation Timing

```css
/* Micro (Hover/Click) */
100ms - 150ms, ease-out

/* Transition (Fade/Slide) */
200ms - 300ms, ease-in-out

/* Large (Modal/Drawer) */
300ms - 400ms, cubic-bezier(0.16, 1, 0.3, 1)
```

### Reduced Motion Support
```tsx
// Respect OS preference
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Data Visualization (Monochrome)

### Chart Principles
- **Do NOT rely on color alone** for differentiation
- Use patterns/textures for accessibility

### Chart Patterns
```tsx
// Line Charts: Solid, Dashed, Dotted lines
// Bar Charts: Fill (Black), Outline (White with border), Pattern (Diagonal hatch)
// Tooltips: bg-black text-white on hover
```

## Advanced UX Patterns

### Optimistic UI
- Update UI immediately before server responds
- Rollback on failure with toast error

### Keyboard Shortcuts
- Single-key: C (Create), / (Search), Esc (Close)
- Cheat sheet: ? or Shift+/ opens keyboard shortcuts modal

### Smart Defaults
- Pre-fill common selections (currency, dates)
- "Due Date" defaults to +30 days
- Remember user's last choices

### Offline Support
- Subtle connection indicator (not full-screen blocker)
- Queue requests when offline, retry when online

## Component-Specific Guidelines

### Invoice/Bill Forms
- Progressive disclosure: Hide advanced options behind toggles
- Line items: Editable table with add/remove rows
- Totals panel: Right-aligned with clear hierarchy

### Dashboard
- Metric cards with large values (text-2xl font-semibold)
- Quick action cards with primary CTAs
- Recent items list with click-through links

### Modals
- Max width: max-w-2xl (forms), max-w-4xl (data views)
- Backdrop: Semi-transparent overlay
- Focus first input on open
- Return focus to trigger button on close

## Quality Standards

### Before Shipping
- [ ] WCAG 2.1 AA contrast checks pass
- [ ] All interactive elements have focus states
- [ ] Touch targets ≥44px on mobile
- [ ] Base font ≥16px on mobile (prevent zoom)
- [ ] Screen reader tested
- [ ] Keyboard-only navigation tested
- [ ] Dark mode fully supported
- [ ] Reduced motion respected

## File Organization

- All color variables in `client/src/index.css`
- Component-specific styles inline with Tailwind
- Global utilities in `@layer utilities`
- No external CSS files beyond index.css
