"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { GalleryHorizontalEnd, ImageIcon, Images, Type } from "lucide-react";
import { FREE_CREATION_MODE, type FreeCreationMode } from "@/lib/free-creation";
import { cn } from "@/lib/utils";

interface ModeOption {
  value: FreeCreationMode;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

const MODE_OPTIONS: ModeOption[] = [
  { value: FREE_CREATION_MODE.TEXT, labelKey: "freeModeText", descriptionKey: "freeModeTextHint", icon: Type },
  { value: FREE_CREATION_MODE.FIRST_FRAME, labelKey: "freeModeFirstFrame", descriptionKey: "freeModeFirstFrameHint", icon: ImageIcon },
  { value: FREE_CREATION_MODE.FIRST_LAST_FRAME, labelKey: "freeModeFirstLastFrame", descriptionKey: "freeModeFirstLastFrameHint", icon: GalleryHorizontalEnd },
  { value: FREE_CREATION_MODE.REFERENCE, labelKey: "freeModeReference", descriptionKey: "freeModeReferenceHint", icon: Images },
];

export function FreeCreationModeSelector({
  mode,
  onSelect,
}: {
  mode: FreeCreationMode;
  onSelect: (mode: FreeCreationMode) => void;
}) {
  const t = useTranslations("studio");
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-[--text-primary]">
        {t("freeInputMode")}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.value)}
              className={cn(
                "rounded-xl border p-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/30",
                isSelected
                  ? "border-primary/35 bg-primary/5 shadow-sm"
                  : "border-[--border-subtle] bg-white hover:border-[--border-hover] hover:bg-[--surface]",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-[--text-primary]">
                <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-[--text-muted]")} />
                {t(option.labelKey)}
              </span>
              <span className="mt-1.5 block text-xs leading-5 text-[--text-muted]">
                {t(option.descriptionKey)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
