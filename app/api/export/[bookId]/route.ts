import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { getBook } from "@/lib/db/repositories/books";
import { listChapters } from "@/lib/db/repositories/chapters";
import { getSessionUser } from "@/lib/auth/session";
import { htmlToText } from "@/lib/utils";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const parsedId = idSchema.safeParse(bookId);
  if (!parsedId.success) return new Response("Invalid book id.", { status: 400 });
  // idSchema trims — use the parsed id everywhere so the read matches the stored key.
  const id = parsedId.data;

  // Demo mode always resolves a user, so this only turns anyone away in real-auth mode.
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to export your book.", { status: 401 });

  // getBook filters by owner, so another author's manuscript reads as missing. 404
  // rather than 403: the status itself must not confirm that the id exists.
  const book = await getBook(id, user.id);
  if (!book) return new Response("Not found", { status: 404 });

  const chapters = await listChapters(id, user.id);

  const children: Paragraph[] = [
    new Paragraph({
      text: book.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 240 },
    }),
  ];
  if (book.subtitle) {
    children.push(
      new Paragraph({ text: book.subtitle, alignment: AlignmentType.CENTER }),
    );
  }

  for (const ch of chapters) {
    children.push(
      new Paragraph({
        text: ch.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 200 },
      }),
    );
    const paras = htmlToText(ch.content || "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (paras.length === 0) {
      children.push(new Paragraph({ text: "" }));
    }
    for (const p of paras) {
      children.push(
        new Paragraph({ children: [new TextRun(p)], spacing: { after: 160 } }),
      );
    }
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);
  const slug =
    book.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "book";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slug}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
