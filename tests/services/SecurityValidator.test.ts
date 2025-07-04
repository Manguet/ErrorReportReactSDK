import { SecurityValidator } from '../../src/services/SecurityValidator';

describe('SecurityValidator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  describe('API URL Validation', () => {
    it('should accept valid HTTPS URLs', () => {
      const result = validator.validateApiUrl('https://api.example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject HTTP URLs in production mode', () => {
      const prodValidator = new SecurityValidator({ requireHttps: true });
      const result = prodValidator.validateApiUrl('http://api.example.com');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('should accept HTTP URLs when HTTPS not required', () => {
      const devValidator = new SecurityValidator({ requireHttps: false });
      const result = devValidator.validateApiUrl('http://localhost:3000');
      expect(result.isValid).toBe(true);
    });

    it('should validate allowed domains', () => {
      const restrictedValidator = new SecurityValidator({
        allowedDomains: ['api.example.com', '*.trusted.com'],
      });

      expect(restrictedValidator.validateApiUrl('https://api.example.com')).toEqual({
        isValid: true,
      });

      expect(restrictedValidator.validateApiUrl('https://subdomain.trusted.com')).toEqual({
        isValid: true,
      });

      expect(restrictedValidator.validateApiUrl('https://malicious.com').isValid).toBe(false);
    });

    it('should reject invalid URL formats', () => {
      const result = validator.validateApiUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('Project Token Validation', () => {
    it('should accept valid tokens', () => {
      const result = validator.validateProjectToken('proj_zx9y8w7v6u5t4s3r');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty tokens', () => {
      const result = validator.validateProjectToken('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject short tokens', () => {
      const result = validator.validateProjectToken('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject dummy tokens', () => {
      const dummyTokens = ['testtoken', 'demotoken', 'exampletoken', 'placeholder12345'];
      
      dummyTokens.forEach(token => {
        const result = validator.validateProjectToken(token);
        expect(result.isValid).toBe(false);
        // Check for either placeholder message or too short message
        expect(result.error).toMatch(/placeholder|too short|suspicious/);
      });
    });

    it('should reject specific dummy token patterns', () => {
      const dummyTokens = ['abc123abc', 'tokentokens', 'placeholder123'];
      
      dummyTokens.forEach(token => {
        const result = validator.validateProjectToken(token);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/placeholder|suspicious/);
      });
    });

    it('should reject short tokens', () => {
      const result = validator.validateProjectToken('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should skip validation when disabled', () => {
      const noValidationValidator = new SecurityValidator({ validateToken: false });
      const result = noValidationValidator.validateProjectToken('test');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Payload Size Validation', () => {
    it('should accept small payloads', () => {
      const smallPayload = JSON.stringify({ message: 'small error' });
      const result = validator.validatePayloadSize(smallPayload);
      expect(result.isValid).toBe(true);
    });

    it('should reject oversized payloads', () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const result = validator.validatePayloadSize(largePayload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });

  describe('Data Sanitization', () => {
    it('should redact sensitive fields', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        apiKey: 'key123',
        normalField: 'normal value',
      };

      const sanitized = validator.sanitizeData(data);
      
      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('normal value');
    });

    it('should sanitize nested objects', () => {
      const data = {
        user: {
          name: 'john',
          credentials: {
            userToken: 'secret-token',
            userSession: 'session-id',
          },
        },
        config: {
          apiSecret: 'api-secret',
        },
      };

      const sanitized = validator.sanitizeData(data);
      
      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.credentials.userToken).toBe('[REDACTED]');
      expect(sanitized.user.credentials.userSession).toBe('[REDACTED]');
      expect(sanitized.config.apiSecret).toBe('[REDACTED]');
    });

    it('should redact entire auth objects', () => {
      const data = {
        user: {
          name: 'john',
          auth: {
            token: 'secret-token',
            session: 'session-id',
          },
        },
      };

      const sanitized = validator.sanitizeData(data);
      
      expect(sanitized.user.name).toBe('john');
      expect(sanitized.user.auth).toBe('[REDACTED]'); // Entire auth object is redacted
    });

    it('should handle arrays', () => {
      const data = {
        items: [
          { name: 'item1', password: 'secret' },
          { name: 'item2', value: 'normal' },
        ],
      };

      const sanitized = validator.sanitizeData(data);
      
      expect(sanitized.items[0].name).toBe('item1');
      expect(sanitized.items[0].password).toBe('[REDACTED]');
      expect(sanitized.items[1].value).toBe('normal');
    });

    it('should prevent infinite recursion', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => validator.sanitizeData(circular)).not.toThrow();
    });

    it('should sanitize sensitive patterns in strings', () => {
      const data = {
        logs: 'User logged in with password=secret123 and email=user@example.com',
        card: 'Credit card: 1234-5678-9012-3456',
        ssn: 'Number 123-45-6789 for verification',
      };

      const sanitized = validator.sanitizeData(data);
      
      expect(sanitized.logs).toContain('[REDACTED]');
      expect(sanitized.logs).toContain('[EMAIL]');
      expect(sanitized.card).toContain('[CREDIT_CARD]');
      expect(sanitized.ssn).toContain('[SSN]');
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', () => {
      validator.updateConfig({ requireHttps: false, validateToken: false });
      
      // Should now accept HTTP URLs
      const result = validator.validateApiUrl('http://localhost:3000');
      expect(result.isValid).toBe(true);
    });
  });
});