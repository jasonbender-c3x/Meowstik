import { useEffect, useState } from "react";
import { useTTS, VerbosityMode } from "@/contexts/tts-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Square, Volume2, Mic, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// Hardcoded list of Google Neural2 voices (matching server/integrations/expressive-tts.ts)
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

const SSML_EXAMPLES = {
  basic: "Hello! I am Meowstik, your AI assistant.",
  pause: "Wait... <break time=\"1s\"/> did you hear that?",
  emphasis: "I <emphasis level=\"strong\">really</emphasis> need you to focus.",
  speed: "I can speak <prosody rate=\"slow\">very slowly</prosody> or <prosody rate=\"fast\">very quickly</prosody>.",
  whisper: "<prosody volume=\"soft\">This is a secret.</prosody>"
};

export default function AudioSettings() {
  const { 
    isMuted, toggleMuted, 
    verbosityMode, setVerbosityMode,
    speak, stopSpeaking, isSpeaking,
    unlockAudio, isAudioUnlocked 
  } = useTTS();
  
  const [testText, setTestText] = useState(SSML_EXAMPLES.basic);
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const { toast } = useToast();

  // Ensure audio context is unlocked on interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (!isAudioUnlocked) unlockAudio();
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, [isAudioUnlocked, unlockAudio]);

  const handleSpeak = () => {
    if (isMuted) {
      toast({ title: "Audio Muted", description: "Unmute global audio to test speech.", variant: "destructive" });
      return;
    }
    // Note: To support specific voice selection for testing, 
    // we would need to update the speak() context method to accept a voice parameter.
    // For now, this uses the default browser TTS.
    speak(testText);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="audio-settings-page">
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
              <Volume2 className="h-5 w-5 text-primary" />
              Audio & Voice
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure synthesis, expressiveness, and speech behavior
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Master Settings Section */}
            <div className="border border-border rounded-lg bg-muted/20 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Master Settings</h2>
                <p className="text-sm text-muted-foreground mb-6">Global controls for audio output.</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Master Audio</Label>
                  <p className="text-sm text-muted-foreground">Enable or disable all speech output.</p>
                </div>
                <Switch checked={!isMuted} onCheckedChange={toggleMuted} />
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between">
                  <Label>Verbosity Level: <span className="font-bold uppercase text-primary ml-1">{verbosityMode}</span></Label>
                </div>
                <div className="pt-2 px-2">
                  {(() => {
                    // Calculate slider value based on mode
                    // Modes are evenly distributed: 0, 33, 66, 100
                    const SLIDER_MAX = 100;
                    const NUM_MODES = 4;
                    const STEP = SLIDER_MAX / (NUM_MODES - 1); // 33.33
                    
                    const modeIndex = ["mute", "low", "normal", "experimental"].indexOf(verbosityMode);
                    const sliderValue = modeIndex >= 0 ? modeIndex * STEP : 2 * STEP; // Default to "normal"
                    
                    return (
                      <Slider 
                        value={[sliderValue]}
                        max={SLIDER_MAX} 
                        step={STEP}
                        onValueChange={(vals) => {
                          const v = vals[0];
                          const threshold = STEP / 2; // Midpoint between positions
                          if (v < threshold) setVerbosityMode("mute");
                          else if (v < STEP + threshold) setVerbosityMode("low");
                          else if (v < 2 * STEP + threshold) setVerbosityMode("normal");
                          else setVerbosityMode("experimental");
                        }}
                      />
                    );
                  })()}
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Mute</span>
                    <span>Low (Concise)</span>
                    <span>Normal (Verbose)</span>
                    <span>Experimental</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Explorer and SSML */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Voice Selection */}
              <div className="border border-border rounded-lg bg-muted/20 p-6">
                <h2 className="text-lg font-semibold mb-4">Voice Selection</h2>
                <p className="text-sm text-muted-foreground mb-4">Choose the persona for your AI.</p>
                <div className="grid grid-cols-1 gap-3">
                  {VOICES.map(voice => (
                    <div 
                      key={voice.id} 
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${selectedVoice === voice.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${selectedVoice === voice.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {voice.gender === "Male" ? <Volume2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{voice.id}</div>
                          <div className="text-xs text-muted-foreground">{voice.style}</div>
                        </div>
                      </div>
                      {selectedVoice === voice.id && <div className="text-xs font-bold text-primary">Active</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* SSML Playground */}
              <div className="border border-border rounded-lg bg-muted/20 p-6 flex flex-col">
                <h2 className="text-lg font-semibold mb-4">SSML Laboratory</h2>
                <p className="text-sm text-muted-foreground mb-4">Test voice expressiveness with SSML tags.</p>
                <div className="flex-1 space-y-4 flex flex-col">
                  <Tabs defaultValue="basic" onValueChange={(val) => setTestText(SSML_EXAMPLES[val as keyof typeof SSML_EXAMPLES])}>
                    <TabsList className="grid grid-cols-5 w-full h-auto flex-wrap">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="pause">Pause</TabsTrigger>
                      <TabsTrigger value="emphasis">Bold</TabsTrigger>
                      <TabsTrigger value="speed">Speed</TabsTrigger>
                      <TabsTrigger value="whisper">Soft</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <Textarea 
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    className="font-mono text-sm min-h-[150px] resize-none flex-1"
                    placeholder="Type text or SSML here..."
                  />
                  
                  <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">
                      Current Voice: <span className="font-mono font-bold text-foreground">{selectedVoice}</span>
                    </div>
                    <div className="flex gap-2">
                      {isSpeaking ? (
                        <Button variant="destructive" size="sm" onClick={stopSpeaking}>
                          <Square className="h-4 w-4 mr-2" /> Stop
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleSpeak}>
                          <Play className="h-4 w-4 mr-2" /> Speak
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
