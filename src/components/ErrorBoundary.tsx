import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
    (window as any).__UQ_LAST_ERROR__ = {
      type: "boundary",
      message: error.message,
      stack: error.stack,
    };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          padding: 16,
          borderRadius: 12,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          position: "fixed",
          inset: 0,
          zIndex: 999998,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p>Une erreur est survenue. Veuillez réessayer.</p>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            background: "white",
            borderRadius: 999,
            padding: "8px 20px",
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Fermer
        </button>
      </div>
    );
  }
}
