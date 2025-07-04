/**
 * Utility function to safely stringify objects for error reporting
 */
export const safeStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }

      // Handle functions
      if (typeof value === 'function') {
        return '[Function]';
      }

      // Handle undefined
      if (value === undefined) {
        return '[Undefined]';
      }

      return value;
    },
    space
  );
};

/**
 * Extract meaningful information from an error object
 */
export const extractErrorInfo = (error: any) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'StringError',
      message: error,
      stack: undefined,
    };
  }

  return {
    name: 'UnknownError',
    message: safeStringify(error),
    stack: undefined,
  };
};

/**
 * Get user-friendly browser information
 */
export const getBrowserInfo = () => {
  const ua = navigator.userAgent;

  // Detect browser
  let browser = 'Unknown';
  let version = 'Unknown';

  if (ua.includes('Chrome')) {
    browser = 'Chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    const match = ua.match(/Version\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
    const match = ua.match(/Edge\/(\d+)/);
    version = match ? match[1] : 'Unknown';
  }

  return {
    browser,
    version,
    userAgent: ua,
    platform: navigator.platform,
    language: navigator.language,
  };
};

/**
 * Get performance information if available
 */
export const getPerformanceInfo = () => {
  if (!window.performance) {
    return null;
  }

  const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (!navigation) {
    return null;
  }

  return {
    domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
    loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
    domInteractive: Math.round(navigation.domInteractive - navigation.domContentLoadedEventStart),
    firstPaint: getFirstPaint(),
  };
};

/**
 * Get First Paint timing if available
 */
const getFirstPaint = () => {
  if (!window.performance || !window.performance.getEntriesByType) {
    return null;
  }

  const paintEntries = window.performance.getEntriesByType('paint');
  const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');

  return firstPaint ? Math.round(firstPaint.startTime) : null;
};

/**
 * Debounce function to limit rapid fire events
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Check if we're in a development environment
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
};

// Export performance utilities
export {
  throttle,
  createLazyLoader,
  truncateString,
  EventListenerManager,
  getBrowserCapabilities,
  createMinimalErrorReporter,
} from './performance';
