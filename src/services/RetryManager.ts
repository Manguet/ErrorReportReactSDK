interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export class RetryManager {
  private config: RetryConfig;
  private retryCount: Map<string, number> = new Map();

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      ...config,
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationId: string = Math.random().toString(36)
  ): Promise<T> {
    const currentRetryCount = this.retryCount.get(operationId) || 0;

    try {
      const result = await operation();
      // Reset retry count on success
      this.retryCount.delete(operationId);
      return result;
    } catch (error) {
      if (currentRetryCount >= this.config.maxRetries || !this.shouldRetryError(error)) {
        this.retryCount.delete(operationId);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.config.initialDelay * Math.pow(this.config.backoffFactor, currentRetryCount),
        this.config.maxDelay
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      this.retryCount.set(operationId, currentRetryCount + 1);

      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const result = await this.executeWithRetry(operation, operationId);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        }, jitteredDelay);
      });
    }
  }

  isRetrying(operationId: string): boolean {
    return this.retryCount.has(operationId);
  }

  getRetryCount(operationId: string): number {
    return this.retryCount.get(operationId) || 0;
  }

  clearRetryCount(operationId: string): void {
    this.retryCount.delete(operationId);
  }

  private shouldRetryError(error: any): boolean {
    if (!error) return false;

    // Check for authentication/authorization errors - don't retry these
    if (error.status === 401 || error.status === 403) {
      return false;
    }

    // Check error message for HTTP status codes
    if (error.message && typeof error.message === 'string') {
      const httpMatch = error.message.match(/HTTP (\d+):/);
      if (httpMatch) {
        const status = parseInt(httpMatch[1], 10);
        // Don't retry on authentication/authorization errors
        if (status === 401 || status === 403) {
          return false;
        }
        // Retry on server errors (5xx) and some client errors
        return status >= 500 || status === 429 || status === 408;
      }

      // Check for specific error messages
      if (error.message.includes('401') || error.message.includes('403') || 
          error.message.toLowerCase().includes('unauthorized') ||
          error.message.toLowerCase().includes('forbidden')) {
        return false;
      }
    }

    // Default: retry for network errors, timeouts, etc.
    if (error.code === 'NETWORK_ERROR' || 
        error.code === 'TIMEOUT' ||
        error.message?.includes('network') ||
        error.message?.includes('timeout')) {
      return true;
    }

    // For unknown errors, be conservative and don't retry
    return false;
  }
}