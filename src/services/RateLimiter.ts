interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  duplicateErrorWindow: number;
}

interface RequestInfo {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private requests: Map<string, RequestInfo> = new Map();
  private recentErrors: Map<string, number> = new Map();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequests: 10, // Max 10 requests per window
      windowMs: 60000, // 1 minute window
      duplicateErrorWindow: 5000, // 5 seconds window for duplicate errors
      ...config,
    };
  }

  canMakeRequest(key: string = 'default'): boolean {
    const now = Date.now();
    const requestInfo = this.requests.get(key);

    if (!requestInfo || now >= requestInfo.resetTime) {
      // Reset window
      if (this.config.maxRequests === 0) {
        return false;
      }
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    if (requestInfo.count >= this.config.maxRequests) {
      return false;
    }

    requestInfo.count++;
    return true;
  }

  canReportError(errorFingerprint: string): boolean {
    const now = Date.now();
    const lastReported = this.recentErrors.get(errorFingerprint);

    if (!lastReported || now - lastReported > this.config.duplicateErrorWindow) {
      this.recentErrors.set(errorFingerprint, now);
      return true;
    }

    return false;
  }

  createErrorFingerprint(error: Error, additionalData?: Record<string, any>): string {
    // Enhanced fingerprint combining stack trace signature + message
    const stackSignature = this.extractStackSignature(error.stack || '', 3);
    const messageSignature = (error.message || '').substring(0, 100);
    const errorType = error.constructor.name;
    
    // Combine signatures
    const combined = `${stackSignature}|${messageSignature}|${errorType}`;
    
    // Use a simple hash to ensure different inputs produce different outputs
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base64-like string and ensure 32 chars
    return btoa(hash.toString()).substring(0, 32).padEnd(32, '0');
  }

  /**
   * Extract stack trace signature by taking the first N meaningful frames
   * and normalizing line numbers to avoid over-segmentation
   */
  private extractStackSignature(stackTrace: string, depth: number = 3): string {
    if (!stackTrace) return '';
    
    const lines = stackTrace.split('\n');
    
    // Filter meaningful frames (ignore empty lines and browser internals)
    const meaningfulFrames = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && 
             !trimmed.includes('chrome-extension://') &&
             !trimmed.includes('webpack://') &&
             !trimmed.includes('node_modules/react-dom') &&
             (trimmed.includes('.jsx') || trimmed.includes('.js') || trimmed.includes('.tsx') || trimmed.includes('.ts'));
    });
    
    // Take first N frames
    const frames = meaningfulFrames.slice(0, depth);
    
    // Normalize each frame (remove specific line numbers and columns)
    const normalizedFrames = frames.map(frame => {
      return frame.replace(/:\d+:\d+/g, ':XX:XX').replace(/:\d+/g, ':XX');
    });
    
    return normalizedFrames.join('|');
  }

  getRemainingRequests(key: string = 'default'): number {
    const requestInfo = this.requests.get(key);
    if (!requestInfo || Date.now() >= requestInfo.resetTime) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - requestInfo.count);
  }

  getResetTime(key: string = 'default'): number {
    const requestInfo = this.requests.get(key);
    return requestInfo?.resetTime || Date.now();
  }

  // Cleanup old entries periodically
  cleanup(): void {
    const now = Date.now();
    
    // Clean up request counters
    for (const [key, info] of this.requests.entries()) {
      if (now >= info.resetTime) {
        this.requests.delete(key);
      }
    }

    // Clean up error fingerprints
    for (const [fingerprint, timestamp] of this.recentErrors.entries()) {
      if (now - timestamp > this.config.duplicateErrorWindow) {
        this.recentErrors.delete(fingerprint);
      }
    }
  }
}