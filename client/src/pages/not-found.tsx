/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NOT-FOUND.TSX - 404 ERROR PAGE                         ║
 * ║                                                                               ║
 * ║  A user-friendly 404 error page displayed when navigating to a route          ║
 * ║  that doesn't exist in the application. This serves as a fallback             ║
 * ║  route in the Wouter router configuration.                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="not-found-page">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              404 Not Found
            </h1>
            <p className="text-sm text-muted-foreground">
              The page you're looking for doesn't exist
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto opacity-50 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground mb-6">
              Did you forget to add the page to the router?
            </p>
          </div>

          <div className="border border-border rounded-lg bg-muted/20 p-6 text-left mb-6">
            <p className="text-sm text-muted-foreground mb-3">
              This page doesn't exist. Check the URL or navigate back to the main application.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Verify the URL is correct</li>
              <li>• Check if the page has been renamed</li>
              <li>• Return to the home page</li>
            </ul>
          </div>

          <Link href="/">
            <Button className="w-full" data-testid="button-back-home-main">
              Go Back Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
