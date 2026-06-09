"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { updateChapterAction } from "@/lib/actions/chapters";
import { cn } from "@/lib/utils";

export interface ChapterEditorHandle {
  getHTML: () => string;
  getText: () => string;
  getSelectedText: () => string;
  replaceSelection: (text: string) => void;
  appendParagraphs: (text: string) => void;
  beginStream: () => void;
  streamChunk: (chunk: string) => void;
  endStream: () => void;
  focusEnd: () => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toParagraphsHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export const ChapterEditor = forwardRef<
  ChapterEditorHandle,
  {
    chapterId: string;
    initialContent: string;
    onChange?: () => void;
  }
>(function ChapterEditor({ chapterId, initialContent, onChange }, ref) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingFirst = useRef(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing this chapter — or let Narria continue for you…",
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: { class: "manuscript focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      onChange?.();
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const html = editor.getHTML();
        void updateChapterAction(chapterId, {
          content: html,
          status: editor.getText().trim() ? "drafting" : "planned",
        });
      }, 1000);
    },
  });

  useImperativeHandle(
    ref,
    (): ChapterEditorHandle => ({
      getHTML: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      getSelectedText: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, "\n");
      },
      replaceSelection: (text) => {
        if (!editor) return;
        const html = toParagraphsHtml(text);
        const { empty } = editor.state.selection;
        const chain = editor.chain().focus();
        if (!empty) chain.deleteSelection();
        chain.insertContent(html).run();
      },
      appendParagraphs: (text) => {
        editor?.chain().focus("end").insertContent(toParagraphsHtml(text)).run();
      },
      beginStream: () => {
        streamingFirst.current = true;
        editor?.chain().focus("end").run();
      },
      streamChunk: (chunk) => {
        if (!editor) return;
        const clean = chunk.replace(/\s+/g, " ");
        if (streamingFirst.current) {
          const trimmed = chunk.replace(/^\s+/, "");
          if (!trimmed) return;
          editor.chain().focus("end").insertContent(`<p>${escapeHtml(trimmed.replace(/\s+/g, " "))}</p>`).run();
          streamingFirst.current = false;
        } else {
          editor.chain().focus("end").insertContent(escapeHtml(clean)).run();
        }
      },
      endStream: () => {
        streamingFirst.current = true;
      },
      focusEnd: () => editor?.chain().focus("end").run(),
    }),
    [editor],
  );

  return (
    <>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="min-h-full" />
    </>
  );
});

function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      return {
        bold: e?.isActive("bold") ?? false,
        italic: e?.isActive("italic") ?? false,
        h2: e?.isActive("heading", { level: 2 }) ?? false,
        h3: e?.isActive("heading", { level: 3 }) ?? false,
        bullet: e?.isActive("bulletList") ?? false,
        ordered: e?.isActive("orderedList") ?? false,
        quote: e?.isActive("blockquote") ?? false,
      };
    },
  });

  if (!editor) return null;

  const items = [
    { icon: Bold, label: "Bold", active: state?.bold, run: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: "Italic", active: state?.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { icon: Heading2, label: "Heading", active: state?.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: "Subheading", active: state?.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: List, label: "Bullet list", active: state?.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: "Numbered list", active: state?.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Quote, label: "Quote", active: state?.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-6 mb-6 flex flex-wrap items-center gap-0.5 border-b border-line/60 bg-paper/85 px-6 py-1.5 backdrop-blur">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          // mousedown + preventDefault keeps the editor selection while clicking
          onMouseDown={(e) => {
            e.preventDefault();
            it.run();
          }}
          aria-label={it.label}
          title={it.label}
          className={cn(
            "grid size-8 place-items-center rounded-md transition-colors",
            it.active
              ? "bg-accent-soft text-accent"
              : "text-ink-soft hover:bg-surface-2 hover:text-ink",
          )}
        >
          <it.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
