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
export declare class SDKMonitor {
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
export {};
//# sourceMappingURL=SDKMonitor.d.ts.map