import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface VerticalTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: number;
}

interface VerticalTabsProps {
  tabs: VerticalTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function VerticalTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: VerticalTabsProps) {
  return (
    <nav
      className={cn("flex flex-col gap-1", className)}
      aria-label="Vertical navigation tabs"
      data-testid="vertical-tabs-nav"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            aria-current={isActive ? "page" : undefined}
            aria-label={tab.label}
            data-testid={`tab-${tab.id}`}
            className={cn(
              // Base styles
              "group relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2",
              // Active state
              isActive && [
                "bg-gray-100 text-black",
                "dark:bg-neutral-800 dark:text-white",
              ],
              // Inactive state
              !isActive && [
                "text-gray-600 hover:bg-gray-50 hover:text-black",
                "dark:text-gray-400 dark:hover:bg-neutral-800/50 dark:hover:text-white",
              ],
              // Disabled state
              tab.disabled && "opacity-50 cursor-not-allowed",
              // Hover effect (active:scale-95 on click)
              !tab.disabled && "active:scale-95"
            )}
          >
            {/* Icon */}
            {Icon && (
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-black dark:text-white"
                    : "text-gray-500 group-hover:text-black dark:text-gray-500 dark:group-hover:text-white"
                )}
                aria-hidden="true"
              />
            )}

            {/* Label */}
            <span className="flex-1 text-left truncate">{tab.label}</span>

            {/* Badge */}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full min-w-[1.25rem]",
                  isActive
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300"
                )}
                aria-label={`${tab.badge} items`}
                data-testid={`badge-${tab.id}`}
              >
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}

            {/* Active indicator - left border */}
            {isActive && (
              <span
                className="absolute left-0 top-0 bottom-0 w-1 bg-black dark:bg-white rounded-r"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

interface ConsolidatedPageLayoutProps {
  tabs: VerticalTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  header?: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  };
}

export function ConsolidatedPageLayout({
  tabs,
  activeTab,
  onTabChange,
  children,
  header,
}: ConsolidatedPageLayoutProps) {
  return (
    <div className="h-full flex flex-col" data-testid="consolidated-page-layout">
      {/* Header */}
      {header && (
        <div className="border-b bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white" data-testid="page-title">
                {header.title}
              </h1>
              {header.description && (
                <p className="text-sm text-gray-500 mt-1" data-testid="page-description">
                  {header.description}
                </p>
              )}
            </div>
            {header.actions && (
              <div className="flex items-center gap-2" data-testid="page-actions">
                {header.actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content area with vertical tabs */}
      <div className="flex flex-1 overflow-hidden">
        {/* Vertical tabs sidebar - Desktop */}
        <aside
          className="hidden md:flex md:flex-col w-64 border-r bg-background p-4 overflow-y-auto"
          aria-label="Page sections"
          data-testid="vertical-tabs-sidebar"
        >
          <VerticalTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </aside>

        {/* Horizontal tabs - Mobile */}
        <div className="md:hidden w-full border-b bg-background">
          <div className="overflow-x-auto">
            <div className="flex gap-1 p-2 min-w-max" data-testid="horizontal-tabs-mobile">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    disabled={tab.disabled}
                    aria-current={isActive ? "page" : undefined}
                    data-testid={`tab-mobile-${tab.id}`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors touch-manipulation",
                      "min-h-11", // Touch target minimum
                      isActive && "bg-gray-100 text-black dark:bg-neutral-800 dark:text-white",
                      !isActive && "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-neutral-800/50",
                      tab.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full min-w-[1.125rem]",
                          isActive
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-gray-300"
                        )}
                      >
                        {tab.badge > 99 ? "99+" : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content area */}
        <main
          className="flex-1 overflow-y-auto bg-background"
          role="main"
          data-testid="tab-content-area"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
