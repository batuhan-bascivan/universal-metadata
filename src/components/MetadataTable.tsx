import { useState, useMemo } from "react";
import { Pencil, X, Check, Search, RotateCcw, Lock, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MetadataTableProps {
  metadata: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
  onClearAll: () => void;
  originalMetadata: Record<string, string>;
}

const READONLY_TAGS = new Set([
  "FileSize", "FileModifyDate", "FileAccessDate", "FileCreateDate",
  "FileInodeChangeDate", "FilePermissions", "FileType", "FileTypeExtension",
  "MIMEType", "ImageWidth", "ImageHeight", "ImageSize", "Megapixels",
  "EncodingProcess", "BitsPerSample", "ColorComponents", "YCbCrSubSampling",
  "Directory", "FileName",
]);

interface RowProps {
  tagKey: string;
  value: string;
  originalValue: string;
  isReadonly: boolean;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
}

const MetadataRow: React.FC<RowProps> = ({
  tagKey, value, originalValue, isReadonly, onChange, onReset,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const isDirty = value !== originalValue;

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const handleSave = () => {
    onChange(tagKey, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(160px,220px)_1fr_auto] gap-3 items-center px-4 py-2.5 rounded-lg transition-colors duration-150 group",
        isDirty
          ? "bg-primary/10 hover:bg-primary/15"
          : "hover:bg-muted/60"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {isReadonly && (
          <Lock className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
        )}
        <span
          className={cn(
            "text-xs font-mono font-medium truncate",
            isDirty ? "text-primary" : "text-muted-foreground"
          )}
          title={tagKey}
        >
          {tagKey}
        </span>
        {isDirty && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-none h-4 flex-shrink-0 bg-primary/20 text-primary border-0">
            edited
          </Badge>
        )}
      </div>
      <div className="min-w-0">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-mono py-0"
          />
        ) : (
          <span
            className="text-sm text-foreground truncate block"
            title={value}
          >
            {value || <span className="text-muted-foreground italic">—</span>}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {editing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
              onClick={handleSave}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCancel}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            {isDirty && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onReset(tagKey)}
                title="Reset to original"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {!isReadonly && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEdit}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const MetadataTable: React.FC<MetadataTableProps> = ({
  metadata,
  onChange,
  onReset,
  onClearAll,
  originalMetadata,
}) => {
  const [search, setSearch] = useState("");
  const [showReadonly, setShowReadonly] = useState(false);

  const entries = useMemo(() => {
    return Object.entries(metadata)
      .filter(([key]) => {
        const matchesSearch =
          search === "" ||
          key.toLowerCase().includes(search.toLowerCase()) ||
          metadata[key].toLowerCase().includes(search.toLowerCase());
        const matchesFilter = showReadonly || !READONLY_TAGS.has(key);
        return matchesSearch && matchesFilter;
      })
      .sort(([a], [b]) => {
        const aDirty = metadata[a] !== originalMetadata[a];
        const bDirty = metadata[b] !== originalMetadata[b];
        if (aDirty !== bDirty) return aDirty ? -1 : 1;
        return a.localeCompare(b);
      });
  }, [metadata, originalMetadata, search, showReadonly]);

  const dirtyCount = useMemo(
    () => Object.keys(metadata).filter((k) => metadata[k] !== originalMetadata[k]).length,
    [metadata, originalMetadata]
  );

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tags or values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button
          variant={showReadonly ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs whitespace-nowrap"
          onClick={() => setShowReadonly((v) => !v)}
        >
          <Lock className="h-3 w-3 mr-1" />
          {showReadonly ? "Hide" : "Show"} read-only
        </Button>
        {dirtyCount > 0 && (
          <Badge className="bg-primary text-primary-foreground text-xs">
            {dirtyCount} modified
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs whitespace-nowrap text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={onClearAll}
          title="Clear all tag values"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear all
        </Button>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[minmax(160px,220px)_1fr_auto] gap-3 px-4 py-2 bg-muted/50 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tag</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value</span>
          <span className="w-16" />
        </div>
        <ScrollArea className="h-[360px]">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              {search ? "No tags match your search." : "No editable tags found."}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {entries.map(([key, value]) => (
                <MetadataRow
                  key={key}
                  tagKey={key}
                  value={value}
                  originalValue={originalMetadata[key] ?? value}
                  isReadonly={READONLY_TAGS.has(key)}
                  onChange={onChange}
                  onReset={onReset}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        {entries.length} tag{entries.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
};

export default MetadataTable;
