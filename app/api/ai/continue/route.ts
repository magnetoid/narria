import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { getChapter } from "@/lib/db/repositories/chapters";
import { continueChapter } from "@/lib/ai/agents/chapterWriter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { bookId, chapterId, currentText } = (await req.json()) as {
    bookId: string;
    chapterId: string;
    currentText: string;
  };

  const [book, chapter] = await Promise.all([getBook(bookId), getChapter(chapterId)]);
  if (!book || !chapter) {
    return new Response("Not found", { status: 404 });
  }
  const brain = await getBrain(bookId);

  const encoder = new TextEncoder();
  const iterator = continueChapter(book, brain, chapter, currentText ?? "");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of iterator) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[Sorry — generation was interrupted.]"));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
