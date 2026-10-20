import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleResetStorage = () => {
    try {
      localStorage.removeItem('estate_social_autopost_history_v1');
    } catch {}
    if (this.props.onReset) {
      this.props.onReset();
    }
    window.location.reload();
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            maxWidth: '640px',
            margin: '4rem auto',
            padding: '2rem',
            backgroundColor: 'var(--bg-secondary, #1E293B)',
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            textAlign: 'center',
            color: 'var(--text-primary, #FFFFFF)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              margin: '0 auto 1.25rem',
            }}
          >
            <FiAlertTriangle />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#EF4444' }}>
            {this.props.fallbackTitle || 'Something went wrong rendering this page'}
          </h2>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted, #94A3B8)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            An unexpected error occurred while loading this view. You can reload the page or reset the cached records.
          </p>

          {this.state.error && (
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#F87171',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FiRefreshCw />
              <span>Reload Page</span>
            </button>

            <button
              type="button"
              onClick={this.handleResetStorage}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FiTrash2 />
              <span>Clean Cached Data & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
