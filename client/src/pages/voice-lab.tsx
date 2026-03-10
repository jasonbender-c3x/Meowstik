/**
 * Voice Lab - AI-Powered Voice Testing & Experimentation
 * 
 * Dual-purpose page for:
 * 1. Voice sampling and testing with AI-generated text
 * 2. Sound effects and expressiveness testing
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Play, Square, Sparkles, Loader2, Volume2, Wand2, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const VOICES = [
  { id: "Kore", gender: "Female", style: "Calm, Professional", code: "en-US-Neural2-C" },
  { id: "Puck", gender: "Male", style: "Deep, Assertive", code: "en-US-Neural2-D" },
  { id: "Charon", gender: "Male", style: "Steady, News", code: "en-US-Neural2-A" },
  { id: "Fenrir", gender: "Male", style: "Energetic", code: "en-US-Neural2-J" },
  { id: "Aoede", gender: "Female", style: "Soft, Storyteller", code: "en-US-Neural2-E" },
  { id: "Leda", gender: "Female", style: "Warm, Conversational", code: "en-US-Neural2-F" },
  { id: "Orus", gender: "Male", style: "Authoritative", code: "en-US-Neural2-I" },
  { id: "Zephyr", gender: "Female", style: "Bright, Assistant", code: "en-US-Neural2-H" },
];

const EXPRESSIVENESS_STYLES = [
  { value: "natural", label: "Natural", description: "Standard conversational tone" },
  { value: "cheerful", label: "Cheerful", description: "Upbeat and positive" },
  { value: "serious", label: "Serious", description: "Formal and grave" },
  { value: "excited", label: "Excited", description: "Energetic and enthusiastic" },
  { value: "calm", label: "Calm", description: "Soothing and peaceful" },
  { value: "dramatic", label: "Dramatic", description: "Theatrical and intense" },
  { value: "whisper", label: "Whisper", description: "Soft and intimate" },
  { value: "news", label: "News Anchor", description: "Professional broadcast style" },
  { value: "warm", label: "Warm", description: "Friendly and inviting" },
  { value: "professional", label: "Professional", description: "Business-like" },
];

const SOUND_EFFECTS = [
  { id: "pause-short", label: "Short Pause", ssml: '<break time="0.5s"/>' },
  { id: "pause-long", label: "Long Pause", ssml: '<break time="2s"/>' },
  { id: "emphasis-strong", label: "Strong Emphasis", ssml: '<emphasis level="strong">emphasized</emphasis>' },
  { id: "emphasis-moderate", label: "Moderate Emphasis", ssml: '<emphasis level="moderate">emphasized</emphasis>' },
  { id: "speed-slow", label: "Slow Speech", ssml: '<prosody rate="slow">slower</prosody>' },
  { id: "speed-fast", label: "Fast Speech", ssml: '<prosody rate="fast">faster</prosody>' },
  { id: "pitch-high", label: "High Pitch", ssml: '<prosody pitch="+20%">higher</prosody>' },
  { id: "pitch-low", label: "Low Pitch", ssml: '<prosody pitch="-20%">lower</prosody>' },
  { id: "volume-soft", label: "Soft Volume", ssml: '<prosody volume="soft">quiet</prosody>' },
  { id: "volume-loud", label: "Loud Volume", ssml: '<prosody volume="loud">louder</prosody>' },
];

const TEST_SCENARIOS = [
  { id: "greeting", label: "Greeting", prompt: "Generate a friendly professional greeting" },
  { id: "explanation", label: "Explanation", prompt: "Explain how neural networks work in simple terms" },
  { id: "story", label: "Story", prompt: "Tell a short exciting story about space exploration" },
  { id: "instruction", label: "Instruction", prompt: "Give step-by-step instructions for making coffee" },
  { id: "news", label: "News Report", prompt: "Write a brief news report about AI advancements" },
  { id: "poetry", label: "Poetry", prompt: "Write a short poem about technology" },
  { id: "dialogue", label: "Dialogue", prompt: "Create a conversation between two AI researchers" },
  { id: "presentation", label: "Presentation", prompt: "Write an introduction for a tech presentation" },
];

export default function VoiceLabPage() {
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedStyle, setSelectedStyle] = useState("natural");
  const [testText, setTestText] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expressiveness, setExpressiveness] = useState(50);
  const [speechRate, setSpeechRate] = useState(50);
  const [pitch, setPitch] = useState(50);
  const { toast } = useToast();

  const generateTestText = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/chat/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `Generate expressive text for voice testing. ${prompt}. Keep it under 200 words and make it engaging.`,
          maxTokens: 300
        }),
      });

      if (!response.ok) throw new Error('Failed to generate text');
      
      const data = await response.json();
      setTestText(data.text || data.content || "Generated text will appear here...");
      toast({ title: "Text Generated", description: "AI has created test text for you!" });
    } catch (error) {
      console.error('Error generating text:', error);
      toast({ 
        title: "Generation Failed", 
        description: "Could not generate text. Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const handleQuickGenerate = useCallback((scenario: typeof TEST_SCENARIOS[0]) => {
    generateTestText(scenario.prompt);
  }, [generateTestText]);

  const handleCustomGenerate = useCallback(() => {
    if (!userPrompt.trim()) {
      toast({ title: "Empty Prompt", description: "Please enter a prompt first.", variant: "destructive" });
      return;
    }
    generateTestText(userPrompt);
  }, [userPrompt, generateTestText, toast]);

  const handleSpeak = useCallback(async () => {
    if (!testText.trim()) {
      toast({ title: "No Text", description: "Generate or enter text first.", variant: "destructive" });
      return;
    }

    setIsSpeaking(true);
    try {
      // Build SSML with expressiveness controls
      let ssmlText = testText;
      
      // Apply speech rate
      if (speechRate !== 50) {
        const rate = speechRate < 50 ? "slow" : "fast";
        const percentage = Math.abs(speechRate - 50) * 2; // 0-100%
        ssmlText = `<prosody rate="${rate}">${ssmlText}</prosody>`;
      }

      // Apply pitch
      if (pitch !== 50) {
        const pitchChange = (pitch - 50) * 0.4; // -20% to +20%
        ssmlText = `<prosody pitch="${pitchChange > 0 ? '+' : ''}${pitchChange}%">${ssmlText}</prosody>`;
      }

      // Apply style
      if (selectedStyle !== "natural") {
        const stylePrefix = {
          cheerful: "Say cheerfully: ",
          serious: "Say seriously: ",
          excited: "Say excitedly: ",
          calm: "Say calmly: ",
          dramatic: "Say dramatically: ",
          whisper: "Whisper: ",
          news: "Say like a news anchor: ",
          warm: "Say warmly: ",
          professional: "Say professionally: ",
        }[selectedStyle] || "";
        
        ssmlText = stylePrefix + ssmlText;
      }

      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ssmlText,
          voice: selectedVoice,
        }),
      });

      if (!response.ok) throw new Error('TTS generation failed');

      const data = await response.json();
      
      // Play audio
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
        audio.play();
        audio.onended = () => setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Error speaking:', error);
      toast({ 
        title: "Speech Failed", 
        description: "Could not generate speech. Please try again.",
        variant: "destructive" 
      });
      setIsSpeaking(false);
    }
  }, [testText, selectedVoice, selectedStyle, speechRate, pitch, toast]);

  const insertSoundEffect = useCallback((effect: typeof SOUND_EFFECTS[0]) => {
    const cursorPos = 0; // In a real implementation, get cursor position
    const beforeCursor = testText.substring(0, cursorPos);
    const afterCursor = testText.substring(cursorPos);
    setTestText(beforeCursor + effect.ssml + afterCursor);
    toast({ title: "Effect Added", description: `${effect.label} inserted into text` });
  }, [testText, toast]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Voice Lab
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered voice testing and experimentation
            </p>
          </div>
          <Link href="/sound-settings">
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4 mr-2" />
              Sound Settings
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Tabs defaultValue="generate" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generate">AI Generate</TabsTrigger>
                <TabsTrigger value="voices">Voice Sampling</TabsTrigger>
                <TabsTrigger value="effects">Sound Effects</TabsTrigger>
              </TabsList>

              {/* AI Generate Tab */}
              <TabsContent value="generate" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Quick Scenarios */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Quick Scenarios
                      </CardTitle>
                      <CardDescription>
                        Generate test text for common use cases
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {TEST_SCENARIOS.map(scenario => (
                        <Button
                          key={scenario.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => handleQuickGenerate(scenario)}
                          disabled={isGenerating}
                        >
                          {scenario.label}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Custom Prompt */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Custom Prompt</CardTitle>
                      <CardDescription>
                        Describe what you want the AI to say
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="E.g., 'Explain quantum computing to a 5-year-old' or 'Give a motivational speech about perseverance'"
                        className="min-h-[150px]"
                      />
                      <Button 
                        onClick={handleCustomGenerate}
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate Text
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Generated Text & Controls */}
                <Card>
                  <CardHeader>
                    <CardTitle>Generated Text & Voice Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder="AI-generated text will appear here, or type your own..."
                      className="min-h-[200px] font-mono"
                    />

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Voice Selection */}
                      <div className="space-y-2">
                        <Label>Voice</Label>
                        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VOICES.map(voice => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.id} - {voice.style}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Style Selection */}
                      <div className="space-y-2">
                        <Label>Expressiveness</Label>
                        <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPRESSIVENESS_STYLES.map(style => (
                              <SelectItem key={style.value} value={style.value}>
                                {style.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Speak Button */}
                      <div className="space-y-2">
                        <Label>Action</Label>
                        <Button 
                          onClick={handleSpeak}
                          disabled={isSpeaking || !testText.trim()}
                          className="w-full"
                        >
                          {isSpeaking ? (
                            <>
                              <Square className="mr-2 h-4 w-4" />
                              Speaking...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Speak
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Fine-tuning Sliders */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Speech Rate: {speechRate}%</Label>
                        <Slider
                          value={[speechRate]}
                          onValueChange={([value]) => setSpeechRate(value)}
                          min={0}
                          max={100}
                          step={5}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Slower</span>
                          <span>Normal</span>
                          <span>Faster</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Pitch: {pitch}%</Label>
                        <Slider
                          value={[pitch]}
                          onValueChange={([value]) => setPitch(value)}
                          min={0}
                          max={100}
                          step={5}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Lower</span>
                          <span>Normal</span>
                          <span>Higher</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Voice Sampling Tab */}
              <TabsContent value="voices" className="space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {VOICES.map(voice => (
                    <Card 
                      key={voice.id}
                      className={`cursor-pointer transition-all ${selectedVoice === voice.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedVoice(voice.id)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Volume2 className="h-4 w-4" />
                          {voice.id}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {voice.gender} • {voice.style}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVoice(voice.id);
                            handleSpeak();
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Sample
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Sound Effects Tab */}
              <TabsContent value="effects" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>SSML Sound Effects</CardTitle>
                    <CardDescription>
                      Click to insert effects into your text
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {SOUND_EFFECTS.map(effect => (
                        <Button
                          key={effect.id}
                          variant="outline"
                          onClick={() => insertSoundEffect(effect)}
                          className="justify-start"
                        >
                          {effect.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
