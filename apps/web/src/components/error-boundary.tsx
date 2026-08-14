import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-center">
          <h1 className="status-code">{i18n.t('errors.somethingWentWrong')}</h1>
          <p className="muted">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            {i18n.t('errors.tryAgain')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
