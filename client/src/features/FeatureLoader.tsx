// Feature-based code splitting for optimal bundle sizes
import { lazy, Suspense } from 'react';
import { PageSkeleton } from '@/shared/components/layout/page-skeleton';

// Loading component for features
const FeatureLoading = () => <PageSkeleton />;

// Core features - load eagerly as they're frequently used
export const CoreFeatures = {
  Dashboard: lazy(() => import('./dashboard/pages/dashboard-page')),
  Landing: lazy(() => import('./auth/pages/landing-page')),
};

// Income Module - lazy load as a single chunk
export const IncomeModule = lazy(() => import('./income'));

// Expenses Module - lazy load as a single chunk  
export const ExpensesModule = lazy(() => import('./expenses'));

// Accounting Module - lazy load as a single chunk
export const AccountingModule = lazy(() => import('./accounting'));

// Banking Module - lazy load as a single chunk
export const BankingModule = lazy(() => import('./banking'));

// Compliance Module - lazy load as a single chunk
export const ComplianceModule = lazy(() => import('./compliance'));

// Settings Module - lazy load as a single chunk
export const SettingsModule = lazy(() => import('./settings'));

// Feature wrapper with error boundary
export function FeatureWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FeatureLoading />}>
      {children}
    </Suspense>
  );
}

// Preload critical features
export function preloadCriticalFeatures() {
  // Preload dashboard and common features
  CoreFeatures.Dashboard.preload?.();
  
  // Preload based on user's most likely next actions
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for non-critical preloads
    const preloadQueue = [
      () => IncomeModule.preload?.(),
      () => ExpensesModule.preload?.(),
    ];
    
    if ('requestIdleCallback' in window) {
      preloadQueue.forEach(preload => {
        requestIdleCallback(preload, { timeout: 5000 });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        preloadQueue.forEach(preload => preload());
      }, 2000);
    }
  }
}

// Route-based preloading
export function preloadRouteModule(route: string) {
  if (route.startsWith('/income')) {
    IncomeModule.preload?.();
  } else if (route.startsWith('/expenses')) {
    ExpensesModule.preload?.();
  } else if (route.startsWith('/accounting')) {
    AccountingModule.preload?.();
  } else if (route.startsWith('/banking')) {
    BankingModule.preload?.();
  } else if (route.startsWith('/compliance')) {
    ComplianceModule.preload?.();
  } else if (route.startsWith('/settings')) {
    SettingsModule.preload?.();
  }
}