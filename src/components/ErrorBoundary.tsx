'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo): void {
    // Send error to logging service (e.g., Sentry, LogRocket)
    // This is a placeholder - implement with your error tracking service
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch(() => {
        // Silently fail if error logging fails
      });
    } catch {
      // Silently fail
    }
  }

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg bg-red-50 p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We encountered an unexpected error. Please try again or contact support if the problem persists.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 w-full max-w-lg rounded-lg bg-red-100 p-4">
              <summary className="cursor-pointer text-sm font-medium text-red-800">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 overflow-auto text-xs text-red-700">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleRetry}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary wrapper for functional components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
): React.FC<P> {
  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithErrorBoundary;
}

/**
 * Error display component for API errors with rate limit support
 */
interface ApiErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  retryAfter?: number;
  className?: string;
}

export function ApiErrorDisplay({ error, onRetry, retryAfter, className = '' }: ApiErrorDisplayProps) {
  const [countdown, setCountdown] = React.useState(retryAfter || 0);

  React.useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      setCountdown(retryAfter);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [retryAfter]);

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{error}</p>
          {countdown > 0 && (
            <p className="mt-1 text-xs text-red-600">
              You can retry in {countdown} second{countdown !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={countdown > 0}
            className="flex-shrink-0 rounded px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Loading state with error handling
 */
interface LoadingWithErrorProps {
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  retryAfter?: number;
  children: ReactNode;
  loadingMessage?: string;
}

export function LoadingWithError({
  isLoading,
  error,
  onRetry,
  retryAfter,
  children,
  loadingMessage = 'Loading...',
}: LoadingWithErrorProps) {
  if (error) {
    return <ApiErrorDisplay error={error} onRetry={onRetry} retryAfter={retryAfter} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-2 text-sm text-gray-500">{loadingMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
