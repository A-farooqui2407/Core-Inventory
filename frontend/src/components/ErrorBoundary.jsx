import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" role="alert">
          <div className="error-boundary">
            <h1>Something went wrong</h1>
            <p className="muted">The app encountered an error. Try refreshing the page.</p>
            {this.state.error && (
              <pre className="error-boundary-details">{this.state.error.message}</pre>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
