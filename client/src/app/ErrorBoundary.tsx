import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '10px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              The application encountered an error. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <details style={{ textAlign: 'left', marginTop: '20px' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details
                </summary>
                <pre style={{ 
                  background: '#f4f4f4', 
                  padding: '10px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  overflow: 'auto',
                  maxHeight: '300px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button 
              onClick={() => window.location.reload()} 
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}