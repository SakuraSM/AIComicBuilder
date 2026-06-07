"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoIcon } from "@/components/logo";

export default function LoginPage() {
  const locale = useLocale();
  const t = useTranslations("login");
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const requestedNext = searchParams.get("next");
    if (!requestedNext || requestedNext.includes("//")) return `/${locale}`;
    return requestedNext;
  }, [locale, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (!response.ok) {
        await response.json().catch(() => null);
        throw new Error(t("defaultError"));
      }
      window.location.assign(nextPath);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t("defaultError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[--surface] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[--border-subtle] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LogoIcon size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-[--text-primary]">
              AIComicBuilder
            </h1>
            <p className="text-sm text-[--text-muted]">{t("subtitle")}</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="login">{t("loginLabel")}</Label>
            <Input
              id="login"
              name="login"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
              required
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting || !login || !password}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {t("signIn")}
          </Button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-[--surface] p-3 text-xs text-[--text-muted]">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          {t("privateNotice")}
        </div>
      </div>
    </main>
  );
}
