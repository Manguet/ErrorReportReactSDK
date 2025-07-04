import { ErrorReporterConfig, ErrorReport, ErrorContext } from '../types';
import { BreadcrumbManager } from './BreadcrumbManager';
import { RetryManager } from './RetryManager';
import { RateLimiter } from './RateLimiter';
import { OfflineManager } from './OfflineManager';
import { SecurityValidator } from './SecurityValidator';
import { SDKMonitor } from './SDKMonitor';
import { QuotaManager } from './QuotaManager';

export class ErrorReporter {
  private config: ErrorReporterConfig;
  private breadcrumbManager: BreadcrumbManager;
  private retryManager: RetryManager;
  private rateLimiter: RateLimiter;
  private offlineManager: OfflineManager;
  private securityValidator: SecurityValidator;
  private sdkMonitor: SDKMonitor;
  private quotaManager: QuotaManager;
  private isInitialized: boolean = false;
  private cleanupInterval: number | null = null;

  constructor(config: ErrorReporterConfig) {
    this.config = {
      environment: 'production',
      enabled: true,
      debug: false,
      maxBreadcrumbs: 50,
      commitHash: undefined,
      version: '1.0.0',
      projectName: 'react-app',
      maxRequestsPerMinute: 10,
      duplicateErrorWindow: 5000,
      maxRetries: 3,
      initialRetryDelay: 1000,
      maxRetryDelay: 30000,
      enableOfflineSupport: true,
      maxOfflineQueueSize: 50,
      offlineQueueMaxAge: 24 * 60 * 60 * 1000,
      ...config,
    };

    this.breadcrumbManager = new BreadcrumbManager(this.config.maxBreadcrumbs!);
    this.retryManager = new RetryManager({
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.initialRetryDelay,
      maxDelay: this.config.maxRetryDelay,
    });
    this.rateLimiter = new RateLimiter({
      maxRequests: this.config.maxRequestsPerMinute,
      windowMs: 60000,
      duplicateErrorWindow: this.config.duplicateErrorWindow,
    });
    this.offlineManager = new OfflineManager(
      this.config.maxOfflineQueueSize,
      this.config.offlineQueueMaxAge
    );
    this.securityValidator = new SecurityValidator({
      requireHttps: this.config.environment === 'production',
      validateToken: true,
      maxPayloadSize: 1024 * 1024, // 1MB
    });
    this.sdkMonitor = new SDKMonitor();
    this.quotaManager = new QuotaManager({
      dailyLimit: 1000,
      monthlyLimit: 10000,
      payloadSizeLimit: 1024 * 1024,
      burstLimit: 50,
      burstWindowMs: 60000,
    });
    
    this.initialize();
  }

  private initialize(): void {
    if (!this.config.enabled) {
      return;
    }

    // Validate configuration
    this.validateConfiguration();

    // Set up global error handlers
    this.setupGlobalHandlers();
    
    // Configure offline manager
    if (this.config.enableOfflineSupport) {
      this.offlineManager.setSendReportFunction((report) => this.sendReportDirectly(report));
    }
    
    // Set up periodic cleanup
    this.cleanupInterval = window.setInterval(() => {
      this.rateLimiter.cleanup();
    }, 60000); // Cleanup every minute
    
    this.isInitialized = true;

    if (this.config.debug) {
      console.log('[ErrorReporter] Initialized with config:', this.config);
    }
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError(new Error(event.reason), {
        type: 'unhandledrejection',
        reason: event.reason,
      });
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError(event.error || new Error(event.message), {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Intercept console errors for breadcrumbs
    this.interceptConsole();

    // Intercept fetch requests for breadcrumbs
    this.interceptFetch();

    // Track navigation changes
    this.trackNavigation();
  }

  private interceptConsole(): void {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    console.error = (...args) => {
      this.breadcrumbManager.logConsole('error', args.join(' '));
      originalConsole.error.apply(console, args);
    };

    console.warn = (...args) => {
      this.breadcrumbManager.logConsole('warn', args.join(' '));
      originalConsole.warn.apply(console, args);
    };
  }

  private interceptFetch(): void {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      
      try {
        const response = await originalFetch(...args);
        this.breadcrumbManager.logHttpRequest(
          method,
          typeof url === 'string' ? url : url.toString(),
          response.status
        );
        return response;
      } catch (error) {
        this.breadcrumbManager.logHttpRequest(
          method,
          typeof url === 'string' ? url : url.toString(),
          0,
          { error: (error as Error).message }
        );
        throw error;
      }
    };
  }

  private trackNavigation(): void {
    // Track initial page load
    this.breadcrumbManager.logNavigation('', window.location.pathname);

    // Track navigation changes (for SPAs)
    let currentPath = window.location.pathname;
    
    const handleNavigationChange = () => {
      if (window.location.pathname !== currentPath) {
        this.breadcrumbManager.logNavigation(currentPath, window.location.pathname);
        currentPath = window.location.pathname;
      }
    };

    // Listen to browser navigation events
    window.addEventListener('popstate', handleNavigationChange);
    
    // Override history methods to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      handleNavigationChange();
      return result;
    };
    
    history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      handleNavigationChange();
      return result;
    };

