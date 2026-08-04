import { useMemo } from "react";
import {
  FileText, Image, Music, Video, Archive, FileCode,
  File, FileSpreadsheet, Presentation,
} from "lucide-react";

interface FilePreviewProps {
  fileName: string;
  fileSize: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const images = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "tiff", "ico", "heic", "heif"];
  const videos = ["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "3gp"];
  const audio  = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus", "alac"];
  const code   = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "cpp", "c", "java", "html", "css", "json", "xml", "yaml", "toml"];
  const archive = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"];
  const docs    = ["doc", "docx", "odt", "rtf"];
  const sheets  = ["xls", "xlsx", "csv", "ods"];
  const slides  = ["ppt", "pptx", "odp"];

  if (images.includes(ext))  return { icon: Image,         color: "text-purple-400" };
  if (videos.includes(ext))  return { icon: Video,         color: "text-blue-400" };
  if (audio.includes(ext))   return { icon: Music,         color: "text-green-400" };
  if (code.includes(ext))    return { icon: FileCode,      color: "text-yellow-400" };
  if (archive.includes(ext)) return { icon: Archive,       color: "text-orange-400" };
  if (docs.includes(ext))    return { icon: FileText,      color: "text-sky-400" };
  if (sheets.includes(ext))  return { icon: FileSpreadsheet, color: "text-emerald-400" };
  if (slides.includes(ext))  return { icon: Presentation,  color: "text-pink-400" };
  if (ext === "pdf")         return { icon: FileText,      color: "text-red-400" };
  return { icon: File, color: "text-muted-foreground" };
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileName, fileSize }) => {
  const { icon: Icon, color } = useMemo(() => getFileIcon(fileName), [fileName]);
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card animate-fade-in">
      <div className={`flex-shrink-0 p-3 rounded-lg bg-muted ${color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-medium text-primary">{ext}</span>
          {" · "}
          {formatSize(fileSize)}
        </p>
      </div>
    </div>
  );
};

export default FilePreview;
