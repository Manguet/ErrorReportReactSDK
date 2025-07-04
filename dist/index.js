'use strict';

var require$$0 = require('react');

class BreadcrumbManager {
    constructor(maxBreadcrumbs = 50) {
        this.breadcrumbs = [];
        this.maxBreadcrumbs = 50;
        this.maxBreadcrumbs = maxBreadcrumbs;
    }
    addBreadcrumb(message, category = 'custom', level = 'info', data) {
        const breadcrumb = {
            timestamp: Date.now(),
            message,
            category,
            level,
            data,
        };
        this.breadcrumbs.push(breadcrumb);
        // Keep only the latest breadcrumbs
        if (this.breadcrumbs.length > this.maxBreadcrumbs) {
            this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
        }
    }
    getBreadcrumbs() {
        return [...this.breadcrumbs];
    }
    clearBreadcrumbs() {
        this.breadcrumbs = [];
    }
    // Convenience methods for common breadcrumb types
    logNavigation(from, to, data) {
        this.addBreadcrumb(`Navigation: ${from} → ${to}`, 'navigation', 'info', { from, to, ...data });
    }
    logUserAction(action, data) {
        this.addBreadcrumb(`User action: ${action}`, 'user', 'info', { action, ...data });
    }
    logHttpRequest(method, url, statusCode, data) {
        const level = statusCode && statusCode >= 400 ? 'error' : 'info';
        this.addBreadcrumb(`${method} ${url}${statusCode ? ` (${statusCode})` : ''}`, 'http', level, { method, url, statusCode, ...data });
    }
    logConsole(level, message, data) {
        this.addBreadcrumb(`Console ${level}: ${message}`, 'console', level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info', { level, ...data });
    }
    logClick(element, data) {
        this.addBreadcrumb(`Clicked: ${element}`, 'ui', 'info', { element, ...data });
    }
}

class RetryManager {
    constructor(config = {}) {
        this.retryCount = new Map();
        this.config = {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 30000,
            backoffFactor: 2,
            ...config,
        };
    }
    async executeWithRetry(operation, operationId = Math.random().toString(36)) {
        const currentRetryCount = this.retryCount.get(operationId) || 0;
        try {
            const result = await operation();
            // Reset retry count on success
            this.retryCount.delete(operationId);
            return result;
        }
        catch (error) {
            if (currentRetryCount >= this.config.maxRetries) {
                this.retryCount.delete(operationId);
                throw error;
            }
            // Calculate delay with exponential backoff
            const delay = Math.min(this.config.initialDelay * Math.pow(this.config.backoffFactor, currentRetryCount), this.config.maxDelay);
            // Add jitter to prevent thundering herd
            const jitteredDelay = delay + Math.random() * 1000;
            this.retryCount.set(operationId, currentRetryCount + 1);
            return new Promise((resolve, reject) => {
                setTimeout(async () => {
                    try {
                        const result = await this.executeWithRetry(operation, operationId);
                        resolve(result);
                    }
                    catch (retryError) {
                        reject(retryError);
                    }
                }, jitteredDelay);
            });
        }
    }
    isRetrying(operationId) {
        return this.retryCount.has(operationId);
    }
    getRetryCount(operationId) {
        return this.retryCount.get(operationId) || 0;
    }
    clearRetryCount(operationId) {
        this.retryCount.delete(operationId);
    }
}

class RateLimiter {
    constructor(config = {}) {
        this.requests = new Map();
        this.recentErrors = new Map();
        this.config = {
            maxRequests: 10, // Max 10 requests per window
            windowMs: 60000, // 1 minute window
            duplicateErrorWindow: 5000, // 5 seconds window for duplicate errors
            ...config,
        };
    }
    canMakeRequest(key = 'default') {
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
    canReportError(errorFingerprint) {
        const now = Date.now();
        const lastReported = this.recentErrors.get(errorFingerprint);
        if (!lastReported || now - lastReported > this.config.duplicateErrorWindow) {
            this.recentErrors.set(errorFingerprint, now);
            return true;
        }
        return false;
    }
    createErrorFingerprint(error, additionalData) {
        // Create a fingerprint based on error message, stack trace, and context
        const components = [
            error.message,
            error.stack?.split('\n')[0] || '',
            additionalData?.type || '',
            window.location.pathname,
            // Include additional context for better fingerprinting
            JSON.stringify(additionalData || {}),
        ];
        // Use a simple hash to ensure different inputs produce different outputs
        const combined = components.join('|');
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        // Convert to base64-like string and ensure 32 chars
        return btoa(hash.toString()).substring(0, 32).padEnd(32, '0');
    }
    getRemainingRequests(key = 'default') {
        const requestInfo = this.requests.get(key);
        if (!requestInfo || Date.now() >= requestInfo.resetTime) {
            return this.config.maxRequests;
        }
        return Math.max(0, this.config.maxRequests - requestInfo.count);
    }
    getResetTime(key = 'default') {
        const requestInfo = this.requests.get(key);
        return requestInfo?.resetTime || Date.now();
    }
    // Cleanup old entries periodically
    cleanup() {
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

class OfflineManager {
    constructor(maxQueueSize, maxAge) {
        this.queue = [];
        this.isOnline = navigator.onLine;
        this.maxQueueSize = 50;
        this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        this.maxQueueSize = maxQueueSize || 50;
        this.maxAge = maxAge || 24 * 60 * 60 * 1000;
        this.setupNetworkListeners();
        this.loadPersistedQueue();
    }
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processQueue();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    loadPersistedQueue() {
        try {
            const stored = localStorage.getItem('errorReporter_queue');
            if (stored) {
                this.queue = JSON.parse(stored);
                this.cleanupOldReports();
            }
        }
        catch (error) {
            console.warn('[ErrorReporter] Failed to load persisted queue:', error);
        }
    }
    persistQueue() {
        try {
            localStorage.setItem('errorReporter_queue', JSON.stringify(this.queue));
        }
        catch (error) {
            console.warn('[ErrorReporter] Failed to persist queue:', error);
        }
    }
    cleanupOldReports() {
        const now = Date.now();
        this.queue = this.queue.filter(item => now - item.timestamp < this.maxAge);
    }
    queueReport(report) {
        this.cleanupOldReports();
        // Remove oldest reports if queue is full
        if (this.queue.length >= this.maxQueueSize) {
            this.queue.shift();
        }
        this.queue.push({
            report,
            timestamp: Date.now(),
            attempts: 0,
        });
        this.persistQueue();
    }
    async processQueue() {
        if (!this.isOnline || this.queue.length === 0) {
            return;
        }
        const toProcess = [...this.queue];
        this.queue = [];
        for (const queuedReport of toProcess) {
            try {
                await this.sendReport(queuedReport.report);
                // Success - don't re-queue
            }
            catch (error) {
                queuedReport.attempts++;
                // Re-queue if not too many attempts
                if (queuedReport.attempts < 3) {
                    this.queue.push(queuedReport);
                }
            }
        }
        this.persistQueue();
    }
    async sendReport(report) {
        // This will be implemented by the main ErrorReporter class
        throw new Error('sendReport method should be implemented by the main ErrorReporter class');
    }
    // Method to be called by ErrorReporter
    setSendReportFunction(sendFn) {
        this.sendReport = sendFn;
    }
    isOnlineNow() {
        return this.isOnline;
    }
    getQueueSize() {
        return this.queue.length;
    }
    clearQueue() {
        this.queue = [];
        this.persistQueue();
    }
    getQueuedReports() {
        return this.queue;
    }
}

class SecurityValidator {
    constructor(config = {}) {
        this.config = {
            allowedDomains: [],
            requireHttps: true,
            validateToken: true,
            maxPayloadSize: 1024 * 1024, // 1MB default
            ...config,
        };
    }
    validateApiUrl(url) {
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
        }
        catch (error) {
            return {
                isValid: false,
                error: 'Invalid URL format',
            };
        }
    }
    validateProjectToken(token) {
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
    validatePayloadSize(payload) {
        const size = new Blob([payload]).size;
        if (size > this.config.maxPayloadSize) {
            return {
                isValid: false,
                error: `Payload size (${size} bytes) exceeds maximum allowed size (${this.config.maxPayloadSize} bytes)`,
            };
        }
        return { isValid: true };
    }
    sanitizeData(data) {
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
        const sanitizeObject = (obj, depth = 0) => {
            if (depth > 10)
                return '[Max Depth Reached]'; // Prevent infinite recursion
            if (obj === null || obj === undefined)
                return obj;
            if (typeof obj === 'string') {
                // Sanitize potentially sensitive strings
                return this.sanitizeString(obj);
            }
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeObject(item, depth + 1));
            }
            if (typeof obj === 'object') {
                const sanitizedObj = {};
                for (const [key, value] of Object.entries(obj)) {
                    const lowerKey = key.toLowerCase();
                    if (sensitiveFields.some(field => lowerKey.includes(field))) {
                        sanitizedObj[key] = '[REDACTED]';
                    }
                    else {
                        sanitizedObj[key] = sanitizeObject(value, depth + 1);
                    }
                }
                return sanitizedObj;
            }
            return obj;
        };
        return sanitizeObject(sanitized);
    }
    isSuspiciousUrl(url) {
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
    containsSuspiciousPatterns(text) {
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
    sanitizeString(str) {
        // Remove or mask potentially sensitive information
        return str
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
            .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CREDIT_CARD]')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
            .replace(/\b(?:password|secret|token|key)\s*[=:]\s*\S+/gi, '[REDACTED]');
    }
    isProductionEnvironment() {
        return process.env.NODE_ENV === 'production' ||
            !['localhost', '127.0.0.1'].includes(window.location.hostname);
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}

class SDKMonitor {
    constructor() {
        this.performanceLog = [];
        this.maxLogEntries = 100;
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
    recordErrorReported(size) {
        this.metrics.errorsReported++;
        if (size) {
            this.metrics.bytesTransmitted += size;
        }
        this.updateUptime();
    }
    recordErrorDropped(reason) {
        this.metrics.errorsDropped++;
        this.updateUptime();
        // Could extend to track drop reasons if needed
        if (this.shouldLogPerformanceIssue()) {
            console.warn(`[SDKMonitor] Error dropped due to: ${reason}`);
        }
    }
    recordRequestStart() {
        return Date.now().toString();
    }
    recordRequestSuccess(requestId, size) {
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
    recordRequestFailure(requestId, error) {
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
    recordRetryAttempt() {
        this.metrics.retryAttempts++;
        this.updateUptime();
    }
    recordQueueSize(size) {
        this.metrics.queueSize = size;
        // Alert if queue is growing too large
        if (size > 20 && this.shouldLogPerformanceIssue()) {
            console.warn(`[SDKMonitor] Queue size is growing: ${size} items`);
        }
    }
    getMetrics() {
        this.updateUptime();
        return { ...this.metrics };
    }
    getHealthStatus() {
        const issues = [];
        const recommendations = [];
        // Check error rate
        const totalRequests = this.metrics.requestsSuccessful + this.metrics.requestsFailed;
        const errorRate = totalRequests > 0 ? this.metrics.requestsFailed / totalRequests : 0;
        if (errorRate > 0.5) {
            issues.push('High error rate (>50%)');
            recommendations.push('Check network connectivity and API configuration');
        }
        else if (errorRate > 0.2) {
            issues.push('Elevated error rate (>20%)');
            recommendations.push('Monitor network stability');
        }
        // Check queue size
        if (this.metrics.queueSize > 50) {
            issues.push('Large offline queue');
            recommendations.push('Check internet connectivity');
        }
        else if (this.metrics.queueSize > 20) {
            issues.push('Growing offline queue');
            recommendations.push('Monitor connectivity');
        }
        // Check response time
        if (this.metrics.averageResponseTime > 10000) {
            issues.push('Very slow response times (>10s)');
            recommendations.push('Check API server performance');
        }
        else if (this.metrics.averageResponseTime > 5000) {
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
        let status = 'healthy';
        if (issues.some(issue => issue.includes('Very slow') || issue.includes('High'))) {
            status = 'critical';
        }
        else if (issues.length > 0) {
            status = 'warning';
        }
        return { status, issues, recommendations };
    }
    getPerformanceTrends() {
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
    exportMetrics() {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.getMetrics(),
            health: this.getHealthStatus(),
            trends: this.getPerformanceTrends(),
        };
        return JSON.stringify(data, null, 2);
    }
    reset() {
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
    updateUptime() {
        this.metrics.uptime = Date.now() - this.startTime;
    }
    updateAverageResponseTime(newDuration) {
        const totalRequests = this.metrics.requestsSuccessful + this.metrics.requestsFailed;
        if (totalRequests === 1) {
            this.metrics.averageResponseTime = newDuration;
        }
        else {
            // Running average calculation
            this.metrics.averageResponseTime =
                (this.metrics.averageResponseTime * (totalRequests - 1) + newDuration) / totalRequests;
        }
    }
    addPerformanceEntry(duration, success, size) {
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
    shouldLogPerformanceIssue() {
        // Only log performance issues occasionally to avoid spam
        return Math.random() < 0.1; // 10% chance
    }
}

class QuotaManager {
    constructor(limits = {}) {
        this.storageKey = 'errorReporter_quota';
        this.limits = {
            dailyLimit: 1000,
            monthlyLimit: 10000,
            payloadSizeLimit: 1024 * 1024, // 1MB
            burstLimit: 50,
            burstWindowMs: 60000, // 1 minute
            ...limits,
        };
        this.usage = this.loadUsageFromStorage();
        this.resetExpiredCounters();
    }
    canSendError(payloadSize) {
        this.resetExpiredCounters();
        // Check payload size
        if (payloadSize && this.limits.payloadSizeLimit && payloadSize > this.limits.payloadSizeLimit) {
            return {
                allowed: false,
                reason: `Payload size (${payloadSize}) exceeds limit (${this.limits.payloadSizeLimit})`,
            };
        }
        // Check daily limit
        if (this.limits.dailyLimit && this.usage.dailyUsed >= this.limits.dailyLimit) {
            const nextReset = this.getNextDailyReset();
            return {
                allowed: false,
                reason: `Daily limit (${this.limits.dailyLimit}) exceeded`,
                retryAfter: nextReset - Date.now(),
            };
        }
        // Check monthly limit
        if (this.limits.monthlyLimit && this.usage.monthlyUsed >= this.limits.monthlyLimit) {
            const nextReset = this.getNextMonthlyReset();
            return {
                allowed: false,
                reason: `Monthly limit (${this.limits.monthlyLimit}) exceeded`,
                retryAfter: nextReset - Date.now(),
            };
        }
        // Check burst limit
        if (this.limits.burstLimit && this.usage.burstUsed >= this.limits.burstLimit) {
            const nextReset = this.usage.lastResetBurst + this.limits.burstWindowMs;
            return {
                allowed: false,
                reason: `Burst limit (${this.limits.burstLimit}) exceeded`,
                retryAfter: nextReset - Date.now(),
            };
        }
        return { allowed: true };
    }
    recordErrorSent(payloadSize) {
        this.resetExpiredCounters();
        this.usage.dailyUsed++;
        this.usage.monthlyUsed++;
        this.usage.burstUsed++;
        if (payloadSize) {
            this.usage.totalBytesUsed += payloadSize;
        }
        this.saveUsageToStorage();
    }
    getUsageStats() {
        this.resetExpiredCounters();
        return {
            daily: {
                used: this.usage.dailyUsed,
                limit: this.limits.dailyLimit || 0,
                percentUsed: this.limits.dailyLimit
                    ? (this.usage.dailyUsed / this.limits.dailyLimit) * 100
                    : 0,
            },
            monthly: {
                used: this.usage.monthlyUsed,
                limit: this.limits.monthlyLimit || 0,
                percentUsed: this.limits.monthlyLimit
                    ? (this.usage.monthlyUsed / this.limits.monthlyLimit) * 100
                    : 0,
            },
            burst: {
                used: this.usage.burstUsed,
                limit: this.limits.burstLimit || 0,
                percentUsed: this.limits.burstLimit
                    ? (this.usage.burstUsed / this.limits.burstLimit) * 100
                    : 0,
            },
            totalBytes: this.usage.totalBytesUsed,
            timeUntilDailyReset: this.getNextDailyReset() - Date.now(),
            timeUntilMonthlyReset: this.getNextMonthlyReset() - Date.now(),
            timeUntilBurstReset: Math.max(0, (this.usage.lastResetBurst + this.limits.burstWindowMs) - Date.now()),
        };
    }
    updateLimits(newLimits) {
        this.limits = { ...this.limits, ...newLimits };
    }
    resetUsage() {
        const now = Date.now();
        this.usage = {
            dailyUsed: 0,
            monthlyUsed: 0,
            burstUsed: 0,
            lastResetDaily: now,
            lastResetMonthly: now,
            lastResetBurst: now,
            totalBytesUsed: 0,
        };
        this.saveUsageToStorage();
    }
    isNearingLimit(threshold = 0.8) {
        const stats = this.getUsageStats();
        return {
            daily: stats.daily.percentUsed / 100 >= threshold,
            monthly: stats.monthly.percentUsed / 100 >= threshold,
            burst: stats.burst.percentUsed / 100 >= threshold,
        };
    }
    resetExpiredCounters() {
        const now = Date.now();
        // Reset daily counter
        if (this.shouldResetDaily(now)) {
            this.usage.dailyUsed = 0;
            this.usage.lastResetDaily = this.getDayStartTimestamp(now);
        }
        // Reset monthly counter
        if (this.shouldResetMonthly(now)) {
            this.usage.monthlyUsed = 0;
            this.usage.lastResetMonthly = this.getMonthStartTimestamp(now);
        }
        // Reset burst counter
        if (this.shouldResetBurst(now)) {
            this.usage.burstUsed = 0;
            this.usage.lastResetBurst = now;
        }
    }
    shouldResetDaily(now) {
        const dayStart = this.getDayStartTimestamp(now);
        return this.usage.lastResetDaily < dayStart;
    }
    shouldResetMonthly(now) {
        const monthStart = this.getMonthStartTimestamp(now);
        return this.usage.lastResetMonthly < monthStart;
    }
    shouldResetBurst(now) {
        return now - this.usage.lastResetBurst >= this.limits.burstWindowMs;
    }
    getDayStartTimestamp(timestamp) {
        const date = new Date(timestamp);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }
    getMonthStartTimestamp(timestamp) {
        const date = new Date(timestamp);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }
    getNextDailyReset() {
        const now = Date.now();
        const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
        return this.getDayStartTimestamp(tomorrow.getTime());
    }
    getNextMonthlyReset() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.getTime();
    }
    loadUsageFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    dailyUsed: parsed.dailyUsed || 0,
                    monthlyUsed: parsed.monthlyUsed || 0,
                    burstUsed: parsed.burstUsed || 0,
                    lastResetDaily: parsed.lastResetDaily || Date.now(),
                    lastResetMonthly: parsed.lastResetMonthly || Date.now(),
                    lastResetBurst: parsed.lastResetBurst || Date.now(),
                    totalBytesUsed: parsed.totalBytesUsed || 0,
                };
            }
        }
        catch (error) {
            console.warn('[QuotaManager] Failed to load usage from storage:', error);
        }
        // Return default usage
        const now = Date.now();
        return {
            dailyUsed: 0,
            monthlyUsed: 0,
            burstUsed: 0,
            lastResetDaily: now,
            lastResetMonthly: now,
            lastResetBurst: now,
            totalBytesUsed: 0,
        };
    }
    saveUsageToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.usage));
        }
        catch (error) {
            console.warn('[QuotaManager] Failed to save usage to storage:', error);
        }
    }
}

class ErrorReporter {
    constructor(config) {
        this.isInitialized = false;
        this.cleanupInterval = null;
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
        this.breadcrumbManager = new BreadcrumbManager(this.config.maxBreadcrumbs);
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
        this.offlineManager = new OfflineManager(this.config.maxOfflineQueueSize, this.config.offlineQueueMaxAge);
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
    initialize() {
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
    setupGlobalHandlers() {
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
    interceptConsole() {
        const originalConsole = {
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
    interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [url, options] = args;
            const method = options?.method || 'GET';
            try {
                const response = await originalFetch(...args);
                this.breadcrumbManager.logHttpRequest(method, typeof url === 'string' ? url : url.toString(), response.status);
                return response;
            }
            catch (error) {
                this.breadcrumbManager.logHttpRequest(method, typeof url === 'string' ? url : url.toString(), 0, { error: error.message });
                throw error;
            }
        };
    }
    trackNavigation() {
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
        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            handleNavigationChange();
            return result;
        };
        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            handleNavigationChange();
            return result;
        };
        // Listen to hashchange for hash-based routing
        window.addEventListener('hashchange', handleNavigationChange);
    }
    createErrorContext() {
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
    async reportError(error, additionalData) {
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
            const report = {
                message: error.message,
                stack: error.stack,
                type: error.constructor.name,
                environment: this.config.environment,
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
        }
        catch (reportingError) {
            this.sdkMonitor.recordErrorDropped('other');
            if (this.config.debug) {
                console.error('[ErrorReporter] Failed to report error:', reportingError);
            }
        }
    }
    async reportMessage(message, level = 'error', additionalData) {
        const error = new Error(message);
        error.name = 'CustomMessage';
        await this.reportError(error, {
            type: 'CustomMessage',
            level,
            ...additionalData,
        });
    }
    async sendReport(report) {
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
        }
        catch (error) {
            // Queue for offline if enabled
            if (this.config.enableOfflineSupport) {
                this.offlineManager.queueReport(report);
                if (this.config.debug) {
                    console.log('[ErrorReporter] Failed to send, queuing for retry');
                }
            }
            else {
                throw error;
            }
        }
    }
    async sendReportDirectly(report) {
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
                    ...Object.fromEntries(Object.entries(report).filter(([key]) => !['message', 'stack', 'type', 'file', 'line', 'column', 'environment', 'context', 'projectToken'].includes(key))),
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
                this.sdkMonitor.recordRequestFailure(requestId, new Error(sizeValidation.error));
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
            }
            catch (error) {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === 'AbortError') {
                    const timeoutError = new Error('Request timeout');
                    this.sdkMonitor.recordRequestFailure(requestId, timeoutError);
                    throw timeoutError;
                }
                this.sdkMonitor.recordRequestFailure(requestId, error);
                throw error;
            }
        }
        catch (globalError) {
            this.sdkMonitor.recordRequestFailure(requestId, globalError);
            throw globalError;
        }
    }
    extractFilename(stack) {
        if (!stack)
            return null;
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
    extractLineNumber(stack) {
        if (!stack)
            return null;
        const match = stack.match(/:(\d+):\d+/);
        return match ? parseInt(match[1], 10) : null;
    }
    // Public API methods
    addBreadcrumb(message, category, level, data) {
        this.breadcrumbManager.addBreadcrumb(message, category, level, data);
    }
    logUserAction(action, data) {
        this.breadcrumbManager.logUserAction(action, data);
    }
    logNavigation(from, to, data) {
        this.breadcrumbManager.logNavigation(from, to, data);
    }
    setUserId(userId) {
        this.config.userId = userId;
    }
    setUserEmail(email) {
        this.config.userEmail = email;
    }
    setCustomData(data) {
        this.config.customData = { ...this.config.customData, ...data };
    }
    clearBreadcrumbs() {
        this.breadcrumbManager.clearBreadcrumbs();
    }
    isEnabled() {
        return this.config.enabled;
    }
    destroy() {
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
    getStats() {
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
    async flushQueue() {
        if (this.config.enableOfflineSupport) {
            await this.offlineManager.processQueue();
        }
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        // Re-validate configuration if critical settings changed
        if (updates.apiUrl || updates.projectToken) {
            this.validateConfiguration();
        }
        if (this.config.debug) {
            console.log('[ErrorReporter] Config updated:', updates);
        }
    }
    validateConfiguration() {
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

var jsxRuntime = {exports: {}};

var reactJsxRuntime_production_min = {};

/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactJsxRuntime_production_min;

function requireReactJsxRuntime_production_min () {
	if (hasRequiredReactJsxRuntime_production_min) return reactJsxRuntime_production_min;
	hasRequiredReactJsxRuntime_production_min = 1;
var f=require$$0,k=Symbol.for("react.element"),l=Symbol.for("react.fragment"),m=Object.prototype.hasOwnProperty,n=f.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,p={key:true,ref:true,__self:true,__source:true};
	function q(c,a,g){var b,d={},e=null,h=null;void 0!==g&&(e=""+g);void 0!==a.key&&(e=""+a.key);void 0!==a.ref&&(h=a.ref);for(b in a)m.call(a,b)&&!p.hasOwnProperty(b)&&(d[b]=a[b]);if(c&&c.defaultProps)for(b in a=c.defaultProps,a) void 0===d[b]&&(d[b]=a[b]);return {$$typeof:k,type:c,key:e,ref:h,props:d,_owner:n.current}}reactJsxRuntime_production_min.Fragment=l;reactJsxRuntime_production_min.jsx=q;reactJsxRuntime_production_min.jsxs=q;
	return reactJsxRuntime_production_min;
}

var reactJsxRuntime_development = {};

/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactJsxRuntime_development;

function requireReactJsxRuntime_development () {
	if (hasRequiredReactJsxRuntime_development) return reactJsxRuntime_development;
	hasRequiredReactJsxRuntime_development = 1;

	if (process.env.NODE_ENV !== "production") {
	  (function() {

	var React = require$$0;

	// ATTENTION
	// When adding new symbols to this file,
	// Please consider also adding to 'react-devtools-shared/src/backend/ReactSymbols'
	// The Symbol used to tag the ReactElement-like types.
	var REACT_ELEMENT_TYPE = Symbol.for('react.element');
	var REACT_PORTAL_TYPE = Symbol.for('react.portal');
	var REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
	var REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
	var REACT_PROFILER_TYPE = Symbol.for('react.profiler');
	var REACT_PROVIDER_TYPE = Symbol.for('react.provider');
	var REACT_CONTEXT_TYPE = Symbol.for('react.context');
	var REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
	var REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
	var REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
	var REACT_MEMO_TYPE = Symbol.for('react.memo');
	var REACT_LAZY_TYPE = Symbol.for('react.lazy');
	var REACT_OFFSCREEN_TYPE = Symbol.for('react.offscreen');
	var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
	var FAUX_ITERATOR_SYMBOL = '@@iterator';
	function getIteratorFn(maybeIterable) {
	  if (maybeIterable === null || typeof maybeIterable !== 'object') {
	    return null;
	  }

	  var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];

	  if (typeof maybeIterator === 'function') {
	    return maybeIterator;
	  }

	  return null;
	}

	var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

	function error(format) {
	  {
	    {
	      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
	        args[_key2 - 1] = arguments[_key2];
	      }

	      printWarning('error', format, args);
	    }
	  }
	}

	function printWarning(level, format, args) {
	  // When changing this logic, you might want to also
	  // update consoleWithStackDev.www.js as well.
	  {
	    var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
	    var stack = ReactDebugCurrentFrame.getStackAddendum();

	    if (stack !== '') {
	      format += '%s';
	      args = args.concat([stack]);
	    } // eslint-disable-next-line react-internal/safe-string-coercion


	    var argsWithFormat = args.map(function (item) {
	      return String(item);
	    }); // Careful: RN currently depends on this prefix

	    argsWithFormat.unshift('Warning: ' + format); // We intentionally don't use spread (or .apply) directly because it
	    // breaks IE9: https://github.com/facebook/react/issues/13610
	    // eslint-disable-next-line react-internal/no-production-logging

	    Function.prototype.apply.call(console[level], console, argsWithFormat);
	  }
	}

	// -----------------------------------------------------------------------------

	var enableScopeAPI = false; // Experimental Create Event Handle API.
	var enableCacheElement = false;
	var enableTransitionTracing = false; // No known bugs, but needs performance testing

	var enableLegacyHidden = false; // Enables unstable_avoidThisFallback feature in Fiber
	// stuff. Intended to enable React core members to more easily debug scheduling
	// issues in DEV builds.

	var enableDebugTracing = false; // Track which Fiber(s) schedule render work.

	var REACT_MODULE_REFERENCE;

	{
	  REACT_MODULE_REFERENCE = Symbol.for('react.module.reference');
	}

	function isValidElementType(type) {
	  if (typeof type === 'string' || typeof type === 'function') {
	    return true;
	  } // Note: typeof might be other than 'symbol' or 'number' (e.g. if it's a polyfill).


	  if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing  || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden  || type === REACT_OFFSCREEN_TYPE || enableScopeAPI  || enableCacheElement  || enableTransitionTracing ) {
	    return true;
	  }

	  if (typeof type === 'object' && type !== null) {
	    if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
	    // types supported by any Flight configuration anywhere since
	    // we don't know which Flight build this will end up being used
	    // with.
	    type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== undefined) {
	      return true;
	    }
	  }

	  return false;
	}

	function getWrappedName(outerType, innerType, wrapperName) {
	  var displayName = outerType.displayName;

	  if (displayName) {
	    return displayName;
	  }

	  var functionName = innerType.displayName || innerType.name || '';
	  return functionName !== '' ? wrapperName + "(" + functionName + ")" : wrapperName;
	} // Keep in sync with react-reconciler/getComponentNameFromFiber


	function getContextName(type) {
	  return type.displayName || 'Context';
	} // Note that the reconciler package should generally prefer to use getComponentNameFromFiber() instead.


	function getComponentNameFromType(type) {
	  if (type == null) {
	    // Host root, text node or just invalid type.
	    return null;
	  }

	  {
	    if (typeof type.tag === 'number') {
	      error('Received an unexpected object in getComponentNameFromType(). ' + 'This is likely a bug in React. Please file an issue.');
	    }
	  }

	  if (typeof type === 'function') {
	    return type.displayName || type.name || null;
	  }

	  if (typeof type === 'string') {
	    return type;
	  }

	  switch (type) {
	    case REACT_FRAGMENT_TYPE:
	      return 'Fragment';

	    case REACT_PORTAL_TYPE:
	      return 'Portal';

	    case REACT_PROFILER_TYPE:
	      return 'Profiler';

	    case REACT_STRICT_MODE_TYPE:
	      return 'StrictMode';

	    case REACT_SUSPENSE_TYPE:
	      return 'Suspense';

	    case REACT_SUSPENSE_LIST_TYPE:
	      return 'SuspenseList';

	  }

	  if (typeof type === 'object') {
	    switch (type.$$typeof) {
	      case REACT_CONTEXT_TYPE:
	        var context = type;
	        return getContextName(context) + '.Consumer';

	      case REACT_PROVIDER_TYPE:
	        var provider = type;
	        return getContextName(provider._context) + '.Provider';

	      case REACT_FORWARD_REF_TYPE:
	        return getWrappedName(type, type.render, 'ForwardRef');

	      case REACT_MEMO_TYPE:
	        var outerName = type.displayName || null;

	        if (outerName !== null) {
	          return outerName;
	        }

	        return getComponentNameFromType(type.type) || 'Memo';

	      case REACT_LAZY_TYPE:
	        {
	          var lazyComponent = type;
	          var payload = lazyComponent._payload;
	          var init = lazyComponent._init;

	          try {
	            return getComponentNameFromType(init(payload));
	          } catch (x) {
	            return null;
	          }
	        }

	      // eslint-disable-next-line no-fallthrough
	    }
	  }

	  return null;
	}

	var assign = Object.assign;

	// Helpers to patch console.logs to avoid logging during side-effect free
	// replaying on render function. This currently only patches the object
	// lazily which won't cover if the log function was extracted eagerly.
	// We could also eagerly patch the method.
	var disabledDepth = 0;
	var prevLog;
	var prevInfo;
	var prevWarn;
	var prevError;
	var prevGroup;
	var prevGroupCollapsed;
	var prevGroupEnd;

	function disabledLog() {}

	disabledLog.__reactDisabledLog = true;
	function disableLogs() {
	  {
	    if (disabledDepth === 0) {
	      /* eslint-disable react-internal/no-production-logging */
	      prevLog = console.log;
	      prevInfo = console.info;
	      prevWarn = console.warn;
	      prevError = console.error;
	      prevGroup = console.group;
	      prevGroupCollapsed = console.groupCollapsed;
	      prevGroupEnd = console.groupEnd; // https://github.com/facebook/react/issues/19099

	      var props = {
	        configurable: true,
	        enumerable: true,
	        value: disabledLog,
	        writable: true
	      }; // $FlowFixMe Flow thinks console is immutable.

	      Object.defineProperties(console, {
	        info: props,
	        log: props,
	        warn: props,
	        error: props,
	        group: props,
	        groupCollapsed: props,
	        groupEnd: props
	      });
	      /* eslint-enable react-internal/no-production-logging */
	    }

	    disabledDepth++;
	  }
	}
	function reenableLogs() {
	  {
	    disabledDepth--;

	    if (disabledDepth === 0) {
	      /* eslint-disable react-internal/no-production-logging */
	      var props = {
	        configurable: true,
	        enumerable: true,
	        writable: true
	      }; // $FlowFixMe Flow thinks console is immutable.

	      Object.defineProperties(console, {
	        log: assign({}, props, {
	          value: prevLog
	        }),
	        info: assign({}, props, {
	          value: prevInfo
	        }),
	        warn: assign({}, props, {
	          value: prevWarn
	        }),
	        error: assign({}, props, {
	          value: prevError
	        }),
	        group: assign({}, props, {
	          value: prevGroup
	        }),
	        groupCollapsed: assign({}, props, {
	          value: prevGroupCollapsed
	        }),
	        groupEnd: assign({}, props, {
	          value: prevGroupEnd
	        })
	      });
	      /* eslint-enable react-internal/no-production-logging */
	    }

	    if (disabledDepth < 0) {
	      error('disabledDepth fell below zero. ' + 'This is a bug in React. Please file an issue.');
	    }
	  }
	}

	var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
	var prefix;
	function describeBuiltInComponentFrame(name, source, ownerFn) {
	  {
	    if (prefix === undefined) {
	      // Extract the VM specific prefix used by each line.
	      try {
	        throw Error();
	      } catch (x) {
	        var match = x.stack.trim().match(/\n( *(at )?)/);
	        prefix = match && match[1] || '';
	      }
	    } // We use the prefix to ensure our stacks line up with native stack frames.


	    return '\n' + prefix + name;
	  }
	}
	var reentry = false;
	var componentFrameCache;

	{
	  var PossiblyWeakMap = typeof WeakMap === 'function' ? WeakMap : Map;
	  componentFrameCache = new PossiblyWeakMap();
	}

	function describeNativeComponentFrame(fn, construct) {
	  // If something asked for a stack inside a fake render, it should get ignored.
	  if ( !fn || reentry) {
	    return '';
	  }

	  {
	    var frame = componentFrameCache.get(fn);

	    if (frame !== undefined) {
	      return frame;
	    }
	  }

	  var control;
	  reentry = true;
	  var previousPrepareStackTrace = Error.prepareStackTrace; // $FlowFixMe It does accept undefined.

	  Error.prepareStackTrace = undefined;
	  var previousDispatcher;

	  {
	    previousDispatcher = ReactCurrentDispatcher.current; // Set the dispatcher in DEV because this might be call in the render function
	    // for warnings.

	    ReactCurrentDispatcher.current = null;
	    disableLogs();
	  }

	  try {
	    // This should throw.
	    if (construct) {
	      // Something should be setting the props in the constructor.
	      var Fake = function () {
	        throw Error();
	      }; // $FlowFixMe


	      Object.defineProperty(Fake.prototype, 'props', {
	        set: function () {
	          // We use a throwing setter instead of frozen or non-writable props
	          // because that won't throw in a non-strict mode function.
	          throw Error();
	        }
	      });

	      if (typeof Reflect === 'object' && Reflect.construct) {
	        // We construct a different control for this case to include any extra
	        // frames added by the construct call.
	        try {
	          Reflect.construct(Fake, []);
	        } catch (x) {
	          control = x;
	        }

	        Reflect.construct(fn, [], Fake);
	      } else {
	        try {
	          Fake.call();
	        } catch (x) {
	          control = x;
	        }

	        fn.call(Fake.prototype);
	      }
	    } else {
	      try {
	        throw Error();
	      } catch (x) {
	        control = x;
	      }

	      fn();
	    }
	  } catch (sample) {
	    // This is inlined manually because closure doesn't do it for us.
	    if (sample && control && typeof sample.stack === 'string') {
	      // This extracts the first frame from the sample that isn't also in the control.
	      // Skipping one frame that we assume is the frame that calls the two.
	      var sampleLines = sample.stack.split('\n');
	      var controlLines = control.stack.split('\n');
	      var s = sampleLines.length - 1;
	      var c = controlLines.length - 1;

	      while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
	        // We expect at least one stack frame to be shared.
	        // Typically this will be the root most one. However, stack frames may be
	        // cut off due to maximum stack limits. In this case, one maybe cut off
	        // earlier than the other. We assume that the sample is longer or the same
	        // and there for cut off earlier. So we should find the root most frame in
	        // the sample somewhere in the control.
	        c--;
	      }

	      for (; s >= 1 && c >= 0; s--, c--) {
	        // Next we find the first one that isn't the same which should be the
	        // frame that called our sample function and the control.
	        if (sampleLines[s] !== controlLines[c]) {
	          // In V8, the first line is describing the message but other VMs don't.
	          // If we're about to return the first line, and the control is also on the same
	          // line, that's a pretty good indicator that our sample threw at same line as
	          // the control. I.e. before we entered the sample frame. So we ignore this result.
	          // This can happen if you passed a class to function component, or non-function.
	          if (s !== 1 || c !== 1) {
	            do {
	              s--;
	              c--; // We may still have similar intermediate frames from the construct call.
	              // The next one that isn't the same should be our match though.

	              if (c < 0 || sampleLines[s] !== controlLines[c]) {
	                // V8 adds a "new" prefix for native classes. Let's remove it to make it prettier.
	                var _frame = '\n' + sampleLines[s].replace(' at new ', ' at '); // If our component frame is labeled "<anonymous>"
	                // but we have a user-provided "displayName"
	                // splice it in to make the stack more readable.


	                if (fn.displayName && _frame.includes('<anonymous>')) {
	                  _frame = _frame.replace('<anonymous>', fn.displayName);
	                }

	                {
	                  if (typeof fn === 'function') {
	                    componentFrameCache.set(fn, _frame);
	                  }
	                } // Return the line we found.


	                return _frame;
	              }
	            } while (s >= 1 && c >= 0);
	          }

	          break;
	        }
	      }
	    }
	  } finally {
	    reentry = false;

	    {
	      ReactCurrentDispatcher.current = previousDispatcher;
	      reenableLogs();
	    }

	    Error.prepareStackTrace = previousPrepareStackTrace;
	  } // Fallback to just using the name if we couldn't make it throw.


	  var name = fn ? fn.displayName || fn.name : '';
	  var syntheticFrame = name ? describeBuiltInComponentFrame(name) : '';

	  {
	    if (typeof fn === 'function') {
	      componentFrameCache.set(fn, syntheticFrame);
	    }
	  }

	  return syntheticFrame;
	}
	function describeFunctionComponentFrame(fn, source, ownerFn) {
	  {
	    return describeNativeComponentFrame(fn, false);
	  }
	}

	function shouldConstruct(Component) {
	  var prototype = Component.prototype;
	  return !!(prototype && prototype.isReactComponent);
	}

	function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {

	  if (type == null) {
	    return '';
	  }

	  if (typeof type === 'function') {
	    {
	      return describeNativeComponentFrame(type, shouldConstruct(type));
	    }
	  }

	  if (typeof type === 'string') {
	    return describeBuiltInComponentFrame(type);
	  }

	  switch (type) {
	    case REACT_SUSPENSE_TYPE:
	      return describeBuiltInComponentFrame('Suspense');

	    case REACT_SUSPENSE_LIST_TYPE:
	      return describeBuiltInComponentFrame('SuspenseList');
	  }

	  if (typeof type === 'object') {
	    switch (type.$$typeof) {
	      case REACT_FORWARD_REF_TYPE:
	        return describeFunctionComponentFrame(type.render);

	      case REACT_MEMO_TYPE:
	        // Memo may contain any component type so we recursively resolve it.
	        return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);

	      case REACT_LAZY_TYPE:
	        {
	          var lazyComponent = type;
	          var payload = lazyComponent._payload;
	          var init = lazyComponent._init;

	          try {
	            // Lazy may contain any component type so we recursively resolve it.
	            return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
	          } catch (x) {}
	        }
	    }
	  }

	  return '';
	}

	var hasOwnProperty = Object.prototype.hasOwnProperty;

	var loggedTypeFailures = {};
	var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;

	function setCurrentlyValidatingElement(element) {
	  {
	    if (element) {
	      var owner = element._owner;
	      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
	      ReactDebugCurrentFrame.setExtraStackFrame(stack);
	    } else {
	      ReactDebugCurrentFrame.setExtraStackFrame(null);
	    }
	  }
	}

	function checkPropTypes(typeSpecs, values, location, componentName, element) {
	  {
	    // $FlowFixMe This is okay but Flow doesn't know it.
	    var has = Function.call.bind(hasOwnProperty);

	    for (var typeSpecName in typeSpecs) {
	      if (has(typeSpecs, typeSpecName)) {
	        var error$1 = void 0; // Prop type validation may throw. In case they do, we don't want to
	        // fail the render phase where it didn't fail before. So we log it.
	        // After these have been cleaned up, we'll let them throw.

	        try {
	          // This is intentionally an invariant that gets caught. It's the same
	          // behavior as without this statement except with a better message.
	          if (typeof typeSpecs[typeSpecName] !== 'function') {
	            // eslint-disable-next-line react-internal/prod-error-codes
	            var err = Error((componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' + 'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.' + 'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.');
	            err.name = 'Invariant Violation';
	            throw err;
	          }

	          error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED');
	        } catch (ex) {
	          error$1 = ex;
	        }

	        if (error$1 && !(error$1 instanceof Error)) {
	          setCurrentlyValidatingElement(element);

	          error('%s: type specification of %s' + ' `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error$1);

	          setCurrentlyValidatingElement(null);
	        }

	        if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
	          // Only monitor this failure once because there tends to be a lot of the
	          // same error.
	          loggedTypeFailures[error$1.message] = true;
	          setCurrentlyValidatingElement(element);

	          error('Failed %s type: %s', location, error$1.message);

	          setCurrentlyValidatingElement(null);
	        }
	      }
	    }
	  }
	}

	var isArrayImpl = Array.isArray; // eslint-disable-next-line no-redeclare

	function isArray(a) {
	  return isArrayImpl(a);
	}

	/*
	 * The `'' + value` pattern (used in in perf-sensitive code) throws for Symbol
	 * and Temporal.* types. See https://github.com/facebook/react/pull/22064.
	 *
	 * The functions in this module will throw an easier-to-understand,
	 * easier-to-debug exception with a clear errors message message explaining the
	 * problem. (Instead of a confusing exception thrown inside the implementation
	 * of the `value` object).
	 */
	// $FlowFixMe only called in DEV, so void return is not possible.
	function typeName(value) {
	  {
	    // toStringTag is needed for namespaced types like Temporal.Instant
	    var hasToStringTag = typeof Symbol === 'function' && Symbol.toStringTag;
	    var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || 'Object';
	    return type;
	  }
	} // $FlowFixMe only called in DEV, so void return is not possible.


	function willCoercionThrow(value) {
	  {
	    try {
	      testStringCoercion(value);
	      return false;
	    } catch (e) {
	      return true;
	    }
	  }
	}

	function testStringCoercion(value) {
	  // If you ended up here by following an exception call stack, here's what's
	  // happened: you supplied an object or symbol value to React (as a prop, key,
	  // DOM attribute, CSS property, string ref, etc.) and when React tried to
	  // coerce it to a string using `'' + value`, an exception was thrown.
	  //
	  // The most common types that will cause this exception are `Symbol` instances
	  // and Temporal objects like `Temporal.Instant`. But any object that has a
	  // `valueOf` or `[Symbol.toPrimitive]` method that throws will also cause this
	  // exception. (Library authors do this to prevent users from using built-in
	  // numeric operators like `+` or comparison operators like `>=` because custom
	  // methods are needed to perform accurate arithmetic or comparison.)
	  //
	  // To fix the problem, coerce this object or symbol value to a string before
	  // passing it to React. The most reliable way is usually `String(value)`.
	  //
	  // To find which value is throwing, check the browser or debugger console.
	  // Before this exception was thrown, there should be `console.error` output
	  // that shows the type (Symbol, Temporal.PlainDate, etc.) that caused the
	  // problem and how that type was used: key, atrribute, input value prop, etc.
	  // In most cases, this console output also shows the component and its
	  // ancestor components where the exception happened.
	  //
	  // eslint-disable-next-line react-internal/safe-string-coercion
	  return '' + value;
	}
	function checkKeyStringCoercion(value) {
	  {
	    if (willCoercionThrow(value)) {
	      error('The provided key is an unsupported type %s.' + ' This value must be coerced to a string before before using it here.', typeName(value));

	      return testStringCoercion(value); // throw (to help callers find troubleshooting comments)
	    }
	  }
	}

	var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
	var RESERVED_PROPS = {
	  key: true,
	  ref: true,
	  __self: true,
	  __source: true
	};
	var specialPropKeyWarningShown;
	var specialPropRefWarningShown;

	function hasValidRef(config) {
	  {
	    if (hasOwnProperty.call(config, 'ref')) {
	      var getter = Object.getOwnPropertyDescriptor(config, 'ref').get;

	      if (getter && getter.isReactWarning) {
	        return false;
	      }
	    }
	  }

	  return config.ref !== undefined;
	}

	function hasValidKey(config) {
	  {
	    if (hasOwnProperty.call(config, 'key')) {
	      var getter = Object.getOwnPropertyDescriptor(config, 'key').get;

	      if (getter && getter.isReactWarning) {
	        return false;
	      }
	    }
	  }

	  return config.key !== undefined;
	}

	function warnIfStringRefCannotBeAutoConverted(config, self) {
	  {
	    if (typeof config.ref === 'string' && ReactCurrentOwner.current && self) ;
	  }
	}

	function defineKeyPropWarningGetter(props, displayName) {
	  {
	    var warnAboutAccessingKey = function () {
	      if (!specialPropKeyWarningShown) {
	        specialPropKeyWarningShown = true;

	        error('%s: `key` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
	      }
	    };

	    warnAboutAccessingKey.isReactWarning = true;
	    Object.defineProperty(props, 'key', {
	      get: warnAboutAccessingKey,
	      configurable: true
	    });
	  }
	}

	function defineRefPropWarningGetter(props, displayName) {
	  {
	    var warnAboutAccessingRef = function () {
	      if (!specialPropRefWarningShown) {
	        specialPropRefWarningShown = true;

	        error('%s: `ref` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
	      }
	    };

	    warnAboutAccessingRef.isReactWarning = true;
	    Object.defineProperty(props, 'ref', {
	      get: warnAboutAccessingRef,
	      configurable: true
	    });
	  }
	}
	/**
	 * Factory method to create a new React element. This no longer adheres to
	 * the class pattern, so do not use new to call it. Also, instanceof check
	 * will not work. Instead test $$typeof field against Symbol.for('react.element') to check
	 * if something is a React Element.
	 *
	 * @param {*} type
	 * @param {*} props
	 * @param {*} key
	 * @param {string|object} ref
	 * @param {*} owner
	 * @param {*} self A *temporary* helper to detect places where `this` is
	 * different from the `owner` when React.createElement is called, so that we
	 * can warn. We want to get rid of owner and replace string `ref`s with arrow
	 * functions, and as long as `this` and owner are the same, there will be no
	 * change in behavior.
	 * @param {*} source An annotation object (added by a transpiler or otherwise)
	 * indicating filename, line number, and/or other information.
	 * @internal
	 */


	var ReactElement = function (type, key, ref, self, source, owner, props) {
	  var element = {
	    // This tag allows us to uniquely identify this as a React Element
	    $$typeof: REACT_ELEMENT_TYPE,
	    // Built-in properties that belong on the element
	    type: type,
	    key: key,
	    ref: ref,
	    props: props,
	    // Record the component responsible for creating this element.
	    _owner: owner
	  };

	  {
	    // The validation flag is currently mutative. We put it on
	    // an external backing store so that we can freeze the whole object.
	    // This can be replaced with a WeakMap once they are implemented in
	    // commonly used development environments.
	    element._store = {}; // To make comparing ReactElements easier for testing purposes, we make
	    // the validation flag non-enumerable (where possible, which should
	    // include every environment we run tests in), so the test framework
	    // ignores it.

	    Object.defineProperty(element._store, 'validated', {
	      configurable: false,
	      enumerable: false,
	      writable: true,
	      value: false
	    }); // self and source are DEV only properties.

	    Object.defineProperty(element, '_self', {
	      configurable: false,
	      enumerable: false,
	      writable: false,
	      value: self
	    }); // Two elements created in two different places should be considered
	    // equal for testing purposes and therefore we hide it from enumeration.

	    Object.defineProperty(element, '_source', {
	      configurable: false,
	      enumerable: false,
	      writable: false,
	      value: source
	    });

	    if (Object.freeze) {
	      Object.freeze(element.props);
	      Object.freeze(element);
	    }
	  }

	  return element;
	};
	/**
	 * https://github.com/reactjs/rfcs/pull/107
	 * @param {*} type
	 * @param {object} props
	 * @param {string} key
	 */

	function jsxDEV(type, config, maybeKey, source, self) {
	  {
	    var propName; // Reserved names are extracted

	    var props = {};
	    var key = null;
	    var ref = null; // Currently, key can be spread in as a prop. This causes a potential
	    // issue if key is also explicitly declared (ie. <div {...props} key="Hi" />
	    // or <div key="Hi" {...props} /> ). We want to deprecate key spread,
	    // but as an intermediary step, we will use jsxDEV for everything except
	    // <div {...props} key="Hi" />, because we aren't currently able to tell if
	    // key is explicitly declared to be undefined or not.

	    if (maybeKey !== undefined) {
	      {
	        checkKeyStringCoercion(maybeKey);
	      }

	      key = '' + maybeKey;
	    }

	    if (hasValidKey(config)) {
	      {
	        checkKeyStringCoercion(config.key);
	      }

	      key = '' + config.key;
	    }

	    if (hasValidRef(config)) {
	      ref = config.ref;
	      warnIfStringRefCannotBeAutoConverted(config, self);
	    } // Remaining properties are added to a new props object


	    for (propName in config) {
	      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
	        props[propName] = config[propName];
	      }
	    } // Resolve default props


	    if (type && type.defaultProps) {
	      var defaultProps = type.defaultProps;

	      for (propName in defaultProps) {
	        if (props[propName] === undefined) {
	          props[propName] = defaultProps[propName];
	        }
	      }
	    }

	    if (key || ref) {
	      var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;

	      if (key) {
	        defineKeyPropWarningGetter(props, displayName);
	      }

	      if (ref) {
	        defineRefPropWarningGetter(props, displayName);
	      }
	    }

	    return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
	  }
	}

	var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
	var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;

	function setCurrentlyValidatingElement$1(element) {
	  {
	    if (element) {
	      var owner = element._owner;
	      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
	      ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
	    } else {
	      ReactDebugCurrentFrame$1.setExtraStackFrame(null);
	    }
	  }
	}

	var propTypesMisspellWarningShown;

	{
	  propTypesMisspellWarningShown = false;
	}
	/**
	 * Verifies the object is a ReactElement.
	 * See https://reactjs.org/docs/react-api.html#isvalidelement
	 * @param {?object} object
	 * @return {boolean} True if `object` is a ReactElement.
	 * @final
	 */


	function isValidElement(object) {
	  {
	    return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
	  }
	}

	function getDeclarationErrorAddendum() {
	  {
	    if (ReactCurrentOwner$1.current) {
	      var name = getComponentNameFromType(ReactCurrentOwner$1.current.type);

	      if (name) {
	        return '\n\nCheck the render method of `' + name + '`.';
	      }
	    }

	    return '';
	  }
	}

	function getSourceInfoErrorAddendum(source) {
	  {

	    return '';
	  }
	}
	/**
	 * Warn if there's no key explicitly set on dynamic arrays of children or
	 * object keys are not valid. This allows us to keep track of children between
	 * updates.
	 */


	var ownerHasKeyUseWarning = {};

	function getCurrentComponentErrorInfo(parentType) {
	  {
	    var info = getDeclarationErrorAddendum();

	    if (!info) {
	      var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;

	      if (parentName) {
	        info = "\n\nCheck the top-level render call using <" + parentName + ">.";
	      }
	    }

	    return info;
	  }
	}
	/**
	 * Warn if the element doesn't have an explicit key assigned to it.
	 * This element is in an array. The array could grow and shrink or be
	 * reordered. All children that haven't already been validated are required to
	 * have a "key" property assigned to it. Error statuses are cached so a warning
	 * will only be shown once.
	 *
	 * @internal
	 * @param {ReactElement} element Element that requires a key.
	 * @param {*} parentType element's parent's type.
	 */


	function validateExplicitKey(element, parentType) {
	  {
	    if (!element._store || element._store.validated || element.key != null) {
	      return;
	    }

	    element._store.validated = true;
	    var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);

	    if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
	      return;
	    }

	    ownerHasKeyUseWarning[currentComponentErrorInfo] = true; // Usually the current owner is the offender, but if it accepts children as a
	    // property, it may be the creator of the child that's responsible for
	    // assigning it a key.

	    var childOwner = '';

	    if (element && element._owner && element._owner !== ReactCurrentOwner$1.current) {
	      // Give the component that originally created this child.
	      childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
	    }

	    setCurrentlyValidatingElement$1(element);

	    error('Each child in a list should have a unique "key" prop.' + '%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);

	    setCurrentlyValidatingElement$1(null);
	  }
	}
	/**
	 * Ensure that every element either is passed in a static location, in an
	 * array with an explicit keys property defined, or in an object literal
	 * with valid key property.
	 *
	 * @internal
	 * @param {ReactNode} node Statically passed child of any type.
	 * @param {*} parentType node's parent's type.
	 */


	function validateChildKeys(node, parentType) {
	  {
	    if (typeof node !== 'object') {
	      return;
	    }

	    if (isArray(node)) {
	      for (var i = 0; i < node.length; i++) {
	        var child = node[i];

	        if (isValidElement(child)) {
	          validateExplicitKey(child, parentType);
	        }
	      }
	    } else if (isValidElement(node)) {
	      // This element was passed in a valid location.
	      if (node._store) {
	        node._store.validated = true;
	      }
	    } else if (node) {
	      var iteratorFn = getIteratorFn(node);

	      if (typeof iteratorFn === 'function') {
	        // Entry iterators used to provide implicit keys,
	        // but now we print a separate warning for them later.
	        if (iteratorFn !== node.entries) {
	          var iterator = iteratorFn.call(node);
	          var step;

	          while (!(step = iterator.next()).done) {
	            if (isValidElement(step.value)) {
	              validateExplicitKey(step.value, parentType);
	            }
	          }
	        }
	      }
	    }
	  }
	}
	/**
	 * Given an element, validate that its props follow the propTypes definition,
	 * provided by the type.
	 *
	 * @param {ReactElement} element
	 */


	function validatePropTypes(element) {
	  {
	    var type = element.type;

	    if (type === null || type === undefined || typeof type === 'string') {
	      return;
	    }

	    var propTypes;

	    if (typeof type === 'function') {
	      propTypes = type.propTypes;
	    } else if (typeof type === 'object' && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
	    // Inner props are checked in the reconciler.
	    type.$$typeof === REACT_MEMO_TYPE)) {
	      propTypes = type.propTypes;
	    } else {
	      return;
	    }

	    if (propTypes) {
	      // Intentionally inside to avoid triggering lazy initializers:
	      var name = getComponentNameFromType(type);
	      checkPropTypes(propTypes, element.props, 'prop', name, element);
	    } else if (type.PropTypes !== undefined && !propTypesMisspellWarningShown) {
	      propTypesMisspellWarningShown = true; // Intentionally inside to avoid triggering lazy initializers:

	      var _name = getComponentNameFromType(type);

	      error('Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?', _name || 'Unknown');
	    }

	    if (typeof type.getDefaultProps === 'function' && !type.getDefaultProps.isReactClassApproved) {
	      error('getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.');
	    }
	  }
	}
	/**
	 * Given a fragment, validate that it can only be provided with fragment props
	 * @param {ReactElement} fragment
	 */


	function validateFragmentProps(fragment) {
	  {
	    var keys = Object.keys(fragment.props);

	    for (var i = 0; i < keys.length; i++) {
	      var key = keys[i];

	      if (key !== 'children' && key !== 'key') {
	        setCurrentlyValidatingElement$1(fragment);

	        error('Invalid prop `%s` supplied to `React.Fragment`. ' + 'React.Fragment can only have `key` and `children` props.', key);

	        setCurrentlyValidatingElement$1(null);
	        break;
	      }
	    }

	    if (fragment.ref !== null) {
	      setCurrentlyValidatingElement$1(fragment);

	      error('Invalid attribute `ref` supplied to `React.Fragment`.');

	      setCurrentlyValidatingElement$1(null);
	    }
	  }
	}

	var didWarnAboutKeySpread = {};
	function jsxWithValidation(type, props, key, isStaticChildren, source, self) {
	  {
	    var validType = isValidElementType(type); // We warn in this case but don't throw. We expect the element creation to
	    // succeed and there will likely be errors in render.

	    if (!validType) {
	      var info = '';

	      if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
	        info += ' You likely forgot to export your component from the file ' + "it's defined in, or you might have mixed up default and named imports.";
	      }

	      var sourceInfo = getSourceInfoErrorAddendum();

	      if (sourceInfo) {
	        info += sourceInfo;
	      } else {
	        info += getDeclarationErrorAddendum();
	      }

	      var typeString;

	      if (type === null) {
	        typeString = 'null';
	      } else if (isArray(type)) {
	        typeString = 'array';
	      } else if (type !== undefined && type.$$typeof === REACT_ELEMENT_TYPE) {
	        typeString = "<" + (getComponentNameFromType(type.type) || 'Unknown') + " />";
	        info = ' Did you accidentally export a JSX literal instead of a component?';
	      } else {
	        typeString = typeof type;
	      }

	      error('React.jsx: type is invalid -- expected a string (for ' + 'built-in components) or a class/function (for composite ' + 'components) but got: %s.%s', typeString, info);
	    }

	    var element = jsxDEV(type, props, key, source, self); // The result can be nullish if a mock or a custom function is used.
	    // TODO: Drop this when these are no longer allowed as the type argument.

	    if (element == null) {
	      return element;
	    } // Skip key warning if the type isn't valid since our key validation logic
	    // doesn't expect a non-string/function type and can throw confusing errors.
	    // We don't want exception behavior to differ between dev and prod.
	    // (Rendering will throw with a helpful message and as soon as the type is
	    // fixed, the key warnings will appear.)


	    if (validType) {
	      var children = props.children;

	      if (children !== undefined) {
	        if (isStaticChildren) {
	          if (isArray(children)) {
	            for (var i = 0; i < children.length; i++) {
	              validateChildKeys(children[i], type);
	            }

	            if (Object.freeze) {
	              Object.freeze(children);
	            }
	          } else {
	            error('React.jsx: Static children should always be an array. ' + 'You are likely explicitly calling React.jsxs or React.jsxDEV. ' + 'Use the Babel transform instead.');
	          }
	        } else {
	          validateChildKeys(children, type);
	        }
	      }
	    }

	    {
	      if (hasOwnProperty.call(props, 'key')) {
	        var componentName = getComponentNameFromType(type);
	        var keys = Object.keys(props).filter(function (k) {
	          return k !== 'key';
	        });
	        var beforeExample = keys.length > 0 ? '{key: someKey, ' + keys.join(': ..., ') + ': ...}' : '{key: someKey}';

	        if (!didWarnAboutKeySpread[componentName + beforeExample]) {
	          var afterExample = keys.length > 0 ? '{' + keys.join(': ..., ') + ': ...}' : '{}';

	          error('A props object containing a "key" prop is being spread into JSX:\n' + '  let props = %s;\n' + '  <%s {...props} />\n' + 'React keys must be passed directly to JSX without using spread:\n' + '  let props = %s;\n' + '  <%s key={someKey} {...props} />', beforeExample, componentName, afterExample, componentName);

	          didWarnAboutKeySpread[componentName + beforeExample] = true;
	        }
	      }
	    }

	    if (type === REACT_FRAGMENT_TYPE) {
	      validateFragmentProps(element);
	    } else {
	      validatePropTypes(element);
	    }

	    return element;
	  }
	} // These two functions exist to still get child warnings in dev
	// even with the prod transform. This means that jsxDEV is purely
	// opt-in behavior for better messages but that we won't stop
	// giving you warnings if you use production apis.

	function jsxWithValidationStatic(type, props, key) {
	  {
	    return jsxWithValidation(type, props, key, true);
	  }
	}
	function jsxWithValidationDynamic(type, props, key) {
	  {
	    return jsxWithValidation(type, props, key, false);
	  }
	}

	var jsx =  jsxWithValidationDynamic ; // we may want to special case jsxs internally to take advantage of static children.
	// for now we can ship identical prod functions

	var jsxs =  jsxWithValidationStatic ;

	reactJsxRuntime_development.Fragment = REACT_FRAGMENT_TYPE;
	reactJsxRuntime_development.jsx = jsx;
	reactJsxRuntime_development.jsxs = jsxs;
	  })();
	}
	return reactJsxRuntime_development;
}

