import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0a0502]">
          <h2 className="font-serif text-3xl mb-4 text-red-500">System Malfunction</h2>
          <p className="text-stone-400 max-w-md mb-8 font-light">
            The interrogation was interrupted by an unexpected cognitive error. 
            The neural engine has been safely throttled.
          </p>
          <pre className="text-[10px] font-mono text-stone-600 bg-black/50 p-4 rounded overflow-auto max-w-full">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-8 py-2 border border-stone-800 rounded-full text-[10px] uppercase tracking-widest hover:border-red-900 transition-colors"
          >
            Reboot Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
