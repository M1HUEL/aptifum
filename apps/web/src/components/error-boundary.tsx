import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import i18n from '../i18n';
import { Button } from './ui/button';

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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <TriangleAlert className="size-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="m-0 text-3xl font-bold text-text">{i18n.t('errors.somethingWentWrong')}</h1>
          <p className="m-0 max-w-[420px] text-sm text-muted">{i18n.t('errors.somethingWentWrongDescription')}</p>
          <Button onClick={() => this.setState({ error: null })}>{i18n.t('errors.tryAgain')}</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
