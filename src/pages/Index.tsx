import { useState, useCallback } from "react";
import { FolderOpen, Save, X, RotateCcw, FileSearch, Plus, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import DragDropArea from "@/components/DragDropArea";
import FilePreview from "@/components/FilePreview";
import MetadataTable from "@/components/MetadataTable";
import { ModeToggle } from "@/components/mode-toggle";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    electron: {
      readMetadata: (filePath: string) => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>;
      writeMetadata: (filePath: string, outputDir: string, metadata: Record<string, string>) => Promise<{ success: boolean; path?: string; error?: string }>;
      showInFolder: (filePath: string) => Promise<void>;
      getFilePath: (file: File) => string;
      selectDirectory: () => Promise<string | null>;
    };
  }
}

type FileStatus = "loading" | "ready" | "saving" | "saved" | "error";

interface LoadedFile {
  id: string;
  file: File;
  filePath: string;
  status: FileStatus;
  metadata: Record<string, string>;
  originalMetadata: Record<string, string>;
  savedPath?: string;
  progress: number;
}

const STATUS_ICONS: Record<FileStatus, React.ReactNode> = {
  loading:  <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  ready:    <FileText className="w-4 h-4 text-muted-foreground" />,
  saving:   <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  saved:    <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error:    <AlertCircle className="w-4 h-4 text-destructive" />,
};

