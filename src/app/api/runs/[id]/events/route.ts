import { getGenerationRun } from "@/lib/generation-runs";
import { getCurrentUserFromRequest } from "@/lib/auth/session";

const EVENT_INTERVAL_MS = 1_000;
const textEncoder = new TextEncoder();

function toServerSentEvent(event: string, payload: unknown): Uint8Array {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const initialRun = await getGenerationRun({ id, userId: user.id });
  if (!initialRun) return new Response("Not found", { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastPayload = "";
      let isClosed = false;
      let interval: ReturnType<typeof setInterval> | null = null;
      const closeStream = () => {
        if (isClosed) return;
        isClosed = true;
        if (interval) clearInterval(interval);
        controller.close();
      };
      const pushState = async () => {
        try {
          const run = await getGenerationRun({ id, userId: user.id });
          if (!run) {
            controller.enqueue(toServerSentEvent("not-found", { id }));
            closeStream();
            return;
          }
          const payload = JSON.stringify(run);
          if (payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(toServerSentEvent("run", run));
          }
          if (["completed", "failed", "cancelled"].includes(run.summary.status)) {
            closeStream();
          }
        } catch (error) {
          controller.enqueue(
            toServerSentEvent("error", {
              message: error instanceof Error ? error.message : "Run stream failed",
            }),
          );
          closeStream();
        }
      };

      interval = setInterval(() => void pushState(), EVENT_INTERVAL_MS);
      void pushState();
      request.signal.addEventListener("abort", () => {
        try {
          closeStream();
        } catch {
          // The stream may already be closed by a terminal run state.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
