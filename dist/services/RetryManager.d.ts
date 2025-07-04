interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}
export declare class RetryManager {
    private config;
    private retryCount;
    constructor(config?: Partial<RetryConfig>);
    executeWithRetry<T>(operation: () => Promise<T>, operationId?: string): Promise<T>;
    isRetrying(operationId: string): boolean;
    getRetryCount(operationId: string): number;
    clearRetryCount(operationId: string): void;
}
export {};
//# sourceMappingURL=RetryManager.d.ts.map