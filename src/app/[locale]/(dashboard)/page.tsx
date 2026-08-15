import { db } from "@/lib/db";
import { generationRuns, projects } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ProjectCard } from "@/components/project-card";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ArrowRight, Clapperboard, FolderKanban, Sparkles, Video } from "lucide-react";
import { getCurrentUserFromCookies } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");
  const user = await getCurrentUserFromCookies();
  if (!user) redirect("/login");

  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt));

  const recentRuns = await db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.userId, user.id))
    .orderBy(desc(generationRuns.createdAt));
  const latestRunByProject = new Map<string, (typeof recentRuns)[number]>();
  for (const run of recentRuns) {
    if (!latestRunByProject.has(run.projectId)) latestRunByProject.set(run.projectId, run);
  }

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
              {t("projectCount", { count: allProjects.length })}
            </p>
          </div>
        </div>
        <CreateProjectDialog />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <FolderKanban className="h-4 w-4 text-primary" />
            {t("statsProjects")}
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{allProjects.length}</div>
        </div>
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <Sparkles className="h-4 w-4 text-[--warning]" />
            {t("statsProcessing")}
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{processingCount}</div>
        </div>
        <div className="rounded-xl border border-[--border-subtle] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
            <Video className="h-4 w-4 text-[--success]" />
            {t("statsCompleted")}
          </div>
          <div className="mt-2 text-2xl font-semibold text-[--text-primary]">{completedCount}</div>
        </div>
      </div>

      {allProjects.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-white to-primary/[0.06] p-5 shadow-sm sm:p-6">
          <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                {t("continueCreating")}
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold text-[--text-primary]">
                {allProjects[0].title}
              </h3>
              <p className="mt-1 text-sm text-[--text-secondary]">
                {latestRunByProject.get(allProjects[0].id)
                  ? t("continueRun", {
                      stage: latestRunByProject.get(allProjects[0].id)?.currentStage ?? "generation",
                      progress: latestRunByProject.get(allProjects[0].id)?.progress ?? 0,
                    })
                  : t("continueProject")}
              </p>
            </div>
            <Link
              href={`/${locale}/project/${allProjects[0].id}/episodes`}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 sm:self-auto"
            >
              {t("continueAction")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

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
              activeRun={latestRunByProject.get(project.id) ? {
                stage: latestRunByProject.get(project.id)?.currentStage ?? "generation",
                progress: latestRunByProject.get(project.id)?.progress ?? 0,
                status: latestRunByProject.get(project.id)?.status ?? "pending",
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
