
/**
 * Communications Page — Google Voice-style PWA using Twilio
 * Features: SMS threads, call log, voicemail player, contacts
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Phone,
  Voicemail,
  Users,
  Send,
  Search,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Loader2,
  Plus,
  Delete,
  ChevronLeft,
  Clock,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  lastDirection: "inbound" | "outbound";
}

interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  status: string;
}

interface CallRecord {
  id: string;
  callSid: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  duration: number;
  recordingUrl: string | null;
  createdAt: string;
}

interface VoicemailItem {
  id: string;
  from: string;
  to: string;
  recordingUrl: string;
  transcription: string | null;
  duration: number;
  heard: boolean;
  createdAt: string;
}

interface ContactInfo {
  resourceName: string;
  displayName: string;
  emailAddresses?: Array<{ value: string }>;
  phoneNumbers?: Array<{ value: string }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDuration(secs: number): string {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function initials(name: string | null, phone: string): string {
  if (name) {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-2);
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function callStatusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: "Completed",
    "no-answer": "No Answer",
    "in-progress": "Active",
    in_progress: "Active",
    failed: "Failed",
    busy: "Busy",
    canceled: "Canceled",
    ringing: "Ringing",
  };
  return map[status] ?? status;
}

// ── Dialpad Component ────────────────────────────────────────────────────────

function Dialpad({
  onDigit,
  onCall,
  value,
  loading,
}: {
  onDigit: (d: string) => void;
  onCall: () => void;
  value: string;
  loading?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="text-2xl font-mono tracking-widest min-h-[2.5rem] text-center w-full px-2">
        {value || <span className="text-muted-foreground text-lg">Enter number</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => onDigit(k)}
            className="w-14 h-14 rounded-full bg-muted hover:bg-muted/80 text-lg font-medium transition-colors"
          >
            {k}
          </button>
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        <button
          onClick={() => onDigit("\b")}
          className="w-14 h-14 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
        >
          <Delete className="h-5 w-5" />
        </button>
        <button
          onClick={onCall}
          disabled={!value || loading}
          className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Phone className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}

// ── Audio Player ─────────────────────────────────────────────────────────────

function AudioPlayer({ url, onPlay }: { url: string; onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () =>
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    audio.onended = () => setPlaying(false);
    return () => {
      audio.pause();
    };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play();
      onPlay?.();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
      <button
        onClick={toggle}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{formatDuration(Math.round(duration))}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "messages" | "calls" | "voicemail" | "contacts";

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [contactsSearch, setContactsSearch] = useState("");
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialpadNumber, setDialpadNumber] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMsgTo, setNewMsgTo] = useState("");
  const [newMsgBody, setNewMsgBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<Conversation[]>({
    queryKey: ["/api/communications/conversations"],
    refetchInterval: 5000,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/communications/conversations", selectedConv, "messages"],
    queryFn: async () => {
      if (!selectedConv) return [];
      const res = await fetch(
        `/api/communications/conversations/${encodeURIComponent(selectedConv)}/messages`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  const { data: calls = [], isLoading: loadingCalls } = useQuery<CallRecord[]>({
    queryKey: ["/api/communications/calls"],
    refetchInterval: 10000,
  });

  const { data: voicemails = [], isLoading: loadingVoicemails } = useQuery<VoicemailItem[]>({
    queryKey: ["/api/communications/voicemails"],
    refetchInterval: 15000,
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<ContactInfo[]>({
    queryKey: ["/api/communications/contacts", contactsSearch],
    queryFn: async () => {
      const url = contactsSearch
        ? `/api/communications/contacts?q=${encodeURIComponent(contactsSearch)}`
        : "/api/communications/contacts";
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const sendSMSMutation = useMutation({
    mutationFn: async ({ to, body }: { to: string; body: string }) => {
      const res = await fetch("/api/communications/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/conversations"] });
      if (selectedConv) {
        queryClient.invalidateQueries({
          queryKey: ["/api/communications/conversations", selectedConv, "messages"],
        });
      }
      setMessageText("");
      toast({ title: "Message sent" });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const makeCallMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await fetch("/api/communications/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (!res.ok) throw new Error("Failed to initiate call");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/calls"] });
      setShowDialpad(false);
      setDialpadNumber("");
      toast({ title: "Call initiated", description: "Connecting via Meowstik…" });
    },
    onError: () => toast({ title: "Call failed", variant: "destructive" }),
  });

  const markHeardMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/communications/voicemails/${id}/heard`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/communications/voicemails"] }),
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredConvs = conversations.filter(
    (c) =>
      !searchQuery ||
      c.phoneNumber.includes(searchQuery) ||
      (c.contactName?.toLowerCase() ?? "").includes(searchQuery.toLowerCase())
  );

  const unheardVoicemails = voicemails.filter((v) => !v.heard).length;
  const unreadMessages = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const missedCalls = calls.filter(
    (c) => c.direction === "inbound" && ["no-answer", "busy"].includes(c.status)
  ).length;

  const selectedConvData = conversations.find((c) => c.id === selectedConv);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSend = () => {
    if (!messageText.trim() || !selectedConv) return;
    sendSMSMutation.mutate({ to: selectedConv, body: messageText.trim() });
  };

  const handleNewMessage = () => {
    if (!newMsgTo || !newMsgBody.trim()) return;
    sendSMSMutation.mutate(
      { to: newMsgTo, body: newMsgBody.trim() },
      {
        onSuccess: () => {
          setShowNewMessage(false);
          setNewMsgTo("");
          setNewMsgBody("");
        },
      }
    );
  };

  const handleDialpadDigit = (d: string) => {
    if (d === "\b") setDialpadNumber((prev) => prev.slice(0, -1));
    else setDialpadNumber((prev) => prev + d);
  };

  const handleCallContact = (phone: string) => {
    setDialpadNumber(phone);
    setShowDialpad(true);
  };

  const handleTextContact = (phone: string) => {
    setNewMsgTo(phone);
    setShowNewMessage(true);
    setActiveTab("messages");
  };

  // ── Badge helper ───────────────────────────────────────────────────────────

  function BadgeCount({ n }: { n: number }) {
    if (!n) return null;
    return (
      <Badge variant="destructive" className="h-4 min-w-[1rem] px-1 text-[10px]">
        {n > 99 ? "99+" : n}
      </Badge>
    );
  }

  // ── Tab definitions ────────────────────────────────────────────────────────

  const tabs: Array<{ key: Tab; Icon: React.ComponentType<{ className?: string }>; label: string; badge?: number }> = [
    { key: "messages", Icon: MessageSquare, label: "Messages", badge: unreadMessages },
    { key: "calls", Icon: Phone, label: "Calls", badge: missedCalls },
    { key: "voicemail", Icon: Voicemail, label: "Voicemail", badge: unheardVoicemails },
    { key: "contacts", Icon: Users, label: "Contacts" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Communications</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowNewMessage(true)}>
            <MessageSquare className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">New Message</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowDialpad(true)}>
            <Phone className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Call</span>
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-background flex-shrink-0">
        {tabs.map(({ key, Icon, label, badge }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              if (key !== "messages") setSelectedConv(null);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2",
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
            {badge && badge > 0 ? (
              <Badge variant="destructive" className="h-4 min-w-[1rem] px-1 text-[10px]">
                {badge > 99 ? "99+" : badge}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ MESSAGES ════════════════════════════════════════════════════════ */}
        {activeTab === "messages" && (
          <>
            {/* Conversation list */}
            <div
              className={cn(
                "w-full sm:w-80 border-r flex flex-col overflow-hidden flex-shrink-0",
                selectedConv && "hidden sm:flex"
              )}
            >
              <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations"
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {loadingConvs && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loadingConvs && filteredConvs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <MessageSquare className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No conversations yet</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNewMessage(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" /> New Message
                    </Button>
                  </div>
                )}
                {filteredConvs.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedConv === conv.id && "bg-muted"
                    )}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(conv.contactName, conv.phoneNumber)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "text-sm truncate",
                            conv.unreadCount > 0 ? "font-bold" : "font-medium"
                          )}
                        >
                          {conv.contactName ?? formatPhone(conv.phoneNumber)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.lastDirection === "outbound" && (
                            <span className="text-foreground/60">You: </span>
                          )}
                          {conv.lastMessage}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge
                            variant="default"
                            className="h-4 min-w-[1rem] px-1 text-[10px] flex-shrink-0"
                          >
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </div>

            {/* Thread view */}
            <div
              className={cn(
                "flex-1 flex flex-col overflow-hidden",
                !selectedConv && "hidden sm:flex"
              )}
            >
              {!selectedConv ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                  <MessageSquare className="h-14 w-14 opacity-20" />
                  <p>Select a conversation</p>
                  <Button variant="outline" onClick={() => setShowNewMessage(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New Message
                  </Button>
                </div>
              ) : (
                <>
                  {/* Thread header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:hidden"
                      onClick={() => setSelectedConv(null)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(selectedConvData?.contactName ?? null, selectedConv)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {selectedConvData?.contactName ?? formatPhone(selectedConv)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatPhone(selectedConv)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCallContact(selectedConv)}
                      title="Call"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 px-4 py-3">
                    {loadingMessages && (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {messages.map((msg, i) => {
                        const isOut = msg.direction === "outbound";
                        const showTime =
                          i === 0 ||
                          new Date(msg.createdAt).getTime() -
                            new Date(messages[i - 1].createdAt).getTime() >
                            300_000;
                        return (
                          <div key={msg.id}>
                            {showTime && (
                              <div className="flex justify-center my-2">
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                  {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                                </span>
                              </div>
                            )}
                            <div
                              className={cn(
                                "flex",
                                isOut ? "justify-end" : "justify-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words",
                                  isOut
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted rounded-bl-sm"
                                )}
                              >
                                {msg.body}
                                <div
                                  className={cn(
                                    "text-[10px] mt-0.5 opacity-70 text-right",
                                    !isOut && "text-muted-foreground"
                                  )}
                                >
                                  {format(new Date(msg.createdAt), "h:mm a")}
                                  {isOut && (
                                    <span className="ml-1">
                                      {msg.status === "failed" ? "✗" : "✓"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Compose bar */}
                  <div className="border-t px-4 py-3 flex gap-2 flex-shrink-0">
                    <Textarea
                      placeholder="Message…"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="min-h-[40px] max-h-32 resize-none"
                      rows={1}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!messageText.trim() || sendSMSMutation.isPending}
                      size="icon"
                      className="flex-shrink-0 self-end"
                    >
                      {sendSMSMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ══ CALLS ═══════════════════════════════════════════════════════════ */}
        {activeTab === "calls" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">Recent Calls</h2>
              <Button size="sm" variant="outline" onClick={() => setShowDialpad(true)}>
                <Phone className="h-4 w-4 mr-1" /> New Call
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {loadingCalls && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingCalls && calls.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Phone className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No call history</p>
                </div>
              )}
              {calls.map((call) => {
                const isMissed =
                  call.direction === "inbound" &&
                  ["no-answer", "busy"].includes(call.status);
                const Icon = isMissed
                  ? PhoneMissed
                  : call.direction === "inbound"
                  ? PhoneIncoming
                  : PhoneOutgoing;
                const otherParty =
                  call.direction === "outbound" ? call.to : call.from;

                return (
                  <div
                    key={call.id}
                    className="px-4 py-3 border-b hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          isMissed
                            ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isMissed && "text-red-500"
                          )}
                        >
                          {formatPhone(otherParty)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{callStatusLabel(call.status)}</span>
                          {call.duration > 0 && (
                            <>
                              <span>·</span>
                              <span>{formatDuration(call.duration)}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{relativeTime(call.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCallContact(otherParty)}
                          title="Call back"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTextContact(otherParty)}
                          title="Send message"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {call.recordingUrl && (
                      <div className="mt-2 pl-13">
                        <AudioPlayer url={call.recordingUrl} />
                      </div>
                    )}
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* ══ VOICEMAIL ════════════════════════════════════════════════════════ */}
        {activeTab === "voicemail" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex-shrink-0">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                Voicemail
                {unheardVoicemails > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {unheardVoicemails} new
                  </Badge>
                )}
              </h2>
            </div>
            <ScrollArea className="flex-1">
              {loadingVoicemails && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingVoicemails && voicemails.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Voicemail className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No voicemails</p>
                </div>
              )}
              {voicemails.map((vm) => (
                <div
                  key={vm.id}
                  className={cn(
                    "px-4 py-4 border-b transition-colors",
                    !vm.heard && "bg-blue-50/50 dark:bg-blue-900/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        !vm.heard
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            "text-sm",
                            !vm.heard ? "font-bold" : "font-medium"
                          )}
                        >
                          {formatPhone(vm.from)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(vm.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(vm.duration)}</span>
                        {!vm.heard && (
                          <Badge variant="secondary" className="text-[10px] h-4">
                            New
                          </Badge>
                        )}
                      </div>
                      <AudioPlayer
                        url={vm.recordingUrl}
                        onPlay={() => {
                          if (!vm.heard) markHeardMutation.mutate(vm.id);
                        }}
                      />
                      {vm.transcription && (
                        <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                          &ldquo;{vm.transcription}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 ml-13">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCallContact(vm.from)}
                    >
                      <Phone className="h-3 w-3 mr-1" /> Call back
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTextContact(vm.from)}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" /> Text
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {/* ══ CONTACTS ════════════════════════════════════════════════════════ */}
        {activeTab === "contacts" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts"
                  className="pl-8"
                  value={contactsSearch}
                  onChange={(e) => setContactsSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loadingContacts && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingContacts && contacts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">
                    {contactsSearch ? "No contacts found" : "No contacts available"}
                  </p>
                  {!contactsSearch && (
                    <p className="text-xs text-center max-w-xs opacity-70">
                      Connect Google Contacts in Settings to see your contacts here.
                    </p>
                  )}
                </div>
              )}
              {contacts.map((contact) => {
                const phone = contact.phoneNumbers?.[0]?.value ?? null;
                return (
                  <div
                    key={contact.resourceName}
                    className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(contact.displayName, phone ?? "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{contact.displayName}</p>
                      {phone && (
                        <p className="text-xs text-muted-foreground">{formatPhone(phone)}</p>
                      )}
                      {contact.emailAddresses?.[0] && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.emailAddresses[0].value}
                        </p>
                      )}
                    </div>
                    {phone && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCallContact(phone)}
                          title={`Call ${contact.displayName}`}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTextContact(phone)}
                          title={`Text ${contact.displayName}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* ── Dialpad dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showDialpad} onOpenChange={setShowDialpad}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Make a Call</DialogTitle>
          </DialogHeader>
          <Dialpad
            value={dialpadNumber}
            onDigit={handleDialpadDigit}
            onCall={() => makeCallMutation.mutate(dialpadNumber)}
            loading={makeCallMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── New message dialog ──────────────────────────────────────────────── */}
      <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Input
              placeholder="To: +1 (555) 000-0000"
              value={newMsgTo}
              onChange={(e) => setNewMsgTo(e.target.value)}
            />
            <Textarea
              placeholder="Message"
              value={newMsgBody}
              onChange={(e) => setNewMsgBody(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMessage(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNewMessage}
              disabled={!newMsgTo || !newMsgBody.trim() || sendSMSMutation.isPending}
            >
              {sendSMSMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



