import React, { createContext, ReactNode, useMemo } from 'react';
import { ErrorReporter } from '../services/ErrorReporter';
import { ErrorReporterConfig } from '../types';

export const ErrorReporterContext = createContext<ErrorReporter | null>(null);

interface ErrorReporterProviderProps {
  children: ReactNode;
  config: ErrorReporterConfig;
}

export const ErrorReporterProvider: React.FC<ErrorReporterProviderProps> = ({
  children,
  config,
}) => {
  const errorReporter = useMemo(() => {
    return new ErrorReporter(config);
  }, [config]);

  return (
    <ErrorReporterContext.Provider value={errorReporter}>
      {children}
    </ErrorReporterContext.Provider>
  );
};