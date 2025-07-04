// Performance optimization utilities

// Debounce function to limit function calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function to limit function calls
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
};

// Lazy loading for heavy operations
export const createLazyLoader = <T>(loader: () => Promise<T>) => {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;
  
  return async (): Promise<T> => {
    if (cached) return cached;
    if (loading) return loading;
    
    loading = loader();
    cached = await loading;
    loading = null;
    
    return cached;
  };
};

// Memory-efficient string truncation
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

// Safe JSON serialization with circular reference handling
export const safeStringify = (obj: any, maxDepth: number = 10): string => {
  const seen = new WeakSet();
  
  const replacer = (key: string, value: any): any => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    
    // Truncate long strings
    if (typeof value === 'string' && value.length > 1000) {
      return truncateString(value, 1000);
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return '[Function]';
    }
    
    return value;
  };
  
  try {
    return JSON.stringify(obj, replacer);
  } catch (error) {
    return '[Serialization Error]';
  }
};

// Efficient event listener cleanup
export class EventListenerManager {
  private listeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  }> = [];
  
  add(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
  }
  
  cleanup(): void {
    this.listeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.listeners = [];
  }
}

// Browser capabilities detection
export const getBrowserCapabilities = (): {
  supportsLocalStorage: boolean;
  supportsSessionStorage: boolean;
  supportsFetch: boolean;
  supportsWebWorkers: boolean;
  supportsNavigationAPI: boolean;
} => {
  const capabilities = {
    supportsLocalStorage: false,
    supportsSessionStorage: false,
    supportsFetch: false,
    supportsWebWorkers: false,
    supportsNavigationAPI: false,
  };
  
  try {
    capabilities.supportsLocalStorage = 'localStorage' in window && window.localStorage !== null;
  } catch (e) {
    capabilities.supportsLocalStorage = false;
  }
  
  try {
    capabilities.supportsSessionStorage = 'sessionStorage' in window && window.sessionStorage !== null;
  } catch (e) {
    capabilities.supportsSessionStorage = false;
  }
  
  capabilities.supportsFetch = typeof fetch !== 'undefined';
  capabilities.supportsWebWorkers = typeof Worker !== 'undefined';
  capabilities.supportsNavigationAPI = 'navigation' in window;
  
  return capabilities;
};

// Lightweight bundle size optimization
export const createMinimalErrorReporter = () => {
  // This would be a tree-shakable minimal version
  // Only including essential features for smaller bundle size
  return {
    reportError: (error: Error) => {
      // Minimal implementation
      console.error('Error:', error);
    },
    isEnabled: () => true,
  };
};