import React, { Component, ErrorInfo, ReactNode } from 'react';
import { debugLogger } from '../utils/debug-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLogger.error('ERROR_BOUNDARY', 'Component crashed', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    debugLogger.info('ERROR_BOUNDARY', 'User clicked reload after error');
    window.location.reload();
  };

  handleClearAndReload = () => {
    debugLogger.info('ERROR_BOUNDARY', 'User clearing logs and reloading');
    debugLogger.clearLogs();
    localStorage.clear();
    window.location.reload();
  };

  handleExportLogs = () => {
    const logs = debugLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foxy-debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 border-2 border-red-500 rounded-lg p-6 max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              🦊 Oops! Something went wrong
            </h1>
            
            <p className="text-gray-300 mb-4">
              The app encountered an error. Debug logs have been saved.
            </p>

            <details className="mb-4">
              <summary className="text-yellow-400 cursor-pointer mb-2">
                📋 Error Details
              </summary>
              <div className="bg-gray-900 p-4 rounded text-xs text-red-300 overflow-auto max-h-60">
                <p className="font-bold mb-2">{this.state.error?.message}</p>
                <pre className="whitespace-pre-wrap text-gray-400">
                  {this.state.error?.stack}
                </pre>
                {this.state.errorInfo && (
                  <pre className="whitespace-pre-wrap text-gray-500 mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={this.handleReload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                🔄 Reload App
              </button>
              
              <button
                onClick={this.handleExportLogs}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
              >
                📥 Export Logs
              </button>
              
              <button
                onClick={this.handleClearAndReload}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                🗑️ Clear Data & Reload
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-400">
              <p>💡 Tip: Export the logs and share them to help debug the issue.</p>
              <p className="mt-1">Device: {debugLogger.isDesktop() ? '🖥️ Desktop' : '📱 Mobile'}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
