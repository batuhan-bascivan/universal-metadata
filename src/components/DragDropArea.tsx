import { useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DragDropAreaProps {
  onFilesAdded: (files: File[]) => void;
  label?: string;
}

const DragDropArea: React.FC<DragDropAreaProps> = ({
  onFilesAdded,
  label = "Drag & Drop your file here",
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles);
      }
    },
    [onFilesAdded]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles);
      }
      e.target.value = "";
    },
    [onFilesAdded]
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer",
        "border-border hover:border-primary",
        isDragging && "border-primary bg-accent scale-[1.01]"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <UploadCloud
        className={cn(
          "w-12 h-12 mb-4 transition-colors duration-300",
          isDragging ? "text-primary" : "text-muted-foreground"
        )}
      />
      <p className="text-lg font-semibold text-foreground mb-2">{label}</p>
      <p className="text-muted-foreground mb-4 text-sm">Supports any file type</p>
      <label
        htmlFor="file-upload-metadata"
        className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Browse Files
      </label>
      <Input
        id="file-upload-metadata"
        type="file"
        multiple={true}
        accept="*/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default DragDropArea;