if (process.env.NODE_ENV === 'production') {
  jsxRuntime.exports = requireReactJsxRuntime_production_min();
} else {
  jsxRuntime.exports = requireReactJsxRuntime_development();
}

var jsxRuntimeExports = jsxRuntime.exports;

class ErrorBoundary extends require$$0.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }
    componentDidCatch(error, errorInfo) {
        this.setState({
            hasError: true,
            error,
            errorInfo
        });
        // Report to Error Explorer if reporter is provided
        if (this.props.errorReporter) {
            try {
                this.props.errorReporter.reportError(error, {
                    type: 'ReactError',
                    componentStack: errorInfo.componentStack,
                    reactErrorInfo: errorInfo,
                });
            }
            catch (reporterError) {
                // If the error reporter itself fails, log to console but don't throw
                console.error('[ErrorBoundary] Failed to report error:', reporterError);
            }
        }
        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }
    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                if (typeof this.props.fallback === 'function') {
                    return this.props.fallback(this.state.error, this.state.errorInfo);
                }
                return this.props.fallback;
            }
            // Default fallback UI
            return (jsxRuntimeExports.jsxs("div", { style: {
                    padding: '20px',
                    border: '1px solid #ff6b6b',
                    borderRadius: '4px',
                    backgroundColor: '#ffe0e0',
                    color: '#d63031',
                    fontFamily: 'monospace',
                }, children: [jsxRuntimeExports.jsx("h2", { children: "\u26A0\uFE0F Something went wrong" }), jsxRuntimeExports.jsxs("details", { style: { marginTop: '10px' }, children: [jsxRuntimeExports.jsx("summary", { style: { cursor: 'pointer', fontWeight: 'bold' }, children: "Error Details" }), jsxRuntimeExports.jsxs("pre", { style: {
                                    marginTop: '10px',
                                    padding: '10px',
                                    backgroundColor: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    overflow: 'auto',
                                }, children: [this.state.error?.message, this.state.error?.stack && (jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: ['\n\nStack Trace:\n', this.state.error.stack] })), this.state.errorInfo?.componentStack && (jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: ['\n\nComponent Stack:\n', this.state.errorInfo.componentStack] }))] })] })] }));
        }
        return this.props.children;
    }
}

