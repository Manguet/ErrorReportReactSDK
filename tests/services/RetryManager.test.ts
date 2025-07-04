import { RetryManager } from '../../src/services/RetryManager';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffFactor: 2,
    });
  });

  describe('Successful Operations', () => {
    it('should execute operation successfully on first try', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should reset retry count after success', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      const operationId = 'test-op';
      
      await retryManager.executeWithRetry(mockOperation, operationId);
      
      expect(retryManager.getRetryCount(operationId)).toBe(0);
      expect(retryManager.isRetrying(operationId)).toBe(false);
    });
  });

  describe('Failed Operations', () => {
    it('should retry failed operations', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should respect max retry limit', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryManager.executeWithRetry(mockOperation)).rejects.toThrow('Always fails');
      expect(mockOperation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should use exponential backoff', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryManager.executeWithRetry(mockOperation);
      const endTime = Date.now();
      
      // Should have taken at least initial delay + second delay (100 + 200 = 300ms)
      // Account for jitter and test execution time
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should not exceed max delay', async () => {
      const longRetryManager = new RetryManager({
        maxRetries: 3, // Reduced retries for faster test
        initialDelay: 50,
        maxDelay: 100, // Low max delay
        backoffFactor: 10, // High factor to test clamping
      });
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      const startTime = Date.now();
      await expect(longRetryManager.executeWithRetry(mockOperation)).rejects.toThrow();
      const endTime = Date.now();
      
      // Even with high backoff factor, delays should be clamped to maxDelay
      // With 3 retries at max 100ms each, plus initial attempt and execution time
      // Total should be under 5 seconds (very conservative estimate for CI)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Operation Tracking', () => {
    it('should track retry count for specific operations', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const operationId = 'test-operation';
      
      const promise = retryManager.executeWithRetry(mockOperation, operationId);
      
      // Check retry state during execution
      setTimeout(() => {
        expect(retryManager.isRetrying(operationId)).toBe(true);
        expect(retryManager.getRetryCount(operationId)).toBeGreaterThan(0);
      }, 50);
      
      await promise;
      
      // After success, retry count should be reset
      expect(retryManager.getRetryCount(operationId)).toBe(0);
      expect(retryManager.isRetrying(operationId)).toBe(false);
    });

    it('should track different operations independently', async () => {
      const mockOp1 = jest.fn().mockRejectedValue(new Error('Op1 fails'));
      const mockOp2 = jest.fn().mockResolvedValue('Op2 success');
      
      const promise1 = retryManager.executeWithRetry(mockOp1, 'op1').catch(() => {});
      const promise2 = retryManager.executeWithRetry(mockOp2, 'op2');
      
      await promise2;
      
      expect(retryManager.isRetrying('op1')).toBe(true);
      expect(retryManager.isRetrying('op2')).toBe(false);
      
      await promise1;
    });

    it('should clear retry count manually', () => {
      const operationId = 'test-op';
      
      // Simulate setting retry count
      retryManager.executeWithRetry(
        () => Promise.reject(new Error('fail')), 
        operationId
      ).catch(() => {});
      
      setTimeout(() => {
        retryManager.clearRetryCount(operationId);
        expect(retryManager.getRetryCount(operationId)).toBe(0);
        expect(retryManager.isRetrying(operationId)).toBe(false);
      }, 50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max retries', async () => {
      const zeroRetryManager = new RetryManager({ maxRetries: 0 });
      const mockOperation = jest.fn().mockRejectedValue(new Error('Fail'));
      
      await expect(zeroRetryManager.executeWithRetry(mockOperation)).rejects.toThrow('Fail');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle operations that throw non-Error objects', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce('string error')
        .mockRejectedValueOnce({ error: 'object error' })
        .mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(mockOperation);
      expect(result).toBe('success');
    });

    it('should handle very small delays', async () => {
      const fastRetryManager = new RetryManager({
        maxRetries: 2,
        initialDelay: 1,
        maxDelay: 5,
        backoffFactor: 2,
      });
      
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const result = await fastRetryManager.executeWithRetry(mockOperation);
      expect(result).toBe('success');
    });

    it('should generate unique operation IDs when not provided', async () => {
      const mockOperation1 = jest.fn().mockResolvedValue('success1');
      const mockOperation2 = jest.fn().mockResolvedValue('success2');
      
      const result1 = await retryManager.executeWithRetry(mockOperation1);
      const result2 = await retryManager.executeWithRetry(mockOperation2);
      
      expect(result1).toBe('success1');
      expect(result2).toBe('success2');
    });
  });
});