// Main exports
export { ErrorReporter } from './services/ErrorReporter';
export { BreadcrumbManager } from './services/BreadcrumbManager';
export { RetryManager } from './services/RetryManager';
export { RateLimiter } from './services/RateLimiter';
export { OfflineManager } from './services/OfflineManager';
export { SecurityValidator } from './services/SecurityValidator';
export { SDKMonitor } from './services/SDKMonitor';
export { QuotaManager } from './services/QuotaManager';

// React components and hooks
export { ErrorBoundary } from './components/ErrorBoundary';
export { ErrorReporterProvider } from './hooks/ErrorReporterProvider';
export { useErrorReporter } from './hooks/useErrorReporter';

// Types
export type {
  ErrorReporterConfig,
  Breadcrumb,
  ErrorContext,
  ErrorReport,
  ReactErrorInfo,
  ErrorBoundaryState,
} from './types';

// Utilities
export {
  safeStringify,
  extractErrorInfo,
  getBrowserInfo,
  getPerformanceInfo,
  debounce,
  generateSessionId,
  isDevelopment,
} from './utils';

// Note: Only named exports to avoid mixing default and named exports