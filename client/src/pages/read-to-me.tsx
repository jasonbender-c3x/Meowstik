import { useCallback, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Globe,
  Loader2,
  Volume2,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useTTS } from "@/contexts/tts-context";

interface ReadToMeResult {
  url: string;
  title: string;
  text: string;
  excerpt: string;
  wordCount: number;
  summary: string;
  keyPoints: string[];
  narrationText: string;
  estimatedMinutes: number;
}

export default function ReadToMePage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReadToMeResult | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const { isSpeaking, stopSpeaking, unlockAudio, playAudioBase64 } = useTTS();

  const summarizePage = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return;
    }

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const normalizedUrl = trimmedUrl.includes("://") ? trimmedUrl : `https://${trimmedUrl}`;
      const response = await fetch("/api/read-to-me/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to summarize the page");
      }

      setResult(data);
      setStatus("ready");
      setUrl(data.url);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [url]);

  const readSummary = useCallback(async () => {
    if (!result) {
      return;
    }

    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    setIsGeneratingAudio(true);
    setError(null);

    try {
      await unlockAudio();

      const response = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: result.narrationText,
          speakers: [{ voice: "Kore" }],
          model: "flash",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || "Failed to generate speech");
      }

      const played = await playAudioBase64(data.audioBase64, data.mimeType);
      if (!played) {
        throw new Error("Audio playback is still locked. Click the button again after interacting with the page.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown audio error");
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [isSpeaking, playAudioBase64, result, stopSpeaking, unlockAudio]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        summarizePage();
      }
    },
    [summarizePage]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-read-to-me">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Read to Me
            </h1>
            <p className="text-sm text-muted-foreground">
              Fetch an article, strip the chrome, summarize it, and read it aloud.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Summarize a page
                </CardTitle>
                <CardDescription>
                  Start with a public article or blog post. The first slice is tuned for static pages with readable text.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="https://example.com/article"
                    className="flex-1"
                    data-testid="input-read-to-me-url"
                  />
                  <Button
                    onClick={summarizePage}
                    disabled={!url.trim() || status === "loading"}
                    data-testid="button-read-to-me-summarize"
                  >
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                    <span className="ml-2">Summarize</span>
                  </Button>
                </div>

                {error ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="text-read-to-me-error">
                    {error}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {result ? (
              <>
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-2xl leading-tight">{result.title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-3">
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            {result.url}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <span>{result.wordCount.toLocaleString()} words extracted</span>
                          <span>{result.estimatedMinutes} min listen</span>
                        </CardDescription>
                      </div>
                      <Button
                        onClick={readSummary}
                        disabled={isGeneratingAudio}
                        data-testid="button-read-to-me-audio"
                      >
                        {isGeneratingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSpeaking ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                        <span className="ml-2">
                          {isGeneratingAudio ? "Preparing audio" : isSpeaking ? "Stop audio" : "Read summary aloud"}
                        </span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Summary</h2>
                      <Textarea
                        readOnly
                        value={result.summary}
                        className="min-h-[180px] resize-none leading-6"
                        data-testid="textarea-read-to-me-summary"
                      />
                    </div>

                    {result.keyPoints.length > 0 ? (
                      <div className="space-y-2">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Key points</h2>
                        <div className="grid gap-3 md:grid-cols-3">
                          {result.keyPoints.map((point, index) => (
                            <div
                              key={`${point}-${index}`}
                              className="rounded-lg border bg-muted/20 px-4 py-3 text-sm leading-6"
                            >
                              {point}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Extract preview</h2>
                      <Textarea
                        readOnly
                        value={result.excerpt}
                        className="min-h-[220px] resize-none text-sm leading-6"
                        data-testid="textarea-read-to-me-excerpt"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
