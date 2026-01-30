import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, HelpCircle, MessageSquare, Keyboard, Sparkles, FileText, Mail, FolderOpen, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function HelpPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const faqs = [
    {
      question: "How do I start a new conversation?",
      answer: "Click the 'New chat' button in the sidebar or simply start typing in the input area at the bottom of the screen. It's as easy as a cat finding a sunny spot!",
      icon: MessageSquare,
      category: "Getting Started"
    },
    {
      question: "What can Meowstik help me with?",
      answer: "This clever cat can assist with writing, coding, analysis, brainstorming, answering questions, and integrating with Google Workspace services like Drive, Gmail, Calendar, Docs, Sheets, and Tasks. Purrfect for any task!",
      icon: Sparkles,
      category: "Capabilities"
    },
    {
      question: "How do I access Google services?",
      answer: "Click on the Google services link in the sidebar or navigate to /google. You can connect your Google account to access Drive, Gmail, Calendar, and more. Even cats love organized files!",
      icon: FolderOpen,
      category: "Integrations"
    },
    {
      question: "Can I attach files to my messages?",
      answer: "Yes! You can attach images and documents using the attachment button in the input area. Meowstik can analyze and discuss the content of your files like a curious cat inspecting something new.",
      icon: FileText,
      category: "Features"
    },
    {
      question: "How do I use the code editor?",
      answer: "Navigate to /editor to access the built-in HTML/CSS/JS code editor. You can write code and see live previews of your work. Hunt those bugs like a cat stalking prey!",
      icon: Keyboard,
      category: "Features"
    },
    {
      question: "Is my conversation history saved?",
      answer: "Yes, all your conversations are automatically saved and organized in the sidebar. You can access past chats at any time by clicking on them. We never forget, just like cats remember where you hide the treats!",
      icon: MessageSquare,
      category: "Privacy"
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="help-page">
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
              <HelpCircle className="h-5 w-5 text-primary" />
              Help & FAQ
            </h1>
            <p className="text-sm text-muted-foreground">
              Everything you need to know about using Meowstik
            </p>
          </div>
          <Badge variant="secondary" className="hidden md:flex">
            {faqs.length} Topics
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {/* Welcome Message */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg mb-2">Welcome to Meowstik! 🐱</h2>
                  <p className="text-muted-foreground">
                    Here you'll find answers to common questions and guidance on how to get the most out of your purrfect AI assistant.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">
                Frequently Asked Questions
              </h3>
              {faqs.map((faq, index) => {
                const IconComponent = faq.icon;
                return (
                  <Collapsible
                    key={index}
                    open={expandedFaq === index}
                    onOpenChange={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  >
                    <div className="border border-border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-colors">
                      <CollapsibleTrigger className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{faq.question}</h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {faq.category}
                            </Badge>
                          </div>
                        </div>
                        {expandedFaq === index ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2">
                          <p className="text-muted-foreground pl-11">{faq.answer}</p>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>

            {/* Keyboard Shortcuts */}
            <div className="border border-border rounded-lg bg-muted/20 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" />
                Keyboard Shortcuts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm">Send message</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">Enter</kbd>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm">New line</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">Shift + Enter</kbd>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm">New chat</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">Ctrl + N</kbd>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-background border border-border">
                  <span className="text-sm">Toggle sidebar</span>
                  <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">Ctrl + B</kbd>
                </div>
              </div>
            </div>

            {/* Need More Help */}
            <div className="border border-border rounded-lg bg-card p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Need More Help?
              </h2>
              <p className="text-muted-foreground">
                If you have additional questions or need personalized assistance, feel free to ask Meowstik directly in the chat. This curious cat is designed to help you with a wide range of tasks and questions. Just say "meow"! 🐾
              </p>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
