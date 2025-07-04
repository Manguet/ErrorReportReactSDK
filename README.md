# React Error Reporter

[![npm version](https://badge.fury.io/js/error-explorer-react-reporter.svg)](https://badge.fury.io/js/error-explorer-react-reporter)
[![CI](https://github.com/Manguet/ErrorReportReactSDK/actions/workflows/ci.yml/badge.svg)](https://github.com/Manguet/ErrorReportReactSDK/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Manguet/ErrorReportReactSDK/branch/main/graph/badge.svg)](https://codecov.io/gh/Manguet/ErrorReportReactSDK)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive React SDK for Error Explorer - client-side error tracking and reporting for React applications.

## Features

- 🚀 **Easy Integration**: Simple setup with React Context API
- 🛡️ **Error Boundary**: Built-in React Error Boundary component
- 🍞 **Breadcrumbs**: Automatic tracking of user actions, navigation, and HTTP requests
- 🎯 **TypeScript Support**: Fully typed with TypeScript
- 🔧 **Customizable**: Flexible configuration options
- 📊 **Performance Tracking**: Optional performance metrics collection
- 🐛 **Debug Mode**: Development-friendly debugging features
- 🔄 **Retry Logic**: Exponential backoff retry mechanism for failed requests
- 🚦 **Rate Limiting**: Prevents spam and duplicate error reporting
- 📡 **Offline Support**: Queues errors when offline and sends when back online
- ⚡ **Performance Optimized**: Minimal bundle size with tree-shaking support
- 🧹 **Memory Efficient**: Automatic cleanup and resource management

## Installation

```bash
npm install error-explorer-react-reporter
```

## Quick Start

### 1. Wrap your app with ErrorReporterProvider

```tsx
import React from 'react';
import { ErrorReporterProvider } from 'error-explorer-react-reporter';

function App() {
  return (
    <ErrorReporterProvider
      config={{
        projectToken: 'your-project-token',
        apiUrl: 'https://your-error-explorer-instance.com',
        environment: 'production',
        debug: process.env.NODE_ENV === 'development',
      }}
    >
      <YourApp />
    </ErrorReporterProvider>
  );
}
```

### 2. Add Error Boundary (Optional)

```tsx
import React from 'react';
import { ErrorBoundary, useErrorReporter } from 'error-explorer-react-reporter';

function YourApp() {
  const { errorReporter } = useErrorReporter();

  return (
    <ErrorBoundary
      errorReporter={errorReporter}
      fallback={<div>Something went wrong!</div>}
    >
      <YourComponents />
    </ErrorBoundary>
  );
}
```

### 3. Use the hook in your components

```tsx
import React from 'react';
import { useErrorReporter } from 'error-explorer-react-reporter';

function MyComponent() {
  const { reportError, reportMessage, addBreadcrumb, logUserAction } = useErrorReporter();

  const handleClick = async () => {
    try {
      // Log user action
      logUserAction('button_click', { buttonId: 'submit-form' });
      
      // Some operation that might fail
      await riskyOperation();
    } catch (error) {
      // Report the error
      await reportError(error, { context: 'form_submission' });
    }
  };

  const handleCustomReport = () => {
    // Report custom message
    reportMessage('Custom tracking event', 'info', { userId: '123' });
  };

  return (
    <div>
      <button onClick={handleClick}>Submit</button>
      <button onClick={handleCustomReport}>Track Event</button>
    </div>
  );
}
```

## Configuration

```tsx
interface ErrorReporterConfig {
  projectToken: string;           // Your Error Explorer project token
  apiUrl: string;                // Your Error Explorer instance URL
  environment?: string;          // Environment (production, staging, development)
  enabled?: boolean;             // Enable/disable error reporting (default: true)
  userId?: string;               // Current user ID
  userEmail?: string;            // Current user email
  customData?: Record<string, any>; // Custom metadata
  debug?: boolean;               // Enable debug logging (default: false)
  maxBreadcrumbs?: number;       // Maximum breadcrumbs to keep (default: 50)
  commitHash?: string;           // The git commit hash of the current build
  version?: string;              // Your application version (default: '1.0.0')
  projectName?: string;          // Your project name (default: 'react-app')
  
  // Rate limiting options
  maxRequestsPerMinute?: number; // Max requests per minute (default: 10)
  duplicateErrorWindow?: number; // Window to prevent duplicate errors (default: 5000ms)
  
  // Retry configuration
  maxRetries?: number;           // Max retry attempts (default: 3)
  initialRetryDelay?: number;    // Initial retry delay (default: 1000ms)
  maxRetryDelay?: number;        // Maximum retry delay (default: 30000ms)
  
  // Offline support
  enableOfflineSupport?: boolean;  // Enable offline queue (default: true)
  maxOfflineQueueSize?: number;    // Max queued errors (default: 50)
  offlineQueueMaxAge?: number;     // Max age of queued errors (default: 24h)
}
```

### Providing the Commit Hash

To link errors with your source code, you should provide the git commit hash of the current build. You can do this by setting an environment variable during your build process.

**1. Get the commit hash:**
```bash
export REACT_APP_COMMIT_HASH=$(git rev-parse HEAD)
```

**2. Use it in your configuration:**
```tsx
<ErrorReporterProvider
  config={{
    // ... other config
    commitHash: process.env.REACT_APP_COMMIT_HASH,
  }}
>
  <YourApp />
</ErrorReporterProvider>
```

## API Reference

### useErrorReporter Hook

```tsx
const {
  reportError,      // Report an Error object
  reportMessage,    // Report a custom message
  addBreadcrumb,    // Add a custom breadcrumb
  logUserAction,    // Log user interactions
  logNavigation,    // Log navigation changes
  setUserId,        // Set current user ID
  setUserEmail,     // Set current user email
  setCustomData,    // Set custom metadata
  clearBreadcrumbs, // Clear all breadcrumbs
  isEnabled,        // Check if reporting is enabled
  
  // New advanced methods
  getStats,         // Get reporter statistics
  flushQueue,       // Manually flush offline queue
  updateConfig,     // Update configuration at runtime
} = useErrorReporter();
```

### Methods

#### `reportError(error: Error, additionalData?: Record<string, any>)`
Report an Error object with optional additional context.

#### `reportMessage(message: string, level?: 'info' | 'warning' | 'error', additionalData?: Record<string, any>)`
Report a custom message with severity level.

#### `addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error' | 'debug', data?: Record<string, any>)`
Add a custom breadcrumb for tracking user journey.

#### `logUserAction(action: string, data?: Record<string, any>)`
Log user interactions like clicks, form submissions, etc.

#### `logNavigation(from: string, to: string, data?: Record<string, any>)`
Log navigation changes in your SPA.

#### `getStats()`
Get current reporter statistics including queue size, online status, and rate limit information.

```tsx
const stats = getStats();
console.log(stats);
// {
//   queueSize: 3,
//   isOnline: true,
//   rateLimitRemaining: 7,
//   rateLimitReset: 1640995200000
// }
```

#### `flushQueue()`
Manually process the offline queue (useful for critical errors).

```tsx
await flushQueue();
```

#### `updateConfig(updates: Partial<ErrorReporterConfig>)`
Update configuration at runtime.

```tsx
updateConfig({
  userId: 'new-user-id',
  environment: 'staging',
  debug: true
});
```

### ErrorBoundary Component

```tsx
<ErrorBoundary
  errorReporter={errorReporter}  // ErrorReporter instance
  fallback={<CustomErrorUI />}   // Custom error UI
  onError={(error, errorInfo) => {}} // Custom error handler
>
  <YourComponent />
</ErrorBoundary>
```

## Automatic Tracking

The SDK automatically tracks:

- **Unhandled JavaScript errors**
- **Unhandled promise rejections**
- **Console errors and warnings** (as breadcrumbs)
- **HTTP requests** (fetch API, as breadcrumbs)
- **Navigation changes** (optimized with event listeners, as breadcrumbs)
- **Rate limiting** (prevents spam and duplicate errors)
- **Offline errors** (queued and sent when back online)

## Breadcrumbs

Breadcrumbs help you understand what led to an error:

```tsx
// Automatic breadcrumbs
// - Navigation: /home → /profile
// - HTTP: GET /api/user (200)
// - User action: button_click
// - Console error: TypeError: Cannot read property...

// Manual breadcrumbs
addBreadcrumb('User opened settings', 'navigation', 'info');
addBreadcrumb('Form validation failed', 'validation', 'warning', {
  field: 'email',
  value: 'invalid-email'
});
```

## TypeScript Support

The package is fully typed. Import types as needed:

```tsx
import type {
  ErrorReporterConfig,
  Breadcrumb,
  ErrorContext,
  UseErrorReporter,
} from 'error-explorer-react-reporter';
```

## Environment-specific Configuration

```tsx
const config: ErrorReporterConfig = {
  projectToken: process.env.REACT_APP_ERROR_EXPLORER_TOKEN!,
  apiUrl: process.env.REACT_APP_ERROR_EXPLORER_URL!,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  userId: getCurrentUserId(),
  customData: {
    version: process.env.REACT_APP_VERSION,
    buildDate: process.env.REACT_APP_BUILD_DATE,
  },
};
```

## Advanced Features

### Rate Limiting and Duplicate Prevention

The SDK automatically prevents spam and duplicate errors:

```tsx
<ErrorReporterProvider
  config={{
    // ... other config
    maxRequestsPerMinute: 20,        // Allow up to 20 errors per minute
    duplicateErrorWindow: 10000,     // Prevent same error for 10 seconds
  }}
>
```

### Offline Support

Errors are automatically queued when offline and sent when connectivity is restored:

```tsx
<ErrorReporterProvider
  config={{
    // ... other config
    enableOfflineSupport: true,      // Enable offline queue
    maxOfflineQueueSize: 100,        // Queue up to 100 errors
    offlineQueueMaxAge: 86400000,    // Keep for 24 hours
  }}
>
```

### Retry Logic

Failed requests are automatically retried with exponential backoff:

```tsx
<ErrorReporterProvider
  config={{
    // ... other config
    maxRetries: 5,                   // Retry up to 5 times
    initialRetryDelay: 2000,         // Start with 2 second delay
    maxRetryDelay: 60000,            // Max 1 minute delay
  }}
>
```

### Performance Monitoring

Monitor the SDK's performance in real-time:

```tsx
const { getStats } = useErrorReporter();

useEffect(() => {
  const interval = setInterval(() => {
    const stats = getStats();
    if (stats.queueSize > 10) {
      console.warn('Error queue is growing:', stats);
    }
  }, 30000);
  
  return () => clearInterval(interval);
}, [getStats]);
```

### Bundle Size Optimization

For minimal applications, use the lightweight version:

```tsx
import { createMinimalErrorReporter } from 'error-explorer-react-reporter';

const minimalReporter = createMinimalErrorReporter();
```

## Best Practices

1. **Enable only in production** or staging environments
2. **Set user context** when available for better error grouping
3. **Use breadcrumbs strategically** to track important user journeys
4. **Don't report errors in development** unless needed for testing
5. **Provide meaningful error context** with additional data
6. **Use Error Boundaries** to catch React component errors
7. **Monitor queue size** in applications with poor connectivity
8. **Configure rate limits** based on your error volume expectations
9. **Clean up resources** by calling `destroy()` when unmounting
10. **Use retry configuration** appropriate for your network conditions

## License

MIT