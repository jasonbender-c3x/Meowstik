/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                GOOGLE-SERVICES.TSX - GOOGLE WORKSPACE DASHBOARD               ║
 * ║                                                                               ║
 * ║  A comprehensive dashboard for interacting with Google Workspace services:   ║
 * ║                                                                               ║
 * ║    1. Google Drive - Browse, search, and open files                          ║
 * ║    2. Gmail - Read emails and compose new messages                           ║
 * ║    3. Google Calendar - View and create events                               ║
 * ║    4. Google Docs - View and create documents                                ║
 * ║    5. Google Sheets - View and create spreadsheets                           ║
 * ║    6. Google Tasks - Manage task lists and tasks                             ║
 * ║                                                                               ║
 * ║  Layout Structure (matching design.tsx and database-explorer.tsx):            ║
 * ║  ┌────────────────────────────────────────────────────────────────────────┐  ║
 * ║  │ Header: border-b bg-card px-4 py-3                                     │  ║
 * ║  │ [← Back] Icon Title • Subtitle                                          │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ Tabs: [Drive] [Gmail] [Calendar] [Docs] [Sheets] [Tasks]               │  ║
 * ║  ├────────────────────────────────────────────────────────────────────────┤  ║
 * ║  │ ScrollArea: min-h-screen bg-background flex flex-col                   │  ║
 * ║  │  Content sections: border border-border rounded-lg bg-muted/20 p-6     │  ║
 * ║  │                                                                        │  ║
 * ║  └────────────────────────────────────────────────────────────────────────┘  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * React Hooks
 * - useState: Manage component state for forms and UI
 */
import { useState } from "react";

/**
 * TanStack Query (React Query)
 * - useQuery: Fetch and cache data from APIs
 * - useMutation: Handle data mutations (POST, PUT, DELETE)
 * - useQueryClient: Access query cache for invalidation
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * shadcn/ui Components
 * - Button: Consistent styled buttons
 * - Input: Text input fields
 * - Textarea: Multi-line text input
 * - Tabs: Tab navigation component
 * - ScrollArea: Scrollable container with custom scrollbar
 * - Badge: Status/label badges
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

/**
 * Custom Toast Hook for notifications
 */
import { useToast } from "@/hooks/use-toast";

/**
 * Lucide Icons
 * - Service icons for each Google service
 * - Action icons for buttons
 */
import { 
  FolderOpen,      // Google Drive icon
  Mail,            // Gmail icon
  Calendar,        // Google Calendar icon
  FileText,        // Google Docs icon
  Table2,          // Google Sheets icon
  CheckSquare,     // Google Tasks icon
  RefreshCw,       // Refresh/reload icon
  Plus,            // Create/add icon
  ExternalLink,    // Open in new tab icon
  Send,            // Send email icon
  ArrowLeft,       // Back navigation icon
  Loader2          // Loading spinner icon
} from "lucide-react";

/**
 * Wouter Link for navigation
 */
import { Link } from "wouter";

/**
 * Utility function for conditional class names
 */
import { cn } from "@/lib/utils";

// ============================================================================
// GOOGLE DRIVE PANEL COMPONENT
// ============================================================================

/**
 * DrivePanel - Google Drive File Browser
 * 
 * Displays a list of files from Google Drive with search functionality.
 * 
 * Features:
 * - List recent files from Drive
 * - Search files by name
 * - Open files in Google Drive web interface
 * - Refresh file list
 * 
 * API Endpoints Used:
 * - GET /api/drive/files - List files
 * - GET /api/drive/search?q=query - Search files
 * 
 * @returns {JSX.Element} Drive panel component
 */
function DrivePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  /**
   * Search query state
   * When empty, shows recent files; when filled, shows search results
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Query: Fetch list of Drive files
   * Fetches recent files from the user's Google Drive
   */
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/drive/files'],
    queryFn: () => fetch('/api/drive/files').then(res => res.json()),
  });

  /**
   * Query: Search Drive files
   * Only enabled when searchQuery is not empty
   */
  const searchFiles = useQuery({
    queryKey: ['/api/drive/search', searchQuery],
    queryFn: () => fetch(`/api/drive/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json()),
    enabled: !!searchQuery, // Only run when search query exists
  });

  // Use search results if searching, otherwise show all files
  const displayFiles = searchQuery ? (searchFiles.data || []) : files;

  return (
    <div className="space-y-4">
      {/* Search and Refresh Controls */}
      <div className="flex gap-2">
        <Input
          data-testid="input-drive-search"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button 
          data-testid="button-drive-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* File Count Badge */}
      {displayFiles.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{displayFiles.length} files</Badge>
        </div>
      )}
      
      {/* Scrollable File List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No files found</p>
          </div>
        ) : (
          displayFiles.map((file: any) => (
            <div 
              key={file.id} 
              data-testid={`card-drive-file-${file.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* File type icon from Google */}
                {file.iconLink && (
                  <img src={file.iconLink} alt="File type icon" className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="font-medium truncate max-w-[300px]">{file.name}</span>
              </div>
              {/* Open in Drive button */}
              {file.webViewLink && (
                <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <Button 
                    data-testid={`button-open-drive-${file.id}`} 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GMAIL PANEL COMPONENT
// ============================================================================

/**
 * GmailPanel - Gmail Email Client
 * 
 * Displays emails and allows composing new messages.
 * 
 * Features:
 * - List recent emails
 * - View email subject, sender, and snippet
 * - Compose and send new emails
 * - Refresh email list
 * 
 * API Endpoints Used:
 * - GET /api/gmail/messages - List emails
 * - POST /api/gmail/messages - Send email
 * 
 * @returns {JSX.Element} Gmail panel component
 */
function GmailPanel() {
  const { toast } = useToast();
  
  /**
   * Compose mode state
   * When true, shows compose form; when false, shows email list
   */
  const [composing, setComposing] = useState(false);
  
  /**
   * Email composition form state
   */
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  /**
   * Query: Fetch list of emails
   */
  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/gmail/messages'],
    queryFn: () => fetch('/api/gmail/messages').then(res => res.json()),
  });

  /**
   * Mutation: Send email
   * Posts new email to Gmail API
   */
  const sendMutation = useMutation({
    mutationFn: (data: { to: string; subject: string; body: string }) =>
      fetch('/api/gmail/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Email sent successfully!' });
      setComposing(false);
      // Reset form
      setTo('');
      setSubject('');
      setBody('');
      refetch();
    },
    onError: () => {
      toast({ title: 'Failed to send email', variant: 'destructive' });
    },
  });

  // Compose Form View
  if (composing) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-gmail-back" variant="outline" onClick={() => setComposing(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-gmail-to"
          placeholder="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <Input
          data-testid="input-gmail-subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          data-testid="textarea-gmail-body"
          placeholder="Message body..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
        />
        <Button
          data-testid="button-gmail-send"
          onClick={() => sendMutation.mutate({ to, subject, body })}
          disabled={!to || !subject || !body || sendMutation.isPending}
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send
        </Button>
      </div>
    );
  }

  // Email List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-gmail-compose" onClick={() => setComposing(true)}>
          <Plus className="h-4 w-4 mr-2" /> Compose
        </Button>
        <Button 
          data-testid="button-gmail-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Email Count Badge */}
      {emails.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{emails.length} emails</Badge>
        </div>
      )}
      
      {/* Email List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No emails found</p>
          </div>
        ) : (
          emails.map((email: any) => (
            <div 
              key={email.id} 
              data-testid={`card-gmail-email-${email.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium truncate">{email.subject || '(no subject)'}</div>
              <div className="text-sm text-muted-foreground truncate">{email.from}</div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{email.snippet}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GOOGLE CALENDAR PANEL COMPONENT
// ============================================================================

/**
 * CalendarPanel - Google Calendar Event Manager
 * 
 * Displays calendar events and allows creating new events.
 * 
 * Features:
 * - List upcoming events
 * - View event title and date/time
 * - Create new events with start/end times
 * - Refresh event list
 * 
 * API Endpoints Used:
 * - GET /api/calendar/events - List events
 * - POST /api/calendar/events - Create event
 * 
 * @returns {JSX.Element} Calendar panel component
 */
function CalendarPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  /**
   * Create mode state
   */
  const [creating, setCreating] = useState(false);
  
  /**
   * Event creation form state
   */
  const [summary, setSummary] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /**
   * Query: Fetch list of calendar events
   */
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/calendar/events'],
    queryFn: () => fetch('/api/calendar/events').then(res => res.json()),
  });

  /**
   * Mutation: Create calendar event
   */
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Event created!' });
      setCreating(false);
      // Reset form
      setSummary('');
      setStartDate('');
      setEndDate('');
      refetch();
    },
  });

  // Create Event Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-calendar-back" variant="outline" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-calendar-summary"
          placeholder="Event title"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <Input
          data-testid="input-calendar-start"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          data-testid="input-calendar-end"
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button
          data-testid="button-calendar-create"
          onClick={() => createMutation.mutate({
            summary,
            start: { dateTime: new Date(startDate).toISOString() },
            end: { dateTime: new Date(endDate).toISOString() },
          })}
          disabled={!summary || !startDate || !endDate || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Event
        </Button>
      </div>
    );
  }

  // Event List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-calendar-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Event
        </Button>
        <Button 
          data-testid="button-calendar-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Event Count Badge */}
      {events.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{events.length} events</Badge>
        </div>
      )}
      
      {/* Event List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming events</p>
          </div>
        ) : (
          events.map((event: any) => (
            <div 
              key={event.id} 
              data-testid={`card-calendar-event-${event.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium">{event.summary}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(event.start?.dateTime || event.start?.date).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GOOGLE DOCS PANEL COMPONENT
// ============================================================================

/**
 * DocsPanel - Google Docs Manager
 * 
 * Lists Google Docs and allows creating new documents.
 * 
 * Features:
 * - List recent Google Docs
 * - View document name and modification date
 * - Open documents in Google Docs web interface
 * - Create new documents
 * 
 * API Endpoints Used:
 * - GET /api/docs - List documents
 * - POST /api/docs - Create document
 * 
 * @returns {JSX.Element} Docs panel component
 */
function DocsPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  /**
   * Query: Fetch list of Google Docs
   */
  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/docs'],
    queryFn: () => fetch('/api/docs').then(res => res.json()),
  });

  /**
   * Mutation: Create new document
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Document created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  // Create Document Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-docs-back" variant="outline" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-docs-title"
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-docs-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Document
        </Button>
      </div>
    );
  }

  // Document List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-docs-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Document
        </Button>
        <Button 
          data-testid="button-docs-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Document Count Badge */}
      {docs.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{docs.length} documents</Badge>
        </div>
      )}
      
      {/* Document List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No documents found</p>
          </div>
        ) : (
          docs.map((doc: any) => (
            <div 
              key={doc.id} 
              data-testid={`card-docs-doc-${doc.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{doc.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(doc.modifiedTime).toLocaleDateString()}
                </div>
              </div>
              {/* Open in Docs button */}
              {doc.webViewLink && (
                <a href={doc.webViewLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <Button 
                    data-testid={`button-open-doc-${doc.id}`} 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GOOGLE SHEETS PANEL COMPONENT
// ============================================================================

/**
 * SheetsPanel - Google Sheets Manager
 * 
 * Lists Google Sheets and allows creating new spreadsheets.
 * 
 * Features:
 * - List recent Google Sheets
 * - View spreadsheet name and modification date
 * - Open spreadsheets in Google Sheets web interface
 * - Create new spreadsheets
 * 
 * API Endpoints Used:
 * - GET /api/sheets - List spreadsheets
 * - POST /api/sheets - Create spreadsheet
 * 
 * @returns {JSX.Element} Sheets panel component
 */
function SheetsPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  /**
   * Query: Fetch list of Google Sheets
   */
  const { data: sheets = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/sheets'],
    queryFn: () => fetch('/api/sheets').then(res => res.json()),
  });

  /**
   * Mutation: Create new spreadsheet
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Spreadsheet created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  // Create Spreadsheet Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-sheets-back" variant="outline" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-sheets-title"
          placeholder="Spreadsheet title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-sheets-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Spreadsheet
        </Button>
      </div>
    );
  }

  // Spreadsheet List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-sheets-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Spreadsheet
        </Button>
        <Button 
          data-testid="button-sheets-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Spreadsheet Count Badge */}
      {sheets.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{sheets.length} spreadsheets</Badge>
        </div>
      )}
      
      {/* Spreadsheet List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-8">
            <Table2 className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No spreadsheets found</p>
          </div>
        ) : (
          sheets.map((sheet: any) => (
            <div 
              key={sheet.id} 
              data-testid={`card-sheets-sheet-${sheet.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{sheet.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(sheet.modifiedTime).toLocaleDateString()}
                </div>
              </div>
              {/* Open in Sheets button */}
              {sheet.webViewLink && (
                <a href={sheet.webViewLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <Button 
                    data-testid={`button-open-sheet-${sheet.id}`} 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GOOGLE TASKS PANEL COMPONENT
// ============================================================================

/**
 * TasksPanel - Google Tasks Manager
 * 
 * Manages Google Tasks with task list support.
 * 
 * Features:
 * - List tasks from default task list
 * - View task title and completion status
 * - Mark tasks as completed
 * - Create new tasks
 * - Refresh task list
 * 
 * API Endpoints Used:
 * - GET /api/tasks/lists - List task lists
 * - GET /api/tasks/lists/:listId/tasks - List tasks
 * - POST /api/tasks/lists/:listId/tasks - Create task
 * - POST /api/tasks/lists/:listId/tasks/:taskId/complete - Complete task
 * 
 * @returns {JSX.Element} Tasks panel component
 */
function TasksPanel() {
  const { toast } = useToast();
  
  /**
   * Create mode and form state
   */
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  
  /**
   * Selected task list (defaults to @default)
   */
  const [selectedList, setSelectedList] = useState<string>('@default');

  /**
   * Query: Fetch list of task lists
   */
  const { data: taskLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['/api/tasks/lists'],
    queryFn: () => fetch('/api/tasks/lists').then(res => res.json()),
  });

  /**
   * Query: Fetch tasks from selected list
   */
  const { data: tasks = [], isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ['/api/tasks/lists', selectedList, 'tasks'],
    queryFn: () => fetch(`/api/tasks/lists/${selectedList}/tasks`).then(res => res.json()),
    enabled: !!selectedList,
  });

  /**
   * Mutation: Create new task
   */
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      fetch(`/api/tasks/lists/${selectedList}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Task created!' });
      setCreating(false);
      setTitle('');
      refetch();
    },
  });

  /**
   * Mutation: Mark task as completed
   */
  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      fetch(`/api/tasks/lists/${selectedList}/tasks/${taskId}/complete`, {
        method: 'POST',
      }).then(res => res.json()),
    onSuccess: () => refetch(),
  });

  // Create Task Form View
  if (creating) {
    return (
      <div className="space-y-4">
        <Button data-testid="button-tasks-back" variant="outline" onClick={() => setCreating(false)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Input
          data-testid="input-tasks-title"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          data-testid="button-tasks-create"
          onClick={() => createMutation.mutate(title)}
          disabled={!title || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Create Task
        </Button>
      </div>
    );
  }

  // Task List View
  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button data-testid="button-tasks-new" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Task
        </Button>
        <Button 
          data-testid="button-tasks-refresh" 
          variant="outline" 
          size="icon"
          onClick={() => refetch()}
          disabled={tasksLoading}
        >
          {tasksLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Task Count Badge */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{tasks.length} tasks</Badge>
        </div>
      )}
      
      {/* Task List */}
      <div className="space-y-2">
        {tasksLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          tasks.map((task: any) => (
            <div 
              key={task.id} 
              data-testid={`card-tasks-task-${task.id}`}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors flex items-center gap-3"
            >
              {/* Complete Task Button */}
              <Button
                data-testid={`button-complete-task-${task.id}`}
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => completeMutation.mutate(task.id)}
                disabled={task.status === 'completed'}
              >
                <CheckSquare 
                  className={cn(
                    "h-4 w-4",
                    task.status === 'completed' ? 'text-green-500' : ''
                  )} 
                />
              </Button>
              {/* Task Title (strikethrough if completed) */}
              <span 
                className={cn(
                  "flex-1",
                  task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                )}
              >
                {task.title}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function GoogleServicesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="google-services-page">
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
              <FolderOpen className="h-5 w-5 text-primary" />
              Google Workspace
            </h1>
            <p className="text-sm text-muted-foreground">
              Access your Google Workspace services • Drive, Gmail, Calendar, Docs, Sheets, Tasks
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tabs Navigation */}
        <Tabs defaultValue="drive" className="flex flex-col flex-1 min-h-0">
          <div className="border-b px-4 bg-card">
            <TabsList className="h-12">
              <TabsTrigger value="drive" className="flex items-center gap-2" data-testid="tab-drive">
                <FolderOpen className="h-4 w-4" />
                Drive
              </TabsTrigger>
              <TabsTrigger value="gmail" className="flex items-center gap-2" data-testid="tab-gmail">
                <Mail className="h-4 w-4" />
                Gmail
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
                <Calendar className="h-4 w-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-2" data-testid="tab-docs">
                <FileText className="h-4 w-4" />
                Docs
              </TabsTrigger>
              <TabsTrigger value="sheets" className="flex items-center gap-2" data-testid="tab-sheets">
                <Table2 className="h-4 w-4" />
                Sheets
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2" data-testid="tab-tasks">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="drive" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      Google Drive
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Browse and manage your files</p>
                    <DrivePanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="gmail" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Mail className="h-5 w-5 text-primary" />
                      Gmail
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Read and send emails</p>
                    <GmailPanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="calendar" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5 text-primary" />
                      Google Calendar
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">View and manage events</p>
                    <CalendarPanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="docs" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-primary" />
                      Google Docs
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Create and edit documents</p>
                    <DocsPanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sheets" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Table2 className="h-5 w-5 text-primary" />
                      Google Sheets
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Create and edit spreadsheets</p>
                    <SheetsPanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <div className="border border-border rounded-lg bg-muted/20 p-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <CheckSquare className="h-5 w-5 text-primary" />
                      Google Tasks
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Manage your tasks and to-do lists</p>
                    <TasksPanel />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
