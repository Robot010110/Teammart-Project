import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Logo from "./Logo";

// ErrorBoundary.jsx — the app-wide crash net. Before this, a single
// render-time exception anywhere in the tree unmounted the whole app and
// left a blank white page: on mobile (this app's primary target) there is
// no console and no obvious way back, so the only recovery was
// force-quitting. React only supports this via a class component — there
// is deliberately no hooks equivalent, which is why this one file breaks
// the function-component convention every other component here follows.
//
// Scope note: this catches errors thrown while RENDERING. It does not
// catch failed API calls — those already reject as a real ApiError and
// are handled per-screen (see ErrorBanner.jsx and apiClient.js), which is
// the correct place for them since only the screen knows what a given
// failure means. This is strictly the last-resort backstop for the
// unexpected.
//
// Visual language matches AppShell.jsx (#050A18 midnight-navy page) and
// ErrorBanner.jsx (red-tinted surface + Retry), so a crash still looks
// like this app rather than a browser error page.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // No logging service is wired up in this project yet, so the console
    // is the only sink available — kept deliberately, because silently
    // swallowing the stack would make a production crash undiagnosable.
    console.error("Unhandled render error:", error, errorInfo);
  }

  // A full reload rather than just clearing the error state: whatever
  // rendered badly is usually a symptom of state we can't trust anymore,
  // and the saved JWT means a reload does NOT cost the user their session
  // (App.jsx restores it from GET /api/profile on mount).
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#050A18] flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-8">
          <Logo />
        </div>

        <div className="card-premium w-full max-w-sm rounded-2xl px-6 py-7 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
          <div className="glow-red mx-auto mb-4 w-12 h-12 rounded-xl grid place-items-center bg-red-500/10">
            <AlertTriangle size={22} className="text-red-400" />
          </div>

          <h1 className="font-display text-lg font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8B93A8]">
            This screen ran into an unexpected problem. Your work and your session are safe — reloading usually fixes it.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            className="glow-orange mt-6 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:scale-95 transition-all duration-150"
          >
            <RotateCcw size={16} /> Reload App
          </button>
        </div>

        {/* The message alone (never the stack) — enough for someone to
            report what happened, without dumping internals on screen. */}
        {this.state.error?.message && (
          <p className="mt-6 max-w-sm text-[11px] leading-relaxed text-[#5C6479] break-words">
            {this.state.error.message}
          </p>
        )}
      </div>
    );
  }
}
