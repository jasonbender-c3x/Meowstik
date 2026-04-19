
/**
 * Enhanced Markdown Renderer
 * 
 * Extends standard markdown with rich components:
 * - Callout boxes (info, warning, success, error)
 * - Collapsible sections
 * - Confidence badges
 * - Semantic coloring for headers, quotes, lists
 * - Action buttons
 * 
 * Custom syntax:
 * :::info Title
 * Content here
 * :::
 * 
 * :::warning Title
 * Content here
 * :::
 * 
 * :::collapsible Title
 * Hidden content
 * :::
 * 
 * [confidence:high] or [confidence:medium] or [confidence:low]
 * [button:Label](action)
 */

import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ChevronRight, Info, AlertTriangle, CheckCircle, XCircle, Lightbulb, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// EMOJI SUPPORT
// ============================================================================

const emojiMap: Record<string, string> = {
  // Faces & Emotions
  ':smile:': '😊', ':grin:': '😁', ':joy:': '😂', ':rofl:': '🤣',
  ':wink:': '😉', ':blush:': '😊', ':heart_eyes:': '😍', ':kissing:': '😗',
  ':thinking:': '🤔', ':neutral:': '😐', ':expressionless:': '😑',
  ':unamused:': '😒', ':rolling_eyes:': '🙄', ':grimace:': '😬',
  ':relieved:': '😌', ':pensive:': '😔', ':sleepy:': '😪', ':tired:': '😫',
  ':cry:': '😢', ':sob:': '😭', ':angry:': '😠', ':rage:': '😡',
  ':triumph:': '😤', ':scream:': '😱', ':fearful:': '😨', ':cold_sweat:': '😰',
  ':flushed:': '😳', ':dizzy_face:': '😵', ':sunglasses:': '😎', ':nerd:': '🤓',
  ':confused:': '😕', ':worried:': '😟', ':slightly_frowning:': '🙁',
  ':frowning:': '☹️', ':open_mouth:': '😮', ':hushed:': '😯', ':astonished:': '😲',
  ':sleeping:': '😴', ':drooling:': '🤤', ':yum:': '😋', ':stuck_out_tongue:': '😛',
  ':zany:': '🤪', ':partying:': '🥳', ':smirk:': '😏', ':skull:': '💀',
  ':ghost:': '👻', ':alien:': '👽', ':robot:': '🤖', ':clown:': '🤡',
  ':angel:': '😇', ':devil:': '😈', ':imp:': '👿',
  
  // Gestures & People
  ':wave:': '👋', ':raised_hand:': '✋', ':ok_hand:': '👌', ':thumbsup:': '👍',
  ':+1:': '👍', ':-1:': '👎', ':thumbsdown:': '👎', ':clap:': '👏',
  ':raised_hands:': '🙌', ':pray:': '🙏', ':handshake:': '🤝', ':muscle:': '💪',
  ':point_up:': '☝️', ':point_down:': '👇', ':point_left:': '👈', ':point_right:': '👉',
  ':crossed_fingers:': '🤞', ':v:': '✌️', ':metal:': '🤘', ':call_me:': '🤙',
  ':fist:': '✊', ':punch:': '👊', ':writing_hand:': '✍️',
  
  // Hearts & Love
  ':heart:': '❤️', ':red_heart:': '❤️', ':orange_heart:': '🧡', ':yellow_heart:': '💛',
  ':green_heart:': '💚', ':blue_heart:': '💙', ':purple_heart:': '💜',
  ':black_heart:': '🖤', ':white_heart:': '🤍', ':brown_heart:': '🤎',
  ':broken_heart:': '💔', ':heartbeat:': '💓', ':heartpulse:': '💗',
  ':sparkling_heart:': '💖', ':cupid:': '💘', ':gift_heart:': '💝',
  ':revolving_hearts:': '💞', ':two_hearts:': '💕', ':love_letter:': '💌',
  ':kiss:': '💋',
  
  // Objects & Symbols  
  ':star:': '⭐', ':star2:': '🌟', ':sparkles:': '✨', ':boom:': '💥',
  ':fire:': '🔥', ':zap:': '⚡', ':rainbow:': '🌈', ':sun:': '☀️',
  ':cloud:': '☁️', ':rain:': '🌧️', ':snow:': '❄️', ':snowflake:': '❄️',
  ':umbrella:': '☂️', ':droplet:': '💧', ':ocean:': '🌊',
  ':bulb:': '💡', ':lightbulb:': '💡', ':flashlight:': '🔦',
  ':bell:': '🔔', ':speaker:': '🔊', ':mute:': '🔇', ':mega:': '📣',
  ':loudspeaker:': '📢', ':speech_balloon:': '💬', ':thought_balloon:': '💭',
  ':email:': '📧', ':envelope:': '✉️', ':mailbox:': '📫', ':package:': '📦',
  ':calendar:': '📅', ':date:': '📅', ':clipboard:': '📋', ':memo:': '📝',
  ':pencil:': '✏️', ':pen:': '🖊️', ':book:': '📕', ':books:': '📚',
  ':bookmark:': '🔖', ':link:': '🔗', ':pushpin:': '📌', ':paperclip:': '📎',
  ':key:': '🔑', ':lock:': '🔒', ':unlock:': '🔓', ':hammer:': '🔨',
  ':wrench:': '🔧', ':gear:': '⚙️', ':scissors:': '✂️', ':tools:': '🛠️',
  ':shield:': '🛡️', ':trophy:': '🏆', ':medal:': '🏅', ':crown:': '👑',
  ':gem:': '💎', ':ring:': '💍', ':gift:': '🎁', ':ribbon:': '🎀',
  ':balloon:': '🎈', ':tada:': '🎉', ':confetti_ball:': '🎊', ':party:': '🎉',
  ':cake:': '🎂', ':birthday:': '🎂', ':candle:': '🕯️',
  
  // Tech & Work
  ':computer:': '💻', ':desktop:': '🖥️', ':laptop:': '💻', ':keyboard:': '⌨️',
  ':mouse:': '🖱️', ':phone:': '📱', ':telephone:': '📞', ':camera:': '📷',
  ':tv:': '📺', ':radio:': '📻', ':video_game:': '🎮', ':joystick:': '🕹️',
  ':headphones:': '🎧', ':microphone:': '🎤', ':musical_note:': '🎵',
  ':notes:': '🎶', ':guitar:': '🎸', ':piano:': '🎹', ':drum:': '🥁',
  ':rocket:': '🚀', ':satellite:': '🛰️', ':airplane:': '✈️', ':car:': '🚗',
  ':bus:': '🚌', ':train:': '🚂', ':ship:': '🚢', ':bike:': '🚲',
  ':hourglass:': '⏳', ':timer:': '⏱️', ':clock:': '🕐', ':watch:': '⌚',
  ':battery:': '🔋', ':plug:': '🔌', ':magnet:': '🧲', ':money:': '💰',
  ':dollar:': '💵', ':euro:': '💶', ':credit_card:': '💳', ':chart:': '📊',
  ':chart_up:': '📈', ':chart_down:': '📉', ':briefcase:': '💼',
  
  // Nature & Animals
  ':dog:': '🐕', ':cat:': '🐈', ':mouse_face:': '🐭', ':rabbit:': '🐰',
  ':fox:': '🦊', ':bear:': '🐻', ':panda:': '🐼', ':koala:': '🐨',
  ':tiger:': '🐯', ':lion:': '🦁', ':cow:': '🐄', ':pig:': '🐷',
  ':monkey:': '🐒', ':chicken:': '🐔', ':penguin:': '🐧', ':bird:': '🐦',
  ':eagle:': '🦅', ':duck:': '🦆', ':owl:': '🦉', ':bat:': '🦇',
  ':shark:': '🦈', ':octopus:': '🐙', ':crab:': '🦀', ':turtle:': '🐢',
  ':snake:': '🐍', ':frog:': '🐸', ':dragon:': '🐉', ':unicorn:': '🦄',
  ':bee:': '🐝', ':bug:': '🐛', ':butterfly:': '🦋', ':snail:': '🐌',
  ':spider:': '🕷️', ':ant:': '🐜', ':ladybug:': '🐞', ':scorpion:': '🦂',
  ':tree:': '🌲', ':evergreen_tree:': '🌲', ':deciduous_tree:': '🌳',
  ':palm_tree:': '🌴', ':cactus:': '🌵', ':herb:': '🌿', ':shamrock:': '☘️',
  ':four_leaf_clover:': '🍀', ':maple_leaf:': '🍁', ':fallen_leaf:': '🍂',
  ':leaves:': '🍃', ':mushroom:': '🍄', ':flower:': '🌸', ':sunflower:': '🌻',
  ':rose:': '🌹', ':tulip:': '🌷', ':hibiscus:': '🌺', ':cherry_blossom:': '🌸',
  ':bouquet:': '💐',
  
  // Food & Drink
  ':apple:': '🍎', ':green_apple:': '🍏', ':pear:': '🍐', ':orange:': '🍊',
  ':lemon:': '🍋', ':banana:': '🍌', ':watermelon:': '🍉', ':grapes:': '🍇',
  ':strawberry:': '🍓', ':melon:': '🍈', ':cherries:': '🍒', ':peach:': '🍑',
  ':mango:': '🥭', ':pineapple:': '🍍', ':coconut:': '🥥', ':avocado:': '🥑',
  ':tomato:': '🍅', ':eggplant:': '🍆', ':carrot:': '🥕', ':corn:': '🌽',
  ':hot_pepper:': '🌶️', ':pepper:': '🫑', ':cucumber:': '🥒', ':broccoli:': '🥦',
  ':bread:': '🍞', ':croissant:': '🥐', ':baguette:': '🥖', ':pretzel:': '🥨',
  ':cheese:': '🧀', ':egg:': '🥚', ':bacon:': '🥓', ':meat:': '🥩',
  ':poultry_leg:': '🍗', ':hamburger:': '🍔', ':fries:': '🍟', ':pizza:': '🍕',
  ':hotdog:': '🌭', ':sandwich:': '🥪', ':taco:': '🌮', ':burrito:': '🌯',
  ':sushi:': '🍣', ':ramen:': '🍜', ':spaghetti:': '🍝', ':curry:': '🍛',
  ':rice:': '🍚', ':rice_ball:': '🍙', ':cookie:': '🍪', ':chocolate:': '🍫',
  ':candy:': '🍬', ':lollipop:': '🍭', ':ice_cream:': '🍨', ':doughnut:': '🍩',
  ':coffee:': '☕', ':tea:': '🍵', ':milk:': '🥛', ':beer:': '🍺',
  ':wine:': '🍷', ':cocktail:': '🍸', ':champagne:': '🍾', ':tropical_drink:': '🍹',
  ':cup:': '🥤', ':juice:': '🧃', ':bubble_tea:': '🧋',
  
  // Status & Indicators
  ':check:': '✅', ':checkmark:': '✅', ':white_check_mark:': '✅',
  ':x:': '❌', ':cross:': '❌', ':no:': '🚫', ':stop:': '🛑',
  ':warning:': '⚠️', ':caution:': '⚠️', ':question:': '❓', ':exclamation:': '❗',
  ':info:': 'ℹ️', ':information:': 'ℹ️', ':new:': '🆕', ':free:': '🆓',
  ':up:': '⬆️', ':down:': '⬇️', ':left:': '⬅️', ':right:': '➡️',
  ':arrow_up:': '⬆️', ':arrow_down:': '⬇️', ':arrow_left:': '⬅️', ':arrow_right:': '➡️',
  ':arrow_forward:': '▶️', ':arrow_backward:': '◀️', ':rewind:': '⏪', ':fast_forward:': '⏩',
  ':play:': '▶️', ':pause:': '⏸️', ':stop_button:': '⏹️', ':record:': '⏺️',
  ':repeat:': '🔁', ':shuffle:': '🔀', ':infinity:': '♾️',
  ':red_circle:': '🔴', ':orange_circle:': '🟠', ':yellow_circle:': '🟡',
  ':green_circle:': '🟢', ':blue_circle:': '🔵', ':purple_circle:': '🟣',
  ':black_circle:': '⚫', ':white_circle:': '⚪', ':brown_circle:': '🟤',
  ':red_square:': '🟥', ':orange_square:': '🟧', ':yellow_square:': '🟨',
  ':green_square:': '🟩', ':blue_square:': '🟦', ':purple_square:': '🟪',
  ':100:': '💯', ':1234:': '🔢', ':abc:': '🔤',
  
  // Misc
  ':eyes:': '👀', ':eye:': '👁️', ':ear:': '👂', ':nose:': '👃',
  ':mouth:': '👄', ':tongue:': '👅', ':brain:': '🧠', ':bone:': '🦴',
  ':tooth:': '🦷', ':pill:': '💊', ':syringe:': '💉', ':dna:': '🧬',
  ':petri_dish:': '🧫', ':test_tube:': '🧪', ':microscope:': '🔬',
  ':telescope:': '🔭', ':atom:': '⚛️', ':globe:': '🌍', ':world:': '🌎',
  ':earth:': '🌏', ':moon:': '🌙', ':sun_face:': '🌞', ':full_moon:': '🌕',
  ':new_moon:': '🌑', ':comet:': '☄️', ':milky_way:': '🌌',
  ':id:': '🆔', ':sos:': '🆘', ':atm:': '🏧', ':wc:': '🚾',
  ':parking:': '🅿️', ':wheelchair:': '♿', ':recycle:': '♻️',
  ':copyright:': '©️', ':registered:': '®️', ':tm:': '™️',
};