    // Listen to hashchange for hash-based routing
    window.addEventListener('hashchange', handleNavigationChange);
  }

  private createErrorContext(): ErrorContext {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      userId: this.config.userId,
      userEmail: this.config.userEmail,
      customData: this.config.customData,
      breadcrumbs: this.breadcrumbManager.getBreadcrumbs(),
    };
  }

  public async reportError(
    error: Error,
    additionalData?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) {
      return;
    }

    try {
      // Check rate limiting
      const errorFingerprint = this.rateLimiter.createErrorFingerprint(error, additionalData);
      
      const canMakeRequest = this.rateLimiter.canMakeRequest();
      const canReportError = this.rateLimiter.canReportError(errorFingerprint);
      
      
      if (!canMakeRequest || !canReportError) {
        this.sdkMonitor.recordErrorDropped('rate_limit');
        if (this.config.debug) {
          console.log('[ErrorReporter] Rate limited, skipping error report');
        }
        return;
      }

      const report: ErrorReport = {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name,
        environment: this.config.environment!,
        context: this.createErrorContext(),
        projectToken: this.config.projectToken,
        ...additionalData,
      };

      // Estimate payload size
      const estimatedSize = JSON.stringify(report).length;
      
      // Check quota limits
      const quotaCheck = this.quotaManager.canSendError(estimatedSize);
      if (!quotaCheck.allowed) {
        this.sdkMonitor.recordErrorDropped('other');
        if (this.config.debug) {
          console.log('[ErrorReporter] Quota exceeded:', quotaCheck.reason);
        }
        return;
      }

      if (this.config.debug) {
        console.log('[ErrorReporter] Reporting error:', report);
      }

      await this.sendReport(report);
      this.quotaManager.recordErrorSent(estimatedSize);
      this.sdkMonitor.recordErrorReported(estimatedSize);
    } catch (reportingError) {
      this.sdkMonitor.recordErrorDropped('other');
      if (this.config.debug) {
        console.error('[ErrorReporter] Failed to report error:', reportingError);
      }
    }
  }

  public async reportMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'error',
    additionalData?: Record<string, any>
  ): Promise<void> {
    const error = new Error(message);
    error.name = 'CustomMessage';
    
    await this.reportError(error, {
      type: 'CustomMessage',
      level,
      ...additionalData,
    });
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    
    // Check if offline and queue if needed
    if (this.config.enableOfflineSupport && !this.offlineManager.isOnlineNow()) {
      this.offlineManager.queueReport(report);
      if (this.config.debug) {
        console.log('[ErrorReporter] Offline, queuing report');
      }
      return;
    }


    // Try to send with retry logic
    try {
      await this.retryManager.executeWithRetry(() => this.sendReportDirectly(report));
      
      // Process offline queue if we're back online
      if (this.config.enableOfflineSupport) {
        await this.offlineManager.processQueue();
      }
    } catch (error) {
      // Queue for offline if enabled
      if (this.config.enableOfflineSupport) {
        this.offlineManager.queueReport(report);
        if (this.config.debug) {
          console.log('[ErrorReporter] Failed to send, queuing for retry');
        }
      } else {
        throw error;
      }
    }
  }

  private async sendReportDirectly(report: ErrorReport): Promise<void> {
    
    const requestId = this.sdkMonitor.recordRequestStart();
    
    try {
      // Transform report to match Error Explorer webhook format
      const rawPayload = {
        message: report.message,
        exception_class: report.type || 'Error',
        file: this.extractFilename(report.stack) || 'unknown',
        line: this.extractLineNumber(report.stack) || 0,
        project: this.config.projectName,
        stack_trace: report.stack || '',
        environment: report.environment,
        commitHash: this.config.commitHash,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href,
        user_id: this.config.userId,
        user_email: this.config.userEmail,
        custom_data: {
          ...report.context.customData,
          // Extract additional fields that are not part of base ErrorReport interface
          ...Object.fromEntries(
            Object.entries(report as any).filter(([key]) => 
              !['message', 'stack', 'type', 'file', 'line', 'column', 'environment', 'context', 'projectToken'].includes(key)
            )
          ),
          breadcrumbs: report.context.breadcrumbs,
          react_sdk: true,
          sdk_version: this.config.version
        }
      };

      
      // Sanitize payload for security
      const sanitizedPayload = this.securityValidator.sanitizeData(rawPayload);
      const payloadString = JSON.stringify(sanitizedPayload);
      const payloadSize = new Blob([payloadString]).size;


      // Validate payload size
      const sizeValidation = this.securityValidator.validatePayloadSize(payloadString);
      if (!sizeValidation.isValid) {
        this.sdkMonitor.recordRequestFailure(requestId, new Error(sizeValidation.error!));
        throw new Error(`Payload validation failed: ${sizeValidation.error}`);
      }
      

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout || 30000);

      try {
        
        const response = await fetch(`${this.config.apiUrl}/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Error-Reporter': 'react-sdk',
            'X-SDK-Version': this.config.version || '1.0.0',
          },
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Handle specific HTTP errors
          if (response.status === 429) {
            this.sdkMonitor.recordRequestFailure(requestId, new Error('Rate limit exceeded by server'));
            throw new Error('Rate limit exceeded by server');
          }
          if (response.status === 413) {
            this.sdkMonitor.recordRequestFailure(requestId, new Error('Payload too large'));
            throw new Error('Payload too large');
          }
          
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          this.sdkMonitor.recordRequestFailure(requestId, error);
          throw error;
        }

        this.sdkMonitor.recordRequestSuccess(requestId, payloadSize);
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = new Error('Request timeout');
          this.sdkMonitor.recordRequestFailure(requestId, timeoutError);
          throw timeoutError;
        }
        
        this.sdkMonitor.recordRequestFailure(requestId, error as Error);
        throw error;
      }
    } catch (globalError) {
      this.sdkMonitor.recordRequestFailure(requestId, globalError as Error);
      throw globalError;
    }
  }

  private extractFilename(stack?: string): string | null {
    if (!stack) return null;
    
    const match = stack.match(/at .+? \((.+?):\d+:\d+\)/);
    if (match) {
      return match[1].split('/').pop() || null;
    }
    
    const simpleMatch = stack.match(/(\w+\.tsx?:\d+:\d+)/);
    if (simpleMatch) {
      return simpleMatch[1].split(':')[0];
    }
    
    return null;
  }

  private extractLineNumber(stack?: string): number | null {
    if (!stack) return null;
    
    const match = stack.match(/:(\d+):\d+/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Public API methods
  public addBreadcrumb(
    message: string,
    category?: string,
    level?: 'info' | 'warning' | 'error' | 'debug',
    data?: Record<string, any>
  ): void {
    this.breadcrumbManager.addBreadcrumb(message, category, level, data);
  }

  public logUserAction(action: string, data?: Record<string, any>): void {
    this.breadcrumbManager.logUserAction(action, data);
  }

  public logNavigation(from: string, to: string, data?: Record<string, any>): void {
    this.breadcrumbManager.logNavigation(from, to, data);
  }

  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  public setUserEmail(email: string): void {
    this.config.userEmail = email;
  }

  public setCustomData(data: Record<string, any>): void {
    this.config.customData = { ...this.config.customData, ...data };
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbManager.clearBreadcrumbs();
  }

  public isEnabled(): boolean {
    return this.config.enabled!;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.config.enableOfflineSupport) {
      this.offlineManager.clearQueue();
    }
    
    // Export final metrics if debug is enabled
    if (this.config.debug) {
      console.log('[ErrorReporter] Final SDK metrics:', this.sdkMonitor.exportMetrics());
    }
  }

  // New utility methods
  public getStats(): {
    queueSize: number;
    isOnline: boolean;
    rateLimitRemaining: number;
    rateLimitReset: number;
    sdkMetrics: ReturnType<SDKMonitor['getMetrics']>;
    quotaUsage: ReturnType<QuotaManager['getUsageStats']>;
    healthStatus: ReturnType<SDKMonitor['getHealthStatus']>;
  } {
    const queueSize = this.config.enableOfflineSupport ? this.offlineManager.getQueueSize() : 0;
    this.sdkMonitor.recordQueueSize(queueSize);
    
    return {
      queueSize,
      isOnline: this.offlineManager.isOnlineNow(),
      rateLimitRemaining: this.rateLimiter.getRemainingRequests(),
      rateLimitReset: this.rateLimiter.getResetTime(),
      sdkMetrics: this.sdkMonitor.getMetrics(),
      quotaUsage: this.quotaManager.getUsageStats(),
      healthStatus: this.sdkMonitor.getHealthStatus(),
    };
  }

  public async flushQueue(): Promise<void> {
    if (this.config.enableOfflineSupport) {
      await this.offlineManager.processQueue();
    }
  }

  public updateConfig(updates: Partial<ErrorReporterConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Re-validate configuration if critical settings changed
    if (updates.apiUrl || updates.projectToken) {
      this.validateConfiguration();
    }
    
    if (this.config.debug) {
      console.log('[ErrorReporter] Config updated:', updates);
    }
  }

  private validateConfiguration(): void {
    // Validate API URL
    const urlValidation = this.securityValidator.validateApiUrl(this.config.apiUrl);
    if (!urlValidation.isValid) {
      const error = `Invalid API URL: ${urlValidation.error}`;
      if (this.config.debug) {
        console.error('[ErrorReporter]', error);
      }
      throw new Error(error);
    }

    // Validate project token
    const tokenValidation = this.securityValidator.validateProjectToken(this.config.projectToken);
    if (!tokenValidation.isValid) {
      const error = `Invalid project token: ${tokenValidation.error}`;
      if (this.config.debug) {
        console.error('[ErrorReporter]', error);
      }
      throw new Error(error);
    }
  }
}