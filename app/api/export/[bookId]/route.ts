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
import { htmlToText } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const book = await getBook(bookId);
  if (!book) return new Response("Not found", { status: 404 });

  const chapters = await listChapters(bookId);

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
