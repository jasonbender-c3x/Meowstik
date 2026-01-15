/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           APP.TSX - ROOT APPLICATION                          ║
 * ║                                                                               ║
 * ║  This is the main application component that serves as the entry point       ║
 * ║  for the React application. It sets up:                                       ║
 * ║                                                                               ║
 * ║    1. React Query Provider - For server state management & data fetching     ║
 * ║    2. Tooltip Provider - For accessible tooltips throughout the app          ║
 * ║    3. Toaster - For toast notifications/alerts                               ║
 * ║    4. Router - Client-side routing using Wouter                              ║
 * ║                                                                               ║
 * ║  Architecture:                                                                ║
 * ║  ┌─────────────────────────────────────────────────────────────────┐         ║
 * ║  │                    QueryClientProvider                          │         ║
 * ║  │  ┌───────────────────────────────────────────────────────────┐  │         ║
 * ║  │  │                   TooltipProvider                         │  │         ║
 * ║  │  │  ┌─────────────────────────────────────────────────────┐  │  │         ║
 * ║  │  │  │  Toaster (notifications)                            │  │  │         ║
 * ║  │  │  │  Router (page components)                           │  │  │         ║
 * ║  │  │  └─────────────────────────────────────────────────────┘  │  │         ║
 * ║  │  └───────────────────────────────────────────────────────────┘  │         ║
 * ║  └─────────────────────────────────────────────────────────────────┘         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * Wouter - Lightweight routing library (~1.5KB)
 * - Switch: Renders only the first matching Route
 * - Route: Maps URL paths to components
 * @see https://github.com/molefrog/wouter
 */
import { Switch, Route } from "wouter";

/**
 * TanStack Query (React Query) client instance
 * Pre-configured with default options for caching, retries, and stale time
 * @see ./lib/queryClient.ts for configuration
 */
import { queryClient } from "./lib/queryClient";

/**
 * QueryClientProvider - Makes React Query client available to all components
 * Provides hooks like useQuery, useMutation throughout the component tree
 */
import { QueryClientProvider } from "@tanstack/react-query";

/**
 * Toaster - Toast notification container component
 * Displays success, error, and info messages to users
 * @see https://ui.shadcn.com/docs/components/toast
 */
import { Toaster } from "@/components/ui/toaster";

/**
 * TooltipProvider - Context provider for accessible tooltips
 * Required wrapper for any components using Tooltip
 * @see https://ui.shadcn.com/docs/components/tooltip
 */
import { TooltipProvider } from "@/components/ui/tooltip";

// ============================================================================
// PAGE IMPORTS
// ============================================================================

/**
 * Page Components - Each represents a distinct view/route in the application
 * 
 * NotFound: 404 fallback page for unmatched routes
 * Home: Main chat interface with AI conversation
 * EditorPage: HTML/CSS/JS code editor with Monaco
 * PreviewPage: Live preview of editor content
 * GoogleServicesPage: Google Workspace integrations dashboard
 */
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import EditorPage from "@/pages/editor";
import PreviewPage from "@/pages/preview";
import GoogleServicesPage from "@/pages/google-services";
import HelpPage from "@/pages/help";
import MusicGenerationPage from "@/pages/music-generation";
import ExpressiveSpeechPage from "@/pages/expressive-speech";
import ImageGenerationPage from "@/pages/image-generation";
import TerminalPage from "@/pages/terminal";
import DebugPage from "@/pages/debug";
import SettingsPage from "@/pages/settings";
import PythonSandboxPage from "@/pages/python-sandbox";
import WebSearchPage from "@/pages/web-search";
import KnowledgeIngestionPage from "@/pages/knowledge-ingestion";
import MarkdownPlaygroundPage from "@/pages/markdown-playground";
import EvolutionPage from "@/pages/evolution";
import TaskQueuePage from "@/pages/task-queue";
import SchedulesPage from "@/pages/schedules";
import BrowserPage from "@/pages/browser";
import DatabaseExplorerPage from "@/pages/database-explorer";
import LivePage from "@/pages/live";
import WatchPage from "@/pages/watch";
import GlassesPage from "@/pages/glasses";
import CollaboratePage from "@/pages/collaborate";
import ProposalDesktopCollaborationPage from "@/pages/proposal-desktop-collaboration";
import WorkspacePage from "@/pages/workspace";
import VisionPage from "@/pages/vision";
import DocsPage from "@/pages/docs";
import AgentSettingsPage from "@/pages/agent-settings";
import LandingPage from "@/pages/landing";
import InstallPage from "@/pages/install";
import RagDebugPage from "@/pages/rag-debug";
import LoginPage from "@/pages/login";

import { TTSProvider } from "@/contexts/tts-context";
import { ProtectedRoute } from "@/components/protected-route";

// ============================================================================
// ROUTER COMPONENT
// ============================================================================

/**
 * Router Component
 * 
 * Defines the application's route structure using Wouter's declarative routing.
 * 
 * Route Hierarchy:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │  Path          │  Component            │  Description                      │
 * ├────────────────┼───────────────────────┼───────────────────────────────────┤
 * │  /             │  Home                 │  Main AI chat interface           │
 * │  /editor       │  EditorPage           │  Code editor (HTML/CSS/JS)        │
 * │  /preview      │  PreviewPage          │  Live preview of editor code      │
 * │  /google       │  GoogleServicesPage   │  Google Workspace dashboard       │
 * │  *             │  NotFound             │  404 fallback for unmatched URLs  │
 * └────────────────────────────────────────────────────────────────────────────┘
 * 
 * How Wouter Switch Works:
 * - Evaluates routes top-to-bottom
 * - Renders ONLY the first matching route
 * - Last Route without path acts as fallback (404)
 * 
 * @returns {JSX.Element} The rendered route based on current URL
 * 
 * @example
 * // URL: "/" renders Home component
 * // URL: "/editor" renders EditorPage component
 * // URL: "/unknown" renders NotFound component
 */
