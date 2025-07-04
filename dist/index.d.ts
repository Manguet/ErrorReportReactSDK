import * as react_jsx_runtime from 'react/jsx-runtime';
import React, { Component, ReactNode } from 'react';

interface ErrorReporterConfig {
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
interface Breadcrumb {
    timestamp: number;
    message: string;
    category: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    data?: Record<string, any>;
}
interface ErrorContext {
    url: string;
    userAgent: string;
    timestamp: number;
    userId?: string;
    userEmail?: string;
    customData?: Record<string, any>;
    breadcrumbs: Breadcrumb[];
}
interface ErrorReport {
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
interface ReactErrorInfo {
    componentStack: string;
}
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ReactErrorInfo;
}

interface SDKMetrics {
    errorsReported: number;
    errorsDropped: number;
    requestsSuccessful: number;
    requestsFailed: number;
    averageResponseTime: number;
    queueSize: number;
    retryAttempts: number;
    bytesTransmitted: number;
    lastErrorTime?: number;
    lastSuccessTime?: number;
    uptime: number;
}
declare class SDKMonitor {
    private metrics;
    private performanceLog;
    private startTime;
    private maxLogEntries;
    constructor();
    recordErrorReported(size?: number): void;
    recordErrorDropped(reason: 'rate_limit' | 'validation' | 'size' | 'other'): void;
    recordRequestStart(): string;
    recordRequestSuccess(requestId: string, size?: number): void;
    recordRequestFailure(requestId: string, error?: Error): void;
    recordRetryAttempt(): void;
    recordQueueSize(size: number): void;
    getMetrics(): Readonly<SDKMetrics>;
    getHealthStatus(): {
        status: 'healthy' | 'warning' | 'critical';
        issues: string[];
        recommendations: string[];
    };
    getPerformanceTrends(): {
        responseTimeHistory: Array<{
            timestamp: number;
            duration: number;
        }>;
        successRate: number;
        averagePayloadSize: number;
    };
    exportMetrics(): string;
    reset(): void;
    private updateUptime;
    private updateAverageResponseTime;
    private addPerformanceEntry;
    private shouldLogPerformanceIssue;
}

interface QuotaLimits {
    dailyLimit?: number;
    monthlyLimit?: number;
    payloadSizeLimit?: number;
    burstLimit?: number;
    burstWindowMs?: number;
}
declare class QuotaManager {
    private limits;
    private usage;
    private storageKey;
    constructor(limits?: QuotaLimits);
    canSendError(payloadSize?: number): {
        allowed: boolean;
        reason?: string;
        retryAfter?: number;
    };
    recordErrorSent(payloadSize?: number): void;
    getUsageStats(): {
        daily: {
            used: number;
            limit: number;
            percentUsed: number;
        };
        monthly: {
            used: number;
            limit: number;
            percentUsed: number;
        };
        burst: {
            used: number;
            limit: number;
            percentUsed: number;
        };
        totalBytes: number;
        timeUntilDailyReset: number;
        timeUntilMonthlyReset: number;
        timeUntilBurstReset: number;
    };
    updateLimits(newLimits: Partial<QuotaLimits>): void;
    resetUsage(): void;
    isNearingLimit(threshold?: number): {
        daily: boolean;
        monthly: boolean;
        burst: boolean;
    };
    private resetExpiredCounters;
    private shouldResetDaily;
    private shouldResetMonthly;
    private shouldResetBurst;
    private getDayStartTimestamp;
    private getMonthStartTimestamp;
    private getNextDailyReset;
    private getNextMonthlyReset;
    private loadUsageFromStorage;
    private saveUsageToStorage;
}

declare class ErrorReporter {
    private config;
    private breadcrumbManager;
    private retryManager;
    private rateLimiter;
    private offlineManager;
    private securityValidator;
    private sdkMonitor;
    private quotaManager;
    private isInitialized;
    private cleanupInterval;
    constructor(config: ErrorReporterConfig);
    private initialize;
    private setupGlobalHandlers;
    private interceptConsole;
    private interceptFetch;
    private trackNavigation;
    private createErrorContext;
    reportError(error: Error, additionalData?: Record<string, any>): Promise<void>;
    reportMessage(message: string, level?: 'info' | 'warning' | 'error', additionalData?: Record<string, any>): Promise<void>;
    private sendReport;
    private sendReportDirectly;
    private extractFilename;
    private extractLineNumber;
    addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error' | 'debug', data?: Record<string, any>): void;
    logUserAction(action: string, data?: Record<string, any>): void;
    logNavigation(from: string, to: string, data?: Record<string, any>): void;
    setUserId(userId: string): void;
    setUserEmail(email: string): void;
    setCustomData(data: Record<string, any>): void;
    clearBreadcrumbs(): void;
    isEnabled(): boolean;
    destroy(): void;
    getStats(): {
        queueSize: number;
        isOnline: boolean;
        rateLimitRemaining: number;
        rateLimitReset: number;
        sdkMetrics: ReturnType<SDKMonitor['getMetrics']>;
        quotaUsage: ReturnType<QuotaManager['getUsageStats']>;
        healthStatus: ReturnType<SDKMonitor['getHealthStatus']>;
    };
    flushQueue(): Promise<void>;
    updateConfig(updates: Partial<ErrorReporterConfig>): void;
    private validateConfiguration;
}

declare class BreadcrumbManager {
    private breadcrumbs;
    private maxBreadcrumbs;
    constructor(maxBreadcrumbs?: number);
    addBreadcrumb(message: string, category?: string, level?: Breadcrumb['level'], data?: Record<string, any>): void;
    getBreadcrumbs(): Breadcrumb[];
    clearBreadcrumbs(): void;
    logNavigation(from: string, to: string, data?: Record<string, any>): void;
    logUserAction(action: string, data?: Record<string, any>): void;
    logHttpRequest(method: string, url: string, statusCode?: number, data?: Record<string, any>): void;
    logConsole(level: string, message: string, data?: Record<string, any>): void;
    logClick(element: string, data?: Record<string, any>): void;
}

interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}
declare class RetryManager {
    private config;
    private retryCount;
    constructor(config?: Partial<RetryConfig>);
    executeWithRetry<T>(operation: () => Promise<T>, operationId?: string): Promise<T>;
    isRetrying(operationId: string): boolean;
    getRetryCount(operationId: string): number;
    clearRetryCount(operationId: string): void;
}

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    duplicateErrorWindow: number;
}
declare class RateLimiter {
    private config;
    private requests;
    private recentErrors;
    constructor(config?: Partial<RateLimitConfig>);
    canMakeRequest(key?: string): boolean;
    canReportError(errorFingerprint: string): boolean;
    createErrorFingerprint(error: Error, additionalData?: Record<string, any>): string;
    getRemainingRequests(key?: string): number;
    getResetTime(key?: string): number;
    cleanup(): void;
}

