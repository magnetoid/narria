import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { getChapter } from "@/lib/db/repositories/chapters";
import { getSessionUser } from "@/lib/auth/session";
import { continueChapter } from "@/lib/ai/agents/chapterWriter";
import { isRateLimitError } from "@/lib/errors";
import { continueBody } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};
const INTERRUPTED_NOTICE = "\n\n[Sorry — generation was interrupted.]";

/**
 * The one endpoint that reaches a paid model over plain HTTP, so every gate below —
 * body, session, ownership, rate limit — must answer before `new Response(stream)`:
 * once a ReadableStream is handed back the status is already committed and no check
 * after that point is a check.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }
  const parsed = continueBody.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request body.", { status: 400 });
  }
  const { bookId, chapterId, currentText } = parsed.data;

  // Demo mode always resolves a user, so this only turns anyone away in real-auth
  // mode — where an open endpoint would let a stranger spend the API budget.
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to continue writing.", { status: 401 });

  // Both repositories filter by owner, so another user's book is indistinguishable
  // from a missing one. 404 rather than 403: the status itself must not confirm that
  // the id exists.
  const [book, chapter] = await Promise.all([
    getBook(bookId, user.id),
    getChapter(chapterId, user.id),
  ]);
  if (!book || !chapter) return new Response("Not found", { status: 404 });
  const brain = await getBrain(bookId, user.id);

  const iterator = continueChapter(book, brain, chapter, currentText)[Symbol.asyncIterator]();

  // The facade meters the call and takes the stream slot on the first pull, so pull
  // once here, while a status code can still be chosen.
  let first: IteratorResult<string>;
  try {
    first = await iterator.next();
  } catch (e) {
    if (isRateLimitError(e)) {
      return new Response(e.message, {
        status: 429,
        headers: { ...STREAM_HEADERS, "Retry-After": String(e.retryAfterSeconds) },
      });
    }
    // Not the mid-stream case: nothing was generated and the status is still ours to
    // choose, so say so. A 200 carrying an apology tells the client that nothing is
    // wrong, and it would also dress up whatever the facade refused *before*
    // generating — a misconfiguration that getSessionUser() throws to refuse service
    // loudly must not arrive as a polite notice in the prose.
    console.error("ai/continue first chunk", e);
    return new Response("Generation failed. Please try again.", {
      status: 500,
      headers: STREAM_HEADERS,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let step = first; !step.done; step = await iterator.next()) {
          controller.enqueue(encoder.encode(step.value));
        }
        controller.close();
      } catch (e) {
        // The status is committed by now, so the notice in the body is all the reader
        // can be told — but the operator must still learn what died, or a dead API key
        // and a client hanging up read identically during an incident.
        console.error("ai/continue mid-stream", e);
        // Leaving the generator suspended strands the facade's stream slot — its
        // `finally` only runs when the generator completes or is returned — and the
        // user is locked out of streaming until the process restarts.
        await iterator.return?.(undefined);
        try {
          controller.enqueue(encoder.encode(INTERRUPTED_NOTICE));
          controller.close();
        } catch {
          // The consumer is already gone (which is what threw above); there is
          // nobody left to hand the notice to.
        }
      }
    },
    async cancel() {
      // A client that disconnects mid-stream must not keep its slot either.
      await iterator.return?.(undefined);
    },
  });

  return new Response(stream, { headers: STREAM_HEADERS });
}