const ErrorReporterContext = require$$0.createContext(null);
const ErrorReporterProvider = ({ children, config, }) => {
    const errorReporter = require$$0.useMemo(() => {
        return new ErrorReporter(config);
    }, [config]);
    return (jsxRuntimeExports.jsx(ErrorReporterContext.Provider, { value: errorReporter, children: children }));
};

const useErrorReporter = () => {
    const errorReporter = require$$0.useContext(ErrorReporterContext);
    if (!errorReporter) {
        throw new Error('useErrorReporter must be used within an ErrorReporterProvider');
    }
    const reportError = require$$0.useCallback(async (error, additionalData) => {
        await errorReporter.reportError(error, additionalData);
    }, [errorReporter]);
    const reportMessage = require$$0.useCallback(async (message, level = 'error', additionalData) => {
        await errorReporter.reportMessage(message, level, additionalData);
    }, [errorReporter]);
    const addBreadcrumb = require$$0.useCallback((message, category, level, data) => {
        errorReporter.addBreadcrumb(message, category, level, data);
    }, [errorReporter]);
    const logUserAction = require$$0.useCallback((action, data) => {
        errorReporter.logUserAction(action, data);
    }, [errorReporter]);
    const logNavigation = require$$0.useCallback((from, to, data) => {
        errorReporter.logNavigation(from, to, data);
    }, [errorReporter]);
    const setUserId = require$$0.useCallback((userId) => {
        errorReporter.setUserId(userId);
    }, [errorReporter]);
    const setUserEmail = require$$0.useCallback((email) => {
        errorReporter.setUserEmail(email);
    }, [errorReporter]);
    const setCustomData = require$$0.useCallback((data) => {
        errorReporter.setCustomData(data);
    }, [errorReporter]);
    const clearBreadcrumbs = require$$0.useCallback(() => {
        errorReporter.clearBreadcrumbs();
    }, [errorReporter]);
    const isEnabled = require$$0.useCallback(() => {
        return errorReporter.isEnabled();
    }, [errorReporter]);
    const getStats = require$$0.useCallback(() => {
        return errorReporter.getStats();
    }, [errorReporter]);
    const flushQueue = require$$0.useCallback(async () => {
        await errorReporter.flushQueue();
    }, [errorReporter]);
    const updateConfig = require$$0.useCallback((updates) => {
        errorReporter.updateConfig(updates);
    }, [errorReporter]);
    return {
        reportError,
        reportMessage,
        addBreadcrumb,
        logUserAction,
        logNavigation,
        setUserId,
        setUserEmail,
        setCustomData,
        clearBreadcrumbs,
        isEnabled,
        getStats,
        flushQueue,
        updateConfig,
    };
};

