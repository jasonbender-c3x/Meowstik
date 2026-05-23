import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  FolderPlus,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type RepositoryAvailability = "ready" | "missing" | "error";
type RepositorySource = "workspace" | "tracked";

interface GitRemote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

interface GitBranchInfo {
  name: string;
  current: boolean;
  shortHash?: string;
  lastCommitAt?: string;
  upstream?: string | null;
  tracking?: string | null;
}

interface GitChangedFile {
  path: string;
  originalPath?: string;
  kind: "tracked" | "renamed" | "unmerged" | "untracked";
  statusCode: string;
  indexStatus: string;
  workTreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

interface GitCommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
}

interface GitRepositorySummary {
  id: string;
  name: string;
  path: string;
  source: RepositorySource;
  availability: RepositoryAvailability;
  isWorkspace: boolean;
  branchName: string | null;
  detachedHead: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  changedFilesCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  remoteCount: number;
  lastCommitAt?: string;
  lastCommitSubject?: string;
  error?: string;
}

interface GitRepositoryDetail extends GitRepositorySummary {
  remotes: GitRemote[];
  branches: GitBranchInfo[];
  changedFiles: GitChangedFile[];
  commits: GitCommitInfo[];
  workingTreeDiff: string;
  stagedDiff: string;
  workingTreeDiffTruncated: boolean;
  stagedDiffTruncated: boolean;
}

interface GitOverview {
  cwd: string;
  defaultCloneParent: string;
  repositories: GitRepositorySummary[];
  selectedRepoId: string | null;
  selectedRepo: GitRepositoryDetail | null;
}

type DialogMode = "add" | "clone" | "branch" | "commit" | null;

interface AddFormState {
  path: string;
}

interface CloneFormState {
  url: string;
  targetPath: string;
}

interface BranchFormState {
  branchName: string;
  startPoint: string;
}

interface CommitFormState {
  message: string;
}

const emptyAddForm: AddFormState = { path: "" };
const emptyCloneForm: CloneFormState = { url: "", targetPath: "" };
const emptyBranchForm: BranchFormState = { branchName: "", startPoint: "" };
const emptyCommitForm: CommitFormState = { message: "" };

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function availabilityVariant(value: RepositoryAvailability): "default" | "secondary" | "destructive" | "outline" {
  if (value === "ready") return "default";
  if (value === "missing") return "secondary";
  return "destructive";
}

function changedFileLabel(file: GitChangedFile): string {
  if (file.kind === "renamed" && file.originalPath) {
    return `${file.originalPath} -> ${file.path}`;
  }
  return file.path;
}

function guessCloneTargetPath(defaultCloneParent: string, url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  const lastSegment = trimmed
    .replace(/\/+$/, "")
    .split(/[/:]/)
    .pop()
    ?.replace(/\.git$/i, "")
    ?.trim();

  if (!lastSegment) {
    return "";
  }

  return `${defaultCloneParent}/${lastSegment}`;
}

