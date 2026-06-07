"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

interface UserMenuProps {
  username: string;
  role: "user" | "admin";
}

export function UserMenu({ username, role }: UserMenuProps) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const commonT = useTranslations("common");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.assign(`/${locale}/login`);
    } finally {
      setIsLoggingOut(false);
    }
  }, [locale]);

  return (
    <div className="flex items-center gap-2">
      {role === "admin" && (
        <Link
          href={`/${locale}/admin`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          title={t("title")}
        >
          <Shield className="h-4 w-4" />
        </Link>
      )}
      <div className="hidden min-w-0 text-right sm:block">
        <div className="truncate text-xs font-medium text-[--text-primary]">{username}</div>
        <div className="text-[10px] text-[--text-muted]">
          {role === "admin" ? t("adminRole") : t("userRole")}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
        title={commonT("logout")}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
