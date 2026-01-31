/**
 * Communications Page - Unified SMS, Calls, and Voicemail
 * Google Voice-style interface for Twilio integration
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Phone,
  Voicemail,
  Send,
  Search,
  ArrowLeft,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Loader2,
  User,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: Date;
  status: string;
}

interface Call {
  id: string;
  callSid: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  duration: number;
  recordingUrl: string | null;
  createdAt: Date;
}

interface VoicemailItem {
  id: string;
  from: string;
  recordingUrl: string;
  transcription: string | null;
  duration: number;
  heard: boolean;
  createdAt: Date;
}

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [playingVoicemail, setPlayingVoicemail] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/communications/conversations"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/communications/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  // Fetch calls
  const { data: calls = [], isLoading: loadingCalls } = useQuery<Call[]>({
    queryKey: ["/api/communications/calls"],
  });

  // Fetch voicemails
  const { data: voicemails = [], isLoading: loadingVoicemails } = useQuery<VoicemailItem[]>({
    queryKey: ["/api/communications/voicemails"],
  });

  // Send SMS mutation
  const sendSMS = useMutation({
    mutationFn: async ({ to, body }: { to: string; body: string }) => {
      const response = await fetch("/api/communications/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, body }),
      });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/conversations"] });
      setMessageText("");
      toast({ title: "Message Sent", description: "Your SMS was delivered successfully" });
    },
    onError: () => {
      toast({ title: "Send Failed", description: "Could not send message", variant: "destructive" });
    },
  });

  // Mark voicemail as heard
  const markVoicemailHeard = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/communications/voicemails/${id}/heard`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to mark as heard");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications/voicemails"] });
    },
  });

  const handleSendMessage = () => {
    if (!selectedConversation || !messageText.trim()) return;
    
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation) return;

    sendSMS.mutate({
      to: conversation.phoneNumber,
      body: messageText,
    });
  };

  const handlePlayVoicemail = (voicemail: VoicemailItem) => {
    if (playingVoicemail === voicemail.id) {
      setPlayingVoicemail(null);
      return;
    }
    
    setPlayingVoicemail(voicemail.id);
    if (!voicemail.heard) {
      markVoicemailHeard.mutate(voicemail.id);
    }

    // Play audio
    const audio = new Audio(voicemail.recordingUrl);
    audio.play();
    audio.onended = () => setPlayingVoicemail(null);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phoneNumber.includes(searchQuery)
  );

  const getCallIcon = (call: Call) => {
    if (call.direction === "inbound") {
      return call.status === "completed" ? PhoneIncoming : PhoneMissed;
    }
    return PhoneOutgoing;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
              <Phone className="h-5 w-5 text-primary" />
              Communications
            </h1>
            <p className="text-sm text-muted-foreground">
              Messages, calls, and voicemail
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Left Sidebar - Tabs */}
          <div className="w-full md:w-80 border-r flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 rounded-none border-b">
                <TabsTrigger value="messages" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Messages</span>
                  {conversations.filter(c => c.unreadCount > 0).length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                      {conversations.reduce((sum, c) => sum + c.unreadCount, 0)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="calls" className="gap-2">
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Calls</span>
                </TabsTrigger>
                <TabsTrigger value="voicemail" className="gap-2">
                  <Voicemail className="h-4 w-4" />
                  <span className="hidden sm:inline">Voicemail</span>
                  {voicemails.filter(v => !v.heard).length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                      {voicemails.filter(v => !v.heard).length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
                <TabsContent value="messages" className="m-0">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No conversations yet</p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={cn(
                          "w-full p-4 text-left border-b hover:bg-muted/50 transition-colors",
                          selectedConversation === conv.id && "bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {conv.contactName?.charAt(0) || <User className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium truncate">
                                {conv.contactName || conv.phoneNumber}
                              </div>
                              {conv.unreadCount > 0 && (
                                <Badge variant="destructive" className="ml-2">
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="calls" className="m-0">
                  {loadingCalls ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : calls.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No call history</p>
                    </div>
                  ) : (
                    calls.map((call) => {
                      const Icon = getCallIcon(call);
                      return (
                        <div key={call.id} className="p-4 border-b hover:bg-muted/50">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-full",
                              call.direction === "inbound" && call.status === "completed" && "bg-green-500/10 text-green-600",
                              call.direction === "inbound" && call.status !== "completed" && "bg-red-500/10 text-red-600",
                              call.direction === "outbound" && "bg-blue-500/10 text-blue-600"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">
                                {call.direction === "inbound" ? call.from : call.to}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {call.status === "completed" ? formatDuration(call.duration) : call.status}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
                              </div>
                            </div>
                            {call.recordingUrl && (
                              <Button variant="ghost" size="sm">
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="voicemail" className="m-0">
                  {loadingVoicemails ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : voicemails.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Voicemail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No voicemails</p>
                    </div>
                  ) : (
                    voicemails.map((vm) => (
                      <div 
                        key={vm.id} 
                        className={cn(
                          "p-4 border-b hover:bg-muted/50",
                          !vm.heard && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlayVoicemail(vm)}
                          >
                            {playingVoicemail === vm.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium">{vm.from}</div>
                              {!vm.heard && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            {vm.transcription && (
                              <div className="text-sm text-muted-foreground mb-2">
                                "{vm.transcription}"
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatDuration(vm.duration)}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(vm.createdAt), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Content - Message Thread */}
          <div className="flex-1 flex flex-col">
            {activeTab === "messages" && selectedConversation ? (
              <>
                {/* Conversation Header */}
                <div className="border-b p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {conversations.find(c => c.id === selectedConversation)?.contactName?.charAt(0) || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">
                        {conversations.find(c => c.id === selectedConversation)?.contactName || 
                         conversations.find(c => c.id === selectedConversation)?.phoneNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {conversations.find(c => c.id === selectedConversation)?.phoneNumber}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.direction === "outbound" && "justify-end"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-lg p-3",
                              message.direction === "outbound"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <div className="text-sm">{message.body}</div>
                            <div className={cn(
                              "text-xs mt-1",
                              message.direction === "outbound"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}>
                              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="resize-none"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sendSMS.isPending}
                      size="icon"
                      className="shrink-0"
                    >
                      {sendSMS.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
