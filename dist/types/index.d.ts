export interface ErrorReporterConfig {
    projectToken: string;
    apiUrl: string;
    environment?: string;
    enabled?: boolean;
    userId?: string;
    userEmail?: string;
    customData?: Record<string, any>;
    debug?: boolean;
    maxBreadcrumbs?: number;
    commitHash?: string;
    version?: string;
    projectName?: string;
    maxRequestsPerMinute?: number;
    duplicateErrorWindow?: number;
    maxRetries?: number;
    initialRetryDelay?: number;
    maxRetryDelay?: number;
    enableOfflineSupport?: boolean;
    maxOfflineQueueSize?: number;
    offlineQueueMaxAge?: number;
    requestTimeout?: number;
    allowedDomains?: string[];
    requireHttps?: boolean;
}
export interface Breadcrumb {
    timestamp: number;
    message: string;
    category: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    data?: Record<string, any>;
}
export interface ErrorContext {
    url: string;
    userAgent: string;
    timestamp: number;
    userId?: string;
    userEmail?: string;
    customData?: Record<string, any>;
    breadcrumbs: Breadcrumb[];
}
export interface ErrorReport {
    message: string;
    stack?: string;
    type: string;
    file?: string;
    line?: number;
    column?: number;
    environment: string;
    context: ErrorContext;
    projectToken: string;
}
export interface ReactErrorInfo {
    componentStack: string;
}
export interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ReactErrorInfo;
}
//# sourceMappingURL=index.d.ts.map