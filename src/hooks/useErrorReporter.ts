import { useContext, useCallback } from 'react';
import { ErrorReporterContext } from './ErrorReporterProvider';

export interface UseErrorReporter {
  reportError: (error: Error, additionalData?: Record<string, any>) => Promise<void>;
  reportMessage: (
    message: string,
    level?: 'info' | 'warning' | 'error',
    additionalData?: Record<string, any>
  ) => Promise<void>;
  addBreadcrumb: (
    message: string,
    category?: string,
    level?: 'info' | 'warning' | 'error' | 'debug',
    data?: Record<string, any>
  ) => void;
  logUserAction: (action: string, data?: Record<string, any>) => void;
  logNavigation: (from: string, to: string, data?: Record<string, any>) => void;
  setUserId: (userId: string) => void;
  setUserEmail: (email: string) => void;
  setCustomData: (data: Record<string, any>) => void;
  clearBreadcrumbs: () => void;
  isEnabled: () => boolean;
  // New methods
  getStats: () => {
    queueSize: number;
    isOnline: boolean;
    rateLimitRemaining: number;
    rateLimitReset: number;
  };
  flushQueue: () => Promise<void>;
  updateConfig: (updates: Partial<import('../types').ErrorReporterConfig>) => void;
}

export const useErrorReporter = (): UseErrorReporter => {
  const errorReporter = useContext(ErrorReporterContext);

  if (!errorReporter) {
    throw new Error(
      'useErrorReporter must be used within an ErrorReporterProvider'
    );
  }

  const reportError = useCallback(
    async (error: Error, additionalData?: Record<string, any>) => {
      await errorReporter.reportError(error, additionalData);
    },
    [errorReporter]
  );

  const reportMessage = useCallback(
    async (
      message: string,
      level: 'info' | 'warning' | 'error' = 'error',
      additionalData?: Record<string, any>
    ) => {
      await errorReporter.reportMessage(message, level, additionalData);
    },
    [errorReporter]
  );

  const addBreadcrumb = useCallback(
    (
      message: string,
      category?: string,
      level?: 'info' | 'warning' | 'error' | 'debug',
      data?: Record<string, any>
    ) => {
      errorReporter.addBreadcrumb(message, category, level, data);
    },
    [errorReporter]
  );

  const logUserAction = useCallback(
    (action: string, data?: Record<string, any>) => {
      errorReporter.logUserAction(action, data);
    },
    [errorReporter]
  );

  const logNavigation = useCallback(
    (from: string, to: string, data?: Record<string, any>) => {
      errorReporter.logNavigation(from, to, data);
    },
    [errorReporter]
  );

  const setUserId = useCallback(
    (userId: string) => {
      errorReporter.setUserId(userId);
    },
    [errorReporter]
  );

  const setUserEmail = useCallback(
    (email: string) => {
      errorReporter.setUserEmail(email);
    },
    [errorReporter]
  );

  const setCustomData = useCallback(
    (data: Record<string, any>) => {
      errorReporter.setCustomData(data);
    },
    [errorReporter]
  );

  const clearBreadcrumbs = useCallback(() => {
    errorReporter.clearBreadcrumbs();
  }, [errorReporter]);

  const isEnabled = useCallback(() => {
    return errorReporter.isEnabled();
  }, [errorReporter]);

  const getStats = useCallback(() => {
    return errorReporter.getStats();
  }, [errorReporter]);

  const flushQueue = useCallback(async () => {
    await errorReporter.flushQueue();
  }, [errorReporter]);

  const updateConfig = useCallback((updates: Partial<import('../types').ErrorReporterConfig>) => {
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