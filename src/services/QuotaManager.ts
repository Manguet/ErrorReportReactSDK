interface QuotaLimits {
  dailyLimit?: number;
  monthlyLimit?: number;
  payloadSizeLimit?: number;
  burstLimit?: number;
  burstWindowMs?: number;
}

interface QuotaUsage {
  dailyUsed: number;
  monthlyUsed: number;
  burstUsed: number;
  lastResetDaily: number;
  lastResetMonthly: number;
  lastResetBurst: number;
  totalBytesUsed: number;
}

export class QuotaManager {
  private limits: QuotaLimits;
  private usage: QuotaUsage;
  private storageKey = 'errorReporter_quota';

  constructor(limits: QuotaLimits = {}) {
    this.limits = {
      dailyLimit: 1000,
      monthlyLimit: 10000,
      payloadSizeLimit: 1024 * 1024, // 1MB
      burstLimit: 50,
      burstWindowMs: 60000, // 1 minute
      ...limits,
    };

    this.usage = this.loadUsageFromStorage();
    this.resetExpiredCounters();
  }

  canSendError(payloadSize?: number): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    this.resetExpiredCounters();

    // Check payload size
    if (payloadSize && this.limits.payloadSizeLimit && payloadSize > this.limits.payloadSizeLimit) {
      return {
        allowed: false,
        reason: `Payload size (${payloadSize}) exceeds limit (${this.limits.payloadSizeLimit})`,
      };
    }

    // Check daily limit
    if (this.limits.dailyLimit && this.usage.dailyUsed >= this.limits.dailyLimit) {
      const nextReset = this.getNextDailyReset();
      return {
        allowed: false,
        reason: `Daily limit (${this.limits.dailyLimit}) exceeded`,
        retryAfter: nextReset - Date.now(),
      };
    }

    // Check monthly limit
    if (this.limits.monthlyLimit && this.usage.monthlyUsed >= this.limits.monthlyLimit) {
      const nextReset = this.getNextMonthlyReset();
      return {
        allowed: false,
        reason: `Monthly limit (${this.limits.monthlyLimit}) exceeded`,
        retryAfter: nextReset - Date.now(),
      };
    }

    // Check burst limit
    if (this.limits.burstLimit && this.usage.burstUsed >= this.limits.burstLimit) {
      const nextReset = this.usage.lastResetBurst + this.limits.burstWindowMs!;
      return {
        allowed: false,
        reason: `Burst limit (${this.limits.burstLimit}) exceeded`,
        retryAfter: nextReset - Date.now(),
      };
    }

