import { useEffect, useState } from "react";
import { useTTS, VerbosityMode } from "@/contexts/tts-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    // we would need to update the speak() context method to accept a voiceId.
    // For now, this uses the default browser TTS.
    speak(testText);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      {/* Navigation Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back-home">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <Volume2 className="h-8 w-8 text-primary" />
          <div className="flex flex-col">
            <h1 className="text-3xl font-display font-bold">Audio & Voice</h1>
            <p className="text-sm text-muted-foreground">Configure synthesis, expressiveness, and speech behavior.</p>
          </div>
        </div>
      </div>

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Master Settings</CardTitle>
          <CardDescription>Global controls for audio output.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Master Audio</Label>
              <p className="text-sm text-muted-foreground">Enable or disable all speech output.</p>
            </div>
            <Switch checked={!isMuted} onCheckedChange={toggleMuted} />
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <Label>Verbosity Level: <span className="font-bold uppercase text-primary">{verbosityMode}</span></Label>
            </div>
            <div className="pt-2 px-2">
              <Slider 
                value={[
                  verbosityMode === "mute" ? 0 : 
                  verbosityMode === "quiet" ? 33 : 
                  verbosityMode === "verbose" ? 66 : 100
                ]}
                max={100} 
                step={33}
                onValueChange={(vals) => {
                  const v = vals[0];
                  if (v < 15) setVerbosityMode("mute");
                  else if (v < 50) setVerbosityMode("quiet");
                  else if (v < 85) setVerbosityMode("verbose");
                  else setVerbosityMode("experimental");
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Mute</span>
                <span>Quiet (Tools Only)</span>
                <span>Verbose (Full)</span>
                <span>Experimental</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Explorer */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Voice Selection</CardTitle>
            <CardDescription>Choose the persona for your AI.</CardDescription>
          </CardHeader>
          <CardContent>
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
                      <div className="font-medium">{voice.id}</div>
                      <div className="text-xs text-muted-foreground">{voice.style}</div>
                    </div>
                  </div>
                  {selectedVoice === voice.id && <div className="text-xs font-bold text-primary">Active</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SSML Playground */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>SSML Laboratory</CardTitle>
            <CardDescription>Test voice expressiveness with SSML tags.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
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
              className="font-mono text-sm min-h-[150px] resize-none"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
