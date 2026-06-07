import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/project-card";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Clapperboard, FolderKanban, Sparkles, Video } from "lucide-react";
import { getCurrentUserFromCookies } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const user = await getCurrentUserFromCookies();
  if (!user) redirect("/login");

  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt));

  const completedCount = allProjects.filter((project) => project.status === "completed").length;
  const processingCount = allProjects.filter((project) => project.status === "processing").length;

  return (
    <div className="animate-page-in space-y-6">
      {/* Page header — same pattern as detail pages */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Clapperboard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[--text-primary]">
              {t("title")}
            </h2>
            <p className="text-xs text-[--text-muted]">
              {user.username} · {allProjects.length}{" "}
              {allProjects.length === 1 ? "project" : "projects"}
            </p>
          </div>
        </div>
        <CreateProjectDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <FolderKanban className="h-4 w-4 text-primary" />
            Projects
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{allProjects.length}</div>
        </div>
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <Sparkles className="h-4 w-4 text-[--warning]" />
            Processing
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{processingCount}</div>
        </div>
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <Video className="h-4 w-4 text-[--success]" />
            Completed
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{completedCount}</div>
        </div>
      </div>

      {allProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[--border-subtle] bg-[--surface]/50 py-24">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10">
            <Clapperboard className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-display text-lg font-semibold text-[--text-primary]">
            {t("title")}
          </h3>
          <p className="mt-2 max-w-sm text-center text-sm text-[--text-secondary]">
            {t("noProjects")}
          </p>
          <div className="mt-6">
            <CreateProjectDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allProjects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              status={project.status}
              createdAt={project.createdAt.toISOString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
