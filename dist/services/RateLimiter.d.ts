interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    duplicateErrorWindow: number;
}
export declare class RateLimiter {
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
export {};
//# sourceMappingURL=RateLimiter.d.ts.map