export default function GitPage() {
  const [overview, setOverview] = useState<GitOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [branchSelection, setBranchSelection] = useState<string>("");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(emptyAddForm);
  const [cloneForm, setCloneForm] = useState<CloneFormState>(emptyCloneForm);
  const [branchForm, setBranchForm] = useState<BranchFormState>(emptyBranchForm);
  const [commitForm, setCommitForm] = useState<CommitFormState>(emptyCommitForm);

  const loadOverview = useCallback(
    async (repoIdOverride?: string | null) => {
      setLoading(true);

      try {
        const targetRepoId = repoIdOverride ?? selectedRepoId;
        const params = new URLSearchParams();
        if (targetRepoId) {
          params.set("repoId", targetRepoId);
        }

        const response = await fetch(`/api/git/overview${params.toString() ? `?${params.toString()}` : ""}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load Git overview");
        }

        const nextOverview = data as GitOverview;
        setOverview(nextOverview);
        setSelectedRepoId(nextOverview.selectedRepoId);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load Git overview");
      } finally {
        setLoading(false);
      }
    },
    [selectedRepoId]
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadOverview();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [loadOverview]);

  useEffect(() => {
    const currentBranch = overview?.selectedRepo?.branches.find((branch) => branch.current)?.name;
    setBranchSelection(currentBranch || "");
  }, [overview?.selectedRepo?.id, overview?.selectedRepo?.branches]);

  const selectedRepo = overview?.selectedRepo ?? null;
  const repoReady = selectedRepo?.availability === "ready";

  const action = async (key: string, work: () => Promise<void>) => {
    setPendingAction(key);
    setError(null);
    setSuccessMessage(null);
    try {
      await work();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Git action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const openAddDialog = () => {
    setAddForm({ path: overview?.cwd || "" });
    setDialogMode("add");
  };

  const openCloneDialog = () => {
    setCloneForm({
      url: "",
      targetPath: overview?.defaultCloneParent || "",
    });
    setDialogMode("clone");
  };

  const openBranchDialog = () => {
    setBranchForm({
      branchName: "",
      startPoint: selectedRepo?.branchName || "",
    });
    setDialogMode("branch");
  };

  const openCommitDialog = () => {
    setCommitForm(emptyCommitForm);
    setDialogMode("commit");
  };

  const submitAddRepository = async () => {
    await action("add", async () => {
      const response = await fetch("/api/git/repositories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add repository");
      }

      setDialogMode(null);
      setSuccessMessage("Added repository to Git management.");
      await loadOverview(data.id);
    });
  };

  const submitCloneRepository = async () => {
    await action("clone", async () => {
      const response = await fetch("/api/git/repositories/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to clone repository");
      }

      setDialogMode(null);
      setSuccessMessage("Cloned repository and added it to Git management.");
      await loadOverview(data.id);
    });
  };

  const checkoutBranch = async () => {
    if (!selectedRepo || !branchSelection) return;

    await action("checkout", async () => {
      const response = await fetch(`/api/git/repositories/${encodeURIComponent(selectedRepo.id)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchName: branchSelection, create: false }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to check out branch");
      }

      setSuccessMessage(data.message || "Checked out branch.");
      await loadOverview(selectedRepo.id);
    });
  };

  const submitCreateBranch = async () => {
    if (!selectedRepo) return;

    await action("create-branch", async () => {
      const response = await fetch(`/api/git/repositories/${encodeURIComponent(selectedRepo.id)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchName: branchForm.branchName,
          create: true,
          startPoint: branchForm.startPoint.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create branch");
      }

      setDialogMode(null);
      setSuccessMessage(data.message || "Created branch.");
      await loadOverview(selectedRepo.id);
    });
  };

  const submitCommit = async () => {
    if (!selectedRepo) return;

    await action("commit", async () => {
      const response = await fetch(`/api/git/repositories/${encodeURIComponent(selectedRepo.id)}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commitForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to commit changes");
      }

      setDialogMode(null);
      setSuccessMessage(data.message || "Commit complete.");
      await loadOverview(selectedRepo.id);
    });
  };

  const runRepoAction = async (endpoint: "pull" | "push") => {
    if (!selectedRepo) return;

    await action(endpoint, async () => {
      const response = await fetch(`/api/git/repositories/${encodeURIComponent(selectedRepo.id)}/${endpoint}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${endpoint} repository`);
      }

      setSuccessMessage(data.message || `Finished ${endpoint}.`);
      await loadOverview(selectedRepo.id);
    });
  };

  const removeTrackedRepository = async () => {
    if (!selectedRepo || selectedRepo.isWorkspace) return;

    await action("remove", async () => {
      const response = await fetch(`/api/git/repositories/${encodeURIComponent(selectedRepo.id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove repository");
      }

      setSuccessMessage("Removed repository from Git management.");
      await loadOverview(null);
    });
  };

  const branchOptions = useMemo(
    () => (selectedRepo?.branches || []).map((branch) => branch.name),
    [selectedRepo?.branches]
  );

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-git">
      <header className="border-b bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Git
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage local repositories, branches, commits, remotes, and diffs without dropping to the terminal first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/runtime">
              <Button variant="outline">Runtime</Button>
            </Link>
            <Button onClick={() => loadOverview()} variant="ghost" size="icon" data-testid="button-refresh-git">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full p-6">
          {error ? (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-6 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground">
              {successMessage}
            </div>
          ) : null}

          {loading && !overview ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Git overview…
            </div>
          ) : null}

          {overview ? (
            <div className="grid h-full gap-6 lg:grid-cols-[320px,1fr]">
              <Card className="overflow-hidden">
                <CardHeader className="space-y-4">
                  <div>
                    <CardTitle>Repositories</CardTitle>
                    <CardDescription>Tracked local repositories and the current workspace repo.</CardDescription>
                  </div>
                  <div className="grid gap-2">
                    <Button onClick={openAddDialog} variant="outline" disabled={pendingAction !== null}>
                      <FolderPlus className="h-4 w-4" />
                      <span className="ml-2">Add existing repo</span>
                    </Button>
                    <Button onClick={openCloneDialog} disabled={pendingAction !== null}>
                      <Plus className="h-4 w-4" />
                      <span className="ml-2">Clone repo</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-250px)]">
                    <div className="space-y-2 p-4">
                      {overview.repositories.length > 0 ? (
                        overview.repositories.map((repository) => (
                          <button
                            key={repository.id}
                            type="button"
                            onClick={() => {
                              setSelectedRepoId(repository.id);
                              void loadOverview(repository.id);
                            }}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              selectedRepoId === repository.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{repository.name}</div>
                              {repository.isWorkspace ? <Badge variant="secondary">workspace</Badge> : null}
                              <Badge variant={availabilityVariant(repository.availability)}>{repository.availability}</Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground break-all">{repository.path}</div>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{repository.branchName || (repository.detachedHead ? "detached HEAD" : "no branch")}</span>
                              <span>{repository.changedFilesCount} changed</span>
                              <span>{repository.remoteCount} remotes</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                          No Git repositories are being tracked yet.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {selectedRepo ? (
                  <>
                    <Card>
                      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <CardTitle>{selectedRepo.name}</CardTitle>
                          <CardDescription className="break-all">{selectedRepo.path}</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={availabilityVariant(selectedRepo.availability)}>{selectedRepo.availability}</Badge>
                          {selectedRepo.isWorkspace ? <Badge variant="secondary">workspace repo</Badge> : null}
                          {selectedRepo.upstream ? <Badge variant="outline">{selectedRepo.upstream}</Badge> : null}
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 lg:grid-cols-4">
                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">Branch</div>
                          <div className="mt-1 text-lg font-semibold">
                            {selectedRepo.branchName || (selectedRepo.detachedHead ? "Detached HEAD" : "—")}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Ahead {selectedRepo.ahead} • Behind {selectedRepo.behind}
                          </div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">Changes</div>
                          <div className="mt-1 text-lg font-semibold">{selectedRepo.changedFilesCount}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Staged {selectedRepo.stagedCount} • Unstaged {selectedRepo.unstagedCount} • Untracked {selectedRepo.untrackedCount}
                          </div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">Remotes</div>
                          <div className="mt-1 text-lg font-semibold">{selectedRepo.remoteCount}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Pull uses fast-forward only in this first slice.</div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">Last commit</div>
                          <div className="mt-1 text-sm font-medium">{selectedRepo.lastCommitSubject || "—"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(selectedRepo.lastCommitAt)}</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>Checkout, branch, commit, pull, and push the selected repository.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.2fr,auto,auto,auto,auto,auto]">
                          <div className="grid gap-2">
                            <Label htmlFor="git-branch-select">Branch</Label>
                            <Select value={branchSelection} onValueChange={setBranchSelection} disabled={!repoReady || branchOptions.length === 0 || pendingAction !== null}>
                              <SelectTrigger id="git-branch-select">
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                {branchOptions.map((branchName) => (
                                  <SelectItem key={branchName} value={branchName}>
                                    {branchName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={checkoutBranch} disabled={!repoReady || !branchSelection || pendingAction !== null} className="self-end">
                            {pendingAction === "checkout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                            <span className="ml-2">Checkout</span>
                          </Button>
                          <Button variant="outline" onClick={openBranchDialog} disabled={!repoReady || pendingAction !== null} className="self-end">
                            <Plus className="h-4 w-4" />
                            <span className="ml-2">New branch</span>
                          </Button>
                          <Button variant="outline" onClick={openCommitDialog} disabled={!repoReady || pendingAction !== null} className="self-end">
                            <GitCommitHorizontal className="h-4 w-4" />
                            <span className="ml-2">Commit all</span>
                          </Button>
                          <Button variant="outline" onClick={() => runRepoAction("pull")} disabled={!repoReady || pendingAction !== null} className="self-end">
                            {pendingAction === "pull" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />}
                            <span className="ml-2">Pull</span>
                          </Button>
                          <Button onClick={() => runRepoAction("push")} disabled={!repoReady || pendingAction !== null} className="self-end">
                            {pendingAction === "push" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                            <span className="ml-2">Push</span>
                          </Button>
                        </div>

                        {!selectedRepo.isWorkspace ? (
                          <div className="flex justify-end">
                            <Button variant="destructive" onClick={removeTrackedRepository} disabled={pendingAction !== null}>
                              {pendingAction === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              <span className="ml-2">Remove from Git page</span>
                            </Button>
                          </div>
                        ) : null}

                        {selectedRepo.error ? (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {selectedRepo.error}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle>Changed files</CardTitle>
                          <CardDescription>Working tree, staged, and untracked changes for the selected repository.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="py-2 pr-4 font-medium">Status</th>
                                  <th className="py-2 pr-4 font-medium">Path</th>
                                  <th className="py-2 pr-4 font-medium">Kind</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRepo.changedFiles.map((file) => (
                                  <tr key={`${file.kind}:${file.path}:${file.originalPath || ""}`} className="border-b last:border-0">
                                    <td className="py-2 pr-4 font-mono text-xs">{file.statusCode}</td>
                                    <td className="py-2 pr-4">
                                      <div className="break-all">{changedFileLabel(file)}</div>
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">{file.kind}</td>
                                  </tr>
                                ))}
                                {selectedRepo.changedFiles.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                                      No local changes.
                                    </td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Remotes</CardTitle>
                          <CardDescription>Fetch and push URLs for the selected repository.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedRepo.remotes.length > 0 ? (
                            selectedRepo.remotes.map((remote) => (
                              <div key={remote.name} className="rounded-lg border p-3">
                                <div className="font-medium">{remote.name}</div>
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  <div className="break-all">fetch: {remote.fetchUrl || "—"}</div>
                                  <div className="break-all">push: {remote.pushUrl || "—"}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                              No remotes configured.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Diff</CardTitle>
                        <CardDescription>Preview unstaged and staged patch output for the selected repository.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Tabs defaultValue="working">
                          <TabsList>
                            <TabsTrigger value="working">Working tree</TabsTrigger>
                            <TabsTrigger value="staged">Staged</TabsTrigger>
                          </TabsList>
                          <TabsContent value="working" className="mt-4">
                            {selectedRepo.workingTreeDiffTruncated ? (
                              <div className="mb-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                Working tree diff preview is truncated.
                              </div>
                            ) : null}
                            <pre className="max-h-[420px] overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5 whitespace-pre-wrap break-words">
                              {selectedRepo.workingTreeDiff || "No unstaged diff."}
                            </pre>
                          </TabsContent>
                          <TabsContent value="staged" className="mt-4">
                            {selectedRepo.stagedDiffTruncated ? (
                              <div className="mb-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                Staged diff preview is truncated.
                              </div>
                            ) : null}
                            <pre className="max-h-[420px] overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5 whitespace-pre-wrap break-words">
                              {selectedRepo.stagedDiff || "No staged diff."}
                            </pre>
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>

                    <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle>Branches</CardTitle>
                          <CardDescription>Local branches and their upstream tracking state.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="py-2 pr-4 font-medium">Branch</th>
                                  <th className="py-2 pr-4 font-medium">Upstream</th>
                                  <th className="py-2 pr-4 font-medium">Last commit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRepo.branches.map((branch) => (
                                  <tr key={branch.name} className="border-b last:border-0">
                                    <td className="py-2 pr-4">
                                      <div className="flex items-center gap-2">
                                        <span>{branch.name}</span>
                                        {branch.current ? <Badge variant="secondary">current</Badge> : null}
                                      </div>
                                      <div className="text-xs text-muted-foreground">{branch.shortHash || "—"}</div>
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">
                                      {branch.upstream || "—"}
                                      {branch.tracking ? <div className="text-xs">{branch.tracking}</div> : null}
                                    </td>
                                    <td className="py-2 pr-4 text-muted-foreground">{formatTimestamp(branch.lastCommitAt)}</td>
                                  </tr>
                                ))}
                                {selectedRepo.branches.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                                      No local branches found.
                                    </td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Recent commits</CardTitle>
                          <CardDescription>Latest commit history for the selected repository.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {selectedRepo.commits.length > 0 ? (
                              selectedRepo.commits.map((commit) => (
                                <div key={commit.hash} className="rounded-lg border p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{commit.subject}</span>
                                    <Badge variant="outline">{commit.shortHash}</Badge>
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {commit.authorName} • {formatTimestamp(commit.authoredAt)}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                                No commits found yet.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardContent className="px-6 py-12 text-sm text-muted-foreground">
                      Add or clone a repository to start managing it here.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <Dialog open={dialogMode === "add"} onOpenChange={(open) => setDialogMode(open ? "add" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add existing repository</DialogTitle>
            <DialogDescription>Track a local repository that already exists on disk.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="git-add-path">Repository path</Label>
              <Input
                id="git-add-path"
                value={addForm.path}
                onChange={(event) => setAddForm({ path: event.target.value })}
                placeholder={overview?.cwd || "/path/to/repo"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={submitAddRepository} disabled={pendingAction === "add"}>
              {pendingAction === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Add repo</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "clone"} onOpenChange={(open) => setDialogMode(open ? "clone" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone repository</DialogTitle>
            <DialogDescription>Clone a remote repository and add it to the Git page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="git-clone-url">Clone URL</Label>
              <Input
                id="git-clone-url"
                value={cloneForm.url}
                onChange={(event) =>
                  setCloneForm((current) => ({
                    url: event.target.value,
                    targetPath:
                      current.targetPath === "" || current.targetPath === overview?.defaultCloneParent || current.targetPath === guessCloneTargetPath(overview?.defaultCloneParent || "", current.url)
                        ? guessCloneTargetPath(overview?.defaultCloneParent || "", event.target.value)
                        : current.targetPath,
                  }))
                }
                placeholder="https://github.com/owner/repo.git"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="git-clone-target">Target path</Label>
              <Input
                id="git-clone-target"
                value={cloneForm.targetPath}
                onChange={(event) => setCloneForm((current) => ({ ...current, targetPath: event.target.value }))}
                placeholder={overview?.defaultCloneParent || "/path/to/projects/repo"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={submitCloneRepository} disabled={pendingAction === "clone"}>
              {pendingAction === "clone" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Clone repo</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "branch"} onOpenChange={(open) => setDialogMode(open ? "branch" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create branch</DialogTitle>
            <DialogDescription>Create a new branch and switch to it immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="git-branch-name">Branch name</Label>
              <Input
                id="git-branch-name"
                value={branchForm.branchName}
                onChange={(event) => setBranchForm((current) => ({ ...current, branchName: event.target.value }))}
                placeholder="feature/my-change"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="git-branch-start">Start point</Label>
              <Input
                id="git-branch-start"
                value={branchForm.startPoint}
                onChange={(event) => setBranchForm((current) => ({ ...current, startPoint: event.target.value }))}
                placeholder={selectedRepo?.branchName || "main"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={submitCreateBranch} disabled={pendingAction === "create-branch"}>
              {pendingAction === "create-branch" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Create branch</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMode === "commit"} onOpenChange={(open) => setDialogMode(open ? "commit" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit all changes</DialogTitle>
            <DialogDescription>This stages all current changes in the selected repository before committing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="git-commit-message">Commit message</Label>
              <Textarea
                id="git-commit-message"
                value={commitForm.message}
                onChange={(event) => setCommitForm({ message: event.target.value })}
                placeholder="Describe the changes in this commit"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>
              Cancel
            </Button>
            <Button onClick={submitCommit} disabled={pendingAction === "commit"}>
              {pendingAction === "commit" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Commit all changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
