
/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         MAIN.TSX - APPLICATION ENTRY                          ║
 * ║                                                                               ║
 * ║  This is the JavaScript entry point for the React application.               ║
 * ║  It initializes React and mounts the App component to the DOM.               ║
 * ║                                                                               ║
 * ║  Bootstrap Flow:                                                              ║
 * ║  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐         ║
 * ║  │ index.html  │ ──► │  main.tsx   │ ──► │    App Component        │         ║
 * ║  │ <div root>  │     │ createRoot  │     │ (providers + router)    │         ║
 * ║  └─────────────┘     └─────────────┘     └─────────────────────────┘         ║
 * ║                                                                               ║
 * ║  React 18 Concurrent Features:                                                ║
 * ║  - Uses createRoot API (not legacy ReactDOM.render)                          ║
 * ║  - Enables automatic batching of state updates                               ║
 * ║  - Supports concurrent rendering for better UX                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * createRoot - React 18 API for mounting React applications
 * 
 * This is the new way to initialize React apps (replaces ReactDOM.render).
 * It creates a "root" for React to manage, enabling:
 * - Concurrent rendering features
 * - Automatic batching of updates
 * - Transitions API for smoother UX
 * 
 * @see https://react.dev/reference/react-dom/client/createRoot
 */
import { createRoot } from "react-dom/client";

/**
 * App - Root application component
 * Contains all providers (React Query, Tooltip) and the router
 * @see ./App.tsx for implementation details
 */
import App from "./App";

/**
 * Global CSS Styles
 * 
 * index.css contains:
 * - Tailwind CSS directives (@tailwind base, components, utilities)
 * - CSS custom properties for theming (--background, --foreground, etc.)
 * - Light and dark mode color definitions
 * - Global styles and resets
 * - Custom font imports (Inter, Outfit)
 */
import "./index.css";

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

/**
 * Mount the React Application to the DOM
 * 
 * How it works:
 * 1. document.getElementById("root") finds the <div id="root"> in index.html
 * 2. The "!" (non-null assertion) tells TypeScript the element exists
 * 3. createRoot() creates a React root container for that DOM element
 * 4. render(<App />) mounts the App component into that container
 * 
 * DOM Structure (from index.html):
 * <body>
 *   <div id="root">
 *     <!-- React mounts the entire application here -->
 *     <!-- App → Providers → Router → Page Components -->
 *   </div>
 * </body>
 * 
 * Important Notes:
 * - The root element must exist in index.html before this script runs
 * - React takes full control of the #root element's contents
 * - All DOM updates are managed by React's virtual DOM
 * - StrictMode is not used here to avoid double-render development logging
 * 
 * @example
 * // If you wanted to add StrictMode for development:
 * import { StrictMode } from "react";
 * createRoot(document.getElementById("root")!).render(
 *   <StrictMode>
 *     <App />
 *   </StrictMode>
 * );
 */
import { Component, type ReactNode } from "react";

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", color: "#ff6b6b", background: "#1a1a1a", minHeight: "100vh" }}>
          <h2>💥 Render Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#888" }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}



