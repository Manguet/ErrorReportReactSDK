interface SDKMetrics {
  errorsReported: number;
  errorsDropped: number;
  requestsSuccessful: number;
  requestsFailed: number;
  averageResponseTime: number;
  queueSize: number;
  retryAttempts: number;
  bytesTransmitted: number;
  lastErrorTime?: number;
  lastSuccessTime?: number;
  uptime: number;
}

interface PerformanceEntry {
  timestamp: number;
  duration: number;
  success: boolean;
  size?: number;
}

export class SDKMonitor {
  private metrics: SDKMetrics;
  private performanceLog: PerformanceEntry[] = [];
  private startTime: number;
  private maxLogEntries: number = 100;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      errorsReported: 0,
      errorsDropped: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      queueSize: 0,
      retryAttempts: 0,
      bytesTransmitted: 0,
      uptime: 0,
    };
  }

  recordErrorReported(size?: number): void {
    this.metrics.errorsReported++;
    if (size) {
      this.metrics.bytesTransmitted += size;
    }
    this.updateUptime();
  }

  recordErrorDropped(reason: 'rate_limit' | 'validation' | 'size' | 'other'): void {
    this.metrics.errorsDropped++;
    this.updateUptime();

    // Could extend to track drop reasons if needed
    if (this.shouldLogPerformanceIssue()) {
      console.warn(`[SDKMonitor] Error dropped due to: ${reason}`);
    }
  }

  recordRequestStart(): string {
    return Date.now().toString();
  }

  recordRequestSuccess(requestId: string, size?: number): void {
    const duration = Date.now() - parseInt(requestId);
    
    this.metrics.requestsSuccessful++;
    this.metrics.lastSuccessTime = Date.now();
    
    if (size) {
      this.metrics.bytesTransmitted += size;
    }

    this.updateAverageResponseTime(duration);
    this.addPerformanceEntry(duration, true, size);
    this.updateUptime();
  }

  recordRequestFailure(requestId: string, error?: Error): void {
    const duration = Date.now() - parseInt(requestId);
    
    this.metrics.requestsFailed++;
    this.metrics.lastErrorTime = Date.now();

    this.updateAverageResponseTime(duration);
    this.addPerformanceEntry(duration, false);
    this.updateUptime();

    if (this.shouldLogPerformanceIssue()) {
      console.warn('[SDKMonitor] Request failed:', error?.message);
    }
  }

  recordRetryAttempt(): void {
    this.metrics.retryAttempts++;
    this.updateUptime();
  }

  recordQueueSize(size: number): void {
    this.metrics.queueSize = size;
    
    // Alert if queue is growing too large
    if (size > 20 && this.shouldLogPerformanceIssue()) {
      console.warn(`[SDKMonitor] Queue size is growing: ${size} items`);
    }
  }

  getMetrics(): Readonly<SDKMetrics> {
    this.updateUptime();
    return { ...this.metrics };
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check error rate
    const totalRequests = this.metrics.requestsSuccessful + this.metrics.requestsFailed;
    const errorRate = totalRequests > 0 ? this.metrics.requestsFailed / totalRequests : 0;
    
    if (errorRate > 0.5) {
      issues.push('High error rate (>50%)');
      recommendations.push('Check network connectivity and API configuration');
    } else if (errorRate > 0.2) {
      issues.push('Elevated error rate (>20%)');
      recommendations.push('Monitor network stability');
    }

    // Check queue size
    if (this.metrics.queueSize > 50) {
      issues.push('Large offline queue');
      recommendations.push('Check internet connectivity');
    } else if (this.metrics.queueSize > 20) {
      issues.push('Growing offline queue');
      recommendations.push('Monitor connectivity');
    }

    // Check response time
    if (this.metrics.averageResponseTime > 10000) {
      issues.push('Very slow response times (>10s)');
      recommendations.push('Check API server performance');
    } else if (this.metrics.averageResponseTime > 5000) {
      issues.push('Slow response times (>5s)');
      recommendations.push('Monitor API performance');
    }

    // Check dropped errors
    const dropRate = this.metrics.errorsReported > 0 
      ? this.metrics.errorsDropped / (this.metrics.errorsReported + this.metrics.errorsDropped)
      : 0;
    
    if (dropRate > 0.3) {
      issues.push('High error drop rate (>30%)');
      recommendations.push('Review rate limiting configuration');
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.some(issue => issue.includes('Very slow') || issue.includes('High'))) {
      status = 'critical';
    } else if (issues.length > 0) {
      status = 'warning';
    }

    return { status, issues, recommendations };
  }

  getPerformanceTrends(): {
    responseTimeHistory: Array<{ timestamp: number; duration: number }>;
    successRate: number;
    averagePayloadSize: number;
  } {
    const responseTimeHistory = this.performanceLog.map(entry => ({
      timestamp: entry.timestamp,
      duration: entry.duration,
    }));

    const successfulEntries = this.performanceLog.filter(entry => entry.success);
    const successRate = this.performanceLog.length > 0 
      ? successfulEntries.length / this.performanceLog.length 
      : 0;

    const entriesWithSize = this.performanceLog.filter(entry => entry.size);
    const averagePayloadSize = entriesWithSize.length > 0
      ? entriesWithSize.reduce((sum, entry) => sum + (entry.size || 0), 0) / entriesWithSize.length
      : 0;

    return {
      responseTimeHistory,
      successRate,
      averagePayloadSize,
    };
  }

  exportMetrics(): string {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      health: this.getHealthStatus(),
      trends: this.getPerformanceTrends(),
    };

    return JSON.stringify(data, null, 2);
  }

  reset(): void {
    this.startTime = Date.now();
    this.metrics = {
      errorsReported: 0,
      errorsDropped: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      queueSize: 0,
      retryAttempts: 0,
      bytesTransmitted: 0,
      uptime: 0,
    };
    this.performanceLog = [];
  }

  private updateUptime(): void {
    this.metrics.uptime = Date.now() - this.startTime;
  }

  private updateAverageResponseTime(newDuration: number): void {
    const totalRequests = this.metrics.requestsSuccessful + this.metrics.requestsFailed;
    
    if (totalRequests === 1) {
      this.metrics.averageResponseTime = newDuration;
    } else {
      // Running average calculation
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalRequests - 1) + newDuration) / totalRequests;
    }
  }

  private addPerformanceEntry(duration: number, success: boolean, size?: number): void {
    this.performanceLog.push({
      timestamp: Date.now(),
      duration,
      success,
      size,
    });

    // Keep only recent entries
    if (this.performanceLog.length > this.maxLogEntries) {
      this.performanceLog.shift();
    }
  }

  private shouldLogPerformanceIssue(): boolean {
    // Only log performance issues occasionally to avoid spam
    return Math.random() < 0.1; // 10% chance
  }
}