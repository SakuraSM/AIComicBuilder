"use client";

import { useRef } from "react";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FreeCreationImageInputProps {
  id: string;
  label: string;
  hint: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  required?: boolean;
  orderLabel?: string;
}

export function FreeCreationImageInput({
  id,
  label,
  hint,
  files,
  onFilesChange,
  multiple = false,
  maxFiles = 1,
  required = false,
  orderLabel = "Image",
}: FreeCreationImageInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const selectedFiles = Array.from(event.target.files ?? []);
    const nextFiles = multiple
      ? [...files, ...selectedFiles].slice(0, maxFiles)
      : selectedFiles.slice(0, 1);
    onFilesChange(nextFiles);
    event.target.value = "";
  }

  function removeFile(fileIndex: number): void {
    onFilesChange(files.filter((_, index) => index !== fileIndex));
  }

  function moveFile(fileIndex: number, direction: -1 | 1): void {
    const targetIndex = fileIndex + direction;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    const nextFiles = [...files];
    [nextFiles[fileIndex], nextFiles[targetIndex]] = [
      nextFiles[targetIndex],
      nextFiles[fileIndex],
    ];
    onFilesChange(nextFiles);
  }

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor={id}
          className="text-sm font-semibold text-[--text-primary]"
        >
          {label}
          {required ? <span className="ml-1 text-primary">*</span> : null}
        </label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-[--text-muted]">
          {hint}
        </p>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        required={required && files.length === 0}
        aria-describedby={`${id}-hint`}
        onChange={handleFileChange}
        className="sr-only"
      />
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => inputRef.current?.click()}
        disabled={files.length >= maxFiles}
      >
        <ImagePlus className="h-4 w-4" />
        {files.length === 0 ? label : `${files.length}/${maxFiles}`}
      </Button>
      {files.length > 0 ? (
        <ul className="space-y-1.5" aria-label={label}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center gap-2 rounded-lg bg-[--surface] px-2.5 py-2 text-xs text-[--text-secondary]"
            >
              <span className="shrink-0 font-semibold text-primary">
                {orderLabel} {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              {multiple ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${orderLabel} ${index + 1}: move up`}
                    disabled={index === 0}
                    onClick={() => moveFile(index, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${orderLabel} ${index + 1}: move down`}
                    disabled={index === files.length - 1}
                    onClick={() => moveFile(index, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${label}: remove ${file.name}`}
                onClick={() => removeFile(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
