import React, { Component, ReactNode } from 'react';
import { ErrorBoundaryState, ReactErrorInfo } from '../types';
import { ErrorReporter } from '../services/ErrorReporter';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ReactErrorInfo) => ReactNode);
  onError?: (error: Error, errorInfo: ReactErrorInfo) => void;
  errorReporter?: ErrorReporter;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo) {
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
      } catch (reporterError) {
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
          return this.props.fallback(this.state.error!, this.state.errorInfo!);
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          padding: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          backgroundColor: '#ffe0e0',
          color: '#d63031',
          fontFamily: 'monospace',
        }}>
          <h2>⚠️ Something went wrong</h2>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details
            </summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
            }}>
              {this.state.error?.message}
              {this.state.error?.stack && (
                <>
                  {'\n\nStack Trace:\n'}
                  {this.state.error.stack}
                </>
              )}
              {this.state.errorInfo?.componentStack && (
                <>
                  {'\n\nComponent Stack:\n'}
                  {this.state.errorInfo.componentStack}
                </>
              )}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
