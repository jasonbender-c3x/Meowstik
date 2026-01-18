import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, Globe, ExternalLink, Loader2, FileText, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

interface SearchState {
  status: "idle" | "searching" | "complete" | "error";
  results: SearchResult[];
  scrapedContent: ScrapeResult[];
  error: string | null;
}

export default function WebSearchPage() {
  const [query, setQuery] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
    results: [],
    scrapedContent: [],
    error: null
  });
  const [selectedResult, setSelectedResult] = useState<ScrapeResult | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setSearchState({
      status: "searching",
      results: [],
      scrapedContent: [],
      error: null
    });
    setSelectedResult(null);

    try {
      const response = await fetch("/api/web/search-and-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          maxResults: 10,
          scrapeFirst: 3
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Search failed");
      }

      setSearchState({
        status: "complete",
        results: data.searchResults || [],
        scrapedContent: data.scrapedContent || [],
        error: null
      });

      if (data.scrapedContent && data.scrapedContent.length > 0 && data.scrapedContent[0].success) {
        setSelectedResult(data.scrapedContent[0]);
      }
    } catch (error) {
      setSearchState({
        status: "error",
        results: [],
        scrapedContent: [],
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  }, [query]);

  const handleScrapeUrl = useCallback(async () => {
    if (!scrapeUrl.trim()) return;

    setScrapingUrl(scrapeUrl);

    try {
      const response = await fetch("/api/web/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim() })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to scrape URL");
      }

      setSelectedResult(data.data);
    } catch (error) {
      setSelectedResult({
        url: scrapeUrl,
        title: "",
        content: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setScrapingUrl(null);
    }
  }, [scrapeUrl]);

  const handleResultClick = useCallback(async (result: SearchResult) => {
    const existingScrape = searchState.scrapedContent.find(s => s.url === result.url);
    if (existingScrape) {
      setSelectedResult(existingScrape);
      return;
    }

    setScrapingUrl(result.url);

    try {
      const response = await fetch("/api/web/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url })
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setSelectedResult(data.data);
        setSearchState(prev => ({
          ...prev,
          scrapedContent: [...prev.scrapedContent, data.data]
        }));
      } else {
        setSelectedResult({
          url: result.url,
          title: result.title,
          content: "",
          success: false,
          error: data.error || "Failed to scrape content"
        });
      }
    } catch (error) {
      setSelectedResult({
        url: result.url,
        title: result.title,
        content: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setScrapingUrl(null);
    }
  }, [searchState.scrapedContent]);

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-web-search">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Web Search
            </h1>
            <p className="text-sm text-muted-foreground">
              Search the web and extract content from results
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <Tabs defaultValue="search" className="space-y-4">
              <div className="flex gap-2 px-4 border-b">
                <TabsList className="h-12">
                  <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search">
                    <Search className="h-4 w-4" />
                    Search Web
                  </TabsTrigger>
                  <TabsTrigger value="scrape" className="flex items-center gap-2" data-testid="tab-scrape">
                    <FileText className="h-4 w-4" />
                    Scrape URL
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="px-4">
                <TabsContent value="search" className="mt-0 space-y-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="font-semibold flex items-center gap-2 mb-2">
                      <Search className="h-5 w-5 text-primary" />
                      Web Search
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Search the web and extract content from results
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter your search query..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, handleSearch)}
                        className="flex-1"
                        data-testid="input-search-query"
                      />
                      <Button 
                        onClick={handleSearch}
                        disabled={!query.trim() || searchState.status === "searching"}
                        data-testid="button-search"
                        aria-label="Search the web"
                      >
                        {searchState.status === "searching" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        <span className="ml-2">Search</span>
                      </Button>
                    </div>
                  </div>

                  {searchState.status === "error" && (
                    <div className="border border-destructive rounded-lg bg-destructive/5 p-4">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span data-testid="text-search-error">{searchState.error}</span>
                      </div>
                    </div>
                  )}

                  {searchState.results.length > 0 && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="border border-border rounded-lg bg-muted/20 p-6">
                        <h3 className="font-semibold mb-2">Search Results</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {searchState.results.length} results found
                        </p>
                        <div className="space-y-3 max-h-96">
                          {searchState.results.map((result, index) => (
                            <div
                              key={index}
                              className={cn(
                                "p-3 rounded-lg border border-border cursor-pointer transition-colors hover:bg-muted/50",
                                selectedResult?.url === result.url && "border-primary bg-primary/5",
                                scrapingUrl === result.url && "opacity-50"
                              )}
                              onClick={() => handleResultClick(result)}
                              data-testid={`card-result-${index}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-sm truncate" data-testid={`text-result-title-${index}`}>
                                    {result.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {result.url}
                                  </p>
                                  {result.snippet && (
                                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                      {result.snippet}
                                    </p>
                                  )}
                                </div>
                                {scrapingUrl === result.url ? (
                                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                ) : (
                                  <a 
                                    href={result.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border border-border rounded-lg bg-muted/20 p-6">
                        <h3 className="font-semibold mb-2">Extracted Content</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedResult ? selectedResult.title || "Content preview" : "Click a result to view content"}
                        </p>
                        {selectedResult ? (
                          selectedResult.success ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {selectedResult.content && selectedResult.content.length > 20000 && (
                                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mb-2">
                                  Content truncated to first 20,000 characters for display
                                </p>
                              )}
                              <pre className="whitespace-pre-wrap text-sm font-sans max-h-96 overflow-y-auto" data-testid="text-scraped-content">
                                {selectedResult.content ? selectedResult.content.slice(0, 20000) : "No content extracted"}
                              </pre>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                              <AlertCircle className="h-8 w-8 mb-2" />
                              <p className="text-sm" data-testid="text-scrape-error">{selectedResult.error || "Failed to extract content"}</p>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2" />
                            <p className="text-sm">Select a search result to view its content</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="scrape" className="mt-0 space-y-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="font-semibold flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Scrape URL
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Extract content from a specific webpage
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter URL to scrape (e.g., https://example.com)"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, handleScrapeUrl)}
                        className="flex-1"
                        data-testid="input-scrape-url"
                      />
                      <Button 
                        onClick={handleScrapeUrl}
                        disabled={!scrapeUrl.trim() || scrapingUrl !== null}
                        data-testid="button-scrape"
                        aria-label="Extract content from URL"
                      >
                        {scrapingUrl ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span className="ml-2">Extract</span>
                      </Button>
                    </div>
                  </div>

                  {selectedResult && (
                    <div className="border border-border rounded-lg bg-muted/20 p-6">
                      <h3 className="font-semibold mb-1">{selectedResult.title || "Extracted Content"}</h3>
                      <p className="text-sm text-muted-foreground truncate mb-4">
                        {selectedResult.url}
                      </p>
                      {selectedResult.success ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {selectedResult.content && selectedResult.content.length > 20000 && (
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mb-2">
                              Content truncated to first 20,000 characters for display
                            </p>
                          )}
                          <pre className="whitespace-pre-wrap text-sm font-sans max-h-96 overflow-y-auto" data-testid="text-url-content">
                            {selectedResult.content ? selectedResult.content.slice(0, 20000) : "No content extracted"}
                          </pre>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
                          <p className="text-sm" data-testid="text-url-error">{selectedResult.error || "Failed to extract content"}</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