function Router() {
  return (
    <Switch>
      {/* Public Routes - No authentication required */}
      <Route path="/login" component={LoginPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/install" component={InstallPage} />
      
      {/* Protected Routes - Authentication required */}
      <Route path="/">
        {() => <ProtectedRoute><Home /></ProtectedRoute>}
      </Route>
      
      <Route path="/editor">
        {() => <ProtectedRoute><EditorPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/preview">
        {() => <ProtectedRoute><PreviewPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/google">
        {() => <ProtectedRoute><GoogleServicesPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/help">
        {() => <ProtectedRoute><HelpPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/music">
        {() => <ProtectedRoute><MusicGenerationPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/speech">
        {() => <ProtectedRoute><ExpressiveSpeechPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/image">
        {() => <ProtectedRoute><ImageGenerationPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/terminal">
        {() => <ProtectedRoute><TerminalPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/debug">
        {() => <ProtectedRoute><DebugPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/settings">
        {() => <ProtectedRoute><SettingsPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/python">
        {() => <ProtectedRoute><PythonSandboxPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/testing">{() => { window.location.href = '/browser'; return null; }}</Route>
      
      <Route path="/search">
        {() => <ProtectedRoute><WebSearchPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/knowledge">
        {() => <ProtectedRoute><KnowledgeIngestionPage /></ProtectedRoute>}
      </Route>

      <Route path="/markdown">
        {() => <ProtectedRoute><MarkdownPlaygroundPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/evolution">
        {() => <ProtectedRoute><EvolutionPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/queue">
        {() => <ProtectedRoute><TaskQueuePage /></ProtectedRoute>}
      </Route>
      
      <Route path="/schedules">
        {() => <ProtectedRoute><SchedulesPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/browser">
        {() => <ProtectedRoute><BrowserPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/database">
        {() => <ProtectedRoute><DatabaseExplorerPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/live">
        {() => <ProtectedRoute><LivePage /></ProtectedRoute>}
      </Route>
      
      <Route path="/watch">
        {() => <ProtectedRoute><WatchPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/glasses">
        {() => <ProtectedRoute><GlassesPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/collaborate">
        {() => <ProtectedRoute><CollaboratePage /></ProtectedRoute>}
      </Route>
      
      <Route path="/proposals/desktop-collaboration">
        {() => <ProtectedRoute><ProposalDesktopCollaborationPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/workspace">
        {() => <ProtectedRoute><WorkspacePage /></ProtectedRoute>}
      </Route>
      
      <Route path="/vision">
        {() => <ProtectedRoute><VisionPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/docs/:slug?">
        {(params) => <ProtectedRoute><DocsPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/agent-settings">
        {() => <ProtectedRoute><AgentSettingsPage /></ProtectedRoute>}
      </Route>
      
      <Route path="/rag-debug">
        {() => <ProtectedRoute><RagDebugPage /></ProtectedRoute>}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

// ============================================================================
// APP COMPONENT (ROOT)
// ============================================================================

/**
 * App Component - Application Root
 * 
 * The top-level component that wraps the entire application with necessary
 * providers and global components. This component:
 * 
 * 1. QueryClientProvider - Enables React Query throughout the app
 *    - Provides useQuery, useMutation hooks to all children
 *    - Manages server state cache automatically
 *    - Handles background refetching and stale data
 * 
 * 2. TooltipProvider - Enables accessible tooltips
 *    - Required by Radix UI Tooltip components
 *    - Manages tooltip positioning and timing
 * 
 * 3. Toaster - Toast notification system
 *    - Displays feedback messages to users
 *    - Supports success, error, info, and warning variants
 * 
 * 4. Router - Handles page navigation
 *    - Matches URL to appropriate page component
 *    - Provides SPA (Single Page Application) experience
 * 
 * Provider Order Matters:
 * - QueryClientProvider must be outermost to provide data to all components
 * - TooltipProvider wraps content that might use tooltips
 * - Toaster is placed before Router to overlay toast messages
 * 
 * @returns {JSX.Element} The fully configured application tree
 * 
 * @example
 * // main.tsx renders this component:
 * createRoot(document.getElementById("root")!).render(<App />);
 */
function App() {
  return (
    // QueryClientProvider: Makes React Query available throughout the app
    // The client instance is imported from ./lib/queryClient.ts
    <QueryClientProvider client={queryClient}>
      
      {/* TTSProvider: Provides text-to-speech functionality with muted state */}
      <TTSProvider>
        
        {/* TooltipProvider: Enables Radix UI tooltips for child components */}
        <TooltipProvider>
          
          {/* 
           * Toaster: Global toast notification container
           * Toast messages can be triggered from anywhere using useToast hook
           */}
          <Toaster />
          
          {/* Router: Renders the appropriate page based on current URL */}
          <Router />
          
        </TooltipProvider>
      </TTSProvider>
    </QueryClientProvider>
  );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Export App as default for use in main.tsx
 * This is the single entry point for the React application
 */
export default App;