/**
 * Utility function to safely stringify objects for error reporting
 */
const safeStringify = (obj, space) => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
        }
        // Handle functions
        if (typeof value === 'function') {
            return '[Function]';
        }
        // Handle undefined
        if (value === undefined) {
            return '[Undefined]';
        }
        return value;
    }, space);
};
/**
 * Extract meaningful information from an error object
 */
const extractErrorInfo = (error) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    if (typeof error === 'string') {
        return {
            name: 'StringError',
            message: error,
            stack: undefined,
        };
    }
    return {
        name: 'UnknownError',
        message: safeStringify(error),
        stack: undefined,
    };
};
/**
 * Get user-friendly browser information
 */
const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    // Detect browser
    let browser = 'Unknown';
    let version = 'Unknown';
    if (ua.includes('Chrome')) {
        browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        version = match ? match[1] : 'Unknown';
    }
    else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        version = match ? match[1] : 'Unknown';
    }
    else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        version = match ? match[1] : 'Unknown';
    }
    else if (ua.includes('Edge')) {
        browser = 'Edge';
        const match = ua.match(/Edge\/(\d+)/);
        version = match ? match[1] : 'Unknown';
    }
    return {
        browser,
        version,
        userAgent: ua,
        platform: navigator.platform,
        language: navigator.language,
    };
};
/**
 * Get performance information if available
 */