    return { allowed: true };
  }

  recordErrorSent(payloadSize?: number): void {
    this.resetExpiredCounters();

    this.usage.dailyUsed++;
    this.usage.monthlyUsed++;
    this.usage.burstUsed++;

    if (payloadSize) {
      this.usage.totalBytesUsed += payloadSize;
    }

    this.saveUsageToStorage();
  }

  getUsageStats(): {
    daily: { used: number; limit: number; percentUsed: number };
    monthly: { used: number; limit: number; percentUsed: number };
    burst: { used: number; limit: number; percentUsed: number };
    totalBytes: number;
    timeUntilDailyReset: number;
    timeUntilMonthlyReset: number;
    timeUntilBurstReset: number;
  } {
    this.resetExpiredCounters();

    return {
      daily: {
        used: this.usage.dailyUsed,
        limit: this.limits.dailyLimit || 0,
        percentUsed: this.limits.dailyLimit 
          ? (this.usage.dailyUsed / this.limits.dailyLimit) * 100 
          : 0,
      },
      monthly: {
        used: this.usage.monthlyUsed,
        limit: this.limits.monthlyLimit || 0,
        percentUsed: this.limits.monthlyLimit 
          ? (this.usage.monthlyUsed / this.limits.monthlyLimit) * 100 
          : 0,
      },
      burst: {
        used: this.usage.burstUsed,
        limit: this.limits.burstLimit || 0,
        percentUsed: this.limits.burstLimit 
          ? (this.usage.burstUsed / this.limits.burstLimit) * 100 
          : 0,
      },
      totalBytes: this.usage.totalBytesUsed,
      timeUntilDailyReset: this.getNextDailyReset() - Date.now(),
      timeUntilMonthlyReset: this.getNextMonthlyReset() - Date.now(),
      timeUntilBurstReset: Math.max(0, 
        (this.usage.lastResetBurst + this.limits.burstWindowMs!) - Date.now()
      ),
    };
  }

  updateLimits(newLimits: Partial<QuotaLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  resetUsage(): void {
    const now = Date.now();
    this.usage = {
      dailyUsed: 0,
      monthlyUsed: 0,
      burstUsed: 0,
      lastResetDaily: now,
      lastResetMonthly: now,
      lastResetBurst: now,
      totalBytesUsed: 0,
    };
    this.saveUsageToStorage();
  }

  isNearingLimit(threshold: number = 0.8): {
    daily: boolean;
    monthly: boolean;
    burst: boolean;
  } {
    const stats = this.getUsageStats();
    
    return {
      daily: stats.daily.percentUsed / 100 >= threshold,
      monthly: stats.monthly.percentUsed / 100 >= threshold,
      burst: stats.burst.percentUsed / 100 >= threshold,
    };
  }

  private resetExpiredCounters(): void {
    const now = Date.now();

    // Reset daily counter
    if (this.shouldResetDaily(now)) {
      this.usage.dailyUsed = 0;
      this.usage.lastResetDaily = this.getDayStartTimestamp(now);
    }

    // Reset monthly counter
    if (this.shouldResetMonthly(now)) {
      this.usage.monthlyUsed = 0;
      this.usage.lastResetMonthly = this.getMonthStartTimestamp(now);
    }

    // Reset burst counter
    if (this.shouldResetBurst(now)) {
      this.usage.burstUsed = 0;
      this.usage.lastResetBurst = now;
    }
  }

  private shouldResetDaily(now: number): boolean {
    const dayStart = this.getDayStartTimestamp(now);
    return this.usage.lastResetDaily < dayStart;
  }

  private shouldResetMonthly(now: number): boolean {
    const monthStart = this.getMonthStartTimestamp(now);
    return this.usage.lastResetMonthly < monthStart;
  }

  private shouldResetBurst(now: number): boolean {
    return now - this.usage.lastResetBurst >= this.limits.burstWindowMs!;
  }

  private getDayStartTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private getMonthStartTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private getNextDailyReset(): number {
    const now = Date.now();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
    return this.getDayStartTimestamp(tomorrow.getTime());
  }

  private getNextMonthlyReset(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.getTime();
  }

  private loadUsageFromStorage(): QuotaUsage {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          dailyUsed: parsed.dailyUsed || 0,
          monthlyUsed: parsed.monthlyUsed || 0,
          burstUsed: parsed.burstUsed || 0,
          lastResetDaily: parsed.lastResetDaily || Date.now(),
          lastResetMonthly: parsed.lastResetMonthly || Date.now(),
          lastResetBurst: parsed.lastResetBurst || Date.now(),
          totalBytesUsed: parsed.totalBytesUsed || 0,
        };
      }
    } catch (error) {
      console.warn('[QuotaManager] Failed to load usage from storage:', error);
    }

    // Return default usage
    const now = Date.now();
    return {
      dailyUsed: 0,
      monthlyUsed: 0,
      burstUsed: 0,
      lastResetDaily: now,
      lastResetMonthly: now,
      lastResetBurst: now,
      totalBytesUsed: 0,
    };
  }

  private saveUsageToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.usage));
    } catch (error) {
      console.warn('[QuotaManager] Failed to save usage to storage:', error);
    }
  }
}