function convertEmojis(text: string): string {
  let result = text;
  for (const [shortcode, emoji] of Object.entries(emojiMap)) {
    result = result.replaceAll(shortcode, emoji);
  }
  return result;
}

// ============================================================================
// CALLOUT COMPONENT
// ============================================================================

type CalloutType = "info" | "warning" | "success" | "error" | "tip";

const calloutConfig: Record<CalloutType, { icon: React.ReactNode; className: string; titleClass: string }> = {
  info: {
    icon: <Info className="h-5 w-5" />,
    className: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
    titleClass: "text-blue-800 dark:text-blue-200",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    className: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
    titleClass: "text-amber-800 dark:text-amber-200",
  },
  success: {
    icon: <CheckCircle className="h-5 w-5" />,
    className: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
    titleClass: "text-green-800 dark:text-green-200",
  },
  error: {
    icon: <XCircle className="h-5 w-5" />,
    className: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
    titleClass: "text-red-800 dark:text-red-200",
  },
  tip: {
    icon: <Lightbulb className="h-5 w-5" />,
    className: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300",
    titleClass: "text-purple-800 dark:text-purple-200",
  },
};

interface CalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type, title, children }: CalloutProps) {
  const config = calloutConfig[type];
  
  return (
    <div className={cn("rounded-lg border p-4 my-4", config.className)} data-testid={`callout-${type}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className={cn("font-semibold mb-1", config.titleClass)}>{title}</div>
          )}
          <div className="text-sm leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COLLAPSIBLE COMPONENT
// ============================================================================

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg my-4 overflow-hidden" data-testid="collapsible-section">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
        data-testid="collapsible-toggle"
      >
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>
        <span className="font-medium">{title}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-3 border-t">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CONFIDENCE BADGE
// ============================================================================

type ConfidenceLevel = "high" | "medium" | "low";

const confidenceConfig: Record<ConfidenceLevel, { color: string; label: string; emoji: string }> = {
  high: { color: "bg-green-500", label: "High confidence", emoji: "🟢" },
  medium: { color: "bg-amber-500", label: "Medium confidence", emoji: "🟡" },
  low: { color: "bg-red-500", label: "Low confidence", emoji: "🔴" },
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const config = confidenceConfig[level];
  
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted"
      title={config.label}
      data-testid={`confidence-${level}`}
    >
      <span className={cn("w-2 h-2 rounded-full", config.color)} />
      {config.label}
    </span>
  );
}

// ============================================================================
// CODE BLOCK WITH COPY BUTTON
// ============================================================================

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4" data-testid="code-block">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-xs font-medium bg-muted rounded-tl-lg rounded-br-lg text-muted-foreground">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid="copy-code-button"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className={cn(
        "p-4 rounded-lg bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-x-auto",
        language && "pt-8"
      )}>
        <code className="text-sm font-mono">{children}</code>
      </pre>
    </div>
  );
}

// ============================================================================
// PARSER - Extract custom blocks from markdown
// ============================================================================

interface ParsedBlock {
  type: "markdown" | "callout" | "collapsible";
  content: string;
  calloutType?: CalloutType;
  title?: string;
}

function parseCustomBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split('\n');
  let currentBlock: ParsedBlock | null = null;
  let blockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for block start: :::type Title
    const startMatch = line.match(/^:::(info|warning|success|error|tip|collapsible)\s*(.*)?$/);
    if (startMatch) {
      // Save previous markdown content
      if (blockContent.length > 0) {
        blocks.push({ type: "markdown", content: blockContent.join('\n') });
        blockContent = [];
      }
      
      const blockType = startMatch[1];
      const title = startMatch[2]?.trim() || undefined;
      
      if (blockType === "collapsible") {
        currentBlock = { type: "collapsible", content: "", title };
      } else {
        currentBlock = { type: "callout", content: "", calloutType: blockType as CalloutType, title };
      }
      continue;
    }
    
    // Check for block end: :::
    if (line.trim() === ":::" && currentBlock) {
      currentBlock.content = blockContent.join('\n');
      blocks.push(currentBlock);
      currentBlock = null;
      blockContent = [];
      continue;
    }
    
    // Add line to current content
    blockContent.push(line);
  }
  
  // Don't forget remaining content
  if (blockContent.length > 0) {
    if (currentBlock) {
      currentBlock.content = blockContent.join('\n');
      blocks.push(currentBlock);
    } else {
      blocks.push({ type: "markdown", content: blockContent.join('\n') });
    }
  }
  
  return blocks;
}

// ============================================================================
// INLINE PARSER - Parse confidence badges and buttons inline
// ============================================================================

function parseInlineElements(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let keyCounter = 0;

  // Confidence badge: [confidence:high]
  const confidenceRegex = /\[confidence:(high|medium|low)\]/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = confidenceRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    // Add badge
    elements.push(<ConfidenceBadge key={`conf-${keyCounter++}`} level={match[1] as ConfidenceLevel} />);
    lastIndex = confidenceRegex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }
  
  return elements.length > 0 ? elements : [text];
}

// ============================================================================
// MAIN ENHANCED MARKDOWN COMPONENT
// ============================================================================

interface EnhancedMarkdownProps {
  content: string;
  className?: string;
}

export function EnhancedMarkdown({ content, className }: EnhancedMarkdownProps) {
  // Convert emoji shortcodes before parsing
  const processedContent = useMemo(() => convertEmojis(content), [content]);
  const blocks = useMemo(() => parseCustomBlocks(processedContent), [processedContent]);

  return (
    <div className={cn("enhanced-markdown", className)}>
      {blocks.map((block, index) => {
        if (block.type === "callout" && block.calloutType) {
          return (
            <Callout key={index} type={block.calloutType} title={block.title}>
              <EnhancedMarkdown content={block.content} />
            </Callout>
          );
        }
        
        if (block.type === "collapsible") {
          return (
            <Collapsible key={index} title={block.title || "Details"}>
              <EnhancedMarkdown content={block.content} />
            </Collapsible>
          );
        }
        
        // Standard markdown with semantic styling
        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            components={{
              // Semantic colored headers
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-primary mt-6 mb-4">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-primary/90 mt-5 mb-3">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold text-primary/80 mt-4 mb-2">{children}</h3>
              ),
              
              // Colored blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-purple-400 pl-4 py-2 my-4 bg-purple-500/5 italic text-purple-700 dark:text-purple-300">
                  {children}
                </blockquote>
              ),
              
              // Styled lists
              ul: ({ children }) => (
                <ul className="list-none space-y-1 my-3">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="flex gap-2 items-start">
                  <span className="text-teal-500 mt-1">•</span>
                  <span>{children}</span>
                </li>
              ),
              
              // Links with accent color
              a: ({ href, children }) => (
                <a 
                  href={href} 
                  className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              
              // Inline code
              code: ({ className, children, ...props }) => {
                const isCodeBlock = className?.includes("language-");
                if (isCodeBlock) {
                  const language = className?.replace("language-", "");
                  return <CodeBlock language={language}>{String(children)}</CodeBlock>;
                }
                return (
                  <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-pink-600 dark:text-pink-400" {...props}>
                    {children}
                  </code>
                );
              },
              
              // Pre block wrapper
              pre: ({ children }) => <>{children}</>,
              
              // Parse inline elements in paragraphs with newline preservation
              p: ({ children }) => {
                let keyCounter = 0;
                const processedChildren = React.Children.toArray(children).flatMap((child, idx) => {
                  if (typeof child === 'string') {
                    // First preserve newlines by splitting and inserting <br/>
                    if (child.includes('\n')) {
                      return child.split('\n').flatMap((part, i, arr) => {
                        const inlineElements = parseInlineElements(part);
                        if (i < arr.length - 1) {
                          return [...(Array.isArray(inlineElements) ? inlineElements : [inlineElements]), <br key={`br-${idx}-${i}-${keyCounter++}`} />];
                        }
                        return Array.isArray(inlineElements) ? inlineElements : [inlineElements];
                      });
                    }
                    return parseInlineElements(child);
                  }
                  return child;
                });
                return <p className="my-3 leading-7">{processedChildren}</p>;
              },
              
              // Styled tables
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-lg border">
                  <table className="w-full border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted/50">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2 text-left font-semibold border-b">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2 border-b">{children}</td>
              ),
              
              // Horizontal rule
              hr: () => (
                <hr className="my-6 border-t-2 border-muted" />
              ),
            }}
          >
            {block.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export default EnhancedMarkdown;


