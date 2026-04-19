import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Ban,
  CheckCircle2,
  Clock3,
  ListTodo,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
  priority: number;
  category: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TodoStats {
  total: number;
  pending: number;
  completed: number;
}

interface TodoResponse {
  success: boolean;
  data: TodoItem[];
}

const sections: Array<{ status: TodoItem["status"]; title: string; empty: string }> = [
  { status: "in_progress", title: "In progress", empty: "Nothing is actively in focus." },
  { status: "pending", title: "Pending", empty: "No pending items." },
  { status: "blocked", title: "Blocked", empty: "Nothing is blocked right now." },
  { status: "completed", title: "Completed", empty: "No completed items yet." },
];

const statusBadgeClass: Record<TodoItem["status"], string> = {
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  blocked: "bg-red-500/10 text-red-700 border-red-500/20",
  cancelled: "bg-gray-500/10 text-gray-700 border-gray-500/20",
};

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [stats, setStats] = useState<TodoStats>({ total: 0, pending: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    priority: 5,
    category: "",
    tags: "",
  });

  const loadTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (showCompleted) {
        params.set("includeCompleted", "true");
      }

      const response = await fetch(`/api/todos?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load to-do items");
      }

      const data: TodoResponse = await response.json();
      setTodos(data.data || []);
    } finally {
      setIsLoading(false);
    }
  }, [showCompleted]);

  const loadStats = useCallback(async () => {
    const response = await fetch("/api/todos/stats");
    if (!response.ok) {
      throw new Error("Failed to load to-do stats");
    }

    const data = await response.json();
    setStats(data.data);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadTodos(), loadStats()]);
  }, [loadStats, loadTodos]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const createTodo = async () => {
    const response = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTodo.title.trim(),
        description: newTodo.description.trim() || null,
        priority: newTodo.priority,
        category: newTodo.category.trim() || null,
        tags: newTodo.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create to-do");
    }

    setIsCreateOpen(false);
    setNewTodo({
      title: "",
      description: "",
      priority: 5,
      category: "",
      tags: "",
    });
    await loadAll();
  };

  const patchTodo = async (id: string, updates: Partial<TodoItem>) => {
    const response = await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error("Failed to update to-do");
    }

    await loadAll();
  };

  const completeTodo = async (id: string) => {
    const response = await fetch(`/api/todos/${id}/complete`, { method: "POST" });
    if (!response.ok) {
      throw new Error("Failed to complete to-do");
    }

    await loadAll();
  };

  const deleteTodo = async (id: string) => {
    const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("Failed to delete to-do");
    }

    await loadAll();
  };

  const moveTodo = async (id: string, direction: -1 | 1) => {
    const activeTodos = todos.filter((todo) => todo.status !== "completed" && todo.status !== "cancelled");
    const index = activeTodos.findIndex((todo) => todo.id === id);

    if (index === -1) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= activeTodos.length) {
      return;
    }

    const reordered = [...activeTodos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    const response = await fetch("/api/todos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: reordered.map((todo) => ({ id: todo.id })),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to reorder to-dos");
    }

    await loadAll();
  };

  const sectionedTodos = useMemo(() => {
    const grouped = new Map<TodoItem["status"], TodoItem[]>();
    for (const section of sections) {
      grouped.set(
        section.status,
        todos.filter((todo) => todo.status === section.status)
      );
    }
    return grouped;
  }, [todos]);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="todo-page">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              Focus To-Do List
            </h1>
            <p className="text-sm text-muted-foreground">
              These items are injected into Meowstik&apos;s prompt so it can keep you oriented.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/schedules">Schedules</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New item
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="grid gap-4 md:grid-cols-3 p-4">
          <div className="border border-border rounded-lg bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Total items</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="border border-border rounded-lg bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Active items</p>
            <p className="text-2xl font-semibold">{stats.pending}</p>
          </div>
          <div className="border border-border rounded-lg bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Completed items</p>
                <p className="text-2xl font-semibold">{stats.completed}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showCompleted} onCheckedChange={setShowCompleted} />
                <span className="text-sm text-muted-foreground">Show completed</span>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {sections
              .filter((section) => showCompleted || section.status !== "completed")
              .map((section) => {
                const items = sectionedTodos.get(section.status) || [];

                return (
                  <section key={section.status} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </h2>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>

                    {items.length === 0 ? (
                      <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground">
                        {section.empty}
                      </div>
                    ) : (
                      items.map((todo) => (
                        <div key={todo.id} className="border border-border rounded-lg bg-muted/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium">{todo.title}</h3>
                                <Badge className={statusBadgeClass[todo.status]}>{todo.status.replace("_", " ")}</Badge>
                                <Badge variant="outline">P{todo.priority}</Badge>
                                {todo.category && <Badge variant="secondary">{todo.category}</Badge>}
                              </div>

                              {todo.description && (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{todo.description}</p>
                              )}

                              {todo.tags && todo.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {todo.tags.map((tag) => (
                                    <Badge key={tag} variant="outline">#{tag}</Badge>
                                  ))}
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                                <span className="flex items-center gap-1">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  Updated {new Date(todo.updatedAt).toLocaleString()}
                                </span>
                                {todo.completedAt && (
                                  <span>Completed {new Date(todo.completedAt).toLocaleString()}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {todo.status !== "in_progress" && todo.status !== "completed" && (
                                <Button variant="outline" size="sm" onClick={() => void patchTodo(todo.id, { status: "in_progress" })}>
                                  <Play className="h-4 w-4 mr-1" />
                                  Start
                                </Button>
                              )}
                              {todo.status !== "blocked" && todo.status !== "completed" && (
                                <Button variant="outline" size="sm" onClick={() => void patchTodo(todo.id, { status: "blocked" })}>
                                  <Ban className="h-4 w-4 mr-1" />
                                  Block
                                </Button>
                              )}
                              {todo.status !== "pending" && todo.status !== "completed" && (
                                <Button variant="outline" size="sm" onClick={() => void patchTodo(todo.id, { status: "pending" })}>
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Reset
                                </Button>
                              )}
                              {todo.status !== "completed" && (
                                <Button size="sm" onClick={() => void completeTodo(todo.id)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                              {todo.status !== "completed" && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => void moveTodo(todo.id, -1)}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => void moveTodo(todo.id, 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => void deleteTodo(todo.id)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                );
              })}
          </div>
        </ScrollArea>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create focus item</DialogTitle>
            <DialogDescription>
              This becomes part of Meowstik&apos;s ongoing context, so keep it concrete and actionable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="todo-title">Title</Label>
              <Input
                id="todo-title"
                value={newTodo.title}
                onChange={(event) => setNewTodo((current) => ({ ...current, title: event.target.value }))}
                placeholder="Finish reorganizing desk"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="todo-description">Description</Label>
              <Textarea
                id="todo-description"
                value={newTodo.description}
                onChange={(event) => setNewTodo((current) => ({ ...current, description: event.target.value }))}
                placeholder="Break it into small steps so Meowstik can help keep me moving."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="todo-priority">Priority</Label>
                <Input
                  id="todo-priority"
                  type="number"
                  min={0}
                  max={10}
                  value={newTodo.priority}
                  onChange={(event) => setNewTodo((current) => ({ ...current, priority: Number(event.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="todo-category">Category</Label>
                <Input
                  id="todo-category"
                  value={newTodo.category}
                  onChange={(event) => setNewTodo((current) => ({ ...current, category: event.target.value }))}
                  placeholder="life, admin, health"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="todo-tags">Tags</Label>
              <Input
                id="todo-tags"
                value={newTodo.tags}
                onChange={(event) => setNewTodo((current) => ({ ...current, tags: event.target.value }))}
                placeholder="focus, home, quick-win"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void createTodo()} disabled={!newTodo.title.trim()}>
              Create item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
