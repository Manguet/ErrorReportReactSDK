interface QuotaLimits {
    dailyLimit?: number;
    monthlyLimit?: number;
    payloadSizeLimit?: number;
    burstLimit?: number;
    burstWindowMs?: number;
}
export declare class QuotaManager {
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
export {};
//# sourceMappingURL=QuotaManager.d.ts.map