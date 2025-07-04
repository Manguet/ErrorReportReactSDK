import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { ErrorReporter } from '../../src/services/ErrorReporter';

// Mock ErrorReporter
const mockErrorReporter = {
  reportError: jest.fn(),
} as unknown as ErrorReporter;

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component that throws during render
const ThrowDuringRender: React.FC = () => {
  throw new Error('Render error');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not call error reporter when no error occurs', () => {
      render(
        <ErrorBoundary errorReporter={mockErrorReporter}>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(mockErrorReporter.reportError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display default error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText('Error Details')).toBeInTheDocument();
    });

    it('should report error to ErrorReporter when provided', () => {
      render(
        <ErrorBoundary errorReporter={mockErrorReporter}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(mockErrorReporter.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          type: 'ReactError',
          componentStack: expect.any(String),
          reactErrorInfo: expect.any(Object),
        })
      );
    });

    it('should call custom onError handler when provided', () => {
      const mockOnError = jest.fn();

      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should display custom fallback UI when provided as component', () => {
      const CustomFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    });

    it('should call custom fallback function when provided', () => {
      const mockFallback = jest.fn().mockReturnValue(<div>Function fallback</div>);

      render(
        <ErrorBoundary fallback={mockFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(mockFallback).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
      expect(screen.getByText('Function fallback')).toBeInTheDocument();
    });
  });

  describe('Error Details Display', () => {
    it('should display error message in default UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Click to expand details
      const detailsElement = screen.getByText('Error Details');
      detailsElement.click();

      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    it('should display stack trace when available', () => {
      render(
        <ErrorBoundary>
          <ThrowDuringRender />
        </ErrorBoundary>
      );

      const detailsElement = screen.getByText('Error Details');
      detailsElement.click();

      // Check that stack trace section exists
      expect(screen.getByText(/Stack Trace:/)).toBeInTheDocument();
    });

    it('should display component stack when available', () => {
      render(
        <ErrorBoundary>
          <ThrowDuringRender />
        </ErrorBoundary>
      );

      const detailsElement = screen.getByText('Error Details');
      detailsElement.click();

      // Component stack should be shown
      expect(screen.getByText(/Component Stack:/)).toBeInTheDocument();
    });
  });

  describe('Multiple Errors', () => {
    it('should handle multiple different errors', () => {
      // First error
      const { unmount } = render(
        <ErrorBoundary errorReporter={mockErrorReporter}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(mockErrorReporter.reportError).toHaveBeenCalledTimes(1);
      expect(mockErrorReporter.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          type: 'ReactError',
          componentStack: expect.any(String),
        })
      );

      // Unmount and reset
      unmount();
      jest.clearAllMocks();

      // Second error with different component
      render(
        <ErrorBoundary errorReporter={mockErrorReporter}>
          <ThrowDuringRender />
        </ErrorBoundary>
      );

      expect(mockErrorReporter.reportError).toHaveBeenCalledTimes(1);
      expect(mockErrorReporter.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          type: 'ReactError',
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without error reporter gracefully', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    it('should handle errors without custom error handler gracefully', () => {
      expect(() => {
        render(
          <ErrorBoundary errorReporter={mockErrorReporter}>
            <ThrowError />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    it('should handle null/undefined children', () => {
      render(
        <ErrorBoundary>
          {null}
          {undefined}
        </ErrorBoundary>
      );

      // Should not crash
      expect(document.body).toBeInTheDocument();
    });

    it('should handle errors from error reporter itself', () => {
      const faultyReporter = {
        reportError: jest.fn().mockImplementation(() => {
          throw new Error('Reporter error');
        }),
      } as unknown as ErrorReporter;

      expect(() => {
        render(
          <ErrorBoundary errorReporter={faultyReporter}>
            <ThrowError />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should update state correctly when error occurs', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Error UI should be displayed
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h2')?.textContent).toContain('Something went wrong');
    });

    it('should not render children after error', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
          <div>Should not be visible</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
    });
  });
});