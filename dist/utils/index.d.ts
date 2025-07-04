/**
 * Utility function to safely stringify objects for error reporting
 */
export declare const safeStringify: (obj: any, space?: number) => string;
/**
 * Extract meaningful information from an error object
 */
export declare const extractErrorInfo: (error: any) => {
    name: string;
    message: string;
    stack: string | undefined;
};
/**
 * Get user-friendly browser information
 */
export declare const getBrowserInfo: () => {
    browser: string;
    version: string;
    userAgent: string;
    platform: string;
    language: string;
};
/**
 * Get performance information if available
 */
export declare const getPerformanceInfo: () => {
    domContentLoaded: number;
    loadComplete: number;
    domInteractive: number;
    firstPaint: number | null;
} | null;
/**
 * Debounce function to limit rapid fire events
 */
export declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
/**
 * Generate a unique session ID
 */
export declare const generateSessionId: () => string;
/**
 * Check if we're in a development environment
 */
export declare const isDevelopment: () => boolean;
export { throttle, createLazyLoader, truncateString, EventListenerManager, getBrowserCapabilities, createMinimalErrorReporter, } from './performance';
//# sourceMappingURL=index.d.ts.map