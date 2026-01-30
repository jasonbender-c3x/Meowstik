import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Database, 
  Table2, 
  RefreshCw, 
  Loader2, 
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Save,
  FileText,
  Hash,
  Calendar,
  Link as LinkIcon,
  AlertCircle,
  Check,
  Search,
  Download,
  Upload,
  Tag,
  Copy,
  ExternalLink,
  FileJson,
  FileCode,
  Terminal
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface TableInfo {
  name: string;
  rowCount: number;
  columns: string[];
}

interface TableData {
  rows: Record<string, unknown>[];
  total: number;
}

interface RecordViewerProps {
  record: Record<string, unknown>;
  tableName: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function isUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return value.startsWith("http://") || value.startsWith("https://");
  } catch {
    return false;
  }
}

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isHash(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // Detect common hash formats (SHA-1, SHA-256, MD5, etc.)
  // Typically 32+ hex characters
  return /^[0-9a-f]{32,}$/i.test(value);
}

function CellValue({ value, columnName, recordId }: { value: unknown; columnName: string; recordId: string }) {
  const [expanded, setExpanded] = useState(false);

  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);

  if (isUrl(value)) {
    return (
      <a 
        href={strValue} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1 max-w-xs truncate"
        onClick={(e) => e.stopPropagation()}
        data-testid={`link-${columnName}-${recordId}`}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{strValue}</span>
      </a>
    );
  }

  if (isUuid(value)) {
    return (
      <code 
        className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-primary cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        title={expanded ? "Click to collapse" : "Click to expand"}
      >
        {expanded ? strValue : `${strValue.slice(0, 5)}...`}
      </code>
    );
  }

  if (isHash(value)) {
    return (
      <code 
        className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-primary cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        title={expanded ? "Click to collapse" : "Click to expand"}
      >
        {expanded ? strValue : `${strValue.slice(0, 5)}...`}
      </code>
    );
  }

  if (columnName.toLowerCase().includes("at") && !isNaN(Date.parse(strValue))) {
    return (
      <span className="text-sm">
        {new Date(strValue).toLocaleString()}
      </span>
    );
  }

  if (typeof value === "object") {
    const isTruncated = strValue.length > 50;
    return (
      <code 
        className={cn(
          "text-xs bg-muted px-1.5 py-0.5 rounded font-mono max-w-xs block",
          isTruncated && "cursor-pointer hover:bg-muted/80 transition-colors"
        )}
        onClick={(e) => {
          if (isTruncated) {
            e.stopPropagation();
            setExpanded(!expanded);
          }
        }}
        title={isTruncated ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
      >
        {expanded ? strValue : `${strValue.slice(0, 50)}${isTruncated ? "..." : ""}`}
      </code>
    );
  }

  const isTruncated = strValue.length > 100;
  const displayValue = isTruncated && !expanded ? strValue.slice(0, 100) + "..." : strValue;
  return (
    <span 
      className={cn(
        "max-w-xs block",
        isTruncated && "cursor-pointer hover:underline",
        !expanded && "truncate"
      )}
      onClick={(e) => {
        if (isTruncated) {
          e.stopPropagation();
          setExpanded(!expanded);
        }
      }}
      title={isTruncated ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
    >
      {displayValue}
    </span>
  );
}

function RecordViewer({ record, tableName, onClose, onEdit, onDelete }: RecordViewerProps) {
  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Record Details
        </DialogTitle>
        <DialogDescription>
          {tableName} • ID: {String(record.id || "N/A")}
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {Object.entries(record).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {key === "id" && <Hash className="h-3 w-3" />}
                {key.includes("At") && <Calendar className="h-3 w-3" />}
                {key.includes("url") && <LinkIcon className="h-3 w-3" />}
                {key}
              </label>
              <div className="bg-muted/50 rounded-md p-3 font-mono text-sm break-all">
                {value === null ? (
                  <span className="text-muted-foreground italic">null</span>
                ) : isUrl(value) ? (
                  <a 
                    href={String(value)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {String(value)}
                  </a>
                ) : typeof value === "object" ? (
                  <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  String(value)
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <DialogFooter className="gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} data-testid="button-record-close">
          Close
        </Button>
        <Button variant="outline" onClick={onEdit} data-testid="button-record-edit">
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button variant="destructive" onClick={onDelete} data-testid="button-record-delete">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface RecordEditorProps {
  record: Record<string, unknown>;
  tableName: string;
  onClose: () => void;
  onSave: (updatedRecord: Record<string, unknown>) => Promise<void>;
}

function RecordEditor({ record, tableName, onClose, onSave }: RecordEditorProps) {
  const [editedRecord, setEditedRecord] = useState<Record<string, unknown>>(record);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = (key: string, value: string) => {
    let parsedValue: unknown = value;
    try {
      if (value.startsWith("{") || value.startsWith("[")) {
        parsedValue = JSON.parse(value);
      }
    } catch {
      parsedValue = value;
    }
    setEditedRecord({ ...editedRecord, [key]: parsedValue });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(editedRecord);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const readOnlyFields = ["id", "createdAt", "updatedAt", "created_at", "updated_at"];

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit className="h-5 w-5 text-primary" />
          Edit Record
        </DialogTitle>
        <DialogDescription>
          {tableName} • ID: {String(record.id || "N/A")}
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {Object.entries(editedRecord).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                {key}
                {readOnlyFields.includes(key) && (
                  <Badge variant="secondary" className="text-xs">read-only</Badge>
                )}
              </label>
              {readOnlyFields.includes(key) ? (
                <div className="bg-muted/50 rounded-md p-3 font-mono text-sm text-muted-foreground">
                  {String(value)}
                </div>
              ) : typeof value === "object" && value !== null ? (
                <Textarea
                  value={JSON.stringify(value, null, 2)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                  data-testid={`input-field-${key}`}
                />
              ) : (
                <Input
                  value={value === null ? "" : String(value)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  placeholder={value === null ? "null" : undefined}
                  data-testid={`input-field-${key}`}
                />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <DialogFooter className="gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-record">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function DatabaseExplorerPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(25);

  const [viewingRecord, setViewingRecord] = useState<Record<string, unknown> | null>(null);
  const [editingRecord, setEditingRecord] = useState<Record<string, unknown> | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Record<string, unknown> | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Import/Export state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeSchema: true,
    includeData: true,
    format: "sql" as "sql" | "sql.gz"
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/debug/database");
      const data = await response.json();
      setTables(data);
    } catch (error) {
      console.error("Failed to load tables:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTableData = useCallback(async (tableName: string, pageNum: number) => {
    setIsLoadingData(true);
    try {
      const response = await fetch(
        `/api/debug/database/${tableName}?limit=${pageSize}&offset=${pageNum * pageSize}`
      );
      const data = await response.json();
      setTableData(data);
    } catch (error) {
      console.error("Failed to load table data:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable.name, page);
      setSelectedRows(new Set());
    }
  }, [selectedTable, page, loadTableData]);

  const handleSelectTable = (table: TableInfo) => {
    setSelectedTable(table);
    setPage(0);
    setTableData(null);
    setSearchQuery("");
    setSelectedRows(new Set());
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord || !selectedTable) return;

    try {
      const response = await fetch(`/api/debug/database/${selectedTable.name}/${deletingRecord.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete record");
      }

      setDeleteSuccess(true);
      setTimeout(() => {
        setDeletingRecord(null);
        setDeleteSuccess(false);
        loadTableData(selectedTable.name, page);
        loadTables();
      }, 1000);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTable || selectedRows.size === 0) return;
    
    const confirmed = window.confirm(`Delete ${selectedRows.size} selected records? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const ids = Array.from(selectedRows);
      for (const id of ids) {
        await fetch(`/api/debug/database/${selectedTable.name}/${id}`, {
          method: "DELETE"
        });
      }
      setSelectedRows(new Set());
      loadTableData(selectedTable.name, page);
      loadTables();
    } catch (error) {
      console.error("Bulk delete failed:", error);
    }
  };

  const handleSaveRecord = async (updatedRecord: Record<string, unknown>) => {
    if (!selectedTable) return;

    const response = await fetch(`/api/debug/database/${selectedTable.name}/${updatedRecord.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedRecord)
    });

    if (!response.ok) {
      throw new Error("Failed to update record");
    }

    loadTableData(selectedTable.name, page);
  };

  const filteredRows = useMemo(() => {
    if (!tableData || !searchQuery.trim()) return tableData?.rows || [];
    const query = searchQuery.toLowerCase();
    return tableData.rows.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [tableData, searchQuery]);

  const toggleRowSelection = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleSelectAll = () => {
    if (filteredRows.length === 0) return;
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.map(r => String(r.id))));
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/database/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportOptions)
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meowstik-export-${Date.now()}.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportDialog(false);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      // Note: For now, this is a placeholder since multer isn't installed
      // In production, you'd need to upload the file to the server first
      // For demo purposes, we'll show an informational message
      
      setImportError("File upload requires multer middleware. To use import:\n1. Install multer: npm install multer @types/multer\n2. Update server/routes/database-admin.ts to handle file uploads\n3. Or use CLI: npm run db:import -- --file=path/to/file.sql");
      
      // Uncomment this when multer is installed:
      // const formData = new FormData();
      // formData.append("file", importFile);
      // const response = await fetch("/api/database/import", {
      //   method: "POST",
      //   body: formData
      // });
      // if (!response.ok) {
      //   const data = await response.json();
      //   throw new Error(data.message || "Import failed");
      // }
      // setImportSuccess(true);
      
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportSchema = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/database/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeSchema: true,
          includeData: false,
          format: "sql"
        })
      });

      if (!response.ok) {
        throw new Error("Schema export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meowstik-schema-${Date.now()}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Schema export failed:", error);
      alert("Schema export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="database-explorer-page">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database Explorer
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your PostgreSQL database • Export, import, and browse tables
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
              data-testid="button-import"
              className="hidden sm:flex"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSchema}
              disabled={isExporting}
              title="Export schema only (no data)"
              data-testid="button-export-schema"
              className="hidden md:flex"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 mr-2" />
              )}
              Schema
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTables}
              disabled={isLoading}
              data-testid="button-refresh-tables"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r bg-muted/20 p-4 flex-shrink-0 overflow-auto">
          <div className="mb-4">
            <h2 className="font-semibold mb-1 text-sm text-muted-foreground uppercase tracking-wider">
              Tables
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              {tables.length} {tables.length === 1 ? 'table' : 'tables'} • Click to browse
            </p>
          </div>
          <div className="space-y-1">
            {tables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No tables found</p>
              </div>
            ) : (
              tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => handleSelectTable(table)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between group",
                    selectedTable?.name === table.name
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  data-testid={`button-table-${table.name}`}
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <Table2 className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{table.name}</span>
                  </span>
                  <Badge
                    variant={selectedTable?.name === table.name ? "secondary" : "outline"}
                    className="text-xs ml-2 flex-shrink-0"
                  >
                    {table.rowCount.toLocaleString()}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedTable ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-semibold mb-2">Select a Table</h2>
                <p className="text-muted-foreground mb-6">
                  Choose a table from the sidebar to view and manage its records
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Quick Actions
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <Download className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span><strong>Export:</strong> Download your database as SQL file</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <FileCode className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span><strong>Schema:</strong> Export table structures only</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Upload className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span><strong>Import:</strong> Restore from backup file</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b bg-card px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-primary" />
                    {selectedTable.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tableData?.total || selectedTable.rowCount} records
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                      data-testid="input-search"
                    />
                  </div>
                </div>
              </div>

              {selectedRows.size > 0 && (
                <div className="bg-primary/10 border-b px-4 py-2 flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm font-medium">
                    {selectedRows.size} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="text-destructive hover:text-destructive"
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Coming soon"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="Coming soon"
                    >
                      <Tag className="h-4 w-4 mr-1" />
                      Tag
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRows(new Set())}
                    className="ml-auto"
                  >
                    Clear selection
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {isLoadingData ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "No matching records" : "No records found"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-max">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="border-b px-4 py-3 text-left w-10 sticky left-0 bg-muted/50 z-20">
                            <Checkbox
                              checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                              onCheckedChange={toggleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </th>
                          {selectedTable.columns.map((col) => (
                            <th
                              key={col}
                              className="border-b px-4 py-3 text-left text-sm font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                          <th className="border-b px-4 py-3 text-right text-sm font-medium text-muted-foreground w-24 sticky right-0 bg-muted/50 z-20">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, index) => (
                          <tr
                            key={String(row.id) || index}
                            className={cn(
                              "hover:bg-muted/30 transition-colors cursor-pointer",
                              selectedRows.has(String(row.id)) && "bg-primary/5"
                            )}
                            onClick={() => setViewingRecord(row)}
                            data-testid={`row-${row.id}`}
                          >
                            <td className="border-b px-4 py-3 sticky left-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedRows.has(String(row.id))}
                                onCheckedChange={() => toggleRowSelection(String(row.id))}
                                data-testid={`checkbox-${row.id}`}
                              />
                            </td>
                            {selectedTable.columns.map((col) => (
                              <td
                                key={col}
                                className="border-b px-4 py-3 text-sm"
                              >
                                <CellValue value={row[col]} columnName={col} recordId={String(row.id)} />
                              </td>
                            ))}
                            <td className="border-b px-4 py-3 sticky right-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setViewingRecord(row)}
                                  data-testid={`button-view-${row.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setEditingRecord(row)}
                                  data-testid={`button-edit-${row.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingRecord(row)}
                                  data-testid={`button-delete-${row.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="border-t bg-card px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages} • Showing {page * pageSize + 1}-
                    {Math.min((page + 1) * pageSize, tableData?.total || 0)} of {tableData?.total}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      data-testid="button-page-first"
                    >
                      <ChevronFirst className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      data-testid="button-page-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 text-sm font-medium">{page + 1}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      data-testid="button-page-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      data-testid="button-page-last"
                    >
                      <ChevronLast className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        {viewingRecord && selectedTable && (
          <RecordViewer
            record={viewingRecord}
            tableName={selectedTable.name}
            onClose={() => setViewingRecord(null)}
            onEdit={() => {
              setEditingRecord(viewingRecord);
              setViewingRecord(null);
            }}
            onDelete={() => {
              setDeletingRecord(viewingRecord);
              setViewingRecord(null);
            }}
          />
        )}
      </Dialog>

      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        {editingRecord && selectedTable && (
          <RecordEditor
            record={editingRecord}
            tableName={selectedTable.name}
            onClose={() => setEditingRecord(null)}
            onSave={handleSaveRecord}
          />
        )}
      </Dialog>

      <Dialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-md p-3 mt-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Table:</span>{" "}
              <span className="font-medium">{selectedTable?.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Record ID:</span>{" "}
              <span className="font-mono">{String(deletingRecord?.id)}</span>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeletingRecord(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRecord}
              data-testid="button-confirm-delete"
            >
              {deleteSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Deleted
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Database
            </DialogTitle>
            <DialogDescription>
              Export your database schema and/or data to a SQL file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-schema"
                checked={exportOptions.includeSchema}
                onCheckedChange={(checked) => 
                  setExportOptions({ ...exportOptions, includeSchema: !!checked })
                }
                data-testid="checkbox-export-schema"
              />
              <Label htmlFor="include-schema" className="text-sm font-medium cursor-pointer">
                Include Schema (CREATE TABLE statements)
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-data"
                checked={exportOptions.includeData}
                onCheckedChange={(checked) => 
                  setExportOptions({ ...exportOptions, includeData: !!checked })
                }
                data-testid="checkbox-export-data"
              />
              <Label htmlFor="include-data" className="text-sm font-medium cursor-pointer">
                Include Data (INSERT statements)
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Format</Label>
              <Tabs
                value={exportOptions.format}
                onValueChange={(value) => 
                  setExportOptions({ ...exportOptions, format: value as "sql" | "sql.gz" })
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sql" data-testid="tab-format-sql">
                    <FileText className="h-4 w-4 mr-2" />
                    SQL
                  </TabsTrigger>
                  <TabsTrigger value="sql.gz" data-testid="tab-format-gz">
                    <FileJson className="h-4 w-4 mr-2" />
                    SQL.GZ (Compressed)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {!exportOptions.includeSchema && !exportOptions.includeData && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 flex items-start gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Please select at least one option (Schema or Data) to export.
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || (!exportOptions.includeSchema && !exportOptions.includeData)}
              data-testid="button-confirm-export"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import Database
            </DialogTitle>
            <DialogDescription>
              Import a SQL file to restore or migrate your database
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
              <p className="font-medium mb-2 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Terminal className="h-4 w-4" />
                Recommended: Use CLI
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                For best results, use the command line interface:
              </p>
              <div className="bg-[#1e1e1e] rounded-md p-3 font-mono text-xs text-[#d4d4d4] overflow-x-auto">
                <div className="mb-2">
                  <span className="text-[#9cdcfe]">npm run</span> db:import -- \<br/>
                  <span className="ml-4">--file=</span><span className="text-[#ce9178]">path/to/backup.sql</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-file" className="text-sm font-medium">
                Or Select SQL File (Web Upload - Requires Multer)
              </Label>
              <Input
                id="import-file"
                type="file"
                accept=".sql,.sql.gz,.gz"
                ref={fileInputRef}
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportError(null);
                }}
                data-testid="input-import-file"
                disabled={isImporting}
              />
              {importFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {importSuccess && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Import completed successfully!
                </span>
              </div>
            )}

            {importError && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-amber-600 dark:text-amber-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm space-y-2">
                    <p className="font-medium">Web upload not configured</p>
                    <p className="text-xs">Use the CLI command above for reliable imports.</p>
                    <p className="text-xs">To enable web uploads, install multer: <code className="bg-[#1e1e1e] px-1 py-0.5 rounded">npm install multer @types/multer</code></p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted/50 border rounded-md p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">⚠️ Important Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>This will import data into the current database</li>
                <li>Existing data may be preserved (uses ON CONFLICT handling)</li>
                <li>Large files may take several minutes</li>
                <li>Always backup before importing</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
                setImportError(null);
                setImportSuccess(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              disabled={isImporting}
            >
              Close
            </Button>
            <Button
              onClick={handleImport}
              disabled={isImporting || !importFile || importSuccess}
              data-testid="button-confirm-import"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Try Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
