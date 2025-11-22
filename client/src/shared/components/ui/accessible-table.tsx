import * as React from "react";

/**
 * WCAG 2.2 Level A: Accessible Table Wrapper
 * Ensures tables have proper semantic structure and accessibility
 */
interface AccessibleTableProps extends React.HTMLAttributes<HTMLTableElement> {
  caption?: string;
  ariaLabel?: string;
}

const AccessibleTable = React.forwardRef<HTMLTableElement, AccessibleTableProps>(
  ({ caption, ariaLabel, className, ...props }, ref) => {
    return (
      <table
        ref={ref}
        role="table"
        aria-label={ariaLabel}
        className={className}
        {...props}
      >
        {caption && (
          <caption className="sr-only text-sm font-medium">
            {caption}
          </caption>
        )}
        {props.children}
      </table>
    );
  }
);
AccessibleTable.displayName = "AccessibleTable";

/**
 * Table Header with proper semantics
 */
const AccessibleTableHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} role="rowgroup" {...props} />
));
AccessibleTableHead.displayName = "AccessibleTableHead";

/**
 * Table Body with proper semantics
 */
const AccessibleTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={className} role="rowgroup" {...props} />
));
AccessibleTableBody.displayName = "AccessibleTableBody";

/**
 * Table Row with proper semantics
 */
const AccessibleTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr ref={ref} className={className} role="row" {...props} />
));
AccessibleTableRow.displayName = "AccessibleTableRow";

/**
 * Table Header Cell - Use this for column headers
 */
interface AccessibleTableHeaderProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  scope?: "col" | "row";
  sortable?: boolean;
  sorted?: boolean;
}

const AccessibleTableHeader = React.forwardRef<
  HTMLTableCellElement,
  AccessibleTableHeaderProps
>(({ className, scope = "col", sortable, sorted, ...props }, ref) => (
  <th
    ref={ref}
    className={className}
    role="columnheader"
    scope={scope}
    aria-sort={
      sortable
        ? sorted
          ? "ascending"
          : "none"
        : undefined
    }
    {...props}
  />
));
AccessibleTableHeader.displayName = "AccessibleTableHeader";

/**
 * Table Data Cell - Use this for regular cells
 */
const AccessibleTableData = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={className} role="gridcell" {...props} />
));
AccessibleTableData.displayName = "AccessibleTableData";

export {
  AccessibleTable,
  AccessibleTableHead,
  AccessibleTableBody,
  AccessibleTableRow,
  AccessibleTableHeader,
  AccessibleTableData,
};
