export interface SecurityConfig {
  allowedDomains?: string[];
  requireHttps?: boolean;
  validateToken?: boolean;
  maxPayloadSize?: number;
}

export class SecurityValidator {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      allowedDomains: [],
      requireHttps: true,
      validateToken: true,
      maxPayloadSize: 1024 * 1024, // 1MB default
      ...config,
    };
  }

  validateApiUrl(url: string): { isValid: boolean; error?: string } {
    try {
      const parsedUrl = new URL(url);
      
      // Check protocol
      if (this.config.requireHttps && parsedUrl.protocol !== 'https:') {
        return {
          isValid: false,
          error: 'API URL must use HTTPS in production environments',
        };
      }

      // Check allowed domains
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(domain => {
          // Support wildcards
          if (domain.startsWith('*.')) {
            const baseDomain = domain.substring(2);
            return parsedUrl.hostname.endsWith(baseDomain);
          }
          return parsedUrl.hostname === domain;
        });

        if (!isAllowed) {
          return {
            isValid: false,
            error: `Domain ${parsedUrl.hostname} is not in the allowed domains list`,
          };
        }
      }

      // Check for suspicious URLs
      if (this.isSuspiciousUrl(parsedUrl)) {
        return {
          isValid: false,
          error: 'URL appears to be suspicious or potentially malicious',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid URL format',
      };
    }
  }

  validateProjectToken(token: string): { isValid: boolean; error?: string } {
    if (!this.config.validateToken) {
      return { isValid: true };
    }

    // Basic token validation
    if (!token || typeof token !== 'string') {
      return {
        isValid: false,
        error: 'Project token is required and must be a string',
      };
    }

    // Check token format (basic validation)
    if (token.length < 8) {
      return {
        isValid: false,
        error: 'Project token appears to be too short',
      };
    }

    // Check for common test/dummy tokens
    const dummyTokens = [
      'test',
      'demo',
      'example',
      'placeholder',
      '12345',
      'abc123',
      'token',
    ];

    const lowerToken = token.toLowerCase();
    
    // Check exact matches
    if (dummyTokens.includes(lowerToken)) {
      return {
        isValid: false,
        error: 'Please use a valid project token, not a placeholder value',
      };
    }
    
    // Check if token contains dummy patterns
    if (dummyTokens.some(dummy => lowerToken.includes(dummy))) {
      return {
        isValid: false,
        error: 'Token contains suspicious patterns',
      };
    }

    // Check for potentially exposed secrets
    if (this.containsSuspiciousPatterns(token)) {
      return {
        isValid: false,
        error: 'Token contains suspicious patterns',
      };
    }

    return { isValid: true };
  }

  validatePayloadSize(payload: string): { isValid: boolean; error?: string } {
    const size = new Blob([payload]).size;
    
    if (size > this.config.maxPayloadSize!) {
      return {
        isValid: false,
        error: `Payload size (${size} bytes) exceeds maximum allowed size (${this.config.maxPayloadSize} bytes)`,
      };
    }

    return { isValid: true };
  }

  sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    
    // Remove potentially sensitive fields
    const sensitiveFields = [
      'password',
      'secret',
      'token',
      'key',
      'auth',
      'authorization',
      'cookie',
      'session',
      'credit_card',
      'creditcard',
      'social_security',
    ];

    const sanitizeObject = (obj: any, depth = 0): any => {
      if (depth > 10) return '[Max Depth Reached]'; // Prevent infinite recursion
      
      if (obj === null || obj === undefined) return obj;
      
      if (typeof obj === 'string') {
        // Sanitize potentially sensitive strings
        return this.sanitizeString(obj);
      }
      
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
      }
      
      if (typeof obj === 'object') {
        const sanitizedObj: any = {};
        
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            sanitizedObj[key] = '[REDACTED]';
          } else {
            sanitizedObj[key] = sanitizeObject(value, depth + 1);
          }
        }
        
        return sanitizedObj;
      }
      
      return obj;
    };

    return sanitizeObject(sanitized);
  }

  private isSuspiciousUrl(url: URL): boolean {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /localhost/i,
      /127\.0\.0\.1/,
      /192\.168\./,
      /10\./,
      /172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /\.local$/i,
    ];

    // Only flag as suspicious in production
    if (this.isProductionEnvironment()) {
      return suspiciousPatterns.some(pattern => pattern.test(url.hostname));
    }

    return false;
  }

  private containsSuspiciousPatterns(text: string): boolean {
    const suspiciousPatterns = [
      /^(test|demo|example)/i,
      /password/i,
      /secret/i,
      /private.*key/i,
      /aws.*key/i,
      /api.*key.*here/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  private sanitizeString(str: string): string {
    // Remove or mask potentially sensitive information
    return str
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CREDIT_CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b(?:password|secret|token|key)\s*[=:]\s*\S+/gi, '[REDACTED]');
  }

  private isProductionEnvironment(): boolean {
    return process.env.NODE_ENV === 'production' ||
           !['localhost', '127.0.0.1'].includes(window.location.hostname);
  }

  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }
}