const Index = () => {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destinationFolder, setDestinationFolder] = useState<string | null>(null);
  const [showDrop, setShowDrop] = useState(false);

  const selectedFile = files.find((f) => f.id === selectedId) ?? null;

  // ── helpers ───────────────────────────────────────────────────────────────
  const updateFile = useCallback((id: string, patch: Partial<LoadedFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  // ── Load files ────────────────────────────────────────────────────────────
  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    setShowDrop(false);

    const entries: LoadedFile[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      filePath: "",
      status: "loading",
      metadata: {},
      originalMetadata: {},
      progress: 0,
    }));

    setFiles((prev) => {
      const merged = [...prev, ...entries];
      // Auto-select the first new file if nothing selected
      if (!selectedId) {
        setTimeout(() => setSelectedId(entries[0].id), 0);
      }
      return merged;
    });

    // Load metadata for each file
    for (const entry of entries) {
      const path = window.electron?.getFilePath(entry.file);
      if (!path) {
        updateFile(entry.id, { status: "error", progress: 0 });
        toast.error(`Cannot get path for ${entry.file.name}`);
        continue;
      }

      updateFile(entry.id, { filePath: path, progress: 30 });

      try {
        const result = await window.electron.readMetadata(path);
        if (!result.success || !result.data) {
          updateFile(entry.id, { status: "error", progress: 0 });
          toast.error(`Failed to read: ${entry.file.name}`);
        } else {
          updateFile(entry.id, {
            status: "ready",
            metadata: result.data,
            originalMetadata: result.data,
            progress: 100,
          });
        }
      } catch (err: unknown) {
        updateFile(entry.id, { status: "error", progress: 0 });
        toast.error(`Error: ${entry.file.name}`);
      }
    }

    if (entries.length > 0) {
      toast.success(`${entries.length} file${entries.length > 1 ? "s" : ""} loaded.`);
    }
  }, [selectedId, updateFile]);

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleMetadataChange = useCallback((key: string, value: string) => {
    if (!selectedId) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedId
          ? { ...f, metadata: { ...f.metadata, [key]: value } }
          : f
      )
    );
  }, [selectedId]);

  const handleMetadataReset = useCallback((key: string) => {
    if (!selectedId) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedId
          ? { ...f, metadata: { ...f.metadata, [key]: f.originalMetadata[key] } }
          : f
      )
    );
  }, [selectedId]);

  const handleResetAll = useCallback(() => {
    if (!selectedId) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedId ? { ...f, metadata: f.originalMetadata } : f
      )
    );
    toast.info("All tags reset.");
  }, [selectedId]);

  const handleClearAll = useCallback(() => {
    if (!selectedId) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== selectedId) return f;
        const cleared: Record<string, string> = {};
        Object.keys(f.metadata).forEach((k) => (cleared[k] = ""));
        return { ...f, metadata: cleared };
      })
    );
  }, [selectedId]);

  // ── Remove a file from the list ───────────────────────────────────────────
  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
  }, [selectedId]);

  // ── Select destination ────────────────────────────────────────────────────
  const handleSelectDestination = useCallback(async () => {
    if (window.electron?.selectDirectory) {
      const path = await window.electron.selectDirectory();
      if (path) {
        setDestinationFolder(path);
        toast.success(`Destination: ${path}`);
      }
    } else {
      toast.error("Directory selection is not supported in this environment.");
    }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedFile || !selectedFile.filePath) return;

    if (!destinationFolder) {
      toast.error("Please select a destination folder first.");
      return;
    }

    const dirtyKeys = Object.keys(selectedFile.metadata).filter(
      (k) => selectedFile.metadata[k] !== selectedFile.originalMetadata[k]
    );

    if (dirtyKeys.length === 0) {
      toast.info("No changes to save.");
      return;
    }

    updateFile(selectedFile.id, { status: "saving", progress: 30 });

    try {
      const result = await window.electron.writeMetadata(
        selectedFile.filePath,
        destinationFolder,
        selectedFile.metadata
      );

      if (!result.success) {
        updateFile(selectedFile.id, { status: "ready", progress: 0 });
        toast.error(`Save failed: ${result.error}`);
        return;
      }

      updateFile(selectedFile.id, { status: "saved", progress: 100, savedPath: result.path });
      toast.success(`Saved with ${dirtyKeys.length} change${dirtyKeys.length > 1 ? "s" : ""}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateFile(selectedFile.id, { status: "ready", progress: 0 });
      toast.error(`Save error: ${msg}`);
    }
  }, [selectedFile, destinationFolder, updateFile]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const dirtyCount = selectedFile
    ? Object.keys(selectedFile.metadata).filter(
        (k) => selectedFile.metadata[k] !== selectedFile.originalMetadata[k]
      ).length
    : 0;

  const isLoading = selectedFile?.status === "loading" || selectedFile?.status === "saving";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 md:p-10 relative" style={{ justifyContent: files.length === 0 ? 'center' : 'flex-start', paddingBottom: files.length === 0 ? '30vh' : undefined }}>
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={handleSelectDestination} className="rounded-lg">
              <FolderOpen className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">Select Destination Folder</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{destinationFolder ? `Destination: ${destinationFolder}` : "Select Destination Folder"}</p>
          </TooltipContent>
        </Tooltip>
        <ModeToggle />
      </div>

        <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="text-center pt-2">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">Universal Metadata</h1>
          <p className="text-lg text-muted-foreground">Drop any file, edit its metadata, save a copy.</p>
        </header>

        {/* Empty state */}
        {files.length === 0 && !showDrop && (
          <DragDropArea onFilesAdded={handleFilesAdded} label="Drag & Drop files here" />
        )}

        {/* Add more files overlay */}
        {showDrop && (
          <div className="relative">
            <DragDropArea onFilesAdded={handleFilesAdded} label="Drop more files here" />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 text-muted-foreground"
              onClick={() => setShowDrop(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main layout: file list + editor */}
        {files.length > 0 && !showDrop && (
          <div className="grid grid-cols-[260px_1fr] gap-4 items-start">

            {/* ── Left: file list ──────────────────────────────────────── */}
            <div className="flex flex-col gap-2 -ml-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Files ({files.length})
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowDrop(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add more files</p></TooltipContent>
                </Tooltip>
              </div>

              <ScrollArea className="h-[calc(100vh-260px)] pr-1">
                <div className="flex flex-col gap-1.5">
                  {files.map((f) => {
                    const isSelected = f.id === selectedId;
                    const dirty = Object.keys(f.metadata).filter(
                      (k) => f.metadata[k] !== f.originalMetadata[k]
                    ).length;

                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        className={cn(
                          "group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-150",
                          isSelected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40 hover:bg-muted/60"
                        )}
                      >
                        <div className="flex-shrink-0">{STATUS_ICONS[f.status]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-foreground">{f.file.name}</p>
                          {dirty > 0 && (
                            <p className="text-[10px] text-primary mt-0.5">{dirty} modified</p>
                          )}
                          {f.status === "saved" && (
                            <p className="text-[10px] text-green-500 mt-0.5">Saved ✓</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(f.id); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* ── Right: editor ────────────────────────────────────────── */}
            <div className="flex flex-col gap-4">
              {selectedFile ? (
                <>
                  {/* File preview + actions */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <FilePreview fileName={selectedFile.file.name} fileSize={selectedFile.file.size} />
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {dirtyCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={handleResetAll} disabled={isLoading}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Reset all changes</p></TooltipContent>
                        </Tooltip>
                      )}
                      {selectedFile.status === "saved" && selectedFile.savedPath && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => window.electron.showInFolder(selectedFile.savedPath!)}>
                              <FileSearch className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Show output in folder</p></TooltipContent>
                        </Tooltip>
                      )}
                      <Button onClick={handleSave} disabled={isLoading || selectedFile.status === "loading"} className="gap-2">
                        <Save className="h-4 w-4" />
                        {selectedFile.status === "saving"
                          ? "Saving…"
                          : dirtyCount > 0
                            ? `Save ${dirtyCount} change${dirtyCount > 1 ? "s" : ""}`
                            : "Save copy"}
                      </Button>
                    </div>
                  </div>

                  {isLoading && <Progress value={selectedFile.progress} className="h-1" />}

                  {!destinationFolder && (
                    <p className="text-xs text-amber-500">
                      ⚠️ No destination folder — click the folder icon (top-right) to choose one.
                    </p>
                  )}

                  <Separator />

                  {selectedFile.status !== "loading" && Object.keys(selectedFile.metadata).length > 0 && (
                    <MetadataTable
                      metadata={selectedFile.metadata}
                      originalMetadata={selectedFile.originalMetadata}
                      onChange={handleMetadataChange}
                      onReset={handleMetadataReset}
                      onClearAll={handleClearAll}
                    />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  Select a file on the left to edit its metadata.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
