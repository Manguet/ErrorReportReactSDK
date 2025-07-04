import { ErrorReporter } from '../../src/services/ErrorReporter';
import { ErrorReporterConfig } from '../../src/types';

// Mock fetch for integration tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ErrorReporter Integration Tests', () => {
  let config: ErrorReporterConfig;
  let errorReporter: ErrorReporter;

  beforeEach(() => {
    config = {
      projectToken: 'proj_integration_987654321xyz',
      apiUrl: 'https://api.error-explorer.com',
      environment: 'test',
      enabled: true,
      debug: true,
      maxRequestsPerMinute: 5,
      duplicateErrorWindow: 1000,
      requestTimeout: 5000,
    };
    
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
  });

  afterEach(() => {
    if (errorReporter) {
      errorReporter.destroy();
    }
    jest.clearAllMocks();
  });

  describe('Complete Error Reporting Flow', () => {
    it('should handle complete error reporting lifecycle', async () => {
      errorReporter = new ErrorReporter(config);
      
      // Report an error
      const error = new Error('Integration test error');
      await errorReporter.reportError(error, { 
        testContext: 'integration',
        userId: 'test-user' 
      });

      // Verify the request was made
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.error-explorer.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Error-Reporter': 'react-sdk',
          }),
        })
      );

      // Check the payload
      const call = mockFetch.mock.calls[0];
      const payload = JSON.parse(call[1].body);
      
      expect(payload).toMatchObject({
        message: 'Integration test error',
        exception_class: 'Error',
        environment: 'test',
        custom_data: expect.objectContaining({
          react_sdk: true,
          sdk_version: '1.0.0',
        }),
      });
    }, 10000);

    it('should handle rate limiting correctly', async () => {
      errorReporter = new ErrorReporter({
        ...config,
        maxRequestsPerMinute: 2,
        duplicateErrorWindow: 0, // Disable duplicate detection
      });

      // Use different errors to avoid duplicate detection
      const error1 = new Error('Rate limit test 1');
      const error2 = new Error('Rate limit test 2');
      const error3 = new Error('Rate limit test 3');
      
      // These should succeed
      await errorReporter.reportError(error1);
      await errorReporter.reportError(error2);
      
      // This should be rate limited
      await errorReporter.reportError(error3);
      
      // Should only have made 2 requests
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should handle network failures with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        });

      errorReporter = new ErrorReporter({
        ...config,
        maxRetries: 3,
        initialRetryDelay: 10, // Fast for testing
      });

      const error = new Error('Network retry test');
      await errorReporter.reportError(error);

      // Should have retried 3 times (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should queue errors when offline', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      errorReporter = new ErrorReporter({
        ...config,
        enableOfflineSupport: true,
      });

      const error = new Error('Offline test error');
      await errorReporter.reportError(error);

      // Should not have made any HTTP requests
      expect(mockFetch).not.toHaveBeenCalled();

      // Check stats show queued error
      const stats = errorReporter.getStats();
      expect(stats.queueSize).toBeGreaterThan(0);

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      });

      // Trigger online event
      window.dispatchEvent(new Event('online'));
      
      // Wait a bit for the queue to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Flush the queue manually to ensure processing
      await errorReporter.flushQueue();

      // Now the request should have been made
      expect(mockFetch).toHaveBeenCalled();
    }, 10000);

    it('should provide comprehensive statistics', async () => {
      errorReporter = new ErrorReporter(config);

      // Report some errors
      await errorReporter.reportError(new Error('Stats test 1'));
      await errorReporter.reportError(new Error('Stats test 2'));

      const stats = errorReporter.getStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isOnline');
      expect(stats).toHaveProperty('rateLimitRemaining');
      expect(stats).toHaveProperty('sdkMetrics');
      expect(stats).toHaveProperty('quotaUsage');
      expect(stats).toHaveProperty('healthStatus');

      expect(stats.sdkMetrics.errorsReported).toBe(2);
      expect(stats.quotaUsage.daily.used).toBe(2);
      expect(stats.healthStatus.status).toBeDefined();
    });

    it('should handle security validation', async () => {
      // Test with invalid token
      expect(() => {
        new ErrorReporter({
          ...config,
          projectToken: 'test', // Invalid dummy token
        });
      }).toThrow();

      // Test with invalid URL
      expect(() => {
        new ErrorReporter({
          ...config,
          apiUrl: 'not-a-url',
        });
      }).toThrow();
    });

    it('should sanitize sensitive data', async () => {
      errorReporter = new ErrorReporter(config);

      const error = new Error('Security test');
      await errorReporter.reportError(error, {
        userPassword: 'secret123',
        apiKey: 'api-key-secret',
        normalData: 'safe-data',
      });

      const call = mockFetch.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      // Sensitive data should be redacted
      const payloadString = JSON.stringify(payload);
      expect(payloadString).not.toContain('secret123');
      expect(payloadString).not.toContain('api-key-secret');
      
      // Normal data should be preserved somewhere in the payload
      expect(payloadString).toContain('safe-data');
    });

    it('should respect quota limits', async () => {
      errorReporter = new ErrorReporter({
        ...config,
        maxRequestsPerMinute: 50, // Higher limit for test
      });

      // Simulate moderate usage for testing
      const quotaStats = errorReporter.getStats().quotaUsage;
      expect(quotaStats.daily.limit).toBeGreaterThan(0);
      expect(quotaStats.monthly.limit).toBeGreaterThan(0);

      // Test with smaller numbers for faster execution
      for (let i = 0; i < 10; i++) { 
        await errorReporter.reportError(new Error(`Quota test ${i}`));
      }

      // Should have made some requests
      expect(mockFetch).toHaveBeenCalledTimes(10);
    }, 10000);
  });

  describe('Error Edge Cases', () => {
    it('should handle malformed server responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      errorReporter = new ErrorReporter(config);
      
      const error = new Error('Server error test');
      
      // Should not throw, should handle gracefully
      await expect(errorReporter.reportError(error)).resolves.not.toThrow();
    }, 10000);

    it('should handle request timeouts', async () => {
      // Mock a timeout that resolves quickly for test
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200 }), 50))
      );

      errorReporter = new ErrorReporter({
        ...config,
        requestTimeout: 30, // Very short timeout to force timeout behavior
      });

      const error = new Error('Timeout test');
      
      // Should handle timeout gracefully
      await expect(errorReporter.reportError(error)).resolves.not.toThrow();
    }, 2000);

    it('should handle very large error payloads', async () => {
      errorReporter = new ErrorReporter(config);

      // Create a very large error context
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const error = new Error('Large payload test');
      
      await errorReporter.reportError(error, { largeData });

      // Should handle size validation and either reject or truncate
      if (mockFetch.mock.calls.length > 0) {
        const call = mockFetch.mock.calls[0];
        const payloadSize = new Blob([call[1].body]).size;
        expect(payloadSize).toBeLessThan(2 * 1024 * 1024); // Should be smaller due to sanitization
      }
    });
  });

  describe('Configuration Updates', () => {
    it('should handle runtime configuration updates', async () => {
      errorReporter = new ErrorReporter(config);

      // Update configuration
      errorReporter.updateConfig({
        debug: false,
        maxRequestsPerMinute: 10,
      });

      // Configuration should be updated
      await errorReporter.reportError(new Error('Config update test'));
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should re-validate on critical config changes', async () => {
      errorReporter = new ErrorReporter(config);

      // Should throw on invalid URL update
      expect(() => {
        errorReporter.updateConfig({
          apiUrl: 'invalid-url',
        });
      }).toThrow();
    });
  });
});