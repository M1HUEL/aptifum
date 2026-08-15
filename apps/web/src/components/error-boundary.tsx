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
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <h1 className="m-0 text-5xl font-bold text-primary">{i18n.t('errors.somethingWentWrong')}</h1>
          <p className="text-[12px] text-muted">{this.state.error.message}</p>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-ui border border-primary bg-primary px-[14px] py-2 text-sm font-semibold text-white select-none hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
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
