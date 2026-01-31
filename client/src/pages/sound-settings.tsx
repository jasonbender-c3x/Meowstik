/**
 * Sound Settings Page - Configure Voice & Audio
 * 
 * Features:
 * - 6-position verbosity slider configuration
 * - Cost comparison for different settings
 * - Voice quality analysis
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, DollarSign, Gauge, Volume2, Zap, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useTTS, VerbosityMode } from "@/contexts/tts-context";

const VERBOSITY_CONFIGS = [
  {
    mode: "mute" as VerbosityMode,
    name: "Mute",
    description: "No voice output, alerts only",
    textLength: "None",
    speechDuration: "0s",
    costMultiplier: 0,
    useCase: "Silent mode, screen reading only"
  },
  {
    mode: "low" as VerbosityMode,
    name: "Low (Concise)",
    description: "Brief responses, essential info only",
    textLength: "1-2 sentences",
    speechDuration: "5-10s",
    costMultiplier: 0.3,
    useCase: "Quick updates, minimal interaction"
  },
  {
    mode: "normal" as VerbosityMode,
    name: "Normal (Verbose)",
    description: "Full responses with context",
    textLength: "3-5 sentences",
    speechDuration: "15-30s",
    costMultiplier: 1.0,
    useCase: "Balanced conversation, detailed answers"
  },
  {
    mode: "experimental" as VerbosityMode,
    name: "Experimental (Dual-Voice)",
    description: "AI discusses with itself using two voices",
    textLength: "Multiple paragraphs",
    speechDuration: "60-120s",
    costMultiplier: 3.0,
    useCase: "Deep analysis, exploring topics"
  },
];

const COST_BREAKDOWN = {
  geminiFlash: {
    name: "Gemini 2.0 Flash",
    inputCost: 0.000075, // per 1K chars
    outputCost: 0.0003,  // per 1K chars
  },
  geminiPro: {
    name: "Gemini 2.5 Pro",
    inputCost: 0.00125,  // per 1K chars
    outputCost: 0.005,   // per 1K chars
  },
  tts: {
    name: "Text-to-Speech",
    cost: 0.000016, // per char
  },
  geminiLive: {
    name: "Gemini Live Audio",
    cost: 0.0001, // per second (estimated)
  }
};

export default function SoundSettingsPage() {
  const { verbosityMode, setVerbosityMode } = useTTS();
  const [monthlyMessages, setMonthlyMessages] = useState(1000);
  const [useGeminiLive, setUseGeminiLive] = useState(false);

  const calculateCosts = () => {
    const config = VERBOSITY_CONFIGS.find(c => c.mode === verbosityMode) || VERBOSITY_CONFIGS[2];
    
    // Estimate characters per message based on verbosity
    const avgCharsPerMessage = {
      mute: 0,
      low: 150,
      normal: 400,
      experimental: 1200,
    }[config.mode] || 400;

    // LLM costs
    const inputChars = monthlyMessages * 200; // avg user input
    const outputChars = monthlyMessages * avgCharsPerMessage;
    
    const geminiFlashCost = (
      (inputChars / 1000) * COST_BREAKDOWN.geminiFlash.inputCost +
      (outputChars / 1000) * COST_BREAKDOWN.geminiFlash.outputCost
    );

    const geminiProCost = (
      (inputChars / 1000) * COST_BREAKDOWN.geminiPro.inputCost +
      (outputChars / 1000) * COST_BREAKDOWN.geminiPro.outputCost
    );

    // TTS costs (if not muted)
    const ttsCost = config.mode !== "mute" 
      ? outputChars * COST_BREAKDOWN.tts.cost 
      : 0;

    // Gemini Live costs (alternative)
    const avgSecondsPerMessage = {
      mute: 0,
      low: 7.5,
      normal: 22.5,
      experimental: 90,
    }[config.mode] || 22.5;

    const geminiLiveCost = monthlyMessages * avgSecondsPerMessage * COST_BREAKDOWN.geminiLive.cost;

    return {
      geminiFlash: geminiFlashCost,
      geminiPro: geminiProCost,
      tts: ttsCost,
      geminiLive: geminiLiveCost,
      totalFlash: geminiFlashCost + ttsCost,
      totalPro: geminiProCost + ttsCost,
      totalLive: geminiLiveCost,
    };
  };

  const costs = calculateCosts();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/voice-lab">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-primary" />
              Sound Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure verbosity levels and optimize costs
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Current Verbosity */}
            <Card>
              <CardHeader>
                <CardTitle>Current Verbosity Level</CardTitle>
                <CardDescription>
                  Controls how verbose Meowstik's responses are
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-primary uppercase">
                      {verbosityMode}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {VERBOSITY_CONFIGS.find(c => c.mode === verbosityMode)?.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {VERBOSITY_CONFIGS.find(c => c.mode === verbosityMode)?.costMultiplier}x Cost
                  </Badge>
                </div>

                <div className="space-y-4">
                  <Label>Adjust Verbosity Level</Label>
                  <Slider
                    value={[VERBOSITY_CONFIGS.findIndex(c => c.mode === verbosityMode) * 33.33]}
                    onValueChange={([value]) => {
                      const index = Math.round(value / 33.33);
                      const mode = VERBOSITY_CONFIGS[index]?.mode || "normal";
                      setVerbosityMode(mode);
                    }}
                    min={0}
                    max={100}
                    step={33.33}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    {VERBOSITY_CONFIGS.map(config => (
                      <span key={config.mode}>{config.name}</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verbosity Configuration Details */}
            <Card>
              <CardHeader>
                <CardTitle>Verbosity Level Details</CardTitle>
                <CardDescription>
                  What each level means for your experience
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {VERBOSITY_CONFIGS.map(config => (
                    <div
                      key={config.mode}
                      className={`p-4 border rounded-lg ${
                        config.mode === verbosityMode 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{config.name}</h3>
                        <Badge variant={config.mode === verbosityMode ? "default" : "outline"}>
                          {config.costMultiplier}x
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {config.description}
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Text Length:</span>
                          <span className="font-medium">{config.textLength}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Speech Duration:</span>
                          <span className="font-medium">{config.speechDuration}</span>
                        </div>
                        <div className="text-muted-foreground mt-2">
                          <strong>Use Case:</strong> {config.useCase}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cost Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Monthly Cost Comparison
                </CardTitle>
                <CardDescription>
                  Estimated costs based on usage and verbosity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Usage Input */}
                <div className="space-y-2">
                  <Label>Monthly Messages: {monthlyMessages.toLocaleString()}</Label>
                  <Slider
                    value={[monthlyMessages]}
                    onValueChange={([value]) => setMonthlyMessages(value)}
                    min={100}
                    max={10000}
                    step={100}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>100 messages</span>
                    <span>10,000 messages</span>
                  </div>
                </div>

                {/* Cost Breakdown Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold">Service</th>
                        <th className="text-right p-3 text-sm font-semibold">Cost/Month</th>
                        <th className="text-right p-3 text-sm font-semibold">Annual</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-3">
                          <div className="font-medium">Gemini 2.0 Flash + TTS</div>
                          <div className="text-xs text-muted-foreground">Fastest, most economical</div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${costs.totalFlash.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ${(costs.totalFlash * 12).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-3">
                          <div className="font-medium">Gemini 2.5 Pro + TTS</div>
                          <div className="text-xs text-muted-foreground">Highest quality, more expensive</div>
                        </td>
                        <td className="p-3 text-right font-mono">
                          ${costs.totalPro.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ${(costs.totalPro * 12).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-t bg-primary/5">
                        <td className="p-3">
                          <div className="font-medium flex items-center gap-2">
                            Gemini Live Audio
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">Native audio, low latency</div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          ${costs.totalLive.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          ${(costs.totalLive * 12).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Cost per Message */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Flash + TTS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${(costs.totalFlash / monthlyMessages).toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground">per message</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Pro + TTS</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${(costs.totalPro / monthlyMessages).toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground">per message</p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        Gemini Live
                        <Zap className="h-3 w-3 text-primary" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        ${(costs.totalLive / monthlyMessages).toFixed(4)}
                      </div>
                      <p className="text-xs text-muted-foreground">per message</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Savings Comparison */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <h3 className="font-semibold">Cost Optimization Tips</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Use <strong>Mute</strong> mode when you only need text responses (0% cost)</li>
                    <li>• <strong>Low</strong> verbosity reduces costs by ~70% vs Normal</li>
                    <li>• <strong>Gemini Live</strong> is more cost-effective for voice-heavy usage</li>
                    <li>• <strong>Experimental</strong> mode is 3x more expensive - use selectively</li>
                    <li>• Switching from Pro to Flash saves ~{((1 - costs.totalFlash / costs.totalPro) * 100).toFixed(0)}%</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Quality vs Cost Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Quality vs Cost Analysis
                </CardTitle>
                <CardDescription>
                  Find the right balance for your needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Best for Cost</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span>Mute + Flash</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
                          $0.00
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span>Low + Flash</span>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">
                          ${(costs.totalFlash * 0.3).toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">Best for Quality</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span>Normal + Live</span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500">
                          ${costs.totalLive.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 border rounded">
                        <span>Normal + Pro</span>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500">
                          ${costs.totalPro.toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
