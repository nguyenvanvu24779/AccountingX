import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Keeps a render crash in one screen from blanking the whole window, and shows
 * the error text so it can be reported.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AccountingX UI crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-semibold">Màn hình này gặp lỗi</h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Bạn có thể quay lại và tiếp tục làm việc. Nếu lỗi lặp lại, hãy gửi nội dung bên dưới cho
          bộ phận hỗ trợ.
        </p>
        <pre className="max-h-48 max-w-2xl overflow-auto rounded border bg-muted p-3 text-left text-xs">
          {String(error.stack || error.message)}
        </pre>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() => this.setState({ error: null })}
        >
          Quay lại
        </button>
      </div>
    );
  }
}
