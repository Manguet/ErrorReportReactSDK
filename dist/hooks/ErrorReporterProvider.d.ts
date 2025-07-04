import React, { ReactNode } from 'react';
import { ErrorReporter } from '../services/ErrorReporter';
import { ErrorReporterConfig } from '../types';
export declare const ErrorReporterContext: React.Context<ErrorReporter | null>;
interface ErrorReporterProviderProps {
    children: ReactNode;
    config: ErrorReporterConfig;
}
export declare const ErrorReporterProvider: React.FC<ErrorReporterProviderProps>;
export {};
//# sourceMappingURL=ErrorReporterProvider.d.ts.map