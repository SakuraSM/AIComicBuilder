"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { Provider } from "@/stores/model-store";

interface ProviderCardProps {
  provider: Provider;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function ProviderCard({
  provider,
  selected,
  onSelect,
  onDelete,
}: ProviderCardProps) {
  const checkedCount = provider.models.filter((m) => m.checked).length;

  return (
    <div
      className={`group relative flex flex-shrink-0 items-center rounded-xl border text-left transition-all duration-200 ${
        selected
          ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/5"
          : "border-[--border-subtle] bg-white hover:border-[--border-hover] hover:shadow-sm"
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex items-center gap-2.5 rounded-xl py-2.5 pl-3.5 pr-9 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
            selected ? "bg-primary text-white" : "bg-primary/8 text-primary"
          }`}
        >
          {provider.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="max-w-[120px] truncate text-sm font-medium text-[--text-primary]">
            {provider.name}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[--text-muted]">
              {provider.protocol}
            </span>
            {checkedCount > 0 && (
              <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
                {checkedCount}
              </Badge>
            )}
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={`Delete ${provider.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-[--text-muted] opacity-60 outline-none transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive/30 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
