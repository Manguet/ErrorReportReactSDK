import { QuotaManager } from '../../src/services/QuotaManager';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('QuotaManager', () => {
  let quotaManager: QuotaManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    quotaManager = new QuotaManager({
      dailyLimit: 10,
      monthlyLimit: 100,
      burstLimit: 5,
      burstWindowMs: 60000,
      payloadSizeLimit: 1000,
    });
  });

  describe('Initialization', () => {
    it('should initialize with default limits', () => {
      const manager = new QuotaManager();
      const stats = manager.getUsageStats();
      
      expect(stats.daily.limit).toBeGreaterThan(0);
      expect(stats.monthly.limit).toBeGreaterThan(0);
      expect(stats.burst.limit).toBeGreaterThan(0);
    });

    it('should load persisted usage from localStorage', () => {
      const persistedData = {
        dailyUsed: 5,
        monthlyUsed: 50,
        burstUsed: 2,
        totalBytesUsed: 1000,
        lastResetDaily: Date.now() - 1000,
        lastResetMonthly: Date.now() - 1000,
        lastResetBurst: Date.now() - 1000,
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedData));
      
      const manager = new QuotaManager();
      const stats = manager.getUsageStats();
      
      expect(stats.daily.used).toBeGreaterThan(0);
    });
  });

  describe('Quota Checking', () => {
    it('should allow requests within all limits', () => {
      const result = quotaManager.canSendError(500);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject oversized payloads', () => {
      const result = quotaManager.canSendError(2000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Payload size');
    });

    it('should reject when daily limit exceeded', () => {
      // Use up daily limit
      for (let i = 0; i < 10; i++) {
        quotaManager.recordErrorSent();
      }
      
      const result = quotaManager.canSendError();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reject when monthly limit exceeded', () => {
      // Create a quota manager with daily limit higher than monthly
      const monthlyLimitManager = new QuotaManager({
        dailyLimit: 200,  // Higher than monthly limit
        monthlyLimit: 100,
        burstLimit: 500,  // High burst limit to avoid hitting it
        burstWindowMs: 60000,
      });
      
      // Simulate high monthly usage (exactly 100)
      for (let i = 0; i < 100; i++) {
        monthlyLimitManager.recordErrorSent();
      }
      
      const result = monthlyLimitManager.canSendError();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly limit');
    });

    it('should reject when burst limit exceeded', () => {
      // Use up burst limit
      for (let i = 0; i < 5; i++) {
        quotaManager.recordErrorSent();
      }
      
      const result = quotaManager.canSendError();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Burst limit');
    });
  });

  describe('Usage Recording', () => {
    it('should record error sending', () => {
      const initialStats = quotaManager.getUsageStats();
      
      quotaManager.recordErrorSent(500);
      
      const newStats = quotaManager.getUsageStats();
      expect(newStats.daily.used).toBe(initialStats.daily.used + 1);
      expect(newStats.monthly.used).toBe(initialStats.monthly.used + 1);
      expect(newStats.burst.used).toBe(initialStats.burst.used + 1);
      expect(newStats.totalBytes).toBe(initialStats.totalBytes + 500);
    });

    it('should persist usage to localStorage', () => {
      quotaManager.recordErrorSent(100);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.dailyUsed).toBeGreaterThan(0);
      expect(savedData.totalBytesUsed).toBe(100);
    });
  });

  describe('Usage Stats', () => {
    it('should return comprehensive usage statistics', () => {
      quotaManager.recordErrorSent(200);
      
      const stats = quotaManager.getUsageStats();
      
      expect(stats).toHaveProperty('daily');
      expect(stats).toHaveProperty('monthly');
      expect(stats).toHaveProperty('burst');
      expect(stats).toHaveProperty('totalBytes');
      expect(stats).toHaveProperty('timeUntilDailyReset');
      expect(stats).toHaveProperty('timeUntilMonthlyReset');
      expect(stats).toHaveProperty('timeUntilBurstReset');
      
      expect(stats.daily.used).toBe(1);
      expect(stats.daily.percentUsed).toBe(10); // 1/10 * 100
      expect(stats.totalBytes).toBe(200);
    });

    it('should calculate percentages correctly', () => {
      // Use half the daily limit
      for (let i = 0; i < 5; i++) {
        quotaManager.recordErrorSent();
      }
      
      const stats = quotaManager.getUsageStats();
      expect(stats.daily.percentUsed).toBe(50);
    });
  });

  describe('Limit Management', () => {
    it('should update limits', () => {
      quotaManager.updateLimits({ dailyLimit: 20 });
      
      const stats = quotaManager.getUsageStats();
      expect(stats.daily.limit).toBe(20);
    });

    it('should detect when nearing limits', () => {
      // Use 80% of daily limit
      for (let i = 0; i < 8; i++) {
        quotaManager.recordErrorSent();
      }
      
      const nearing = quotaManager.isNearingLimit(0.8);
      expect(nearing.daily).toBe(true);
      expect(nearing.monthly).toBe(false);
      expect(nearing.burst).toBe(true); // 8/5 = 160% > 80%
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all usage counters', () => {
      quotaManager.recordErrorSent(100);
      quotaManager.recordErrorSent(100);
      
      let stats = quotaManager.getUsageStats();
      expect(stats.daily.used).toBe(2);
      expect(stats.totalBytes).toBe(200);
      
      quotaManager.resetUsage();
      
      stats = quotaManager.getUsageStats();
      expect(stats.daily.used).toBe(0);
      expect(stats.monthly.used).toBe(0);
      expect(stats.burst.used).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });
  });

  describe('Time-based Resets', () => {
    it('should reset counters based on time windows', (done) => {
      const shortBurstManager = new QuotaManager({
        burstLimit: 2,
        burstWindowMs: 100, // Very short window for testing
      });
      
      shortBurstManager.recordErrorSent();
      shortBurstManager.recordErrorSent();
      
      expect(shortBurstManager.canSendError().allowed).toBe(false);
      
      setTimeout(() => {
        expect(shortBurstManager.canSendError().allowed).toBe(true);
        done();
      }, 150);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => new QuotaManager()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('[QuotaManager] Failed to load usage from storage:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle corrupted localStorage data', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockLocalStorage.getItem.mockReturnValue('invalid json');
      
      expect(() => new QuotaManager()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('[QuotaManager] Failed to load usage from storage:', expect.any(SyntaxError));
      
      consoleSpy.mockRestore();
    });
  });
});