interface QueuedReport {
    report: ErrorReport;
    timestamp: number;
    attempts: number;
}
declare class OfflineManager {
    private queue;
    private isOnline;
    private maxQueueSize;
    private maxAge;
    constructor(maxQueueSize?: number, maxAge?: number);
    private setupNetworkListeners;
    private loadPersistedQueue;
    private persistQueue;
    private cleanupOldReports;
    queueReport(report: ErrorReport): void;
    processQueue(): Promise<void>;
    private sendReport;
    setSendReportFunction(sendFn: (report: ErrorReport) => Promise<void>): void;
    isOnlineNow(): boolean;
    getQueueSize(): number;
    clearQueue(): void;
    getQueuedReports(): readonly QueuedReport[];
}

interface SecurityConfig {
    allowedDomains?: string[];
    requireHttps?: boolean;
    validateToken?: boolean;
    maxPayloadSize?: number;
}
declare class SecurityValidator {
    private config;
    constructor(config?: SecurityConfig);
    validateApiUrl(url: string): {
        isValid: boolean;
        error?: string;
    };
    validateProjectToken(token: string): {
        isValid: boolean;
        error?: string;
    };
    validatePayloadSize(payload: string): {
        isValid: boolean;
        error?: string;
    };
    sanitizeData(data: Record<string, any>): Record<string, any>;
    private isSuspiciousUrl;
    private containsSuspiciousPatterns;
    private sanitizeString;
    private isProductionEnvironment;
    updateConfig(config: Partial<SecurityConfig>): void;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, errorInfo: ReactErrorInfo) => ReactNode);
    onError?: (error: Error, errorInfo: ReactErrorInfo) => void;
    errorReporter?: ErrorReporter;
}
declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void;
    render(): string | number | boolean | Iterable<React.ReactNode> | react_jsx_runtime.JSX.Element | null | undefined;
}

interface ErrorReporterProviderProps {
    children: ReactNode;
    config: ErrorReporterConfig;
}
declare const ErrorReporterProvider: React.FC<ErrorReporterProviderProps>;

interface UseErrorReporter {
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
    updateConfig: (updates: Partial<ErrorReporterConfig>) => void;
}
declare const useErrorReporter: () => UseErrorReporter;

/**
 * Utility function to safely stringify objects for error reporting
 */
declare const safeStringify: (obj: any, space?: number) => string;
/**
 * Extract meaningful information from an error object
 */
declare const extractErrorInfo: (error: any) => {
    name: string;
    message: string;
    stack: string | undefined;
};
/**
 * Get user-friendly browser information
 */
declare const getBrowserInfo: () => {
    browser: string;
    version: string;
    userAgent: string;
    platform: string;
    language: string;
};
/**
 * Get performance information if available
 */
declare const getPerformanceInfo: () => {
    domContentLoaded: number;
    loadComplete: number;
    domInteractive: number;
    firstPaint: number | null;
} | null;
/**
 * Debounce function to limit rapid fire events
 */
declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
/**
 * Generate a unique session ID
 */
declare const generateSessionId: () => string;
/**
 * Check if we're in a development environment
 */
declare const isDevelopment: () => boolean;

export { BreadcrumbManager, ErrorBoundary, ErrorReporter, ErrorReporterProvider, OfflineManager, QuotaManager, RateLimiter, RetryManager, SDKMonitor, SecurityValidator, debounce, extractErrorInfo, generateSessionId, getBrowserInfo, getPerformanceInfo, isDevelopment, safeStringify, useErrorReporter };
export type { Breadcrumb, ErrorBoundaryState, ErrorContext, ErrorReport, ErrorReporterConfig, ReactErrorInfo };
