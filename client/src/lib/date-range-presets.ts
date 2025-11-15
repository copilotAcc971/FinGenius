import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from "date-fns";

export type DateRangePreset = 
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"
  | "custom";

export type ComparisonMode =
  | "previous-period"
  | "same-period-last-year"
  | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export interface PeriodComparison {
  current: DateRange;
  previous: DateRange;
}

export function getDateRangeForPreset(preset: DateRangePreset, referenceDate: Date = new Date()): DateRange {
  const today = referenceDate;

  switch (preset) {
    case "this-month":
      return {
        startDate: format(startOfMonth(today), "yyyy-MM-dd"),
        endDate: format(endOfMonth(today), "yyyy-MM-dd"),
        label: format(today, "MMMM yyyy")
      };

    case "last-month": {
      const lastMonth = subMonths(today, 1);
      return {
        startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
        label: format(lastMonth, "MMMM yyyy")
      };
    }

    case "this-quarter": {
      const qStart = startOfQuarter(today);
      const qEnd = endOfQuarter(today);
      return {
        startDate: format(qStart, "yyyy-MM-dd"),
        endDate: format(qEnd, "yyyy-MM-dd"),
        label: `Q${Math.floor(today.getMonth() / 3) + 1} ${format(today, "yyyy")}`
      };
    }

    case "last-quarter": {
      const lastQuarter = subQuarters(today, 1);
      const qStart = startOfQuarter(lastQuarter);
      const qEnd = endOfQuarter(lastQuarter);
      return {
        startDate: format(qStart, "yyyy-MM-dd"),
        endDate: format(qEnd, "yyyy-MM-dd"),
        label: `Q${Math.floor(lastQuarter.getMonth() / 3) + 1} ${format(lastQuarter, "yyyy")}`
      };
    }

    case "this-year":
      return {
        startDate: format(startOfYear(today), "yyyy-MM-dd"),
        endDate: format(endOfYear(today), "yyyy-MM-dd"),
        label: format(today, "yyyy")
      };

    case "last-year": {
      const lastYear = subYears(today, 1);
      return {
        startDate: format(startOfYear(lastYear), "yyyy-MM-dd"),
        endDate: format(endOfYear(lastYear), "yyyy-MM-dd"),
        label: format(lastYear, "yyyy")
      };
    }

    case "custom":
    default:
      return {
        startDate: format(today, "yyyy-MM-dd"),
        endDate: format(today, "yyyy-MM-dd"),
        label: "Custom Range"
      };
  }
}

export function getPreviousPeriod(
  currentStartDate: string,
  currentEndDate: string,
  comparisonMode: ComparisonMode
): DateRange {
  const start = new Date(currentStartDate);
  const end = new Date(currentEndDate);
  
  const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  switch (comparisonMode) {
    case "previous-period": {
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysDifference + 1);
      
      return {
        startDate: format(prevStart, "yyyy-MM-dd"),
        endDate: format(prevEnd, "yyyy-MM-dd"),
        label: `${format(prevStart, "MMM d, yyyy")} - ${format(prevEnd, "MMM d, yyyy")}`
      };
    }

    case "same-period-last-year": {
      const prevStart = subYears(start, 1);
      const prevEnd = subYears(end, 1);
      
      return {
        startDate: format(prevStart, "yyyy-MM-dd"),
        endDate: format(prevEnd, "yyyy-MM-dd"),
        label: `${format(prevStart, "MMM d, yyyy")} - ${format(prevEnd, "MMM d, yyyy")}`
      };
    }

    case "custom":
    default:
      return {
        startDate: currentStartDate,
        endDate: currentEndDate,
        label: "Custom Comparison"
      };
  }
}

export function getPeriodComparison(
  preset: DateRangePreset,
  comparisonMode: ComparisonMode,
  customCurrentStart?: string,
  customCurrentEnd?: string,
  customPreviousStart?: string,
  customPreviousEnd?: string
): PeriodComparison {
  if (preset === "custom" && customCurrentStart && customCurrentEnd) {
    const current: DateRange = {
      startDate: customCurrentStart,
      endDate: customCurrentEnd,
      label: `${format(new Date(customCurrentStart), "MMM d, yyyy")} - ${format(new Date(customCurrentEnd), "MMM d, yyyy")}`
    };

    if (comparisonMode === "custom" && customPreviousStart && customPreviousEnd) {
      return {
        current,
        previous: {
          startDate: customPreviousStart,
          endDate: customPreviousEnd,
          label: `${format(new Date(customPreviousStart), "MMM d, yyyy")} - ${format(new Date(customPreviousEnd), "MMM d, yyyy")}`
        }
      };
    }

    return {
      current,
      previous: getPreviousPeriod(customCurrentStart, customCurrentEnd, comparisonMode)
    };
  }

  const current = getDateRangeForPreset(preset);
  const previous = getPreviousPeriod(current.startDate, current.endDate, comparisonMode);

  return { current, previous };
}

export const dateRangePresetOptions = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "last-quarter", label: "Last Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom", label: "Custom Range" }
] as const;

export const comparisonModeOptions = [
  { value: "previous-period", label: "Previous Period" },
  { value: "same-period-last-year", label: "Same Period Last Year" },
  { value: "custom", label: "Custom Comparison" }
] as const;
