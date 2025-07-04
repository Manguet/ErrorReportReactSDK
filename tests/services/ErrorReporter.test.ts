import { ErrorReporter } from '../../src/services/ErrorReporter';
import { ErrorReporterConfig } from '../../src/types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ErrorReporter', () => {
  let config: ErrorReporterConfig;
  let errorReporter: ErrorReporter;

  beforeEach(() => {
    config = {
      projectToken: 'proj_zx9y8w7v6u5t4s3r2q1p',
      apiUrl: 'https://api.example.com',
      environment: 'test',
      enabled: true,
      debug: false,
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

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      errorReporter = new ErrorReporter(config);
      expect(errorReporter.isEnabled()).toBe(true);
    });

    it('should not initialize when disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      errorReporter = new ErrorReporter(disabledConfig);
      expect(errorReporter.isEnabled()).toBe(false);
    });

    it('should merge default config with provided config', () => {
      errorReporter = new ErrorReporter(config);
      const stats = errorReporter.getStats();
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isOnline');
    });
  });

  describe('Error Reporting', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should report basic error', async () => {
      const error = new Error('Test error');
      await errorReporter.reportError(error);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Error-Reporter': 'react-sdk',
          }),
          body: expect.stringContaining('Test error'),
        })
      );
    }, 10000);

    it('should include custom data in error report', async () => {
      const error = new Error('Test error');
      const customData = { userId: '123', feature: 'test' };
      
      await errorReporter.reportError(error, customData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.custom_data).toMatchObject({
        react_sdk: true,
        sdk_version: '1.0.0',
      });
    }, 10000);

    it('should not report when disabled', async () => {
      const disabledConfig = { ...config, enabled: false };
      errorReporter = new ErrorReporter(disabledConfig);
      
      const error = new Error('Test error');
      await errorReporter.reportError(error);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const error = new Error('Test error');
      await expect(errorReporter.reportError(error)).resolves.not.toThrow();
    }, 10000);
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      config.maxRequestsPerMinute = 2;
      errorReporter = new ErrorReporter(config);
    });

    it('should respect rate limits', async () => {
      // Use different errors to avoid duplicate detection
      const error1 = new Error('Rate limit test error 1');
      const error2 = new Error('Rate limit test error 2');
      const error3 = new Error('Rate limit test error 3');
      
      // First two should succeed
      await errorReporter.reportError(error1);
      await errorReporter.reportError(error2);
      
      // Third should be rate limited
      await errorReporter.reportError(error3);
      
      // Should only have made 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should prevent duplicate errors', async () => {
      config.duplicateErrorWindow = 1000;
      errorReporter = new ErrorReporter(config);
      
      const error = new Error('Duplicate error');
      
      // Report same error twice quickly
      await errorReporter.reportError(error);
      await errorReporter.reportError(error);
      
      // Should only report once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('Breadcrumbs', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should add custom breadcrumb', () => {
      errorReporter.addBreadcrumb('Test breadcrumb', 'test', 'info');
      // Breadcrumbs are tested via error reporting
      expect(() => errorReporter.addBreadcrumb('Test', 'test')).not.toThrow();
    });

    it('should log user actions', () => {
      expect(() => {
        errorReporter.logUserAction('button_click', { buttonId: 'submit' });
      }).not.toThrow();
    });

    it('should log navigation', () => {
      expect(() => {
        errorReporter.logNavigation('/home', '/profile');
      }).not.toThrow();
    });

    it('should clear breadcrumbs', () => {
      errorReporter.addBreadcrumb('Test breadcrumb');
      errorReporter.clearBreadcrumbs();
      expect(() => errorReporter.clearBreadcrumbs()).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should update user context', () => {
      errorReporter.setUserId('user123');
      errorReporter.setUserEmail('user@example.com');
      errorReporter.setCustomData({ version: '1.0' });
      
      expect(() => errorReporter.setUserId('user123')).not.toThrow();
    });

    it('should update config at runtime', () => {
      errorReporter.updateConfig({ debug: true, environment: 'staging' });
      expect(() => errorReporter.updateConfig({ debug: false })).not.toThrow();
    });
  });

  describe('Stats and Monitoring', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should return stats', () => {
      const stats = errorReporter.getStats();
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('isOnline');
      expect(stats).toHaveProperty('rateLimitRemaining');
      expect(stats).toHaveProperty('rateLimitReset');
      expect(typeof stats.queueSize).toBe('number');
      expect(typeof stats.isOnline).toBe('boolean');
    });

    it('should flush queue', async () => {
      await expect(errorReporter.flushQueue()).resolves.not.toThrow();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should cleanup resources on destroy', () => {
      expect(() => errorReporter.destroy()).not.toThrow();
    });
  });

  describe('Message Reporting', () => {
    beforeEach(() => {
      errorReporter = new ErrorReporter(config);
    });

    it('should report custom messages', async () => {
      await errorReporter.reportMessage('Custom message', 'warning', { context: 'test' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Custom message'),
        })
      );
    }, 10000);

    it('should default to error level', async () => {
      await errorReporter.reportMessage('Default level message');
      expect(mockFetch).toHaveBeenCalled();
    }, 10000);
  });
});