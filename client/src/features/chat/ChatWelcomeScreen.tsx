import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Compass,
  Lightbulb,
  Code2,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Moon,
  Fish,
  Heart,
  Zap,
  BookOpen,
  Mail,
  Calendar,
  FileText,
  Github,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@assets/generated_images/cute_cat_logo_icon.png";

const CAT_CARDS = [
  {
    icon: Compass,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    text: "Find a cozy spot",
    subtext: "for the purrfect nap",
    prompt: "Help me find the perfect cozy spot for a relaxing afternoon nap",
  },
  {
    icon: Lightbulb,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    text: "Brainstorm",
    subtext: "clever cat pun names",
    prompt: "Brainstorm clever cat pun names for a new pet or project",
  },
  {
    icon: Code2,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    text: "Hunt bugs",
    subtext: "like a cat stalking prey",
    prompt: "Help me hunt down and catch bugs in my code like a skilled cat",
  },
  {
    icon: Sparkles,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    text: "Write a poem",
    subtext: "about magnificent cats",
    prompt: "Write a poem celebrating the grace and mystery of cats",
  },
  {
    icon: PawPrint,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    text: "Leave your mark",
    subtext: "on a creative project",
    prompt: "Help me leave my creative mark on a new project",
  },
  {
    icon: Moon,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    text: "Midnight musings",
    subtext: "for night owl thinkers",
    prompt: "Share some midnight musings for a night owl like me",
  },
  {
    icon: Fish,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    text: "Catch ideas",
    subtext: "like fish in a stream",
    prompt: "Help me catch fresh ideas like a cat fishing",
  },
  {
    icon: Heart,
    color: "text-red-500",
    bg: "bg-red-500/10",
    text: "Show some love",
    subtext: "with a heartfelt message",
    prompt: "Help me write a heartfelt message",
  },
  {
    icon: Zap,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    text: "Quick reflexes",
    subtext: "for fast solutions",
    prompt: "I need quick, cat-like reflexes to solve a problem fast",
  },
  {
    icon: BookOpen,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    text: "Curious cat",
    subtext: "learns something new",
    prompt: "Teach me something interesting",
  },
];

function CatCardCarousel({
  onSendMessage,
}: {
  onSendMessage: (content: string, attachments?: any[]) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardsPerPage = 4;
  const totalPages = Math.ceil(CAT_CARDS.length / cardsPerPage);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  const visibleCards = CAT_CARDS.slice(
    currentIndex * cardsPerPage,
    currentIndex * cardsPerPage + cardsPerPage
  );

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="absolute -left-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex hover:bg-secondary/60"
        data-testid="carousel-prev"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="absolute -right-12 top-1/2 -translate-y-1/2 z-10 hidden lg:flex hover:bg-secondary/60"
        data-testid="carousel-next"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {visibleCards.map((card, idx) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={`${currentIndex}-${idx}`}
                  onClick={() => onSendMessage(card.prompt, [])}
                  data-testid={`cat-card-${currentIndex * cardsPerPage + idx}`}
                  className="flex flex-col items-start p-4 h-40 bg-secondary/30 hover:bg-secondary/60 border border-transparent hover:border-primary/10 rounded-2xl transition-all duration-200 text-left group relative overflow-hidden"
                >
                  <div
                    className={`mb-auto p-2 ${card.bg} rounded-full shadow-sm group-hover:scale-110 transition-transform duration-200`}
                  >
                    <IconComponent className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div className="mt-4">
                    <div className="font-medium text-foreground">
                      {card.text}
                    </div>
                    <div className="text-sm text-muted-foreground opacity-80">
                      {card.subtext}
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex lg:hidden justify-center gap-2 mt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrev}
          className="hover:bg-secondary/60"
          data-testid="carousel-prev-mobile"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNext}
          className="hover:bg-secondary/60"
          data-testid="carousel-next-mobile"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            data-testid={`carousel-dot-${idx}`}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              idx === currentIndex
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface ChatWelcomeScreenProps {
  displayName: string;
  onSendMessage: (content: string, attachments?: any[]) => void;
}

export function ChatWelcomeScreen({
  displayName,
  onSendMessage,
}: ChatWelcomeScreenProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8 relative">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
        <img
          src={logo}
          alt="Meowstik Logo"
          className="w-24 h-24 rounded-2xl relative z-10 shadow-2xl shadow-primary/20"
          data-testid="img-logo"
        />
      </div>

      <h1
        className="text-4xl md:text-5xl font-display font-medium text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/60 mb-3 text-center tracking-tight"
        data-testid="text-welcome-title"
      >
        Meow there, {displayName}! 🐱
      </h1>

      <h2
        className="text-2xl md:text-3xl font-display font-light text-muted-foreground mb-12 text-center"
        data-testid="text-welcome-subtitle"
      >
        What can this curious cat help you with?
      </h2>

      <CatCardCarousel onSendMessage={onSendMessage} />

      <div className="mt-8 w-full max-w-4xl">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
          Quick Links
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/60 rounded-lg text-sm transition-colors"
            data-testid="link-gmail"
          >
            <Mail className="h-4 w-4 text-red-500" /> Gmail
          </a>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/60 rounded-lg text-sm transition-colors"
            data-testid="link-calendar"
          >
            <Calendar className="h-4 w-4 text-blue-500" /> Calendar
          </a>
          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/60 rounded-lg text-sm transition-colors"
            data-testid="link-drive"
          >
            <FileText className="h-4 w-4 text-yellow-500" /> Drive
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/60 rounded-lg text-sm transition-colors"
            data-testid="link-github"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </div>
      </div>

      <div className="mt-8 text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} Jason Bender
      </div>
    </div>
  );
}
