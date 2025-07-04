import React, { Component, ReactNode } from 'react';
import { ErrorBoundaryState, ReactErrorInfo } from '../types';
import { ErrorReporter } from '../services/ErrorReporter';
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode | ((error: Error, errorInfo: ReactErrorInfo) => ReactNode);
    onError?: (error: Error, errorInfo: ReactErrorInfo) => void;
    errorReporter?: ErrorReporter;
}
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, errorInfo: ReactErrorInfo): void;
    render(): string | number | boolean | Iterable<React.ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
}
export {};
//# sourceMappingURL=ErrorBoundary.d.ts.map