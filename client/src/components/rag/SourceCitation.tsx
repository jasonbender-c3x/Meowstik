/**
 * SourceCitation Component
 * 
 * User-facing component to display source citations in chat messages
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ExternalLink, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Source {
  id: string;
  chunkId: string;
  documentId: string;
  filename?: string;
  content: string;
  score: number;
  rank: number;
}

interface SourceCitationProps {
  sources: Source[];
  onFeedback?: (chunkId: string, relevant: boolean) => void;
  className?: string;
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function ScoreBadge({ score }: { score: number }) {
  const percentage = score * 100;
  let variant: "default" | "secondary" | "destructive" = "secondary";
  
  if (percentage >= 80) variant = "default";
  else if (percentage < 50) variant = "destructive";
  
  return (
    <Badge variant={variant} className="text-xs">
      {formatScore(score)} confidence
    </Badge>
  );
}

export function SourceCitation({ sources, onFeedback, className }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [feedback, setFeedback] = useState<Record<string, boolean | null>>({});

  if (sources.length === 0) {
    return null;
  }

  const displayedSources = expanded ? sources : sources.slice(0, 3);
  const hasMore = sources.length > 3;

  const handleFeedback = (chunkId: string, relevant: boolean) => {
    setFeedback(prev => ({
      ...prev,
      [chunkId]: prev[chunkId] === relevant ? null : relevant
    }));
    onFeedback?.(chunkId, relevant);
  };

  return (
    <div className={cn("mt-3", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <FileText className="h-3 w-3" />
        <span className="font-medium">Sources ({sources.length})</span>
      </div>

      <div className="space-y-1.5">
        {displayedSources.map((source, idx) => (
          <Dialog key={source.id}>
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
              <Badge variant="outline" className="text-xs shrink-0">
                [{idx + 1}]
              </Badge>
              
              <DialogTrigger asChild>
                <button className="flex-1 text-left text-xs truncate hover:underline">
                  {source.filename || source.documentId}
                </button>
              </DialogTrigger>
              
              <ScoreBadge score={source.score} />
              
              {onFeedback && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      feedback[source.chunkId] === true && "text-green-600"
                    )}
                    onClick={() => handleFeedback(source.chunkId, true)}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      feedback[source.chunkId] === false && "text-red-600"
                    )}
                    onClick={() => handleFeedback(source.chunkId, false)}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {source.filename || source.documentId}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Rank #{source.rank}</Badge>
                  <ScoreBadge score={source.score} />
                </div>
                
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {source.content}
                  </div>
                </ScrollArea>
                
                {onFeedback && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      Was this source helpful?
                    </span>
                    <Button
                      variant={feedback[source.chunkId] === true ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleFeedback(source.chunkId, true)}
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Yes
                    </Button>
                    <Button
                      variant={feedback[source.chunkId] === false ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => handleFeedback(source.chunkId, false)}
                    >
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      No
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show All ({sources.length - 3} more)
            </>
          )}
        </Button>
      )}
    </div>
  );
}
