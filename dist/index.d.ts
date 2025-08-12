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
    enableBatching?: boolean;
    batchSize?: number;
    batchTimeout?: number;
    maxPayloadSize?: number;
    enableCompression?: boolean;
    compressionThreshold?: number;
    compressionLevel?: number;
    enableCircuitBreaker?: boolean;
    circuitBreakerFailureThreshold?: number;
    circuitBreakerTimeout?: number;
    circuitBreakerResetTimeout?: number;
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
interface BatchConfig {
    batchSize: number;
    batchTimeout: number;
    maxPayloadSize: number;
}
interface BatchStats {
    currentSize: number;
    totalBatches: number;
    totalErrors: number;
    averageBatchSize: number;
    lastSentAt?: number;
}
interface CompressionConfig {
    threshold: number;
    level: number;
}
interface CompressionStats {
    totalCompressions: number;
    totalDecompressions: number;
    totalBytesSaved: number;
    averageCompressionRatio: number;
    compressionTime: number;
}
interface CircuitBreakerConfig {
    failureThreshold: number;
    timeout: number;
    resetTimeout: number;
}
interface CircuitBreakerStats {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    successCount: number;
    lastFailureTime?: number;
    nextRetryTime?: number;
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

declare class BatchManager {
    private config;
    private currentBatch;
    private batchTimeout?;
    private stats;
    private sendFunction?;
    constructor(config?: Partial<BatchConfig>);
    configure(config: Partial<BatchConfig>): void;
    setSendFunction(sendFn: (errors: ErrorReport[]) => Promise<void>): void;
    addToBatch(error: ErrorReport): void;
    flush(): Promise<void>;
    getStats(): BatchStats;
    private shouldSendBatch;
    private calculatePayloadSize;
    private startBatchTimeout;
    private clearBatchTimeout;
    private sendBatch;
    private updateAverageBatchSize;
    updateConfig(newConfig: Partial<BatchConfig>): void;
    reset(): void;
}

declare class CompressionService {
    private config;
    private stats;
    constructor(config?: Partial<CompressionConfig>);
    configure(config: Partial<CompressionConfig>): void;
    isSupported(): boolean;
    shouldCompress(data: ErrorReport | ErrorReport[]): boolean;
    compress(data: ErrorReport | ErrorReport[]): Promise<string>;
    decompress(compressedData: string): Promise<ErrorReport | ErrorReport[]>;
    compressString(data: string): string;
    getStats(): CompressionStats;
    resetStats(): void;
    private updateCompressionStats;
    private arrayBufferToBase64;
    private base64ToArrayBuffer;
    updateConfig(newConfig: Partial<CompressionConfig>): void;
}

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
declare class CircuitBreaker {
    private config;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime?;
    private nextRetryTime?;
    constructor(config?: Partial<CircuitBreakerConfig>);
    configure(config: Partial<CircuitBreakerConfig>): void;
    execute<T>(operation: () => Promise<T>): Promise<T>;
    isCallAllowed(): boolean;
    onSuccess(): void;
    onFailure(): void;
    private tripCircuit;
    reset(): void;
    getState(): CircuitBreakerState;
    getStats(): CircuitBreakerStats;
    forceOpen(): void;
    forceClose(): void;
    isCircuitOpen(): boolean;
    getTimeUntilRetry(): number;
    updateConfig(newConfig: Partial<CircuitBreakerConfig>): void;
    getFailureRate(): number;
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
    private batchManager;
    private compressionService;
    private circuitBreaker;
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
    private sendBatchDirectly;
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
    flushBatch(): Promise<void>;
    getBatchStats(): ReturnType<BatchManager['getStats']> | null;
    getCompressionStats(): ReturnType<CompressionService['getStats']> | null;
    getCircuitBreakerStats(): ReturnType<CircuitBreaker['getStats']> | null;
    isCompressionSupported(): boolean;
    resetCompressionStats(): void;
    resetCircuitBreaker(): void;
    forceCircuitBreakerOpen(): void;
    forceCircuitBreakerClose(): void;
    isCircuitBreakerOpen(): boolean;
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
    private shouldRetryError;
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
    /**
     * Extract stack trace signature by taking the first N meaningful frames
     * and normalizing line numbers to avoid over-segmentation
     */
    private extractStackSignature;
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

export { BatchManager, BreadcrumbManager, CircuitBreaker, CompressionService, ErrorBoundary, ErrorReporter, ErrorReporterProvider, OfflineManager, QuotaManager, RateLimiter, RetryManager, SDKMonitor, SecurityValidator, debounce, extractErrorInfo, generateSessionId, getBrowserInfo, getPerformanceInfo, isDevelopment, safeStringify, useErrorReporter };
export type { BatchConfig, BatchStats, Breadcrumb, CircuitBreakerConfig, CircuitBreakerStats, CompressionConfig, CompressionStats, ErrorBoundaryState, ErrorContext, ErrorReport, ErrorReporterConfig, ReactErrorInfo };
