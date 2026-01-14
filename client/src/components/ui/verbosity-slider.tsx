/**
 * VerbositySlider - Controls voice output level
 * 
 * 6 Modes:
 * - Mute: Silent (no audio)
 * - Low: Low verbosity content, only "say" tool output
 * - Normal: Normal verbosity content, only "say" tool output (default)
 * - High: All chat content (except code blocks) spoken via "say" tool
 * - Demo HD: Premium expressive HD voice model
 * - Podcast: Dual-voice discussion style with barge-in
 */

import { useTTS, type VerbosityMode } from "@/contexts/tts-context";
import { VolumeX, Volume1, Volume2, Sparkles, Mic2, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const modes: { id: VerbosityMode; icon: React.ReactNode; label: string; description: string }[] = [
  { id: "mute", icon: <VolumeX className="h-4 w-4" />, label: "Mute", description: "No speech output" },
  { id: "low", icon: <Volume1 className="h-4 w-4" />, label: "Low", description: "Low verbosity, say tool only" },
  { id: "normal", icon: <Volume2 className="h-4 w-4" />, label: "Normal", description: "Normal verbosity, say tool only" },
  { id: "high", icon: <Volume2 className="h-4 w-4" />, label: "High", description: "All content spoken aloud" },
  { id: "demo-hd", icon: <Sparkles className="h-4 w-4" />, label: "Demo HD", description: "Premium expressive voice" },
  { id: "podcast", icon: <Radio className="h-4 w-4" />, label: "Podcast", description: "Dual-voice discussion style" },
];

export function VerbositySlider() {
  const { verbosityMode, setVerbosityMode } = useTTS();
  
  const currentIndex = modes.findIndex(m => m.id === verbosityMode);
  const currentMode = modes[currentIndex] || modes[2]; // Default to "normal"

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-muted/50 rounded-full p-1" data-testid="verbosity-slider">
        {modes.map((mode, index) => {
          const isActive = mode.id === verbosityMode;
          return (
            <Tooltip key={mode.id}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => setVerbosityMode(mode.id)}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    isActive 
                      ? "text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  data-testid={`verbosity-${mode.id}`}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="verbosity-indicator"
                      className="absolute inset-0 bg-primary rounded-full"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative z-10">{mode.icon}</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function VerbosityIndicator() {
  const { verbosityMode } = useTTS();
  const mode = modes.find(m => m.id === verbosityMode) || modes[2];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="verbosity-indicator"
          >
            {mode.icon}
            <span className="hidden sm:inline">{mode.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{mode.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
