// LocalStorage utilities for sidebar state management

export interface RecentPage {
  title: string;
  url: string;
  icon: string;
  timestamp: number;
}

// Favorites management
export function getFavorites(): string[] {
  try {
    const stored = localStorage.getItem('sidebar-favorites');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading favorites from localStorage:', error);
    return [];
  }
}

export function toggleFavorite(url: string): void {
  try {
    const favorites = getFavorites();
    const index = favorites.indexOf(url);
    
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(url);
    }
    
    localStorage.setItem('sidebar-favorites', JSON.stringify(favorites));
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}

export function isFavorite(url: string): boolean {
  const favorites = getFavorites();
  return favorites.includes(url);
}

// Recent pages management
export function getRecentPages(): RecentPage[] {
  try {
    const stored = localStorage.getItem('sidebar-recent-pages');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading recent pages from localStorage:', error);
    return [];
  }
}

export function addRecentPage(page: Omit<RecentPage, 'timestamp'>): void {
  try {
    const recentPages = getRecentPages();
    
    // Remove existing entry for this URL
    const filtered = recentPages.filter(p => p.url !== page.url);
    
    // Add new entry at the beginning
    const updated = [{ ...page, timestamp: Date.now() }, ...filtered];
    
    // Keep only last 5
    const limited = updated.slice(0, 5);
    
    localStorage.setItem('sidebar-recent-pages', JSON.stringify(limited));
  } catch (error) {
    console.error('Error adding recent page:', error);
  }
}

// Group collapse state management
export function getGroupCollapsedState(groupName: string): boolean {
  try {
    const key = `sidebar-group-${groupName}-collapsed`;
    const stored = localStorage.getItem(key);
    return stored === 'true';
  } catch (error) {
    console.error('Error reading group collapsed state:', error);
    return false;
  }
}

export function setGroupCollapsedState(groupName: string, collapsed: boolean): void {
  try {
    const key = `sidebar-group-${groupName}-collapsed`;
    localStorage.setItem(key, String(collapsed));
  } catch (error) {
    console.error('Error setting group collapsed state:', error);
  }
}
