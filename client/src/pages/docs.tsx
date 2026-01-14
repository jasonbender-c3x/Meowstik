/**
 * Documentation Page - Renders markdown docs as beautiful web pages
 */

import { useState, useEffect, useMemo } from "react";
import { useRoute, Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  FileText, 
  FolderOpen, 
  Home, 
  ExternalLink, 
  Search, 
  Download, 
  MonitorSmartphone, 
  Globe,
  Sparkles,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Documentation structure
const docCategories = [
  {
    name: "Agent (Ragent)",
    icon: "🤖",
    docs: [
      { slug: "ragent-index", title: "Ragent Index", path: "ragent/INDEX.md" },
      { slug: "agent-configuration", title: "Agent Configuration", path: "ragent/agent-configuration.md" },
      { slug: "job-orchestration", title: "Job Orchestration", path: "ragent/job-orchestration.md" },
      { slug: "scheduler", title: "Scheduler & Workflows", path: "ragent/scheduler.md" },
      { slug: "collaborative-editing", title: "Collaborative Editing", path: "ragent/collaborative-editing.md" },
      { slug: "browser-computer-use", title: "Browser & Computer Use", path: "ragent/browser-computer-use.md" },
      { slug: "docs-site", title: "Docs Site Guide", path: "ragent/docs-site.md" },
    ]
  },
  {
    name: "Installation",
    icon: "📦",
    docs: [
      { slug: "install-browser-extension", title: "Browser Extension", path: "ragent/install-browser-extension.md" },
      { slug: "install-desktop-agent", title: "Desktop Agent", path: "ragent/install-desktop-agent.md" },
    ]
  },
  {
    name: "Roadmap",
    icon: "🗺️",
    docs: [
      { slug: "MASTER-ROADMAP", title: "Master Roadmap", path: "v2-roadmap/MASTER-ROADMAP.md" },
      { slug: "TODO-FEATURES", title: "TODO Features", path: "v2-roadmap/TODO-FEATURES.md" },
      { slug: "VISIONS_OF_THE_FUTURE", title: "Visions of the Future", path: "v2-roadmap/VISIONS_OF_THE_FUTURE.md" },
    ]
  },
  {
    name: "Architecture",
    icon: "🏗️",
    docs: [
      { slug: "SYSTEM_OVERVIEW", title: "System Overview", path: "SYSTEM_OVERVIEW.md" },
      { slug: "RAG_PIPELINE", title: "RAG Pipeline", path: "RAG_PIPELINE.md" },
      { slug: "KNOWLEDGE_INGESTION_ARCHITECTURE", title: "Knowledge Ingestion", path: "v2-roadmap/KNOWLEDGE_INGESTION_ARCHITECTURE.md" },
      { slug: "KERNEL_IMPLEMENTATION_PROPOSAL", title: "Kernel Implementation", path: "v2-roadmap/KERNEL_IMPLEMENTATION_PROPOSAL.md" },
    ]
  },
  {
    name: "Vision",
    icon: "✨",
    docs: [
      { slug: "COMPREHENSIVE_VISION", title: "Comprehensive Vision", path: "idea-extraction/COMPREHENSIVE_VISION.md" },
      { slug: "VISION_BLOG_POST", title: "Vision Blog Post", path: "idea-extraction/VISION_BLOG_POST.md" },
    ]
  },
  {
    name: "Technical",
    icon: "⚙️",
    docs: [
      { slug: "FEATURES", title: "Features", path: "FEATURES.md" },
      { slug: "database-schemas", title: "Database Schemas", path: "01-database-schemas.md" },
      { slug: "ui-architecture", title: "UI Architecture", path: "02-ui-architecture.md" },
      { slug: "prompt-lifecycle", title: "Prompt Lifecycle", path: "03-prompt-lifecycle.md" },
      { slug: "llm-output-processing-pipeline", title: "LLM Output Processing", path: "llm-output-processing-pipeline.md" },
    ]
  },
  {
    name: "Reference",
    icon: "📚",
    docs: [
      { slug: "PROTOCOL_ANALYSIS", title: "Protocol Analysis", path: "PROTOCOL_ANALYSIS.md" },
      { slug: "MARKDOWN_EMBEDDING_GUIDE", title: "Markdown Embedding Guide", path: "MARKDOWN_EMBEDDING_GUIDE.md" },
      { slug: "LIVE_MODE_EVALUATION", title: "Live Mode Evaluation", path: "LIVE_MODE_EVALUATION.md" },
    ]
  },
  {
    name: "Guides",
    icon: "📖",
    docs: [
      { slug: "EXTERNAL-DOCS-HOSTING", title: "External Docs Hosting", path: "EXTERNAL-DOCS-HOSTING.md" },
      { slug: "SELF_DOCUMENTATION_SYSTEM", title: "Self-Documentation System", path: "SELF_DOCUMENTATION_SYSTEM.md" },
    ]
  }
];

// Flatten for lookup
const allDocs = docCategories.flatMap(cat => cat.docs);

export default function DocsPage() {
  const [, params] = useRoute("/docs/:slug");
  const slug = params?.slug;
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  // AI-generated docs state
  const [generatedDocs, setGeneratedDocs] = useState<any[]>([]);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Form state for documentation generation
  const [docType, setDocType] = useState<string>("tutorial");
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("");
  const [docContext, setDocContext] = useState("");

  const currentDoc = slug ? allDocs.find(d => d.slug === slug) : null;
  const currentGeneratedDoc = slug ? generatedDocs.find(d => d.slug === slug) : null;

  // Load generated documentation
  useEffect(() => {
    setLoadingGenerated(true);
    fetch("/api/documentation/generated?published=true")
      .then(res => res.json())
      .then(docs => {
        setGeneratedDocs(docs);
        setLoadingGenerated(false);
      })
      .catch(err => {
        console.error("Failed to load generated docs:", err);
        setLoadingGenerated(false);
      });
  }, []);

  // Handle documentation generation
  const handleGenerateDoc = async () => {
    if (!docTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the documentation",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/documentation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: docType,
          title: docTitle,
          category: docCategory || undefined,
          context: docContext || undefined,
          targetAudience: "developer",
          saveToDb: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate documentation");
      }

      const result = await response.json();
      
      toast({
        title: "Success!",
        description: "Documentation generated successfully. It will appear after publishing.",
      });
      
      // Reset form and close dialog
      setDocTitle("");
      setDocCategory("");
      setDocContext("");
      setShowGenerateDialog(false);
      
      // Reload generated docs
      const docsRes = await fetch("/api/documentation/generated?published=true");
      const docs = await docsRes.json();
      setGeneratedDocs(docs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate documentation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Filter docs based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return docCategories;
    const query = searchQuery.toLowerCase();
    return docCategories
      .map(cat => ({
        ...cat,
        docs: cat.docs.filter(doc => 
          doc.title.toLowerCase().includes(query) ||
          doc.slug.toLowerCase().includes(query)
        )
      }))
      .filter(cat => cat.docs.length > 0);
  }, [searchQuery]);

  // Filter generated docs based on search query
  const filteredGeneratedDocs = useMemo(() => {
    if (!searchQuery.trim()) return generatedDocs;
    const query = searchQuery.toLowerCase();
    return generatedDocs.filter(doc =>
      doc.title.toLowerCase().includes(query) ||
      doc.slug.toLowerCase().includes(query)
    );
  }, [searchQuery, generatedDocs]);

  useEffect(() => {
    if (currentDoc) {
      setLoading(true);
      setError(null);
      fetch(`/api/documentation/${encodeURIComponent(currentDoc.path)}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to load document");
          return res.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else if (currentGeneratedDoc) {
      setLoading(true);
      setError(null);
      setContent(currentGeneratedDoc.content);
      setLoading(false);
    }
  }, [currentDoc, currentGeneratedDoc]);

  return (
    <div className="flex h-screen bg-background" data-testid="docs-page">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-border bg-card overflow-hidden`}>
        <ScrollArea className="h-full">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-home">
                  <Home className="h-4 w-4" />
                  Meowstik
                </Button>
              </Link>
            </div>
            
            <h2 className="text-lg font-semibold mb-3">Documentation</h2>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-docs-search"
              />
            </div>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Link href="/install">
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs" data-testid="link-install">
                  <Download className="h-3 w-3" />
                  Install
                </Button>
              </Link>
              <Link href="/collaborate">
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs" data-testid="link-collaborate">
                  <MonitorSmartphone className="h-3 w-3" />
                  Collab
                </Button>
              </Link>
            </div>
            
            {/* Generate Documentation Button */}
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="w-full gap-2 mb-4" data-testid="btn-generate-docs">
                  <Sparkles className="h-4 w-4" />
                  Generate Documentation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Generate AI Documentation</DialogTitle>
                  <DialogDescription>
                    Use AI to automatically generate comprehensive documentation for your project.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="doc-type">Type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger id="doc-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api-reference">API Reference</SelectItem>
                        <SelectItem value="tutorial">Tutorial</SelectItem>
                        <SelectItem value="guide">Guide</SelectItem>
                        <SelectItem value="overview">Overview</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="doc-title">Title</Label>
                    <Input
                      id="doc-title"
                      placeholder="e.g., Getting Started with APIs"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="doc-category">Category (optional)</Label>
                    <Input
                      id="doc-category"
                      placeholder="e.g., API, Database, UI"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="doc-context">Additional Context (optional)</Label>
                    <Textarea
                      id="doc-context"
                      placeholder="Provide any additional information or requirements..."
                      value={docContext}
                      onChange={(e) => setDocContext(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowGenerateDialog(false)}
                    disabled={generating}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateDoc} disabled={generating}>
                    {generating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Categories */}
            {filteredCategories.length === 0 && filteredGeneratedDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="search-empty-state">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <>
                {/* AI-Generated Documentation */}
                {filteredGeneratedDocs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <span>🤖</span>
                      AI-Generated
                    </h3>
                    <ul className="space-y-1">
                      {filteredGeneratedDocs.map((doc: any) => (
                        <li key={doc.slug}>
                          <Link href={`/docs/${doc.slug}`}>
                            <button
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                                slug === doc.slug
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-muted'
                              }`}
                              data-testid={`doc-link-${doc.slug}`}
                            >
                              {doc.title}
                            </button>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {filteredCategories.map((category) => (
                  <div key={category.name} className="mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <span>{category.icon}</span>
                    {category.name}
                  </h3>
                  <ul className="space-y-1">
                    {category.docs.map((doc) => (
                      <li key={doc.slug}>
                        <Link href={`/docs/${doc.slug}`}>
                          <button
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                              slug === doc.slug
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                            data-testid={`doc-link-${doc.slug}`}
                          >
                            {doc.title}
                          </button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto p-8">
            {!slug ? (
              // Landing page
              <div className="text-center py-16">
                <h1 className="text-4xl font-bold mb-4">Meowstik Documentation</h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Explore the architecture, roadmap, and vision behind Meowstik.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docCategories.map((category) => (
                    <div key={category.name} className="p-6 bg-card border rounded-xl">
                      <div className="text-3xl mb-2">{category.icon}</div>
                      <h3 className="font-semibold mb-2">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {category.docs.length} documents
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <article className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
