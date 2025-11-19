import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * Hook to sync tab state with URL query parameters
 * @param defaultTab - The default tab to show if no query parameter is present
 * @returns [activeTab, setActiveTab] - Current tab and setter function
 */
export function useQueryTabState(defaultTab: string): [string, (tab: string) => void] {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  
  // Parse tab from URL query parameter
  const getTabFromUrl = (): string => {
    const params = new URLSearchParams(searchString);
    return params.get("tab") || defaultTab;
  };

  const [activeTab, setActiveTabState] = useState<string>(getTabFromUrl());

  // Sync tab state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlTab = getTabFromUrl();
    if (urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [searchString]);

  // Update both state and URL when tab changes
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const basePath = location.split("?")[0];
    setLocation(`${basePath}?tab=${tab}`);
  };

  return [activeTab, setActiveTab];
}
