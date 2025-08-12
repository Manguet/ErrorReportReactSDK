import { CircuitBreakerConfig, CircuitBreakerStats } from '../types';

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private nextRetryTime?: number;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: 5,
      timeout: 30000, // 30 seconds
      resetTimeout: 60000, // 1 minute
      ...config
    };
  }

  configure(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.isCallAllowed()) {
      throw new Error('Circuit breaker is OPEN - calls are not allowed');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  isCallAllowed(): boolean {
    const now = Date.now();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if we should transition to HALF_OPEN
        if (this.nextRetryTime && now >= this.nextRetryTime) {
          this.state = 'HALF_OPEN';
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return false;
    }
  }

  onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      // If we're in HALF_OPEN and got a success, reset the circuit breaker
      this.reset();
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // If we're in HALF_OPEN and got a failure, go back to OPEN
      this.tripCircuit();
    } else if (this.failureCount >= this.config.failureThreshold) {
      // If we've reached the failure threshold, trip the circuit
      this.tripCircuit();
    }
  }

  private tripCircuit(): void {
    this.state = 'OPEN';
    this.nextRetryTime = Date.now() + this.config.timeout;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime
    };
  }

  // Force the circuit breaker to OPEN state
  forceOpen(): void {
    this.state = 'OPEN';
    this.nextRetryTime = Date.now() + this.config.timeout;
  }

  // Force the circuit breaker to CLOSED state
  forceClose(): void {
    this.reset();
  }

  // Check if circuit breaker is currently allowing calls
  isCircuitOpen(): boolean {
    return this.state === 'OPEN' && !this.isCallAllowed();
  }

  // Get time until next retry attempt (only relevant when circuit is OPEN)
  getTimeUntilRetry(): number {
    if (this.state === 'OPEN' && this.nextRetryTime) {
      return Math.max(0, this.nextRetryTime - Date.now());
    }
    return 0;
  }

  // Update configuration
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current failure rate (failures per total calls)
  getFailureRate(): number {
    const totalCalls = this.successCount + this.failureCount;
    return totalCalls > 0 ? this.failureCount / totalCalls : 0;
  }
}