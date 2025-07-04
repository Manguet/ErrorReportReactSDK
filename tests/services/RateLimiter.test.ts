import { RateLimiter } from '../../src/services/RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000,
      duplicateErrorWindow: 500,
    });
  });

  describe('Request Rate Limiting', () => {
    it('should allow requests within limit', () => {
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should block requests over limit', () => {
      // Use up the limit
      rateLimiter.canMakeRequest();
      rateLimiter.canMakeRequest();
      rateLimiter.canMakeRequest();
      
      // This should be blocked
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    it('should reset after window expires', (done) => {
      // Use up the limit
      rateLimiter.canMakeRequest();
      rateLimiter.canMakeRequest();
      rateLimiter.canMakeRequest();
      
      expect(rateLimiter.canMakeRequest()).toBe(false);
      
      // Wait for window to reset (using shorter window for test)
      setTimeout(() => {
        expect(rateLimiter.canMakeRequest()).toBe(true);
        done();
      }, 1100);
    });

    it('should track different keys separately', () => {
      expect(rateLimiter.canMakeRequest('key1')).toBe(true);
      expect(rateLimiter.canMakeRequest('key2')).toBe(true);
      expect(rateLimiter.canMakeRequest('key1')).toBe(true);
      expect(rateLimiter.canMakeRequest('key2')).toBe(true);
    });
  });

  describe('Duplicate Error Prevention', () => {
    it('should allow first error report', () => {
      const error = new Error('Test error');
      const fingerprint = rateLimiter.createErrorFingerprint(error);
      
      expect(rateLimiter.canReportError(fingerprint)).toBe(true);
    });

    it('should block duplicate errors within window', () => {
      const error = new Error('Test error');
      const fingerprint = rateLimiter.createErrorFingerprint(error);
      
      expect(rateLimiter.canReportError(fingerprint)).toBe(true);
      expect(rateLimiter.canReportError(fingerprint)).toBe(false);
    });

    it('should allow duplicate errors after window expires', (done) => {
      const error = new Error('Test error');
      const fingerprint = rateLimiter.createErrorFingerprint(error);
      
      expect(rateLimiter.canReportError(fingerprint)).toBe(true);
      expect(rateLimiter.canReportError(fingerprint)).toBe(false);
      
      setTimeout(() => {
        expect(rateLimiter.canReportError(fingerprint)).toBe(true);
        done();
      }, 600);
    });

    it('should create different fingerprints for different errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      
      const fingerprint1 = rateLimiter.createErrorFingerprint(error1);
      const fingerprint2 = rateLimiter.createErrorFingerprint(error2);
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should include context in fingerprint', () => {
      const error = new Error('Test error');
      const context1 = { type: 'type1', extra: 'data1' };
      const context2 = { type: 'type2', extra: 'data2' };
      
      const fingerprint1 = rateLimiter.createErrorFingerprint(error, context1);
      const fingerprint2 = rateLimiter.createErrorFingerprint(error, context2);
      
      // Fingerprints should be different when context is different
      expect(fingerprint1).not.toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(32);
      expect(fingerprint2).toHaveLength(32);
    });
  });

  describe('Stats and Management', () => {
    it('should return remaining requests', () => {
      expect(rateLimiter.getRemainingRequests()).toBe(3);
      
      rateLimiter.canMakeRequest();
      expect(rateLimiter.getRemainingRequests()).toBe(2);
      
      rateLimiter.canMakeRequest();
      expect(rateLimiter.getRemainingRequests()).toBe(1);
    });

    it('should return reset time', () => {
      const resetTime = rateLimiter.getResetTime();
      const now = Date.now();
      expect(typeof resetTime).toBe('number');
      expect(resetTime).toBeGreaterThanOrEqual(now - 10); // Allow small timing difference
    });

    it('should cleanup old entries', () => {
      rateLimiter.canMakeRequest();
      
      expect(() => rateLimiter.cleanup()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max requests', () => {
      const zeroLimiter = new RateLimiter({ maxRequests: 0 });
      expect(zeroLimiter.canMakeRequest()).toBe(false);
    });

    it('should handle very short windows', () => {
      const shortLimiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 100, // Use 100ms window for more reliable test
      });
      
      expect(shortLimiter.canMakeRequest()).toBe(true);
      expect(shortLimiter.canMakeRequest()).toBe(false);
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test');
      error.stack = undefined;
      
      const fingerprint = rateLimiter.createErrorFingerprint(error);
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBeGreaterThan(0);
    });
  });
});