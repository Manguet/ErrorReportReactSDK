export interface UseErrorReporter {
    reportError: (error: Error, additionalData?: Record<string, any>) => Promise<void>;
    reportMessage: (message: string, level?: 'info' | 'warning' | 'error', additionalData?: Record<string, any>) => Promise<void>;
    addBreadcrumb: (message: string, category?: string, level?: 'info' | 'warning' | 'error' | 'debug', data?: Record<string, any>) => void;
    logUserAction: (action: string, data?: Record<string, any>) => void;
    logNavigation: (from: string, to: string, data?: Record<string, any>) => void;
    setUserId: (userId: string) => void;
    setUserEmail: (email: string) => void;
    setCustomData: (data: Record<string, any>) => void;
    clearBreadcrumbs: () => void;
    isEnabled: () => boolean;
    getStats: () => {
        queueSize: number;
        isOnline: boolean;
        rateLimitRemaining: number;
        rateLimitReset: number;
    };
    flushQueue: () => Promise<void>;
    updateConfig: (updates: Partial<import('../types').ErrorReporterConfig>) => void;
}
export declare const useErrorReporter: () => UseErrorReporter;
//# sourceMappingURL=useErrorReporter.d.ts.map