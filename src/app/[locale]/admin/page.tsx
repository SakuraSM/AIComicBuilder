"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, RefreshCcw, Shield, UserCog } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api-fetch";

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  projectCount: number;
}

const EMPTY_FORM = {
  email: "",
  username: "",
  password: "",
  role: "user" as "user" | "admin",
};

export default function AdminPage() {
  const locale = useLocale();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/users");
      const rows = (await response.json()) as AdminUserRow[];
      setUsers(rows);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError("");
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(EMPTY_FORM);
      await loadUsers();
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateUser(id: string, patch: Partial<Pick<AdminUserRow, "role" | "status">>) {
    await apiFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadUsers();
  }

  async function resetPassword(id: string) {
    const password = window.prompt("New password (at least 8 characters)");
    if (!password) return;
    await apiFetch(`/api/admin/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  }

  return (
    <main className="min-h-screen bg-[--surface]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[--border-subtle] bg-white/85 px-4 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--text-muted] transition-colors hover:bg-[--surface] hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <h1 className="font-display text-sm font-semibold text-[--text-primary]">Admin</h1>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={loadUsers}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 lg:grid-cols-[360px_1fr] lg:p-6">
        <form onSubmit={handleCreate} className="h-fit rounded-xl border border-[--border-subtle] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-[--text-primary]">Create user</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input id="new-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value as "user" | "admin" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={isCreating}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </form>

        <section className="rounded-xl border border-[--border-subtle] bg-white">
          <div className="flex items-center justify-between border-b border-[--border-subtle] p-4">
            <h2 className="font-display text-sm font-semibold text-[--text-primary]">Users</h2>
            <span className="text-xs text-[--text-muted]">{users.length} accounts</span>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-[--text-muted]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-[--border-subtle]">
              {users.map((user) => (
                <div key={user.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[--text-primary]">{user.username}</span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                      <Badge variant={user.status === "active" ? "success" : "destructive"}>{user.status}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-[--text-muted]">
                      {user.email} · {user.projectCount} projects
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="xs" onClick={() => updateUser(user.id, { role: user.role === "admin" ? "user" : "admin" })}>
                      Toggle role
                    </Button>
                    <Button type="button" variant="outline" size="xs" onClick={() => updateUser(user.id, { status: user.status === "active" ? "disabled" : "active" })}>
                      {user.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button type="button" variant="ghost" size="xs" onClick={() => resetPassword(user.id)}>
                      Reset password
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