const getPerformanceInfo = () => {
    if (!window.performance) {
        return null;
    }
    const navigation = window.performance.getEntriesByType('navigation')[0];
    if (!navigation) {
        return null;
    }
    return {
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
        loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
        domInteractive: Math.round(navigation.domInteractive - navigation.domContentLoadedEventStart),
        firstPaint: getFirstPaint(),
    };
};
/**
 * Get First Paint timing if available
 */
const getFirstPaint = () => {
    if (!window.performance || !window.performance.getEntriesByType) {
        return null;
    }
    const paintEntries = window.performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? Math.round(firstPaint.startTime) : null;
};
/**
 * Debounce function to limit rapid fire events
 */
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), wait);
    };
};
/**
 * Generate a unique session ID
 */
const generateSessionId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
/**
 * Check if we're in a development environment
 */
const isDevelopment = () => {
    return process.env.NODE_ENV === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
};

exports.BreadcrumbManager = BreadcrumbManager;
exports.ErrorBoundary = ErrorBoundary;
exports.ErrorReporter = ErrorReporter;
exports.ErrorReporterProvider = ErrorReporterProvider;
exports.OfflineManager = OfflineManager;
exports.QuotaManager = QuotaManager;
exports.RateLimiter = RateLimiter;
exports.RetryManager = RetryManager;
exports.SDKMonitor = SDKMonitor;
exports.SecurityValidator = SecurityValidator;
exports.debounce = debounce;
exports.extractErrorInfo = extractErrorInfo;
exports.generateSessionId = generateSessionId;
exports.getBrowserInfo = getBrowserInfo;
exports.getPerformanceInfo = getPerformanceInfo;
exports.isDevelopment = isDevelopment;
exports.safeStringify = safeStringify;
exports.useErrorReporter = useErrorReporter;
//# sourceMappingURL=index.js.map
