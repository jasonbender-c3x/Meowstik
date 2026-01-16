/**
 * VerbositySlider - Controls voice output level and chat verbosity
 * 
 * 4 Modes (aligned for both text and speech):
 * - Mute: Silent (alerts only)
 * - Low: Concise text & speech
 * - Normal: Verbose text & speech (default)
 * - Experimental: Dual-voice discussion mode
 */

import { useTTS, type VerbosityMode } from "@/contexts/tts-context";
import { VolumeX, Volume1, Volume2, Radio } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const modes: { id: VerbosityMode; icon: React.ReactNode; label: string; description: string }[] = [
  { id: "mute", icon: <VolumeX className="h-4 w-4" />, label: "Mute", description: "Silent (alerts only)" },
  { id: "low", icon: <Volume1 className="h-4 w-4" />, label: "Low", description: "Concise text & speech" },
  { id: "normal", icon: <Volume2 className="h-4 w-4" />, label: "Normal", description: "Verbose text & speech" },
  { id: "experimental", icon: <Radio className="h-4 w-4" />, label: "Experimental", description: "Dual-voice discussion mode" },
];

const DEFAULT_MODE: VerbosityMode = "normal";

export function VerbositySlider() {
  const { verbosityMode, setVerbosityMode } = useTTS();
  
  const currentIndex = modes.findIndex(m => m.id === verbosityMode);
  const currentMode = modes[currentIndex] !== undefined ? modes[currentIndex] : modes.find(m => m.id === DEFAULT_MODE)!;

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
  const mode = modes.find(m => m.id === verbosityMode) || modes.find(m => m.id === DEFAULT_MODE)!;
  
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
