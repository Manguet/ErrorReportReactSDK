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
export interface BatchConfig {
    batchSize: number;
    batchTimeout: number;
    maxPayloadSize: number;
}
export interface BatchStats {
    currentSize: number;
    totalBatches: number;
    totalErrors: number;
    averageBatchSize: number;
    lastSentAt?: number;
}
export interface CompressionConfig {
    threshold: number;
    level: number;
}
export interface CompressionStats {
    totalCompressions: number;
    totalDecompressions: number;
    totalBytesSaved: number;
    averageCompressionRatio: number;
    compressionTime: number;
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    timeout: number;
    resetTimeout: number;
}
export interface CircuitBreakerStats {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    successCount: number;
    lastFailureTime?: number;
    nextRetryTime?: number;
}
//# sourceMappingURL=index.d.ts.map