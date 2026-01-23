/**
 * ModuleErrorBoundary Component
 * Reusable error boundary for wrapping individual modules
 * Provides user-friendly error messages and retry functionality
 */
import React from 'react';
import logger from '../utils/logger';

class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging (only in development)
    logger.error('Module error caught:', {
      moduleName: this.props.moduleName || 'Unknown',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { moduleName, moduleColor } = this.props;
      const accentColor = moduleColor || '#059669';

      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={{ ...styles.icon, backgroundColor: `${accentColor}15` }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke={accentColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={styles.title}>
              {moduleName ? `${moduleName}: ` : ''}
              Что-то пошло не так
            </h2>

            <p style={styles.message}>
              Произошла ошибка при загрузке модуля.
              Пожалуйста, попробуйте снова или обновите страницу.
            </p>

            <div style={styles.buttonGroup}>
              <button
                onClick={this.handleRetry}
                style={{
                  ...styles.retryButton,
                  backgroundColor: accentColor
                }}
              >
                Попробовать снова
              </button>

              <button
                onClick={() => window.location.reload()}
                style={styles.reloadButton}
              >
                Обновить страницу
              </button>
            </div>

            {/* Show error details in development mode only */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Детали ошибки (для разработчиков)</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    minHeight: '300px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    margin: '20px'
  },
  content: {
    textAlign: 'center',
    maxWidth: '400px'
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    marginBottom: '20px'
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px'
  },
  message: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '24px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  retryButton: {
    padding: '12px 24px',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'opacity 0.2s'
  },
  reloadButton: {
    padding: '12px 24px',
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  details: {
    marginTop: '24px',
    textAlign: 'left',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    padding: '12px'
  },
  summary: {
    cursor: 'pointer',
    fontSize: '12px',
    color: '#991b1b',
    fontWeight: '500'
  },
  errorText: {
    marginTop: '12px',
    fontSize: '11px',
    color: '#991b1b',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
};

export default ModuleErrorBoundary;
