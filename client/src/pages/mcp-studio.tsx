import { ArrowLeft, Database } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { McpStudioPanel } from "@/components/mcp/mcp-studio-panel";

export default function McpStudioPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="mcp-studio-page">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-settings">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              MCP Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure MCP servers, inspect traffic, and study request/response structure.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <McpStudioPanel />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
